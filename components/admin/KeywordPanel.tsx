'use client'

import { useState } from 'react'
import type { Keyword, Collection } from '@/types'

interface Props {
  collections: Collection[]
  keywords:    Keyword[]
}

const inputC = 'w-full text-xs rounded-xl px-3 py-2.5 border focus:outline-none transition-colors focus:border-violet-500'
const inputS = { background: 'rgba(255,255,255,0.05)', borderColor: 'rgba(255,255,255,0.1)', color: 'white' }

export default function KeywordPanel({ collections, keywords: initial }: Props) {
  const [keywords, setKeywords]   = useState(initial)
  const [collectionId, setCollId] = useState(collections[0]?.id ?? '')
  const [form, setForm]           = useState({ keyword: '', label: '', hint: '' })
  const [saving, setSaving]       = useState(false)

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
      setKeywords(prev => [{ ...data, active: data.active ?? true }, ...prev])
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

  async function handleDelete(id: string) {
    if (!confirm('¿Eliminar esta keyword?')) return
    await fetch(`/api/keywords?id=${id}`, { method: 'DELETE' })
    setKeywords(prev => prev.filter(k => k.id !== id))
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
            {keywords.map(kw => (
              <div key={kw.id} className="flex items-center gap-4 px-5 py-3">
                <span className="font-mono text-xs w-28 shrink-0" style={{ color: '#a78bfa' }}>{kw.keyword}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-white truncate">{kw.label}</p>
                  {kw.hint && <p className="text-[10px] mt-0.5 truncate" style={{ color: 'rgba(255,255,255,0.3)' }}>{kw.hint}</p>}
                </div>

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
            ))}
          </div>
        )}
      </div>

      {/* XTRA hint */}
      <div className="rounded-xl p-4" style={{ background: 'rgba(124,58,237,0.08)', border: '1px solid rgba(124,58,237,0.2)' }}>
        <p className="text-[10px] font-semibold" style={{ color: '#c4b5fd' }}>Keyword especial: XTRA</p>
        <p className="text-[10px] mt-1" style={{ color: 'rgba(255,255,255,0.4)' }}>
          Cualquier keyword cuyo código o label contenga "xtra" activa la edición de colores extra
          (camiseta, accesorios, máscara) en el builder del usuario.
        </p>
      </div>
    </div>
  )
}
