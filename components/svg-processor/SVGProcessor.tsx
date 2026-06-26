'use client'

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { detectGroups, extractGroup, type SvgGroupInfo } from '@/lib/svg/splitter'
import { storeLayer, guessLayerName, guessLayerOrder, fileToKey } from '@/lib/svg/upload-store'

type Stage = 'idle' | 'processing' | 'done'

export default function SVGProcessor() {
  const router   = useRouter()
  const inputRef = useRef<HTMLInputElement>(null)

  const [stage,      setStage]      = useState<Stage>('idle')
  const [progress,   setProgress]   = useState({ done: 0, total: 0 })
  const [groups,     setGroups]     = useState<SvgGroupInfo[]>([])
  const [layerName,  setLayerName]  = useState('')
  const [layerOrder, setLayerOrder] = useState(1)
  const [layerKey,   setLayerKey]   = useState('')
  const [error,      setError]      = useState('')

  async function handleFile(file: File) {
    setError('')
    setStage('processing')
    setGroups([])

    const svgText = await file.text()
    const ids     = detectGroups(svgText)

    if (ids.length === 0) {
      setError('No se encontraron grupos con ID. Exporta desde Affinity Designer con "Incluir nombres de capas".')
      setStage('idle')
      return
    }

    setProgress({ done: 0, total: ids.length })

    const results: SvgGroupInfo[] = []
    for (const id of ids) {
      const info = await extractGroup(svgText, id)
      if (info) results.push(info)
      setProgress(p => ({ ...p, done: p.done + 1 }))
    }

    if (results.length === 0) {
      setError('No se pudo extraer ningún grupo. Verifica el archivo SVG.')
      setStage('idle')
      return
    }

    const key = fileToKey(file.name)
    setGroups(results)
    setLayerKey(key)
    setLayerName(guessLayerName(file.name))
    setLayerOrder(guessLayerOrder(file.name))
    setStage('done')
  }

  function handleLoad() {
    storeLayer(layerKey, layerName, layerOrder, groups)
    router.push('/es/builder-v2')
  }

  // ── Idle ──────────────────────────────────────────────────────────────────

  if (stage === 'idle') return (
    <div style={styles.page}>
      <div style={styles.card}>
        <div style={{ fontSize: 48, marginBottom: 12 }}>🎨</div>
        <h1 style={styles.title}>SVG Processor</h1>
        <p style={styles.sub}>
          Sube un SVG de Affinity Designer.<br />
          Se detectan los grupos, se previsualiza cada variante<br />
          y se cargan directo en el builder.
        </p>

        {error && <p style={styles.error}>⚠ {error}</p>}

        <button style={styles.btn} onClick={() => inputRef.current?.click()}>
          Seleccionar .svg
        </button>
        <input
          ref={inputRef} type="file" accept=".svg" style={{ display: 'none' }}
          onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f) }}
        />

        <div style={styles.hints}>
          <Hint icon="📐" text='Exporta con "Incluir nombres de capas" desde Affinity' />
          <Hint icon="🔍" text="Se previsualiza cada variante y se corrige el viewBox" />
          <Hint icon="⚡" text="Se carga directo en el builder, sin descargar nada" />
        </div>
      </div>
    </div>
  )

  // ── Processing ────────────────────────────────────────────────────────────

  if (stage === 'processing') return (
    <div style={styles.page}>
      <div style={styles.card}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>⚙️</div>
        <h2 style={styles.title}>Procesando…</h2>
        <p style={{ color: 'rgba(255,255,255,0.5)', marginBottom: 24 }}>
          {progress.done} / {progress.total} variantes extraídas
        </p>
        <div style={styles.barTrack}>
          <div style={{
            ...styles.barFill,
            width: `${progress.total ? (progress.done / progress.total) * 100 : 0}%`,
          }} />
        </div>
      </div>
    </div>
  )

  // ── Done ─────────────────────────────────────────────────────────────────

  return (
    <div style={styles.page}>
      <div style={{ ...styles.card, maxWidth: 700 }}>
        <h2 style={styles.title}>✓ {groups.length} variantes detectadas</h2>

        <div style={styles.grid}>
          {groups.map(g => (
            <div key={g.id} style={styles.thumb}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={g.previewUrl} alt={g.id}
                style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
              <span style={styles.thumbLabel}>{g.id}</span>
            </div>
          ))}
        </div>

        <div style={styles.config}>
          <div style={styles.field}>
            <label style={styles.label}>Nombre de capa</label>
            <input
              style={styles.input}
              value={layerName}
              onChange={e => setLayerName(e.target.value)}
              placeholder="Cabeza, Cabello Frontal, Ropa…"
            />
          </div>
          <div style={styles.field}>
            <label style={styles.label}>Orden z</label>
            <input
              style={{ ...styles.input, width: 72 }}
              type="number" min={1} max={20}
              value={layerOrder}
              onChange={e => setLayerOrder(Number(e.target.value))}
            />
          </div>
        </div>

        <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
          <button style={styles.btnSecondary}
            onClick={() => { setStage('idle'); setGroups([]) }}>
            ← Otro SVG
          </button>
          <button style={styles.btn} onClick={handleLoad}>
            Cargar en el builder →
          </button>
        </div>
      </div>
    </div>
  )
}

