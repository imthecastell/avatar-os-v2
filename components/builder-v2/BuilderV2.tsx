'use client'

import { useCallback, useEffect, useReducer, useRef, useState } from 'react'
import { CompositorV2, type LayerConfig } from '@/lib/engine/compositor-v2'
import FinalComposer from './FinalComposer'

// ── Palettes ──────────────────────────────────────────────────────────────────

const SKIN_TONES  = ['#fddbb4', '#f9c7b6', '#e8a87c', '#c68642', '#8d5524', '#4a2912']
const HAIR_COLORS = ['#f5e6c8', '#c9a84c', '#8b4513', '#3d2314', '#1a1a1a', '#b0b0b0', '#c0392b', '#6b3fa0']

// ── Avatar data ───────────────────────────────────────────────────────────────

const FACE_IDS = ['Face-A', 'Face-AA', 'Face-B', 'Face-BB', 'Face-C', 'Face-CC']

const HAIR_STYLES = ['A', 'B', 'C', 'D', 'E', 'F', 'G'] as const
type HairStyle = typeof HAIR_STYLES[number]

const HAIR_FRONT_ID: Record<HairStyle, string> = {
  A: 'HF-A', B: 'FH-B', C: 'HF-C', D: 'HF-D', E: 'HF-E', F: 'HF-F', G: 'HF-G',
}
const HAIR_BACK_IDS  = HAIR_STYLES.map(s => `BH-${s}`)
const HAIR_FRONT_IDS = HAIR_STYLES.map(s => HAIR_FRONT_ID[s])

const CLOTHES_IDS = ['Camiseta', 'Camiseta1', 'Jacket-B', 'jacket-limited', 'Jacket-Open']
const CLOTHES_LABELS: Record<string, string> = {
  Camiseta: 'T-Shirt A', Camiseta1: 'T-Shirt B',
  'Jacket-B': 'Jacket B', 'jacket-limited': 'Limited', 'Jacket-Open': 'Open',
}

const EMOTION_IDS = ['A', 'B', 'C', 'D', 'E', 'F']
const EMOTION_LABELS: Record<string, string> = {
  A: 'Feliz', B: 'Neutral', C: 'Sorpresa', D: 'Triste', E: 'Enojado', F: 'Cool',
}

function pick<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]
}

// ── State + history ───────────────────────────────────────────────────────────

interface AvatarState {
  skinColor:      string
  hairColor:      string
  faceVariant:    string
  faceWidth:      number
  hairStyle:      HairStyle
  clothesVariant: string
  emotion:        string
  showMask:       boolean
}

const DEFAULT: AvatarState = {
  skinColor: '#f9c7b6', hairColor: '#3d2314',
  faceVariant: 'Face-A', faceWidth: 1.0,
  hairStyle: 'A', clothesVariant: 'Camiseta',
  emotion: 'A', showMask: false,
}

function randomState(): AvatarState {
  return {
    skinColor: pick(SKIN_TONES), hairColor: pick(HAIR_COLORS),
    faceVariant: pick(FACE_IDS),
    faceWidth: Math.round((0.8 + Math.random() * 0.4) * 100) / 100,
    hairStyle: pick(HAIR_STYLES), clothesVariant: pick(CLOTHES_IDS),
    emotion: pick(EMOTION_IDS), showMask: false,
  }
}

type Action =
  | { type: 'SET'; key: keyof AvatarState; value: AvatarState[keyof AvatarState] }
  | { type: 'RANDOM' }
  | { type: 'UNDO' }
  | { type: 'REDO' }

interface History { past: AvatarState[]; present: AvatarState; future: AvatarState[] }

function reducer(h: History, a: Action): History {
  switch (a.type) {
    case 'SET':
      return { past: [...h.past, h.present], present: { ...h.present, [a.key]: a.value }, future: [] }
    case 'RANDOM':
      return { past: [...h.past, h.present], present: randomState(), future: [] }
    case 'UNDO':
      if (!h.past.length) return h
      return { past: h.past.slice(0, -1), present: h.past[h.past.length - 1], future: [h.present, ...h.future] }
    case 'REDO':
      if (!h.future.length) return h
      return { past: [...h.past, h.present], present: h.future[0], future: h.future.slice(1) }
  }
}

// ── Layer builder ─────────────────────────────────────────────────────────────

