'use client'

import { useState } from 'react'
import type { LayerException, Layer, Collection } from '@/types'

interface Props {
  collections: Collection[]
  layers:      Layer[]
  exceptions:  LayerException[]
}

const LAYER_KEYS = [
  'background','emotion','hair-back','head','shirt','hair-front','acc-front','mask','effect-final','frame',
]

const LAYER_EMOJI: Record<string, string> = {
  'background':   '🌅',
  'emotion':      '😄',
  'hair-back':    '💇',
  'head':         '🧑',
  'shirt':        '👕',
  'hair-front':   '✂️',
  'acc-front':    '🎩',
  'mask':         '😷',
  'effect-final': '✨',
  'frame':        '🖼️',
}

const inputC = 'w-full text-xs rounded-xl px-3 py-2.5 border focus:outline-none transition-colors focus:border-violet-500'
const inputS = { background: 'rgba(255,255,255,0.05)', borderColor: 'rgba(255,255,255,0.1)', color: 'white' }
const selectS = { ...inputS, backgroundImage: 'none' }

export default function LayerExceptionsPanel({ collections, layers, exceptions: initial }: Props) {
  const [exceptions, setExceptions] = useState(initial)
  const [collectionId, setCollId]   = useState(collections[0]?.id ?? '')
  const [saving, setSaving]         = useState(false)
  const [form, setForm] = useState({
    trigger_layer:         LAYER_KEYS[0],
    trigger_asset_pattern: '*',
    affected_layer:        LAYER_KEYS[1],
    action:                'hide' as 'hide' | 'show_only',
    condition:             '',
    note:                  '',
  })

  const collLayers  = layers.filter(l => l.collectionId === collectionId)
  const layerKeys   = collLayers.length ? collLayers.map(l => l.layerKey) : LAYER_KEYS
  const collExceptions = exceptions.filter(e => e.collectionId === collectionId)

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    const res  = await fetch('/api/layer-exceptions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...form, collection_id: collectionId }),
    })
    const data = await res.json()
    if (!data.error) {
      setExceptions(prev => [...prev, {
        id:                  data.id,
        collectionId:        data.collection_id,
        triggerLayer:        data.trigger_layer,
        triggerAssetPattern: data.trigger_asset_pattern,
        affectedLayer:       data.affected_layer,
        action:              data.action,
        condition:           data.condition ?? '',
        note:                data.note ?? '',
      }])
    }
    setSaving(false)
  }

  async function handleDelete(id: string) {
    await fetch(`/api/layer-exceptions?id=${id}`, { method: 'DELETE' })
    setExceptions(prev => prev.filter(ex => ex.id !== id))
  }

  const cardS = { background: '#111120', border: '1px solid rgba(255,255,255,0.07)' }

  return (
    <div className="space-y-6">

      {/* Collection picker */}
      {collections.length > 1 && (
        <select value={collectionId} onChange={e => setCollId(e.target.value)} className={inputC} style={inputS}>
          {collections.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      )}

      {/* Create form */}
      <div className="rounded-2xl p-5" style={cardS}>
        <p className="text-xs font-semibold text-white mb-1">Nueva excepción</p>
        <p className="text-[10px] mb-4" style={{ color: 'rgba(255,255,255,0.3)' }}>
          Define qué ocurre con una capa cuando el usuario selecciona algo en otra capa.
        </p>
        <form onSubmit={handleCreate} className="space-y-3">

          <div className="grid grid-cols-2 gap-3">
            {/* Trigger layer */}
            <div>
              <p className="text-[9px] font-semibold uppercase tracking-widest mb-1.5" style={{ color: 'rgba(255,255,255,0.3)' }}>Capa disparadora</p>
              <select
                value={form.trigger_layer}
                onChange={e => setForm(f => ({ ...f, trigger_layer: e.target.value }))}
                className={inputC}
                style={selectS}
              >
                {layerKeys.map(k => <option key={k} value={k}>{LAYER_EMOJI[k] ?? '📁'} {k}</option>)}
              </select>
            </div>

            {/* Trigger pattern */}
            <div>
              <p className="text-[9px] font-semibold uppercase tracking-widest mb-1.5" style={{ color: 'rgba(255,255,255,0.3)' }}>
                Patrón de asset <span style={{ color: 'rgba(255,255,255,0.2)' }}>(*&nbsp;=&nbsp;cualquiera)</span>
              </p>
              <input
                value={form.trigger_asset_pattern}
                onChange={e => setForm(f => ({ ...f, trigger_asset_pattern: e.target.value }))}
                placeholder="* o UUID exacto"
                className={inputC}
                style={inputS}
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            {/* Affected layer */}
            <div>
              <p className="text-[9px] font-semibold uppercase tracking-widest mb-1.5" style={{ color: 'rgba(255,255,255,0.3)' }}>Capa afectada</p>
              <select
                value={form.affected_layer}
                onChange={e => setForm(f => ({ ...f, affected_layer: e.target.value }))}
                className={inputC}
                style={selectS}
              >
                {layerKeys.filter(k => k !== form.trigger_layer).map(k => (
                  <option key={k} value={k}>{LAYER_EMOJI[k] ?? '📁'} {k}</option>
                ))}
              </select>
            </div>

            {/* Action */}
            <div>
              <p className="text-[9px] font-semibold uppercase tracking-widest mb-1.5" style={{ color: 'rgba(255,255,255,0.3)' }}>Acción</p>
              <select
                value={form.action}
                onChange={e => setForm(f => ({ ...f, action: e.target.value as 'hide' | 'show_only' }))}
                className={inputC}
                style={selectS}
              >
                <option value="hide">hide — ocultar la capa</option>
                <option value="show_only">show_only — mostrar solo ciertos assets</option>
              </select>
            </div>
          </div>

          <input
            value={form.note}
            onChange={e => setForm(f => ({ ...f, note: e.target.value }))}
            placeholder="Nota descriptiva (opcional, ej: 'Gorra oculta pestaña cabello')"
            className={inputC}
            style={inputS}
          />

          <button
            type="submit"
            disabled={saving}
            className="text-xs font-semibold px-4 py-2 rounded-xl disabled:opacity-50 transition-all"
            style={{ background: 'rgba(124,58,237,0.85)', color: 'white' }}
          >
            {saving ? 'Guardando…' : '+ Crear excepción'}
          </button>
        </form>
      </div>

      {/* Exceptions list */}
      <div className="rounded-2xl overflow-hidden" style={cardS}>
        {collExceptions.length === 0 ? (
          <p className="p-5 text-sm" style={{ color: 'rgba(255,255,255,0.25)' }}>
            Sin excepciones. Por defecto todas las capas son independientes.
          </p>
        ) : (
          <div className="divide-y" style={{ borderColor: 'rgba(255,255,255,0.05)' }}>
            {collExceptions.map(ex => (
              <div key={ex.id} className="flex items-start gap-3 px-5 py-3.5">
                <div className="flex-1 min-w-0">
                  {/* Rule summary */}
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-xs font-mono" style={{ color: '#a78bfa' }}>
                      {LAYER_EMOJI[ex.triggerLayer]} {ex.triggerLayer}
                    </span>
                    <span className="text-[10px]" style={{ color: 'rgba(255,255,255,0.3)' }}>+</span>
                    <span className="text-[10px] font-mono px-1.5 py-0.5 rounded-md" style={{ background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.5)' }}>
                      {ex.triggerAssetPattern}
                    </span>
                    <span className="text-[10px]" style={{ color: 'rgba(255,255,255,0.3)' }}>→</span>
                    <span
                      className="text-[10px] px-1.5 py-0.5 rounded-md font-semibold"
                      style={{
                        background: ex.action === 'hide' ? 'rgba(239,68,68,0.15)' : 'rgba(16,185,129,0.15)',
                        color: ex.action === 'hide' ? '#fca5a5' : '#6ee7b7',
                      }}
                    >
                      {ex.action}
                    </span>
                    <span className="text-xs font-mono" style={{ color: '#a78bfa' }}>
                      {LAYER_EMOJI[ex.affectedLayer]} {ex.affectedLayer}
                    </span>
                  </div>
                  {ex.note && (
                    <p className="text-[10px] mt-1" style={{ color: 'rgba(255,255,255,0.3)' }}>{ex.note}</p>
                  )}
                </div>
                <button
                  onClick={() => handleDelete(ex.id)}
                  className="text-[11px] shrink-0 mt-0.5 transition-colors"
                  style={{ color: 'rgba(255,255,255,0.2)' }}
                  onMouseEnter={e => (e.currentTarget.style.color = 'rgba(239,68,68,0.8)')}
                  onMouseLeave={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.2)')}
                >
                  🗑
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* How it works */}
      <div className="rounded-xl p-4 space-y-1.5" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
        <p className="text-[10px] font-semibold" style={{ color: 'rgba(255,255,255,0.5)' }}>Cómo funciona</p>
        <p className="text-[10px]" style={{ color: 'rgba(255,255,255,0.3)' }}>
          <strong style={{ color: 'rgba(255,255,255,0.5)' }}>hide</strong> — oculta la pestaña de la capa afectada en el builder del usuario.
        </p>
        <p className="text-[10px]" style={{ color: 'rgba(255,255,255,0.3)' }}>
          <strong style={{ color: 'rgba(255,255,255,0.5)' }}>Patrón *</strong> — se dispara con cualquier asset seleccionado en esa capa.
        </p>
        <p className="text-[10px]" style={{ color: 'rgba(255,255,255,0.3)' }}>
          <strong style={{ color: 'rgba(255,255,255,0.5)' }}>Patrón UUID</strong> — solo se dispara cuando se selecciona ese asset específico.
        </p>
        <p className="text-[10px] mt-1" style={{ color: 'rgba(255,255,255,0.2)' }}>
          Nota: el enmascaramiento visual (hat → borra cabello) se configura en el inspector de cada asset, no aquí.
        </p>
      </div>
    </div>
  )
}
