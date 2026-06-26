'use client'

// Persiste durante la sesión (misma pestaña). Se pierde al recargar.

interface GroupEntry {
  blobUrl:    string   // URL.createObjectURL
  previewUrl: string   // data URL 120px thumbnail
}

interface LayerEntry {
  name:   string                     // nombre libre: "Cabeza", "Cabello Frontal", etc.
  order:  number                     // z-order: menor = más atrás
  groups: Map<string, GroupEntry>    // variantId → entry
}

const store = new Map<string, LayerEntry>()   // layerKey → LayerEntry

// ─── Write ────────────────────────────────────────────────────────────────────

export function storeLayer(
  layerKey: string,
  name:     string,
  order:    number,
  groups:   Array<{ id: string; extractedSvg: string; previewUrl: string }>,
): void {
  const prev = store.get(layerKey)
  if (prev) {
    for (const e of prev.groups.values()) URL.revokeObjectURL(e.blobUrl)
  }

  const map = new Map<string, GroupEntry>()
  for (const g of groups) {
    const blob = new Blob([g.extractedSvg], { type: 'image/svg+xml' })
    map.set(g.id, { blobUrl: URL.createObjectURL(blob), previewUrl: g.previewUrl })
  }
  store.set(layerKey, { name, order, groups: map })
}

// ─── Read ─────────────────────────────────────────────────────────────────────

export function getBlobUrl(layerKey: string, variantId: string): string | null {
  return store.get(layerKey)?.groups.get(variantId)?.blobUrl ?? null
}

export function getPreviewUrls(layerKey: string): Record<string, string> {
  const entry = store.get(layerKey)
  if (!entry) return {}
  const out: Record<string, string> = {}
  for (const [id, e] of entry.groups) out[id] = e.previewUrl
  return out
}

/** Devuelve todas las capas cargadas, ordenadas por order */
export function getAllLayers(): Array<{
  key:       string
  name:      string
  order:     number
  variantIds: string[]
}> {
  return Array.from(store.entries())
    .filter(([, e]) => e.groups.size > 0)
    .map(([key, e]) => ({
      key,
      name:       e.name,
      order:      e.order,
      variantIds: Array.from(e.groups.keys()),
    }))
    .sort((a, b) => a.order - b.order)
}

export function isLayerLoaded(layerKey: string): boolean {
  return (store.get(layerKey)?.groups.size ?? 0) > 0
}

export function loadedLayerKeys(): string[] {
  return Array.from(store.entries())
    .filter(([, e]) => e.groups.size > 0)
    .map(([k]) => k)
}

/** Adivina el nombre de capa a partir del nombre del archivo */
export function guessLayerName(filename: string): string {
  const f = filename.toLowerCase().replace(/\.[^.]+$/, '')
  if (f.includes('hair') && f.includes('front')) return 'Cabello Frontal'
  if (f.includes('hair') && f.includes('back'))  return 'Cabello Trasero'
  if (f.includes('hair'))                         return 'Cabello'
  if (f.includes('head') || f.includes('face') || f.includes('cara')) return 'Cabeza'
  if (f.includes('body') || f.includes('cuerpo')) return 'Cuerpo'
  if (f.includes('clothes') || f.includes('ropa')) return 'Ropa'
  if (f.includes('emotion') || f.includes('expresion')) return 'Expresión'
  if (f.includes('mask') || f.includes('mascara')) return 'Máscara'
  return filename.replace(/\.[^.]+$/, '')
}

/** Adivina el z-order a partir del nombre del archivo */
export function guessLayerOrder(filename: string): number {
  const f = filename.toLowerCase()
  if (f.includes('hair') && f.includes('back'))  return 1
  if (f.includes('body') || f.includes('cuerpo')) return 2
  if (f.includes('clothes') || f.includes('ropa')) return 3
  if (f.includes('head') || f.includes('face') || f.includes('cara')) return 4
  if (f.includes('emotion') || f.includes('expresion')) return 5
  if (f.includes('hair') && f.includes('front')) return 6
  if (f.includes('mask') || f.includes('mascara')) return 7
  return 5
}

/** Clave única para el store a partir del nombre de archivo */
export function fileToKey(filename: string): string {
  return filename.toLowerCase().replace(/\.[^.]+$/, '').replace(/[^a-z0-9]+/g, '-')
}
