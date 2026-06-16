'use client'

import { useState, useCallback, useRef } from 'react'
import dynamic from 'next/dynamic'
import Image from 'next/image'
import type { AvatarState, Layer, Asset, LayerException, LayerDefault, Collection } from '@/types'
import type { AvatarCompositor } from '@/lib/engine/compositor'
import { SKIN_TONES } from '@/components/builder/SkinSelector'
import { HAIR_PRESETS } from '@/components/builder/HairColorPicker'
import ExportModal from '@/components/builder/ExportModal'
import Link from 'next/link'

const AvatarCanvas = dynamic(() => import('@/components/builder/AvatarCanvas'), {
  ssr: false,
  loading: () => <div className="w-full h-full" style={{ background: 'rgba(255,255,255,0.02)', borderRadius: 999 }} />,
})

// ── Layer display config ─────────────────────────────────
const LAYER_META: Record<string, { emoji: string; es: string; en: string }> = {
  'background':   { emoji: '🌅', es: 'Fondo',     en: 'Background' },
  'emotion':      { emoji: '😄', es: 'Expresión', en: 'Expression' },
  'hair-back':    { emoji: '💇', es: 'Cabello',   en: 'Hair' },
  'head':         { emoji: '🧑', es: 'Cabeza',    en: 'Head' },
  'shirt':        { emoji: '👕', es: 'Ropa',      en: 'Outfit' },
  'hair-front':   { emoji: '✂️', es: 'Frente',   en: 'Front hair' },
  'acc-front':    { emoji: '🎩', es: 'Accesorio', en: 'Accessory' },
  'mask':         { emoji: '😷', es: 'Máscara',   en: 'Mask' },
  'effect-final': { emoji: '✨', es: 'Efecto',    en: 'Effect' },
  'frame':        { emoji: '🖼️', es: 'Marco',    en: 'Frame' },
}

