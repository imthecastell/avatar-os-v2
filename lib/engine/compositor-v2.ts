'use client'

// Reference colors baked into the Affinity Designer source SVGs.
// These exact strings get replaced with the user's chosen hex at render time.
export const SKIN_REF = 'rgb(249,199,182)'
export const HAIR_REF = 'rgb(0,177,129)'

export interface LayerConfig {
  file:      string      // e.g. '/avatars/head.svg'
  variants?: string[]    // all selectable group IDs inside the file
  group?:    string      // currently active variant group
  scaleX?:   number      // horizontal scale (face width), default 1.0
  colorKey?: 'skin' | 'hair'
  visible?:  boolean
  order:     number      // z-order: lower = drawn first = behind
}

export interface RenderRequest {
  layers:    LayerConfig[]
  skinColor: string
  hairColor: string
}

export class CompositorV2 {
  private canvas!: HTMLCanvasElement
  private ctx!:    CanvasRenderingContext2D
  private size = 1024
  // Cache raw SVG text per URL — invalidated only on clearCache()
  private svgCache = new Map<string, string>()

  init(canvas: HTMLCanvasElement, size = 1024) {
    this.canvas        = canvas
    this.size          = size
    canvas.width       = size
    canvas.height      = size
    this.ctx           = canvas.getContext('2d')!
  }

  async render(req: RenderRequest): Promise<void> {
    this.ctx.clearRect(0, 0, this.size, this.size)

    const ordered = [...req.layers]
      .filter(l => l.visible !== false)
      .sort((a, b) => a.order - b.order)

    for (const layer of ordered) {
      await this.drawLayer(layer, req)
    }
  }

  private async drawLayer(layer: LayerConfig, req: RenderRequest): Promise<void> {
    let svg = await this.fetchSVG(layer.file)

    // Hide non-active variant groups
    if (layer.group && layer.variants && layer.variants.length > 1) {
      svg = this.setActiveGroup(svg, layer.group, layer.variants)
    }

    // Replace color tokens
    if (layer.colorKey === 'skin') svg = this.recolor(svg, SKIN_REF, req.skinColor)
    if (layer.colorKey === 'hair') svg = this.recolor(svg, HAIR_REF, req.hairColor)

    const bitmap = await this.svgToBitmap(svg)

    const scaleX = layer.scaleX ?? 1.0
    this.ctx.save()
    if (scaleX !== 1.0) {
      // Scale horizontally around center
      this.ctx.translate(this.size / 2, 0)
      this.ctx.scale(scaleX, 1)
      this.ctx.translate(-this.size / 2, 0)
    }
    this.ctx.drawImage(bitmap, 0, 0, this.size, this.size)
    this.ctx.restore()
    bitmap.close()
  }

  // Add style="display:none" to all variant groups except the active one.
  // Works by matching the id attribute — safe as long as variant IDs are unique.
  private setActiveGroup(svg: string, activeId: string, variants: string[]): string {
    let result = svg
    for (const v of variants) {
      if (v === activeId) continue
      result = result.replaceAll(`id="${v}"`, `id="${v}" style="display:none"`)
    }
    return result
  }

  private recolor(svg: string, ref: string, hex: string): string {
    const lo = ref.toLowerCase()
    const to = hex.toLowerCase()
    return svg.replaceAll(lo, to).replaceAll(lo.toUpperCase(), to)
  }

  private async fetchSVG(url: string): Promise<string> {
    const cached = this.svgCache.get(url)
    if (cached) return cached
    const text = await fetch(url).then(r => r.text())
    this.svgCache.set(url, text)
    return text
  }

  private async svgToBitmap(svg: string): Promise<ImageBitmap> {
    const blob = new Blob([svg], { type: 'image/svg+xml' })
    const burl = URL.createObjectURL(blob)
    const img  = new Image()
    await new Promise<void>((resolve, reject) => {
      img.onload  = () => resolve()
      img.onerror = reject
      img.src     = burl
    })
    URL.revokeObjectURL(burl)
    const oc  = new OffscreenCanvas(this.size, this.size)
    const ctx = oc.getContext('2d')!
    ctx.drawImage(img, 0, 0, this.size, this.size)
    return createImageBitmap(oc)
  }

  exportPNG(): string {
    return this.canvas.toDataURL('image/png')
  }

  clearCache(): void {
    this.svgCache.clear()
  }
}
