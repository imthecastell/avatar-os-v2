'use client'

import { useState, useCallback } from 'react'
import dynamic from 'next/dynamic'
import SkinSelector, { SKIN_TONES } from '@/components/builder/SkinSelector'
import HairColorPicker, { HAIR_PRESETS } from '@/components/builder/HairColorPicker'
import type { AvatarState, Layer, Asset, LayerDefault, Collection } from '@/types'

const AvatarCanvas = dynamic(() => import('@/components/builder/AvatarCanvas'), { ssr: false })

interface Props {
  collections: Collection[]
  layers: Layer[]
  assets: Asset[]
  defaults: LayerDefault[]
}

export default function AdminPreview({ collections, layers, assets, defaults }: Props) {
  const [state, setState] = useState<AvatarState>({
    collectionId: collections[0]?.id || '',
    tokens: {
      'skin-color': defaults.find(d => d.tokenId === 'skin-color')?.defaultHex || SKIN_TONES[1].hex,
      'hair-color': defaults.find(d => d.tokenId === 'hair-color')?.defaultHex || HAIR_PRESETS[0].hex,
    },
    selectedAssets: Object.fromEntries(
      layers.map(l => [
        l.layerKey,
        assets.find(a => a.layerKey === l.layerKey && a.isDefault)?.id ||
        assets.find(a => a.layerKey === l.layerKey)?.id ||
        null,
      ])
    ),
    unlockedKeywords: [],
    extraColor: false,
  })

  const [visibleLayers, setVisibleLayers] = useState<Set<string>>(
    new Set(layers.map(l => l.layerKey))
  )

  const handleCompositorReady = useCallback(() => {}, [])

  function toggleLayer(key: string) {
    setVisibleLayers(prev => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  function randomize() {
    const sel: Record<string, string | null> = {}
    for (const layer of layers) {
      const layerAssets = assets.filter(a => a.layerKey === layer.layerKey)
      if (layerAssets.length > 0) {
        sel[layer.layerKey] = layerAssets[Math.floor(Math.random() * layerAssets.length)].id
      }
    }
    setState(s => ({
      ...s,
      selectedAssets: sel,
      tokens: {
        'skin-color': SKIN_TONES[Math.floor(Math.random() * SKIN_TONES.length)].hex,
        'hair-color': HAIR_PRESETS[Math.floor(Math.random() * HAIR_PRESETS.length)].hex,
      },
    }))
  }

  return (
    <div className="flex gap-6">
      {/* Canvas */}
      <div className="w-80 shrink-0">
        <div className="aspect-square bg-gray-900 rounded-2xl overflow-hidden border border-gray-800">
          <AvatarCanvas
            state={state}
            layers={layers.filter(l => visibleLayers.has(l.layerKey))}
            assets={assets}
            onCompositorReady={handleCompositorReady}
          />
        </div>
        <button
          onClick={randomize}
          className="mt-3 w-full bg-gray-800 hover:bg-gray-700 text-white text-sm py-2 rounded-xl"
        >
          🎲 Aleatorio
        </button>
      </div>

      {/* Controls */}
      <div className="flex-1 space-y-4">
        {/* Layer toggles */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
          <h3 className="text-xs font-medium text-gray-400 mb-3 uppercase tracking-wider">
            Capas activas
          </h3>
          <div className="space-y-1">
            {layers.map(layer => (
              <label key={layer.layerKey} className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={visibleLayers.has(layer.layerKey)}
                  onChange={() => toggleLayer(layer.layerKey)}
                  className="accent-violet-500"
                />
                <span className="text-sm text-gray-300">{layer.labelEs}</span>
                <span className="text-xs text-gray-600 ml-auto">{layer.layerKey}</span>
                {layer.locked && <span className="text-xs">🔒</span>}
              </label>
            ))}
          </div>
        </div>

        {/* Color controls */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 space-y-3">
          <h3 className="text-xs font-medium text-gray-400 uppercase tracking-wider">Colores</h3>
          <div>
            <p className="text-xs text-gray-500 mb-1.5">Piel</p>
            <SkinSelector
              value={state.tokens['skin-color']}
              onChange={hex => setState(s => ({ ...s, tokens: { ...s.tokens, 'skin-color': hex } }))}
            />
          </div>
          <div>
            <p className="text-xs text-gray-500 mb-1.5">Cabello</p>
            <HairColorPicker
              value={state.tokens['hair-color']}
              onChange={hex => setState(s => ({ ...s, tokens: { ...s.tokens, 'hair-color': hex } }))}
            />
          </div>
        </div>
      </div>
    </div>
  )
}
