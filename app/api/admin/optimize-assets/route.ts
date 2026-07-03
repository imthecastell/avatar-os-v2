import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import sharp from 'sharp'

const BUCKET = 'avatar-os-assets'
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

      const { error: upErr } = await supabase.storage
        .from(BUCKET)
        .upload(newStoragePath, png, { contentType: 'image/png', upsert: true })
      if (upErr) { results.push({ label, ok: false, detail: `upload: ${upErr.message}` }); continue }

      const { data: { publicUrl: newCdnUrl } } = supabase.storage.from(BUCKET).getPublicUrl(newStoragePath)

      const thumb = await sharp(png).resize(320, 320, { fit: 'inside' }).png({ compressionLevel: 9, quality: 80 }).toBuffer()
      const thumbPath = `thumbs/${newStoragePath}`
      await supabase.storage.from(BUCKET).upload(thumbPath, thumb, { contentType: 'image/png', upsert: true })
      const { data: { publicUrl: thumbUrl } } = supabase.storage.from(BUCKET).getPublicUrl(thumbPath)

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
  const { data: rasterAssets } = await supabase
    .from('assets')
    .select('id, layer_key, name, storage_path, cdn_url')
    .in('file_type', ['png', 'jpg'])
    .is('thumb_url', null)

  for (const asset of rasterAssets ?? []) {
    const label = `${asset.layer_key}/${asset.name} (thumb)`
    try {
      const fileRes = await fetch(asset.cdn_url)
      const buffer  = Buffer.from(await fileRes.arrayBuffer())
      const thumb = await sharp(buffer).resize(320, 320, { fit: 'inside', withoutEnlargement: true }).png({ compressionLevel: 9, quality: 80 }).toBuffer()
      const thumbPath = `thumbs/${asset.storage_path.replace(/\.[^.]+$/, '.png')}`
      const { error: upErr } = await supabase.storage.from(BUCKET).upload(thumbPath, thumb, { contentType: 'image/png', upsert: true })
      if (upErr) { results.push({ label, ok: false, detail: `upload: ${upErr.message}` }); continue }
      const { data: { publicUrl: thumbUrl } } = supabase.storage.from(BUCKET).getPublicUrl(thumbPath)
      const { error: patchErr } = await supabase.from('assets').update({ thumb_url: thumbUrl }).eq('id', asset.id)
      if (patchErr) { results.push({ label, ok: false, detail: `db: ${patchErr.message}` }); continue }
      results.push({ label, ok: true, detail: `${(buffer.length / 1024).toFixed(0)}KB → ${(thumb.length / 1024).toFixed(0)}KB thumb` })
    } catch (err) {
      results.push({ label, ok: false, detail: err instanceof Error ? err.message : String(err) })
    }
  }

  return NextResponse.json({ processed: results.length, results })
}
