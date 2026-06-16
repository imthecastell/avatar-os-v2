'use client'

import { useState } from 'react'
import type { LayerDefault, Collection } from '@/types'

interface Props {
  collections: Collection[]
  defaults:    LayerDefault[]
}

const TOKENS = [
  { id: 'skin-color', label: 'Tono de piel', emoji: '🧑', example: '#C68642' },
  { id: 'hair-color', label: 'Color de cabello', emoji: '💇', example: '#3B2314' },
]

const inputC = 'text-xs rounded-xl px-3 py-2.5 border focus:outline-none transition-colors focus:border-violet-500'
const inputS = { background: 'rgba(255,255,255,0.05)', borderColor: 'rgba(255,255,255,0.1)', color: 'white' }

export default function LayerDefaultsPanel({ collections, defaults: initial }: Props) {
  const [collectionId, setCollId] = useState(collections[0]?.id ?? '')
  const [defaults, setDefaults]   = useState(initial)
  const [saving, setSaving]       = useState<string | null>(null)

  const collDefaults = defaults.filter(d => d.collectionId === collectionId)

  function getDefault(tokenId: string): LayerDefault | undefined {
    return collDefaults.find(d => d.tokenId === tokenId)
  }

  async function handleSave(tokenId: string, hex: string, name: string) {
    setSaving(tokenId)
    const res = await fetch('/api/layer-defaults', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        collection_id: collectionId,
        token_id:      tokenId,
        default_hex:   hex,
        default_name:  name || null,
      }),
    })
    const data = await res.json()
    if (!data.error) {
      setDefaults(prev => {
        const without = prev.filter(d => !(d.collectionId === collectionId && d.tokenId === tokenId))
        return [...without, {
          id:           data.id,
          collectionId: data.collection_id,
          layerKey:     data.layer_key ?? '',
          tokenId:      data.token_id,
          defaultHex:   data.default_hex,
          defaultName:  data.default_name,
        }]
      })
    }
    setSaving(null)
  }

  const cardS = { background: '#111120', border: '1px solid rgba(255,255,255,0.07)' }

  return (
    <div className="space-y-6">
      {collections.length > 1 && (
        <select value={collectionId} onChange={e => setCollId(e.target.value)} className={`w-full ${inputC}`} style={inputS}>
          {collections.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      )}

      <div className="rounded-2xl overflow-hidden" style={cardS}>
        <div className="px-5 py-4 border-b" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
          <p className="text-xs font-semibold text-white">Colores por defecto</p>
          <p className="text-[10px] mt-0.5" style={{ color: 'rgba(255,255,255,0.3)' }}>
            Estos valores se usan cuando el usuario abre el builder por primera vez.
          </p>
        </div>

        <div className="divide-y" style={{ borderColor: 'rgba(255,255,255,0.05)' }}>
          {TOKENS.map(token => {
            const current = getDefault(token.id)
            return (
              <TokenRow
                key={token.id}
                token={token}
                current={current}
                saving={saving === token.id}
                onSave={handleSave}
              />
            )
          })}
        </div>
      </div>

      <div className="rounded-xl p-4" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
        <p className="text-[10px]" style={{ color: 'rgba(255,255,255,0.3)' }}>
          Los valores aquí configurados son los que el builder del usuario mostrará al cargar por primera vez.
          Si no se definen, el builder usa los colores internos por defecto (piel media, cabello oscuro).
        </p>
      </div>
    </div>
  )
}

function TokenRow({
  token, current, saving, onSave,
}: {
  token:   { id: string; label: string; emoji: string; example: string }
  current: LayerDefault | undefined
  saving:  boolean
  onSave:  (tokenId: string, hex: string, name: string) => void
}) {
  const [hex,  setHex]  = useState(current?.defaultHex  ?? token.example)
  const [name, setName] = useState(current?.defaultName ?? '')

  return (
    <div className="flex items-center gap-4 px-5 py-4">
      <span className="text-xl shrink-0">{token.emoji}</span>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium text-white">{token.label}</p>
        <p className="text-[9px] font-mono mt-0.5" style={{ color: 'rgba(255,255,255,0.25)' }}>{token.id}</p>
      </div>

      <div className="flex items-center gap-2">
        <input
          type="color"
          value={hex}
          onChange={e => setHex(e.target.value)}
          className="w-9 h-9 rounded-xl cursor-pointer border-0 bg-transparent shrink-0"
        />
        <input
          type="text"
          value={name}
          onChange={e => setName(e.target.value)}
          placeholder="Nombre (opcional)"
          className={`w-32 ${inputC}`}
          style={{ ...inputS, fontSize: 10 }}
        />
        <button
          onClick={() => onSave(token.id, hex, name)}
          disabled={saving}
          className="text-[10px] font-semibold px-3 py-2 rounded-xl disabled:opacity-50 transition-all shrink-0"
          style={{ background: 'rgba(124,58,237,0.85)', color: 'white' }}
        >
          {saving ? '…' : 'Guardar'}
        </button>
      </div>
    </div>
  )
}
