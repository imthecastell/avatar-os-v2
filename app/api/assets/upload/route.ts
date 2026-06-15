import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { detectLayerFromFilename, detectEditableColors } from '@/lib/engine/asset-classifier'

const BUCKET = 'avatar-os-assets'

export async function POST(request: NextRequest) {
  // DB/storage operations with service role (bypasses RLS)
  const supabase = createAdminClient()

  const formData = await request.formData()
  const file = formData.get('file') as File | null
  const collectionId = formData.get('collectionId') as string
  const layerKeyOverride = formData.get('layer') as string | null

  if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 })

  const filename = file.name
  const ext = filename.split('.').pop()?.toLowerCase() || ''
  const validExts = ['svg', 'png', 'jpg', 'jpeg']
  if (!validExts.includes(ext)) {
    return NextResponse.json({ error: 'Unsupported file type' }, { status: 400 })
  }

  const fileType = ext === 'jpeg' ? 'jpg' : ext as 'svg' | 'png' | 'jpg'
  const layerKey = layerKeyOverride || detectLayerFromFilename(filename) || 'unassigned'

  // Read file bytes
  const bytes = await file.arrayBuffer()
  const buffer = Buffer.from(bytes)

  // Detect colors if SVG
  let colorMap: object[] = []
  if (fileType === 'svg') {
    const text = new TextDecoder().decode(buffer)
    colorMap = detectEditableColors(text)
  }

  // Build storage path
  const slug = layerKey.replace(/[^a-z0-9-]/g, '-')
  const uniqueName = `${Date.now()}-${filename}`
  const storagePath = collectionId
    ? `${collectionId}/${slug}/${uniqueName}`
    : `unassigned/${uniqueName}`

  // Upload to Supabase Storage
  const contentType = fileType === 'svg'
    ? 'image/svg+xml'
    : fileType === 'png'
    ? 'image/png'
    : 'image/jpeg'

  const { error: uploadError } = await supabase.storage
    .from(BUCKET)
    .upload(storagePath, buffer, { contentType, upsert: true })

  if (uploadError) {
    return NextResponse.json({ error: uploadError.message }, { status: 500 })
  }

  const { data: { publicUrl: cdnUrl } } = supabase.storage
    .from(BUCKET)
    .getPublicUrl(storagePath)

  // Insert asset record
  const { data: asset, error: dbError } = await supabase
    .from('assets')
    .insert({
      collection_id: collectionId || null,
      layer_key: layerKey,
      name: filename.replace(/\.[^.]+$/, ''),
      filename,
      storage_path: storagePath,
      cdn_url: cdnUrl,
      file_type: fileType,
      original_size: bytes.byteLength,
      color_map: colorMap,
    })
    .select()
    .single()

  if (dbError) return NextResponse.json({ error: dbError.message }, { status: 500 })

  return NextResponse.json({
    asset,
    cdnUrl,
    detectedLayer: detectLayerFromFilename(filename),
  })
}
