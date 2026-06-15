'use client'

import { useState, useCallback, useRef, useEffect } from 'react'
import dynamic from 'next/dynamic'
import SkinSelector, { SKIN_TONES } from '@/components/builder/SkinSelector'
import HairColorPicker, { HAIR_PRESETS } from '@/components/builder/HairColorPicker'
import AssetGrid from '@/components/builder/AssetGrid'
import KeywordInput from '@/components/builder/KeywordInput'
import ExportModal from '@/components/builder/ExportModal'
import type { AvatarState, Layer, Asset, LayerException, LayerDefault, Collection } from '@/types'
import type { AvatarCompositor } from '@/lib/engine/compositor'
import Link from 'next/link'

// Load canvas only client-side
const AvatarCanvas = dynamic(() => import('@/components/builder/AvatarCanvas'), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full flex items-center justify-center text-gray-600 text-sm">
      Cargando...
    </div>
  ),
})

interface Props {
  locale: string
  collection: Collection | null
  layers: Layer[]
  assets: Asset[]
  exceptions: LayerException[]
  defaults: LayerDefault[]
}

function buildInitialState(
  collection: Collection | null,
  layers: Layer[],
  assets: Asset[],
  defaults: LayerDefault[]
): AvatarState {
  const skinDefault = defaults.find(d => d.tokenId === 'skin-color')?.defaultHex || SKIN_TONES[1].hex
  const hairDefault = defaults.find(d => d.tokenId === 'hair-color')?.defaultHex || HAIR_PRESETS[0].hex

  const selectedAssets: Record<string, string | null> = {}
  for (const layer of layers) {
    const defaultAsset = assets.find(a => a.layerKey === layer.layerKey && a.isDefault)
    const firstAsset = assets.find(a => a.layerKey === layer.layerKey)
    selectedAssets[layer.layerKey] = layer.optional
      ? null
      : (defaultAsset?.id || firstAsset?.id || null)
  }

  return {
    collectionId: collection?.id || '',
    tokens: { 'skin-color': skinDefault, 'hair-color': hairDefault },
    selectedAssets,
    unlockedKeywords: [],
  }
}

function getVisibleLayers(
  state: AvatarState,
  exceptions: LayerException[]
): Set<string> {
  const hidden = new Set<string>()

  for (const ex of exceptions) {
    const triggerAssetId = state.selectedAssets[ex.triggerLayer]
    if (!triggerAssetId) continue

    const pattern = ex.triggerAssetPattern
    const matches = pattern.endsWith('*')
      ? triggerAssetId.startsWith(pattern.slice(0, -1))
      : triggerAssetId === pattern

    if (matches && ex.action === 'hide') {
      hidden.add(ex.affectedLayer)
    }
  }

  return hidden
}

// Group layers into builder sections
function groupLayers(layers: Layer[]) {
  const scene: Layer[] = []
  const avatar: Layer[] = []
  const extras: Layer[] = []

  for (const layer of layers) {
    if (['background', 'emotion'].includes(layer.layerKey)) {
      scene.push(layer)
    } else if (['head', 'hair-back', 'hair-front', 'shirt'].includes(layer.layerKey)) {
      avatar.push(layer)
    } else {
      extras.push(layer)
    }
  }

  return { scene, avatar, extras }
}

const LAYER_LABELS: Record<string, { es: string; en: string }> = {
  'background': { es: 'Fondo', en: 'Background' },
  'emotion':    { es: 'Emoción', en: 'Emotion' },
  'head':       { es: 'Cabeza', en: 'Head' },
  'hair-back':  { es: 'Cabello', en: 'Hair' },
  'hair-front': { es: 'Cabello frente', en: 'Front hair' },
  'shirt':      { es: 'Camiseta', en: 'Shirt' },
  'acc-front':  { es: 'Accesorio', en: 'Accessory' },
  'mask':       { es: 'Máscara', en: 'Mask' },
  'effect-final': { es: 'Efecto', en: 'Effect' },
  'frame':      { es: 'Marco', en: 'Frame' },
}

