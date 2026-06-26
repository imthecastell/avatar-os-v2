'use client'

import { useCallback, useState } from 'react'
import { useRouter } from 'next/navigation'
import { detectGroups, extractGroup, type SvgGroupInfo } from '@/lib/svg/splitter'
import {
  storeLayer, guessLayerKey,
  LAYER_CATALOG, loadedLayerKeys,
} from '@/lib/svg/upload-store'

type Stage = 'upload' | 'processing' | 'done'

export default function SVGProcessor() {
  const router = useRouter()

  const [stage,      setStage]      = useState<Stage>('upload')
  const [fileName,   setFileName]   = useState('')
  const [groupIds,   setGroupIds]   = useState<string[]>([])
  const [groups,     setGroups]     = useState<(SvgGroupInfo | null)[]>([])
  const [progress,   setProgress]   = useState(0)
  const [isDragging, setIsDragging] = useState(false)
  const [error,      setError]      = useState('')
  const [layerKey,   setLayerKey]   = useState('hair-front')

  // ── File processing ───────────────────────────────────────────────────────

  const processFile = useCallback(async (file: File) => {
    if (!file.name.toLowerCase().endsWith('.svg')) {
      setError('Solo se aceptan archivos .svg')
      return
    }
    setError('')

    const text = await file.text()
    const base = file.name.replace(/\.svg$/i, '')
    const ids  = detectGroups(text)

    if (ids.length === 0) {
      setError('No se encontraron grupos con ID. Asegúrate de exportar desde Affinity Designer con "Incluir nombres de capas".')
      return
    }

    setFileName(base)
    setGroupIds(ids)
    setGroups(new Array(ids.length).fill(null))
    setProgress(0)
    setLayerKey(guessLayerKey(base))
    setStage('processing')

    for (let i = 0; i < ids.length; i++) {
      const info = await extractGroup(text, ids[i])
      setGroups(prev => { const n = [...prev]; n[i] = info; return n })
      setProgress(i + 1)
    }
    setStage('done')
  }, [])

  const onFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    if (f) processFile(f)
    e.target.value = ''
  }, [processFile])

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); setIsDragging(false)
    const f = e.dataTransfer.files[0]
    if (f) processFile(f)
  }, [processFile])

  // ── Actions ───────────────────────────────────────────────────────────────

  const handleLoadInBuilder = useCallback(() => {
    const ready = groups.filter((g): g is SvgGroupInfo => g !== null)
    if (!ready.length) return
    storeLayer(layerKey, ready)
    const locale = window.location.pathname.split('/')[1] || 'es'
    router.push(`/${locale}/builder-v2`)
  }, [groups, layerKey, router])

  const handleAnotherLayer = useCallback(() => {
    setStage('upload')
    setFileName('')
    setGroupIds([])
    setGroups([])
    setProgress(0)
    setError('')
  }, [])

  const handleGoToBuilder = useCallback(() => {
    const locale = window.location.pathname.split('/')[1] || 'es'
    router.push(`/${locale}/builder-v2`)
  }, [router])

  // ── Upload stage ──────────────────────────────────────────────────────────

  if (stage === 'upload') {
    const loaded = loadedLayerKeys()
    return (
      <div style={{
        minHeight: '100dvh', background: '#0d0d0f',
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        fontFamily: '"Inter", system-ui, sans-serif',
        padding: 32, gap: 24,
      }}>
        {/* Drop zone */}
        <div
          onDragOver={e => { e.preventDefault(); setIsDragging(true) }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={onDrop}
          onClick={() => document.getElementById('_svg_input')?.click()}
          style={{
            width: '100%', maxWidth: 500,
            padding: '56px 48px', borderRadius: 20, textAlign: 'center',
            border: `2px dashed ${isDragging ? 'rgba(255,255,255,0.5)' : 'rgba(255,255,255,0.12)'}`,
            background: isDragging ? 'rgba(255,255,255,0.03)' : 'transparent',
            cursor: 'pointer', transition: 'all 0.2s', color: 'white',
          }}
        >
          <div style={{ fontSize: 48, marginBottom: 18, lineHeight: 1 }}>🎨</div>
          <h1 style={{ fontSize: 20, fontWeight: 700, margin: '0 0 10px', letterSpacing: '-0.02em' }}>
            SVG Processor
          </h1>
          <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.38)', margin: '0 0 28px', lineHeight: 1.6 }}>
            Sube un archivo SVG de Affinity Designer.<br />
            Se detectan los grupos, se previsualiza cada variante<br />
            y se cargan directo en el builder.
          </p>
          <label style={{
            display: 'inline-block', padding: '11px 28px',
            background: 'white', color: '#0d0d0f',
            borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: 'pointer',
          }}>
            Seleccionar .svg
            <input id="_svg_input" type="file" accept=".svg"
              style={{ display: 'none' }} onChange={onFileChange} />
          </label>
        </div>

        {/* Error */}
        {error && (
          <p style={{ color: '#ff7b7b', fontSize: 13, maxWidth: 480, textAlign: 'center', lineHeight: 1.5 }}>
            ⚠ {error}
          </p>
        )}

        {/* Loaded layers status */}
        {loaded.length > 0 && (
          <div style={{
            width: '100%', maxWidth: 500,
            padding: '14px 20px', borderRadius: 12,
            background: 'rgba(100,220,140,0.06)',
            border: '1px solid rgba(100,220,140,0.15)',
          }}>
            <p style={{ fontSize: 11, color: 'rgba(100,220,140,0.7)', margin: '0 0 8px', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
              Capas listas en memoria
            </p>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>
              {loaded.map(k => (
                <span key={k} style={{
                  fontSize: 11, padding: '3px 8px', borderRadius: 6,
                  background: 'rgba(100,220,140,0.12)',
                  color: 'rgba(100,220,140,0.85)',
                }}>
                  ✓ {LAYER_CATALOG[k] ?? k}
                </span>
              ))}
            </div>
            <button
              onClick={handleGoToBuilder}
              style={{
                padding: '8px 16px', borderRadius: 8, border: 'none',
                background: 'rgba(100,220,140,0.2)', color: 'rgba(100,220,140,0.9)',
                fontSize: 12, fontWeight: 700, cursor: 'pointer',
              }}
            >
              Ir al builder →
            </button>
          </div>
        )}

        {/* Tips */}
        <div style={{ display: 'flex', gap: 12, maxWidth: 500, width: '100%' }}>
          {[
            { icon: '📐', text: 'Exporta con "Incluir nombres de capas" desde Affinity' },
            { icon: '🔍', text: 'Se previsualiza cada variante y se corrige el viewBox' },
            { icon: '⚡', text: 'Se carga directo en el builder sin descargar nada' },
          ].map((t, i) => (
            <div key={i} style={{
              flex: 1, padding: '12px 14px',
              background: 'rgba(255,255,255,0.02)',
              border: '1px solid rgba(255,255,255,0.05)',
              borderRadius: 10, fontSize: 11,
              color: 'rgba(255,255,255,0.3)', lineHeight: 1.5,
            }}>
              <div style={{ fontSize: 18, marginBottom: 6 }}>{t.icon}</div>
              {t.text}
            </div>
          ))}
        </div>
      </div>
    )
  }

  // ── Processing / Done stage ───────────────────────────────────────────────

  const ready  = groups.filter((g): g is SvgGroupInfo => g !== null)
  const total  = groupIds.length
  const isDone = stage === 'done'
  const pct    = total > 0 ? (progress / total) * 100 : 0

  return (
    <div style={{
      minHeight: '100dvh', background: '#0d0d0f', color: 'white',
      fontFamily: '"Inter", system-ui, sans-serif',
      display: 'flex', flexDirection: 'column',
    }}>
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '14px 24px', borderBottom: '1px solid rgba(255,255,255,0.06)',
        background: '#111115', flexShrink: 0,
      }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 14, fontWeight: 700 }}>{fileName}.svg</span>
            <span style={{
              fontSize: 9, fontWeight: 700, letterSpacing: '0.1em',
              textTransform: 'uppercase', padding: '3px 8px', borderRadius: 6,
              background: isDone ? 'rgba(100,220,140,0.12)' : 'rgba(255,200,60,0.1)',
              color: isDone ? 'rgba(100,220,140,0.85)' : 'rgba(255,200,60,0.75)',
            }}>
              {isDone ? `✓ ${ready.length} variantes` : `${progress} / ${total}`}
            </span>
          </div>
          <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.28)', margin: '3px 0 0' }}>
            {isDone ? 'Vista previa lista — asigna la capa y carga en el builder' : 'Extrayendo grupos y calculando viewBox…'}
          </p>
        </div>
        <button
          onClick={handleAnotherLayer}
          style={{
            padding: '8px 14px', borderRadius: 9,
            border: '1px solid rgba(255,255,255,0.1)',
            background: 'transparent', color: 'rgba(255,255,255,0.4)',
            fontSize: 12, cursor: 'pointer',
          }}
        >
          ← Otro archivo
        </button>
      </div>

      {/* Progress bar */}
      {!isDone && (
        <div style={{ height: 2, background: 'rgba(255,255,255,0.04)', flexShrink: 0 }}>
          <div style={{
            height: '100%', width: `${pct}%`,
            background: 'rgba(255,200,60,0.7)',
            transition: 'width 0.4s ease',
          }} />
        </div>
      )}

      {/* Group ID pills */}
      {groupIds.length > 0 && (
        <div style={{
          padding: '10px 24px', borderBottom: '1px solid rgba(255,255,255,0.04)',
          display: 'flex', gap: 5, flexWrap: 'wrap', alignItems: 'center', flexShrink: 0,
        }}>
          <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.2)', marginRight: 2, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase' }}>
            Grupos:
          </span>
          {groupIds.map(id => (
            <span key={id} style={{
              fontSize: 10, fontFamily: 'monospace', padding: '2px 7px', borderRadius: 5,
              background: groups[groupIds.indexOf(id)] ? 'rgba(100,220,140,0.08)' : 'rgba(255,255,255,0.05)',
              color: groups[groupIds.indexOf(id)] ? 'rgba(100,220,140,0.7)' : 'rgba(255,255,255,0.3)',
              border: '1px solid transparent',
              transition: 'all 0.3s',
            }}>
              {groups[groupIds.indexOf(id)] ? '✓ ' : ''}{id}
            </span>
          ))}
        </div>
      )}

      {/* Grid — scrollable */}
      <div style={{ flex: 1, overflowY: 'auto', padding: 20 }}>
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))',
          gap: 12,
        }}>
          {groupIds.map((id, i) => {
            const info = groups[i]
            return (
              <div key={id} style={{
                background: '#111115',
                border: `1px solid ${info ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.04)'}`,
                borderRadius: 14, overflow: 'hidden',
                transition: 'border-color 0.3s',
              }}>
                <div style={{
                  aspectRatio: '1',
                  background: 'radial-gradient(ellipse at 50% 40%, rgba(60,50,90,0.25), #16161d)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  {info?.previewUrl ? (
                    <img src={info.previewUrl} alt={id}
                      style={{ width: '78%', height: '78%', objectFit: 'contain' }} />
                  ) : (
                    <div style={{
                      width: 34, height: 34, borderRadius: '50%',
                      border: '2.5px solid rgba(255,255,255,0.06)',
                      borderTop: '2.5px solid rgba(255,255,255,0.4)',
                      animation: 'spin 0.9s linear infinite',
                    }} />
                  )}
                </div>
                <div style={{ padding: '9px 11px' }}>
                  <p style={{ fontSize: 11, fontWeight: 600, margin: '0 0 2px', fontFamily: 'monospace' }}>
                    {id}
                  </p>
                  <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.25)', margin: 0 }}>
                    {info?.bbox
                      ? `${Math.round(info.bbox.width)} × ${Math.round(info.bbox.height)}`
                      : info === null && groups.length > 0 ? 'Error' : 'Procesando…'}
                  </p>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Bottom action bar — only when done */}
      {isDone && (
        <div style={{
          flexShrink: 0,
          borderTop: '1px solid rgba(255,255,255,0.07)',
          background: '#111115',
          padding: '16px 24px',
          display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap',
        }}>
          {/* Layer selector */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.25)' }}>
              Esta capa es:
            </span>
            <select
              value={layerKey}
              onChange={e => setLayerKey(e.target.value)}
              style={{
                padding: '8px 12px', borderRadius: 8,
                border: '1px solid rgba(255,255,255,0.12)',
                background: 'rgba(255,255,255,0.05)',
                color: 'white', fontSize: 13, cursor: 'pointer',
                outline: 'none',
              }}
            >
              {Object.entries(LAYER_CATALOG).map(([k, label]) => (
                <option key={k} value={k} style={{ background: '#1a1a1e' }}>
                  {label}
                </option>
              ))}
            </select>
          </div>

          {/* CTA */}
          <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end', marginLeft: 'auto' }}>
            <button
              onClick={handleAnotherLayer}
              style={{
                padding: '10px 16px', borderRadius: 9,
                border: '1px solid rgba(255,255,255,0.1)',
                background: 'transparent', color: 'rgba(255,255,255,0.45)',
                fontSize: 13, cursor: 'pointer',
              }}
            >
              + Otra capa
            </button>
            <button
              onClick={handleLoadInBuilder}
              disabled={ready.length === 0}
              style={{
                padding: '10px 22px', borderRadius: 9, border: 'none',
                background: ready.length > 0 ? 'white' : 'rgba(255,255,255,0.15)',
                color: ready.length > 0 ? '#0d0d0f' : 'rgba(255,255,255,0.3)',
                fontSize: 13, fontWeight: 700,
                cursor: ready.length > 0 ? 'pointer' : 'not-allowed',
                letterSpacing: '-0.01em',
              }}
            >
              Cargar en el builder →
            </button>
          </div>
        </div>
      )}

      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
    </div>
  )
}
