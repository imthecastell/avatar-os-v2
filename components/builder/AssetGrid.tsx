'use client'

import Image from 'next/image'
import type { Asset } from '@/types'

interface Props {
  assets: Asset[]
  selectedId: string | null
  onSelect: (id: string | null) => void
  optional?: boolean
  showKeywordBadge?: boolean
}

export default function AssetGrid({
  assets,
  selectedId,
  onSelect,
  optional = false,
  showKeywordBadge = false,
}: Props) {
  return (
    <div className="flex flex-wrap gap-2">
      {optional && (
        <button
          onClick={() => onSelect(null)}
          className={`w-14 h-14 rounded-xl border-2 transition-all flex items-center justify-center text-xs text-gray-400 ${
            selectedId === null
              ? 'border-violet-500 bg-violet-500/10'
              : 'border-gray-700 hover:border-gray-500'
          }`}
        >
          ✕
        </button>
      )}

      {assets.map(asset => (
        <button
          key={asset.id}
          onClick={() => onSelect(asset.id)}
          className={`relative w-14 h-14 rounded-xl border-2 transition-all overflow-hidden ${
            selectedId === asset.id
              ? 'border-violet-500 scale-105'
              : 'border-gray-700 hover:border-gray-500'
          }`}
        >
          {asset.thumbUrl || asset.cdnUrl ? (
            <Image
              src={asset.thumbUrl || asset.cdnUrl}
              alt={asset.name}
              fill
              className="object-cover"
              unoptimized
            />
          ) : (
            <span className="text-gray-600 text-xs">?</span>
          )}

          {showKeywordBadge && asset.keywordId && (
            <span className="absolute top-0.5 right-0.5 text-[8px] leading-none">✦</span>
          )}
        </button>
      ))}
    </div>
  )
}
