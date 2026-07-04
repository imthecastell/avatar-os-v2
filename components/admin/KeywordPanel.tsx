'use client'

import { useState } from 'react'
import type { Keyword, Collection, Layer, ColorUnlock, Asset } from '@/types'

interface Props {
  collections:  Collection[]
  keywords:     Keyword[]
  layers:       Layer[]
  colorUnlocks: ColorUnlock[]
  assets:       Asset[]
}

// Una capa solo se puede recolorear si al menos uno de sus assets es SVG con
// regiones detectadas (colorMap) — capas raster (fondo, marco) nunca podrán
// aplicar un color_unlock por más que se configure una regla sobre ellas.
function isRecolorable(layerKey: string, assets: Asset[]): boolean {
  return assets.some(a => a.layerKey === layerKey && a.fileType === 'svg' && a.colorMap.length > 0)
}

const inputC = 'w-full text-xs rounded-xl px-3 py-2.5 border focus:outline-none transition-colors focus:border-violet-500'
const inputS = { background: 'rgba(255,255,255,0.05)', borderColor: 'rgba(255,255,255,0.1)', color: 'white' }

const ROLE_OPTIONS = [
  { value: 'skin',      label: 'Principal' },
  { value: 'primary',   label: 'Secundario' },
  { value: 'secondary', label: 'Detalle' },
]

