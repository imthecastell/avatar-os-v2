import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'

const BUCKET = 'avatar-os-assets'

// Returns a signed upload URL so the browser can upload directly to Supabase Storage,
// bypassing Vercel's 4.5 MB body-size limit.
export async function POST(request: NextRequest) {
  const { filename, layerKey, collectionId } = await request.json()

  if (!filename || !layerKey) {
    return NextResponse.json({ error: 'Missing filename or layerKey' }, { status: 400 })
  }

  const ext = filename.split('.').pop()?.toLowerCase() ?? ''
  if (!['svg', 'png', 'jpg', 'jpeg'].includes(ext)) {
    return NextResponse.json({ error: 'Unsupported file type' }, { status: 400 })
  }

  const contentType =
    ext === 'svg'  ? 'image/svg+xml' :
    ext === 'png'  ? 'image/png'     : 'image/jpeg'

  const slug        = layerKey.replace(/[^a-z0-9-]/g, '-')
  const uniqueName  = `${Date.now()}-${filename}`
  const storagePath = collectionId
    ? `${collectionId}/${slug}/${uniqueName}`
    : `unassigned/${uniqueName}`

  const supabase = createAdminClient()

  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUploadUrl(storagePath)

  if (error || !data) {
    return NextResponse.json({ error: error?.message ?? 'Failed to create signed URL' }, { status: 500 })
  }

  const { data: { publicUrl: cdnUrl } } = supabase.storage
    .from(BUCKET)
    .getPublicUrl(storagePath)

  return NextResponse.json({ signedUrl: data.signedUrl, storagePath, cdnUrl, contentType })
}
