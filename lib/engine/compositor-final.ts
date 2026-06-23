'use client'

// Avatar slot in the 2000×2000 V2.svg viewBox (precomputed from transforms)
const AVATAR_X = 384
const AVATAR_Y = 361
const AVATAR_W = 1242
const AVATAR_H = 1639

export class CompositorFinal {
  private canvas!: HTMLCanvasElement
  private ctx!: CanvasRenderingContext2D
  private size = 2000
  private v2Cache: string | null = null
  private bgCache = new Map<string, HTMLImageElement>()

  init(canvas: HTMLCanvasElement) {
    this.canvas      = canvas
    canvas.width     = this.size
    canvas.height    = this.size
    this.ctx         = canvas.getContext('2d')!
  }

  async render(avatarDataUrl: string, bgUrl: string): Promise<void> {
    const { ctx, size } = this
    ctx.clearRect(0, 0, size, size)

    // 1 — Draw background image
    const bg = await this.loadImage(bgUrl)
    ctx.drawImage(bg, 0, 0, size, size)

    // 2 — Draw built avatar at its slot position
    const avatar = await this.loadImage(avatarDataUrl)
    ctx.drawImage(avatar, AVATAR_X, AVATAR_Y, AVATAR_W, AVATAR_H)

    // 3 — Draw the V2 frame (Background + Avatar groups hidden, only frame/archs visible)
    const frame = await this.buildFrameSVG()
    const frameBitmap = await this.svgToBitmap(frame)
    ctx.drawImage(frameBitmap, 0, 0, size, size)
    frameBitmap.close()
  }

  // Fetch V2 template and hide Background + Avatar groups so only the frame remains
  private async buildFrameSVG(): Promise<string> {
    if (!this.v2Cache) {
      this.v2Cache = await fetch('/avatars/v2-template.svg').then(r => r.text())
    }
    return this.v2Cache!
      .replaceAll('id="Background"', 'id="Background" style="display:none"')
      .replaceAll('id="Avatar"',     'id="Avatar" style="display:none"')
  }

  private loadImage(src: string): Promise<HTMLImageElement> {
    const cached = this.bgCache.get(src)
    if (cached) return Promise.resolve(cached)
    return new Promise((resolve, reject) => {
      const img = new Image()
      img.onload  = () => { this.bgCache.set(src, img); resolve(img) }
      img.onerror = reject
      img.src     = src
    })
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
}
