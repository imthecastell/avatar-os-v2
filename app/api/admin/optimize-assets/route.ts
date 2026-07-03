import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { uploadBinary } from '@/lib/storage-upload'
import sharp from 'sharp'
import { Resvg } from '@resvg/resvg-js'

const SIZE_THRESHOLD = 300 * 1024 // real vector SVGs in this project are all well under this

async function makeThumb(png: Buffer): Promise<Buffer> {
  return sharp(png).resize(320, 320, { fit: 'inside', withoutEnlargement: true }).png({ compressionLevel: 9, quality: 80 }).toBuffer()
}

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

  // rerender=1: emotion/frame/effect-final tenían más contenido que solo un
  // raster embebido (clips con forma real, strokes decorativos, múltiples
  // imágenes superpuestas) — la extracción base64 los descartó. Se
  // re-renderiza el SVG original completo con resvg (soporta archivos
  // grandes que sharp/librsvg rechaza) para preservar todo el contenido.
  const rerender = new URL(request.url).searchParams.get('rerender') === '1'
  if (rerender) {
    const { data: targets } = await supabase
      .from('assets')
      .select('id, layer_key, name, storage_path, cdn_url')
      .in('layer_key', ['emotion', 'frame', 'effect-final'])
      .eq('file_type', 'png')

    const rerendered: { label: string; ok: boolean; detail: string }[] = []
    for (const asset of targets ?? []) {
      const label = `${asset.layer_key}/${asset.name}`
      try {
        const svgUrl = asset.cdn_url.replace(/\.png$/i, '.svg')
        const svgRes = await fetch(svgUrl)
        if (!svgRes.ok) { rerendered.push({ label, ok: false, detail: `svg original no encontrado (${svgUrl})` }); continue }
        const svgBuf = Buffer.from(await svgRes.arrayBuffer())

        const png = new Resvg(svgBuf, { fitTo: { mode: 'width', value: 2048 } }).render().asPng()

        const upResult = await uploadBinary(asset.storage_path, png, 'image/png')
        if ('error' in upResult) { rerendered.push({ label, ok: false, detail: `upload: ${upResult.error}` }); continue }

        const thumb = await makeThumb(png)
        const thumbResult = await uploadBinary(`thumbs/${asset.storage_path}`, thumb, 'image/png')

        await supabase.from('assets').update({
          original_size: png.length,
          thumb_url: 'publicUrl' in thumbResult ? thumbResult.publicUrl : null,
        }).eq('id', asset.id)

        rerendered.push({ label, ok: true, detail: `re-renderizado, ${(png.length / 1024).toFixed(0)}KB` })
      } catch (err) {
        rerendered.push({ label, ok: false, detail: err instanceof Error ? err.message : String(err) })
      }
    }
    return NextResponse.json({ rerendered: rerendered.length, results: rerendered })
  }

  // flowers=1: cada Arch*.svg trae DOS imágenes superpuestas (el arco y una
  // decoración floral) más 2 trazos vectoriales — la extracción solo tomó
  // la primera imagen (el arco, que se conserva tal cual). Esto crea una
  // capa nueva "flower" con las flores extraídas por separado, ocultando el
  // grupo del arco y re-renderizando solo el resto con resvg.
  const flowers = new URL(request.url).searchParams.get('flowers') === '1'
  if (flowers) {
    const { data: archAssets } = await supabase
      .from('assets')
      .select('id, collection_id, layer_key, name, filename, storage_path, cdn_url')
      .eq('layer_key', 'arch')

    const created: { label: string; ok: boolean; detail: string }[] = []
    const ensuredLayers = new Set<string>()

    for (const asset of archAssets ?? []) {
      const label = `flower/${asset.name}`
      try {
        if (asset.collection_id && !ensuredLayers.has(asset.collection_id)) {
          const { data: existingLayer } = await supabase
            .from('layers').select('id').eq('collection_id', asset.collection_id).eq('layer_key', 'flower').maybeSingle()
          if (!existingLayer) {
            const { data: archLayer } = await supabase
              .from('layers').select('order_index').eq('collection_id', asset.collection_id).eq('layer_key', 'arch').maybeSingle()
            await supabase.from('layers').insert({
              collection_id: asset.collection_id,
              layer_key: 'flower',
              label_es: 'Flores', label_en: 'Flowers',
              type: 'svg', blend_mode: 'source-over', color_token: null,
              optional: true, locked: false, visible_in_builder: true,
              order_index: (archLayer?.order_index ?? 7) + 1,
              opacity: 1,
            })
          }
          ensuredLayers.add(asset.collection_id)
        }

        const svgUrl = asset.cdn_url.replace(/\.png$/i, '.svg')
        const svgRes = await fetch(svgUrl)
        if (!svgRes.ok) { created.push({ label, ok: false, detail: `svg original no encontrado (${svgUrl})` }); continue }
        let svgText = await svgRes.text()
        if (!svgText.includes('id="Archs"')) { created.push({ label, ok: false, detail: 'estructura distinta — sin grupo "Archs"' }); continue }
        svgText = svgText.replace('<g id="Archs"', '<g id="Archs" display="none"')

        const png = new Resvg(Buffer.from(svgText), { fitTo: { mode: 'width', value: 2048 } }).render().asPng()

        const flowerName = asset.name.replace(/Arch/i, 'Flower')
        const flowerPath = asset.storage_path.replace('/arch/', '/flower/').replace(/Arch/i, 'Flower')

        const upResult = await uploadBinary(flowerPath, png, 'image/png')
        if ('error' in upResult) { created.push({ label, ok: false, detail: `upload: ${upResult.error}` }); continue }

        const thumb = await makeThumb(png)
        const thumbResult = await uploadBinary(`thumbs/${flowerPath}`, thumb, 'image/png')

        const { error: insErr } = await supabase.from('assets').insert({
          collection_id: asset.collection_id,
          layer_key: 'flower',
          name: flowerName,
          filename: `${flowerName}.png`,
          storage_path: flowerPath,
          cdn_url: upResult.publicUrl,
          thumb_url: 'publicUrl' in thumbResult ? thumbResult.publicUrl : null,
          file_type: 'png',
          original_size: png.length,
          color_map: [],
          svg_editable: false,
        })
        if (insErr) { created.push({ label, ok: false, detail: `db: ${insErr.message}` }); continue }

        created.push({ label, ok: true, detail: `creado, ${(png.length / 1024).toFixed(0)}KB` })
      } catch (err) {
        created.push({ label, ok: false, detail: err instanceof Error ? err.message : String(err) })
      }
    }
    return NextResponse.json({ created: created.length, results: created })
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
