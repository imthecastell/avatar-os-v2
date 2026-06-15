'use client'

import { useState } from 'react'
import type { Keyword, Collection } from '@/types'

interface Props {
  collections: Collection[]
  keywords: Keyword[]
}

export default function KeywordPanel({ collections, keywords: initial }: Props) {
  const [keywords, setKeywords] = useState(initial)
  const [collectionId, setCollectionId] = useState(collections[0]?.id || '')
  const [form, setForm] = useState({ keyword: '', label: '', hint: '' })
  const [saving, setSaving] = useState(false)

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    const res = await fetch('/api/keywords', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...form, collection_id: collectionId }),
    })
    const data = await res.json()
    if (!data.error) {
      setKeywords(prev => [data, ...prev])
      setForm({ keyword: '', label: '', hint: '' })
    }
    setSaving(false)
  }

  async function handleDelete(id: string) {
    await fetch(`/api/keywords?id=${id}`, { method: 'DELETE' })
    setKeywords(prev => prev.filter(k => k.id !== id))
  }

  return (
    <div className="space-y-6">
      {/* Create form */}
      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
        <h2 className="text-sm font-medium text-white mb-4">Nueva keyword</h2>
        <form onSubmit={handleCreate} className="grid grid-cols-3 gap-3">
          {collections.length > 1 && (
            <div className="col-span-3">
              <select
                value={collectionId}
                onChange={e => setCollectionId(e.target.value)}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white"
              >
                {collections.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
          )}
          <input
            placeholder="CLAVE (ej: DALI26)"
            value={form.keyword}
            onChange={e => setForm(f => ({ ...f, keyword: e.target.value.toUpperCase() }))}
            className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white"
            required
          />
          <input
            placeholder="Label visible"
            value={form.label}
            onChange={e => setForm(f => ({ ...f, label: e.target.value }))}
            className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white"
            required
          />
          <input
            placeholder="Pista (opcional)"
            value={form.hint}
            onChange={e => setForm(f => ({ ...f, hint: e.target.value }))}
            className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white"
          />
          <div className="col-span-3">
            <button
              type="submit"
              disabled={saving}
              className="bg-violet-600 hover:bg-violet-500 text-white text-sm px-4 py-2 rounded-lg disabled:opacity-50"
            >
              {saving ? 'Guardando...' : 'Crear keyword'}
            </button>
          </div>
        </form>
      </div>

      {/* Keywords list */}
      <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
        {keywords.length === 0 ? (
          <p className="p-5 text-sm text-gray-600">No hay keywords.</p>
        ) : (
          <div className="divide-y divide-gray-800">
            {keywords.map(kw => (
              <div key={kw.id} className="flex items-center gap-4 px-4 py-3">
                <span className="font-mono text-sm text-violet-400 w-28">{kw.keyword}</span>
                <span className="text-sm text-gray-300 flex-1">{kw.label}</span>
                {kw.hint && <span className="text-xs text-gray-500">{kw.hint}</span>}
                <span className={`text-xs px-2 py-0.5 rounded-full ${kw.active ? 'bg-green-900/50 text-green-400' : 'bg-gray-800 text-gray-500'}`}>
                  {kw.active ? 'activa' : 'inactiva'}
                </span>
                <button
                  onClick={() => handleDelete(kw.id)}
                  className="text-gray-600 hover:text-red-400 text-sm transition-colors"
                >
                  🗑
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
