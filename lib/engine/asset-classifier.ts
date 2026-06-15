const LAYER_PREFIXES: Record<string, string> = {
  'bg-':       'background',
  'back-':     'background',
  'fondo-':    'background',
  'em-':       'emotion',
  'emo-':      'emotion',
  'head-':     'head',
  'cara-':     'head',
  'rostro-':   'head',
  'b-hair-':   'hair-back',
  'hair-b-':   'hair-back',
  'f-hair-':   'hair-front',
  'hair-f-':   'hair-front',
  'shirt-':    'shirt',
  'playera-':  'shirt',
  'camisa-':   'shirt',
  'acc-':      'acc-front',
  'acces-':    'acc-front',
  'gorra-':    'acc-front',
  'masc-':     'mask',
  'mask-':     'mask',
  'mascara-':  'mask',
  'fx-':       'effect-final',
  'efecto-':   'effect-final',
  'frame-':    'frame',
  'marco-':    'frame',
  'kw-':       'keyword',
}

// Handles "Category - Style" naming convention (e.g. "Hair - afro", "Head - rounded")
const CATEGORY_WORDS: Record<string, string> = {
  'background': 'background',
  'bg':         'background',
  'fondo':      'background',
  'emotion':    'emotion',
  'emocion':    'emotion',
  'head':       'head',
  'cabeza':     'head',
  'hair':       'hair-back',
  'cabello':    'hair-back',
  'pelo':       'hair-back',
  'f hair':     'hair-front',
  'b hair':     'hair-back',
  'hair front': 'hair-front',
  'hair back':  'hair-back',
  'shirt':      'shirt',
  'camiseta':   'shirt',
  'playera':    'shirt',
  'acc':        'acc-front',
  'accessory':  'acc-front',
  'accesorio':  'acc-front',
  'mask':       'mask',
  'mascara':    'mask',
  'effect':     'effect-final',
  'efecto':     'effect-final',
  'frame':      'frame',
  'marco':      'frame',
}

export function detectLayerFromFilename(filename: string): string | null {
  const noExt  = filename.replace(/\.[^.]+$/, '')
  const lower  = noExt.toLowerCase().replace(/\s+/g, '-')

  // Try prefix convention first (bg-, head-, f-hair-, etc.)
  for (const [prefix, layer] of Object.entries(LAYER_PREFIXES)) {
    if (lower.startsWith(prefix)) return layer
  }

  // Try "Category - Style" convention
  const lowerRaw = noExt.toLowerCase()
  const dashIdx  = lowerRaw.indexOf(' - ')
  if (dashIdx !== -1) {
    const category = lowerRaw.slice(0, dashIdx).trim()
    if (CATEGORY_WORDS[category]) return CATEGORY_WORDS[category]
  }

  return null
}

// Colors considered "non-editable" (structural, not skin/hair/cloth)
const IGNORED_COLORS = new Set([
  '#ffffff', '#fff', 'white',
  '#000000', '#000', 'black',
  'none', 'transparent',
])

export function isSVGEditable(svgText: string): boolean {
  const colorRegex = /(?:fill|stroke|stop-color)="([^"]+)"/g
  let match
  while ((match = colorRegex.exec(svgText)) !== null) {
    const c = match[1].toLowerCase().trim()
    if (!IGNORED_COLORS.has(c) && c !== 'none' && !c.startsWith('url(')) {
      return true
    }
  }
  return false
}

export function detectEditableColors(svgText: string): Array<{
  original: string
  role: string
  label: string
  count: number
}> {
  const colorRegex = /(?:fill|stroke|stop-color)="(#[0-9a-fA-F]{3,8}|rgb\([^)]+\))"/g
  const counts: Record<string, number> = {}
  let match

  while ((match = colorRegex.exec(svgText)) !== null) {
    const color = match[1]
    counts[color] = (counts[color] || 0) + 1
  }

  return Object.entries(counts)
    .sort(([, a], [, b]) => b - a)
    .map(([original, count], i) => ({
      original,
      role: i === 0 ? 'skin' : i === 1 ? 'primary' : 'secondary',
      label: i === 0 ? 'Principal' : i === 1 ? 'Secundario' : 'Detalle',
      count,
    }))
}
