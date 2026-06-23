'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { CompositorV2, type LayerConfig } from '@/lib/engine/compositor-v2'
import FinalComposer from './FinalComposer'

// ─── Palettes ────────────────────────────────────────────────────────────────

const SKIN_TONES = ['#fddbb4', '#f9c7b6', '#e8a87c', '#c68642', '#8d5524', '#4a2912']
const HAIR_COLORS = ['#f5e6c8', '#c9a84c', '#8b4513', '#3d2314', '#1a1a1a', '#b0b0b0', '#c0392b']

// ─── Domain data ─────────────────────────────────────────────────────────────

const FACE_VARIANTS = [
  { id: 'Face-A',  label: 'A' },
  { id: 'Face-AA', label: 'AA' },
  { id: 'Face-B',  label: 'B' },
  { id: 'Face-BB', label: 'BB' },
  { id: 'Face-C',  label: 'C' },
  { id: 'Face-CC', label: 'CC' },
]

const HAIR_STYLES = ['A', 'B', 'C', 'D', 'E', 'F', 'G'] as const
type HairStyle = typeof HAIR_STYLES[number]

const HAIR_FRONT_ID: Record<HairStyle, string> = {
  A: 'HF-A', B: 'FH-B', C: 'HF-C', D: 'HF-D', E: 'HF-E', F: 'HF-F', G: 'HF-G',
}
const HAIR_BACK_IDS  = HAIR_STYLES.map(s => `BH-${s}`)
const HAIR_FRONT_IDS = HAIR_STYLES.map(s => HAIR_FRONT_ID[s])

const CLOTHES_VARIANTS = [
  { id: 'Camiseta',       label: 'Camiseta A' },
  { id: 'Camiseta1',      label: 'Camiseta B' },
  { id: 'Jacket-B',       label: 'Jacket B' },
  { id: 'jacket-limited', label: 'Jacket Limited' },
  { id: 'Jacket-Open',    label: 'Jacket Open' },
]

const EMOTION_VARIANTS = ['A', 'B', 'C', 'D', 'E', 'F']

// ─── State ───────────────────────────────────────────────────────────────────

interface BuilderState {
  skinColor:     string
  hairColor:     string
  faceVariant:   string
  faceWidth:     number        // scaleX 0.75–1.25
  hairStyle:     HairStyle
  clothesVariant: string
  emotion:       string
  showMask:      boolean
}

const DEFAULT_STATE: BuilderState = {
  skinColor:      '#f9c7b6',   // matches SKIN_REF rgb
  hairColor:      '#3d2314',
  faceVariant:    'Face-A',
  faceWidth:      1.0,
  hairStyle:      'A',
  clothesVariant: 'Camiseta',
  emotion:        'A',
  showMask:       false,
}

// ─── Layer builder ───────────────────────────────────────────────────────────

function buildLayers(s: BuilderState): LayerConfig[] {
  const frontId = HAIR_FRONT_ID[s.hairStyle]
  const backId  = `BH-${s.hairStyle}`

  const layers: LayerConfig[] = [
    {
      file:     '/avatars/hair-back.svg',
      variants: HAIR_BACK_IDS,
      group:    backId,
      colorKey: 'hair',
      order:    1,
    },
    {
      file:     '/avatars/body.svg',
      colorKey: 'skin',
      order:    2,
    },
    {
      file:     '/avatars/clothes.svg',
      variants: CLOTHES_VARIANTS.map(c => c.id),
      group:    s.clothesVariant,
      order:    3,
    },
    {
      file:     '/avatars/head.svg',
      variants: FACE_VARIANTS.map(f => f.id),
      group:    s.faceVariant,
      scaleX:   s.faceWidth,
      colorKey: 'skin',
      order:    4,
    },
    {
      file:     '/avatars/emotion.svg',
      variants: EMOTION_VARIANTS,
      group:    s.emotion,
      order:    5,
    },
    {
      file:     '/avatars/hair-front.svg',
      variants: HAIR_FRONT_IDS,
      group:    frontId,
      colorKey: 'hair',
      order:    6,
    },
  ]

  if (s.showMask) {
    layers.push({ file: '/avatars/mask.svg', order: 7 })
  }

  return layers
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function Swatch({ color, active, onClick }: { color: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      title={color}
      style={{
        width: 30, height: 30, borderRadius: '50%',
        background: color,
        border: active ? '3px solid white' : '2px solid rgba(255,255,255,0.12)',
        boxShadow: active ? '0 0 0 2px rgba(255,255,255,0.4)' : 'none',
        cursor: 'pointer',
        flexShrink: 0,
        transition: 'transform 0.1s, box-shadow 0.1s',
      }}
    />
  )
}

function Chip({
  label, active, onClick,
}: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: '6px 12px',
        borderRadius: 8,
        border: active ? '1.5px solid rgba(255,255,255,0.5)' : '1.5px solid rgba(255,255,255,0.1)',
        background: active ? 'rgba(255,255,255,0.12)' : 'transparent',
        color: active ? 'white' : 'rgba(255,255,255,0.35)',
        fontSize: 12,
        fontWeight: active ? 600 : 400,
        cursor: 'pointer',
        transition: 'all 0.12s',
        whiteSpace: 'nowrap',
      }}
    >
      {label}
    </button>
  )
}

