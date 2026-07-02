'use client'

import { useState, useCallback, useRef, useEffect } from 'react'
import dynamic from 'next/dynamic'
import Image from 'next/image'
import type { AvatarState, Layer, Asset, LayerException, LayerDefault, Collection } from '@/types'
import type { AvatarCompositor } from '@/lib/engine/compositor'
import ExportModal from '@/components/builder/ExportModal'
import ConfettiBurst from '@/components/builder/ConfettiBurst'
import Link from 'next/link'

// ── Share URL helpers ─────────────────────────────────────
function encodeState(state: AvatarState): string {
  const compact = {
    c: state.collectionId,
    t: state.tokens,
    s: state.selectedAssets,
    k: state.unlockedKeywords,
    x: state.extraColor,
  }
  return btoa(JSON.stringify(compact))
}

function decodeState(encoded: string): Partial<AvatarState> | null {
  try {
    const d = JSON.parse(atob(encoded))
    return {
      collectionId:     d.c,
      tokens:           d.t,
      selectedAssets:   d.s,
      unlockedKeywords: d.k ?? [],
      extraColor:       d.x ?? false,
    }
  } catch {
    return null
  }
}

const AvatarCanvas = dynamic(() => import('@/components/builder/AvatarCanvas'), {
  ssr: false,
  loading: () => <div className="w-full h-full" style={{ background: 'rgba(255,255,255,0.02)' }} />,
})

// ── Constants ─────────────────────────────────────────────

// Capas ocultas en builder — ahora se leen de layer.visibleInBuilder (gestionado en admin)
// Mantenemos este set solo para la capa hair-front que se gestiona dentro del tab de cabello
const ALWAYS_HIDDEN = new Set(['hair-front'])

// Emojis y labels por capa
const LAYER_META: Record<string, { emoji: string; es: string; en: string }> = {
  'background':   { emoji: '🌅', es: 'Fondo',      en: 'Background' },
  'emotion':      { emoji: '😄', es: 'Expresión',  en: 'Expression' },
  'hair-back':    { emoji: '💇', es: 'Cabello',    en: 'Hair' },
  'head':         { emoji: '🧑', es: 'Cabeza',     en: 'Head' },
  'shirt':        { emoji: '👕', es: 'Ropa',       en: 'Outfit' },
  'acc-front':    { emoji: '🎩', es: 'Accesorio',  en: 'Accessory' },
  'mask':         { emoji: '😷', es: 'Máscara',    en: 'Mask' },
  'effect-final': { emoji: '✨', es: 'Efecto',     en: 'Effect' },
  'frame':        { emoji: '🖼️', es: 'Marco',     en: 'Frame' },
}

// Tonos de piel: 6 oficiales emoji + 3 fantasía
const SKIN_TONES = [
  { hex: '#FDDBB4', emoji: '🏻', fantasy: false },
  { hex: '#F0C27F', emoji: '🏼', fantasy: false },
  { hex: '#C68642', emoji: '🏽', fantasy: false },
  { hex: '#8D5524', emoji: '🏾', fantasy: false },
  { hex: '#4A2512', emoji: '🏿', fantasy: false },
  { hex: '#FFCD00', emoji: '🟡', fantasy: false },
  { hex: '#8B5CF6', emoji: '💜', fantasy: true },
  { hex: '#3B82F6', emoji: '💙', fantasy: true },
  { hex: '#10B981', emoji: '💚', fantasy: true },
]

// Colores de cabello predeterminados
const HAIR_COLORS = [
  '#1A1A1A', '#3B2314', '#6B3A2A', '#A0522D',
  '#C9A96E', '#E8D5A3', '#B22222', '#708090',
  '#E91E8C', '#7C3AED', '#0EA5E9', '#10B981',
]

// Capas que admiten color extra cuando XTRA está activo
const EXTRA_COLOR_LAYERS = new Set(['shirt', 'acc-front', 'mask'])