function Hint({ icon, text }: { icon: string; text: string }) {
  return (
    <div style={styles.hint}>
      <span style={{ fontSize: 20 }}>{icon}</span>
      <span style={{ color: 'rgba(255,255,255,0.45)', fontSize: 13 }}>{text}</span>
    </div>
  )
}

const styles = {
  page: {
    minHeight: '100vh', display: 'flex', alignItems: 'center',
    justifyContent: 'center', background: '#0f0f0f', padding: 24,
  } as React.CSSProperties,
  card: {
    background: '#1a1a1a', border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: 20, padding: '40px 48px', maxWidth: 480,
    width: '100%', textAlign: 'center',
  } as React.CSSProperties,
  title: { color: '#fff', fontSize: 24, fontWeight: 700, margin: '0 0 12px' } as React.CSSProperties,
  sub: { color: 'rgba(255,255,255,0.45)', fontSize: 15, lineHeight: 1.6, margin: '0 0 28px' } as React.CSSProperties,
  error: {
    color: '#ff6b6b', fontSize: 14, marginBottom: 16,
    background: 'rgba(255,107,107,0.1)', borderRadius: 8, padding: '10px 14px',
  } as React.CSSProperties,
  btn: {
    background: '#fff', color: '#000', border: 'none',
    borderRadius: 12, padding: '14px 28px', fontSize: 16, fontWeight: 600, cursor: 'pointer',
  } as React.CSSProperties,
  btnSecondary: {
    background: 'rgba(255,255,255,0.07)', color: '#fff',
    border: '1px solid rgba(255,255,255,0.12)',
    borderRadius: 12, padding: '14px 24px', fontSize: 15, fontWeight: 500, cursor: 'pointer',
  } as React.CSSProperties,
  hints: { marginTop: 36, display: 'flex', flexDirection: 'column', gap: 12, textAlign: 'left' } as React.CSSProperties,
  hint: {
    display: 'flex', alignItems: 'center', gap: 12,
    background: 'rgba(255,255,255,0.03)', borderRadius: 10, padding: '10px 14px',
  } as React.CSSProperties,
  barTrack: { background: 'rgba(255,255,255,0.08)', borderRadius: 8, height: 8, overflow: 'hidden' } as React.CSSProperties,
  barFill: { background: '#fff', height: '100%', borderRadius: 8, transition: 'width 0.2s' } as React.CSSProperties,
  grid: {
    display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(110px, 1fr))',
    gap: 10, margin: '24px 0',
  } as React.CSSProperties,
  thumb: {
    aspectRatio: '1', background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12,
    overflow: 'hidden', display: 'flex', flexDirection: 'column',
    alignItems: 'center', justifyContent: 'center', position: 'relative',
  } as React.CSSProperties,
  thumbLabel: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    background: 'rgba(0,0,0,0.6)', color: 'rgba(255,255,255,0.7)',
    fontSize: 10, textAlign: 'center', padding: '3px 4px',
  } as React.CSSProperties,
  config: {
    display: 'flex', gap: 16, justifyContent: 'center',
    alignItems: 'flex-end', marginBottom: 24, flexWrap: 'wrap',
  } as React.CSSProperties,
  field: { display: 'flex', flexDirection: 'column', gap: 6, textAlign: 'left' } as React.CSSProperties,
  label: {
    color: 'rgba(255,255,255,0.4)', fontSize: 11, fontWeight: 600,
    letterSpacing: '0.1em', textTransform: 'uppercase',
  } as React.CSSProperties,
  input: {
    background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)',
    borderRadius: 8, color: '#fff', fontSize: 15, padding: '10px 14px',
    outline: 'none', minWidth: 200,
  } as React.CSSProperties,
}
