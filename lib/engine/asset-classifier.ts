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

const HEX_OR_RGB = '#[0-9a-fA-F]{3,8}|rgb\\([^)]+\\)'

function collectColors(svgText: string): Record<string, number> {
  const counts: Record<string, number> = {}

  function add(color: string) {
    const c = color.trim()
    if (!IGNORED_COLORS.has(c.toLowerCase())) counts[c] = (counts[c] || 0) + 1
  }

  let m: RegExpExecArray | null

  // 1. Inline attributes: fill="#hex" stroke="rgb(...)"
  const attrRe = new RegExp(`(?:fill|stroke|stop-color)="(${HEX_OR_RGB})"`, 'g')
  while ((m = attrRe.exec(svgText)) !== null) add(m[1])

  // 2. style="…fill:#hex…" or style="…fill: rgb(…)…"
  const styleAttrRe = /style="([^"]*)"/g
  while ((m = styleAttrRe.exec(svgText)) !== null) {
    const inner = m[1]
    const propRe = new RegExp(`(?:fill|stroke|stop-color):\\s*(${HEX_OR_RGB})`, 'g')
    let pm: RegExpExecArray | null
    while ((pm = propRe.exec(inner)) !== null) add(pm[1])
  }

  // 3. <style> blocks
  const blockRe = /<style[^>]*>([\s\S]*?)<\/style>/gi
  while ((m = blockRe.exec(svgText)) !== null) {
    const css = m[1]
    const propRe = new RegExp(`(?:fill|stroke|stop-color):\\s*(${HEX_OR_RGB})`, 'g')
    let pm: RegExpExecArray | null
    while ((pm = propRe.exec(css)) !== null) add(pm[1])
  }

  return counts
}

export function isSVGEditable(svgText: string): boolean {
  return Object.keys(collectColors(svgText)).length > 0
}

export function detectEditableColors(svgText: string): Array<{
  original: string
  role:     string
  label:    string
  count:    number
}> {
  const counts = collectColors(svgText)

  return Object.entries(counts)
    .sort(([, a], [, b]) => b - a)
    .map(([original, count], i) => ({
      original,
      role:  i === 0 ? 'skin' : i === 1 ? 'primary' : 'secondary',
      label: i === 0 ? 'Principal' : i === 1 ? 'Secundario' : 'Detalle',
      count,
    }))
}
