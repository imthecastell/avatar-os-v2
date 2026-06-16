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
  colorToken:   string | null
  optional:     boolean
  locked:       boolean
  pairedWith:   string | null
}

export interface Asset {
  id:           string
  collectionId: string
  layerKey:     string
  name:         string
  filename:     string
  storagePath:  string
  cdnUrl:       string
  thumbUrl:     string | null
  fileType:     'svg' | 'png' | 'jpg'
  originalSize: number
  colorMap:     ColorEntry[]
  isDefault:    boolean
  locked:       boolean
  keywordId:    string | null
  svgEditable:  boolean
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

export interface Keyword {
  id:           string
  collectionId: string
  keyword:      string
  label:        string
  hint:         string | null
  active:       boolean
}

export interface AvatarState {
  collectionId:     string
  tokens:           Record<string, string>   // skin-color, hair-color + extras desbloqueados
  selectedAssets:   Record<string, string | null>
  unlockedKeywords: string[]                 // keyword IDs desbloqueados
  extraColor:       boolean                  // true cuando keyword XTRA está activo
}
