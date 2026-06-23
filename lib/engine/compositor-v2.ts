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
  // Raw SVG text cache — keyed by URL
  private svgCache = new Map<string, string>()
  // Bounding-box viewBox cache — keyed by "url::groupId"
  private viewBoxCache = new Map<string, string>()

  init(canvas: HTMLCanvasElement, size = 1024) {
    this.canvas  = canvas
    this.size    = size
    canvas.width = size
    canvas.height = size
    this.ctx     = canvas.getContext('2d')!
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

    // Select variant: hide siblings and zoom viewBox to the active group
    if (layer.group && layer.variants && layer.variants.length > 1) {
      svg = await this.activateGroup(svg, layer.file, layer.group, layer.variants)
    }

    // Replace color tokens
    if (layer.colorKey === 'skin') svg = this.recolor(svg, SKIN_REF, req.skinColor)
    if (layer.colorKey === 'hair') svg = this.recolor(svg, HAIR_REF, req.hairColor)

    const bitmap = await this.svgToBitmap(svg)

    const scaleX = layer.scaleX ?? 1.0
    this.ctx.save()
    if (scaleX !== 1.0) {
      this.ctx.translate(this.size / 2, 0)
      this.ctx.scale(scaleX, 1)
      this.ctx.translate(-this.size / 2, 0)
    }
    this.ctx.drawImage(bitmap, 0, 0, this.size, this.size)
    this.ctx.restore()
    bitmap.close()
  }

  /**
   * Hide all non-active variant groups in the SVG text, then rewrite the
   * viewBox so the active group fills the entire canvas (auto-scale).
   * The bounding-box lookup is cached after the first call per (file, group).
   */
  private async activateGroup(
    svg: string,
    file: string,
    activeId: string,
    variants: string[],
  ): Promise<string> {
    // 1 — hide siblings
    let result = svg
    for (const v of variants) {
      if (v === activeId) continue
      result = result.replaceAll(`id="${v}"`, `id="${v}" style="display:none"`)
    }

    // 2 — get (and cache) the viewBox for this group
    const cacheKey = `${file}::${activeId}`
    let vb = this.viewBoxCache.get(cacheKey)
    if (!vb) {
      vb = await this.computeGroupViewBox(result, activeId) ?? undefined
      if (vb) this.viewBoxCache.set(cacheKey, vb)
    }

    // 3 — rewrite the SVG's viewBox so this group fills the canvas
    if (vb) {
      result = result.replace(/viewBox="[^"]*"/, `viewBox="${vb}"`)
    }

    return result
  }

  /**
   * Inject the SVG into a hidden DOM node, call getBBox() on the target group,
   * and return a viewBox string with a small padding margin.
   */
  private computeGroupViewBox(svgText: string, groupId: string): Promise<string | null> {
    return new Promise(resolve => {
      const container = document.createElement('div')
      container.style.cssText =
        'position:fixed;left:-9999px;top:-9999px;' +
        'width:2001px;height:2000px;visibility:hidden;pointer-events:none'
      container.innerHTML = svgText
      document.body.appendChild(container)

      // One tick so the browser lays out the SVG before calling getBBox
      setTimeout(() => {
        try {
          const group = container.querySelector(`#${groupId}`) as SVGGraphicsElement | null
          if (!group) { resolve(null); return }

          const b = group.getBBox()
          if (b.width === 0 || b.height === 0) { resolve(null); return }

          // Add padding proportional to the bounding box
          const pad = Math.max(b.width, b.height) * 0.04
          resolve(`${b.x - pad} ${b.y - pad} ${b.width + pad * 2} ${b.height + pad * 2}`)
        } catch {
          resolve(null)
        } finally {
          document.body.removeChild(container)
        }
      }, 0)
    })
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
    this.viewBoxCache.clear()
  }
}
