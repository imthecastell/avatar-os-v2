'use client'

import { useState } from 'react'
import Image from 'next/image'
import type { Asset } from '@/types'

import type { Layer } from '@/types'

interface Props {
  assets: Asset[]
  layers: Layer[]
}

export default function AssetPanel({ assets, layers }: Props) {
  const [selectedLayer, setSelectedLayer] = useState<string | null>(null)

  const layerKeys = [...new Set(assets.map(a => a.layerKey))]

  const filtered = selectedLayer
    ? assets.filter(a => a.layerKey === selectedLayer)
    : assets

  const getLayerLabel = (key: string) =>
    layers.find(l => l.layerKey === key)?.labelEs || key

  return (
    <div className="flex gap-4">
      {/* Layer sidebar */}
      <div className="w-40 shrink-0">
        <button
          onClick={() => setSelectedLayer(null)}
          className={`w-full text-left px-3 py-1.5 rounded-lg text-sm mb-1 transition-colors ${
            selectedLayer === null ? 'bg-violet-600 text-white' : 'text-gray-400 hover:text-white'
          }`}
        >
          Todos ({assets.length})
        </button>
        {layerKeys.map(key => {
          const count = assets.filter(a => a.layerKey === key).length
          return (
            <button
              key={key}
              onClick={() => setSelectedLayer(key)}
              className={`w-full text-left px-3 py-1.5 rounded-lg text-sm mb-1 transition-colors ${
                selectedLayer === key ? 'bg-violet-600 text-white' : 'text-gray-400 hover:text-white'
              }`}
            >
              {getLayerLabel(key)} {count}
            </button>
          )
        })}
      </div>

      {/* Asset grid */}
      <div className="flex-1">
        {filtered.length === 0 ? (
          <p className="text-gray-600 text-sm">No hay assets en esta capa.</p>
        ) : (
          <div className="grid grid-cols-4 xl:grid-cols-6 gap-3">
            {filtered.map(asset => (
              <div key={asset.id} className="group relative">
                <div className="aspect-square bg-gray-800 rounded-xl overflow-hidden border border-gray-700">
                  {asset.thumbUrl || asset.cdnUrl ? (
                    <Image
                      src={asset.thumbUrl || asset.cdnUrl}
                      alt={asset.name}
                      width={120}
                      height={120}
                      className="w-full h-full object-cover"
                      unoptimized
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-gray-600 text-xs">
                      {asset.fileType}
                    </div>
                  )}
                </div>
                <p className="text-xs text-gray-500 mt-1 truncate">{asset.name}</p>
                {asset.isDefault && (
                  <span className="absolute top-1 left-1 bg-violet-600 text-white text-[8px] px-1 rounded">
                    default
                  </span>
                )}
                {asset.keywordId && (
                  <span className="absolute top-1 right-1 text-yellow-400 text-xs">🔑</span>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
