'use client'

import { useState, useRef } from 'react'
import Image from 'next/image'
import { detectLayerFromFilename } from '@/lib/engine/asset-classifier'
import type { Collection, Layer, Keyword } from '@/types'

// ── Types ─────────────────────────────────────────────────
interface QueueItem {
  id:             number        // local key
  file:           File
  filename:       string
  detectedLayer:  string | null
  assignedLayer:  string
  status:         'pending' | 'uploading' | 'done' | 'error'
  error?:         string
  // populated after upload
  assetId?:       string
  cdnUrl?:        string
  // inline config
  keywordId:      string
  isDefault:      boolean
  suggestedColor: string
  configSaved:    boolean
  configSaving:   boolean
}

const LAYER_OPTIONS = [
  'background','emotion','hair-back','head','shirt',
  'hair-front','acc-front','mask','effect-final','frame',
]
const HAIR_LAYERS = new Set(['hair-back', 'hair-front'])

// ── Helpers ───────────────────────────────────────────────
const inputC = 'text-xs rounded-xl px-3 py-2 border focus:outline-none transition-colors focus:border-violet-500'
const inputS = { background: 'rgba(255,255,255,0.05)', borderColor: 'rgba(255,255,255,0.1)', color: 'white' }
const selectS = { ...inputS }

interface Props {
  collections: Collection[]
  layers:      Layer[]
  keywords?:   Keyword[]
  onDone?:     () => void
}

let nextId = 0