function Label({ children }: { children: React.ReactNode }) {
  return (
    <p style={{
      fontSize: 9, fontWeight: 700, letterSpacing: '0.12em',
      textTransform: 'uppercase', color: 'rgba(255,255,255,0.22)',
      marginBottom: 8,
    }}>
      {children}
    </p>
  )
}

function Divider() {
  return <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }} />
}

// ─── Main component ──────────────────────────────────────────────────────────

export default function BuilderV2() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const compRef   = useRef<CompositorV2 | null>(null)
  const [state, setState]       = useState<BuilderState>(DEFAULT_STATE)
  const [rendering, setRendering] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [avatarForComposer, setAvatarForComposer] = useState<string | null>(null)

  useEffect(() => {
    if (!canvasRef.current) return
    const comp = new CompositorV2()
    comp.init(canvasRef.current, 1024)
    compRef.current = comp
  }, [])

  useEffect(() => {
    const comp = compRef.current
    if (!comp) return
    setRendering(true)
    comp
      .render({ layers: buildLayers(state), skinColor: state.skinColor, hairColor: state.hairColor })
      .catch(console.error)
      .finally(() => setRendering(false))
  }, [state])

  const set = useCallback(<K extends keyof BuilderState>(k: K, v: BuilderState[K]) => {
    setState(prev => ({ ...prev, [k]: v }))
  }, [])

  const handleExport = useCallback(() => {
    const comp = compRef.current
    if (!comp) return
    setExporting(true)
    setTimeout(() => {
      const url = comp.exportPNG()
      const a   = document.createElement('a')
      a.href    = url
      a.download = 'avatar.png'
      a.click()
      setExporting(false)
    }, 80)
  }, [])

  const handleGoToComposer = useCallback(() => {
    const comp = compRef.current
    if (!comp) return
    setAvatarForComposer(comp.exportPNG())
  }, [])

  if (avatarForComposer) {
    return (
      <FinalComposer
        avatarDataUrl={avatarForComposer}
        onBack={() => setAvatarForComposer(null)}
      />
    )
  }

  return (
    <div style={{
      display: 'flex', height: '100dvh',
      background: '#0f0f10', color: 'white',
      fontFamily: 'system-ui, -apple-system, sans-serif',
      overflow: 'hidden',
    }}>

      {/* ── Canvas ── */}
      <div style={{
        flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 32, background: 'rgba(255,255,255,0.015)',
      }}>
        <div style={{
          position: 'relative', maxWidth: 480, width: '100%', aspectRatio: '1',
          borderRadius: 24, overflow: 'hidden',
          boxShadow: '0 24px 80px rgba(0,0,0,0.6)',
          border: '1px solid rgba(255,255,255,0.07)',
          background: '#1a1a1c',
        }}>
          <canvas ref={canvasRef} style={{ width: '100%', height: '100%', display: 'block' }} />
          {rendering && (
            <div style={{
              position: 'absolute', inset: 0,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: 'rgba(0,0,0,0.35)',
              fontSize: 11, color: 'rgba(255,255,255,0.4)',
              letterSpacing: '0.08em',
            }}>
              RENDERING…
            </div>
          )}
        </div>
      </div>

      {/* ── Controls ── */}
      <div style={{
        width: 280, overflowY: 'auto',
        borderLeft: '1px solid rgba(255,255,255,0.06)',
        padding: '24px 16px',
        display: 'flex', flexDirection: 'column', gap: 20,
      }}>

        {/* Cara */}
        <div>
          <Label>Forma de cara</Label>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {FACE_VARIANTS.map(f => (
              <Chip key={f.id} label={f.label} active={state.faceVariant === f.id} onClick={() => set('faceVariant', f.id)} />
            ))}
          </div>
        </div>

        {/* Ancho de cara */}
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
            <Label>Ancho de cara</Label>
            <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.25)' }}>{state.faceWidth.toFixed(2)}×</span>
          </div>
          <input type="range" min={0.75} max={1.25} step={0.01}
            value={state.faceWidth}
            onChange={e => set('faceWidth', parseFloat(e.target.value))}
            style={{ width: '100%', accentColor: 'white' }}
          />
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
            <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.18)' }}>Flaco</span>
            <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.18)' }}>Ancho</span>
          </div>
        </div>

        {/* Tono de piel */}
        <div>
          <Label>Tono de piel</Label>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {SKIN_TONES.map(c => (
              <Swatch key={c} color={c} active={state.skinColor === c} onClick={() => set('skinColor', c)} />
            ))}
          </div>
        </div>

        <Divider />

        {/* Estilo cabello */}
        <div>
          <Label>Estilo de cabello</Label>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {HAIR_STYLES.map(s => (
              <Chip key={s} label={s} active={state.hairStyle === s} onClick={() => set('hairStyle', s)} />
            ))}
          </div>
        </div>

        {/* Color cabello */}
        <div>
          <Label>Color de cabello</Label>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {HAIR_COLORS.map(c => (
              <Swatch key={c} color={c} active={state.hairColor === c} onClick={() => set('hairColor', c)} />
            ))}
          </div>
        </div>

        <Divider />

        {/* Ropa */}
        <div>
          <Label>Ropa</Label>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {CLOTHES_VARIANTS.map(c => (
              <Chip key={c.id} label={c.label} active={state.clothesVariant === c.id} onClick={() => set('clothesVariant', c.id)} />
            ))}
          </div>
        </div>

        <Divider />

        {/* Expresión */}
        <div>
          <Label>Expresión</Label>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {EMOTION_VARIANTS.map(e => (
              <Chip key={e} label={e} active={state.emotion === e} onClick={() => set('emotion', e)} />
            ))}
          </div>
        </div>

        {/* Máscara */}
        <div>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={state.showMask}
              onChange={e => set('showMask', e.target.checked)}
              style={{ accentColor: 'white', width: 14, height: 14 }}
            />
            <Label>Máscara</Label>
          </label>
        </div>

        <Divider />

        {/* Go to final composer */}
        <button
          onClick={handleGoToComposer}
          disabled={rendering}
          style={{
            padding: '13px 0', borderRadius: 12, border: 'none',
            background: rendering ? 'rgba(255,255,255,0.07)' : 'white',
            color: rendering ? 'rgba(255,255,255,0.25)' : '#0f0f10',
            fontSize: 13, fontWeight: 700, cursor: rendering ? 'not-allowed' : 'pointer',
            letterSpacing: '0.03em', transition: 'all 0.15s',
          }}
        >
          Marco final →
        </button>

        {/* Export avatar only */}
        <button
          onClick={handleExport}
          disabled={exporting || rendering}
          style={{
            padding: '10px 0', borderRadius: 12,
            border: '1.5px solid rgba(255,255,255,0.12)',
            background: 'transparent',
            color: (exporting || rendering) ? 'rgba(255,255,255,0.15)' : 'rgba(255,255,255,0.4)',
            fontSize: 12, cursor: (exporting || rendering) ? 'not-allowed' : 'pointer',
            letterSpacing: '0.03em', transition: 'all 0.15s',
          }}
        >
          {exporting ? 'Exportando…' : 'Descargar solo avatar'}
        </button>

        <div style={{ height: 8 }} />
      </div>
    </div>
  )
}
