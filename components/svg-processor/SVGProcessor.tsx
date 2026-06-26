'use client'

import { useCallback, useState } from 'react'
import { detectGroups, extractGroup, downloadOne, downloadAll, type SvgGroupInfo } from '@/lib/svg/splitter'

type Stage = 'upload' | 'processing' | 'done'

export default function SVGProcessor() {
  const [stage,      setStage]      = useState<Stage>('upload')
  const [fileName,   setFileName]   = useState('')
  const [groupIds,   setGroupIds]   = useState<string[]>([])
  const [groups,     setGroups]     = useState<(SvgGroupInfo | null)[]>([])
  const [progress,   setProgress]   = useState(0)
  const [isDragging, setIsDragging] = useState(false)
  const [error,      setError]      = useState('')

  // ── Core processing ──────────────────────────────────────────────────────────

  const processFile = useCallback(async (file: File) => {
    if (!file.name.toLowerCase().endsWith('.svg')) {
      setError('Solo se aceptan archivos .svg')
      return
    }
    setError('')

    const text    = await file.text()
    const base    = file.name.replace(/\.svg$/i, '')
    const ids     = detectGroups(text)

    if (ids.length === 0) {
      setError('No se encontraron grupos con ID en este SVG. Asegúrate de exportar con "incluir nombres de capas" desde Affinity Designer.')
      return
    }

    setFileName(base)
    setGroupIds(ids)
    setGroups(new Array(ids.length).fill(null))
    setProgress(0)
    setStage('processing')

    // Extraer cada grupo secuencialmente — muestra cada preview mientras carga
    for (let i = 0; i < ids.length; i++) {
      const info = await extractGroup(text, ids[i])
      setGroups(prev => {
        const next = [...prev]
        next[i] = info
        return next
      })
      setProgress(i + 1)
    }

    setStage('done')
  }, [])

  const onFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    if (f) processFile(f)
    e.target.value = ''   // permite re-subir el mismo archivo
  }, [processFile])

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    const f = e.dataTransfer.files[0]
    if (f) processFile(f)
  }, [processFile])

  const reset = useCallback(() => {
    setStage('upload')
    setFileName('')
    setGroupIds([])
    setGroups([])
    setProgress(0)
    setError('')
  }, [])

  // ── Upload stage ─────────────────────────────────────────────────────────────

  if (stage === 'upload') {
    return (
      <div style={{
        minHeight: '100dvh', background: '#0d0d0f',
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        fontFamily: '"Inter", system-ui, sans-serif',
        padding: 32,
      }}>
        {/* Drop zone */}
        <div
          onDragOver={e => { e.preventDefault(); setIsDragging(true) }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={onDrop}
          onClick={() => document.getElementById('_svg_input')?.click()}
          style={{
            width: '100%', maxWidth: 520,
            padding: '64px 48px',
            border: `2px dashed ${isDragging ? 'rgba(255,255,255,0.45)' : 'rgba(255,255,255,0.13)'}`,
            borderRadius: 20, textAlign: 'center',
            background: isDragging ? 'rgba(255,255,255,0.03)' : 'transparent',
            cursor: 'pointer', transition: 'all 0.2s',
            color: 'white',
          }}
        >
          <div style={{ fontSize: 52, marginBottom: 20, lineHeight: 1 }}>🎨</div>
          <h1 style={{ fontSize: 20, fontWeight: 700, margin: '0 0 10px', letterSpacing: '-0.02em' }}>
            SVG Processor
          </h1>
          <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.38)', margin: '0 0 28px', lineHeight: 1.6 }}>
            Sube un archivo SVG de Affinity Designer.<br />
            Cada capa (<code style={{ background: 'rgba(255,255,255,0.07)', padding: '1px 5px', borderRadius: 4 }}>{'<g id="...">'}</code>) será extraída<br />
            como un SVG individual con viewBox corregido.
          </p>

          <label style={{
            display: 'inline-block', padding: '11px 28px',
            background: 'white', color: '#0d0d0f',
            borderRadius: 10, fontSize: 13, fontWeight: 700,
            cursor: 'pointer', letterSpacing: '-0.01em',
          }}>
            Seleccionar .svg
            <input
              id="_svg_input"
              type="file"
              accept=".svg"
              style={{ display: 'none' }}
              onChange={onFileChange}
            />
          </label>
        </div>

        {error && (
          <p style={{
            marginTop: 20, color: '#ff6b6b', fontSize: 13,
            maxWidth: 460, textAlign: 'center', lineHeight: 1.5,
          }}>
            ⚠ {error}
          </p>
        )}

        {/* Usage tips */}
        <div style={{
          marginTop: 40, display: 'flex', gap: 16, maxWidth: 520, width: '100%',
        }}>
          {[
            { icon: '📐', text: 'Exporta desde Affinity Designer con "Incluir nombres de capas"' },
            { icon: '🔍', text: 'Se detectan las capas automáticamente y se muestran previsualizadas' },
            { icon: '📦', text: 'Descarga cada variante como SVG individual o todo a la vez' },
          ].map((tip, i) => (
            <div key={i} style={{
              flex: 1, padding: '14px 16px',
              background: 'rgba(255,255,255,0.03)',
              border: '1px solid rgba(255,255,255,0.06)',
              borderRadius: 12, fontSize: 11,
              color: 'rgba(255,255,255,0.35)', lineHeight: 1.5,
            }}>
              <div style={{ fontSize: 20, marginBottom: 8 }}>{tip.icon}</div>
              {tip.text}
            </div>
          ))}
        </div>
      </div>
    )
  }

  // ── Processing / Done stage ───────────────────────────────────────────────────

  const ready    = groups.filter((g): g is SvgGroupInfo => g !== null)
  const total    = groupIds.length
  const pct      = total > 0 ? (progress / total) * 100 : 0
  const isDone   = stage === 'done'

  return (
    <div style={{
      minHeight: '100dvh', background: '#0d0d0f', color: 'white',
      fontFamily: '"Inter", system-ui, sans-serif',
    }}>
      {/* ── Header ── */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '16px 28px',
        borderBottom: '1px solid rgba(255,255,255,0.06)',
        background: '#111115',
      }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 14, fontWeight: 700 }}>{fileName}.svg</span>
            <span style={{
              fontSize: 10, fontWeight: 700, letterSpacing: '0.1em',
              textTransform: 'uppercase', padding: '3px 8px',
              borderRadius: 6,
              background: isDone ? 'rgba(100,220,140,0.12)' : 'rgba(255,255,255,0.06)',
              color:      isDone ? 'rgba(100,220,140,0.85)' : 'rgba(255,255,255,0.35)',
            }}>
              {isDone ? '✓ Listo' : 'Procesando…'}
            </span>
          </div>
          <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', margin: '3px 0 0' }}>
            {isDone
              ? `${ready.length} de ${total} variantes extraídas`
              : `${progress} / ${total} — detectando viewBox y generando preview…`}
          </p>
        </div>

        <div style={{ display: 'flex', gap: 8 }}>
          {isDone && (
            <button
              onClick={() => downloadAll(ready)}
              style={{
                padding: '9px 20px', borderRadius: 10, border: 'none',
                background: 'white', color: '#0d0d0f',
                fontSize: 13, fontWeight: 700, cursor: 'pointer',
              }}
            >
              ⬇ Descargar todo ({ready.length})
            </button>
          )}
          <button
            onClick={reset}
            style={{
              padding: '9px 16px', borderRadius: 10,
              border: '1px solid rgba(255,255,255,0.1)',
              background: 'transparent', color: 'rgba(255,255,255,0.45)',
              fontSize: 13, cursor: 'pointer',
            }}
          >
            ← Otro archivo
          </button>
        </div>
      </div>

      {/* ── Progress bar ── */}
      {!isDone && (
        <div style={{ height: 2, background: 'rgba(255,255,255,0.04)' }}>
          <div style={{
            height: '100%', width: `${pct}%`,
            background: 'linear-gradient(90deg, rgba(255,255,255,0.5), white)',
            transition: 'width 0.4s ease',
          }} />
        </div>
      )}

      {/* ── Summary pill row ── */}
      {groupIds.length > 0 && (
        <div style={{
          padding: '12px 28px',
          borderBottom: '1px solid rgba(255,255,255,0.05)',
          display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center',
        }}>
          <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.25)', marginRight: 4 }}>
            GRUPOS DETECTADOS:
          </span>
          {groupIds.map(id => (
            <span key={id} style={{
              fontSize: 10, fontFamily: 'monospace',
              padding: '2px 8px', borderRadius: 5,
              background: 'rgba(255,255,255,0.06)',
              color: 'rgba(255,255,255,0.45)',
            }}>
              {id}
            </span>
          ))}
        </div>
      )}

      {/* ── Grid ── */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(170px, 1fr))',
        gap: 14, padding: 28,
      }}>
        {groupIds.map((id, i) => {
          const info = groups[i]
          const loading = !info

          return (
            <div key={id} style={{
              background: '#111115',
              border: `1px solid ${info ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.04)'}`,
              borderRadius: 14, overflow: 'hidden',
              transition: 'border-color 0.3s',
            }}>
              {/* Preview */}
              <div style={{
                aspectRatio: '1',
                background: 'radial-gradient(ellipse at 50% 40%, rgba(60,50,90,0.2), #16161d)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                {info?.previewUrl ? (
                  <img
                    src={info.previewUrl}
                    alt={id}
                    style={{ width: '78%', height: '78%', objectFit: 'contain' }}
                  />
                ) : (
                  <div style={{
                    width: 36, height: 36, borderRadius: '50%',
                    border: '2.5px solid rgba(255,255,255,0.07)',
                    borderTop: '2.5px solid rgba(255,255,255,0.35)',
                    animation: loading ? 'spin 0.9s linear infinite' : 'none',
                  }} />
                )}
              </div>

              {/* Info */}
              <div style={{ padding: '10px 12px 12px' }}>
                <p style={{
                  fontSize: 12, fontWeight: 600, margin: '0 0 2px',
                  fontFamily: '"JetBrains Mono", "Fira Code", monospace',
                  letterSpacing: '-0.01em',
                }}>
                  {id}
                </p>

                {info?.bbox ? (
                  <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.28)', margin: '0 0 8px' }}>
                    {Math.round(info.bbox.width)} × {Math.round(info.bbox.height)} px
                  </p>
                ) : (
                  <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.18)', margin: '0 0 8px' }}>
                    {loading ? 'Procesando…' : 'Error al extraer'}
                  </p>
                )}

                {info ? (
                  <button
                    onClick={() => downloadOne(info)}
                    style={{
                      width: '100%', padding: '6px 0',
                      border: '1px solid rgba(255,255,255,0.1)',
                      background: 'rgba(255,255,255,0.03)',
                      color: 'rgba(255,255,255,0.5)',
                      borderRadius: 7, fontSize: 11, cursor: 'pointer',
                      transition: 'background 0.1s, color 0.1s',
                      letterSpacing: '-0.01em',
                    }}
                    onMouseEnter={e => {
                      (e.target as HTMLButtonElement).style.background = 'rgba(255,255,255,0.08)'
                      ;(e.target as HTMLButtonElement).style.color = 'rgba(255,255,255,0.75)'
                    }}
                    onMouseLeave={e => {
                      (e.target as HTMLButtonElement).style.background = 'rgba(255,255,255,0.03)'
                      ;(e.target as HTMLButtonElement).style.color = 'rgba(255,255,255,0.5)'
                    }}
                  >
                    ⬇ {id}.svg
                  </button>
                ) : (
                  <div style={{
                    width: '100%', padding: '6px 0',
                    background: 'rgba(255,255,255,0.02)',
                    borderRadius: 7, height: 29,
                  }} />
                )}
              </div>
            </div>
          )
        })}
      </div>

      {/* ── Footer note about "Descargar todo" ── */}
      {isDone && (
        <p style={{
          textAlign: 'center', fontSize: 11,
          color: 'rgba(255,255,255,0.2)', paddingBottom: 32,
        }}>
          En Chrome/Edge puedes elegir una carpeta directamente. En otros navegadores se descargará cada archivo por separado.
        </p>
      )}

      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
    </div>
  )
}
