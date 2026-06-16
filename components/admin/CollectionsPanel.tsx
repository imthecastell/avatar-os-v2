'use client'

import { useState } from 'react'
import type { Collection } from '@/types'

interface Props {
  collections: Collection[]
}

export default function CollectionsPanel({ collections: initial }: Props) {
  const [collections, setCollections] = useState(initial)
  const [creating, setCreating]       = useState(false)
  const [name, setName]               = useState('')
  const [slug, setSlug]               = useState('')
  const [number, setNumber]           = useState('1')
  const [busy, setBusy]               = useState(false)
  const [seedingId, setSeedingId]     = useState<string | null>(null)

  function autoSlug(val: string) {
    return val.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    const res  = await fetch('/api/collections', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, slug, number: parseInt(number) || 1 }),
    })
    const data = await res.json()
    if (!res.ok) { alert(data.error); setBusy(false); return }
    setCollections(c => [...c, data])
    setName(''); setSlug(''); setNumber('1'); setCreating(false); setBusy(false)
  }

  async function toggleActive(col: Collection) {
    const res  = await fetch('/api/collections', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: col.id, active: !col.active }),
    })
    const data = await res.json()
    if (!res.ok) { alert(data.error); return }
    setCollections(c => c.map(x => x.id === col.id ? data : x))
  }

  async function handleDelete(col: Collection) {
    if (!confirm(`¿Eliminar colección "${col.name}"? Se eliminarán sus capas y assets.`)) return
    const res = await fetch(`/api/collections?id=${col.id}`, { method: 'DELETE' })
    if (!res.ok) { const d = await res.json(); alert(d.error); return }
    setCollections(c => c.filter(x => x.id !== col.id))
  }

  async function seedLayers(col: Collection) {
    setSeedingId(col.id)
    const res  = await fetch('/api/layers/seed', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ collectionId: col.id }),
    })
    const data = await res.json()
    setSeedingId(null)
    if (!res.ok) { alert(data.error); return }
    alert(`✓ ${data.created} capas creadas para "${col.name}"`)
  }

  const inputCls = `
    w-full text-sm rounded-xl px-3 py-2 border focus:outline-none transition-colors
    bg-white/5 border-white/10 text-white placeholder-white/25
    focus:border-violet-500
  `

  return (
    <div className="space-y-6 max-w-3xl">

      {/* Collection list */}
      <div className="space-y-2">
        {collections.length === 0 && (
          <div className="text-center py-12 rounded-2xl border border-dashed border-white/10">
            <p className="text-3xl mb-2">📦</p>
            <p className="text-sm" style={{ color: 'rgba(255,255,255,0.35)' }}>
              Sin colecciones — crea la primera para empezar
            </p>
          </div>
        )}

        {collections.map(col => (
          <div
            key={col.id}
            className="flex items-center gap-4 px-4 py-3 rounded-2xl border transition-all"
            style={{ background: 'rgba(255,255,255,0.03)', borderColor: 'rgba(255,255,255,0.07)' }}
          >
            {/* Active dot */}
            <div
              className="w-2 h-2 rounded-full shrink-0"
              style={{ background: col.active ? '#10b981' : 'rgba(255,255,255,0.15)' }}
            />

            {/* Info */}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-white truncate">{col.name}</p>
              <p className="text-[10px] mt-0.5" style={{ color: 'rgba(255,255,255,0.3)' }}>
                /{col.slug} · #{col.number}
              </p>
            </div>

            {/* Active badge */}
            <span
              className="text-[10px] font-medium px-2 py-0.5 rounded-full shrink-0"
              style={{
                background: col.active ? 'rgba(16,185,129,0.15)' : 'rgba(255,255,255,0.06)',
                color: col.active ? '#6ee7b7' : 'rgba(255,255,255,0.3)',
              }}
            >
              {col.active ? 'Activa' : 'Inactiva'}
            </span>

            {/* Actions */}
            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={() => seedLayers(col)}
                disabled={seedingId === col.id}
                className="text-[10px] font-medium px-2.5 py-1.5 rounded-lg transition-all disabled:opacity-50"
                style={{ background: 'rgba(124,58,237,0.2)', color: '#a78bfa' }}
                title="Crear capas estándar para esta colección"
              >
                {seedingId === col.id ? 'Creando…' : '⬡ Capas'}
              </button>

              <button
                onClick={() => toggleActive(col)}
                className="text-[10px] font-medium px-2.5 py-1.5 rounded-lg transition-all"
                style={{ background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.5)' }}
              >
                {col.active ? 'Desactivar' : 'Activar'}
              </button>

              <button
                onClick={() => handleDelete(col)}
                className="text-[10px] font-medium px-2.5 py-1.5 rounded-lg transition-all"
                style={{ background: 'rgba(127,29,29,0.3)', color: 'rgba(252,165,165,0.8)' }}
              >
                Eliminar
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Create form */}
      {creating ? (
        <form
          onSubmit={handleCreate}
          className="p-5 rounded-2xl border space-y-4"
          style={{ background: 'rgba(255,255,255,0.03)', borderColor: 'rgba(255,255,255,0.08)' }}
        >
          <p className="text-sm font-semibold text-white">Nueva colección</p>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] font-medium mb-1 block" style={{ color: 'rgba(255,255,255,0.4)' }}>Nombre</label>
              <input
                className={inputCls}
                placeholder="Colección 01"
                value={name}
                onChange={e => { setName(e.target.value); setSlug(autoSlug(e.target.value)) }}
                required
              />
            </div>
            <div>
              <label className="text-[10px] font-medium mb-1 block" style={{ color: 'rgba(255,255,255,0.4)' }}>Slug</label>
              <input
                className={inputCls}
                placeholder="coleccion-01"
                value={slug}
                onChange={e => setSlug(autoSlug(e.target.value))}
                required
              />
            </div>
          </div>

          <div className="w-28">
            <label className="text-[10px] font-medium mb-1 block" style={{ color: 'rgba(255,255,255,0.4)' }}>Número</label>
            <input
              type="number"
              min={1}
              className={inputCls}
              value={number}
              onChange={e => setNumber(e.target.value)}
            />
          </div>

          <div className="flex gap-2 pt-1">
            <button
              type="submit"
              disabled={busy}
              className="text-sm font-semibold px-5 py-2 rounded-xl transition-all disabled:opacity-50"
              style={{ background: 'rgba(124,58,237,0.85)', color: 'white' }}
            >
              {busy ? 'Creando…' : 'Crear colección'}
            </button>
            <button
              type="button"
              onClick={() => { setCreating(false); setName(''); setSlug('') }}
              className="text-sm px-4 py-2 rounded-xl transition-all"
              style={{ background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.5)' }}
            >
              Cancelar
            </button>
          </div>
        </form>
      ) : (
        <button
          onClick={() => setCreating(true)}
          className="flex items-center gap-2 text-sm font-medium px-4 py-2.5 rounded-xl transition-all"
          style={{ background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.6)' }}
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
          </svg>
          Nueva colección
        </button>
      )}

      {/* SQL shortcut info */}
      <details className="group">
        <summary
          className="text-[10px] cursor-pointer select-none"
          style={{ color: 'rgba(255,255,255,0.2)' }}
        >
          ▶ También puedes usar SQL directamente en Supabase
        </summary>
        <pre
          className="mt-3 p-4 rounded-xl text-[10px] overflow-x-auto leading-relaxed"
          style={{ background: 'rgba(0,0,0,0.4)', color: 'rgba(255,255,255,0.4)', border: '1px solid rgba(255,255,255,0.05)' }}
        >{`-- Primero: agrega columna svg_editable si no existe
ALTER TABLE assets ADD COLUMN IF NOT EXISTS svg_editable BOOLEAN DEFAULT true;

-- Luego: inserta tu colección
INSERT INTO collections (slug, name, number, active)
VALUES ('coleccion-01', 'Colección 01', 1, true);

-- Copia el UUID generado y úsalo en "⬡ Capas" desde el panel,
-- o haz clic en "⬡ Capas" desde esta UI para crear las capas estándar.`}
        </pre>
      </details>
    </div>
  )
}
