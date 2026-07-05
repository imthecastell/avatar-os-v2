'use client'

import { useState } from 'react'
import type { Collection, ColorPalette, ColorSwatch } from '@/types'

interface Props {
  collections: Collection[]
  palettes:    ColorPalette[]
}

const PALETTE_ORDER: ColorPalette['paletteKey'][] = ['skin', 'hair', 'clothing', 'accessories']

const inputC = 'text-xs rounded-xl px-3 py-2.5 border focus:outline-none transition-colors focus:border-violet-500'
const inputS = { background: 'rgba(255,255,255,0.05)', borderColor: 'rgba(255,255,255,0.1)', color: 'white' }

export default function ColorPalettesPanel({ collections, palettes: initial }: Props) {
  const [collectionId, setCollectionId] = useState(collections[0]?.id ?? '')
  const [palettes, setPalettes] = useState(initial)
  const [seeding, setSeeding] = useState(false)

  const collPalettes = palettes.filter(p => p.collectionId === collectionId)
  const missing = PALETTE_ORDER.filter(key => !collPalettes.some(p => p.paletteKey === key))

  async function seedDefaults() {
    setSeeding(true)
    const res = await fetch('/api/color-palettes/seed', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ collectionId }),
    })
    setSeeding(false)
    if (!res.ok) { alert('No se pudo crear las paletas por defecto'); return }
    const fresh = await fetch(`/api/color-palettes?collectionId=${collectionId}`).then(r => r.json())
    setPalettes(prev => [...prev.filter(p => p.collectionId !== collectionId), ...fresh.map((r: Record<string, unknown>) => ({
      id: r.id, collectionId: r.collection_id, paletteKey: r.palette_key,
      labelEs: r.label_es, labelEn: r.label_en, swatches: r.swatches ?? [],
    }))])
  }

  return (
    <div className="space-y-6">
      {collections.length > 1 && (
        <select value={collectionId} onChange={e => setCollectionId(e.target.value)} className={`w-full ${inputC}`} style={inputS}>
          {collections.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      )}

      {missing.length > 0 && (
        <div className="rounded-xl p-4 flex items-center justify-between gap-3" style={{ background: 'rgba(124,58,237,0.08)', border: '1px solid rgba(124,58,237,0.2)' }}>
          <p className="text-[11px]" style={{ color: 'rgba(255,255,255,0.6)' }}>
            Faltan {missing.length} paleta(s) por defecto en esta colección ({missing.join(', ')}).
          </p>
          <button
            onClick={seedDefaults}
            disabled={seeding}
            className="text-[10px] font-semibold px-3 py-2 rounded-xl disabled:opacity-50 shrink-0"
            style={{ background: 'rgba(124,58,237,0.85)', color: 'white' }}
          >
            {seeding ? 'Creando…' : '+ Crear paletas por defecto'}
          </button>
        </div>
      )}

      {PALETTE_ORDER.filter(key => collPalettes.some(p => p.paletteKey === key)).map(key => {
        const palette = collPalettes.find(p => p.paletteKey === key)!
        return (
          <PaletteCard
            key={palette.id}
            palette={palette}
            onSaved={updated => setPalettes(prev => prev.map(p => p.id === updated.id ? updated : p))}
          />
        )
      })}
    </div>
  )
}

function PaletteCard({ palette, onSaved }: { palette: ColorPalette; onSaved: (p: ColorPalette) => void }) {
  const [swatches, setSwatches] = useState<ColorSwatch[]>(palette.swatches)
  const [saving, setSaving] = useState(false)
  const dirty = JSON.stringify(swatches) !== JSON.stringify(palette.swatches)

  function updateHex(i: number, hex: string) {
    setSwatches(sw => sw.map((s, idx) => idx === i ? { ...s, hex } : s))
  }
  function toggleFantasy(i: number) {
    setSwatches(sw => sw.map((s, idx) => idx === i ? { ...s, fantasy: !s.fantasy } : s))
  }
  function remove(i: number) {
    setSwatches(sw => sw.filter((_, idx) => idx !== i))
  }
  function add() {
    setSwatches(sw => [...sw, { hex: '#ffffff', fantasy: false }])
  }

  async function save() {
    setSaving(true)
    const res = await fetch('/api/color-palettes', {
      method:  'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ id: palette.id, swatches }),
    })
    setSaving(false)
    if (!res.ok) { alert('No se pudo guardar la paleta'); return }
    const data = await res.json()
    onSaved({ ...palette, swatches: data.swatches ?? swatches })
  }

  return (
    <div className="rounded-2xl overflow-hidden" style={{ background: '#111120', border: '1px solid rgba(255,255,255,0.07)' }}>
      <div className="px-5 py-4 border-b flex items-center justify-between" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
        <div>
          <p className="text-xs font-semibold text-white">{palette.labelEs}</p>
          <p className="text-[9px] mt-0.5 font-mono" style={{ color: 'rgba(255,255,255,0.25)' }}>{palette.paletteKey}</p>
        </div>
        <button
          onClick={save}
          disabled={saving || !dirty}
          className="text-[10px] font-semibold px-3 py-2 rounded-xl disabled:opacity-40 transition-all shrink-0"
          style={{ background: 'rgba(124,58,237,0.85)', color: 'white' }}
        >
          {saving ? 'Guardando…' : 'Guardar cambios'}
        </button>
      </div>

      <div className="px-5 py-4 flex flex-wrap items-center gap-3">
        {swatches.map((s, i) => (
          <div key={i} className="relative flex flex-col items-center gap-1">
            <input
              type="color"
              value={s.hex}
              onChange={e => updateHex(i, e.target.value)}
              className="w-10 h-10 rounded-xl cursor-pointer border-0"
              style={{ outline: s.fantasy ? '1px dashed rgba(255,255,255,0.35)' : 'none', outlineOffset: 2 }}
            />
            <button
              onClick={() => remove(i)}
              className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full text-[9px] flex items-center justify-center"
              style={{ background: 'rgba(239,68,68,0.85)', color: 'white' }}
              title="Quitar color"
            >✕</button>
            <button
              onClick={() => toggleFantasy(i)}
              className="text-[8px] px-1.5 py-0.5 rounded-full transition-all"
              style={{
                background: s.fantasy ? 'rgba(167,139,250,0.25)' : 'rgba(255,255,255,0.05)',
                color: s.fantasy ? '#a78bfa' : 'rgba(255,255,255,0.25)',
              }}
              title="Marcar/desmarcar como color de fantasía (borde punteado + ✦ en el builder)"
            >
              {s.fantasy ? '✦ fantasía' : 'natural'}
            </button>
          </div>
        ))}
        <button
          onClick={add}
          className="w-10 h-10 rounded-xl flex items-center justify-center text-sm shrink-0"
          style={{ background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.4)' }}
          title="Agregar color a esta paleta"
        >+</button>
      </div>
    </div>
  )
}