export default function BuilderClient({ locale, collection, layers, assets, exceptions, defaults }: Props) {
  const [state, setState] = useState<AvatarState>(() =>
    buildInitialState(collection, layers, assets, defaults)
  )
  const [exportUrl, setExportUrl] = useState<string | null>(null)
  const compositorRef = useRef<AvatarCompositor | null>(null)
  const [localeState, setLocaleState] = useState(locale)

  const hiddenLayers = getVisibleLayers(state, exceptions)
  const { scene, avatar, extras } = groupLayers(layers)

  function setToken(key: 'skin-color' | 'hair-color', value: string) {
    setState(s => ({ ...s, tokens: { ...s.tokens, [key]: value } }))
  }

  function selectAsset(layerKey: string, assetId: string | null) {
    setState(s => ({ ...s, selectedAssets: { ...s.selectedAssets, [layerKey]: assetId } }))
  }

  function handleRandomize() {
    const selectedAssets = { ...state.selectedAssets }
    for (const layer of layers) {
      if (layer.locked) continue
      const layerAssets = assets.filter(a => a.layerKey === layer.layerKey)
      if (layerAssets.length === 0) continue
      if (layer.optional && Math.random() < 0.5) {
        selectedAssets[layer.layerKey] = null
        continue
      }
      const pick = layerAssets[Math.floor(Math.random() * layerAssets.length)]
      selectedAssets[layer.layerKey] = pick.id
    }
    const skin = SKIN_TONES[Math.floor(Math.random() * SKIN_TONES.length)]
    const hair = HAIR_PRESETS[Math.floor(Math.random() * HAIR_PRESETS.length)]
    setState(s => ({
      ...s,
      selectedAssets,
      tokens: { 'skin-color': skin.hex, 'hair-color': hair.hex },
    }))
  }

  function handleExport() {
    if (!compositorRef.current) return
    const url = compositorRef.current.exportPNG()
    setExportUrl(url)
  }

  function handleUnlock(keywordId: string) {
    setState(s => ({
      ...s,
      unlockedKeywords: [...s.unlockedKeywords, keywordId],
    }))
  }

  const handleCompositorReady = useCallback((compositor: AvatarCompositor) => {
    compositorRef.current = compositor
  }, [])

  function label(layerKey: string) {
    const found = layers.find(l => l.layerKey === layerKey)
    if (found) return localeState === 'en' ? found.labelEn : found.labelEs
    return LAYER_LABELS[layerKey]?.[localeState as 'es' | 'en'] || layerKey
  }

  function assetsForLayer(layerKey: string) {
    return assets.filter(a => a.layerKey === layerKey)
  }

  if (!collection) {
    return (
      <div className="min-h-screen bg-gray-950 flex flex-col items-center justify-center text-gray-400 gap-4">
        <div className="text-6xl">🎨</div>
        <p className="text-lg font-medium text-white">Avatar OS</p>
        <p className="text-sm">No hay colecciones activas aún.</p>
        <Link href={`/${locale}/admin`} className="text-violet-400 text-sm hover:underline">
          Ir al Admin →
        </Link>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-950 flex flex-col">
      {/* Header */}
      <header className="border-b border-gray-800 bg-gray-950 h-12 flex items-center justify-between px-4 shrink-0">
        <span className="text-white font-semibold text-sm">Avatar OS</span>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setLocaleState(localeState === 'es' ? 'en' : 'es')}
            className="text-xs text-gray-400 hover:text-white transition-colors"
          >
            {localeState === 'es' ? 'EN' : 'ES'}
          </button>
        </div>
      </header>

      {/* Main layout */}
      <div className="flex flex-1 overflow-hidden">
        {/* Canvas */}
        <div className="flex-1 p-4 flex items-center justify-center min-w-0">
          <div className="w-full max-w-lg aspect-square bg-gray-900 rounded-2xl overflow-hidden">
            <AvatarCanvas
              state={state}
              layers={layers.filter(l => !hiddenLayers.has(l.layerKey))}
              assets={assets}
              onCompositorReady={handleCompositorReady}
            />
          </div>
        </div>

        {/* Controls panel */}
        <div className="w-72 xl:w-80 border-l border-gray-800 bg-gray-950 overflow-y-auto shrink-0">
          <div className="p-4 space-y-6">

            {/* Scene section */}
            {scene.length > 0 && (
              <section>
                <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
                  {localeState === 'es' ? 'Escena' : 'Scene'}
                </h3>
                <div className="space-y-3">
                  {scene.map(layer => (
                    <div key={layer.layerKey}>
                      <p className="text-xs text-gray-400 mb-1.5">{label(layer.layerKey)}</p>
                      <AssetGrid
                        assets={assetsForLayer(layer.layerKey)}
                        selectedId={state.selectedAssets[layer.layerKey] || null}
                        onSelect={id => selectAsset(layer.layerKey, id)}
                        optional={layer.optional}
                      />
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Avatar section */}
            <section>
              <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
                {localeState === 'es' ? 'Avatar' : 'Avatar'}
              </h3>
              <div className="space-y-4">
                {/* Skin */}
                <div>
                  <p className="text-xs text-gray-400 mb-1.5">
                    {localeState === 'es' ? 'Tono de piel' : 'Skin tone'}
                  </p>
                  <SkinSelector
                    value={state.tokens['skin-color']}
                    onChange={hex => setToken('skin-color', hex)}
                  />
                </div>

                {/* Hair color */}
                <div>
                  <p className="text-xs text-gray-400 mb-1.5">
                    {localeState === 'es' ? 'Color de cabello' : 'Hair color'}
                  </p>
                  <HairColorPicker
                    value={state.tokens['hair-color']}
                    onChange={hex => setToken('hair-color', hex)}
                  />
                </div>

                {/* Layer assets */}
                {avatar.map(layer => {
                  if (hiddenLayers.has(layer.layerKey)) return null
                  const paired = layer.pairedWith
                  if (paired && layers.find(l => l.layerKey === paired)?.orderIndex! < layer.orderIndex) {
                    return null // Show paired layers only via the first one
                  }
                  return (
                    <div key={layer.layerKey}>
                      <p className="text-xs text-gray-400 mb-1.5">{label(layer.layerKey)}</p>
                      <AssetGrid
                        assets={assetsForLayer(layer.layerKey)}
                        selectedId={state.selectedAssets[layer.layerKey] || null}
                        onSelect={id => {
                          selectAsset(layer.layerKey, id)
                          if (layer.pairedWith) selectAsset(layer.pairedWith, id)
                        }}
                        optional={layer.optional}
                      />
                    </div>
                  )
                })}
              </div>
            </section>

            {/* Extras section */}
            {extras.length > 0 && (
              <section>
                <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
                  {localeState === 'es' ? 'Extras' : 'Extras'}
                </h3>
                <div className="space-y-3">
                  {extras.map(layer => {
                    if (hiddenLayers.has(layer.layerKey)) return null
                    if (layer.locked) return null
                    return (
                      <div key={layer.layerKey}>
                        <p className="text-xs text-gray-400 mb-1.5">{label(layer.layerKey)}</p>
                        <AssetGrid
                          assets={assetsForLayer(layer.layerKey)}
                          selectedId={state.selectedAssets[layer.layerKey] || null}
                          onSelect={id => selectAsset(layer.layerKey, id)}
                          optional={layer.optional}
                          showKeywordBadge
                        />
                      </div>
                    )
                  })}
                </div>
              </section>
            )}

            {/* Keyword input */}
            {collection && (
              <KeywordInput
                collectionId={collection.id}
                onUnlock={handleUnlock}
              />
            )}
          </div>
        </div>
      </div>

      {/* Footer actions */}
      <footer className="border-t border-gray-800 bg-gray-950 h-14 flex items-center justify-between px-4 shrink-0">
        <button
          onClick={handleRandomize}
          className="flex items-center gap-2 text-sm text-gray-400 hover:text-white transition-colors"
        >
          🎲 {localeState === 'es' ? 'Sorpréndeme' : 'Surprise me'}
        </button>
        <button
          onClick={handleExport}
          className="bg-violet-600 hover:bg-violet-500 text-white font-medium px-5 py-2 rounded-xl text-sm transition-colors"
        >
          ✨ {localeState === 'es' ? 'Crear mi PFP' : 'Create my PFP'}
        </button>
      </footer>

      {/* Export modal */}
      {exportUrl && (
        <ExportModal dataUrl={exportUrl} onClose={() => setExportUrl(null)} />
      )}
    </div>
  )
}
