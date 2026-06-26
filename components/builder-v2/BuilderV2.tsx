'use client'

import { useEffect, useReducer, useState } from 'react'
import { useRouter } from 'next/navigation'
import { getAllLayers, getBlobUrl, getPreviewUrls } from '@/lib/svg/upload-store'

// ── State ─────────────────────────────────────────────────────────────────────

interface BuilderState {
  // layerKey → selected variantId
  selected: Record<string, string>
}

type Action =
  | { type: 'SET_VARIANT'; layerKey: string; variantId: string }
  | { type: 'RANDOM'; layers: ReturnType<typeof getAllLayers> }
  | { type: 'UNDO' }
  | { type: 'REDO' }

interface History {
  past:    BuilderState[]
  present: BuilderState
  future:  BuilderState[]
}

function defaultSelected(layers: ReturnType<typeof getAllLayers>): Record<string, string> {
  const out: Record<string, string> = {}
  for (const l of layers) {
    if (l.variantIds.length > 0) out[l.key] = l.variantIds[0]
  }
  return out
}

function randomSelected(layers: ReturnType<typeof getAllLayers>): Record<string, string> {
  const out: Record<string, string> = {}
  for (const l of layers) {
    if (l.variantIds.length > 0) {
      out[l.key] = l.variantIds[Math.floor(Math.random() * l.variantIds.length)]
    }
  }
  return out
}

function reducer(h: History, a: Action): History {
  switch (a.type) {
    case 'SET_VARIANT': {
      const next = { ...h.present, selected: { ...h.present.selected, [a.layerKey]: a.variantId } }
      return { past: [...h.past, h.present], present: next, future: [] }
    }
    case 'RANDOM': {
      const next = { ...h.present, selected: randomSelected(a.layers) }
      return { past: [...h.past, h.present], present: next, future: [] }
    }
    case 'UNDO':
      if (!h.past.length) return h
      return { past: h.past.slice(0, -1), present: h.past[h.past.length - 1], future: [h.present, ...h.future] }
    case 'REDO':
      if (!h.future.length) return h
      return { past: [...h.past, h.present], present: h.future[0], future: h.future.slice(1) }
  }
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function BuilderV2() {
  const router = useRouter()
  const [layers, setLayers] = useState<ReturnType<typeof getAllLayers>>([])
  const [history, dispatch] = useReducer(reducer, {
    past: [], present: { selected: {} }, future: [],
  })

  // Reload layers from store whenever component mounts or navigates here
  useEffect(() => {
    const all = getAllLayers()
    setLayers(all)
    if (Object.keys(history.present.selected).length === 0 && all.length > 0) {
      dispatch({ type: 'RANDOM', layers: all })
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const { selected } = history.present
  const noLayers     = layers.length === 0

  return (
    <div style={s.root}>
      {/* ── Sidebar ─────────────────────────────────────────────────────── */}
      <aside style={s.sidebar}>
        <div style={s.sidebarTop}>
          <span style={s.logo}>Avatar OS</span>
          <button style={s.addBtn} onClick={() => router.push('/es/svg-processor')}>
            + Capa
          </button>
        </div>

        {noLayers ? (
          <div style={s.empty}>
            <p style={s.emptyText}>
              No hay capas cargadas.<br />
              Sube un SVG para empezar.
            </p>
            <button style={s.primaryBtn} onClick={() => router.push('/es/svg-processor')}>
              Subir SVG →
            </button>
          </div>
        ) : (
          <div style={s.layerList}>
            {layers.map(layer => (
              <LayerSection
                key={layer.key}
                layer={layer}
                selectedVariant={selected[layer.key] ?? layer.variantIds[0]}
                onSelect={(vid) => dispatch({ type: 'SET_VARIANT', layerKey: layer.key, variantId: vid })}
              />
            ))}
          </div>
        )}
      </aside>

      {/* ── Canvas area ─────────────────────────────────────────────────── */}
      <main style={s.main}>
        {/* Toolbar */}
        <div style={s.toolbar}>
          <button style={s.toolBtn} onClick={() => dispatch({ type: 'UNDO' })}
            disabled={!history.past.length}>↩ Deshacer</button>
          <button style={s.toolBtn} onClick={() => dispatch({ type: 'REDO' })}
            disabled={!history.future.length}>↪ Rehacer</button>
          <button style={s.toolBtn} onClick={() => dispatch({ type: 'RANDOM', layers })}>
            🎲 Random
          </button>
        </div>

        {/* Avatar preview — CSS stacked img layers */}
        <div style={s.previewWrap}>
          <div style={s.circle}>
            {noLayers ? (
              <div style={s.placeholder}>
                <span style={{ fontSize: 48 }}>🎨</span>
                <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: 14, marginTop: 12 }}>
                  Sube capas para ver el avatar
                </p>
              </div>
            ) : (
              layers.map(layer => {
                const variantId = selected[layer.key] ?? layer.variantIds[0]
                const url       = getBlobUrl(layer.key, variantId)
                if (!url) return null
                return (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    key={layer.key}
                    src={url}
                    alt={layer.name}
                    style={s.layer}
                  />
                )
              })
            )}
          </div>
        </div>
      </main>
    </div>
  )
}

// ── Layer section ─────────────────────────────────────────────────────────────

function LayerSection({
  layer,
  selectedVariant,
  onSelect,
}: {
  layer:           ReturnType<typeof getAllLayers>[number]
  selectedVariant: string
  onSelect:        (id: string) => void
}) {
  const previews = getPreviewUrls(layer.key)

  return (
    <div style={s.section}>
      <div style={s.sectionHeader}>
        <span style={s.sectionName}>{layer.name}</span>
        <span style={s.sectionOrder}>z{layer.order}</span>
      </div>
      <div style={s.thumbGrid}>
        {layer.variantIds.map(vid => {
          const active = vid === selectedVariant
          return (
            <button key={vid} onClick={() => onSelect(vid)} title={vid}
              style={{ ...s.thumb, ...(active ? s.thumbActive : {}) }}>
              {previews[vid]
                // eslint-disable-next-line @next/next/no-img-element
                ? <img src={previews[vid]} alt={vid} style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                : <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: 10 }}>{vid}</span>
              }
            </button>
          )
        })}
      </div>
    </div>
  )
}