// ── Helpers ───────────────────────────────────────────────
function buildInitialState(collection: Collection | null, layers: Layer[], assets: Asset[], defaults: LayerDefault[]): AvatarState {
  const skinHex = defaults.find(d => d.tokenId === 'skin-color')?.defaultHex ?? '#C68642'
  const hairHex = defaults.find(d => d.tokenId === 'hair-color')?.defaultHex ?? '#3B2314'

  const selectedAssets: Record<string, string | null> = {}
  for (const layer of layers) {
    const def   = assets.find(a => a.layerKey === layer.layerKey && a.isDefault)
    const first = assets.find(a => a.layerKey === layer.layerKey && !a.keywordId)
    selectedAssets[layer.layerKey] = layer.optional ? null : (def?.id ?? first?.id ?? null)
  }

  return {
    collectionId:     collection?.id ?? '',
    tokens:           { 'skin-color': skinHex, 'hair-color': hairHex },
    selectedAssets,
    unlockedKeywords: [],
    extraColor:       false,
  }
}

function getHiddenLayers(state: AvatarState, exceptions: LayerException[]): Set<string> {
  const hidden = new Set<string>()
  for (const ex of exceptions) {
    const aid = state.selectedAssets[ex.triggerLayer]
    if (!aid) continue
    const matches = ex.triggerAssetPattern.endsWith('*')
      ? aid.startsWith(ex.triggerAssetPattern.slice(0, -1))
      : aid === ex.triggerAssetPattern
    if (matches && ex.action === 'hide') hidden.add(ex.affectedLayer)
  }
  return hidden
}

// ── Component ─────────────────────────────────────────────
interface Props {
  locale: string
  collection: Collection | null
  layers: Layer[]
  assets: Asset[]
  exceptions: LayerException[]
  defaults: LayerDefault[]
}

