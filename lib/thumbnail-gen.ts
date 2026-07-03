import sharp from 'sharp'

/**
 * Rasterizes a source image buffer into a small compressed PNG thumbnail
 * for grid previews. Not used for SVGs with real vector content (those
 * stay tiny on their own) — only for raster assets (png/jpg) and the
 * occasional oversized "raster wrapped in SVG" export.
 */
export async function makeThumbnail(buffer: Buffer, size = 320): Promise<Buffer> {
  return sharp(buffer)
    .resize(size, size, { fit: 'inside', withoutEnlargement: true })
    .png({ compressionLevel: 9, quality: 80 })
    .toBuffer()
}