// ── Styles ────────────────────────────────────────────────────────────────────

const s = {
  root: {
    display: 'flex', height: '100vh', background: '#0f0f0f',
    fontFamily: 'system-ui, sans-serif', overflow: 'hidden',
  } as React.CSSProperties,

  sidebar: {
    width: 280, flexShrink: 0,
    background: '#141414', borderRight: '1px solid rgba(255,255,255,0.06)',
    display: 'flex', flexDirection: 'column', overflow: 'hidden',
  } as React.CSSProperties,

  sidebarTop: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '18px 16px', borderBottom: '1px solid rgba(255,255,255,0.06)',
  } as React.CSSProperties,

  logo: { color: '#fff', fontWeight: 700, fontSize: 16 } as React.CSSProperties,

  addBtn: {
    background: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.7)',
    border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8,
    padding: '6px 12px', fontSize: 13, cursor: 'pointer',
  } as React.CSSProperties,

  layerList: { flex: 1, overflowY: 'auto', padding: '8px 0' } as React.CSSProperties,

  section: {
    padding: '14px 16px 16px',
    borderBottom: '1px solid rgba(255,255,255,0.04)',
  } as React.CSSProperties,

  sectionHeader: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    marginBottom: 10,
  } as React.CSSProperties,

  sectionName: {
    color: 'rgba(255,255,255,0.55)', fontSize: 10,
    fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase',
  } as React.CSSProperties,

  sectionOrder: {
    color: 'rgba(255,255,255,0.2)', fontSize: 10,
  } as React.CSSProperties,

  thumbGrid: {
    display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 5,
  } as React.CSSProperties,

  thumb: {
    aspectRatio: '1', borderRadius: 8, overflow: 'hidden', cursor: 'pointer',
    border: '2px solid rgba(255,255,255,0.06)',
    background: 'rgba(255,255,255,0.02)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    padding: 0, transition: 'border-color 0.1s',
  } as React.CSSProperties,

  thumbActive: {
    border: '2px solid rgba(255,255,255,0.55)',
    background: 'rgba(255,255,255,0.06)',
  } as React.CSSProperties,

  empty: {
    flex: 1, display: 'flex', flexDirection: 'column',
    alignItems: 'center', justifyContent: 'center',
    padding: 24, gap: 16,
  } as React.CSSProperties,

  emptyText: {
    color: 'rgba(255,255,255,0.3)', fontSize: 14,
    textAlign: 'center', lineHeight: 1.6, margin: 0,
  } as React.CSSProperties,

  primaryBtn: {
    background: '#fff', color: '#000', border: 'none',
    borderRadius: 10, padding: '12px 20px', fontSize: 14,
    fontWeight: 600, cursor: 'pointer',
  } as React.CSSProperties,

  main: {
    flex: 1, display: 'flex', flexDirection: 'column',
    alignItems: 'center', justifyContent: 'center', gap: 32,
  } as React.CSSProperties,

  toolbar: { display: 'flex', gap: 8 } as React.CSSProperties,

  toolBtn: {
    background: 'rgba(255,255,255,0.07)', color: 'rgba(255,255,255,0.7)',
    border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10,
    padding: '8px 16px', fontSize: 13, cursor: 'pointer',
  } as React.CSSProperties,

  previewWrap: {
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  } as React.CSSProperties,

  circle: {
    width: 420, height: 420, borderRadius: '50%',
    overflow: 'hidden', background: '#1e1e1e',
    border: '2px solid rgba(255,255,255,0.08)',
    position: 'relative',
    boxShadow: '0 0 80px rgba(0,0,0,0.5)',
  } as React.CSSProperties,

  layer: {
    position: 'absolute', inset: 0,
    width: '100%', height: '100%',
    objectFit: 'contain',
  } as React.CSSProperties,

  placeholder: {
    width: '100%', height: '100%',
    display: 'flex', flexDirection: 'column',
    alignItems: 'center', justifyContent: 'center',
  } as React.CSSProperties,
}
