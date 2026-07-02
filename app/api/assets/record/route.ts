import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'

// Records an asset in the DB after the browser has uploaded it directly to Supabase Storage.
export async function POST(request: NextRequest) {
  const supabase = createAdminClient()
  const body = await request.json()

  const {
    collectionId, layerKey, filename, storagePath, cdnUrl,
    fileType, originalSize, colorMap, svgEditable,
  } = body

  const { data: asset, error } = await supabase
    .from('assets')
    .insert({
      collection_id: collectionId || null,
      layer_key:     layerKey,
      name:          filename.replace(/\.[^.]+$/, ''),
      filename,
      storage_path:  storagePath,
      cdn_url:       cdnUrl,
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
