'use client'

import { useState, useRef } from 'react'
import Image from 'next/image'
import type { Layer, Asset, Collection } from '@/types'
import LayerRulesModal from '@/components/admin/LayerRulesModal'

interface Props {
  collections: Collection[]
  layers: Layer[]
  assets: Asset[]
  onLayersChange?: (layers: Layer[]) => void
}

const LAYER_OPTIONS = [
  { key: 'background',   label: 'Fondo' },
  { key: 'emotion',      label: 'Emoción' },
  { key: 'hair-back',    label: 'Cabello atrás' },
  { key: 'head',         label: 'Cabeza' },
  { key: 'shirt',        label: 'Camiseta' },
  { key: 'hair-front',   label: 'Cabello frente' },
  { key: 'acc-front',    label: 'Accesorio' },
  { key: 'mask',         label: 'Máscara' },
  { key: 'effect-final', label: 'Efecto final' },
  { key: 'frame',        label: 'Marco' },
]

export default function LayerSandwich({ collections, layers: initialLayers, assets }: Props) {
  const [layers, setLayers] = useState(initialLayers)
  const [expanded, setExpanded] = useState<string | null>(null)
  const [dragIdx, setDragIdx] = useState<number | null>(null)
  const [saving, setSaving] = useState(false)
  const [editingAsset, setEditingAsset] = useState<string | null>(null)
  const [editingLayer, setEditingLayer] = useState<string | null>(null)

  // ── Drag & drop ──────────────────────────────────────
  function handleDragStart(i: number) {
    if (layers[i].locked) return
    setDragIdx(i)
  }

  function handleDragOver(e: React.DragEvent, i: number) {
    e.preventDefault()
    if (dragIdx === null || dragIdx === i || layers[i].locked) return
    const next = [...layers]
    const [moved] = next.splice(dragIdx, 1)
    next.splice(i, 0, moved)
    setLayers(next)
    setDragIdx(i)
  }

  async function saveOrder() {
    setSaving(true)
    for (let i = 0; i < layers.length; i++) {
      await fetch('/api/layers', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: layers[i].id, order_index: i }),
      })
    }
    setSaving(false)
  }

  // ── Toggle: capa opcional u obligatoria en el builder público ──
  async function toggleOptional(layerId: string, optional: boolean) {
    setLayers(prev => prev.map(l => l.id === layerId ? { ...l, optional } : l))
    const res = await fetch('/api/layers', {
      method:  'PUT',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ id: layerId, optional }),
    })
    if (!res.ok) {
      setLayers(prev => prev.map(l => l.id === layerId ? { ...l, optional: !optional } : l))
      alert('No se pudo guardar el cambio')
    }
  }

  // ── Set default asset ─────────────────────────────────
  async function setDefault(assetId: string, layerKey: string) {
    // Clear previous default for this layer
    const layerAssets = assets.filter(a => a.layerKey === layerKey)
    for (const a of layerAssets) {
      if (a.isDefault) {
        await fetch('/api/assets', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: a.id, is_default: false }),
        })
      }
    }
    await fetch('/api/assets', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: assetId, is_default: true }),
    })
    window.location.reload()
  }

  // ── Delete asset ──────────────────────────────────────
  async function deleteAsset(assetId: string) {
    if (!confirm('¿Eliminar este asset?')) return
    await fetch(`/api/assets?id=${assetId}`, { method: 'DELETE' })
    window.location.reload()
  }

  // ── Change layer ──────────────────────────────────────
  async function changeLayer(assetId: string, newLayerKey: string) {
    await fetch('/api/assets', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: assetId, layer_key: newLayerKey }),
    })
    window.location.reload()
  }

  return (
    <div className="space-y-2">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <p className="text-xs text-gray-500">Arrastra para reordenar · Click en una capa para ver sus assets</p>
        <button
          onClick={saveOrder}
          disabled={saving}
          className="text-xs bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white px-3 py-1.5 rounded-lg transition-colors"
        >
          {saving ? 'Guardando...' : 'Guardar orden'}
        </button>
      </div>

      {/* Layer stack */}
      {layers.map((layer, i) => {
        const layerAssets = assets.filter(a => a.layerKey === layer.layerKey)
        const isExpanded = expanded === layer.layerKey
        const nonEditable = layerAssets.filter(a => a.fileType === 'svg' && !a.svgEditable)

        return (
          <div key={layer.id}>
            {/* Layer row */}
            <div
              draggable={!layer.locked}
              onDragStart={() => handleDragStart(i)}
              onDragOver={e => handleDragOver(e, i)}
              onDragEnd={() => setDragIdx(null)}
              onClick={() => setExpanded(isExpanded ? null : layer.layerKey)}
              className={`flex items-center gap-3 px-4 py-3 rounded-xl border transition-all cursor-pointer select-none ${
                dragIdx === i
                  ? 'border-violet-500 bg-violet-500/10'
                  : isExpanded
                  ? 'border-violet-500/50 bg-gray-800'
                  : 'border-gray-800 bg-gray-900 hover:border-gray-700'
              } ${layer.locked ? 'opacity-60' : ''}`}
            >
              {/* Drag handle */}
              <span className={`text-gray-600 text-lg ${layer.locked ? '' : 'cursor-grab'}`}>
                {layer.locked ? '🔒' : '⠿'}
              </span>

              {/* Order */}
              <span className="text-xs text-gray-600 w-5 text-center">{i}</span>

              {/* Name */}
              <span className="flex-1 text-sm font-medium text-gray-200">{layer.labelEs}</span>

              {/* Color token badge */}
              {layer.colorToken && (
                <span className="text-xs bg-violet-900/50 text-violet-300 px-2 py-0.5 rounded-full">
                  {layer.colorToken}
                </span>
              )}

              {/* Warning badge */}
              {nonEditable.length > 0 && (
                <span className="text-xs bg-yellow-900/50 text-yellow-400 px-2 py-0.5 rounded-full">
                  ⚠ {nonEditable.length} sin color
                </span>
              )}

              {/* Opcional / obligatoria en el builder público */}
              <label
                className="flex items-center gap-1.5 text-xs text-gray-400 cursor-pointer select-none shrink-0"
                onClick={e => e.stopPropagation()}
              >
                <input
                  type="checkbox"
                  checked={layer.optional}
                  onChange={e => toggleOptional(layer.id, e.target.checked)}
                  className="accent-violet-500 w-3.5 h-3.5"
                />
                {layer.optional ? 'Opcional' : 'Obligatoria'}
              </label>

              {/* Editar reglas de la capa (color/posición por defecto) */}
              <button
                onClick={e => { e.stopPropagation(); setEditingLayer(layer.layerKey) }}
                className="text-xs bg-gray-800 hover:bg-gray-700 text-gray-300 px-2 py-1 rounded-lg shrink-0"
              >
                ⚙ Reglas
              </button>

              {/* Asset count */}
              <span className="text-xs text-gray-500 w-16 text-right">
                {layerAssets.length} asset{layerAssets.length !== 1 ? 's' : ''}
              </span>

              {/* Expand arrow */}
              <span className="text-gray-600 text-xs">{isExpanded ? '▲' : '▼'}</span>
            </div>

            {/* Expanded assets */}
            {isExpanded && (
              <div className="ml-4 mt-1 mb-2 p-4 bg-gray-900/50 border border-gray-800 rounded-xl">
                {layerAssets.length === 0 ? (
                  <p className="text-xs text-gray-600">No hay assets en esta capa.</p>
                ) : (
                  <div className="grid grid-cols-4 sm:grid-cols-6 lg:grid-cols-8 gap-3">
                    {layerAssets.map(asset => (
                      <div key={asset.id} className="group relative">
                        {/* Thumbnail */}
                        <div className={`aspect-square rounded-lg overflow-hidden border-2 transition-colors ${
                          asset.isDefault ? 'border-violet-500' : 'border-gray-700 group-hover:border-gray-500'
                        }`}>
                          {asset.cdnUrl ? (
                            <Image
                              src={asset.cdnUrl}
                              alt={asset.name}
                              width={80}
                              height={80}
                              className="w-full h-full object-cover bg-gray-800"
                              unoptimized
                            />
                          ) : (
                            <div className="w-full h-full bg-gray-800 flex items-center justify-center text-gray-600 text-xs">
                              {asset.fileType}
                            </div>
                          )}
                        </div>

                        {/* Badges */}
                        {asset.isDefault && (
                          <span className="absolute top-0.5 left-0.5 bg-violet-600 text-white text-[8px] px-1 rounded leading-4">
                            default
                          </span>
                        )}
                        {asset.fileType === 'svg' && !asset.svgEditable && (
                          <span className="absolute top-0.5 right-0.5 text-yellow-400 text-xs" title="SVG sin colores editables">
                            ⚠
                          </span>
                        )}

                        {/* Name */}
                        <p className="text-[10px] text-gray-500 mt-1 truncate">{asset.name}</p>

                        {/* Actions (visible on hover) */}
                        <div className="absolute inset-0 bg-black/70 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-1 p-1">
                          <button
                            onClick={() => setDefault(asset.id, layer.layerKey)}
                            className="text-[10px] bg-violet-600 hover:bg-violet-500 text-white px-2 py-0.5 rounded w-full text-center"
                          >
                            Default
                          </button>
                          <select
                            defaultValue={layer.layerKey}
                            onChange={e => changeLayer(asset.id, e.target.value)}
                            onClick={e => e.stopPropagation()}
                            className="text-[10px] bg-gray-700 text-white rounded px-1 py-0.5 w-full"
                          >
                            {LAYER_OPTIONS.map(l => (
                              <option key={l.key} value={l.key}>{l.label}</option>
                            ))}
                          </select>
                          <button
                            onClick={() => deleteAsset(asset.id)}
                            className="text-[10px] bg-red-900 hover:bg-red-700 text-white px-2 py-0.5 rounded w-full text-center"
                          >
                            Eliminar
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )
      })}

      {editingLayer && (() => {
        const layer = layers.find(l => l.layerKey === editingLayer)
        if (!layer) return null
        return (
          <LayerRulesModal
            layer={layer}
            assets={assets}
            onClose={() => setEditingLayer(null)}
            onSaved={updated => setLayers(prev => prev.map(l => l.id === updated.id ? updated : l))}
          />
        )
      })()}
    </div>
  )
}