function buildLayers(s: AvatarState): LayerConfig[] {
  return [
    { file: '/avatars/hair-back.svg',  variants: HAIR_BACK_IDS,  group: `BH-${s.hairStyle}`,          colorKey: 'hair', order: 1 },
    { file: '/avatars/body.svg',                                                                         colorKey: 'skin', order: 2 },
    { file: '/avatars/clothes.svg',    variants: CLOTHES_IDS,     group: s.clothesVariant,                               order: 3 },
    { file: '/avatars/head.svg',       variants: FACE_IDS,        group: s.faceVariant, scaleX: s.faceWidth, colorKey: 'skin', order: 4 },
    { file: '/avatars/emotion.svg',    variants: EMOTION_IDS,     group: s.emotion,                                       order: 5 },
    { file: '/avatars/hair-front.svg', variants: HAIR_FRONT_IDS, group: HAIR_FRONT_ID[s.hairStyle],   colorKey: 'hair', order: 6 },
    ...(s.showMask ? [{ file: '/avatars/mask.svg', order: 7 } as LayerConfig] : []),
  ]
}

// ── Thumbnail hook ────────────────────────────────────────────────────────────

function useBatchThumbnails(
  file: string,
  groups: string[],
  colorKey: 'skin' | 'hair' | null,
  skinColor: string,
  hairColor: string,
): Record<string, string> {
  const [urls, setUrls] = useState<Record<string, string>>({})
  const depKey = colorKey === 'skin' ? skinColor : colorKey === 'hair' ? hairColor : '__static__'

  useEffect(() => {
    let cancelled = false
    setUrls({})
    ;(async () => {
      for (const g of groups) {
        if (cancelled) return
        const canvas = document.createElement('canvas')
        const comp   = new CompositorV2()
        comp.init(canvas, 80)
        await comp.render({
          layers: [{ file, variants: groups, group: g, colorKey: colorKey ?? undefined, order: 1 }],
          skinColor,
          hairColor,
        })
        const dataUrl = comp.exportPNG()
        if (!cancelled) setUrls(prev => ({ ...prev, [g]: dataUrl }))
      }
    })()
    return () => { cancelled = true }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [file, depKey])

  return urls
}

// ── UI primitives ─────────────────────────────────────────────────────────────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ padding: '14px 16px 16px', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
      <p style={{
        fontSize: 9, fontWeight: 700, letterSpacing: '0.13em',
        textTransform: 'uppercase', color: 'rgba(255,255,255,0.22)',
        margin: '0 0 10px',
      }}>
        {title}
      </p>
      {children}
    </div>
  )
}

function Swatches({ colors, active, onPick }: { colors: string[]; active: string; onPick: (c: string) => void }) {
  return (
    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>
      {colors.map(c => (
        <button
          key={c}
          onClick={() => onPick(c)}
          style={{
            width: 22, height: 22, borderRadius: '50%', background: c,
            border: active === c ? '2.5px solid white' : '2px solid rgba(255,255,255,0.08)',
            boxShadow: active === c ? '0 0 0 2px rgba(255,255,255,0.25)' : 'none',
            transform: active === c ? 'scale(1.15)' : 'scale(1)',
            cursor: 'pointer', transition: 'transform 0.1s, box-shadow 0.1s',
          }}
        />
      ))}
    </div>
  )
}

function ThumbGrid({
  ids, labels, thumbs, active, onSelect, cols = 4,
}: {
  ids: readonly string[]
  labels?: Record<string, string>
  thumbs: Record<string, string>
  active: string
  onSelect: (id: string) => void
  cols?: number
}) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: `repeat(${cols}, 1fr)`, gap: 5 }}>
      {ids.map(id => {
        const on = active === id
        return (
          <button
            key={id}
            onClick={() => onSelect(id)}
            title={labels?.[id] ?? id}
            style={{
              aspectRatio: '1', borderRadius: 9, padding: 0, overflow: 'hidden',
              border: `2px solid ${on ? 'rgba(255,255,255,0.55)' : 'rgba(255,255,255,0.07)'}`,
              background: on ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.02)',
              cursor: 'pointer', transition: 'border-color 0.1s, background 0.1s',
            }}
          >
            {thumbs[id] ? (
              <img
                src={thumbs[id]}
                alt={labels?.[id] ?? id}
                style={{ width: '100%', height: '100%', objectFit: 'contain', display: 'block' }}
              />
            ) : (
              <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <div style={{ width: 12, height: 12, borderRadius: '50%', background: 'rgba(255,255,255,0.07)' }} />
              </div>
            )}
          </button>
        )
      })}
    </div>
  )
}

