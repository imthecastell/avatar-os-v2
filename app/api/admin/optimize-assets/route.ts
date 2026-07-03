import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { uploadBinary } from '@/lib/storage-upload'
import sharp from 'sharp'

const SIZE_THRESHOLD = 300 * 1024 // real vector SVGs in this project are all well under this

/**
 * One-time/repeatable cleanup: some SVGs were exported from Affinity as a
 * vector wrapper around a huge embedded base64 raster (10-24MB files).
 * Browsers — especially on iPad/mobile — can fail to render or take a very
 * long time on files that size. This extracts the embedded raster,
 * downsizes it to the canvas render resolution, and re-uploads as PNG.
 *
 * Runs from Vercel (fast same-cloud link to Supabase) instead of a local
 * machine, where large-file transfers were timing out.
 */
export async function POST(request: NextRequest) {
  // Autorización: sesión de admin normal, o un secreto de migración one-off
  // (para poder dispararlo por curl sin exponer la sesión del navegador).
  const secretHeader = request.headers.get('x-admin-secret')
  const hasSecret = !!process.env.ADMIN_MIGRATION_SECRET && secretHeader === process.env.ADMIN_MIGRATION_SECRET

  if (!hasSecret) {
    const sessionClient = await createClient()
    const { data: { user } } = await sessionClient.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createAdminClient()

  // repair=1: algunos PNG convertidos en una corrida previa (antes del fix de
  // uploadBinary) quedaron corruptos. Se reconstruyen desde el .svg original,
  // que nunca se borró de storage — solo cambió a qué apunta cdn_url en la fila.
  const repair = new URL(request.url).searchParams.get('repair') === '1'
  if (repair) {
    const { data: pngAssets } = await supabase
      .from('assets')
      .select('id, layer_key, name, filename, storage_path, cdn_url')
      .eq('file_type', 'png')

    const repaired: { label: string; ok: boolean; detail: string }[] = []
    for (const asset of pngAssets ?? []) {
      const label = `${asset.layer_key}/${asset.name}`
      try {
        const check = await fetch(asset.cdn_url)
        const checkBuf = Buffer.from(await check.arrayBuffer())
        await sharp(checkBuf).metadata() // throws si está corrupto
        continue // válido, no toca reparar
      } catch {
        // corrupto — reconstruir desde el .svg original
      }
      try {
        const svgUrl = asset.cdn_url.replace(/\.png$/i, '.svg')
        const svgRes  = await fetch(svgUrl)
        if (!svgRes.ok) { repaired.push({ label, ok: false, detail: `svg original no encontrado (${svgUrl})` }); continue }
        const svgText = await svgRes.text()
        const m = svgText.match(/data:image\/(png|jpeg);base64,([A-Za-z0-9+/=]+)"/)
        if (!m) { repaired.push({ label, ok: false, detail: 'svg original sin base64 embebido' }); continue }

        const raster = Buffer.from(m[2], 'base64')
        const png = await sharp(raster).resize(2048, 2048, { fit: 'inside', withoutEnlargement: true }).png({ compressionLevel: 9, quality: 90 }).toBuffer()
        const upResult = await uploadBinary(asset.storage_path, png, 'image/png')
        if ('error' in upResult) { repaired.push({ label, ok: false, detail: `upload: ${upResult.error}` }); continue }

        const thumb = await sharp(png).resize(320, 320, { fit: 'inside' }).png({ compressionLevel: 9, quality: 80 }).toBuffer()
        const thumbPath = `thumbs/${asset.storage_path}`
        const thumbResult = await uploadBinary(thumbPath, thumb, 'image/png')

        await supabase.from('assets').update({
          cdn_url: upResult.publicUrl,
          thumb_url: 'publicUrl' in thumbResult ? thumbResult.publicUrl : null,
          original_size: png.length,
        }).eq('id', asset.id)

        repaired.push({ label, ok: true, detail: `reparado, ${(png.length / 1024).toFixed(0)}KB` })
      } catch (err) {
        repaired.push({ label, ok: false, detail: err instanceof Error ? err.message : String(err) })
      }
    }
    return NextResponse.json({ repaired: repaired.length, results: repaired })
  }

  const { data: assets, error } = await supabase
    .from('assets')
    .select('id, layer_key, name, filename, storage_path, cdn_url, original_size')
    .eq('file_type', 'svg')
    .gt('original_size', SIZE_THRESHOLD)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const results: { label: string; ok: boolean; detail: string }[] = []

  for (const asset of assets ?? []) {
    const label = `${asset.layer_key}/${asset.name}`
    try {
      const svgRes = await fetch(asset.cdn_url)
      const svgText = await svgRes.text()

      const m = svgText.match(/data:image\/(png|jpeg);base64,([A-Za-z0-9+/=]+)"/)
      if (!m) {
        results.push({ label, ok: false, detail: 'sin imagen base64 embebida (vector real, se deja igual)' })
        continue
      }

      const raster = Buffer.from(m[2], 'base64')
      const png = await sharp(raster)
        .resize(2048, 2048, { fit: 'inside', withoutEnlargement: true })
        .png({ compressionLevel: 9, quality: 90 })
        .toBuffer()

      const newFilename    = asset.filename.replace(/\.svg$/i, '.png')
      const newStoragePath = asset.storage_path.replace(/\.svg$/i, '.png')

      const upResult = await uploadBinary(newStoragePath, png, 'image/png')
      if ('error' in upResult) { results.push({ label, ok: false, detail: `upload: ${upResult.error}` }); continue }
      const newCdnUrl = upResult.publicUrl

      const thumb = await sharp(png).resize(320, 320, { fit: 'inside' }).png({ compressionLevel: 9, quality: 80 }).toBuffer()
      const thumbPath = `thumbs/${newStoragePath}`
      const thumbResult = await uploadBinary(thumbPath, thumb, 'image/png')
      const thumbUrl = 'publicUrl' in thumbResult ? thumbResult.publicUrl : null

      const { error: patchErr } = await supabase
        .from('assets')
        .update({
          file_type:     'png',
          filename:      newFilename,
          storage_path:  newStoragePath,
          cdn_url:       newCdnUrl,
          thumb_url:     thumbUrl,
          original_size: png.length,
          color_map:     [],
          svg_editable:  false,
        })
        .eq('id', asset.id)
      if (patchErr) { results.push({ label, ok: false, detail: `db: ${patchErr.message}` }); continue }

      results.push({ label, ok: true, detail: `${(asset.original_size / 1024 / 1024).toFixed(1)}MB → ${(png.length / 1024).toFixed(0)}KB` })
    } catch (err) {
      results.push({ label, ok: false, detail: err instanceof Error ? err.message : String(err) })
    }
  }

  // Segunda pasada: generar thumb_url para assets raster que aún no tengan
  // (fondos y los recién convertidos arriba). Supabase's image-transform
  // endpoint está deshabilitado en este plan, así que se pre-renderiza aquí.
  // force=1 regenera todos los thumbs (útil tras arreglar un bug de subida);
  // sin el flag, solo rellena los que faltan.
  const force = new URL(request.url).searchParams.get('force') === '1'
  let rasterQuery = supabase
    .from('assets')
    .select('id, layer_key, name, storage_path, cdn_url')
    .in('file_type', ['png', 'jpg'])
  if (!force) rasterQuery = rasterQuery.is('thumb_url', null)
  const { data: rasterAssets } = await rasterQuery

  for (const asset of rasterAssets ?? []) {
    const label = `${asset.layer_key}/${asset.name} (thumb)`
    try {
      const fileRes = await fetch(asset.cdn_url)
      const buffer  = Buffer.from(await fileRes.arrayBuffer())
      const thumb = await sharp(buffer).resize(320, 320, { fit: 'inside', withoutEnlargement: true }).png({ compressionLevel: 9, quality: 80 }).toBuffer()
      const thumbPath = `thumbs/${asset.storage_path.replace(/\.[^.]+$/, '.png')}`
      const upResult = await uploadBinary(thumbPath, thumb, 'image/png')
      if ('error' in upResult) { results.push({ label, ok: false, detail: `upload: ${upResult.error}` }); continue }
      const { error: patchErr } = await supabase.from('assets').update({ thumb_url: upResult.publicUrl }).eq('id', asset.id)
      if (patchErr) { results.push({ label, ok: false, detail: `db: ${patchErr.message}` }); continue }
      results.push({ label, ok: true, detail: `${(buffer.length / 1024).toFixed(0)}KB → ${(thumb.length / 1024).toFixed(0)}KB thumb` })
    } catch (err) {
      results.push({ label, ok: false, detail: err instanceof Error ? err.message : String(err) })
    }
  }

  return NextResponse.json({ processed: results.length, results })
}
