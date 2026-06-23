'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { CompositorFinal } from '@/lib/engine/compositor-final'

const BACKGROUNDS = [
  { id: 'oleo-pot',   label: 'Óleo POT',      url: '/avatars/bg - oleo POT.png' },
  { id: 'oleo-blue',  label: 'Óleo Azul',     url: '/avatars/bg - oleo blue.png' },
  { id: 'oleo-dark',  label: 'Óleo Dark',     url: '/avatars/bg - oleo dark.png' },
  { id: 'oleo-mod',   label: 'Óleo Mod',      url: '/avatars/bg - oleo Mod.png' },
  { id: 'oleo-w1',    label: 'Óleo W1',       url: '/avatars/bg - oleo W1.png' },
  { id: 'oleo-w2',    label: 'Óleo W2',       url: '/avatars/bg - oleo W2.png' },
  { id: 'sky',        label: 'Cielo',         url: '/avatars/bg - sky.png' },
  { id: 'desert',     label: 'Desierto',      url: '/avatars/bg - desert.png' },
  { id: 'arch',       label: 'Arco',          url: '/avatars/bg - arch.png' },
  { id: 'stairs',     label: 'Escaleras',     url: '/avatars/bg - stairs.png' },
  { id: 'structure',  label: 'Estructura',    url: '/avatars/bg - structure.png' },
]

interface Props {
  avatarDataUrl: string
  onBack: () => void
}

export default function FinalComposer({ avatarDataUrl, onBack }: Props) {
  const canvasRef    = useRef<HTMLCanvasElement>(null)
  const compRef      = useRef<CompositorFinal | null>(null)
  const [bg, setBg]       = useState(BACKGROUNDS[0])
  const [rendering, setRendering] = useState(false)
  const [exporting, setExporting] = useState(false)

  useEffect(() => {
    if (!canvasRef.current) return
    const comp = new CompositorFinal()
    comp.init(canvasRef.current)
    compRef.current = comp
  }, [])

  useEffect(() => {
    const comp = compRef.current
    if (!comp) return
    setRendering(true)
    comp
      .render(avatarDataUrl, bg.url)
      .catch(console.error)
      .finally(() => setRendering(false))
  }, [avatarDataUrl, bg])

  const handleExport = useCallback(() => {
    const comp = compRef.current
    if (!comp) return
    setExporting(true)
    setTimeout(() => {
      const url = comp.exportPNG()
      const a   = document.createElement('a')
      a.href    = url
      a.download = 'avatar-final.png'
      a.click()
      setExporting(false)
    }, 80)
  }, [])

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
          position: 'relative', maxWidth: 520, width: '100%', aspectRatio: '1',
          borderRadius: 24, overflow: 'hidden',
          boxShadow: '0 24px 80px rgba(0,0,0,0.7)',
          border: '1px solid rgba(255,255,255,0.07)',
          background: '#1a1a1c',
        }}>
          <canvas ref={canvasRef} style={{ width: '100%', height: '100%', display: 'block' }} />
          {rendering && (
            <div style={{
              position: 'absolute', inset: 0,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: 'rgba(0,0,0,0.5)',
              fontSize: 11, color: 'rgba(255,255,255,0.4)',
              letterSpacing: '0.1em',
            }}>
              CARGANDO MARCO…
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

        {/* Back */}
        <button
          onClick={onBack}
          style={{
            display: 'flex', alignItems: 'center', gap: 6,
            background: 'transparent', border: 'none',
            color: 'rgba(255,255,255,0.35)', cursor: 'pointer',
            fontSize: 12, padding: 0, marginBottom: 4,
          }}
        >
          ← Volver al avatar
        </button>

        <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }} />

        {/* Background selector */}
        <div>
          <p style={{
            fontSize: 9, fontWeight: 700, letterSpacing: '0.12em',
            textTransform: 'uppercase', color: 'rgba(255,255,255,0.22)',
            marginBottom: 12,
          }}>
            Fondo
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {BACKGROUNDS.map(b => (
              <button
                key={b.id}
                onClick={() => setBg(b)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: '8px 10px', borderRadius: 10,
                  border: bg.id === b.id
                    ? '1.5px solid rgba(255,255,255,0.4)'
                    : '1.5px solid rgba(255,255,255,0.07)',
                  background: bg.id === b.id ? 'rgba(255,255,255,0.08)' : 'transparent',
                  color: bg.id === b.id ? 'white' : 'rgba(255,255,255,0.35)',
                  fontSize: 12,
                  cursor: 'pointer',
                  textAlign: 'left',
                  transition: 'all 0.12s',
                }}
              >
                {/* Thumbnail */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={b.url}
                  alt={b.label}
                  style={{ width: 36, height: 36, borderRadius: 6, objectFit: 'cover', flexShrink: 0 }}
                />
                {b.label}
              </button>
            ))}
          </div>
        </div>

        <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }} />

        {/* Export */}
        <button
          onClick={handleExport}
          disabled={exporting || rendering}
          style={{
            padding: '13px 0', borderRadius: 12, border: 'none',
            background: (exporting || rendering) ? 'rgba(255,255,255,0.07)' : 'white',
            color: (exporting || rendering) ? 'rgba(255,255,255,0.25)' : '#0f0f10',
            fontSize: 13, fontWeight: 700,
            cursor: (exporting || rendering) ? 'not-allowed' : 'pointer',
            letterSpacing: '0.03em', transition: 'all 0.15s',
          }}
        >
          {exporting ? 'Exportando…' : 'Descargar PNG Final'}
        </button>

        <div style={{ height: 8 }} />
      </div>
    </div>
  )
}
