'use client'

import { useState, useEffect } from 'react'
import Image from 'next/image'
import type { Asset, Keyword, AssetTransform } from '@/types'

interface Props {
  asset:    Asset
  assets:   Asset[]           // para el selector de máscara
  keywords: Keyword[]
  onClose:  () => void
  onSaved:  () => void        // recarga la página
}

export default function AssetInspector({ asset, assets, keywords, onClose, onSaved }: Props) {
  const [keywordId,      setKeywordId]      = useState<string>(asset.keywordId ?? '')
  const [isDefault,      setIsDefault]      = useState(asset.isDefault)
  const [suggestedColor, setSuggestedColor] = useState<string>(asset.suggestedColor ?? '')
  const [maskAssetId,    setMaskAssetId]    = useState<string>(asset.maskAssetId ?? '')
  const [allowTransform, setAllowTransform] = useState(asset.allowTransform)
  const [transform,      setTransform]      = useState<AssetTransform>(
    asset.transform ?? { scale: 1, offsetX: 0, offsetY: 0 }
  )
  const [saving, setSaving] = useState(false)

  function updateTransform(key: keyof AssetTransform, val: number) {
    setTransform(t => ({ ...t, [key]: val }))
  }

  async function handleSave() {
    setSaving(true)

    const body: Record<string, unknown> = {
      id:             asset.id,
      keyword_id:     keywordId    || null,
      is_default:     isDefault,
      suggested_color: suggestedColor || null,
      mask_asset_id:  maskAssetId  || null,
      allow_transform: allowTransform,
      transform,
    }

    // Si se marca como default, limpiar otros defaults de la misma capa
    if (isDefault && !asset.isDefault) {
      // El endpoint PATCH ya guarda is_default; el admin puede gestionar múltiples defaults
      // desde la vista de assets. Aquí solo guardamos.
    }

    await fetch('/api/assets', {
      method:  'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(body),
    })

    setSaving(false)
    onSaved()
  }

  const maskCandidates = assets.filter(a => a.layerKey === 'mask' && a.id !== asset.id)

  const label  = (v: string, d: string) => v || d
  const inputC = `
    w-full text-xs rounded-xl px-3 py-2 border focus:outline-none transition-colors
    focus:border-violet-500
  `
  const inputS = { background: 'rgba(255,255,255,0.05)', borderColor: 'rgba(255,255,255,0.1)', color: 'white' }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)' }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div
        className="w-full max-w-md rounded-3xl overflow-hidden flex flex-col"
        style={{ background: '#111120', border: '1px solid rgba(255,255,255,0.08)', maxHeight: '90vh' }}
      >
        {/* Header */}
        <div className="flex items-center gap-3 px-5 py-4 border-b" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
          {asset.cdnUrl && (
            <div className="w-12 h-12 rounded-xl overflow-hidden shrink-0" style={{ background: 'rgba(255,255,255,0.05)' }}>
              <Image src={asset.cdnUrl} alt={asset.name} width={48} height={48} className="w-full h-full object-cover" unoptimized />
            </div>
          )}
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-white truncate">{asset.name}</p>
            <p className="text-[10px] mt-0.5" style={{ color: 'rgba(255,255,255,0.3)' }}>{asset.layerKey} · {asset.fileType.toUpperCase()}</p>
          </div>
          <button onClick={onClose} className="text-lg leading-none shrink-0" style={{ color: 'rgba(255,255,255,0.3)' }}>✕</button>
        </div>

        {/* Body — scrollable */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">

          {/* Default toggle */}
          <Toggle
            label="Asset por defecto"
            hint="Se usa cuando el usuario abre el builder por primera vez"
            value={isDefault}
            onChange={setIsDefault}
          />

          {/* Keyword requirement */}
          <div>
            <Label text="Requiere palabra clave" hint="Solo se muestra si el usuario ingresa esta clave" />
            <select
              value={keywordId}
              onChange={e => setKeywordId(e.target.value)}
              className={inputC}
              style={inputS}
            >
              <option value="">Sin restricción (público)</option>
              {keywords.map(k => (
                <option key={k.id} value={k.id}>{k.keyword} — {k.label}</option>
              ))}
            </select>
          </div>

          {/* Suggested color */}
          {(asset.layerKey === 'hair-back' || asset.layerKey === 'hair-front') && (
            <div>
              <Label text="Color sugerido" hint="Se aplica automáticamente al seleccionar este estilo de cabello" />
              <div className="flex items-center gap-3 mt-1">
                <input
                  type="color"
                  value={suggestedColor || '#3B2314'}
                  onChange={e => setSuggestedColor(e.target.value)}
                  className="w-10 h-10 rounded-xl cursor-pointer border-0"
                  style={{ background: 'none' }}
                />
                <input
                  type="text"
                  value={suggestedColor}
                  onChange={e => setSuggestedColor(e.target.value)}
                  placeholder="Sin color sugerido"
                  className={inputC}
                  style={inputS}
                />
                {suggestedColor && (
                  <button onClick={() => setSuggestedColor('')} className="text-xs shrink-0" style={{ color: 'rgba(255,255,255,0.3)' }}>✕</button>
                )}
              </div>
            </div>
          )}

          {/* Mask asset (for hats/accessories) */}
          {(asset.layerKey === 'acc-front' || asset.layerKey === 'mask') && (
            <div>
              <Label
                text="Máscara automática"
                hint="Asset del layer 'mask' que se aplica cuando este accesorio está activo. Útil para que gorras oculten el cabello que sobresale."
              />
              {maskCandidates.length === 0 ? (
                <p className="text-[10px] mt-1" style={{ color: 'rgba(255,255,255,0.25)' }}>
                  No hay assets en el layer "mask". Sube primero la máscara en el Studio.
                </p>
              ) : (
                <select
                  value={maskAssetId}
                  onChange={e => setMaskAssetId(e.target.value)}
                  className={`${inputC} mt-1`}
                  style={inputS}
                >
                  <option value="">Sin máscara</option>
                  {maskCandidates.map(a => (
                    <option key={a.id} value={a.id}>{a.name}</option>
                  ))}
                </select>
              )}
              <p className="text-[9px] mt-1.5" style={{ color: 'rgba(255,255,255,0.2)' }}>
                La máscara usa modo "destination-out" sobre las capas anteriores para borrar el cabello que asoma bajo la gorra.
              </p>
            </div>
          )}

          {/* Allow builder-side transform (solo cabello frontal) */}
          {asset.layerKey === 'hair-front' && (
            <Toggle
              label="Permitir ajuste en el builder"
              hint="Muestra escala/posición al usuario público cuando elige este cabello — útil si no encaja bien con ciertas formas de cabeza"
              value={allowTransform}
              onChange={setAllowTransform}
            />
          )}

          {/* Transform */}
          <div>
            <Label text="Posición y escala" hint="Ajusta si el asset no encaja correctamente con los demás elementos" />
            <div className="space-y-3 mt-2">
              <Slider
                label={`Escala  ${transform.scale.toFixed(2)}×`}
                min={0.3} max={2} step={0.01}
                value={transform.scale}
                onChange={v => updateTransform('scale', v)}
              />
              <Slider
                label={`Desplazamiento X  ${transform.offsetX > 0 ? '+' : ''}${transform.offsetX}px`}
                min={-400} max={400} step={4}
                value={transform.offsetX}
                onChange={v => updateTransform('offsetX', v)}
              />
              <Slider
                label={`Desplazamiento Y  ${transform.offsetY > 0 ? '+' : ''}${transform.offsetY}px`}
                min={-400} max={400} step={4}
                value={transform.offsetY}
                onChange={v => updateTransform('offsetY', v)}
              />
              {(transform.scale !== 1 || transform.offsetX !== 0 || transform.offsetY !== 0) && (
                <button
                  onClick={() => setTransform({ scale: 1, offsetX: 0, offsetY: 0 })}
                  className="text-[10px]"
                  style={{ color: 'rgba(255,255,255,0.3)' }}
                >
                  ↩ Resetear transformación
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-4 border-t flex gap-2" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex-1 text-sm font-semibold py-2.5 rounded-xl disabled:opacity-50 transition-all"
            style={{ background: 'rgba(124,58,237,0.85)', color: 'white' }}
          >
            {saving ? 'Guardando…' : 'Guardar cambios'}
          </button>
          <button
            onClick={onClose}
            className="px-4 text-sm rounded-xl transition-all"
            style={{ background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.5)' }}
          >
            Cancelar
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Sub-components ────────────────────────────────────────
function Toggle({ label, hint, value, onChange }: { label: string; hint?: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div>
        <p className="text-xs font-medium text-white">{label}</p>
        {hint && <p className="text-[10px] mt-0.5" style={{ color: 'rgba(255,255,255,0.3)' }}>{hint}</p>}
      </div>
      <button
        onClick={() => onChange(!value)}
        className="w-10 h-6 rounded-full transition-all shrink-0 relative"
        style={{ background: value ? 'rgba(124,58,237,0.8)' : 'rgba(255,255,255,0.1)' }}
      >
        <span
          className="absolute top-0.5 w-5 h-5 rounded-full transition-all"
          style={{ background: 'white', left: value ? '18px' : '2px' }}
        />
      </button>
    </div>
  )
}

function Label({ text, hint }: { text: string; hint?: string }) {
  return (
    <div className="mb-1.5">
      <p className="text-xs font-medium text-white">{text}</p>
      {hint && <p className="text-[10px] mt-0.5" style={{ color: 'rgba(255,255,255,0.3)' }}>{hint}</p>}
    </div>
  )
}

function Slider({ label, min, max, step, value, onChange }: {
  label: string; min: number; max: number; step: number; value: number; onChange: (v: number) => void
}) {
  return (
    <div>
      <div className="flex justify-between mb-1">
        <p className="text-[10px]" style={{ color: 'rgba(255,255,255,0.5)' }}>{label}</p>
      </div>
      <input
        type="range"
        min={min} max={max} step={step}
        value={value}
        onChange={e => onChange(parseFloat(e.target.value))}
        className="w-full h-1.5 rounded-full appearance-none cursor-pointer"
        style={{ accentColor: '#7c3aed', background: `linear-gradient(to right, #7c3aed ${((value - min) / (max - min)) * 100}%, rgba(255,255,255,0.1) 0%)` }}
      />
    </div>
  )
}
