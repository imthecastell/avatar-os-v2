'use client'

import type { AvatarState, Layer, Asset } from '@/types'

export class AvatarCompositor {
  private canvas!: HTMLCanvasElement
  private ctx!: CanvasRenderingContext2D
  private size = 2048
  private renderCache = new Map<string, ImageBitmap>()
  private svgCache = new Map<string, string>()

  init(canvas: HTMLCanvasElement) {
    this.canvas = canvas
    this.canvas.width = this.size
    this.canvas.height = this.size
    this.ctx = canvas.getContext('2d')!
  }

  async render(state: AvatarState, layers: Layer[], assets: Asset[]) {
    this.ctx.clearRect(0, 0, this.size, this.size)

    const sortedLayers = [...layers].sort((a, b) => a.orderIndex - b.orderIndex)

    for (const layer of sortedLayers) {
      const assetId = state.selectedAssets[layer.layerKey]
      if (!assetId) continue

      const asset = assets.find(a => a.id === assetId)
      if (!asset) continue

      this.ctx.globalCompositeOperation = layer.blendMode as GlobalCompositeOperation

      if (asset.fileType === 'svg') {
        await this.drawSVG(asset, layer, state.tokens)
      } else {
        await this.drawImage(asset)
      }

      this.ctx.globalCompositeOperation = 'source-over'
    }
  }

  private async drawSVG(
    asset: Asset,
    layer: Layer,
    tokens: AvatarState['tokens']
  ) {
    const tokenValue = layer.colorToken
      ? tokens[layer.colorToken as keyof typeof tokens]
      : 'none'
    const cacheKey = `${asset.id}::${tokenValue}`

    if (this.renderCache.has(cacheKey)) {
      this.ctx.drawImage(this.renderCache.get(cacheKey)!, 0, 0, this.size, this.size)
      return
    }

    let svgText = this.svgCache.get(asset.cdnUrl)
    if (!svgText) {
      const res = await fetch(asset.cdnUrl)
      svgText = await res.text()
      this.svgCache.set(asset.cdnUrl, svgText)
    }

    if (layer.colorToken && tokens[layer.colorToken]) {
      const role = layer.colorToken === 'skin-color' ? 'skin' : 'primary'
      const originalColor = asset.colorMap.find(c => c.role === role)
      if (originalColor) {
        svgText = this.recolorSVG(
          svgText,
          originalColor.original,
          tokens[layer.colorToken]
        )
      }
    }

    const blob = new Blob([svgText], { type: 'image/svg+xml' })
    const url = URL.createObjectURL(blob)
    const img = new Image()
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve()
      img.onerror = reject
      img.src = url
    })
    URL.revokeObjectURL(url)

    const oc = new OffscreenCanvas(this.size, this.size)
    const ctx = oc.getContext('2d')!
    ctx.drawImage(img, 0, 0, this.size, this.size)
    const bitmap = await createImageBitmap(oc)

    this.renderCache.set(cacheKey, bitmap)
    this.ctx.drawImage(bitmap, 0, 0, this.size, this.size)
  }

  private async drawImage(asset: Asset) {
    if (this.renderCache.has(asset.id)) {
      this.ctx.drawImage(this.renderCache.get(asset.id)!, 0, 0, this.size, this.size)
      return
    }

    const res = await fetch(asset.cdnUrl)
    const blob = await res.blob()
    const raw = await createImageBitmap(blob)
    const oc = new OffscreenCanvas(this.size, this.size)
    const ctx = oc.getContext('2d')!
    ctx.imageSmoothingEnabled = true
    ctx.imageSmoothingQuality = 'high'
    ctx.drawImage(raw, 0, 0, this.size, this.size)
    const bitmap = await createImageBitmap(oc)

    this.renderCache.set(asset.id, bitmap)
    this.ctx.drawImage(bitmap, 0, 0, this.size, this.size)
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