// ── Helpers ───────────────────────────────────────────────
function buildInitialState(collection: Collection | null, layers: Layer[], assets: Asset[], defaults: LayerDefault[]): AvatarState {
  const skinHex = defaults.find(d => d.tokenId === 'skin-color')?.defaultHex || SKIN_TONES[3].hex
  const hairHex = defaults.find(d => d.tokenId === 'hair-color')?.defaultHex || HAIR_PRESETS[0].hex
  const selectedAssets: Record<string, string | null> = {}
  for (const layer of layers) {
    const def = assets.find(a => a.layerKey === layer.layerKey && a.isDefault)
    const first = assets.find(a => a.layerKey === layer.layerKey)
    selectedAssets[layer.layerKey] = layer.optional ? null : (def?.id || first?.id || null)
  }
  return { collectionId: collection?.id || '', tokens: { 'skin-color': skinHex, 'hair-color': hairHex }, selectedAssets, unlockedKeywords: [] }
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

// ── Category tab definition ───────────────────────────────
type CategoryId = string | '__skin__' | '__hair__'

function buildCategories(layers: Layer[]): Array<{ id: CategoryId; emoji: string; es: string; en: string }> {
  const cats: Array<{ id: CategoryId; emoji: string; es: string; en: string }> = []
  for (const l of layers) {
    const m = LAYER_META[l.layerKey]
    cats.push({ id: l.layerKey, emoji: m?.emoji ?? '📁', es: l.labelEs || m?.es || l.layerKey, en: l.labelEn || m?.en || l.layerKey })
    // Inject skin picker after head, hair color after hair-back
    if (l.layerKey === 'head') cats.push({ id: '__skin__', emoji: '🎨', es: 'Piel', en: 'Skin' })
    if (l.layerKey === 'hair-back') cats.push({ id: '__hair__', emoji: '💜', es: 'Color', en: 'Color' })
  }
  return cats
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
  const [locale, setLocale] = useState(initialLocale)
  const [state, setState] = useState<AvatarState>(() => buildInitialState(collection, layers, assets, defaults))
  const [exportUrl, setExportUrl] = useState<string | null>(null)
  const compositorRef = useRef<AvatarCompositor | null>(null)

  const categories = buildCategories(layers)
  const [activeCat, setActiveCat] = useState<CategoryId>(categories[0]?.id ?? '')

  const hiddenLayers = getHiddenLayers(state, exceptions)

  function setToken(key: 'skin-color' | 'hair-color', hex: string) {
    setState(s => ({ ...s, tokens: { ...s.tokens, [key]: hex } }))
  }

  function selectAsset(layerKey: string, assetId: string | null) {
    setState(s => ({ ...s, selectedAssets: { ...s.selectedAssets, [layerKey]: assetId } }))
  }

  function randomize() {
    const sel: Record<string, string | null> = {}
    for (const layer of layers) {
      const opts = assets.filter(a => a.layerKey === layer.layerKey)
      if (!opts.length) { sel[layer.layerKey] = null; continue }
      if (layer.optional && Math.random() < 0.4) { sel[layer.layerKey] = null; continue }
      sel[layer.layerKey] = opts[Math.floor(Math.random() * opts.length)].id
    }
    const skin = SKIN_TONES[Math.floor(Math.random() * SKIN_TONES.length)]
    const hair = HAIR_PRESETS[Math.floor(Math.random() * HAIR_PRESETS.length)]
    setState(s => ({ ...s, selectedAssets: sel, tokens: { 'skin-color': skin.hex, 'hair-color': hair.hex } }))
  }

  function handleExport() {
    if (!compositorRef.current) return
    setExportUrl(compositorRef.current.exportPNG())
  }

  const handleCompositorReady = useCallback((c: AvatarCompositor) => {
    compositorRef.current = c
  }, [])

  const t = (es: string, en: string) => locale === 'en' ? en : es

  if (!collection) {
    return (
      <div className="h-screen flex flex-col items-center justify-center gap-4" style={{ background: '#07070e', color: 'white' }}>
        <div className="text-6xl">🎨</div>
        <p className="text-lg font-semibold">Avatar OS</p>
        <p className="text-sm" style={{ color: 'rgba(255,255,255,0.4)' }}>No hay colecciones activas.</p>
        <Link href={`/${locale}/admin`} className="text-violet-400 text-sm hover:underline">Ir al Admin →</Link>
      </div>
    )
  }

  return (
    <div className="h-screen flex flex-col overflow-hidden select-none" style={{ background: '#07070e', color: 'white' }}>

      {/* ── HEADER ───────────────────────────────────────── */}
      <header className="shrink-0 flex items-center justify-between px-5 h-12 border-b" style={{ borderColor: 'rgba(255,255,255,0.06)', background: '#0a0a14' }}>
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-lg flex items-center justify-center text-sm" style={{ background: 'linear-gradient(135deg,#7c3aed,#a855f7)' }}>✦</div>
          <span className="text-sm font-semibold">Avatar OS</span>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setLocale(l => l === 'es' ? 'en' : 'es')}
            className="text-xs px-2 py-1 rounded-lg transition-all"
            style={{ background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.5)' }}
          >
            {locale === 'es' ? 'EN' : 'ES'}
          </button>
          <button
            onClick={handleExport}
            className="text-xs font-semibold px-4 py-1.5 rounded-xl transition-all"
            style={{ background: 'linear-gradient(135deg,#7c3aed,#a855f7)', color: 'white' }}
          >
            ✨ {t('Crear PFP', 'Create PFP')}
          </button>
        </div>
      </header>

      {/* ── BODY: canvas + panel ─────────────────────────── */}
      <div className="flex-1 flex overflow-hidden">

        {/* CANVAS AREA */}
        <div className="flex-1 flex items-center justify-center p-6 lg:p-10 min-w-0">
          <div className="relative w-full max-w-[420px] aspect-square">
            {/* Soft glow behind avatar */}
            <div className="absolute inset-0 rounded-full blur-3xl opacity-20" style={{ background: 'radial-gradient(circle, #7c3aed 0%, transparent 70%)' }} />
            <div className="relative w-full h-full rounded-[36px] overflow-hidden shadow-2xl" style={{ boxShadow: '0 40px 80px rgba(0,0,0,0.8), inset 0 1px 0 rgba(255,255,255,0.06)' }}>
              <AvatarCanvas
                state={state}
                layers={layers.filter(l => !hiddenLayers.has(l.layerKey))}
                assets={assets}
                onCompositorReady={handleCompositorReady}
              />
            </div>

            {/* Randomize button floating on canvas */}
            <button
              onClick={randomize}
              className="absolute bottom-3 left-3 text-xs font-medium px-3 py-1.5 rounded-xl backdrop-blur-md transition-all"
              style={{ background: 'rgba(0,0,0,0.5)', color: 'rgba(255,255,255,0.7)', border: '1px solid rgba(255,255,255,0.1)' }}
              onMouseEnter={e => (e.currentTarget.style.background = 'rgba(0,0,0,0.75)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'rgba(0,0,0,0.5)')}
            >
              🎲 {t('Aleatorio', 'Random')}
            </button>
          </div>
        </div>

        {/* CONTROL PANEL */}
        <aside className="w-[300px] lg:w-[340px] flex flex-col border-l shrink-0" style={{ borderColor: 'rgba(255,255,255,0.05)', background: '#0b0b16' }}>

          {/* Category tab bar */}
          <div className="shrink-0 border-b overflow-x-auto" style={{ borderColor: 'rgba(255,255,255,0.05)' }}>
            <div className="flex gap-0.5 p-2 min-w-max">
              {categories.map(cat => {
                const isActive = activeCat === cat.id
                const isHidden = cat.id !== '__skin__' && cat.id !== '__hair__' && hiddenLayers.has(cat.id)
                if (isHidden) return null
                return (
                  <button
                    key={cat.id}
                    onClick={() => setActiveCat(cat.id)}
                    className="flex flex-col items-center gap-0.5 px-2.5 py-2 rounded-xl transition-all shrink-0"
                    style={{
                      background: isActive ? 'rgba(124,58,237,0.2)' : 'transparent',
                      outline: isActive ? '1px solid rgba(124,58,237,0.4)' : 'none',
                    }}
                  >
                    <span className="text-base leading-none">{cat.emoji}</span>
                    <span className="text-[9px] font-medium transition-colors whitespace-nowrap" style={{ color: isActive ? '#a78bfa' : 'rgba(255,255,255,0.35)' }}>
                      {t(cat.es, cat.en)}
                    </span>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Category content */}
          <div className="flex-1 overflow-y-auto p-4">
            <CategoryPanel
              categoryId={activeCat}
              layers={layers}
              assets={assets}
              state={state}
              onSelectAsset={selectAsset}
              onSkinChange={hex => setToken('skin-color', hex)}
              onHairChange={hex => setToken('hair-color', hex)}
              locale={locale}
            />
          </div>

          {/* Export CTA at bottom */}
          <div className="shrink-0 p-4 border-t" style={{ borderColor: 'rgba(255,255,255,0.05)' }}>
            <button
              onClick={handleExport}
              className="w-full text-sm font-semibold py-3 rounded-2xl transition-all"
              style={{ background: 'linear-gradient(135deg,#6d28d9,#9333ea)', color: 'white', boxShadow: '0 4px 20px rgba(124,58,237,0.35)' }}
              onMouseEnter={e => (e.currentTarget.style.boxShadow = '0 4px 28px rgba(124,58,237,0.55)')}
              onMouseLeave={e => (e.currentTarget.style.boxShadow = '0 4px 20px rgba(124,58,237,0.35)')}
            >
              ✨ {t('Crear mi PFP', 'Create my PFP')}
            </button>
          </div>
        </aside>
      </div>

      {/* Export modal */}
      {exportUrl && <ExportModal dataUrl={exportUrl} onClose={() => setExportUrl(null)} />}
    </div>
  )
}

// ── Category panel content ────────────────────────────────
interface PanelProps {
  categoryId: CategoryId
  layers: Layer[]
  assets: Asset[]
  state: AvatarState
  onSelectAsset: (layerKey: string, id: string | null) => void
  onSkinChange: (hex: string) => void
  onHairChange: (hex: string) => void
  locale: string
}

function CategoryPanel({ categoryId, layers, assets, state, onSelectAsset, onSkinChange, onHairChange, locale }: PanelProps) {
  const t = (es: string, en: string) => locale === 'en' ? en : es

  // Special: skin color picker
  if (categoryId === '__skin__') {
    return (
      <div>
        <p className="text-xs font-semibold mb-4" style={{ color: 'rgba(255,255,255,0.3)' }}>{t('Tono de piel', 'Skin tone')}</p>
        <div className="grid grid-cols-4 gap-3">
          {SKIN_TONES.map(tone => {
            const active = state.tokens['skin-color'] === tone.hex
            return (
              <button
                key={tone.hex}
                onClick={() => onSkinChange(tone.hex)}
                className="aspect-square rounded-2xl transition-all"
                style={{
                  background: tone.hex,
                  outline: active ? `3px solid #a78bfa` : `1px solid rgba(255,255,255,0.08)`,
                  outlineOffset: active ? 3 : 0,
                  transform: active ? 'scale(1.1)' : undefined,
                  boxShadow: active ? `0 0 16px ${tone.hex}80` : undefined,
                }}
              />
            )
          })}
        </div>
      </div>
    )
  }

  // Special: hair color picker
  if (categoryId === '__hair__') {
    return (
      <div>
        <p className="text-xs font-semibold mb-4" style={{ color: 'rgba(255,255,255,0.3)' }}>{t('Color de cabello', 'Hair color')}</p>
        <div className="grid grid-cols-4 gap-3">
          {HAIR_PRESETS.map(preset => {
            const active = state.tokens['hair-color'] === preset.hex
            return (
              <button
                key={preset.hex}
                onClick={() => onHairChange(preset.hex)}
                className="aspect-square rounded-2xl transition-all"
                style={{
                  background: preset.hex,
                  outline: active ? `3px solid #a78bfa` : `1px solid rgba(255,255,255,0.08)`,
                  outlineOffset: active ? 3 : 0,
                  transform: active ? 'scale(1.1)' : undefined,
                  boxShadow: active ? `0 0 16px ${preset.hex}80` : undefined,
                }}
              />
            )
          })}
        </div>

        {/* Custom color picker */}
        <div className="mt-4 pt-4 border-t" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
          <p className="text-[10px] mb-2" style={{ color: 'rgba(255,255,255,0.25)' }}>{t('Color personalizado', 'Custom color')}</p>
          <input
            type="color"
            value={state.tokens['hair-color']}
            onChange={e => onHairChange(e.target.value)}
            className="w-10 h-10 rounded-xl cursor-pointer border-0"
            style={{ background: 'none' }}
          />
        </div>
      </div>
    )
  }

  // Layer assets
  const layer = layers.find(l => l.layerKey === categoryId)
  if (!layer) return null

  const layerAssets = assets.filter(a => a.layerKey === categoryId)
  const selectedId  = state.selectedAssets[categoryId] ?? null

  return (
    <div>
      {layerAssets.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <p className="text-4xl mb-3 opacity-20">{LAYER_META[categoryId]?.emoji ?? '📁'}</p>
          <p className="text-sm" style={{ color: 'rgba(255,255,255,0.25)' }}>{t('Sin assets en esta capa', 'No assets in this layer')}</p>
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-2.5">
          {/* None option for optional layers */}
          {layer.optional && (
            <button
              onClick={() => onSelectAsset(categoryId, null)}
              className="aspect-square rounded-2xl flex items-center justify-center transition-all"
              style={{
                border: `2px solid ${selectedId === null ? 'rgba(124,58,237,0.8)' : 'rgba(255,255,255,0.08)'}`,
                background: selectedId === null ? 'rgba(124,58,237,0.12)' : 'rgba(255,255,255,0.02)',
              }}
            >
              <span style={{ color: 'rgba(255,255,255,0.2)', fontSize: 20 }}>∅</span>
            </button>
          )}

          {layerAssets.map(asset => {
            const isActive = selectedId === asset.id
            const meta     = LAYER_META[categoryId]
            const accent   = '#7c3aed'
            return (
              <button
                key={asset.id}
                onClick={() => onSelectAsset(categoryId, asset.id)}
                className="relative aspect-square rounded-2xl overflow-hidden transition-all"
                style={{
                  border: `2px solid ${isActive ? accent : 'rgba(255,255,255,0.07)'}`,
                  background: 'rgba(255,255,255,0.03)',
                  transform: isActive ? 'scale(1.06)' : undefined,
                  boxShadow: isActive ? `0 0 20px ${accent}50` : undefined,
                }}
              >
                {asset.cdnUrl ? (
                  <Image
                    src={asset.cdnUrl}
                    alt={asset.name}
                    fill
                    className="object-cover"
                    unoptimized
                  />
                ) : (
                  <span className="text-xs" style={{ color: 'rgba(255,255,255,0.2)' }}>{asset.fileType}</span>
                )}

                {/* Keyword badge */}
                {asset.keywordId && !isActive && (
                  <span className="absolute top-1 right-1 text-[9px]">✦</span>
                )}

                {/* Active check */}
                {isActive && (
                  <span className="absolute bottom-1.5 right-1.5 w-5 h-5 rounded-full flex items-center justify-center" style={{ background: accent }}>
                    <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                  </span>
                )}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