export default function BuilderClient({ locale: initialLocale, collection, layers, assets, exceptions, defaults }: Props) {
  const [locale, setLocale]       = useState(initialLocale)
  const [state, setState]         = useState<AvatarState>(() => buildInitialState(collection, layers, assets, defaults))
  const [exportUrl, setExportUrl] = useState<string | null>(null)
  const [shareUrl, setShareUrl]   = useState<string | null>(null)
  const compositorRef             = useRef<AvatarCompositor | null>(null)

  // FX — solo afectan la UI mientras se arma el avatar; el PNG exportado es estático
  const [popTick,  setPopTick]  = useState(0)   // pop del canvas al elegir pieza/color
  const [diceTick, setDiceTick] = useState(0)   // giro del dado al randomizar
  const [burstId,  setBurstId]  = useState(0)   // confetti al desbloquear keyword

  // Load avatar state from URL ?s= param on first render
  useEffect(() => {
    const params  = new URLSearchParams(window.location.search)
    const encoded = params.get('s')
    if (!encoded) return
    const decoded = decodeState(encoded)
    if (!decoded) return
    setState(s => ({
      ...s,
      ...(decoded.tokens         ? { tokens:           decoded.tokens }         : {}),
      ...(decoded.selectedAssets ? { selectedAssets:   decoded.selectedAssets } : {}),
      ...(decoded.unlockedKeywords ? { unlockedKeywords: decoded.unlockedKeywords } : {}),
      extraColor: decoded.extraColor ?? false,
    }))
  }, [])

  // Tab activo: capas marcadas como visibles en el admin (excluyendo siempre hair-front)
  const visibleLayers = layers.filter(l => l.visibleInBuilder && !ALWAYS_HIDDEN.has(l.layerKey))
  const [activeCat, setActiveCat] = useState<string>(visibleLayers[0]?.layerKey ?? '')

  const hiddenLayers = getHiddenLayers(state, exceptions)

  const t = (es: string, en: string) => locale === 'en' ? en : es

  // Assets visibles para una capa (públicos + los de keywords desbloqueadas)
  function visibleAssets(layerKey: string) {
    return assets.filter(a =>
      a.layerKey === layerKey &&
      (!a.keywordId || state.unlockedKeywords.includes(a.keywordId))
    )
  }

  // ── State mutations ───────────────────────────────────
  function setToken(key: string, hex: string) {
    setState(s => ({ ...s, tokens: { ...s.tokens, [key]: hex } }))
    setPopTick(t => t + 1)
  }

  function selectAsset(layerKey: string, assetId: string | null) {
    setState(s => ({ ...s, selectedAssets: { ...s.selectedAssets, [layerKey]: assetId } }))
    setPopTick(t => t + 1)
  }

  // Cabello: enlaza hair-back + hair-front por nombre, aplica suggestedColor si existe
  function selectHair(assetId: string | null) {
    setState(s => {
      const sel: Record<string, string | null> = { ...s.selectedAssets, 'hair-back': assetId }
      if (assetId) {
        const back  = assets.find(a => a.id === assetId)
        const front = back ? assets.find(a => a.layerKey === 'hair-front' && a.name === back.name) : null
        sel['hair-front'] = front?.id ?? null
        if (back?.suggestedColor) {
          return { ...s, selectedAssets: sel, tokens: { ...s.tokens, 'hair-color': back.suggestedColor } }
        }
      } else {
        sel['hair-front'] = null
      }
      return { ...s, selectedAssets: sel }
    })
    setPopTick(t => t + 1)
  }

  function randomize() {
    setDiceTick(t => t + 1)
    setPopTick(t => t + 1)
    const sel: Record<string, string | null> = {}
    for (const layer of layers) {
      const opts = assets.filter(a => a.layerKey === layer.layerKey && !a.keywordId)
      if (!opts.length) { sel[layer.layerKey] = null; continue }
      if (layer.optional && Math.random() < 0.4) { sel[layer.layerKey] = null; continue }
      sel[layer.layerKey] = opts[Math.floor(Math.random() * opts.length)].id
    }
    // Sincronizar hair-front con hair-back
    if (sel['hair-back']) {
      const back  = assets.find(a => a.id === sel['hair-back'])
      const front = back ? assets.find(a => a.layerKey === 'hair-front' && a.name === back.name) : null
      sel['hair-front'] = front?.id ?? null
    }
    const skin = SKIN_TONES[Math.floor(Math.random() * 6)] // solo oficiales
    const hair = HAIR_COLORS[Math.floor(Math.random() * 8)] // solo naturales
    setState(s => ({ ...s, selectedAssets: sel, tokens: { ...s.tokens, 'skin-color': skin.hex, 'hair-color': hair } }))
  }

  async function handleExport() {
    if (!compositorRef.current) return
    // Esperar renders en vuelo — si no, el PNG sale a medio dibujar
    await compositorRef.current.whenIdle()
    setExportUrl(compositorRef.current.exportPNG())
    const encoded = encodeState(state)
    setShareUrl(`${window.location.origin}/${locale}/builder?s=${encoded}`)
  }

  function unlockKeyword(keywordId: string, isXtra: boolean) {
    setState(s => ({
      ...s,
      unlockedKeywords: s.unlockedKeywords.includes(keywordId) ? s.unlockedKeywords : [...s.unlockedKeywords, keywordId],
      extraColor: s.extraColor || isXtra,
    }))
    setBurstId(b => b + 1)
  }

  const handleCompositorReady = useCallback((c: AvatarCompositor) => {
    compositorRef.current = c
  }, [])

  // ── Empty state ───────────────────────────────────────
  if (!collection) {
    return (
      <div className="h-screen flex flex-col items-center justify-center gap-4" style={{ background: '#07070e', color: 'white' }}>
        <p className="text-6xl">🎨</p>
        <p className="text-lg font-semibold">Avatar OS</p>
        <p className="text-sm" style={{ color: 'rgba(255,255,255,0.4)' }}>No hay colecciones activas.</p>
        <Link href={`/${locale}/admin`} className="text-violet-400 text-sm hover:underline">Ir al Admin →</Link>
      </div>
    )
  }

  // ── Render ────────────────────────────────────────────
  return (
    <div className="h-screen flex flex-col overflow-hidden select-none" style={{ background: '#07070e', color: 'white' }}>

      {/* HEADER */}
      <header className="shrink-0 flex items-center justify-between px-5 h-12 border-b" style={{ borderColor: 'rgba(255,255,255,0.06)', background: '#0a0a14' }}>
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-lg flex items-center justify-center text-sm" style={{ background: 'linear-gradient(135deg,#7c3aed,#a855f7)' }}>✦</div>
          <span className="text-sm font-semibold">Avatar OS</span>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setLocale(l => l === 'es' ? 'en' : 'es')}
            className="text-xs px-2 py-1 rounded-lg"
            style={{ background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.5)' }}
          >
            {locale === 'es' ? 'EN' : 'ES'}
          </button>
          <button
            onClick={handleExport}
            className="text-xs font-semibold px-4 py-1.5 rounded-xl"
            style={{ background: 'linear-gradient(135deg,#7c3aed,#a855f7)', color: 'white' }}
          >
            ✨ {t('Crear PFP', 'Create PFP')}
          </button>
        </div>
      </header>

      {/* BODY — vertical on mobile, horizontal on desktop */}
      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">

        {/* CANVAS — fixed height strip on mobile, flex-1 on desktop */}
        <div className="h-56 shrink-0 lg:h-auto lg:flex-1 flex items-center justify-center p-4 lg:p-10 relative">
            <div className="relative h-full aspect-square max-h-full max-w-full fx-float">
              <div className="absolute inset-0 rounded-full blur-3xl fx-breathe" style={{ background: 'radial-gradient(circle, #7c3aed, transparent 70%)' }} />
              {/* Pop re-disparable: alternar entre dos clases con keyframes idénticos
                  reinicia la animación sin re-montar el canvas (que perdería su caché) */}
              <div
                className={`relative w-full h-full rounded-[28px] lg:rounded-[36px] overflow-hidden ${popTick % 2 ? 'fx-pop-a' : 'fx-pop-b'}`}
                style={{ boxShadow: '0 24px 60px rgba(0,0,0,0.8), inset 0 1px 0 rgba(255,255,255,0.06)' }}
              >
                <AvatarCanvas
                  state={state}
                  layers={layers.filter(l => !hiddenLayers.has(l.layerKey))}
                  assets={assets}
                  onCompositorReady={handleCompositorReady}
                />
              </div>
              {burstId > 0 && <ConfettiBurst key={burstId} />}
              <button
                onClick={randomize}
                className="absolute bottom-2 left-2 text-[10px] font-medium px-2.5 py-1 rounded-xl backdrop-blur-md fx-tap lg:text-xs lg:px-3 lg:py-1.5 lg:bottom-3 lg:left-3"
                style={{ background: 'rgba(0,0,0,0.55)', color: 'rgba(255,255,255,0.7)', border: '1px solid rgba(255,255,255,0.1)' }}
              >
                <span key={diceTick} className={diceTick > 0 ? 'fx-dice' : undefined}>🎲</span> {t('Aleatorio', 'Random')}
              </button>
            </div>
        </div>

        {/* CONTROL PANEL — bottom drawer on mobile, right sidebar on desktop */}
        <aside
          className="flex-1 flex flex-col border-t lg:border-t-0 lg:border-l lg:w-[320px] lg:shrink-0 lg:flex-none overflow-hidden"
          style={{ borderColor: 'rgba(255,255,255,0.05)', background: '#0b0b16' }}
        >

          {/* Tab bar — horizontally scrollable */}
          <div className="shrink-0 border-b overflow-x-auto" style={{ borderColor: 'rgba(255,255,255,0.05)' }}>
            <div className="flex gap-0.5 p-1.5 min-w-max">
              {visibleLayers.map(layer => {
                if (hiddenLayers.has(layer.layerKey)) return null
                const m        = LAYER_META[layer.layerKey]
                const isActive = activeCat === layer.layerKey
                const hasSelection = !!state.selectedAssets[layer.layerKey]
                return (
                  <button
                    key={layer.layerKey}
                    onClick={() => setActiveCat(layer.layerKey)}
                    className="relative flex flex-col items-center gap-0.5 px-2 py-1.5 rounded-xl transition-all shrink-0 fx-tap lg:px-2.5 lg:py-2"
                    style={{
                      background: isActive ? 'rgba(124,58,237,0.2)' : 'transparent',
                      outline: isActive ? '1px solid rgba(124,58,237,0.4)' : 'none',
                    }}
                  >
                    {hasSelection && (
                      <span className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full" style={{ background: isActive ? '#a78bfa' : 'rgba(167,139,250,0.5)' }} />
                    )}
                    <span className="text-sm leading-none lg:text-base">{m?.emoji ?? '📁'}</span>
                    <span className="text-[8px] font-medium whitespace-nowrap lg:text-[9px]" style={{ color: isActive ? '#a78bfa' : 'rgba(255,255,255,0.35)' }}>
                      {locale === 'en' ? (m?.en ?? layer.labelEn) : (m?.es ?? layer.labelEs)}
                    </span>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Tab content — key por tab para animar la entrada al cambiar */}
          <div key={activeCat} className="flex-1 overflow-y-auto p-3 lg:p-4 space-y-4 lg:space-y-5 fx-slide-up">
            <LayerPanel
              categoryKey={activeCat}
              layers={layers}
              assets={assets}
              state={state}
              onSelectAsset={selectAsset}
              onSelectHair={selectHair}
              onSkinChange={hex => setToken('skin-color', hex)}
              onHairColorChange={hex => setToken('hair-color', hex)}
              onExtraColorChange={(key, hex) => setToken(key, hex)}
              locale={locale}
            />
          </div>

          {/* Keyword section — siempre visible al fondo */}
          <div className="shrink-0 border-t px-3 py-3 lg:px-4 lg:py-4" style={{ borderColor: 'rgba(255,255,255,0.05)' }}>
            <KeywordSection
              collectionId={collection.id}
              state={state}
              onUnlock={unlockKeyword}
              locale={locale}
            />
          </div>

          {/* Export CTA */}
          <div className="shrink-0 px-3 pb-3 lg:px-4 lg:pb-4">
            <button
              onClick={handleExport}
              className="w-full text-sm font-semibold py-2.5 lg:py-3 rounded-2xl fx-shimmer fx-tap"
              style={{
                background: 'linear-gradient(90deg,#6d28d9,#9333ea,#c084fc,#9333ea,#6d28d9)',
                color: 'white',
                boxShadow: '0 4px 20px rgba(124,58,237,0.35)',
              }}
            >
              ✨ {t('Crear mi PFP', 'Create my PFP')}
            </button>
          </div>
        </aside>
      </div>

      {exportUrl && (
        <ExportModal
          dataUrl={exportUrl}
          shareUrl={shareUrl ?? undefined}
          onClose={() => { setExportUrl(null); setShareUrl(null) }}
        />
      )}
    </div>
  )
}

// ══════════════════════════════════════════════════════════
// LayerPanel — contenido de la pestaña activa
// ══════════════════════════════════════════════════════════
interface LayerPanelProps {
  categoryKey:         string
  layers:              Layer[]
  assets:              Asset[]
  state:               AvatarState
  onSelectAsset:       (key: string, id: string | null) => void
  onSelectHair:        (id: string | null) => void
  onSkinChange:        (hex: string) => void
  onHairColorChange:   (hex: string) => void
  onExtraColorChange:  (key: string, hex: string) => void
  locale:              string
}

function LayerPanel({ categoryKey, layers, assets, state, onSelectAsset, onSelectHair, onSkinChange, onHairColorChange, onExtraColorChange, locale }: LayerPanelProps) {
  const t = (es: string, en: string) => locale === 'en' ? en : es
  const layer = layers.find(l => l.layerKey === categoryKey)

  // Assets visibles (públicos + keyword desbloqueadas)
  const layerAssets = assets.filter(a =>
    a.layerKey === categoryKey &&
    (!a.keywordId || state.unlockedKeywords.includes(a.keywordId))
  )

  const selectedId = state.selectedAssets[categoryKey] ?? null

  // ── CABEZA: estilos + tonos de piel ──────────────────
  if (categoryKey === 'head') {
    return (
      <div className="space-y-5">
        <AssetGrid
          assets={layerAssets}
          selectedId={selectedId}
          optional={layer?.optional ?? false}
          onSelect={id => onSelectAsset('head', id)}
        />

        <div>
          <Divider label={t('Tono de piel', 'Skin tone')} />
          <div className="grid grid-cols-5 gap-2 mt-3">
            {SKIN_TONES.map(tone => {
              const active = state.tokens['skin-color'] === tone.hex
              return (
                <button
                  key={tone.hex}
                  onClick={() => onSkinChange(tone.hex)}
                  title={tone.emoji}
                  className="aspect-square rounded-2xl transition-all relative fx-tap"
                  style={{
                    background: tone.hex,
                    outline: active ? '3px solid #a78bfa' : tone.fantasy ? '1px dashed rgba(255,255,255,0.15)' : '1px solid rgba(255,255,255,0.08)',
                    outlineOffset: active ? 3 : 0,
                    transform: active ? 'scale(1.12)' : undefined,
                    boxShadow: active ? `0 0 16px ${tone.hex}80` : undefined,
                  }}
                >
                  {tone.fantasy && (
                    <span className="absolute -top-1 -right-1 text-[9px] leading-none">✦</span>
                  )}
                </button>
              )
            })}
          </div>
          <p className="text-[9px] mt-2" style={{ color: 'rgba(255,255,255,0.2)' }}>
            {t('Bordes punteados = tonos de fantasía', 'Dashed border = fantasy tones')}
          </p>
        </div>
      </div>
    )
  }

  // ── CABELLO: frente + color + trasero en un solo panel ──
  if (categoryKey === 'hair-back') {
    const hairFrontAssets = assets.filter(a =>
      a.layerKey === 'hair-front' &&
      (!a.keywordId || state.unlockedKeywords.includes(a.keywordId))
    )
    const hairFrontId = state.selectedAssets['hair-front'] ?? null

    function handleHairFront(assetId: string | null) {
      onSelectAsset('hair-front', assetId)
      if (assetId) {
        const a = assets.find(x => x.id === assetId)
        if (a?.suggestedColor) onHairColorChange(a.suggestedColor)
      }
    }

    function handleHairBack(assetId: string | null) {
      onSelectAsset('hair-back', assetId)
      if (assetId) {
        const a = assets.find(x => x.id === assetId)
        if (a?.suggestedColor) onHairColorChange(a.suggestedColor)
      }
    }

    return (
      <div className="space-y-5">

        {/* FRENTE */}
        <div>
          <p className="text-[9px] font-semibold uppercase tracking-widest mb-3" style={{ color: 'rgba(255,255,255,0.25)' }}>
            {t('Frente', 'Front')}
          </p>
          <AssetGrid
            assets={hairFrontAssets}
            selectedId={hairFrontId}
            optional={true}
            onSelect={handleHairFront}
          />
        </div>

        {/* COLOR */}
        <div>
          <Divider label={t('Color', 'Color')} />
          <div className="grid grid-cols-6 gap-2 mt-3">
            {HAIR_COLORS.map(hex => {
              const active = state.tokens['hair-color'] === hex
              return (
                <button
                  key={hex}
                  onClick={() => onHairColorChange(hex)}
                  className="aspect-square rounded-xl transition-all fx-tap"
                  style={{
                    background: hex,
                    outline: active ? '3px solid #a78bfa' : '1px solid rgba(255,255,255,0.08)',
                    outlineOffset: active ? 2 : 0,
                    transform: active ? 'scale(1.12)' : undefined,
                  }}
                />
              )
            })}
          </div>
          <div className="mt-3 flex items-center gap-3">
            <input
              type="color"
              value={state.tokens['hair-color'] ?? '#3B2314'}
              onChange={e => onHairColorChange(e.target.value)}
              className="w-9 h-9 rounded-xl cursor-pointer border-0 bg-transparent"
              title={t('Color personalizado', 'Custom color')}
            />
            <p className="text-[10px]" style={{ color: 'rgba(255,255,255,0.3)' }}>
              {t('Color personalizado', 'Custom color')}
            </p>
          </div>
        </div>

        {/* TRASERO */}
        <div>
          <Divider label={t('Trasero', 'Back')} />
          <div className="mt-3">
            <AssetGrid
              assets={layerAssets}
              selectedId={selectedId}
              optional={layer?.optional ?? false}
              onSelect={handleHairBack}
            />
          </div>
        </div>

      </div>
    )
  }

  // ── CAPAS CON EDICIÓN EXTRA (XTRA keyword) ────────────
  if (state.extraColor && EXTRA_COLOR_LAYERS.has(categoryKey)) {
    const colorKey = `${categoryKey}-color`
    return (
      <div className="space-y-5">
        <AssetGrid
          assets={layerAssets}
          selectedId={selectedId}
          optional={layer?.optional ?? false}
          onSelect={id => onSelectAsset(categoryKey, id)}
        />
        <div>
          <Divider label={t('Color', 'Color')} />
          <div className="flex items-center gap-3 mt-3">
            <input
              type="color"
              value={state.tokens[colorKey] ?? '#ffffff'}
              onChange={e => onExtraColorChange(colorKey, e.target.value)}
              className="w-9 h-9 rounded-xl cursor-pointer border-0 bg-transparent"
            />
            <p className="text-[10px]" style={{ color: 'rgba(255,255,255,0.3)' }}>
              {t('Personalizar color', 'Customize color')}
            </p>
            <span className="text-[9px] px-1.5 py-0.5 rounded-full ml-auto" style={{ background: 'rgba(124,58,237,0.3)', color: '#c4b5fd' }}>XTRA</span>
          </div>
        </div>
      </div>
    )
  }

  // ── OTRAS CAPAS: solo grid de assets ──────────────────
  return (
    <AssetGrid
      assets={layerAssets}
      selectedId={selectedId}
      optional={layer?.optional ?? false}
      onSelect={id => onSelectAsset(categoryKey, id)}
    />
  )
}

// ══════════════════════════════════════════════════════════
// AssetGrid
// ══════════════════════════════════════════════════════════
function AssetGrid({ assets, selectedId, optional, onSelect }: {
  assets:     Asset[]
  selectedId: string | null
  optional:   boolean
  onSelect:   (id: string | null) => void
}) {
  if (assets.length === 0) {
    return (
      <p className="text-sm py-6 text-center" style={{ color: 'rgba(255,255,255,0.2)' }}>Sin opciones</p>
    )
  }

  return (
    <div className="grid grid-cols-3 gap-2.5">
      {optional && (
        <button
          onClick={() => onSelect(null)}
          className="aspect-square rounded-2xl flex items-center justify-center transition-all fx-item-in fx-tap"
          style={{
            border: `2px solid ${selectedId === null ? 'rgba(124,58,237,0.8)' : 'rgba(255,255,255,0.08)'}`,
            background: selectedId === null ? 'rgba(124,58,237,0.12)' : 'rgba(255,255,255,0.02)',
          }}
        >
          <span style={{ color: 'rgba(255,255,255,0.2)', fontSize: 20 }}>∅</span>
        </button>
      )}

      {assets.map((asset, i) => {
        const isActive = selectedId === asset.id
        return (
          <button
            key={asset.id}
            onClick={() => onSelect(asset.id)}
            className="relative aspect-square rounded-2xl overflow-hidden transition-all fx-item-in fx-tap"
            style={{
              border: `2px solid ${isActive ? '#7c3aed' : 'rgba(255,255,255,0.07)'}`,
              background: 'rgba(255,255,255,0.03)',
              transform: isActive ? 'scale(1.06)' : undefined,
              boxShadow: isActive ? '0 0 20px rgba(124,58,237,0.5)' : undefined,
              animationDelay: `${Math.min(i * 30, 360)}ms`,
            }}
          >
            {asset.cdnUrl && (
              <Image src={asset.cdnUrl} alt={asset.name} fill className="object-cover" unoptimized />
            )}
            {asset.keywordId && (
              <span className="absolute top-1 right-1 text-[9px]">✦</span>
            )}
            {isActive && (
              <span className="absolute bottom-1.5 right-1.5 w-5 h-5 rounded-full flex items-center justify-center" style={{ background: '#7c3aed' }}>
                <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}

// ══════════════════════════════════════════════════════════
// KeywordSection — siempre visible al fondo del panel
// ══════════════════════════════════════════════════════════
interface KeywordSectionProps {
  collectionId: string
  state:        AvatarState
  onUnlock:     (id: string, isXtra: boolean) => void
  locale:       string
}

function KeywordSection({ collectionId, state, onUnlock, locale }: KeywordSectionProps) {
  const [open, setOpen]     = useState(false)
  const [value, setValue]   = useState('')
  const [status, setStatus] = useState<'idle' | 'loading' | 'ok' | 'err'>('idle')
  const [label, setLabel]   = useState('')
  const t = (es: string, en: string) => locale === 'en' ? en : es

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!value.trim()) return
    setStatus('loading')
    const res  = await fetch(`/api/keywords?keyword=${encodeURIComponent(value.trim().toUpperCase())}&collectionId=${collectionId}`)
    const data = await res.json()
    if (data.valid) {
      const isXtra = (data.keyword.label as string).toLowerCase().includes('xtra') ||
                     (data.keyword.keyword as string).toLowerCase().includes('xtra')
      setLabel(data.keyword.label)
      onUnlock(data.keyword.id, isXtra)
      setStatus('ok')
      setValue('')
      setTimeout(() => { setOpen(false); setStatus('idle') }, 1200)
    } else {
      setStatus('err')
      setTimeout(() => setStatus('idle'), 2000)
    }
  }

  return (
    <div>
      {/* Unlocked keyword badges */}
      {state.unlockedKeywords.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-3">
          {state.extraColor && (
            <span className="text-[9px] font-semibold px-2 py-1 rounded-full" style={{ background: 'rgba(124,58,237,0.3)', color: '#c4b5fd' }}>
              ✦ XTRA
            </span>
          )}
          <span className="text-[9px] px-2 py-1 rounded-full" style={{ background: 'rgba(16,185,129,0.2)', color: '#6ee7b7' }}>
            🔓 {state.unlockedKeywords.length} {t('clave(s)', 'key(s)')}
          </span>
        </div>
      )}

      {open ? (
        <form onSubmit={handleSubmit} className="flex gap-2">
          <input
            autoFocus
            type="text"
            value={value}
            onChange={e => setValue(e.target.value.toUpperCase())}
            placeholder={t('CÓDIGO SECRETO', 'SECRET CODE')}
            disabled={status === 'loading'}
            className="flex-1 text-xs rounded-xl px-3 py-2 focus:outline-none transition-colors"
            style={{
              background: 'rgba(255,255,255,0.06)',
              border: status === 'err' ? '1px solid rgba(239,68,68,0.6)' : status === 'ok' ? '1px solid rgba(16,185,129,0.6)' : '1px solid rgba(255,255,255,0.1)',
              color: 'white',
              letterSpacing: '0.08em',
            }}
          />
          <button
            type="submit"
            disabled={status === 'loading'}
            className="text-xs font-semibold px-3 py-2 rounded-xl transition-all disabled:opacity-50 shrink-0"
            style={{ background: status === 'ok' ? 'rgba(16,185,129,0.8)' : status === 'err' ? 'rgba(239,68,68,0.7)' : 'rgba(124,58,237,0.8)', color: 'white' }}
          >
            {status === 'loading' ? '…' : status === 'ok' ? '✓' : status === 'err' ? '✗' : t('Activar', 'Unlock')}
          </button>
          <button type="button" onClick={() => { setOpen(false); setValue(''); setStatus('idle') }} className="text-xs px-2" style={{ color: 'rgba(255,255,255,0.3)' }}>✕</button>
        </form>
      ) : (
        <button
          onClick={() => setOpen(true)}
          className="text-xs flex items-center gap-1.5 transition-colors"
          style={{ color: 'rgba(255,255,255,0.3)' }}
          onMouseEnter={e => (e.currentTarget.style.color = '#a78bfa')}
          onMouseLeave={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.3)')}
        >
          🔑 {t('Tengo un código secreto', 'I have a secret code')}
        </button>
      )}
    </div>
  )
}

// ── Divider util ──────────────────────────────────────────
function Divider({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-px" style={{ background: 'rgba(255,255,255,0.07)' }} />
      <span className="text-[9px] font-semibold uppercase tracking-widest shrink-0" style={{ color: 'rgba(255,255,255,0.25)' }}>{label}</span>
      <div className="flex-1 h-px" style={{ background: 'rgba(255,255,255,0.07)' }} />
    </div>
  )
}
