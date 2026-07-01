'use client'

import { useState, useRef } from 'react'
import dynamic from 'next/dynamic'
import Image from 'next/image'
import type { Layer, Asset, Collection, AvatarState, Keyword, AssetTransform } from '@/types'
import AssetInspector from '@/components/admin/AssetInspector'
import SmartBatchUploader from '@/components/admin/SmartBatchUploader'

const AvatarCanvas = dynamic(() => import('@/components/builder/AvatarCanvas'), { ssr: false })

// ── Layer visual identity ─────────────────────────────────
const LAYER_META: Record<string, { emoji: string; accent: string }> = {
  'background':   { emoji: '🌅', accent: '#0ea5e9' },
  'emotion':      { emoji: '😄', accent: '#f59e0b' },
  'hair-back':    { emoji: '💇', accent: '#d97706' },
  'head':         { emoji: '🧑', accent: '#f43f5e' },
  'shirt':        { emoji: '👕', accent: '#3b82f6' },
  'hair-front':   { emoji: '✂️', accent: '#d97706' },
  'acc-front':    { emoji: '🎩', accent: '#8b5cf6' },
  'mask':         { emoji: '😷', accent: '#6b7280' },
  'effect-final': { emoji: '✨', accent: '#a78bfa' },
  'frame':        { emoji: '🖼️', accent: '#10b981' },
}

const SKIN_TONES = [
  '#FDDBB4','#F9C7B6','#EBA882','#D4895A','#B86A35','#8B4513','#5C2D0A','#3B1A08',
]
const HAIR_COLORS = [
  '#1A1A1A','#3B2314','#6B3A2A','#A0522D','#C9A96E','#E8D5A3','#B22222','#708090',
]
const LAYER_KEYS = Object.keys(LAYER_META)

// ── Helpers ───────────────────────────────────────────────
function buildDefaultState(collectionId: string, layers: Layer[], assets: Asset[]): AvatarState {
  const selectedAssets: Record<string, string | null> = {}
  for (const layer of layers) {
    const def = assets.find(a => a.collectionId === collectionId && a.layerKey === layer.layerKey && a.isDefault)
    selectedAssets[layer.layerKey] = def?.id ?? null
  }
  return {
    collectionId,
    tokens: { 'skin-color': '#D4895A', 'hair-color': '#3B2314' },
    selectedAssets,
    unlockedKeywords: [],
    extraColor: false,
  }
}

interface Props {
  collections: Collection[]
  layers:      Layer[]
  assets:      Asset[]
  keywords:    Keyword[]
}

