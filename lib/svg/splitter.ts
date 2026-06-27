'use client'

export interface SvgGroupInfo {
  id:           string
  extractedSvg: string   // SVG con viewBox ORIGINAL — para CSS stacking correcto
  previewUrl:   string   // data URL 120px con recorte ajustado — para thumbnails
  bbox:         { x: number; y: number; width: number; height: number }
}

// ── Group detection ───────────────────────────────────────────────────────────

/**
 * Busca el elemento con más hijos <g id="..."> directos.
 * Soporta estructura anidada de Affinity Designer.
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
 * Extrae un grupo con dos resultados:
 *
 * • extractedSvg — conserva el viewBox ORIGINAL del SVG con todos los grupos
 *   hermanos ocultados. Cuando varias capas usan el mismo tamaño de artboard
 *   (ej. 2001×2000) se alinean perfectamente al stackear con CSS.
 *
 * • previewUrl — recorte ajustado al bounding box real del grupo usando
 *   getBoundingClientRect con un viewBox enorme. Sirve para los thumbnails
 *   del sidebar donde necesitamos ver el contenido sin espacio en blanco.
 */
export function extractGroup(svgText: string, groupId: string): Promise<SvgGroupInfo | null> {
  return new Promise(resolve => {
    // ── 1. SVG de compositing: viewBox original, hermanos ocultos ─────────
    const compositeSvg = makeSiblingHidden(svgText, groupId)
    if (!compositeSvg) { resolve(null); return }

    // ── 2. Thumbnail: recorte ajustado via getBoundingClientRect ──────────
    const CONTAINER_PX = 5000
    const VB_HALF      = 25000

    const container = document.createElement('div')
    container.style.cssText =
      `position:fixed;left:-${CONTAINER_PX + 2000}px;top:0;` +
      `width:${CONTAINER_PX}px;height:${CONTAINER_PX}px;` +
      `overflow:visible;visibility:hidden;pointer-events:none`

    const doc = new DOMParser().parseFromString(svgText, 'image/svg+xml')
    // Don't check parsererror here — already checked in makeSiblingHidden

    const liveSvgEl = document.importNode(doc.documentElement, true)
    liveSvgEl.setAttribute('width',   `${CONTAINER_PX}`)
    liveSvgEl.setAttribute('height',  `${CONTAINER_PX}`)
    liveSvgEl.setAttribute('viewBox', `${-VB_HALF} ${-VB_HALF} ${VB_HALF * 2} ${VB_HALF * 2}`)
    liveSvgEl.style.overflow = 'visible'

    container.appendChild(liveSvgEl)
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

        cleanup()

        let previewUrl: string

        if (gRect.width < 2 || gRect.height < 2) {
          // Grupo no visible: usar el composite SVG como preview
          previewUrl = await renderSvgToDataUrl(compositeSvg, 120)
          resolve({ id: groupId, extractedSvg: compositeSvg, previewUrl, bbox: { x: 0, y: 0, width: 0, height: 0 } })
          return
        }

        // Convertir píxeles de pantalla a coordenadas SVG viewport
        const VB_TOTAL = VB_HALF * 2
        const sx = VB_TOTAL / svgRect.width
        const sy = VB_TOTAL / svgRect.height

        const x = (gRect.left - svgRect.left) * sx - VB_HALF
        const y = (gRect.top  - svgRect.top)  * sy - VB_HALF
        const w = gRect.width  * sx
        const h = gRect.height * sy
        const pad = Math.max(w, h) * 0.05
        const tightVb = `${x - pad} ${y - pad} ${w + pad * 2} ${h + pad * 2}`

        // Para el thumbnail usamos el SVG con la cadena de transforms de los ancestros
        // para que el recorte se vea correctamente
        const origDoc   = new DOMParser().parseFromString(svgText, 'image/svg+xml')
        const origSvg   = origDoc.querySelector('svg')!
        const origGroup = origSvg.querySelector(`[id="${CSS.escape(groupId)}"]`)!
        const defs      = origSvg.querySelector('defs')
        const ns        = origSvg.getAttribute('xmlns') || 'http://www.w3.org/2000/svg'
        const ser       = new XMLSerializer()

        const defsStr  = defs ? ser.serializeToString(defs).replace(/ xmlns="[^"]*"/g, '') : ''
        const groupStr = ser.serializeToString(origGroup).replace(/ xmlns="[^"]*"/g, '')

        const transforms: string[] = []
        let el: Element | null = origGroup.parentElement
        while (el && el.tagName.toLowerCase() !== 'svg') {
          const t = el.getAttribute('transform')
          if (t) transforms.unshift(t)
          el = el.parentElement
        }
        const wrapOpen  = transforms.map(t => `<g transform="${t}">`).join('')
        const wrapClose = transforms.map(() => '</g>').join('')

        const tightSvg = `<svg xmlns="${ns}" viewBox="${tightVb}">${defsStr}${wrapOpen}${groupStr}${wrapClose}</svg>`

        previewUrl = await renderSvgToDataUrl(tightSvg, 120)

        resolve({
          id: groupId,
          extractedSvg: compositeSvg,
          previewUrl,
          bbox: { x, y, width: w, height: h },
        })

      } catch {
        cleanup()
        // Fallback: usar composite como preview
        renderSvgToDataUrl(compositeSvg, 120)
          .then(previewUrl => resolve({ id: groupId, extractedSvg: compositeSvg, previewUrl, bbox: { x: 0, y: 0, width: 0, height: 0 } }))
          .catch(() => resolve(null))
      }
    }))
  })
}

/**
 * Oculta todos los grupos hermanos del grupo indicado.
 * Conserva el viewBox original para que el CSS stacking sea correcto.
 */
function makeSiblingHidden(svgText: string, groupId: string): string | null {
  const doc = new DOMParser().parseFromString(svgText, 'image/svg+xml')
  if (doc.querySelector('parsererror')) return null

  const svgEl = doc.querySelector('svg')
  if (!svgEl) return null

  const target = svgEl.querySelector(`[id="${CSS.escape(groupId)}"]`)
  if (!target) return null

  // Ocultar todos los hermanos con id en el mismo nivel
  const parent = target.parentElement!
  for (const child of Array.from(parent.children)) {
    const c = child as Element
    if (c.id && c.id !== groupId) {
      c.setAttribute('style', (c.getAttribute('style') ?? '') + ';display:none')
    }
  }

  return new XMLSerializer().serializeToString(svgEl)
}

// ── Preview render ────────────────────────────────────────────────────────────

async function renderSvgToDataUrl(svgText: string, size: number): Promise<string> {
  const blob = new Blob([svgText], { type: 'image/svg+xml' })
  const burl = URL.createObjectURL(blob)
  try {
    const img = new Image()
    await new Promise<void>((ok, err) => {
      img.onload  = () => ok()
      img.onerror = () => err(new Error('render failed'))
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
