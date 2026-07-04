// Compone el avatar exportado dentro de un marco dorado sobre una pared
// oscura, con una placa de museo debajo (título + subtítulo) — para que
// la imagen compartida no sea solo el PNG plano sino que luzca como una
// pieza de galería.

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload  = () => resolve(img)
    img.onerror = reject
    img.src = src
  })
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + w, y,     x + w, y + h, r)
  ctx.arcTo(x + w, y + h, x,     y + h, r)
  ctx.arcTo(x,     y + h, x,     y,     r)
  ctx.arcTo(x,     y,     x + w, y,     r)
  ctx.closePath()
}

// Espaciado manual entre letras (canvas no soporta letter-spacing nativo
// de forma consistente entre navegadores).
function tracked(text: string, gap = ' '): string {
  return text.split('').join(gap)
}

export async function renderFramedShare(avatarDataUrl: string, opts: { title: string; subtitle: string }): Promise<string> {
  const W = 1080, H = 1920
  const canvas = document.createElement('canvas')
  canvas.width = W
  canvas.height = H
  const ctx = canvas.getContext('2d')!

  // Pared
  const bg = ctx.createLinearGradient(0, 0, 0, H)
  bg.addColorStop(0, '#1c2a4d')
  bg.addColorStop(1, '#080d1a')
  ctx.fillStyle = bg
  ctx.fillRect(0, 0, W, H)

  const vignette = ctx.createRadialGradient(W / 2, H * 0.38, W * 0.15, W / 2, H * 0.38, W * 0.8)
  vignette.addColorStop(0, 'rgba(0,0,0,0)')
  vignette.addColorStop(1, 'rgba(0,0,0,0.4)')
  ctx.fillStyle = vignette
  ctx.fillRect(0, 0, W, H)

  const img = await loadImage(avatarDataUrl)

  const frameSize = 820
  const frameX = (W - frameSize) / 2
  const frameY = 190

  // Sombra proyectada del marco sobre la pared
  ctx.save()
  ctx.shadowColor = 'rgba(0,0,0,0.55)'
  ctx.shadowBlur = 70
  ctx.shadowOffsetY = 35
  ctx.fillStyle = '#000'
  ctx.fillRect(frameX, frameY, frameSize, frameSize)
  ctx.restore()

  // Marco dorado — capas concéntricas para dar efecto de bisel
  const borders = [
    { w: 30, c1: '#7a5a1f', c2: '#e9cc82' },
    { w: 24, c1: '#f6e4ab', c2: '#a8752f' },
    { w: 5,  c1: '#2c1f0a', c2: '#2c1f0a' },
  ]
  let bx = frameX, by = frameY, bs = frameSize
  for (const b of borders) {
    const grad = ctx.createLinearGradient(bx, by, bx + bs, by + bs)
    grad.addColorStop(0,   b.c1)
    grad.addColorStop(0.5, b.c2)
    grad.addColorStop(1,   b.c1)
    ctx.fillStyle = grad
    ctx.fillRect(bx, by, bs, bs)
    bx += b.w; by += b.w; bs -= b.w * 2
  }

  // Avatar dentro del marco
  ctx.fillStyle = '#f4f1ea'
  ctx.fillRect(bx, by, bs, bs)
  ctx.drawImage(img, bx, by, bs, bs)

  // Placa de museo
  const plaqueW = 460, plaqueH = 116
  const plaqueX = (W - plaqueW) / 2
  const plaqueY = frameY + frameSize + 80

  ctx.save()
  ctx.shadowColor = 'rgba(0,0,0,0.5)'
  ctx.shadowBlur = 24
  ctx.shadowOffsetY = 10
  const plaqueGrad = ctx.createLinearGradient(plaqueX, plaqueY, plaqueX, plaqueY + plaqueH)
  plaqueGrad.addColorStop(0,   '#f0d99a')
  plaqueGrad.addColorStop(0.5, '#c79a4c')
  plaqueGrad.addColorStop(1,   '#8a6423')
  ctx.fillStyle = plaqueGrad
  roundRect(ctx, plaqueX, plaqueY, plaqueW, plaqueH, 10)
  ctx.fill()
  ctx.restore()

  ctx.strokeStyle = 'rgba(0,0,0,0.35)'
  ctx.lineWidth = 2
  roundRect(ctx, plaqueX, plaqueY, plaqueW, plaqueH, 10)
  ctx.stroke()

  ctx.textAlign = 'center'
  ctx.fillStyle = '#2a1d08'
  ctx.font = '600 36px Georgia, "Times New Roman", serif'
  ctx.fillText(tracked(opts.title.toUpperCase()), W / 2, plaqueY + 52)

  ctx.font = '400 21px Georgia, "Times New Roman", serif'
  ctx.fillStyle = '#54390f'
  ctx.fillText(tracked(opts.subtitle.toUpperCase()), W / 2, plaqueY + 88)

  return canvas.toDataURL('image/png')
}
