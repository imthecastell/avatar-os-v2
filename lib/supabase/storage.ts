import { createClient } from './server'

const BUCKET = 'avatar-os-assets'

export async function uploadAsset(
  file: Buffer,
  path: string,
  contentType: string
): Promise<string> {
  const supabase = await createClient()
  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, file, { contentType, upsert: true })

  if (error) throw error

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path)
  return data.publicUrl
}

export function getPublicUrl(path: string): string {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
  return `${url}/storage/v1/object/public/${BUCKET}/${path}`
}
