'use client'

import { useState } from 'react'
import type { Layer, LayerException, LayerDefault, Collection } from '@/types'

interface Props {
  collections: Collection[]
  layers: Layer[]
  exceptions: LayerException[]
  defaults: LayerDefault[]
}

export default function LayerStack({ collections, layers, exceptions, defaults }: Props) {
  const [items, setItems] = useState(layers)
  const [dragIdx, setDragIdx] = useState<number | null>(null)

  function handleDragStart(i: number) { setDragIdx(i) }

  function handleDragOver(e: React.DragEvent, i: number) {
    e.preventDefault()
    if (dragIdx === null || dragIdx === i) return
    const next = [...items]
    const [moved] = next.splice(dragIdx, 1)
    next.splice(i, 0, moved)
    setItems(next)
    setDragIdx(i)
  }

  async function saveOrder() {
    for (let i = 0; i < items.length; i++) {
      await fetch('/api/layers', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: items[i].id, order_index: i }),
      })
    }
    alert('Orden guardado')
  }

  return (
    <div className="space-y-6">
      {/* Layer stack */}
      <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-800 flex items-center justify-between">
          <h2 className="text-sm font-medium text-white">Stack de capas</h2>
          <button
            onClick={saveOrder}
            className="text-xs bg-violet-600 hover:bg-violet-500 text-white px-3 py-1 rounded-lg"
          >
            Guardar orden
          </button>
        </div>

        <div className="divide-y divide-gray-800">
          {items.map((layer, i) => (
            <div
              key={layer.id}
              draggable={!layer.locked}
              onDragStart={() => handleDragStart(i)}
              onDragOver={e => handleDragOver(e, i)}
              onDragEnd={() => setDragIdx(null)}
              className={`flex items-center gap-3 px-4 py-2.5 text-sm ${
                dragIdx === i ? 'bg-violet-500/10' : 'hover:bg-gray-800'
              } ${layer.locked ? 'opacity-60' : 'cursor-grab'}`}
            >
              <span className="text-gray-600 w-4 text-center">
                {layer.locked ? '🔒' : '⠿'}
              </span>
              <span className="w-5 text-xs text-gray-600">{i}</span>
              <span className="flex-1 text-gray-200">{layer.labelEs}</span>
              <span className="text-xs text-gray-600 w-14">{layer.type}</span>
              <span className="text-xs text-violet-400 w-24">{layer.colorToken || '—'}</span>
              <span className="text-xs text-gray-600">{layer.optional ? 'opcional' : '—'}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Exceptions */}
      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-4">
        <h2 className="text-sm font-medium text-white mb-3">Excepciones</h2>
        {exceptions.length === 0 ? (
          <p className="text-xs text-gray-600">No hay excepciones configuradas.</p>
        ) : (
          <div className="space-y-2">
            {exceptions.map(ex => (
              <div key={ex.id} className="flex items-center gap-2 bg-gray-800 rounded-lg px-3 py-2 text-xs">
                <span className="text-gray-400">Si</span>
                <span className="text-violet-400">{ex.triggerLayer} ({ex.triggerAssetPattern})</span>
                <span className="text-gray-400">→ {ex.action}</span>
                <span className="text-yellow-400">{ex.affectedLayer}</span>
                {ex.note && <span className="text-gray-600 ml-auto">{ex.note}</span>}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Defaults */}
      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-4">
        <h2 className="text-sm font-medium text-white mb-3">Defaults</h2>
        {defaults.length === 0 ? (
          <p className="text-xs text-gray-600">No hay defaults configurados.</p>
        ) : (
          <div className="space-y-2">
            {defaults.map(d => (
              <div key={d.id} className="flex items-center gap-3 text-sm">
                <span className="text-gray-400 w-24">{d.layerKey}</span>
                <span className="text-violet-400 w-28">{d.tokenId}</span>
                <span
                  className="w-6 h-6 rounded-full border border-gray-600"
                  style={{ backgroundColor: d.defaultHex }}
                />
                <span className="text-gray-300 text-xs">{d.defaultHex}</span>
                <span className="text-gray-500 text-xs">{d.defaultName}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
