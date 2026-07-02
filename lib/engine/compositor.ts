'use client'

import type { AvatarState, Layer, Asset } from '@/types'
import { detectEditableColors } from '@/lib/engine/asset-classifier'

export class AvatarCompositor {
  private canvas!: HTMLCanvasElement
  private ctx!:    CanvasRenderingContext2D
  private size = 2048
  private renderCache = new Map<string, ImageBitmap>()
  private svgCache    = new Map<string, string>()
  // Safari (iPad) mata la página si el consumo de memoria crece sin límite.
  // Cada bitmap cacheado pesa size²×4 bytes (16MB a 2048px), así que el caché es LRU acotado.
  private maxCacheEntries = 12
  private renderToken = 0

  init(canvas: HTMLCanvasElement, size = 2048) {
    this.size = size
    this.canvas = canvas
    this.canvas.width  = this.size
    this.canvas.height = this.size
    this.ctx = canvas.getContext('2d')!
  }

  async render(state: AvatarState, layers: Layer[], assets: Asset[]) {
    // Si llega un render más nuevo mientras este espera un await, este se aborta
    // para no intercalar draws de dos renders sobre el mismo canvas.
    const token = ++this.renderToken
    this.ctx.clearRect(0, 0, this.size, this.size)

    // Sort by orderIndex, then force effect-final to always render last (on top of everything)
    const baseLayers   = [...layers].sort((a, b) => a.orderIndex - b.orderIndex).filter(l => l.layerKey !== 'effect-final')
    const effectLayers = [...layers].filter(l => l.layerKey === 'effect-final')
    const sortedLayers = [...baseLayers, ...effectLayers]

    // Build a set of active mask asset IDs to skip them as regular layers
    const autoMasks = new Set<string>()
    for (const layer of sortedLayers) {
      const assetId = state.selectedAssets[layer.layerKey]
      if (!assetId) continue
      const asset = assets.find(a => a.id === assetId)
      if (asset?.maskAssetId) autoMasks.add(asset.maskAssetId)
    }

    for (const layer of sortedLayers) {
      if (token !== this.renderToken) return
      const assetId = state.selectedAssets[layer.layerKey]
      if (!assetId) continue

      const asset = assets.find(a => a.id === assetId)
      if (!asset) continue

      // Skip assets that are being used as auto-masks by another layer
      if (autoMasks.has(asset.id)) continue

      // Un asset roto (404, SVG inválido) no debe tumbar el render completo
      try {
        if (asset.maskAssetId) {
          const maskAsset = assets.find(a => a.id === asset.maskAssetId)
          if (maskAsset) {
            await this.drawWithMask(asset, maskAsset, layer, state.tokens)
            continue
          }
        }

        this.ctx.globalCompositeOperation = layer.blendMode as GlobalCompositeOperation
        this.ctx.globalAlpha = layer.opacity ?? 1
        await this.drawAsset(asset, layer, state.tokens)
      } catch (err) {
        console.warn(`[compositor] fallo al dibujar capa "${layer.layerKey}"`, err)
      } finally {
        this.ctx.globalAlpha = 1
        this.ctx.globalCompositeOperation = 'source-over'
      }
    }
  }

  // ── Draw asset with an auto-mask (hat masks hair underneath) ──────────
  private async drawWithMask(asset: Asset, maskAsset: Asset, layer: Layer, tokens: AvatarState['tokens']) {
    const bitmap = await this.getBitmap(asset, layer, tokens)
    const { scale = 1, offsetX = 0, offsetY = 0 } = asset.transform ?? {}
    const [sw, sh] = this.fitDims(bitmap, scale)
    const x = (this.size - sw) / 2 + offsetX
    const y = (this.size - sh) / 2 + offsetY

    const maskBitmap = await this.getBitmap(maskAsset, layer, tokens)
    this.ctx.globalCompositeOperation = 'destination-out'
    const ms = maskAsset.transform?.scale ?? 1
    const [mw, mh] = this.fitDims(maskBitmap, ms)
    const mx = (this.size - mw) / 2 + (maskAsset.transform?.offsetX ?? 0)
    const my = (this.size - mh) / 2 + (maskAsset.transform?.offsetY ?? 0)
    this.ctx.drawImage(maskBitmap, mx, my, mw, mh)
    this.ctx.globalCompositeOperation = 'source-over'

    this.ctx.globalCompositeOperation = layer.blendMode as GlobalCompositeOperation
    this.ctx.globalAlpha = layer.opacity ?? 1
    this.ctx.drawImage(bitmap, x, y, sw, sh)
    this.ctx.globalAlpha = 1
    this.ctx.globalCompositeOperation = 'source-over'
  }