export default function Studio({ collections, layers: initialLayers, assets, keywords }: Props) {
  const firstCollId = collections[0]?.id ?? ''
  const [collectionId, setCollectionId] = useState(firstCollId)
  const [layers, setLayers] = useState(initialLayers)
  const [selectedKey, setSelectedKey]   = useState(initialLayers[0]?.layerKey ?? '')
  const [avatarState, setAvatarState]   = useState<AvatarState>(() =>
    buildDefaultState(firstCollId, initialLayers, assets)
  )
  const [dragIdx, setDragIdx]           = useState<number | null>(null)
  const [saving, setSaving]             = useState(false)
  const [uploading, setUploading]       = useState(false)
  const [uploadLog, setUploadLog]       = useState<string[]>([])
  const [seeding, setSeeding]           = useState(false)
  const [inspecting, setInspecting]     = useState<Asset | null>(null)
  const [centerMode, setCenterMode]     = useState<'assets' | 'batch'>('assets')
  const [dropOver, setDropOver]         = useState(false)
  const [selectionMode, setSelectionMode]       = useState(false)
  const [selectedIds, setSelectedIds]           = useState<Set<string>>(new Set())
  const [transformOverrides, setTransformOverrides] = useState<Record<string, AssetTransform>>({})
  const [savingTransform, setSavingTransform]   = useState(false)

  const fileRef = useRef<HTMLInputElement>(null)

  // Derive filtered lists
  const collLayers   = layers.filter(l => !collectionId || l.collectionId === collectionId)
  const layerAssets  = assets.filter(a => a.collectionId === collectionId && a.layerKey === selectedKey)
  const selectedLayer = collLayers.find(l => l.layerKey === selectedKey)
  const meta          = LAYER_META[selectedKey] ?? { emoji: '📁', accent: '#6b7280' }

  // Active asset for transform controls
  const activeAssetId = (avatarState.selectedAssets[selectedKey] ?? null) as string | null
  const activeAsset   = activeAssetId ? assets.find(a => a.id === activeAssetId) ?? null : null
  const activeTransform: AssetTransform = activeAssetId
    ? (transformOverrides[activeAssetId] ?? activeAsset?.transform ?? { scale: 1, offsetX: 0, offsetY: 0 })
    : { scale: 1, offsetX: 0, offsetY: 0 }
  const transformDirty = activeAssetId ? !!transformOverrides[activeAssetId] : false

  // Merge transform overrides into assets array for live canvas preview
  const canvasAssets = assets.map(a =>
    transformOverrides[a.id] ? { ...a, transform: transformOverrides[a.id] } : a
  )

  // ── Drag & drop layer reorder ─────────────────────────
  function onDragStart(i: number) {
    if (collLayers[i]?.locked) return
    setDragIdx(i)
  }

  function onDragOver(e: React.DragEvent, i: number) {
    e.preventDefault()
    if (dragIdx === null || dragIdx === i || collLayers[i]?.locked) return
    const next = [...layers]
    const globalFrom = layers.indexOf(collLayers[dragIdx])
    const globalTo   = layers.indexOf(collLayers[i])
    const [moved] = next.splice(globalFrom, 1)
    next.splice(globalTo, 0, moved)
    setLayers(next)
    setDragIdx(i)
  }

  async function onDragEnd() {
    setDragIdx(null)
    setSaving(true)
    for (let i = 0; i < layers.length; i++) {
      await fetch('/api/layers', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: layers[i].id, order_index: i }),
      })
    }
    setSaving(false)
  }

  // ── Avatar mutations ──────────────────────────────────
  function selectAsset(layerKey: string, assetId: string | null) {
    setAvatarState(s => ({ ...s, selectedAssets: { ...s.selectedAssets, [layerKey]: assetId } }))
  }

  function setSkin(hex: string) {
    setAvatarState(s => ({ ...s, tokens: { ...s.tokens, 'skin-color': hex } }))
  }

  function setHair(hex: string) {
    setAvatarState(s => ({ ...s, tokens: { ...s.tokens, 'hair-color': hex } }))
  }

  function randomize() {
    const sel: Record<string, string | null> = {}
    for (const layer of collLayers) {
      const opts = assets.filter(a => a.collectionId === collectionId && a.layerKey === layer.layerKey)
      sel[layer.layerKey] = opts.length ? opts[Math.floor(Math.random() * opts.length)].id : null
    }
    setAvatarState(s => ({ ...s, selectedAssets: sel }))
  }

  function reset() {
    setAvatarState(buildDefaultState(collectionId, collLayers, assets))
  }

  // ── Upload ────────────────────────────────────────────
  async function handleUpload(files: FileList | null) {
    if (!files?.length) return
    setUploading(true)
    setUploadLog([])
    for (const file of Array.from(files)) {
      setUploadLog(p => [...p, `⏳ ${file.name}`])
      const fd = new FormData()
      fd.append('file', file)
      fd.append('layer', selectedKey)
      if (collectionId) fd.append('collectionId', collectionId)
      const res  = await fetch('/api/assets/upload', { method: 'POST', body: fd })
      const json = await res.json()
      setUploadLog(p => [
        ...p.slice(0, -1),
        json.error ? `❌ ${file.name}: ${json.error}` : `✓ ${file.name}`,
      ])
    }
    setUploading(false)
    setTimeout(() => window.location.reload(), 600)
  }

  // ── Asset actions ─────────────────────────────────────
  async function setDefault(assetId: string) {
    const prev = assets.filter(a => a.layerKey === selectedKey && a.isDefault)
    for (const a of prev) {
      await fetch('/api/assets', {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: a.id, is_default: false }),
      })
    }
    await fetch('/api/assets', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: assetId, is_default: true }),
    })
    window.location.reload()
  }

  function toggleSelectAsset(id: string) {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }

  async function deleteSelected() {
    if (!confirm(`¿Eliminar ${selectedIds.size} asset(s) seleccionados?`)) return
    await fetch('/api/assets', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids: Array.from(selectedIds) }),
    })
    setSelectedIds(new Set())
    setSelectionMode(false)
    window.location.reload()
  }

  async function deleteLayer(layerId: string, layerKey: string, labelEs: string) {
    const count = assets.filter(a => a.collectionId === collectionId && a.layerKey === layerKey).length
    if (!confirm(`¿Eliminar la capa "${labelEs}" y sus ${count} asset(s)?`)) return
    await fetch(`/api/layers?id=${layerId}&layerKey=${layerKey}&collectionId=${collectionId}`, { method: 'DELETE' })
    window.location.reload()
  }

  async function deleteAsset(assetId: string) {
    if (!confirm('¿Eliminar este asset?')) return
    await fetch(`/api/assets?id=${assetId}`, { method: 'DELETE' })
    window.location.reload()
  }

  // ── Transform (live scale/offset for active asset) ───
  function updateTransform(key: keyof AssetTransform, val: number) {
    if (!activeAssetId) return
    setTransformOverrides(prev => ({
      ...prev,
      [activeAssetId]: { ...activeTransform, [key]: val },
    }))
  }

  async function saveTransform() {
    if (!activeAssetId || !transformOverrides[activeAssetId]) return
    setSavingTransform(true)
    await fetch('/api/assets', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: activeAssetId, transform: transformOverrides[activeAssetId] }),
    })
    setSavingTransform(false)
    // clear override — DB now has the value
    setTransformOverrides(prev => { const n = { ...prev }; delete n[activeAssetId]; return n })
  }

  function resetTransform() {
    if (!activeAssetId) return
    setTransformOverrides(prev => ({
      ...prev,
      [activeAssetId]: { scale: 1, offsetX: 0, offsetY: 0 },
    }))
  }

  // ── File drag-and-drop (center panel) ────────────────
  function onFileDragOver(e: React.DragEvent) {
    if (centerMode !== 'assets') return
    if (e.dataTransfer.types.includes('Files')) {
      e.preventDefault()
      setDropOver(true)
    }
  }

  function onFileDragLeave(e: React.DragEvent) {
    if (!(e.currentTarget as HTMLElement).contains(e.relatedTarget as Node)) {
      setDropOver(false)
    }
  }

  function onFileDrop(e: React.DragEvent) {
    e.preventDefault()
    setDropOver(false)
    if (centerMode === 'assets') handleUpload(e.dataTransfer.files)
  }

  // ── Render ────────────────────────────────────────────
  return (
    <div className="flex h-full overflow-hidden" style={{ background: '#07070e' }}>

      {/* ══════════════════════════════════════════════════
          LEFT — Layer stack
      ══════════════════════════════════════════════════ */}
      <aside className="w-[210px] flex flex-col border-r shrink-0" style={{ borderColor: 'rgba(255,255,255,0.05)', background: '#0b0b16' }}>

        {/* Collection picker */}
        {collections.length > 1 && (
          <div className="px-3 pt-3 pb-2">
            <select
              value={collectionId}
              onChange={e => setCollectionId(e.target.value)}
              className="w-full text-xs rounded-xl px-2.5 py-1.5 border focus:outline-none focus:border-violet-500 transition-colors"
              style={{ background: 'rgba(255,255,255,0.05)', borderColor: 'rgba(255,255,255,0.1)', color: 'white' }}
            >
              {collections.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
        )}

        <p className="px-4 pt-3 pb-1 text-[9px] font-semibold uppercase tracking-widest" style={{ color: 'rgba(255,255,255,0.2)' }}>
          Capas · {collLayers.length}{saving && ' · guardando…'}
        </p>

        {/* Seed prompt when no layers */}
        {collLayers.length === 0 && collectionId && (
          <div className="mx-2 my-2 p-3 rounded-xl text-center" style={{ background: 'rgba(124,58,237,0.1)', border: '1px solid rgba(124,58,237,0.25)' }}>
            <p className="text-[10px] text-violet-300 mb-2">Sin capas — crea el stack estándar</p>
            <button
              onClick={async () => {
                setSeeding(true)
                const res = await fetch('/api/layers/seed', {
                  method: 'POST', headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ collectionId }),
                })
                setSeeding(false)
                if (res.ok) window.location.reload()
                else { const d = await res.json(); alert(d.error) }
              }}
              disabled={seeding}
              className="text-[10px] font-semibold px-3 py-1.5 rounded-lg transition-all disabled:opacity-50"
              style={{ background: 'rgba(124,58,237,0.7)', color: 'white' }}
            >
              {seeding ? 'Creando…' : '⬡ Crear 10 capas'}
            </button>
          </div>
        )}

        {/* Layer list */}
        <div className="flex-1 overflow-y-auto px-2 py-1 space-y-0.5">
          {collLayers.map((layer, i) => {
            const lmeta    = LAYER_META[layer.layerKey] ?? { emoji: '📁', accent: '#6b7280' }
            const count    = assets.filter(a => a.collectionId === collectionId && a.layerKey === layer.layerKey).length
            const hasWarn  = assets.some(a => a.collectionId === collectionId && a.layerKey === layer.layerKey && a.fileType === 'svg' && !a.svgEditable)
            const isActive = selectedKey === layer.layerKey
            const isDrag   = dragIdx === i

            return (
              <div
                key={layer.id}
                draggable={!layer.locked}
                onDragStart={() => onDragStart(i)}
                onDragOver={e => onDragOver(e, i)}
                onDragEnd={onDragEnd}
                onClick={() => setSelectedKey(layer.layerKey)}
                className="flex items-center gap-2.5 px-2.5 py-2 rounded-xl cursor-pointer select-none transition-all group/layer"
                style={{
                  background: isActive ? 'rgba(255,255,255,0.07)' : 'transparent',
                  opacity: isDrag ? 0.4 : 1,
                  transform: isDrag ? 'scale(0.96)' : undefined,
                }}
                onMouseEnter={e => { if (!isActive) (e.currentTarget as HTMLDivElement).style.background = 'rgba(255,255,255,0.04)' }}
                onMouseLeave={e => { if (!isActive) (e.currentTarget as HTMLDivElement).style.background = 'transparent' }}
              >
                <div className="w-0.5 h-5 rounded-full shrink-0 transition-all duration-200" style={{ background: isActive ? lmeta.accent : 'transparent' }} />
                <span className="text-sm leading-none">{lmeta.emoji}</span>
                <p className="flex-1 min-w-0 text-xs font-medium truncate transition-colors" style={{ color: isActive ? 'white' : 'rgba(255,255,255,0.5)' }}>
                  {layer.labelEs}
                </p>
                <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded-full shrink-0 tabular-nums group-hover/layer:hidden" style={{
                  background: count > 0 ? isActive ? `${lmeta.accent}30` : 'rgba(255,255,255,0.07)' : 'transparent',
                  color: count > 0 ? isActive ? lmeta.accent : 'rgba(255,255,255,0.22)' : 'rgba(255,255,255,0.1)',
                }}>
                  {count}
                </span>
                {/* Delete layer button — visible on hover */}
                <button
                  onClick={e => { e.stopPropagation(); deleteLayer(layer.id, layer.layerKey, layer.labelEs) }}
                  className="hidden group-hover/layer:flex w-5 h-5 shrink-0 items-center justify-center rounded-lg text-[9px] transition-colors"
                  style={{ color: 'rgba(255,255,255,0.25)' }}
                  onMouseEnter={e => (e.currentTarget.style.color = '#fca5a5')}
                  onMouseLeave={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.25)')}
                  title={`Eliminar capa "${layer.labelEs}"`}
                >
                  🗑
                </button>
                {hasWarn && <span className="text-yellow-500 text-[9px] shrink-0">⚠</span>}
                {layer.locked && <span className="text-[9px] shrink-0" style={{ color: 'rgba(255,255,255,0.15)' }}>🔒</span>}
              </div>
            )
          })}
        </div>

        <div className="p-3 border-t" style={{ borderColor: 'rgba(255,255,255,0.05)' }}>
          <p className="text-[9px] text-center" style={{ color: 'rgba(255,255,255,0.15)' }}>
            Arrastra para reordenar
          </p>
        </div>
      </aside>

      {/* ══════════════════════════════════════════════════
          CENTER — Asset picker / Batch upload
      ══════════════════════════════════════════════════ */}
      <section
        className="flex-1 flex flex-col overflow-hidden relative"
        onDragOver={onFileDragOver}
        onDragLeave={onFileDragLeave}
        onDrop={onFileDrop}
      >

        {/* Tab bar */}
        <div className="flex items-stretch shrink-0 border-b" style={{ borderColor: 'rgba(255,255,255,0.06)', background: '#0c0c18', height: 46 }}>

          {/* Assets tab */}
          <button
            onClick={() => setCenterMode('assets')}
            className="flex items-center gap-2 px-4 text-xs font-semibold shrink-0 transition-colors"
            style={{
              color: centerMode === 'assets' ? 'white' : 'rgba(255,255,255,0.38)',
              borderBottom: `2px solid ${centerMode === 'assets' ? '#7c3aed' : 'transparent'}`,
            }}
          >
            <span className="text-base leading-none">{meta.emoji}</span>
            <span className="truncate max-w-[140px]">{selectedLayer?.labelEs ?? 'Assets'}</span>
            <span
              className="text-[9px] font-semibold px-1.5 py-0.5 rounded-full"
              style={{
                background: centerMode === 'assets' ? 'rgba(124,58,237,0.3)' : 'rgba(255,255,255,0.06)',
                color: centerMode === 'assets' ? '#c4b5fd' : 'rgba(255,255,255,0.2)',
              }}
            >
              {layerAssets.length}
            </span>
          </button>

          <div className="w-px my-3 shrink-0" style={{ background: 'rgba(255,255,255,0.06)' }} />

          {/* Batch tab */}
          <button
            onClick={() => setCenterMode('batch')}
            className="flex items-center gap-1.5 px-4 text-xs font-semibold shrink-0 transition-colors"
            style={{
              color: centerMode === 'batch' ? 'white' : 'rgba(255,255,255,0.38)',
              borderBottom: `2px solid ${centerMode === 'batch' ? '#7c3aed' : 'transparent'}`,
            }}
          >
            <svg className="w-3 h-3 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 19V5M5 12l7-7 7 7" />
            </svg>
            Carga por lote
          </button>

          <div className="flex-1" />

          {/* Upload button (always visible in assets mode) */}
          {centerMode === 'assets' && !selectionMode && (
            <div className="flex items-center self-center gap-2 mr-3">
              {layerAssets.length > 0 && (
                <button
                  onClick={() => { setSelectionMode(true); setCenterMode('assets') }}
                  className="flex items-center gap-1.5 text-[10px] font-medium px-2.5 py-1.5 rounded-xl transition-all shrink-0"
                  style={{ background: 'rgba(255,255,255,0.07)', color: 'rgba(255,255,255,0.5)', border: '1px solid rgba(255,255,255,0.1)' }}
                >
                  <svg className="w-3 h-3 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
                    <rect x="3" y="3" width="4" height="4" rx="1" /><rect x="10" y="3" width="4" height="4" rx="1" /><rect x="17" y="3" width="4" height="4" rx="1" />
                    <rect x="3" y="10" width="4" height="4" rx="1" /><rect x="10" y="10" width="4" height="4" rx="1" /><rect x="17" y="10" width="4" height="4" rx="1" />
                    <rect x="3" y="17" width="4" height="4" rx="1" /><rect x="10" y="17" width="4" height="4" rx="1" /><rect x="17" y="17" width="4" height="4" rx="1" />
                  </svg>
                  Editar
                </button>
              )}
              <label
                className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-xl cursor-pointer transition-all shrink-0"
                style={{ background: 'rgba(139,92,246,0.9)', color: 'white' }}
                onMouseEnter={e => (e.currentTarget.style.background = 'rgba(124,58,237,1)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'rgba(139,92,246,0.9)')}
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
                </svg>
                Subir
                <input ref={fileRef} type="file" multiple accept=".svg,.png,.jpg,.jpeg" className="hidden" onChange={e => handleUpload(e.target.files)} />
              </label>
            </div>
          )}

          {/* Selection mode controls */}
          {centerMode === 'assets' && selectionMode && (
            <div className="flex items-center self-center gap-2 mr-3">
              <button
                onClick={() => setSelectedIds(new Set(layerAssets.map(a => a.id)))}
                className="text-[10px] font-medium px-2.5 py-1.5 rounded-xl transition-all"
                style={{ background: 'rgba(255,255,255,0.07)', color: 'rgba(255,255,255,0.5)', border: '1px solid rgba(255,255,255,0.1)' }}
              >
                Todo
              </button>
              <button
                onClick={deleteSelected}
                disabled={selectedIds.size === 0}
                className="text-[10px] font-semibold px-3 py-1.5 rounded-xl flex items-center gap-1.5 transition-all disabled:opacity-30"
                style={{ background: 'rgba(185,28,28,0.85)', color: 'white' }}
              >
                🗑 Eliminar {selectedIds.size > 0 ? selectedIds.size : ''}
              </button>
              <button
                onClick={() => { setSelectionMode(false); setSelectedIds(new Set()) }}
                className="text-[10px] font-medium px-2.5 py-1.5 rounded-xl transition-all"
                style={{ color: 'rgba(255,255,255,0.4)' }}
              >
                ✕
              </button>
            </div>
          )}
        </div>

        {/* Upload log (single-layer mode) */}
        {centerMode === 'assets' && uploadLog.length > 0 && (
          <div className="mx-4 mt-3 rounded-xl p-3 space-y-0.5 shrink-0" style={{ background: 'rgba(255,255,255,0.04)' }}>
            {uploadLog.map((line, i) => (
              <p key={i} className="text-xs" style={{ color: 'rgba(255,255,255,0.6)' }}>{line}</p>
            ))}
          </div>
        )}

        {/* Smart batch uploader */}
        {centerMode === 'batch' && (
          <SmartBatchUploader
            collections={collections}
            layers={collLayers}
            onDone={() => window.location.reload()}
          />
        )}

        {/* Drop overlay */}
        {dropOver && (
          <div
            className="absolute inset-0 z-50 flex flex-col items-center justify-center gap-3 pointer-events-none"
            style={{ background: 'rgba(124,58,237,0.12)', border: '2px dashed rgba(124,58,237,0.5)', margin: 8, borderRadius: 20 }}
          >
            <svg className="w-10 h-10" style={{ color: '#a78bfa' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 19V5M5 12l7-7 7 7" />
            </svg>
            <p className="text-sm font-semibold" style={{ color: '#c4b5fd' }}>
              Suelta para subir a <span style={{ color: 'white' }}>{selectedLayer?.labelEs ?? 'esta capa'}</span>
            </p>
            <p className="text-xs" style={{ color: 'rgba(196,181,253,0.5)' }}>SVG · PNG · JPG</p>
          </div>
        )}

        {/* Grid */}
        {centerMode === 'assets' && <div className="flex-1 overflow-y-auto p-4">
          {layerAssets.length === 0 ? (
            <label className="flex flex-col items-center justify-center h-full rounded-2xl cursor-pointer transition-all group" style={{ border: '2px dashed rgba(255,255,255,0.08)' }}
              onMouseEnter={e => { (e.currentTarget as HTMLLabelElement).style.borderColor = 'rgba(139,92,246,0.4)'; (e.currentTarget as HTMLLabelElement).style.background = 'rgba(139,92,246,0.04)' }}
              onMouseLeave={e => { (e.currentTarget as HTMLLabelElement).style.borderColor = 'rgba(255,255,255,0.08)'; (e.currentTarget as HTMLLabelElement).style.background = 'transparent' }}
            >
              <p className="text-5xl opacity-20 mb-4">{meta.emoji}</p>
              <p className="text-sm font-medium" style={{ color: 'rgba(255,255,255,0.35)' }}>Sin assets — sube el primero</p>
              <p className="text-xs mt-1" style={{ color: 'rgba(255,255,255,0.2)' }}>SVG · PNG · JPG</p>
              <input type="file" multiple accept=".svg,.png,.jpg,.jpeg" className="hidden" onChange={e => handleUpload(e.target.files)} />
            </label>
          ) : (
            <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))' }}>

              {/* None / deselect */}
              <button
                onClick={() => selectAsset(selectedKey, null)}
                className="aspect-square rounded-2xl flex items-center justify-center transition-all"
                style={{
                  border: `2px solid ${avatarState.selectedAssets[selectedKey] === null ? 'rgba(139,92,246,0.8)' : 'rgba(255,255,255,0.08)'}`,
                  background: avatarState.selectedAssets[selectedKey] === null ? 'rgba(139,92,246,0.1)' : 'rgba(255,255,255,0.02)',
                }}
              >
                <span style={{ color: 'rgba(255,255,255,0.2)', fontSize: 22 }}>∅</span>
              </button>

              {layerAssets.map(asset => {
                const isActive   = avatarState.selectedAssets[selectedKey] === asset.id
                const isSelected = selectedIds.has(asset.id)
                return (
                  <div key={asset.id} className="relative aspect-square group">
                    <button
                      onClick={() => selectionMode ? toggleSelectAsset(asset.id) : selectAsset(selectedKey, asset.id)}
                      className="w-full h-full rounded-2xl overflow-hidden transition-all"
                      style={{
                        border: `2px solid ${selectionMode ? (isSelected ? '#ef4444' : 'rgba(255,255,255,0.08)') : isActive ? meta.accent : 'rgba(255,255,255,0.08)'}`,
                        background: selectionMode && isSelected ? 'rgba(239,68,68,0.1)' : 'rgba(255,255,255,0.03)',
                        transform: isActive && !selectionMode ? 'scale(1.04)' : undefined,
                        boxShadow: isActive && !selectionMode ? `0 0 20px ${meta.accent}40` : undefined,
                      }}
                    >
                      {asset.cdnUrl ? (
                        <Image
                          src={asset.cdnUrl}
                          alt={asset.name}
                          width={160} height={160}
                          className="w-full h-full object-cover"
                          unoptimized
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-xs" style={{ color: 'rgba(255,255,255,0.2)' }}>
                          {asset.fileType}
                        </div>
                      )}
                    </button>

                    {/* Selection checkbox */}
                    {selectionMode && (
                      <span className="absolute top-1.5 left-1.5 w-5 h-5 rounded-full flex items-center justify-center border-2 transition-all"
                        style={{
                          background: isSelected ? '#ef4444' : 'rgba(0,0,0,0.5)',
                          borderColor: isSelected ? '#ef4444' : 'rgba(255,255,255,0.3)',
                        }}
                      >
                        {isSelected && <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" /></svg>}
                      </span>
                    )}

                    {/* Default badge */}
                    {asset.isDefault && !selectionMode && (
                      <span className="absolute top-1 left-1 text-white text-[8px] px-1.5 py-0.5 rounded-full font-semibold" style={{ background: 'rgba(139,92,246,1)', lineHeight: 1.5 }}>
                        default
                      </span>
                    )}

                    {/* SVG warning */}
                    {asset.fileType === 'svg' && !asset.svgEditable && (
                      <span className="absolute top-1 right-1 text-yellow-400 text-xs" title="SVG sin colores editables">⚠</span>
                    )}

                    {/* Check mark when active */}
                    {isActive && (
                      <span className="absolute bottom-1.5 right-1.5 w-5 h-5 rounded-full flex items-center justify-center" style={{ background: meta.accent }}>
                        <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                      </span>
                    )}

                    {/* Hover overlay — hidden in selection mode */}
                    <div className={`absolute inset-0 rounded-2xl flex flex-col items-stretch justify-end p-1.5 gap-1 transition-opacity ${selectionMode ? 'opacity-0 pointer-events-none' : 'opacity-0 group-hover:opacity-100'}`} style={{ background: 'rgba(0,0,0,0.75)' }}>
                      <p className="text-[9px] font-medium text-center truncate px-1 pb-0.5" style={{ color: 'rgba(255,255,255,0.6)' }}>
                        {asset.name}
                      </p>
                      <button
                        onClick={e => { e.stopPropagation(); setInspecting(asset) }}
                        className="text-[9px] font-medium rounded-lg py-1 transition-colors text-white"
                        style={{ background: 'rgba(255,255,255,0.15)' }}
                      >
                        ⚙ Editar
                      </button>
                      <button
                        onClick={e => { e.stopPropagation(); setDefault(asset.id) }}
                        className="text-[9px] font-medium rounded-lg py-1 transition-colors text-white"
                        style={{ background: 'rgba(139,92,246,0.9)' }}
                        onMouseEnter={e => (e.currentTarget.style.background = 'rgba(124,58,237,1)')}
                        onMouseLeave={e => (e.currentTarget.style.background = 'rgba(139,92,246,0.9)')}
                      >
                        Default
                      </button>
                      <button
                        onClick={e => { e.stopPropagation(); deleteAsset(asset.id) }}
                        className="text-[9px] font-medium rounded-lg py-1 transition-colors"
                        style={{ background: 'rgba(127,29,29,0.8)', color: 'rgba(252,165,165,1)' }}
                        onMouseEnter={e => (e.currentTarget.style.background = 'rgba(185,28,28,0.9)')}
                        onMouseLeave={e => (e.currentTarget.style.background = 'rgba(127,29,29,0.8)')}
                      >
                        Eliminar
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          {/* Subtle upload hint below the grid */}
          {layerAssets.length > 0 && (
            <label
              className="flex items-center justify-center gap-2 mt-2 mb-4 py-3 rounded-2xl cursor-pointer transition-all"
              style={{ border: '1.5px dashed rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.14)' }}
              onMouseEnter={e => { (e.currentTarget as HTMLLabelElement).style.borderColor = 'rgba(124,58,237,0.3)'; (e.currentTarget as HTMLLabelElement).style.color = 'rgba(196,181,253,0.4)' }}
              onMouseLeave={e => { (e.currentTarget as HTMLLabelElement).style.borderColor = 'rgba(255,255,255,0.06)'; (e.currentTarget as HTMLLabelElement).style.color = 'rgba(255,255,255,0.14)' }}
            >
              <svg className="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              <span className="text-xs font-medium">Arrastra archivos o haz clic para subir más</span>
              <input type="file" multiple accept=".svg,.png,.jpg,.jpeg" className="hidden" onChange={e => handleUpload(e.target.files)} />
            </label>
          )}
        </div>}
      </section>

      {/* ══════════════════════════════════════════════════
          RIGHT — Live preview
      ══════════════════════════════════════════════════ */}
      <aside className="w-[260px] flex flex-col border-l shrink-0" style={{ borderColor: 'rgba(255,255,255,0.05)', background: '#0b0b16' }}>

        {/* Canvas preview */}
        <div className="px-3 pt-3 pb-2 shrink-0">
          <div className="flex items-center justify-between mb-2 px-1">
            <p className="text-[9px] font-semibold uppercase tracking-widest" style={{ color: 'rgba(255,255,255,0.22)' }}>
              Vista previa
            </p>
            <p className="text-[9px]" style={{ color: 'rgba(255,255,255,0.15)' }}>
              {collLayers.filter(l => avatarState.selectedAssets[l.layerKey]).length}/{collLayers.length} capas
            </p>
          </div>
          <div
            className="w-full aspect-square rounded-[20px] overflow-hidden"
            style={{
              background: 'linear-gradient(135deg, rgba(255,255,255,0.04) 0%, rgba(255,255,255,0.02) 100%)',
              boxShadow: '0 8px 32px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.06)',
              border: '1px solid rgba(255,255,255,0.06)',
            }}
          >
            <AvatarCanvas
              state={avatarState}
              layers={collLayers}
              assets={canvasAssets}
            />
          </div>
        </div>

        {/* Controls */}
        <div className="flex-1 overflow-y-auto px-4 pb-4 space-y-4">
          <div className="border-t pt-4 space-y-4" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>

            {/* Skin */}
            <div>
              <p className="text-[9px] font-semibold uppercase tracking-widest mb-2" style={{ color: 'rgba(255,255,255,0.25)' }}>Piel</p>
              <div className="flex flex-wrap gap-1.5">
                {SKIN_TONES.map(hex => (
                  <button
                    key={hex}
                    onClick={() => setSkin(hex)}
                    className="w-7 h-7 rounded-full transition-all"
                    style={{
                      backgroundColor: hex,
                      outline: avatarState.tokens['skin-color'] === hex ? `2px solid #8b5cf6` : `1px solid rgba(255,255,255,0.1)`,
                      outlineOffset: avatarState.tokens['skin-color'] === hex ? 2 : 0,
                      transform: avatarState.tokens['skin-color'] === hex ? 'scale(1.15)' : undefined,
                    }}
                  />
                ))}
              </div>
            </div>

            {/* Hair */}
            <div>
              <p className="text-[9px] font-semibold uppercase tracking-widest mb-2" style={{ color: 'rgba(255,255,255,0.25)' }}>Cabello</p>
              <div className="flex flex-wrap gap-1.5">
                {HAIR_COLORS.map(hex => (
                  <button
                    key={hex}
                    onClick={() => setHair(hex)}
                    className="w-7 h-7 rounded-full transition-all"
                    style={{
                      backgroundColor: hex,
                      outline: avatarState.tokens['hair-color'] === hex ? `2px solid #8b5cf6` : `1px solid rgba(255,255,255,0.1)`,
                      outlineOffset: avatarState.tokens['hair-color'] === hex ? 2 : 0,
                      transform: avatarState.tokens['hair-color'] === hex ? 'scale(1.15)' : undefined,
                    }}
                  />
                ))}
              </div>
            </div>

            {/* Action buttons */}
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={randomize}
                className="text-xs rounded-xl py-2 transition-all font-medium"
                style={{ background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.6)' }}
                onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.1)'; (e.currentTarget as HTMLButtonElement).style.color = 'white' }}
                onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.06)'; (e.currentTarget as HTMLButtonElement).style.color = 'rgba(255,255,255,0.6)' }}
              >
                🎲 Aleatorio
              </button>
              <button
                onClick={reset}
                className="text-xs rounded-xl py-2 transition-all font-medium"
                style={{ background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.6)' }}
                onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.1)'; (e.currentTarget as HTMLButtonElement).style.color = 'white' }}
                onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.06)'; (e.currentTarget as HTMLButtonElement).style.color = 'rgba(255,255,255,0.6)' }}
              >
                ↩ Reset
              </button>
            </div>

            {/* Live transform panel — visible when an asset is selected */}
            {activeAsset && (
              <div className="border-t pt-4 space-y-3" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
                <div className="flex items-center justify-between">
                  <p className="text-[9px] font-semibold uppercase tracking-widest" style={{ color: 'rgba(255,255,255,0.25)' }}>
                    Escala · posición
                  </p>
                  {(activeTransform.scale !== 1 || activeTransform.offsetX !== 0 || activeTransform.offsetY !== 0) && (
                    <button
                      onClick={resetTransform}
                      className="text-[9px]"
                      style={{ color: 'rgba(255,255,255,0.25)' }}
                    >
                      ↩ reset
                    </button>
                  )}
                </div>

                <TransformSlider
                  label={`Escala  ${activeTransform.scale.toFixed(2)}×`}
                  min={0.3} max={2} step={0.01}
                  value={activeTransform.scale}
                  onChange={v => updateTransform('scale', v)}
                />
                <TransformSlider
                  label={`X  ${activeTransform.offsetX > 0 ? '+' : ''}${activeTransform.offsetX}px`}
                  min={-400} max={400} step={4}
                  value={activeTransform.offsetX}
                  onChange={v => updateTransform('offsetX', v)}
                />
                <TransformSlider
                  label={`Y  ${activeTransform.offsetY > 0 ? '+' : ''}${activeTransform.offsetY}px`}
                  min={-400} max={400} step={4}
                  value={activeTransform.offsetY}
                  onChange={v => updateTransform('offsetY', v)}
                />

                {transformDirty && (
                  <button
                    onClick={saveTransform}
                    disabled={savingTransform}
                    className="w-full text-xs font-semibold py-2 rounded-xl transition-all disabled:opacity-50"
                    style={{ background: 'rgba(124,58,237,0.8)', color: 'white' }}
                  >
                    {savingTransform ? 'Guardando…' : '💾 Guardar escala'}
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </aside>

      {/* ══════════════════════════════════════════════════
          Asset Inspector modal
      ══════════════════════════════════════════════════ */}
      {inspecting && (
        <AssetInspector
          asset={inspecting}
          assets={assets}
          keywords={keywords}
          onClose={() => setInspecting(null)}
          onSaved={() => { setInspecting(null); window.location.reload() }}
        />
      )}
    </div>
  )
}

// ── Inline slider for live transform ─────────────────────
function TransformSlider({ label, min, max, step, value, onChange }: {
  label: string; min: number; max: number; step: number; value: number; onChange: (v: number) => void
}) {
  const pct = ((value - min) / (max - min)) * 100
  return (
    <div>
      <p className="text-[9px] mb-1" style={{ color: 'rgba(255,255,255,0.4)' }}>{label}</p>
      <input
        type="range"
        min={min} max={max} step={step}
        value={value}
        onChange={e => onChange(parseFloat(e.target.value))}
        className="w-full h-1 rounded-full appearance-none cursor-pointer"
        style={{
          accentColor: '#7c3aed',
          background: `linear-gradient(to right, #7c3aed ${pct}%, rgba(255,255,255,0.1) 0%)`,
        }}
      />
    </div>
  )
}
