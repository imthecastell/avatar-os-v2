import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { detectEditableColors, isSVGEditable } from '@/lib/engine/asset-classifier'
import { makeThumbnail } from '@/lib/thumbnail-gen'
import { uploadBinary } from '@/lib/storage-upload'

// Reemplaza el archivo de un asset EXISTENTE sin tocar su fila: conserva id,
// keyword_id, is_default, suggested_color, mask_asset_id, allow_transform,
// transform y cualquier color_unlocks/regla apuntando a este asset — solo
// cambian los campos derivados del archivo (cdn_url, thumb_url, file_type,
// color_map, etc). Evita perder toda la configuración al corregir un asset.
export async function POST(request: NextRequest) {
  const sessionClient = await createClient()
  const { data: { user } } = await sessionClient.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = createAdminClient()

  const formData = await request.formData()
  const file    = formData.get('file') as File | null
  const assetId = formData.get('assetId') as string | null
  if (!file || !assetId) return NextResponse.json({ error: 'Missing file or assetId' }, { status: 400 })

  const { data: existing, error: fetchErr } = await supabase.from('assets').select('*').eq('id', assetId).single()
  if (fetchErr || !existing) return NextResponse.json({ error: 'Asset no encontrado' }, { status: 404 })

  const filename = file.name
  const ext = filename.split('.').pop()?.toLowerCase() || ''
  const validExts = ['svg', 'png', 'jpg', 'jpeg']
  if (!validExts.includes(ext)) return NextResponse.json({ error: 'Tipo de archivo no soportado' }, { status: 400 })
  const fileType = ext === 'jpeg' ? 'jpg' : (ext as 'svg' | 'png' | 'jpg')

  const bytes  = await file.arrayBuffer()
  const buffer = Buffer.from(bytes)

  let colorMap: object[] = []
  let svgEditable = true
  if (fileType === 'svg') {
    const text = new TextDecoder().decode(buffer)
    colorMap = detectEditableColors(text)
    svgEditable = isSVGEditable(text)
  }

  const layerKey = existing.layer_key as string
  const slug = layerKey.replace(/[^a-z0-9-]/g, '-')
  const uniqueName  = `${Date.now()}-${filename}`
  const storagePath = existing.collection_id
    ? `${existing.collection_id}/${slug}/${uniqueName}`
    : `unassigned/${uniqueName}`

  const contentType = fileType === 'svg' ? 'image/svg+xml' : fileType === 'png' ? 'image/png' : 'image/jpeg'

  const uploadResult = await uploadBinary(storagePath, buffer, contentType)
  if ('error' in uploadResult) return NextResponse.json({ error: uploadResult.error }, { status: 500 })

  let thumbUrl: string | null = null
  if (fileType === 'png' || fileType === 'jpg') {
    try {
      const thumbBuffer = await makeThumbnail(buffer)
      const thumbPath = `thumbs/${storagePath.replace(/\.[^.]+$/, '.png')}`
      const thumbResult = await uploadBinary(thumbPath, thumbBuffer, 'image/png')
      if ('publicUrl' in thumbResult) thumbUrl = thumbResult.publicUrl
    } catch {
      // La miniatura es un extra; si falla, el asset sigue siendo válido
    }
  }

  const { data: updated, error: updateErr } = await supabase
    .from('assets')
    .update({
      filename,
      storage_path:  storagePath,
      cdn_url:       uploadResult.publicUrl,
      thumb_url:     thumbUrl,
      file_type:     fileType,
      original_size: bytes.byteLength,
      color_map:     colorMap,
      svg_editable:  svgEditable,
    })
    .eq('id', assetId)
    .select()
    .single()

  if (updateErr) return NextResponse.json({ error: updateErr.message }, { status: 500 })
  return NextResponse.json({ asset: updated })
}
