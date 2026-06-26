'use client'

export interface SvgGroupInfo {
  id:           string
  extractedSvg: string
  previewUrl:   string
  bbox:         { x: number; y: number; width: number; height: number }
}

// ── Group detection ───────────────────────────────────────────────────────────

/**
 * Busca el elemento con más hijos <g id="..."> directos.
 * Soporta estructura anidada de Affinity Designer (grupos dentro de grupos).
 */
export function detectGroups(svgText: string): string[] {
  const doc = new DOMParser().parseFromString(svgText, 'image/svg+xml')
  if (doc.querySelector('parsererror')) return []
  const svgEl = doc.querySelector('svg')
  if (!svgEl) return []

  const idChildrenOf = (el: Element) =>
    Array.from(el.children).filter(c => c.tagName === 'g' && Boolean(c.id))

  let best = svgEl as Element
  let bestCount = idChildrenOf(svgEl).length

  for (const g of Array.from(svgEl.querySelectorAll('g'))) {
    const n = idChildrenOf(g).length
    if (n > bestCount) { bestCount = n; best = g }
  }

  return idChildrenOf(best).map(c => c.id)
}

// ── Group extraction ──────────────────────────────────────────────────────────

/**
 * Extrae un grupo como SVG standalone con viewBox correcto.
 *
 * Estrategia:
 *  1. Renderiza el SVG con un viewBox MUY amplio (para ver contenido off-canvas).
 *  2. Usa getBoundingClientRect para obtener posición real en pantalla.
 *  3. Convierte a coordenadas SVG — esto da el viewBox correcto.
 *  4. Incluye los transforms de los ancestros en el SVG resultante para que
 *     el contenido se renderice exactamente donde debe.
 */
export function extractGroup(svgText: string, groupId: string): Promise<SvgGroupInfo | null> {
  return new Promise(resolve => {
    const CONTAINER_PX = 5000
    const VB_HALF      = 25000   // viewBox va de -25000 a 25000 en x e y

    const container = document.createElement('div')
    container.style.cssText =
      `position:fixed;left:-${CONTAINER_PX + 2000}px;top:0;` +
      `width:${CONTAINER_PX}px;height:${CONTAINER_PX}px;` +
      `overflow:visible;visibility:hidden;pointer-events:none`

    const parser = new DOMParser()
    const doc    = parser.parseFromString(svgText, 'image/svg+xml')
    if (doc.querySelector('parsererror')) { resolve(null); return }

    const svgEl = document.importNode(doc.documentElement, true)
    svgEl.setAttribute('width',   `${CONTAINER_PX}`)
    svgEl.setAttribute('height',  `${CONTAINER_PX}`)
    svgEl.setAttribute('viewBox', `${-VB_HALF} ${-VB_HALF} ${VB_HALF * 2} ${VB_HALF * 2}`)
    svgEl.style.overflow = 'visible'

    container.appendChild(svgEl)
    document.body.appendChild(container)

    requestAnimationFrame(() => requestAnimationFrame(async () => {
      const cleanup = () => {
        if (document.body.contains(container)) document.body.removeChild(container)
      }

      try {
        const liveSvg = container.querySelector('svg')!
        const group   = liveSvg.querySelector(
          `[id="${CSS.escape(groupId)}"]`
        ) as SVGGraphicsElement | null

        if (!group) { cleanup(); resolve(null); return }

        const svgRect = liveSvg.getBoundingClientRect()
        const gRect   = group.getBoundingClientRect()

        if (gRect.width < 2 || gRect.height < 2) { cleanup(); resolve(null); return }

        // Convertir de píxeles de pantalla a coordenadas del espacio SVG viewport
        const VB_TOTAL = VB_HALF * 2
        const sx = VB_TOTAL / svgRect.width
        const sy = VB_TOTAL / svgRect.height

        const x = (gRect.left - svgRect.left) * sx - VB_HALF
        const y = (gRect.top  - svgRect.top)  * sy - VB_HALF
        const w = gRect.width  * sx
        const h = gRect.height * sy

        // Capturar la cadena de transforms de los ancestros para que el contenido
        // se renderice en las mismas coordenadas en el SVG standalone.
        const ancestorTransforms: string[] = []
        let el: Element | null = group.parentElement
        while (el && el.tagName.toLowerCase() !== 'svg') {
          const t = el.getAttribute('transform')
          if (t) ancestorTransforms.unshift(t)
          el = el.parentElement
        }

        cleanup()

        // Re-parsear el SVG original para serialización limpia
        const origDoc   = new DOMParser().parseFromString(svgText, 'image/svg+xml')
        const origSvg   = origDoc.querySelector('svg')!
        const origGroup = origSvg.querySelector(`[id="${CSS.escape(groupId)}"]`)!
        const defs      = origSvg.querySelector('defs')
        const ns        = origSvg.getAttribute('xmlns') || 'http://www.w3.org/2000/svg'
        const ser       = new XMLSerializer()

        const defsStr  = defs
          ? ser.serializeToString(defs).replace(/ xmlns="[^"]*"/g, '')
          : ''
        const groupStr = ser.serializeToString(origGroup).replace(/ xmlns="[^"]*"/g, '')

        // Envolver en los transforms de los ancestros
        const wrapOpen  = ancestorTransforms.map(t => `<g transform="${t}">`).join('')
        const wrapClose = ancestorTransforms.map(() => '</g>').join('')

        const pad = Math.max(w, h) * 0.05
        const vb  = `${x - pad} ${y - pad} ${w + pad * 2} ${h + pad * 2}`

        const extractedSvg =
          `<svg xmlns="${ns}" viewBox="${vb}">${defsStr}${wrapOpen}${groupStr}${wrapClose}</svg>`

        const previewUrl = await renderSvgToDataUrl(extractedSvg, 120)

        resolve({ id: groupId, extractedSvg, previewUrl, bbox: { x, y, width: w, height: h } })

      } catch {
        cleanup()
        resolve(null)
      }
    }))
  })
}

// ── Preview render ────────────────────────────────────────────────────────────

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
    } catch { /* usuario canceló */ }
  }
  for (const g of infos) {
    downloadOne(g)
    await new Promise(r => setTimeout(r, 350))
  }
}
