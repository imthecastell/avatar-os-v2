'use client'

import { useState, useRef, useCallback } from 'react'
import { detectLayerFromFilename, detectEditableColors, isSVGEditable } from '@/lib/engine/asset-classifier'
import type { Collection, Layer } from '@/types'

// ── Types ──────────────────────────────────────────────────
interface FileGroup {
  id:          string
  baseName:    string
  files:       File[]
  previewUrls: string[]   // object URLs for thumbnails
  layerKey:    string     // assigned layer key (existing or new)
  isNew:       boolean    // true → layer doesn't exist yet
  newLabelEs:  string
  newLabelEn:  string
  optional:    boolean
}

interface GroupProgress {
  uploaded: number
  total:    number
  error:    string | null
  done:     boolean
}

type Stage = 'idle' | 'reviewing' | 'uploading' | 'done'

interface Props {
  collections: Collection[]
  layers:      Layer[]
  onDone?:     () => void
}

// ── Base name extraction ──────────────────────────────────
function extractBaseName(filename: string): string {
  let name = filename.replace(/\.[^.]+$/, '')             // strip extension
  name = name.replace(/[-_\s]+\d+$/, '').trim()          // strip trailing number + separator
  return name
}

function toLayerKey(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
}

function toTitleCase(str: string): string {
  return str.replace(/\b\w/g, c => c.toUpperCase())
}

const EXISTING_LAYER_KEYS = [
  'background','emotion','hair-back','head','shirt',
  'hair-front','acc-front','mask','effect-final','frame',
]

