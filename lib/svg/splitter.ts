'use client'

export interface SvgGroupInfo {
  id:           string
  extractedSvg: string   // standalone SVG con viewBox corregido
  previewUrl:   string   // data URL para mostrar en la UI
  bbox:         { x: number; y: number; width: number; height: number }
}

// ── Group detection ───────────────────────────────────────────────────────────

/** Encuentra todos los <g id="..."> de primer nivel dentro del SVG */
export function detectGroups(svgText: string): string[] {
  const parser = new DOMParser()
  const doc    = parser.parseFromString(svgText, 'image/svg+xml')
  if (doc.querySelector('parsererror')) return []
  const svgEl  = doc.querySelector('svg')
  if (!svgEl) return []
  return Array.from(svgEl.children)
    .filter((el): el is Element => el.tagName === 'g' && Boolean(el.id))
    .map(el => el.id)
}

// ── Group extraction ──────────────────────────────────────────────────────────

/**
 * Extrae un grupo como SVG standalone con:
 *  - viewBox calculado via getBBox() (corrige la posición fuera de frame de Affinity)
 *  - <defs> del SVG original incluidos (preserva gradients / clip-paths)
 *  - preview data URL de 120px
 */
export function extractGroup(svgText: string, groupId: string): Promise<SvgGroupInfo | null> {
  return new Promise(resolve => {
    // Contenedor oculto fuera de pantalla
    const container = document.createElement('div')
    container.style.cssText =
      'position:fixed;left:-9999px;top:-9999px;' +
      'width:3000px;height:3000px;visibility:hidden;pointer-events:none'

    // Parsear el SVG como XML (preserva namespaces)
    const parser = new DOMParser()
    const doc    = parser.parseFromString(svgText, 'image/svg+xml')
    if (doc.querySelector('parsererror')) { resolve(null); return }

    const importedSvg = document.importNode(doc.documentElement, true)
    container.appendChild(importedSvg)
    document.body.appendChild(container)

    // Dos frames para que el browser haga layout completo
    requestAnimationFrame(() => requestAnimationFrame(async () => {
      try {
        const liveSvg = container.querySelector('svg')!
        // CSS.escape maneja IDs con caracteres especiales (guiones, etc.)
        const group = liveSvg.querySelector(`[id="${CSS.escape(groupId)}"]`) as SVGGraphicsElement | null

        if (!group) { cleanup(); resolve(null); return }

        const b = group.getBBox()
        if (b.width === 0 || b.height === 0) { cleanup(); resolve(null); return }

        // Padding proporcional al tamaño del grupo
        const pad = Math.max(b.width, b.height) * 0.05
        const vb  = `${b.x - pad} ${b.y - pad} ${b.width + pad * 2} ${b.height + pad * 2}`

        const ns   = liveSvg.getAttribute('xmlns') || 'http://www.w3.org/2000/svg'
        const defs = liveSvg.querySelector('defs')

        const ser = new XMLSerializer()
        // XMLSerializer añade xmlns a cada nodo — lo limpiamos en hijos
        const defsStr  = defs  ? ser.serializeToString(defs).replace(/ xmlns="[^"]*"/g, '') : ''
        const groupStr = ser.serializeToString(group).replace(/ xmlns="[^"]*"/g, '')

        const extractedSvg = `<svg xmlns="${ns}" viewBox="${vb}">${defsStr}${groupStr}</svg>`

        cleanup()

        const previewUrl = await renderSvgToDataUrl(extractedSvg, 120)

        resolve({
          id:           groupId,
          extractedSvg,
          previewUrl,
          bbox: { x: b.x, y: b.y, width: b.width, height: b.height },
        })
      } catch {
        cleanup()
        resolve(null)
      }

      function cleanup() {
        if (document.body.contains(container)) document.body.removeChild(container)
      }
    }))
  })
}

// ── Render preview ────────────────────────────────────────────────────────────

async function renderSvgToDataUrl(svgText: string, size: number): Promise<string> {
  const blob = new Blob([svgText], { type: 'image/svg+xml' })
  const burl = URL.createObjectURL(blob)
  try {
    const img = new Image()
    await new Promise<void>((ok, err) => {
      img.onload  = () => ok()
      img.onerror = () => err(new Error('SVG render failed'))
      img.src = burl
    })
    const canvas = document.createElement('canvas')
    canvas.width = canvas.height = size
    const ctx = canvas.getContext('2d')!
    ctx.clearRect(0, 0, size, size)
    ctx.drawImage(img, 0, 0, size, size)
    return canvas.toDataURL('image/png')
  } finally {
    URL.revokeObjectURL(burl)
  }
}

// ── Download helpers ──────────────────────────────────────────────────────────

export function downloadOne(info: SvgGroupInfo): void {
  const blob = new Blob([info.extractedSvg], { type: 'image/svg+xml' })
  const url  = URL.createObjectURL(blob)
  const a    = document.createElement('a')
  a.href = url; a.download = `${info.id}.svg`; a.click()
  URL.revokeObjectURL(url)
}

export async function downloadAll(infos: SvgGroupInfo[]): Promise<void> {
  // Chrome / Edge: File System Access API → guardar en carpeta elegida por el usuario
  if ('showDirectoryPicker' in window) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const dir = await (window as any).showDirectoryPicker()
      for (const g of infos) {
        const handle   = await dir.getFileHandle(`${g.id}.svg`, { create: true })
        const writable = await handle.createWritable()
        await writable.write(g.extractedSvg)
        await writable.close()
      }
      return
    } catch {
      // usuario canceló el picker → fallback
    }
  }

  // Fallback: descargas individuales secuenciales (300ms entre cada una)
  for (const g of infos) {
    downloadOne(g)
    await new Promise(r => setTimeout(r, 350))
  }
}
