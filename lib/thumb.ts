/**
 * Returns a Supabase image-transform URL for raster assets (PNG/JPG).
 * SVGs are returned as-is (Supabase can't resize them).
 */
export function thumbUrl(cdnUrl: string, fileType: string, size = 160): string {
  if (!cdnUrl || fileType === 'svg') return cdnUrl
  return cdnUrl
    .replace('/storage/v1/object/public/', '/storage/v1/render/image/public/')
    + `?width=${size}&height=${size}&resize=contain&quality=80`
}