// ── Component ─────────────────────────────────────────────
export default function SmartBatchUploader({ collections, layers, onDone }: Props) {
  const [collectionId, setCollId]   = useState(collections[0]?.id ?? '')
  const [stage, setStage]           = useState<Stage>('idle')
  const [groups, setGroups]         = useState<FileGroup[]>([])
  const [progress, setProgress]     = useState<Record<string, GroupProgress>>({})
  const [dragging, setDragging]     = useState(false)
  const inputRef                    = useRef<HTMLInputElement>(null)

  const existingKeys = layers.length
    ? layers.map(l => l.layerKey)
    : EXISTING_LAYER_KEYS

  // ── Group files by base name ───────────────────────────
  function groupFiles(files: FileList | File[]) {
    const arr   = Array.from(files).filter(f => /\.(svg|png|jpe?g)$/i.test(f.name))
    if (!arr.length) return

    const map = new Map<string, File[]>()
    for (const file of arr) {
      const base = extractBaseName(file.name)
      const existing = map.get(base) ?? []
      map.set(base, [...existing, file])
    }

    const newGroups: FileGroup[] = Array.from(map.entries()).map(([baseName, grpFiles]) => {
      const detected  = detectLayerFromFilename(baseName + '.svg')
      const layerKey  = detected ?? toLayerKey(baseName)
      const isNew     = !existingKeys.includes(layerKey)
      const previewUrls = grpFiles.slice(0, 4).map(f => URL.createObjectURL(f))

      return {
        id:          crypto.randomUUID(),
        baseName,
        files:       grpFiles,
        previewUrls,
        layerKey,
        isNew,
        newLabelEs:  toTitleCase(baseName),
        newLabelEn:  toTitleCase(baseName),
        optional:    true,
      }
    })

    setGroups(newGroups)
    setStage('reviewing')
  }

  function updateGroup(id: string, patch: Partial<FileGroup>) {
    setGroups(prev => prev.map(g => {
      if (g.id !== id) return g
      const next = { ...g, ...patch }
      if ('layerKey' in patch) {
        next.isNew = !existingKeys.includes(patch.layerKey as string)
      }
      return next
    }))
  }

  function removeGroup(id: string) {
    setGroups(prev => {
      const g = prev.find(x => x.id === id)
      g?.previewUrls.forEach(URL.revokeObjectURL)
      return prev.filter(x => x.id !== id)
    })
  }

  // ── Upload ────────────────────────────────────────────
  const confirmAndUpload = useCallback(async () => {
    if (groups.some(g => !g.layerKey)) return

    setStage('uploading')
    const init: Record<string, GroupProgress> = {}
    for (const g of groups) init[g.id] = { uploaded: 0, total: g.files.length, error: null, done: false }
    setProgress(init)

    for (const group of groups) {
      try {
        // 1. Create layer if new
        if (group.isNew) {
          const maxOrder = layers.length
            ? Math.max(...layers.map(l => l.orderIndex)) + 1
            : groups.indexOf(group)

          const res = await fetch('/api/layers', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              collection_id: collectionId,
              order_index:   maxOrder,
              layer_key:     group.layerKey,
              label_es:      group.newLabelEs || group.baseName,
              label_en:      group.newLabelEn || group.baseName,
              type:          'auto',
              blend_mode:    'source-over',
              optional:      group.optional,
              locked:        false,
            }),
          })

          if (!res.ok) {
            const d = await res.json().catch(() => ({}))
            setProgress(prev => ({ ...prev, [group.id]: { ...prev[group.id], error: d.error ?? `HTTP ${res.status}`, done: true } }))
            continue
          }
        }

        // 2. Upload each file directly to Supabase Storage (bypasses Vercel 4.5 MB limit)
        let uploaded = 0
        let groupError: string | null = null

        for (const file of group.files) {
          const ext      = file.name.split('.').pop()?.toLowerCase() ?? ''
          const fileType = ext === 'jpeg' ? 'jpg' : ext as 'svg' | 'png' | 'jpg'

          // Detect SVG colors on the client — no need to send file content to the server
          let colorMap: object[] = []
          let svgEditable = false
          if (fileType === 'svg') {
            const text = await file.text()
            colorMap    = detectEditableColors(text)
            svgEditable = isSVGEditable(text)
          }

          // Step A: get a signed upload URL (tiny JSON request, no file)
          const presignRes  = await fetch('/api/assets/presign', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ filename: file.name, layerKey: group.layerKey, collectionId }),
          })
          const presignData = await presignRes.json().catch(() => ({ error: `HTTP ${presignRes.status}` }))
          if (presignData.error) { groupError = presignData.error; break }

          // Step B: PUT file directly to Supabase Storage — no Vercel function involved
          const uploadRes = await fetch(presignData.signedUrl, {
            method: 'PUT',
            headers: { 'Content-Type': presignData.contentType },
            body: file,
          })
          if (!uploadRes.ok) { groupError = `Storage error: HTTP ${uploadRes.status}`; break }

          // Step C: record asset metadata in the DB (tiny JSON request)
          const recordRes  = await fetch('/api/assets/record', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              collectionId, layerKey: group.layerKey, filename: file.name,
              storagePath: presignData.storagePath, cdnUrl: presignData.cdnUrl,
              fileType, originalSize: file.size, colorMap, svgEditable,
            }),
          })
          const recordData = await recordRes.json().catch(() => ({ error: `HTTP ${recordRes.status}` }))
          if (recordData.error) { groupError = recordData.error; break }

          uploaded++
          setProgress(prev => ({ ...prev, [group.id]: { ...prev[group.id], uploaded } }))
          await new Promise<void>(r => setTimeout(r, 0))
        }

        setProgress(prev => ({
          ...prev,
          [group.id]: { ...prev[group.id], uploaded, error: groupError, done: true },
        }))
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Error desconocido'
        setProgress(prev => ({ ...prev, [group.id]: { ...prev[group.id], error: msg, done: true } }))
      }
    }

    setStage('done')
  }, [groups, collectionId, layers])

  function reset() {
    groups.forEach(g => g.previewUrls.forEach(URL.revokeObjectURL))
    setGroups([])
    setProgress({})
    setStage('idle')
  }

  // ── Render ────────────────────────────────────────────
  if (stage === 'idle') {
    return (
      <IdleZone
        dragging={dragging}
        inputRef={inputRef}
        onDrop={groupFiles}
        onDragChange={setDragging}
        collections={collections}
        collectionId={collectionId}
        onCollectionChange={setCollId}
      />
    )
  }

  if (stage === 'reviewing') {
    return (
      <ReviewStage
        groups={groups}
        existingKeys={existingKeys}
        onUpdate={updateGroup}
        onRemove={removeGroup}
        onBack={reset}
        onConfirm={confirmAndUpload}
      />
    )
  }

  if (stage === 'uploading') {
    return <UploadingStage groups={groups} progress={progress} />
  }

  // done
  const uploaded  = Object.values(progress).reduce((s, p) => s + p.uploaded, 0)
  const newLayers = groups.filter(g => g.isNew).length
  const errGroups = groups.filter(g => progress[g.id]?.error)

  return (
    <div className="h-full flex flex-col overflow-hidden">
      <div className="flex-1 overflow-y-auto flex flex-col items-center justify-center gap-5 p-6">
        <div className="text-5xl">{errGroups.length ? '⚠️' : '✅'}</div>
        <div className="text-center">
          <p className="text-white font-semibold text-sm mb-1">
            {errGroups.length
              ? `${errGroups.length} grupo(s) fallaron`
              : `${uploaded} asset(s) subidos`}
          </p>
          <p className="text-[11px]" style={{ color: 'rgba(255,255,255,0.4)' }}>
            {newLayers} capa(s) nueva(s) · {groups.length} grupo(s) procesados
          </p>
        </div>

        {errGroups.length > 0 && (
          <div className="w-full max-w-sm space-y-2">
            {errGroups.map(g => (
              <div key={g.id} className="rounded-xl px-3 py-2.5 text-[11px]" style={{ background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.25)', color: '#fca5a5' }}>
                <span className="font-semibold">{g.baseName}:</span> {progress[g.id]?.error}
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="shrink-0 flex gap-3 justify-center pb-6 px-6">
        <button
          onClick={() => { onDone?.(); reset() }}
          className="text-xs font-semibold px-5 py-2.5 rounded-xl"
          style={{ background: 'rgba(124,58,237,0.85)', color: 'white' }}
        >
          ✓ Ir al Studio
        </button>
        <button
          onClick={reset}
          className="text-xs px-4 py-2.5 rounded-xl"
          style={{ background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.5)' }}
        >
          Subir más
        </button>
      </div>
    </div>
  )
}

// ══════════════════════════════════════════════════════════
// Idle drop zone
// ══════════════════════════════════════════════════════════
function IdleZone({ dragging, inputRef, onDrop, onDragChange, collections, collectionId, onCollectionChange }: {
  dragging: boolean
  inputRef: React.RefObject<HTMLInputElement | null>
  onDrop:   (files: FileList | File[]) => void
  onDragChange: (v: boolean) => void
  collections: Collection[]
  collectionId: string
  onCollectionChange: (id: string) => void
}) {
  return (
    <div className="h-full flex flex-col">
      {collections.length > 1 && (
        <div className="px-4 pt-3 pb-0 shrink-0">
          <select
            value={collectionId}
            onChange={e => onCollectionChange(e.target.value)}
            className="text-xs rounded-xl px-3 py-2 border focus:outline-none w-full"
            style={{ background: 'rgba(255,255,255,0.05)', borderColor: 'rgba(255,255,255,0.1)', color: 'white' }}
          >
            {collections.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
      )}

      <div className="flex-1 flex flex-col items-center justify-center p-6 gap-4">
        <div
          className="w-full max-w-sm rounded-3xl flex flex-col items-center justify-center gap-4 cursor-pointer transition-all"
          style={{
            border: `2px dashed ${dragging ? 'rgba(124,58,237,0.7)' : 'rgba(255,255,255,0.1)'}`,
            background: dragging ? 'rgba(124,58,237,0.06)' : 'rgba(255,255,255,0.02)',
            padding: '48px 32px',
          }}
          onDragOver={e => { e.preventDefault(); onDragChange(true) }}
          onDragLeave={() => onDragChange(false)}
          onDrop={e => { e.preventDefault(); onDragChange(false); onDrop(e.dataTransfer.files) }}
          onClick={() => inputRef.current?.click()}
        >
          <div className="text-4xl opacity-40">⬆</div>
          <div className="text-center">
            <p className="text-sm font-medium text-white mb-1">Arrastrá tus archivos aquí</p>
            <p className="text-[11px]" style={{ color: 'rgba(255,255,255,0.35)' }}>
              SVG · PNG · JPG — se agrupan automáticamente por nombre
            </p>
          </div>
          <button
            className="text-xs font-semibold px-5 py-2 rounded-xl mt-1"
            style={{ background: 'rgba(124,58,237,0.8)', color: 'white' }}
          >
            Seleccionar archivos
          </button>
          <input
            ref={inputRef}
            type="file"
            multiple
            accept=".svg,.png,.jpg,.jpeg"
            className="hidden"
            onChange={e => { if (e.target.files) { onDrop(e.target.files); e.target.value = '' } }}
          />
        </div>

        <div className="text-center max-w-xs">
          <p className="text-[10px]" style={{ color: 'rgba(255,255,255,0.25)' }}>
            Los archivos con el mismo nombre base se agrupan en una sola capa.
            <br />Ej: <span style={{ color: '#a78bfa' }}>arch 1.svg · arch 2.svg · arch 3.svg</span> → grupo <span style={{ color: '#a78bfa' }}>arch</span>
          </p>
        </div>
      </div>
    </div>
  )
}

// ══════════════════════════════════════════════════════════
// Review stage — list of group cards
// ══════════════════════════════════════════════════════════
function ReviewStage({ groups, existingKeys, onUpdate, onRemove, onBack, onConfirm }: {
  groups:      FileGroup[]
  existingKeys: string[]
  onUpdate:    (id: string, patch: Partial<FileGroup>) => void
  onRemove:    (id: string) => void
  onBack:      () => void
  onConfirm:   () => void
}) {
  const allAssigned = groups.every(g => g.layerKey.trim().length > 0)
  const newCount    = groups.filter(g => g.isNew).length

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Header */}
      <div className="shrink-0 flex items-center gap-3 px-4 py-3 border-b" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
        <button onClick={onBack} className="text-[11px]" style={{ color: 'rgba(255,255,255,0.35)' }}>← Volver</button>
        <div className="flex-1">
          <p className="text-xs font-semibold text-white">{groups.length} grupo{groups.length !== 1 ? 's' : ''} detectados</p>
          {newCount > 0 && (
            <p className="text-[10px]" style={{ color: '#a78bfa' }}>{newCount} capa{newCount !== 1 ? 's' : ''} nueva{newCount !== 1 ? 's' : ''} se crearán</p>
          )}
        </div>
        <button
          onClick={onConfirm}
          disabled={!allAssigned}
          className="text-xs font-semibold px-4 py-2 rounded-xl disabled:opacity-40 transition-all"
          style={{ background: 'rgba(124,58,237,0.85)', color: 'white' }}
        >
          Confirmar y subir →
        </button>
      </div>

      {/* Group cards */}
      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-2.5">
        {groups.map(group => (
          <GroupCard
            key={group.id}
            group={group}
            existingKeys={existingKeys}
            onUpdate={patch => onUpdate(group.id, patch)}
            onRemove={() => onRemove(group.id)}
          />
        ))}
      </div>
    </div>
  )
}

// ── Group card ────────────────────────────────────────────
function GroupCard({ group, existingKeys, onUpdate, onRemove }: {
  group:        FileGroup
  existingKeys: string[]
  onUpdate:     (patch: Partial<FileGroup>) => void
  onRemove:     () => void
}) {
  const allKeys    = [...new Set([...existingKeys, ...(group.isNew ? [group.layerKey] : [])])]

  return (
    <div
      className="rounded-2xl overflow-hidden"
      style={{
        background: 'rgba(255,255,255,0.03)',
        border: `1px solid ${group.isNew ? 'rgba(124,58,237,0.3)' : 'rgba(255,255,255,0.07)'}`,
      }}
    >
      {/* Top row */}
      <div className="flex items-start gap-3 px-4 py-3">
        {/* Thumbnails */}
        <div className="flex gap-1 shrink-0">
          {group.previewUrls.map((url, i) => (
            <div key={i} className="w-10 h-10 rounded-xl overflow-hidden shrink-0" style={{ background: 'rgba(255,255,255,0.06)' }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={url} alt="" className="w-full h-full object-cover" />
            </div>
          ))}
          {group.files.length > 4 && (
            <div className="w-10 h-10 rounded-xl shrink-0 flex items-center justify-center text-[9px] font-bold" style={{ background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.3)' }}>
              +{group.files.length - 4}
            </div>
          )}
        </div>

        {/* Name + count */}
        <div className="flex-1 min-w-0">
          <input
            value={group.baseName}
            onChange={e => onUpdate({ baseName: e.target.value })}
            className="text-sm font-semibold bg-transparent text-white outline-none border-b border-transparent focus:border-white/20 transition-colors w-full"
            placeholder="Nombre del grupo…"
          />
          <p className="text-[10px] mt-0.5" style={{ color: 'rgba(255,255,255,0.3)' }}>
            {group.files.length} archivo{group.files.length !== 1 ? 's' : ''}
          </p>
        </div>

        <button
          onClick={onRemove}
          className="shrink-0 w-6 h-6 flex items-center justify-center rounded-lg text-[10px] transition-colors"
          style={{ color: 'rgba(255,255,255,0.2)' }}
          onMouseEnter={e => (e.currentTarget.style.color = '#fca5a5')}
          onMouseLeave={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.2)')}
        >
          ✕
        </button>
      </div>

      {/* Layer assignment */}
      <div className="px-4 pb-3 flex flex-wrap items-center gap-2">
        <span className="text-[10px] shrink-0" style={{ color: 'rgba(255,255,255,0.3)' }}>Capa:</span>

        <select
          value={group.isNew ? '__new__' : group.layerKey}
          onChange={e => {
            if (e.target.value === '__new__') {
              onUpdate({ isNew: true, layerKey: toLayerKey(group.baseName) })
            } else {
              onUpdate({ layerKey: e.target.value, isNew: false })
            }
          }}
          className="text-[11px] rounded-lg px-2.5 py-1.5 border focus:outline-none flex-1 min-w-[130px]"
          style={{ background: 'rgba(255,255,255,0.05)', borderColor: 'rgba(255,255,255,0.1)', color: 'white' }}
        >
          {existingKeys.map(k => <option key={k} value={k}>{k}</option>)}
          <option value="__new__">✦ Nueva capa…</option>
        </select>

        {group.isNew && (
          <>
            <span className="text-[9px] px-2 py-0.5 rounded-full shrink-0" style={{ background: 'rgba(124,58,237,0.25)', color: '#c4b5fd' }}>nueva</span>
            <label className="flex items-center gap-1.5 shrink-0 cursor-pointer">
              <button
                onClick={() => onUpdate({ optional: !group.optional })}
                className="w-7 h-4 rounded-full relative transition-all shrink-0"
                style={{ background: group.optional ? 'rgba(124,58,237,0.7)' : 'rgba(255,255,255,0.1)' }}
              >
                <span className="absolute top-0.5 w-3 h-3 rounded-full transition-all" style={{ background: 'white', left: group.optional ? '12px' : '2px' }} />
              </button>
              <span className="text-[10px]" style={{ color: 'rgba(255,255,255,0.35)' }}>opcional</span>
            </label>
          </>
        )}
      </div>

      {/* New layer fields */}
      {group.isNew && (
        <div className="px-4 pb-3 flex gap-2 border-t" style={{ borderColor: 'rgba(255,255,255,0.05)', paddingTop: 10 }}>
          <div className="flex flex-col gap-1 flex-1">
            <label className="text-[9px] uppercase tracking-widest" style={{ color: 'rgba(255,255,255,0.25)' }}>Key</label>
            <input
              value={group.layerKey}
              onChange={e => onUpdate({ layerKey: toLayerKey(e.target.value) })}
              className="text-[11px] rounded-lg px-2.5 py-1.5 border focus:outline-none font-mono"
              style={{ background: 'rgba(255,255,255,0.04)', borderColor: 'rgba(255,255,255,0.1)', color: '#a78bfa' }}
              placeholder="mi-capa"
            />
          </div>
          <div className="flex flex-col gap-1 flex-1">
            <label className="text-[9px] uppercase tracking-widest" style={{ color: 'rgba(255,255,255,0.25)' }}>Label ES</label>
            <input
              value={group.newLabelEs}
              onChange={e => onUpdate({ newLabelEs: e.target.value })}
              className="text-[11px] rounded-lg px-2.5 py-1.5 border focus:outline-none"
              style={{ background: 'rgba(255,255,255,0.04)', borderColor: 'rgba(255,255,255,0.1)', color: 'white' }}
              placeholder="Mi Capa"
            />
          </div>
          <div className="flex flex-col gap-1 flex-1">
            <label className="text-[9px] uppercase tracking-widest" style={{ color: 'rgba(255,255,255,0.25)' }}>Label EN</label>
            <input
              value={group.newLabelEn}
              onChange={e => onUpdate({ newLabelEn: e.target.value })}
              className="text-[11px] rounded-lg px-2.5 py-1.5 border focus:outline-none"
              style={{ background: 'rgba(255,255,255,0.04)', borderColor: 'rgba(255,255,255,0.1)', color: 'white' }}
              placeholder="My Layer"
            />
          </div>
        </div>
      )}
    </div>
  )
}

// ══════════════════════════════════════════════════════════
// Uploading stage — progress per group
// ══════════════════════════════════════════════════════════
function UploadingStage({ groups, progress }: { groups: FileGroup[], progress: Record<string, GroupProgress> }) {
  return (
    <div className="h-full flex flex-col overflow-hidden">
      <div className="shrink-0 px-4 py-3 border-b" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
        <p className="text-xs font-semibold text-white">Subiendo assets…</p>
      </div>
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
        {groups.map(group => {
          const p = progress[group.id]
          const pct = p ? Math.round((p.uploaded / p.total) * 100) : 0
          return (
            <div key={group.id} className="rounded-2xl p-4" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-medium text-white">{group.baseName}</p>
                <p className="text-[10px]" style={{ color: p?.error ? '#fca5a5' : p?.done ? '#6ee7b7' : 'rgba(255,255,255,0.4)' }}>
                  {p?.error ? `Error: ${p.error}` : p?.done ? '✓ Listo' : `${p?.uploaded ?? 0} / ${group.files.length}`}
                </p>
              </div>
              <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.06)' }}>
                <div
                  className="h-full rounded-full transition-all duration-300"
                  style={{
                    width: `${p?.done ? 100 : pct}%`,
                    background: p?.error ? '#ef4444' : p?.done ? '#10b981' : '#7c3aed',
                  }}
                />
              </div>
              {group.isNew && (
                <p className="text-[9px] mt-1.5" style={{ color: '#a78bfa' }}>✦ Nueva capa: {group.layerKey}</p>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