function Btn({
  onClick, disabled, primary, title, children,
}: {
  onClick: () => void
  disabled?: boolean
  primary?: boolean
  title?: string
  children: React.ReactNode
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={title}
      style={primary ? {
        padding: '10px 20px', borderRadius: 10, border: 'none',
        background: disabled ? 'rgba(255,255,255,0.2)' : 'white',
        color: '#0d0d0f', fontSize: 13, fontWeight: 700,
        cursor: disabled ? 'not-allowed' : 'pointer',
        letterSpacing: '-0.01em', transition: 'opacity 0.1s',
        opacity: disabled ? 0.5 : 1,
      } : {
        padding: '10px 14px', borderRadius: 10,
        border: '1px solid rgba(255,255,255,0.1)',
        background: 'rgba(255,255,255,0.04)',
        color: disabled ? 'rgba(255,255,255,0.18)' : 'rgba(255,255,255,0.65)',
        fontSize: 13, cursor: disabled ? 'not-allowed' : 'pointer',
        transition: 'all 0.1s',
      }}
    >
      {children}
    </button>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

export default function BuilderV2() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const compRef   = useRef<CompositorV2 | null>(null)
  const [h, dispatch]            = useReducer(reducer, { past: [], present: DEFAULT, future: [] })
  const state                    = h.present
  const [rendering, setRendering]         = useState(false)
  const [avatarForComposer, setAvatarForComposer] = useState<string | null>(null)

  // ── Compositor ─────────────────────────────────────────────────────────────

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
    comp.render({ layers: buildLayers(state), skinColor: state.skinColor, hairColor: state.hairColor })
      .catch(console.error)
      .finally(() => setRendering(false))
  }, [state])

  // ── Thumbnails ─────────────────────────────────────────────────────────────

  const faceThumbs    = useBatchThumbnails('/avatars/head.svg',        FACE_IDS,       'skin', state.skinColor, state.hairColor)
  const hairFThumbs   = useBatchThumbnails('/avatars/hair-front.svg',  HAIR_FRONT_IDS, 'hair', state.skinColor, state.hairColor)
  const clothesThumbs = useBatchThumbnails('/avatars/clothes.svg',     CLOTHES_IDS,    null,   state.skinColor, state.hairColor)
  const emotionThumbs = useBatchThumbnails('/avatars/emotion.svg',     EMOTION_IDS,    null,   state.skinColor, state.hairColor)

  // Remap hair front thumbnails to be keyed by style letter (A–G)
  const hairStyleThumbs: Record<string, string> = {}
  HAIR_STYLES.forEach(s => {
    const v = hairFThumbs[HAIR_FRONT_ID[s]]
    if (v) hairStyleThumbs[s] = v
  })

  // ── Handlers ───────────────────────────────────────────────────────────────

  const set = useCallback(
    <K extends keyof AvatarState>(k: K, v: AvatarState[K]) =>
      dispatch({ type: 'SET', key: k, value: v }),
    [],
  )

  const handleExport = useCallback(() => {
    const url = compRef.current?.exportPNG()
    if (!url) return
    const a = document.createElement('a')
    a.href = url; a.download = 'avatar.png'; a.click()
  }, [])

  const handleGoToComposer = useCallback(() => {
    const url = compRef.current?.exportPNG()
    if (url) setAvatarForComposer(url)
  }, [])

  if (avatarForComposer) {
    return <FinalComposer avatarDataUrl={avatarForComposer} onBack={() => setAvatarForComposer(null)} />
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div style={{
      display: 'flex', height: '100dvh',
      background: '#0d0d0f', color: 'white',
      fontFamily: '"Inter", system-ui, -apple-system, sans-serif',
      overflow: 'hidden',
    }}>
      {/* ── Left sidebar ── */}
      <div style={{
        width: 280, flexShrink: 0, overflowY: 'auto',
        background: '#111115',
        borderRight: '1px solid rgba(255,255,255,0.05)',
      }}>
        {/* Logo / header */}
        <div style={{ padding: '18px 16px 14px', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
          <span style={{ fontSize: 13, fontWeight: 700, letterSpacing: '-0.02em' }}>Avatar Studio</span>
        </div>

        {/* Piel & Cara */}
        <Section title="Piel & Cara">
          <Swatches colors={SKIN_TONES} active={state.skinColor} onPick={c => set('skinColor', c)} />
          <ThumbGrid ids={FACE_IDS} thumbs={faceThumbs} active={state.faceVariant} onSelect={id => set('faceVariant', id)} cols={3} />
          <div style={{ marginTop: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
              <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.2)' }}>
                Ancho cara
              </span>
              <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.2)', fontVariantNumeric: 'tabular-nums' }}>
                {state.faceWidth.toFixed(2)}×
              </span>
            </div>
            <input
              type="range" min={0.75} max={1.25} step={0.01}
              value={state.faceWidth}
              onChange={e => set('faceWidth', parseFloat(e.target.value))}
              style={{ width: '100%', accentColor: 'rgba(255,255,255,0.55)', margin: 0 }}
            />
          </div>
        </Section>

        {/* Cabello */}
        <Section title="Cabello">
          <Swatches colors={HAIR_COLORS} active={state.hairColor} onPick={c => set('hairColor', c)} />
          <ThumbGrid
            ids={HAIR_STYLES}
            thumbs={hairStyleThumbs}
            active={state.hairStyle}
            onSelect={id => set('hairStyle', id as HairStyle)}
            cols={4}
          />
        </Section>

        {/* Ropa */}
        <Section title="Ropa">
          <ThumbGrid
            ids={CLOTHES_IDS} labels={CLOTHES_LABELS}
            thumbs={clothesThumbs}
            active={state.clothesVariant}
            onSelect={id => set('clothesVariant', id)}
            cols={3}
          />
        </Section>

        {/* Expresión */}
        <Section title="Expresión">
          <ThumbGrid
            ids={EMOTION_IDS} labels={EMOTION_LABELS}
            thumbs={emotionThumbs}
            active={state.emotion}
            onSelect={id => set('emotion', id)}
            cols={3}
          />
        </Section>

        {/* Extras */}
        <Section title="Extras">
          <label style={{
            display: 'flex', alignItems: 'center', gap: 8,
            cursor: 'pointer', fontSize: 12, color: 'rgba(255,255,255,0.4)',
          }}>
            <input
              type="checkbox" checked={state.showMask}
              onChange={e => set('showMask', e.target.checked)}
              style={{ accentColor: 'white', width: 14, height: 14 }}
            />
            Máscara
          </label>
        </Section>
      </div>

      {/* ── Center ── */}
      <div style={{
        flex: 1, display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        padding: '40px 48px', gap: 28,
      }}>
        {/* Avatar preview — circular */}
        <div style={{
          position: 'relative',
          width: 'min(420px, calc(100vh - 220px))',
          aspectRatio: '1',
          borderRadius: '50%',
          overflow: 'hidden',
          background: 'radial-gradient(ellipse at 35% 25%, rgba(90,60,140,0.18) 0%, #17171c 65%)',
          boxShadow: '0 0 0 1px rgba(255,255,255,0.06), 0 40px 100px rgba(0,0,0,0.85)',
          flexShrink: 0,
        }}>
          <canvas ref={canvasRef} style={{ width: '100%', height: '100%', display: 'block' }} />
          {rendering && (
            <div style={{
              position: 'absolute', inset: 0,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: 'rgba(0,0,0,0.2)',
              fontSize: 9, letterSpacing: '0.12em', color: 'rgba(255,255,255,0.2)',
            }}>
              RENDERIZANDO
            </div>
          )}
        </div>

        {/* Action bar */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <Btn onClick={() => dispatch({ type: 'RANDOM' })} disabled={rendering}>
            🎲 Aleatorio
          </Btn>
          <Btn onClick={() => dispatch({ type: 'UNDO' })} disabled={!h.past.length} title="Deshacer">
            ↩
          </Btn>
          <Btn onClick={() => dispatch({ type: 'REDO' })} disabled={!h.future.length} title="Rehacer">
            ↪
          </Btn>

          <div style={{ width: 1, height: 20, background: 'rgba(255,255,255,0.08)', margin: '0 2px' }} />

          <Btn onClick={handleExport} disabled={rendering}>
            ⬇ Descargar
          </Btn>
          <Btn onClick={handleGoToComposer} disabled={rendering} primary>
            Marco final →
          </Btn>
        </div>
      </div>
    </div>
  )
}
