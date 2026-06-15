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

export function detectLayerFromFilename(filename: string): string | null {
  const lower = filename.toLowerCase().replace(/\s+/g, '-')

  for (const [prefix, layer] of Object.entries(LAYER_PREFIXES)) {
    if (lower.startsWith(prefix)) return layer
  }

  return null
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
