'use client'

import { useState } from 'react'
import type { Asset, Layer } from '@/types'
import { mapLayer } from '@/lib/supabase/mappers'

interface Props {
  layer:   Layer
  assets:  Asset[]
  onClose: () => void
  onSaved: (updated: Layer) => void
}

export default function LayerRulesModal({ layer, assets, onClose, onSaved }: Props) {
  const layerAssets = assets.filter(a => a.layerKey === layer.layerKey)
  const roleOptions: [string, string][] = Array.from(
    new Map(layerAssets.flatMap(a => a.colorMap).map(c => [c.role, c.label || c.role])).entries()
  )

  const [masterOn,    setMasterOn]    = useState(layer.colorEditable || layer.positionEditable)
  const [colorOn,     setColorOn]     = useState(layer.colorEditable)
  const [positionOn,  setPositionOn]  = useState(layer.positionEditable)
  const [targetRole,  setTargetRole]  = useState(layer.colorTargetRole ?? roleOptions[0]?.[0] ?? '')
  const [useSwatches, setUseSwatches] = useState(layer.colorMode === 'swatches' || layer.colorMode === 'both')
  const [useCustom,   setUseCustom]   = useState(layer.colorMode === 'wheel' || layer.colorMode === 'both')
  const [swatches,    setSwatches]    = useState<string[]>(layer.colorSwatches ?? ['#ffffff', '#000000', '#ff0000'])
  const [saving,      setSaving]      = useState(false)
  const [resetting,   setResetting]   = useState(false)

  async function handleSave() {
    setSaving(true)
    const colorMode = useSwatches && useCustom ? 'both' : useCustom ? 'wheel' : 'swatches'
    const body = {
      id:                 layer.id,
      position_editable:  masterOn && positionOn,
      color_editable:     masterOn && colorOn,
      color_target_role:  masterOn && colorOn ? (targetRole || null) : null,
      color_mode:         colorMode,
      color_swatches:     useSwatches ? swatches : null,
    }
    const res = await fetch('/api/layers', {
      method:  'PUT',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(body),
    })
    if (!res.ok) {
      const d = await res.json().catch(() => ({} as { error?: string }))
      alert(`No se pudo guardar: ${d.error ?? `HTTP ${res.status}`}\n\n¿Se aplicó la migración 012_layer_rules.sql en Supabase?`)
      setSaving(false)
      return
    }
    const updated = await res.json()
    setSaving(false)
    onSaved(mapLayer(updated))
    onClose()
  }

  async function handleReset() {
    if (!confirm(`¿Reiniciar todos los assets de "${layer.labelEs}"? Esto borra los ajustes de posición y color configurados individualmente en cada asset, para que vuelvan a heredar el default de la capa.`)) return
    setResetting(true)
    const res = await fetch('/api/layers/reset-assets', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ layerId: layer.id }),
    })
    setResetting(false)
    if (!res.ok) {
      const d = await res.json().catch(() => ({} as { error?: string }))
      alert(`No se pudo reiniciar: ${d.error ?? `HTTP ${res.status}`}`)
      return
    }
    window.location.reload()
  }

  const inputC = 'w-full text-xs rounded-lg px-3 py-2 border focus:outline-none bg-gray-800 border-gray-700 text-white'

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.7)' }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="w-full max-w-md rounded-2xl overflow-hidden flex flex-col bg-gray-900 border border-gray-800" style={{ maxHeight: '90vh' }}>
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-800">
          <div>
            <p className="text-sm font-semibold text-white">Reglas de "{layer.labelEs}"</p>
            <p className="text-[10px] mt-0.5 text-gray-500">Default para todos los assets de esta capa — un asset puntual puede anularlo desde su propia configuración</p>
          </div>
          <button onClick={onClose} className="text-lg leading-none text-gray-500">✕</button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
          <BoolField
            label="¿Esta capa es editable?"
            hint="Si está apagado, ningún asset de esta capa ofrece ajuste de color o posición por defecto"
            value={masterOn}
            onChange={setMasterOn}
          />

          {masterOn && (
            <>
              <div className="space-y-3">
                <p className="text-xs font-medium text-white">¿Qué se puede editar?</p>
                <label className="flex items-center gap-2 text-xs text-gray-300">
                  <input type="checkbox" checked={positionOn} onChange={e => setPositionOn(e.target.checked)} className="accent-violet-500" />
                  Posición y escala
                </label>
                <label className="flex items-center gap-2 text-xs text-gray-300">
                  <input type="checkbox" checked={colorOn} onChange={e => setColorOn(e.target.checked)} className="accent-violet-500" />
                  Color
                </label>
              </div>

              {colorOn && (
                <div className="p-3 rounded-xl bg-gray-800/60 border border-gray-700 space-y-3">
                  <div>
                    <p className="text-[10px] mb-1.5 text-gray-400">
                      Región de color editable (ej. en una chaqueta gris con camiseta azul debajo, elige la región azul)
                    </p>
                    {roleOptions.length === 0 ? (
                      <p className="text-[10px] text-gray-500">Ningún asset de esta capa tiene colores detectados todavía.</p>
                    ) : (
                      <select value={targetRole} onChange={e => setTargetRole(e.target.value)} className={inputC}>
                        {roleOptions.map(([value, roleLabel]) => <option key={value} value={value}>{roleLabel}</option>)}
                      </select>
                    )}
                  </div>

                  <label className="flex items-center gap-2 text-xs text-gray-300">
                    <input type="checkbox" checked={useSwatches} onChange={e => setUseSwatches(e.target.checked)} className="accent-violet-500" />
                    Activar colores por defecto (muestras fijas)
                  </label>
                  {useSwatches && (
                    <div className="flex flex-wrap items-center gap-2 pl-5">
                      {swatches.map((hex, i) => (
                        <div key={i} className="relative">
                          <input
                            type="color"
                            value={hex}
                            onChange={e => setSwatches(sw => sw.map((s, idx) => idx === i ? e.target.value : s))}
                            className="w-7 h-7 rounded-lg cursor-pointer border-0"
                          />
                          {swatches.length > 1 && (
                            <button
                              type="button"
                              onClick={() => setSwatches(sw => sw.filter((_, idx) => idx !== i))}
                              className="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full text-[8px] flex items-center justify-center bg-red-600 text-white"
                            >✕</button>
                          )}
                        </div>
                      ))}
                      <button
                        type="button"
                        onClick={() => setSwatches(sw => [...sw, '#ffffff'])}
                        className="w-7 h-7 rounded-lg flex items-center justify-center text-xs bg-gray-700 text-gray-300"
                      >+</button>
                    </div>
                  )}

                  <label className="flex items-center gap-2 text-xs text-gray-300">
                    <input type="checkbox" checked={useCustom} onChange={e => setUseCustom(e.target.checked)} className="accent-violet-500" />
                    Permitir color personalizado (rueda libre)
                  </label>
                </div>
              )}
            </>
          )}

          <div className="pt-2 border-t border-gray-800">
            <button
              onClick={handleReset}
              disabled={resetting}
              className="w-full text-xs py-2 rounded-lg bg-red-950 hover:bg-red-900 text-red-300 disabled:opacity-50 transition-colors"
            >
              {resetting ? 'Reiniciando…' : `↺ Reiniciar ajustes individuales de los ${layerAssets.length} assets de esta capa`}
            </button>
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-gray-800 flex gap-2">
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex-1 text-sm font-semibold py-2.5 rounded-xl disabled:opacity-50 bg-violet-600 hover:bg-violet-500 text-white transition-colors"
          >
            {saving ? 'Guardando…' : 'Guardar cambios'}
          </button>
          <button onClick={onClose} className="px-4 text-sm rounded-xl bg-gray-800 hover:bg-gray-700 text-gray-300 transition-colors">
            Cancelar
          </button>
        </div>
      </div>
    </div>
  )
}

function BoolField({ label, hint, value, onChange }: { label: string; hint?: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div>
        <p className="text-xs font-medium text-white">{label}</p>
        {hint && <p className="text-[10px] mt-0.5 text-gray-500">{hint}</p>}
      </div>
      <button
        onClick={() => onChange(!value)}
        className="w-10 h-6 rounded-full transition-all shrink-0 relative"
        style={{ background: value ? 'rgba(124,58,237,0.8)' : 'rgba(255,255,255,0.1)' }}
      >
        <span className="absolute top-0.5 w-5 h-5 rounded-full bg-white transition-all" style={{ left: value ? '18px' : '2px' }} />
      </button>
    </div>
  )
}
