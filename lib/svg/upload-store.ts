'use client'

// ─── Module-level store ───────────────────────────────────────────────────────
// Persiste durante la sesión (misma pestaña, cualquier página Next.js).
// Se pierde al recargar — es el comportamiento esperado para este tipo de tool.

interface GroupEntry {
  blobUrl:    string  // URL.createObjectURL — válido mientras la pestaña esté abierta
  previewUrl: string  // canvas data URL 120px — para usar como thumbnail en el builder
}

const store = new Map<string, Map<string, GroupEntry>>()

// ─── Layer catalog ────────────────────────────────────────────────────────────

export const LAYER_CATALOG: Record<string, string> = {
  'hair-front': 'Cabello Frontal',
  'hair-back':  'Cabello Trasero',
  'head':       'Cara / Cabeza',
  'clothes':    'Ropa',
  'emotion':    'Expresión',
  'body':       'Cuerpo',
  'mask':       'Máscara',
}

/** Adivina la capa a partir del nombre del archivo */
export function guessLayerKey(filename: string): string {
  const f = filename.toLowerCase()
  if ((f.includes('hair') || f.includes('cabello')) && (f.includes('front') || f.includes('frente'))) return 'hair-front'
  if ((f.includes('hair') || f.includes('cabello')) && (f.includes('back')  || f.includes('detras') || f.includes('trasero'))) return 'hair-back'
  if (f.includes('head') || f.includes('cara') || f.includes('face') || f.includes('cabeza')) return 'head'
  if (f.includes('clothes') || f.includes('ropa') || f.includes('camiseta') || f.includes('jacket')) return 'clothes'
  if (f.includes('emotion') || f.includes('emocion') || f.includes('expresion') || f.includes('mood')) return 'emotion'
  if (f.includes('body') || f.includes('cuerpo')) return 'body'
  if (f.includes('mask') || f.includes('mascara')) return 'mask'
  return 'hair-front'
}

// ─── Write ────────────────────────────────────────────────────────────────────

export function storeLayer(
  layerKey: string,
  groups: Array<{ id: string; extractedSvg: string; previewUrl: string }>,
): void {
  // Revocar blob URLs anteriores de esta capa para no acumular memoria
  const prev = store.get(layerKey)
  if (prev) {
    for (const e of prev.values()) URL.revokeObjectURL(e.blobUrl)
  }

  const map = new Map<string, GroupEntry>()
  for (const g of groups) {
    const blob = new Blob([g.extractedSvg], { type: 'image/svg+xml' })
    map.set(g.id, {
      blobUrl:    URL.createObjectURL(blob),
      previewUrl: g.previewUrl,
    })
  }
  store.set(layerKey, map)
}

// ─── Read ─────────────────────────────────────────────────────────────────────

/** URL del SVG standalone para un grupo específico. null si no está cargado. */
export function getBlobUrl(layerKey: string, groupId: string): string | null {
  return store.get(layerKey)?.get(groupId)?.blobUrl ?? null
}

/** Mapa groupId → previewUrl para usar como thumbnails en el builder */
export function getPreviewUrls(layerKey: string): Record<string, string> {
  const map = store.get(layerKey)
  if (!map) return {}
  const out: Record<string, string> = {}
  for (const [id, e] of map) out[id] = e.previewUrl
  return out
}

/** ¿Tiene grupos cargados esta capa? */
export function isLayerLoaded(layerKey: string): boolean {
  return (store.get(layerKey)?.size ?? 0) > 0
}

/** Lista de claves de capas que tienen grupos cargados */
export function loadedLayerKeys(): string[] {
  return Array.from(store.entries())
    .filter(([, m]) => m.size > 0)
    .map(([k]) => k)
}
