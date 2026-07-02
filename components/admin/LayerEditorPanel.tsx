'use client'

import { useState } from 'react'
import Image from 'next/image'
import type { Asset, Keyword } from '@/types'
import { thumbUrl } from '@/lib/thumb'

interface Props {
  layerId:      string
  layerKey:     string
  layerName:    string
  assets:       Asset[]
  keywords:     Keyword[]
  collectionId: string
  onBack:       () => void
  onUpdated:    () => void
}

export default function LayerEditorPanel({
  layerId, layerName, assets: initialAssets, keywords: initialKws, collectionId, onBack, onUpdated,
}: Props) {
  const [name,        setName]        = useState(layerName)
  const [localAssets, setLocalAssets] = useState<Asset[]>(initialAssets)
  const [localKws,    setLocalKws]    = useState<Keyword[]>(initialKws.filter(k => k.collectionId === collectionId))
  const [showAddKw,   setShowAddKw]   = useState(false)
  const [newKwWord,   setNewKwWord]   = useState('')
  const [newKwLabel,  setNewKwLabel]  = useState('')
  const [newKwMaster, setNewKwMaster] = useState(false)
  const [savingName,  setSavingName]  = useState(false)
  const [addingKw,    setAddingKw]    = useState(false)

  async function saveName() {
    if (!name.trim() || name === layerName) return
    setSavingName(true)
    await fetch('/api/layers', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: layerId, label_es: name.trim() }),
    })
    setSavingName(false)
    onUpdated()
  }

  async function assignKeyword(assetId: string, keywordId: string | null) {
    setLocalAssets(prev => prev.map(a => a.id === assetId ? { ...a, keywordId } : a))
    await fetch('/api/assets', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: assetId, keyword_id: keywordId }),
    })
  }

  async function createKeyword() {
    if (!newKwWord.trim()) return
    setAddingKw(true)
    const res = await fetch('/api/keywords', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        collection_id: collectionId,
        keyword:       newKwWord.trim().toUpperCase(),
        label:         newKwLabel.trim() || newKwWord.trim(),
        is_master:     newKwMaster,
        active:        true,
      }),
    })
    const kw = await res.json()
    if (!kw.error) {
      setLocalKws(prev => [...prev, {
        id: kw.id, collectionId: kw.collection_id, keyword: kw.keyword,
        label: kw.label, hint: kw.hint ?? null, active: kw.active, isMaster: kw.is_master ?? false,
      }])
      setNewKwWord(''); setNewKwLabel(''); setNewKwMaster(false); setShowAddKw(false)
    }
    setAddingKw(false)
  }

  async function toggleMaster(kw: Keyword) {
    const next = !kw.isMaster
    setLocalKws(prev => prev.map(k => k.id === kw.id ? { ...k, isMaster: next } : k))
    await fetch('/api/keywords', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: kw.id, is_master: next }),
    })
  }

  async function deleteKeyword(id: string) {
    if (!confirm('¿Eliminar esta keyword?')) return
    const affected = localAssets.filter(a => a.keywordId === id)
    await Promise.all(affected.map(a => assignKeyword(a.id, null)))
    await fetch(`/api/keywords?id=${id}`, { method: 'DELETE' })
    setLocalKws(prev => prev.filter(k => k.id !== id))
  }

  const inputS = {
    background: 'rgba(255,255,255,0.06)',
    borderColor: 'rgba(255,255,255,0.1)',
    color: 'white',
  } as const

  return (
    <>
      {/* Back */}
      <button
        onClick={onBack}
        className="flex items-center gap-1.5 px-4 py-3 text-xs border-b shrink-0 w-full text-left transition-colors"
        style={{ color: 'rgba(255,255,255,0.4)', borderColor: 'rgba(255,255,255,0.06)' }}
        onMouseEnter={e => (e.currentTarget.style.color = 'white')}
        onMouseLeave={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.4)')}
      >
        ← Vista previa
      </button>

      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-5">

        {/* Layer name */}
        <div>
          <p className="text-[9px] font-semibold uppercase tracking-widest mb-1.5" style={{ color: 'rgba(255,255,255,0.25)' }}>
            Nombre de capa
          </p>
          <div className="flex gap-2">
            <input
              value={name}
              onChange={e => setName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && saveName()}
              className="flex-1 text-xs rounded-xl px-3 py-2 border focus:outline-none focus:border-violet-500"
              style={inputS}
            />
            <button
              onClick={saveName}
              disabled={savingName || name === layerName || !name.trim()}
              className="text-xs px-3 py-1.5 rounded-xl font-semibold disabled:opacity-40 shrink-0"
              style={{ background: 'rgba(124,58,237,0.7)', color: 'white' }}
            >
              {savingName ? '…' : '✓'}
            </button>
          </div>
        </div>

        {/* Assets — keyword assignment */}
        <div>
          <p className="text-[9px] font-semibold uppercase tracking-widest mb-1.5" style={{ color: 'rgba(255,255,255,0.25)' }}>
            Assets · {localAssets.length}
          </p>
          {localAssets.length === 0 && (
            <p className="text-[10px]" style={{ color: 'rgba(255,255,255,0.2)' }}>
              Sin assets en esta capa.
            </p>
          )}
          <div className="space-y-1.5">
            {localAssets.map(asset => (
              <div
                key={asset.id}
                className="flex items-center gap-2 p-1.5 rounded-xl"
                style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)' }}
              >
                {asset.cdnUrl && (
                  <div className="w-8 h-8 rounded-lg overflow-hidden shrink-0" style={{ background: 'rgba(255,255,255,0.05)' }}>
                    <Image
                      src={thumbUrl(asset.cdnUrl, asset.fileType, 64)}
                      alt={asset.name}
                      width={32} height={32}
                      className="w-full h-full object-cover"
                      unoptimized
                    />
                  </div>
                )}
                <p className="flex-1 min-w-0 text-[10px] truncate" style={{ color: 'rgba(255,255,255,0.6)' }}>
                  {asset.name}
                </p>
                <select
                  value={asset.keywordId ?? ''}
                  onChange={e => assignKeyword(asset.id, e.target.value || null)}
                  className="text-[9px] rounded-lg border focus:outline-none shrink-0"
                  style={{ ...inputS, maxWidth: 90, padding: '3px 6px' }}
                >
                  <option value="">🔓 Libre</option>
                  {localKws.map(k => (
                    <option key={k.id} value={k.id}>
                      {k.isMaster ? '★ ' : '🔒 '}{k.keyword}
                    </option>
                  ))}
                </select>
              </div>
            ))}
          </div>
        </div>

        {/* Keywords management */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <p className="text-[9px] font-semibold uppercase tracking-widest" style={{ color: 'rgba(255,255,255,0.25)' }}>
              Keywords
            </p>
            <button
              onClick={() => setShowAddKw(v => !v)}
              className="text-[9px] font-semibold px-2 py-0.5 rounded-lg"
              style={{ background: showAddKw ? 'rgba(124,58,237,0.5)' : 'rgba(255,255,255,0.07)', color: 'white' }}
            >
              + Nueva
            </button>
          </div>

          {showAddKw && (
            <div className="mb-3 p-2.5 rounded-xl space-y-2" style={{ background: 'rgba(124,58,237,0.08)', border: '1px solid rgba(124,58,237,0.2)' }}>
              <input
                value={newKwWord}
                onChange={e => setNewKwWord(e.target.value.toUpperCase())}
                placeholder="PALABRA CLAVE"
                className="w-full text-[10px] rounded-lg px-2 py-1.5 border focus:outline-none focus:border-violet-500"
                style={inputS}
              />
              <input
                value={newKwLabel}
                onChange={e => setNewKwLabel(e.target.value)}
                placeholder="Etiqueta (opcional)"
                className="w-full text-[10px] rounded-lg px-2 py-1.5 border focus:outline-none focus:border-violet-500"
                style={inputS}
              />
              <div className="flex items-center justify-between">
                <label className="flex items-center gap-1.5 text-[10px] cursor-pointer select-none" style={{ color: 'rgba(255,255,255,0.55)' }}>
                  <input
                    type="checkbox"
                    checked={newKwMaster}
                    onChange={e => setNewKwMaster(e.target.checked)}
                  />
                  ★ Master — desbloquea todo
                </label>
                <button
                  onClick={createKeyword}
                  disabled={addingKw || !newKwWord.trim()}
                  className="text-[9px] font-semibold px-2.5 py-1 rounded-lg disabled:opacity-40"
                  style={{ background: 'rgba(124,58,237,0.8)', color: 'white' }}
                >
                  {addingKw ? '…' : 'Crear'}
                </button>
              </div>
            </div>
          )}

          {localKws.length === 0 && !showAddKw && (
            <p className="text-[10px]" style={{ color: 'rgba(255,255,255,0.2)' }}>
              Sin keywords. Crea una para restringir assets.
            </p>
          )}
          <div className="space-y-1">
            {localKws.map(kw => {
              const usedHere = localAssets.filter(a => a.keywordId === kw.id).length
              return (
                <div
                  key={kw.id}
                  className="flex items-center gap-2 p-2 rounded-xl"
                  style={{ background: 'rgba(255,255,255,0.03)', border: `1px solid ${kw.isMaster ? 'rgba(167,139,250,0.2)' : 'rgba(255,255,255,0.05)'}` }}
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-[10px] font-semibold truncate" style={{ color: kw.isMaster ? '#a78bfa' : 'white' }}>
                      {kw.keyword}
                    </p>
                    <p className="text-[9px] truncate" style={{ color: 'rgba(255,255,255,0.3)' }}>
                      {kw.label}{usedHere > 0 ? ` · ${usedHere} en esta capa` : ''}
                      {kw.isMaster ? ' · ★ master' : ''}
                    </p>
                  </div>
                  <button
                    onClick={() => toggleMaster(kw)}
                    title={kw.isMaster ? 'Quitar master' : 'Hacer master'}
                    className="w-6 h-6 rounded-lg flex items-center justify-center text-[10px] transition-all"
                    style={{ background: kw.isMaster ? 'rgba(167,139,250,0.25)' : 'rgba(255,255,255,0.05)', color: kw.isMaster ? '#a78bfa' : 'rgba(255,255,255,0.25)' }}
                  >
                    ★
                  </button>
                  <button
                    onClick={() => deleteKeyword(kw.id)}
                    className="w-6 h-6 rounded-lg flex items-center justify-center text-[10px] transition-all"
                    style={{ color: 'rgba(255,255,255,0.2)' }}
                    onMouseEnter={e => (e.currentTarget.style.color = '#fca5a5')}
                    onMouseLeave={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.2)')}
                  >
                    ✕
                  </button>
                </div>
              )
            })}
          </div>
        </div>

      </div>
    </>
  )
}
