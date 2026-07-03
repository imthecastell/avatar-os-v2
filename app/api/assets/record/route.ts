import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { makeThumbnail } from '@/lib/thumbnail-gen'
import { uploadBinary } from '@/lib/storage-upload'

// Records an asset in the DB after the browser has uploaded it directly to Supabase Storage.
export async function POST(request: NextRequest) {
  const supabase = createAdminClient()
  const body = await request.json()

  const {
    collectionId, layerKey, filename, storagePath, cdnUrl,
    fileType, originalSize, colorMap, svgEditable,
  } = body

  // Raster thumbnail for grid previews — Supabase's image-transform endpoint
  // is disabled on this project's plan, so we pre-render one ourselves by
  // fetching the file we just uploaded and downsizing it.
  let thumbUrl: string | null = null
  if (fileType === 'png' || fileType === 'jpg') {
    try {
      const fileRes = await fetch(cdnUrl)
      const buffer  = Buffer.from(await fileRes.arrayBuffer())
      const thumbBuffer = await makeThumbnail(buffer)
      const thumbPath = `thumbs/${String(storagePath).replace(/\.[^.]+$/, '.png')}`
      const thumbResult = await uploadBinary(thumbPath, thumbBuffer, 'image/png')
      if ('publicUrl' in thumbResult) thumbUrl = thumbResult.publicUrl
    } catch {
      // Thumbnail is a nice-to-have; fall back to the full asset on failure
    }
  }

  const { data: asset, error } = await supabase
    .from('assets')
    .insert({
      collection_id: collectionId || null,
      layer_key:     layerKey,
      name:          filename.replace(/\.[^.]+$/, ''),
      filename,
      storage_path:  storagePath,
      cdn_url:       cdnUrl,
      thumb_url:     thumbUrl,
      file_type:     fileType,
      original_size: originalSize ?? 0,
      color_map:     colorMap ?? [],
      svg_editable:  svgEditable ?? false,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ asset, cdnUrl })
}