export default function BatchUploader({ collections, layers, keywords = [], onDone }: Props) {
  const [collectionId, setCollId] = useState(collections[0]?.id ?? '')
  const [queue, setQueue]         = useState<QueueItem[]>([])
  const [dragging, setDragging]   = useState(false)
  const inputRef                  = useRef<HTMLInputElement>(null)

  // ── File intake ───────────────────────────────────────
  function enqueue(files: FileList | File[]) {
    const arr   = Array.from(files)
    const valid = arr.filter(f => /\.(svg|png|jpe?g)$/i.test(f.name))

    const items: QueueItem[] = valid.map(file => {
      const detected = detectLayerFromFilename(file.name)
      return {
        id:             nextId++,
        file,
        filename:       file.name,
        detectedLayer:  detected,
        assignedLayer:  detected ?? '',
        status:         'pending',
        keywordId:      '',
        isDefault:      false,
        suggestedColor: '',
        configSaved:    false,
        configSaving:   false,
      }
    })

    setQueue(prev => {
      const updated = [...prev, ...items]
      // auto-upload items with detected layer
      items.forEach((item, i) => {
        if (item.detectedLayer) {
          const idx = prev.length + i
          setTimeout(() => uploadItem(idx, updated[idx]), 0)
        }
      })
      return updated
    })
  }

  function updateItem(id: number, patch: Partial<QueueItem>) {
    setQueue(prev => prev.map(it => it.id === id ? { ...it, ...patch } : it))
  }

  // ── Upload ────────────────────────────────────────────
  async function uploadItem(qIdx: number, item: QueueItem) {
    const layer = item.assignedLayer
    if (!layer) return

    setQueue(prev => prev.map((it, i) => i === qIdx ? { ...it, status: 'uploading' } : it))

    const fd = new FormData()
    fd.append('file', item.file)
    fd.append('layer', layer)
    if (collectionId) fd.append('collectionId', collectionId)

    try {
      const res  = await fetch('/api/assets/upload', { method: 'POST', body: fd })
      const data = await res.json()
      if (data.error) throw new Error(data.error)

      setQueue(prev => prev.map((it, i) =>
        i === qIdx
          ? { ...it, status: 'done', assetId: data.id, cdnUrl: data.cdnUrl }
          : it
      ))
    } catch (err) {
      setQueue(prev => prev.map((it, i) =>
        i === qIdx
          ? { ...it, status: 'error', error: err instanceof Error ? err.message : 'Error' }
          : it
      ))
    }
  }

  function manualUpload(id: number) {
    const idx  = queue.findIndex(it => it.id === id)
    const item = queue[idx]
    if (!item || !item.assignedLayer) return
    uploadItem(idx, item)
  }

  // ── Inline config save ────────────────────────────────
  async function saveConfig(id: number) {
    const item = queue.find(it => it.id === id)
    if (!item?.assetId) return

    updateItem(id, { configSaving: true })

    const body: Record<string, unknown> = {
      id:             item.assetId,
      keyword_id:     item.keywordId || null,
      is_default:     item.isDefault,
      suggested_color: item.suggestedColor || null,
    }

    await fetch('/api/assets', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })

    updateItem(id, { configSaving: false, configSaved: true })
  }

  // ── Batch upload pending items ────────────────────────
  function uploadAll() {
    queue.forEach((item, idx) => {
      if (item.status === 'pending' && item.assignedLayer) {
        uploadItem(idx, item)
      }
    })
  }

  const pending = queue.filter(it => it.status === 'pending' && it.assignedLayer).length
  const done    = queue.filter(it => it.status === 'done').length
  const errors  = queue.filter(it => it.status === 'error').length

  const cardS = { background: '#111120', border: '1px solid rgba(255,255,255,0.07)' }

  return (
    <div className="h-full flex flex-col overflow-hidden">

      {/* Top bar */}
      <div className="shrink-0 flex items-center gap-3 px-4 py-3 border-b" style={{ borderColor: 'rgba(255,255,255,0.05)' }}>
        {collections.length > 1 && (
          <select value={collectionId} onChange={e => setCollId(e.target.value)} className={inputC} style={inputS}>
            {collections.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        )}
        {pending > 0 && (
          <button
            onClick={uploadAll}
            className="text-xs font-semibold px-3 py-1.5 rounded-xl transition-all"
            style={{ background: 'rgba(124,58,237,0.85)', color: 'white' }}
          >
            ⬆ Subir {pending} pendiente{pending !== 1 ? 's' : ''}
          </button>
        )}
        {queue.length > 0 && (
          <>
            <span className="text-[10px] ml-auto" style={{ color: 'rgba(255,255,255,0.3)' }}>
              {done} ok · {errors} error · {queue.length - done - errors} pendiente
            </span>
            <button
              onClick={() => { setQueue([]); onDone?.() }}
              className="text-[10px]"
              style={{ color: 'rgba(255,255,255,0.25)' }}
            >
              Limpiar
            </button>
          </>
        )}
      </div>

      {/* Dropzone */}
      <div
        className="mx-4 mt-4 shrink-0 rounded-2xl flex flex-col items-center justify-center gap-3 cursor-pointer transition-all"
        style={{
          border: `2px dashed ${dragging ? 'rgba(124,58,237,0.7)' : 'rgba(255,255,255,0.08)'}`,
          background: dragging ? 'rgba(124,58,237,0.06)' : 'transparent',
          padding: '28px 20px',
        }}
        onDragOver={e => { e.preventDefault(); setDragging(true) }}
        onDragLeave={() => setDragging(false)}
        onDrop={e => { e.preventDefault(); setDragging(false); enqueue(e.dataTransfer.files) }}
        onClick={() => inputRef.current?.click()}
      >
        <div className="text-3xl opacity-30">⬆</div>
        <p className="text-xs text-center" style={{ color: 'rgba(255,255,255,0.4)' }}>
          Arrastra archivos aquí o haz clic para seleccionar
        </p>
        <p className="text-[10px]" style={{ color: 'rgba(255,255,255,0.2)' }}>
          SVG · PNG · JPG — la capa se detecta automáticamente del nombre del archivo
        </p>
        <input
          ref={inputRef}
          type="file"
          multiple
          accept=".svg,.png,.jpg,.jpeg"
          className="hidden"
          onChange={e => { if (e.target.files) enqueue(e.target.files); e.target.value = '' }}
        />
      </div>

      {/* Filename convention hint */}
      {queue.length === 0 && (
        <div className="mx-4 mt-3 rounded-xl p-3" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)' }}>
          <p className="text-[10px] font-semibold mb-1.5" style={{ color: 'rgba(255,255,255,0.4)' }}>Convención de nombres para auto-detección:</p>
          <div className="grid grid-cols-2 gap-x-4 gap-y-0.5">
            {[
              ['Head - rounded', 'head'], ['Hair - afro', 'hair-back'],
              ['bg - ocean', 'background'], ['acc - cap', 'acc-front'],
              ['shirt - tee', 'shirt'], ['masc - butterfly', 'mask'],
            ].map(([ex, layer]) => (
              <div key={ex} className="flex items-center gap-1.5">
                <span className="text-[9px] font-mono" style={{ color: '#a78bfa' }}>{ex}</span>
                <span className="text-[9px]" style={{ color: 'rgba(255,255,255,0.2)' }}>→ {layer}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Queue */}
      {queue.length > 0 && (
        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2">
          {queue.map(item => (
            <QueueRow
              key={item.id}
              item={item}
              layers={layers}
              keywords={keywords}
              onChange={patch => updateItem(item.id, patch)}
              onUpload={() => manualUpload(item.id)}
              onSaveConfig={() => saveConfig(item.id)}
            />
          ))}
        </div>
      )}
    </div>
  )
}

// ── Queue row ─────────────────────────────────────────────
interface RowProps {
  item:         QueueItem
  layers:       Layer[]
  keywords:     Keyword[]
  onChange:     (patch: Partial<QueueItem>) => void
  onUpload:     () => void
  onSaveConfig: () => void
}

function QueueRow({ item, layers, keywords, onChange, onUpload, onSaveConfig }: RowProps) {
  const layerOptions = layers.length ? layers.map(l => l.layerKey) : LAYER_OPTIONS

  const statusIcon = {
    pending:   '○',
    uploading: '⟳',
    done:      '✓',
    error:     '✗',
  }[item.status]

  const statusColor = {
    pending:   'rgba(255,255,255,0.3)',
    uploading: '#a78bfa',
    done:      '#6ee7b7',
    error:     '#fca5a5',
  }[item.status]

  const cardStyle = {
    background: item.status === 'done'
      ? 'rgba(16,185,129,0.05)'
      : item.status === 'error'
        ? 'rgba(239,68,68,0.05)'
        : 'rgba(255,255,255,0.03)',
    border: `1px solid ${
      item.status === 'done'
        ? 'rgba(16,185,129,0.15)'
        : item.status === 'error'
          ? 'rgba(239,68,68,0.15)'
          : 'rgba(255,255,255,0.06)'
    }`,
  }

  return (
    <div className="rounded-2xl overflow-hidden" style={cardStyle}>
      {/* Main row */}
      <div className="flex items-center gap-3 px-4 py-3">
        {/* Status icon */}
        <span className="text-sm shrink-0 w-4 text-center" style={{ color: statusColor }}>
          {statusIcon}
        </span>

        {/* Thumbnail (after upload) */}
        {item.cdnUrl ? (
          <div className="w-9 h-9 rounded-lg overflow-hidden shrink-0" style={{ background: 'rgba(255,255,255,0.05)' }}>
            <Image src={item.cdnUrl} alt={item.filename} width={36} height={36} className="w-full h-full object-cover" unoptimized />
          </div>
        ) : (
          <div className="w-9 h-9 rounded-lg shrink-0 flex items-center justify-center text-[9px]" style={{ background: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.2)' }}>
            {item.filename.split('.').pop()?.toUpperCase()}
          </div>
        )}

        {/* Name */}
        <div className="flex-1 min-w-0">
          <p className="text-xs text-white truncate">{item.filename}</p>
          {item.error && <p className="text-[10px] mt-0.5" style={{ color: '#fca5a5' }}>{item.error}</p>}
        </div>

        {/* Layer selector or detected label */}
        {item.status === 'pending' ? (
          <div className="flex items-center gap-2 shrink-0">
            <select
              value={item.assignedLayer}
              onChange={e => onChange({ assignedLayer: e.target.value })}
              className="text-[10px] rounded-lg px-2 py-1.5 border focus:outline-none"
              style={{ ...selectS, minWidth: 110 }}
            >
              {!item.assignedLayer && <option value="">Asignar capa…</option>}
              {layerOptions.map(k => <option key={k} value={k}>{k}</option>)}
            </select>
            {item.assignedLayer && (
              <button
                onClick={onUpload}
                className="text-[10px] font-semibold px-2.5 py-1.5 rounded-lg shrink-0"
                style={{ background: 'rgba(124,58,237,0.85)', color: 'white' }}
              >
                Subir
              </button>
            )}
          </div>
        ) : item.status === 'uploading' ? (
          <span className="text-[10px] shrink-0" style={{ color: '#a78bfa' }}>Subiendo…</span>
        ) : item.detectedLayer ? (
          <span className="text-[10px] shrink-0 px-2 py-1 rounded-lg" style={{ background: 'rgba(124,58,237,0.15)', color: '#a78bfa' }}>
            {item.assignedLayer}
          </span>
        ) : null}
      </div>

      {/* Inline config — only after successful upload */}
      {item.status === 'done' && !item.configSaved && (
        <div className="border-t px-4 pb-3 pt-3 space-y-2" style={{ borderColor: 'rgba(255,255,255,0.05)' }}>
          <p className="text-[9px] font-semibold uppercase tracking-widest" style={{ color: 'rgba(255,255,255,0.25)' }}>Configurar asset</p>

          <div className="flex flex-wrap items-center gap-2">
            {/* Keyword */}
            <select
              value={item.keywordId}
              onChange={e => onChange({ keywordId: e.target.value })}
              className="text-[10px] rounded-lg px-2 py-1.5 border focus:outline-none flex-1 min-w-[140px]"
              style={selectS}
            >
              <option value="">Sin restricción (público)</option>
              {keywords.map(k => (
                <option key={k.id} value={k.id}>{k.keyword} — {k.label}</option>
              ))}
            </select>

            {/* Default toggle */}
            <label className="flex items-center gap-1.5 cursor-pointer shrink-0">
              <button
                onClick={() => onChange({ isDefault: !item.isDefault })}
                className="w-8 h-5 rounded-full relative transition-all shrink-0"
                style={{ background: item.isDefault ? 'rgba(124,58,237,0.8)' : 'rgba(255,255,255,0.1)' }}
              >
                <span
                  className="absolute top-0.5 w-4 h-4 rounded-full transition-all"
                  style={{ background: 'white', left: item.isDefault ? '14px' : '2px' }}
                />
              </button>
              <span className="text-[10px]" style={{ color: 'rgba(255,255,255,0.4)' }}>Default</span>
            </label>

            {/* Suggested color (hair only) */}
            {HAIR_LAYERS.has(item.assignedLayer) && (
              <label className="flex items-center gap-1.5 cursor-pointer shrink-0">
                <input
                  type="color"
                  value={item.suggestedColor || '#3B2314'}
                  onChange={e => onChange({ suggestedColor: e.target.value })}
                  className="w-7 h-7 rounded-lg cursor-pointer border-0 bg-transparent"
                />
                <span className="text-[10px]" style={{ color: 'rgba(255,255,255,0.4)' }}>
                  {item.suggestedColor ? 'Color sugerido' : 'Sin color'}
                </span>
                {item.suggestedColor && (
                  <button onClick={() => onChange({ suggestedColor: '' })} className="text-[9px]" style={{ color: 'rgba(255,255,255,0.25)' }}>✕</button>
                )}
              </label>
            )}

            {/* Save config */}
            <button
              onClick={onSaveConfig}
              disabled={item.configSaving}
              className="text-[10px] font-semibold px-3 py-1.5 rounded-lg disabled:opacity-50 transition-all shrink-0"
              style={{ background: 'rgba(16,185,129,0.8)', color: 'white' }}
            >
              {item.configSaving ? '…' : '✓ Guardar'}
            </button>
          </div>
        </div>
      )}

      {/* Config saved badge */}
      {item.configSaved && (
        <div className="border-t px-4 py-2 flex items-center gap-2" style={{ borderColor: 'rgba(255,255,255,0.05)' }}>
          <span className="text-[9px]" style={{ color: '#6ee7b7' }}>✓ Config guardada</span>
          {item.keywordId && <span className="text-[9px] px-1.5 py-0.5 rounded-full" style={{ background: 'rgba(124,58,237,0.2)', color: '#a78bfa' }}>🔑 Keyword asignada</span>}
          {item.isDefault && <span className="text-[9px] px-1.5 py-0.5 rounded-full" style={{ background: 'rgba(124,58,237,0.2)', color: '#a78bfa' }}>default</span>}
        </div>
      )}
    </div>
  )
}