  // ── Generic asset draw (SVG or raster) with transform ─────────────────
  private async drawAsset(asset: Asset, layer: Layer, tokens: AvatarState['tokens']) {
    const bitmap = await this.getBitmap(asset, layer, tokens)
    const { scale = 1, offsetX = 0, offsetY = 0 } = asset.transform ?? {}
    const [w, h] = this.fitDims(bitmap, scale)
    const x = (this.size - w) / 2 + offsetX
    const y = (this.size - h) / 2 + offsetY
    this.ctx.drawImage(bitmap, x, y, w, h)
  }

  // contain-fit: largest side fills this.size * scale, aspect ratio preserved
  private fitDims(bitmap: ImageBitmap, scale: number): [number, number] {
    if (bitmap.width === bitmap.height) {
      const s = this.size * scale
      return [s, s]
    }
    const fit = (this.size * scale) / Math.max(bitmap.width, bitmap.height)
    return [bitmap.width * fit, bitmap.height * fit]
  }

  // ── Get or build a cached ImageBitmap for any asset (LRU acotado) ─────
  private async getBitmap(asset: Asset, layer: Layer, tokens: AvatarState['tokens']): Promise<ImageBitmap> {
    const tokenValue = layer.colorToken ? tokens[layer.colorToken] : null
    const cacheKey   = `${asset.id}::${tokenValue ?? ''}`

    const cached = this.renderCache.get(cacheKey)
    if (cached) {
      // Refrescar recencia: el Map itera en orden de inserción
      this.renderCache.delete(cacheKey)
      this.renderCache.set(cacheKey, cached)
      return cached
    }

    let bitmap: ImageBitmap

    if (asset.fileType === 'svg') {
      bitmap = await this.buildSVGBitmap(asset, layer, tokens)
    } else {
      bitmap = await this.buildImageBitmap(asset)
    }

    this.renderCache.set(cacheKey, bitmap)

    // Evict del más viejo cuando se supera el límite
    while (this.renderCache.size > this.maxCacheEntries) {
      const oldestKey = this.renderCache.keys().next().value as string
      this.renderCache.get(oldestKey)?.close()
      this.renderCache.delete(oldestKey)
    }

    return bitmap
  }

  private async buildSVGBitmap(asset: Asset, layer: Layer, tokens: AvatarState['tokens']): Promise<ImageBitmap> {
    let svgText = this.svgCache.get(asset.cdnUrl)
    if (!svgText) {
      const res = await fetch(asset.cdnUrl)
      svgText   = await res.text()
      this.svgCache.set(asset.cdnUrl, svgText)
    }

    if (layer.colorToken && tokens[layer.colorToken]) {
      // Always recolor the dominant color (role 'skin' = most frequent non-black/white).
      // Hair SVGs: dominant = hair color. Head/body SVGs: dominant = skin color.
      const colorMap = asset.colorMap?.length ? asset.colorMap : detectEditableColors(svgText)
      const originalColor = colorMap.find((c: { role: string }) => c.role === 'skin')
      if (originalColor) {
        svgText = this.recolorSVG(svgText, (originalColor as { original: string }).original, tokens[layer.colorToken])
      }
    }

    const blob = new Blob([svgText], { type: 'image/svg+xml' })
    const url  = URL.createObjectURL(blob)
    const img  = new Image()
    await new Promise<void>((resolve, reject) => {
      img.onload  = () => resolve()
      img.onerror = reject
      img.src = url
    })
    URL.revokeObjectURL(url)

    const oc  = new OffscreenCanvas(this.size, this.size)
    const ctx = oc.getContext('2d')!
    ctx.drawImage(img, 0, 0, this.size, this.size)
    return createImageBitmap(oc)
  }

  private async buildImageBitmap(asset: Asset): Promise<ImageBitmap> {
    const res  = await fetch(asset.cdnUrl)
    const blob = await res.blob()
    return createImageBitmap(blob)   // natural resolution — drawAsset handles scaling
  }

  private recolorSVG(svg: string, fromColor: string, toHex: string): string {
    const r = parseInt(toHex.slice(1, 3), 16)
    const g = parseInt(toHex.slice(3, 5), 16)
    const b = parseInt(toHex.slice(5, 7), 16)
    return svg.replaceAll(fromColor, `rgb(${r},${g},${b})`)
  }

  exportPNG(): string {
    return this.canvas.toDataURL('image/png')
  }

  clearCache() {
    this.renderCache.forEach(bm => bm.close())
    this.renderCache.clear()
    this.svgCache.clear()
  }
}