export default function KeywordPanel({ collections, keywords: initial, layers, colorUnlocks: initialUnlocks, assets }: Props) {
  const [keywords, setKeywords]       = useState(initial)
  const [colorUnlocks, setColorUnlocks] = useState(initialUnlocks)
  const [collectionId, setCollId]     = useState(collections[0]?.id ?? '')
  const [form, setForm]               = useState({ keyword: '', label: '', hint: '' })
  const [saving, setSaving]           = useState(false)
  const [rulesOpenFor, setRulesOpenFor] = useState<string | null>(null)

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    const res  = await fetch('/api/keywords', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...form, collection_id: collectionId }),
    })
    const data = await res.json()
    if (!data.error) {
      setKeywords(prev => [{ ...data, active: data.active ?? true, isMaster: data.is_master ?? false }, ...prev])
      setForm({ keyword: '', label: '', hint: '' })
    }
    setSaving(false)
  }

  async function toggleActive(kw: Keyword) {
    const res  = await fetch('/api/keywords', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: kw.id, active: !kw.active }),
    })
    const data = await res.json()
    if (!data.error) {
      setKeywords(prev => prev.map(k => k.id === kw.id ? { ...k, active: !k.active } : k))
    }
  }

  async function toggleMaster(kw: Keyword) {
    const next = !kw.isMaster
    const res  = await fetch('/api/keywords', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: kw.id, is_master: next }),
    })
    const data = await res.json()
    if (!data.error) {
      setKeywords(prev => prev.map(k => k.id === kw.id ? { ...k, isMaster: next } : k))
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('¿Eliminar esta keyword? También se eliminarán sus reglas de color.')) return
    await fetch(`/api/keywords?id=${id}`, { method: 'DELETE' })
    setKeywords(prev => prev.filter(k => k.id !== id))
    setColorUnlocks(prev => prev.filter(u => u.keywordId !== id))
  }

  async function addRule(kw: Keyword) {
    const layer = layers.find(l => l.collectionId === kw.collectionId && isRecolorable(l.layerKey, assets))
    if (!layer) {
      alert('Esta colección no tiene ninguna capa recoloreable (necesita al menos un asset SVG con colores detectados).')
      return
    }
    const res = await fetch('/api/color-unlocks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        collection_id: kw.collectionId,
        keyword_id: kw.id,
        target_layer_key: layer?.layerKey ?? 'shirt',
        target_role: 'skin',
        mode: 'wheel',
        swatches: null,
      }),
    })
    const data = await res.json()
    if (!res.ok || data.error) {
      alert(`No se pudo crear la regla: ${data.error ?? `HTTP ${res.status}`}\n\n¿Se aplicó la migración 010_color_unlocks.sql en Supabase?`)
      return
    }
    setColorUnlocks(prev => [...prev, {
      id: data.id, collectionId: data.collection_id, keywordId: data.keyword_id, scopeAssetId: data.scope_asset_id,
      targetLayerKey: data.target_layer_key, targetAssetId: data.target_asset_id ?? null, targetRole: data.target_role,
      mode: data.mode, swatches: data.swatches,
    }])
  }

  async function updateRule(id: string, patch: Record<string, unknown>) {
    setColorUnlocks(prev => prev.map(u => u.id === id ? {
      ...u,
      ...(patch.target_layer_key !== undefined ? { targetLayerKey: patch.target_layer_key as string } : {}),
      ...(patch.target_role !== undefined ? { targetRole: patch.target_role as string } : {}),
      ...(patch.mode !== undefined ? { mode: patch.mode as 'wheel' | 'swatches' } : {}),
      ...(patch.swatches !== undefined ? { swatches: patch.swatches as string[] } : {}),
    } : u))
    const res = await fetch('/api/color-unlocks', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, ...patch }),
    })
    if (!res.ok) {
      const d = await res.json().catch(() => ({} as { error?: string }))
      alert(`No se pudo guardar el cambio: ${d.error ?? `HTTP ${res.status}`}`)
    }
  }

  async function deleteRule(id: string) {
    setColorUnlocks(prev => prev.filter(u => u.id !== id))
    await fetch(`/api/color-unlocks?id=${id}`, { method: 'DELETE' })
  }

  const cardS = { background: '#111120', border: '1px solid rgba(255,255,255,0.07)' }

  return (
    <div className="space-y-6">

      {/* Create form */}
      <div className="rounded-2xl p-5" style={cardS}>
        <p className="text-xs font-semibold text-white mb-4">Nueva keyword</p>
        <form onSubmit={handleCreate} className="space-y-3">
          {collections.length > 1 && (
            <select
              value={collectionId}
              onChange={e => setCollId(e.target.value)}
              className={inputC}
              style={inputS}
            >
              {collections.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          )}

          <div className="grid grid-cols-3 gap-3">
            <input
              placeholder="CLAVE (ej: DALI26)"
              value={form.keyword}
              onChange={e => setForm(f => ({ ...f, keyword: e.target.value.toUpperCase() }))}
              className={inputC}
              style={inputS}
              required
            />
            <input
              placeholder="Label visible"
              value={form.label}
              onChange={e => setForm(f => ({ ...f, label: e.target.value }))}
              className={inputC}
              style={inputS}
              required
            />
            <input
              placeholder="Pista (opcional)"
              value={form.hint}
              onChange={e => setForm(f => ({ ...f, hint: e.target.value }))}
              className={inputC}
              style={inputS}
            />
          </div>

          <button
            type="submit"
            disabled={saving}
            className="text-xs font-semibold px-4 py-2 rounded-xl disabled:opacity-50 transition-all"
            style={{ background: 'rgba(124,58,237,0.85)', color: 'white' }}
          >
            {saving ? 'Guardando…' : '+ Crear keyword'}
          </button>
        </form>
      </div>

      {/* List */}
      <div className="rounded-2xl overflow-hidden" style={cardS}>
        {keywords.length === 0 ? (
          <p className="p-5 text-sm" style={{ color: 'rgba(255,255,255,0.25)' }}>No hay keywords.</p>
        ) : (
          <div className="divide-y" style={{ borderColor: 'rgba(255,255,255,0.05)' }}>
            {keywords.map(kw => {
              const rules = colorUnlocks.filter(u => u.keywordId === kw.id)
              const rulesOpen = rulesOpenFor === kw.id
              const kwLayers = layers.filter(l => l.collectionId === kw.collectionId && isRecolorable(l.layerKey, assets))
              return (
                <div key={kw.id}>
                  <div className="flex items-center gap-4 px-5 py-3">
                    <span className="font-mono text-xs w-28 shrink-0" style={{ color: kw.isMaster ? '#facc15' : '#a78bfa' }}>
                      {kw.isMaster ? '★ ' : ''}{kw.keyword}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-white truncate">{kw.label}</p>
                      {kw.hint && <p className="text-[10px] mt-0.5 truncate" style={{ color: 'rgba(255,255,255,0.3)' }}>{kw.hint}</p>}
                    </div>

                    <button
                      onClick={() => setRulesOpenFor(rulesOpen ? null : kw.id)}
                      className="text-[9px] font-semibold px-2.5 py-1 rounded-lg shrink-0 transition-all"
                      style={{
                        background: rulesOpen || rules.length > 0 ? 'rgba(124,58,237,0.25)' : 'rgba(255,255,255,0.06)',
                        color: rulesOpen || rules.length > 0 ? '#c4b5fd' : 'rgba(255,255,255,0.4)',
                      }}
                    >
                      🎨 Color{rules.length > 0 ? ` (${rules.length})` : ''}
                    </button>

                    <button
                      onClick={() => toggleMaster(kw)}
                      title={kw.isMaster ? 'Quitar master' : 'Hacer master — desbloquea todo'}
                      className="w-6 h-6 rounded-lg flex items-center justify-center text-[10px] transition-all shrink-0"
                      style={{ background: kw.isMaster ? 'rgba(250,204,21,0.2)' : 'rgba(255,255,255,0.05)', color: kw.isMaster ? '#facc15' : 'rgba(255,255,255,0.25)' }}
                    >
                      ★
                    </button>

                    {/* Active toggle */}
                    <button
                      onClick={() => toggleActive(kw)}
                      className="w-8 h-5 rounded-full relative transition-all shrink-0"
                      style={{ background: kw.active ? 'rgba(124,58,237,0.8)' : 'rgba(255,255,255,0.1)' }}
                      title={kw.active ? 'Desactivar' : 'Activar'}
                    >
                      <span
                        className="absolute top-0.5 w-4 h-4 rounded-full transition-all"
                        style={{ background: 'white', left: kw.active ? '14px' : '2px' }}
                      />
                    </button>

                    <span
                      className="text-[9px] px-2 py-0.5 rounded-full shrink-0"
                      style={{
                        background: kw.active ? 'rgba(16,185,129,0.15)' : 'rgba(255,255,255,0.06)',
                        color: kw.active ? '#6ee7b7' : 'rgba(255,255,255,0.3)',
                      }}
                    >
                      {kw.active ? 'activa' : 'inactiva'}
                    </span>

                    <button
                      onClick={() => handleDelete(kw.id)}
                      className="text-[11px] shrink-0 transition-colors"
                      style={{ color: 'rgba(255,255,255,0.2)' }}
                      onMouseEnter={e => (e.currentTarget.style.color = 'rgba(239,68,68,0.8)')}
                      onMouseLeave={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.2)')}
                    >
                      🗑
                    </button>
                  </div>

                  {/* Reglas de color de esta keyword */}
                  {rulesOpen && (
                    <div className="px-5 pb-4 space-y-2.5" style={{ background: 'rgba(124,58,237,0.04)' }}>
                      {rules.map(rule => (
                        <ColorRuleRow
                          key={rule.id}
                          rule={rule}
                          layers={kwLayers}
                          onChange={patch => updateRule(rule.id, patch)}
                          onDelete={() => deleteRule(rule.id)}
                        />
                      ))}
                      <button
                        onClick={() => addRule(kw)}
                        className="text-[10px] font-semibold px-3 py-1.5 rounded-lg transition-all"
                        style={{ background: 'rgba(124,58,237,0.2)', color: '#c4b5fd' }}
                      >
                        + Agregar regla de color
                      </button>
                      <p className="text-[9px]" style={{ color: 'rgba(255,255,255,0.25)' }}>
                        Al desbloquear <strong>{kw.keyword}</strong>, el usuario podrá recolorear la región elegida del asset activo en la capa indicada.
                      </p>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Info */}
      <div className="rounded-xl p-4" style={{ background: 'rgba(250,204,21,0.06)', border: '1px solid rgba(250,204,21,0.15)' }}>
        <p className="text-[10px] font-semibold" style={{ color: '#facc15' }}>★ Keyword master</p>
        <p className="text-[10px] mt-1" style={{ color: 'rgba(255,255,255,0.4)' }}>
          Una keyword marcada con ★ desbloquea automáticamente todos los assets restringidos y todas las reglas de color de la colección — es la palabra clave universal. Varias palabras clave normales pueden acumularse: cada usuario conserva lo que va descubriendo.
        </p>
      </div>
      <div className="rounded-xl p-4" style={{ background: 'rgba(124,58,237,0.08)', border: '1px solid rgba(124,58,237,0.2)' }}>
        <p className="text-[10px] font-semibold" style={{ color: '#c4b5fd' }}>Reglas de color por asset</p>
        <p className="text-[10px] mt-1" style={{ color: 'rgba(255,255,255,0.4)' }}>
          Para casos donde un asset específico (ej. una chaqueta abierta) desbloquea el color de OTRA capa (la camiseta que se ve debajo) sin necesitar una palabra clave propia, configúralo desde el editor de ese asset en el Studio (⚙ Editar).
        </p>
      </div>
    </div>
  )
}

// ── Fila de edición de una regla de color ──────────────────
function ColorRuleRow({ rule, layers, onChange, onDelete }: {
  rule:     ColorUnlock
  layers:   Layer[]
  onChange: (patch: Record<string, unknown>) => void
  onDelete: () => void
}) {
  const swatches = rule.swatches ?? ['#ffffff', '#000000', '#ff0000']

  function setSwatch(i: number, hex: string) {
    const next = [...swatches]
    next[i] = hex
    onChange({ swatches: next })
  }

  function addSwatch() {
    onChange({ swatches: [...swatches, '#ffffff'] })
  }

  function removeSwatch(i: number) {
    onChange({ swatches: swatches.filter((_, idx) => idx !== i) })
  }

  return (
    <div className="p-3 rounded-xl space-y-2" style={{ background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.06)' }}>
      <div className="flex items-center gap-2">
        <select
          value={rule.targetLayerKey}
          onChange={e => onChange({ target_layer_key: e.target.value })}
          className="flex-1 text-[10px] rounded-lg px-2 py-1.5 border focus:outline-none"
          style={inputS}
        >
          {layers.map(l => <option key={l.id} value={l.layerKey}>{l.labelEs}</option>)}
        </select>
        <select
          value={rule.targetRole}
          onChange={e => onChange({ target_role: e.target.value })}
          className="flex-1 text-[10px] rounded-lg px-2 py-1.5 border focus:outline-none"
          style={inputS}
        >
          {ROLE_OPTIONS.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
        </select>
        <button onClick={onDelete} className="text-[10px] shrink-0" style={{ color: 'rgba(255,255,255,0.25)' }}>✕</button>
      </div>

      <div className="flex items-center gap-1.5">
        {(['wheel', 'swatches'] as const).map(m => (
          <button
            key={m}
            onClick={() => onChange({ mode: m })}
            className="text-[9px] font-semibold px-2.5 py-1 rounded-lg transition-all"
            style={{
              background: rule.mode === m ? 'rgba(124,58,237,0.6)' : 'rgba(255,255,255,0.05)',
              color: rule.mode === m ? 'white' : 'rgba(255,255,255,0.35)',
            }}
          >
            {m === 'wheel' ? '🎡 Rueda libre' : '🎨 Colores fijos'}
          </button>
        ))}
      </div>

      {rule.mode === 'swatches' && (
        <div className="flex flex-wrap items-center gap-2 pt-1">
          {swatches.map((hex, i) => (
            <div key={i} className="relative">
              <input
                type="color"
                value={hex}
                onChange={e => setSwatch(i, e.target.value)}
                className="w-7 h-7 rounded-lg cursor-pointer border-0"
              />
              {swatches.length > 1 && (
                <button
                  onClick={() => removeSwatch(i)}
                  className="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full text-[8px] flex items-center justify-center"
                  style={{ background: 'rgba(239,68,68,0.8)', color: 'white' }}
                >
                  ✕
                </button>
              )}
            </div>
          ))}
          <button
            onClick={addSwatch}
            className="w-7 h-7 rounded-lg flex items-center justify-center text-xs"
            style={{ background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.4)' }}
          >
            +
          </button>
        </div>
      )}
    </div>
  )
}
