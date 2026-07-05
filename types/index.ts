export interface Collection {
  id:        string
  slug:      string
  name:      string
  number:    number
  active:    boolean
}

export interface Layer {
  id:           string
  collectionId: string
  orderIndex:   number
  layerKey:     string
  labelEs:      string
  labelEn:      string
  type:         'svg' | 'image' | 'auto'
  blendMode:    string
  colorToken:       string | null
  optional:         boolean
  locked:           boolean
  pairedWith:       string | null
  visibleInBuilder: boolean
  opacity:          number   // 0.0 – 1.0, default 1
  // Regla de capa: default de edición para TODOS los assets de esta capa,
  // salvo que un asset puntual la anule (ver Asset.allowTransform / colorDisabled).
  positionEditable: boolean
  colorEditable:    boolean
  colorTargetRole:  string | null           // región del colorMap que se vuelve editable (ej. "skin")
  colorMode:        'swatches' | 'wheel' | 'both'
  colorSwatches:    string[] | null
}

export interface AssetTransform {
  scale:   number   // 0.5 – 2.0, default 1
  offsetX: number   // px en canvas de 2048, default 0
  offsetY: number   // px en canvas de 2048, default 0
}

export interface Asset {
  id:             string
  collectionId:   string
  layerKey:       string
  name:           string
  filename:       string
  storagePath:    string
  cdnUrl:         string
  thumbUrl:       string | null
  fileType:       'svg' | 'png' | 'jpg'
  originalSize:   number
  colorMap:       ColorEntry[]
  isDefault:      boolean
  locked:         boolean
  keywordId:      string | null
  svgEditable:    boolean
  transform:      AssetTransform
  suggestedColor: string | null   // color hex sugerido al activar (ej. color del cabello)
  maskAssetId:    string | null   // asset de máscara a auto-aplicar cuando este está activo
  // Tri-estado: null = heredar el default de la capa (layer.positionEditable),
  // true/false = anular explícitamente para este asset puntual.
  allowTransform: boolean | null
  // Anula el default de color de la capa (layer.colorEditable) para este
  // asset puntual, incluso si la capa permite editar color por defecto.
  colorDisabled:  boolean
}

export interface ColorEntry {
  original: string
  role:     string
  label:    string
  count:    number
}

export interface Variant {
  id:             string
  parentAssetId:  string
  name:           string
  colorOverrides: ColorOverride[]
  keywordId:      string | null
  active:         boolean
}

export interface ColorOverride {
  original:    string
  replacement: string
}

export interface LayerException {
  id:                  string
  collectionId:        string
  triggerLayer:        string
  triggerAssetPattern: string
  affectedLayer:       string
  action:              'hide' | 'show_only'
  condition:           string
  note:                string
}

export interface LayerDefault {
  id:           string
  collectionId: string
  layerKey:     string
  tokenId:      string
  defaultHex:   string
  defaultName:  string | null
}

export interface ColorSwatch {
  hex:     string
  fantasy: boolean   // borde punteado + insignia ✦ en la UI (tonos no "naturales")
}

export interface ColorPalette {
  id:            string
  collectionId:  string
  paletteKey:    'skin' | 'hair' | 'clothing' | 'accessories'
  labelEs:       string
  labelEn:       string
  swatches:      ColorSwatch[]
}

export interface Keyword {
  id:           string
  collectionId: string
  keyword:      string
  label:        string
  hint:         string | null
  active:       boolean
  isMaster:     boolean
}

export interface ColorUnlock {
  id:              string
  collectionId:    string
  keywordId:       string | null   // requiere esta keyword desbloqueada (o cualquier master)
  scopeAssetId:    string | null   // solo aplica si este asset está seleccionado en su capa
  targetLayerKey:  string          // capa cuyo color se vuelve editable
  targetAssetId:   string | null   // si se define, solo aplica cuando ESTE asset (no cualquiera de la capa) está seleccionado
  targetRole:      string          // región del colorMap (skin/primary/secondary…)
  mode:            'wheel' | 'swatches' | 'both'
  swatches:        string[] | null
}

export interface SiteSettings {
  welcomeMessageEs:   string | null
  welcomeMessageEn:   string | null
  welcomeMessageNl:   string | null
  welcomeMessageFr:   string | null
  creatorName:        string | null
  socialInstagram:    string | null
  socialTiktok:       string | null
  socialTwitter:      string | null
  socialWebsite:      string | null
  creatorAvatarState: AvatarState | null
  creatorCollectionId: string | null
}

export interface AvatarState {
  collectionId:     string
  tokens:           Record<string, string>   // skin-color, hair-color + extras desbloqueados
  selectedAssets:   Record<string, string | null>
  unlockedKeywords: string[]                 // keyword IDs desbloqueados
  extraColor:       boolean                  // true cuando keyword XTRA está activo
}
