/**
 * Resolves the best available thumbnail URL for an asset.
 *
 * Supabase's image-transform endpoint (`/storage/v1/render/image/...`) is
 * disabled on this project's plan (403 FeatureNotEnabled) — for both SVG
 * and raster inputs. Real thumbnails are generated server-side at upload
 * time (see `lib/thumbnail-gen.ts`) and stored in `asset.thumbUrl`.
 * This just picks that pre-generated thumb, falling back to the full
 * asset for anything uploaded before thumbnails existed.
 */
export function pickThumb(asset: { cdnUrl: string; thumbUrl?: string | null }): string {
  return asset.thumbUrl || asset.cdnUrl
}
