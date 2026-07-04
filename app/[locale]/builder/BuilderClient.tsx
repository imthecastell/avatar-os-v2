'use client'

import { useState, useRef, useEffect, useMemo } from 'react'
import { createPortal } from 'react-dom'
import Image from 'next/image'
import type { AvatarState, Layer, Asset, AssetTransform, LayerException, LayerDefault, Collection, SiteSettings, ColorUnlock } from '@/types'
import { pickThumb } from '@/lib/thumb'
import { makeT, LOCALE_META, type Locale } from '@/lib/i18n/dict'
import ExportModal from '@/components/builder/ExportModal'
import ConfettiBurst from '@/components/builder/ConfettiBurst'
import AvatarStage, { type AvatarStageHandle } from '@/components/builder/AvatarStage'
import WelcomeScreen from '@/components/builder/WelcomeScreen'
import Link from 'next/link'

// Elige el idioma más cercano dentro de un registro { es, en, nl, fr, ...resto }
type LocalizedLabel = { es: string; en: string; nl: string; fr: string }
function pickLang(obj: LocalizedLabel, locale: string): string {
  return obj[locale as keyof LocalizedLabel] ?? obj.en
}

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

// ── Constants ─────────────────────────────────────────────

// Capas ocultas en builder — ahora se leen de layer.visibleInBuilder (gestionado en admin)
// Mantenemos este set solo para la capa hair-front que se gestiona dentro del tab de cabello
const ALWAYS_HIDDEN = new Set(['hair-front'])

// Emojis y labels por capa
const LAYER_META: Record<string, { emoji: string; es: string; en: string; nl: string; fr: string }> = {
  'background':   { emoji: '🌅', es: 'Fondo',      en: 'Background', nl: 'Achtergrond', fr: 'Fond' },
  'emotion':      { emoji: '😄', es: 'Expresión',  en: 'Expression', nl: 'Uitdrukking', fr: 'Expression' },
  'hair-back':    { emoji: '💇', es: 'Cabello',    en: 'Hair',       nl: 'Haar',        fr: 'Cheveux' },
  'head':         { emoji: '🧑', es: 'Cabeza',     en: 'Head',       nl: 'Hoofd',       fr: 'Tête' },
  'body':         { emoji: '🫁', es: 'Cuerpo',     en: 'Body',       nl: 'Lichaam',     fr: 'Corps' },
  'shirt':        { emoji: '👕', es: 'Ropa',       en: 'Outfit',     nl: 'Outfit',      fr: 'Tenue' },
  'clothes':      { emoji: '🧥', es: 'Prendas',    en: 'Clothes',    nl: 'Kleding',     fr: 'Vêtements' },
  'acc-front':    { emoji: '🎩', es: 'Accesorio',  en: 'Accessory',  nl: 'Accessoire',  fr: 'Accessoire' },
  'mask':         { emoji: '😷', es: 'Máscara',    en: 'Mask',       nl: 'Masker',      fr: 'Masque' },
  'effect-final': { emoji: '✨', es: 'Efecto',     en: 'Effect',     nl: 'Effect',      fr: 'Effet' },
  'frame':        { emoji: '🖼️', es: 'Marco',     en: 'Frame',      nl: 'Kader',       fr: 'Cadre' },
  'arch':         { emoji: '🏛️', es: 'Arco',      en: 'Arch',       nl: 'Boog',        fr: 'Arche' },
  'flower':       { emoji: '🌸', es: 'Flores',    en: 'Flowers',    nl: 'Bloemen',     fr: 'Fleurs' },
  'window':       { emoji: '🪟', es: 'Ventana',    en: 'Window',     nl: 'Venster',     fr: 'Fenêtre' },
}

// Tonos de piel: paleta oficial Twemoji (modificadores Fitzpatrick) + 3 fantasía
const SKIN_TONES = [
  { hex: '#F7DECE', emoji: '🏻', fantasy: false },
  { hex: '#F3D2A2', emoji: '🏼', fantasy: false },
  { hex: '#D5AB88', emoji: '🏽', fantasy: false },
  { hex: '#AF7E57', emoji: '🏾', fantasy: false },
  { hex: '#7C533E', emoji: '🏿', fantasy: false },
  { hex: '#FFDC5D', emoji: '🟡', fantasy: false },
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


// ── Ruta guiada (solo la primera visita) ──────────────────
// Cada paso muestra el panel de una o más capas; los pasos cuyas capas
// no existen o no tienen assets en la colección se omiten solos.
const WIZARD_FLOW: { keys: string[]; emoji: string; es: string; en: string; nl: string; fr: string }[] = [
  { keys: ['background'],   emoji: '🌅', es: 'Elige tu fondo',              en: 'Pick your background',    nl: 'Kies je achtergrond',        fr: 'Choisis ton fond' },
  { keys: ['frame'],        emoji: '🖼️', es: 'Elige el marco',              en: 'Pick the frame',          nl: 'Kies het kader',             fr: 'Choisis le cadre' },
  { keys: ['arch'],         emoji: '🏛️', es: 'Elige el arco',               en: 'Pick the arch',           nl: 'Kies de boog',               fr: "Choisis l'arche" },
  { keys: ['head', 'body'], emoji: '🧑', es: 'Forma del rostro y cuerpo',   en: 'Face shape & body',       nl: 'Gezichtsvorm & lichaam',     fr: 'Forme du visage et corps' },
  { keys: ['shirt'],        emoji: '👕', es: 'Elige la camiseta',           en: 'Pick the shirt',          nl: 'Kies het shirt',             fr: 'Choisis le t-shirt' },
  { keys: ['hair-back'],    emoji: '💇', es: 'Corte y color de cabello',    en: 'Hair style & color',      nl: 'Kapsel & haarkleur',         fr: 'Coupe et couleur de cheveux' },
  { keys: ['mask'],         emoji: '😷', es: 'Máscara (opcional)',          en: 'Mask (optional)',         nl: 'Masker (optioneel)',         fr: 'Masque (facultatif)' },
]

const WIZARD_DONE_KEY = 'avatarOS.wizardDone'

// ── Helpers ───────────────────────────────────────────────
function buildInitialState(collection: Collection | null, layers: Layer[], assets: Asset[], defaults: LayerDefault[]): AvatarState {
  const skinHex = defaults.find(d => d.tokenId === 'skin-color')?.defaultHex ?? '#C68642'
  const hairHex = defaults.find(d => d.tokenId === 'hair-color')?.defaultHex ?? '#3B2314'

  const selectedAssets: Record<string, string | null> = {}
  for (const layer of layers) {
    const def   = assets.find(a => a.layerKey === layer.layerKey && a.isDefault)
    const first = assets.find(a => a.layerKey === layer.layerKey && !a.keywordId)
    // Un default marcado en el admin se respeta aunque la capa sea opcional
    // (ej. body: opcional pero el avatar sin cuello/brazos se ve roto)
    selectedAssets[layer.layerKey] = def?.id ?? (layer.optional ? null : (first?.id ?? null))
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

// Un asset con keywordId requiere esa keyword desbloqueada, o cualquier
// keyword master (la palabra clave universal que libera todo).
function isAssetUnlocked(asset: Asset, state: AvatarState, masterKeywordIds: string[]): boolean {
  if (!asset.keywordId) return true
  if (state.unlockedKeywords.includes(asset.keywordId)) return true
  return state.unlockedKeywords.some(id => masterKeywordIds.includes(id))
}

// Reglas de color_unlocks activas para una capa: la keyword requerida está
// desbloqueada (o el usuario tiene alguna keyword master) Y, si la regla
// exige un asset específico seleccionado (ej. una chaqueta abierta),
// ese asset es el que está activo en su propia capa.
function getActiveColorUnlocks(
  colorUnlocks: ColorUnlock[], state: AvatarState, masterKeywordIds: string[], assets: Asset[], layerKey: string
): ColorUnlock[] {
  const hasMaster = state.unlockedKeywords.some(id => masterKeywordIds.includes(id))
  const matches = colorUnlocks.filter(u => {
    if (u.targetLayerKey !== layerKey) return false
    // targetAssetId: la regla solo aplica si ESTE asset específico está
    // seleccionado en la capa (ej. "Lentes" tiene color desbloqueable, otro
    // accesorio de la misma capa no).
    if (u.targetAssetId && state.selectedAssets[layerKey] !== u.targetAssetId) return false
    if (u.keywordId && !hasMaster && !state.unlockedKeywords.includes(u.keywordId)) return false
    if (u.scopeAssetId) {
      const scopeAsset = assets.find(a => a.id === u.scopeAssetId)
      if (!scopeAsset || state.selectedAssets[scopeAsset.layerKey] !== u.scopeAssetId) return false
    }
    return true
  })

  // Varias palabras clave pueden desbloquear la MISMA función de color (ej.
  // "Lentes" con 3-4 palabras válidas) — cada una crea su propia fila, pero
  // si más de una está activa a la vez deben mostrarse como un solo control,
  // no repetido.
  const seen = new Set<string>()
  return matches.filter(u => {
    const sig = `${u.targetAssetId ?? ''}|${u.targetRole}|${u.mode}|${(u.swatches ?? []).join(',')}`
    if (seen.has(sig)) return false
    seen.add(sig)
    return true
  })
}

// ── Component ─────────────────────────────────────────────
interface Props {
  locale: string
  collection: Collection | null
  layers: Layer[]
  assets: Asset[]
  exceptions: LayerException[]
  defaults: LayerDefault[]
  settings?: SiteSettings | null
  colorUnlocks?: ColorUnlock[]
  masterKeywordIds?: string[]
}

export default function BuilderClient({ locale: initialLocale, collection, layers, assets, exceptions, defaults, settings, colorUnlocks = [], masterKeywordIds = [] }: Props) {
  const [locale, setLocale]       = useState(initialLocale)
  const [state, setState]         = useState<AvatarState>(() => buildInitialState(collection, layers, assets, defaults))
  const [exportUrl, setExportUrl] = useState<string | null>(null)
  const [shareUrl, setShareUrl]   = useState<string | null>(null)
  const [showWelcome, setShowWelcome] = useState(true)
  const stageRef                  = useRef<AvatarStageHandle | null>(null)

  // FX — solo afectan la UI mientras se arma el avatar; el PNG exportado es estático
  const [popTick,  setPopTick]  = useState(0)   // pop del canvas al elegir pieza/color
  const [diceTick, setDiceTick] = useState(0)   // giro del dado al randomizar
  const [burstId,  setBurstId]  = useState(0)   // confetti al desbloquear keyword

  // Ruta guiada — null = modo libre; se activa solo si nunca se completó
  const [wizardStep, setWizardStep] = useState<number | null>(null)

  // Ajuste de escala/posición por usuario — solo para cabello frontal con
  // allowTransform=true (algunas formas de cabeza necesitan un pequeño
  // ajuste). Es un override de sesión, no se guarda en el servidor.
  const [hairTransform, setHairTransform] = useState<Record<string, AssetTransform>>({})

  const canvasAssets = useMemo(
    () => assets.map(a => hairTransform[a.id] ? { ...a, transform: hairTransform[a.id] } : a),
    [assets, hairTransform]
  )

  useEffect(() => {
    if (!localStorage.getItem(WIZARD_DONE_KEY)) setWizardStep(0)
  }, [])

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

  // Tab activo: capas visibles en admin, con al menos un asset (excluyendo hair-front)
  const visibleLayers = layers.filter(l =>
    l.visibleInBuilder &&
    !ALWAYS_HIDDEN.has(l.layerKey) &&
    assets.some(a => a.layerKey === l.layerKey)
  )
  const [activeCat, setActiveCat] = useState<string>(visibleLayers[0]?.layerKey ?? '')

  // Pasos del wizard aplicables a esta colección (capa visible + con assets)
  const wizardSteps = WIZARD_FLOW.filter(step =>
    step.keys.some(k =>
      visibleLayers.some(l => l.layerKey === k) &&
      assets.some(a => a.layerKey === k)
    )
  )

  function finishWizard() {
    localStorage.setItem(WIZARD_DONE_KEY, '1')
    setWizardStep(null)
  }

  function nextWizardStep() {
    if (wizardStep === null) return
    if (wizardStep >= wizardSteps.length - 1) { setBurstId(b => b + 1); finishWizard() }
    else setWizardStep(wizardStep + 1)
  }

  const hiddenLayers = getHiddenLayers(state, exceptions)

  const t = makeT(locale)

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
      // body nunca se omite: sin él la cabeza queda flotando sin cuello ni brazos
      if (layer.optional && layer.layerKey !== 'body' && Math.random() < 0.4) { sel[layer.layerKey] = null; continue }
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
    if (!stageRef.current) return
    // exportPNG espera renders en vuelo y fusiona los grupos en un PNG estático
    setExportUrl(await stageRef.current.exportPNG())
    const encoded = encodeState(state)
    setShareUrl(`${window.location.origin}/${locale}/builder?s=${encoded}`)
  }

  function unlockKeyword(keywordId: string) {
    setState(s => ({
      ...s,
      unlockedKeywords: s.unlockedKeywords.includes(keywordId) ? s.unlockedKeywords : [...s.unlockedKeywords, keywordId],
    }))
    setBurstId(b => b + 1)
  }

  function startOver() {
    if (!confirm(t('startOverConfirm'))) return
    setState(buildInitialState(collection, layers, assets, defaults))
    localStorage.removeItem(WIZARD_DONE_KEY)
    setWizardStep(0)
  }


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

  // ── Pantalla de bienvenida ─────────────────────────────
  if (showWelcome) {
    return (
      <WelcomeScreen
        locale={locale}
        collection={collection}
        layers={layers}
        assets={assets}
        settings={settings ?? null}
        onEnter={unlock => {
          if (unlock) unlockKeyword(unlock.keywordId)
          setShowWelcome(false)
        }}
      />
    )
  }

  // ── Render ────────────────────────────────────────────
  return (
    <div className="h-screen flex flex-col overflow-hidden select-none relative bg-castells" style={{ color: 'white' }}>
      <div className="absolute inset-0 pointer-events-none opacity-25 bg-castells-texture" />

      {/* HEADER */}
      <header className="relative shrink-0 flex items-center justify-between px-4 lg:px-5 h-14 lg:h-12 border-b backdrop-blur-md" style={{ borderColor: 'rgba(255,255,255,0.06)', background: 'rgba(10,10,20,0.6)' }}>
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-7 h-7 lg:w-6 lg:h-6 rounded-lg flex items-center justify-center text-sm shrink-0" style={{ background: 'linear-gradient(135deg,#7c3aed,#a855f7)' }}>✦</div>
          <div className="min-w-0">
            <p className="text-sm font-semibold leading-none truncate">Castells S6</p>
            <p className="text-[8px] leading-none mt-0.5 truncate hidden lg:block" style={{ color: 'rgba(255,255,255,0.3)' }}>Pursuit of Consciencia</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={startOver}
            title={t('startOver')}
            className="text-xs px-2.5 py-1 rounded-lg fx-tap flex items-center gap-1"
            style={{ background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.5)' }}
          >
            ↺
          </button>
          <LocaleSwitcher locale={locale} onChange={setLocale} />
          <button
            onClick={handleExport}
            className="text-xs font-semibold px-4 py-1.5 rounded-xl fx-tap"
            style={{ background: 'linear-gradient(135deg,#7c3aed,#a855f7)', color: 'white' }}
          >
            ✨ {t('createPfp')}
          </button>
        </div>
      </header>

      {/* BODY — vertical on mobile, horizontal on desktop */}
      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">

        {/* CANVAS — protagonista: 42vh en móvil, flex-1 en desktop */}
        <div className="h-[42vh] shrink-0 lg:h-auto lg:flex-1 flex items-center justify-center p-3 lg:p-10 relative">
            <div className="relative h-full aspect-square max-h-full max-w-full">
              <div className="absolute inset-0 rounded-full blur-3xl fx-breathe" style={{ background: 'radial-gradient(circle, #7c3aed, transparent 70%)' }} />
              {/* Pop re-disparable: alternar entre dos clases con keyframes idénticos
                  reinicia la animación sin re-montar el canvas (que perdería su caché) */}
              <div
                className={`relative w-full h-full rounded-[28px] lg:rounded-[36px] overflow-hidden ${popTick % 2 ? 'fx-pop-a' : 'fx-pop-b'}`}
                style={{ boxShadow: '0 24px 60px rgba(0,0,0,0.8), inset 0 1px 0 rgba(255,255,255,0.06)' }}
              >
                {/* Fondo/marco/arco estáticos; el personaje levita dentro del stage */}
                <AvatarStage
                  ref={stageRef}
                  state={state}
                  layers={layers.filter(l => !hiddenLayers.has(l.layerKey))}
                  assets={canvasAssets}
                />
              </div>
              {burstId > 0 && <ConfettiBurst key={burstId} />}
              <button
                onClick={randomize}
                className="absolute bottom-2 left-2 text-[10px] font-medium px-2.5 py-1 rounded-xl backdrop-blur-md fx-tap lg:text-xs lg:px-3 lg:py-1.5 lg:bottom-3 lg:left-3"
                style={{ background: 'rgba(0,0,0,0.55)', color: 'rgba(255,255,255,0.7)', border: '1px solid rgba(255,255,255,0.1)' }}
              >
                <span key={diceTick} className={diceTick > 0 ? 'fx-dice' : undefined}>🎲</span> {t('random')}
              </button>
            </div>
        </div>

        {/* CONTROL PANEL — bottom drawer on mobile, right sidebar on desktop */}
        <aside
          className="relative flex-1 flex flex-col border-t lg:border-t-0 lg:border-l lg:w-[320px] lg:shrink-0 lg:flex-none overflow-hidden rounded-t-[28px] lg:rounded-t-none -mt-4 lg:mt-0"
          style={{ borderColor: 'rgba(255,255,255,0.05)', background: 'rgba(11,11,22,0.92)', boxShadow: '0 -12px 32px rgba(0,0,0,0.35)' }}
        >
          {/* Drag handle — solo visual, comunica "bottom sheet" en móvil */}
          <div className="shrink-0 flex justify-center pt-2 pb-0.5 lg:hidden">
            <div className="w-9 h-1 rounded-full" style={{ background: 'rgba(255,255,255,0.12)' }} />
          </div>

          {wizardStep !== null && wizardSteps[wizardStep] ? (<>
            {/* ── RUTA GUIADA (primera visita) ── */}
            <div className="shrink-0 px-4 pt-3 pb-3 border-b" style={{ borderColor: 'rgba(255,255,255,0.05)' }}>
              <div className="flex items-center justify-between mb-2">
                <p className="text-[10px] font-semibold" style={{ color: '#a78bfa' }}>
                  {t('step')} {wizardStep + 1} {t('of')} {wizardSteps.length}
                </p>
                <button onClick={finishWizard} className="text-[10px] fx-tap" style={{ color: 'rgba(255,255,255,0.3)' }}>
                  {t('skipGuide')} →
                </button>
              </div>
              <div className="flex gap-1">
                {wizardSteps.map((_, i) => (
                  <div key={i} className="flex-1 h-1 rounded-full transition-all duration-300" style={{ background: i <= wizardStep ? '#7c3aed' : 'rgba(255,255,255,0.08)' }} />
                ))}
              </div>
              <p className="text-sm font-semibold text-white mt-3">
                {wizardSteps[wizardStep].emoji} {pickLang(wizardSteps[wizardStep], locale)}
              </p>
            </div>

            {/* Contenido del paso */}
            <div key={`wiz-${wizardStep}`} className="flex-1 overflow-y-auto p-3 lg:p-4 space-y-5 fx-slide-up">
              {wizardSteps[wizardStep].keys
                .filter(k => visibleLayers.some(l => l.layerKey === k) && assets.some(a => a.layerKey === k))
                .map(k => {
                  const stepLayer = layers.find(l => l.layerKey === k)
                  return (
                    <div key={k}>
                      {wizardSteps[wizardStep].keys.length > 1 && stepLayer && (
                        <p className="text-[9px] font-semibold uppercase tracking-widest mb-3" style={{ color: 'rgba(255,255,255,0.25)' }}>
                          {pickLang(LAYER_META[stepLayer.layerKey] ?? { es: stepLayer.labelEs, en: stepLayer.labelEn, nl: stepLayer.labelEn, fr: stepLayer.labelEn }, locale)}
                        </p>
                      )}
                      <LayerPanel
                        categoryKey={k}
                        layers={layers}
                        assets={assets}
                        state={state}
                        onSelectAsset={selectAsset}
                        onSelectHair={selectHair}
                        onSkinChange={hex => setToken('skin-color', hex)}
                        onHairColorChange={hex => setToken('hair-color', hex)}
                        onExtraColorChange={(key, hex) => setToken(key, hex)}
                        hairTransform={hairTransform}
                        onHairTransform={(id, tr) => setHairTransform(p => ({ ...p, [id]: tr }))}
                        colorUnlocks={colorUnlocks}
                        masterKeywordIds={masterKeywordIds}
                        locale={locale}
                      />
                    </div>
                  )
                })}
            </div>

            {/* Navegación del wizard */}
            <div className="shrink-0 px-3 pb-3 pt-2 flex gap-2 lg:px-4 lg:pb-4">
              {wizardStep > 0 && (
                <button
                  onClick={() => setWizardStep(wizardStep - 1)}
                  className="px-4 py-2.5 lg:py-3 rounded-2xl text-sm font-medium fx-tap"
                  style={{ background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.6)' }}
                >
                  ←
                </button>
              )}
              <button
                onClick={nextWizardStep}
                className="flex-1 text-sm font-semibold py-2.5 lg:py-3 rounded-2xl fx-shimmer fx-tap"
                style={{
                  background: 'linear-gradient(90deg,#6d28d9,#9333ea,#c084fc,#9333ea,#6d28d9)',
                  color: 'white',
                  boxShadow: '0 4px 20px rgba(124,58,237,0.35)',
                }}
              >
                {wizardStep === wizardSteps.length - 1
                  ? `✨ ${t('doneCustomize')}`
                  : `${t('next')} →`}
              </button>
            </div>
          </>) : (<>

          {/* Tab bar — horizontally scrollable */}
          <div className="shrink-0 border-b overflow-x-auto" style={{ borderColor: 'rgba(255,255,255,0.05)' }}>
            <div className="flex gap-1 px-3 py-2 min-w-max">
              {visibleLayers.map(layer => {
                if (hiddenLayers.has(layer.layerKey)) return null
                const m        = LAYER_META[layer.layerKey]
                const isActive = activeCat === layer.layerKey
                const hasSelection = !!state.selectedAssets[layer.layerKey]
                return (
                  <button
                    key={layer.layerKey}
                    onClick={() => setActiveCat(layer.layerKey)}
                    className="relative flex flex-col items-center gap-0.5 px-3 py-2 rounded-2xl transition-all shrink-0 fx-tap lg:px-2.5 lg:py-2"
                    style={{
                      background: isActive ? 'linear-gradient(135deg, rgba(124,58,237,0.35), rgba(168,85,247,0.18))' : 'transparent',
                      boxShadow: isActive ? '0 2px 12px rgba(124,58,237,0.25), inset 0 1px 0 rgba(255,255,255,0.08)' : 'none',
                      outline: isActive ? '1px solid rgba(167,139,250,0.35)' : '1px solid transparent',
                    }}
                  >
                    {hasSelection && (
                      <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full" style={{ background: isActive ? '#c4b5fd' : 'rgba(167,139,250,0.5)' }} />
                    )}
                    <span className="text-base leading-none lg:text-base">{m?.emoji ?? '📁'}</span>
                    <span className="text-[8px] font-medium whitespace-nowrap lg:text-[9px]" style={{ color: isActive ? '#e9d5ff' : 'rgba(255,255,255,0.4)' }}>
                      {m ? pickLang(m, locale) : layer.labelEs}
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
              hairTransform={hairTransform}
              onHairTransform={(id, tr) => setHairTransform(p => ({ ...p, [id]: tr }))}
              colorUnlocks={colorUnlocks}
              masterKeywordIds={masterKeywordIds}
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
              ✨ {t('createMyPfp')}
            </button>
            <button
              onClick={startOver}
              className="w-full text-xs font-medium py-2 mt-1 rounded-xl fx-tap flex items-center justify-center gap-1.5"
              style={{ color: 'rgba(255,255,255,0.3)' }}
            >
              ↺ {t('startOver')}
            </button>
          </div>
          </>)}
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
  hairTransform:       Record<string, AssetTransform>
  onHairTransform:     (assetId: string, transform: AssetTransform) => void
  colorUnlocks:        ColorUnlock[]
  masterKeywordIds:    string[]
  locale:              string
}

function LayerPanel({ categoryKey, layers, assets, state, onSelectAsset, onSelectHair, onSkinChange, onHairColorChange, onExtraColorChange, hairTransform, onHairTransform, colorUnlocks, masterKeywordIds, locale }: LayerPanelProps) {
  const t = makeT(locale)
  const layer = layers.find(l => l.layerKey === categoryKey)

  // Assets visibles (públicos + keyword desbloqueadas)
  const layerAssets = assets.filter(a => a.layerKey === categoryKey && isAssetUnlocked(a, state, masterKeywordIds))

  const selectedId = state.selectedAssets[categoryKey] ?? null

  // ── CABEZA: tonos de piel primero, luego la forma ─────
  if (categoryKey === 'head') {
    return (
      <div className="space-y-5">
        <div>
          <Divider label={t('skinTone')} />
          <div className="flex flex-wrap gap-2.5 mt-3">
            {SKIN_TONES.map(tone => {
              const active = state.tokens['skin-color'] === tone.hex
              return (
                <button
                  key={tone.hex}
                  onClick={() => onSkinChange(tone.hex)}
                  title={tone.emoji}
                  className="w-9 h-9 rounded-full transition-all relative fx-tap shrink-0"
                  style={{
                    background: tone.hex,
                    outline: active ? '2.5px solid #a78bfa' : tone.fantasy ? '1px dashed rgba(255,255,255,0.2)' : '1px solid rgba(255,255,255,0.1)',
                    outlineOffset: active ? 2 : 0,
                    transform: active ? 'scale(1.15)' : undefined,
                    boxShadow: active ? `0 0 14px ${tone.hex}80` : undefined,
                  }}
                >
                  {tone.fantasy && (
                    <span className="absolute -top-1 -right-1 text-[8px] leading-none">✦</span>
                  )}
                </button>
              )
            })}
          </div>
          <p className="text-[9px] mt-2" style={{ color: 'rgba(255,255,255,0.2)' }}>
            {t('fantasyHint')}
          </p>
        </div>

        <AssetGrid
          assets={layerAssets}
          selectedId={selectedId}
          optional={layer?.optional ?? false}
          onSelect={id => onSelectAsset('head', id)}
          locale={locale}
        />
      </div>
    )
  }

  // ── CABELLO: frente + color + trasero en un solo panel ──
  if (categoryKey === 'hair-back') {
    const hairFrontAssets = assets.filter(a => a.layerKey === 'hair-front' && isAssetUnlocked(a, state, masterKeywordIds))
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
            {t('front')}
          </p>
          <AssetGrid
            assets={hairFrontAssets}
            selectedId={hairFrontId}
            optional={true}
            onSelect={handleHairFront}
            locale={locale}
          />
          {hairFrontId && hairFrontAssets.find(a => a.id === hairFrontId)?.allowTransform && (
            <HairFitControls
              asset={hairFrontAssets.find(a => a.id === hairFrontId)!}
              value={hairTransform[hairFrontId] ?? hairFrontAssets.find(a => a.id === hairFrontId)!.transform}
              onChange={tr => onHairTransform(hairFrontId, tr)}
              locale={locale}
            />
          )}
        </div>

        {/* COLOR */}
        <div>
          <Divider label={t('color')} />
          <div className="flex flex-wrap gap-2 mt-3">
            {HAIR_COLORS.map(hex => {
              const active = state.tokens['hair-color'] === hex
              return (
                <button
                  key={hex}
                  onClick={() => onHairColorChange(hex)}
                  className="w-8 h-8 rounded-full transition-all fx-tap shrink-0"
                  style={{
                    background: hex,
                    outline: active ? '2.5px solid #a78bfa' : '1px solid rgba(255,255,255,0.1)',
                    outlineOffset: active ? 2 : 0,
                    transform: active ? 'scale(1.15)' : undefined,
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
              title={t('customColor')}
            />
            <p className="text-[10px]" style={{ color: 'rgba(255,255,255,0.3)' }}>
              {t('customColor')}
            </p>
          </div>
        </div>

        {/* TRASERO */}
        <div>
          <Divider label={t('back')} />
          <div className="mt-3">
            <AssetGrid
              assets={layerAssets}
              selectedId={selectedId}
              optional={layer?.optional ?? false}
              onSelect={handleHairBack}
              locale={locale}
            />
          </div>
        </div>

      </div>
    )
  }

  // ── CAPAS CON COLOR DESBLOQUEABLE (color_unlocks) ─────
  const activeUnlocks = getActiveColorUnlocks(colorUnlocks, state, masterKeywordIds, assets, categoryKey)
  if (activeUnlocks.length > 0) {
    return (
      <div className="space-y-5">
        <AssetGrid
          assets={layerAssets}
          selectedId={selectedId}
          optional={layer?.optional ?? false}
          onSelect={id => onSelectAsset(categoryKey, id)}
          locale={locale}
        />
        {activeUnlocks.map(unlock => {
          const tokenKey = `unlock:${unlock.targetLayerKey}:${unlock.targetRole}`
          return (
            <div key={unlock.id}>
              <Divider label={t('color')} />
              {unlock.mode === 'swatches' ? (
                <div className="flex flex-wrap gap-2 mt-3">
                  {(unlock.swatches ?? []).map(hex => {
                    const active = state.tokens[tokenKey] === hex
                    return (
                      <button
                        key={hex}
                        onClick={() => onExtraColorChange(tokenKey, hex)}
                        className="w-8 h-8 rounded-full transition-all fx-tap shrink-0"
                        style={{
                          background: hex,
                          outline: active ? '2.5px solid #a78bfa' : '1px solid rgba(255,255,255,0.1)',
                          outlineOffset: active ? 2 : 0,
                          transform: active ? 'scale(1.15)' : undefined,
                        }}
                      />
                    )
                  })}
                </div>
              ) : (
                <div className="flex items-center gap-3 mt-3">
                  <input
                    type="color"
                    value={state.tokens[tokenKey] ?? '#ffffff'}
                    onChange={e => onExtraColorChange(tokenKey, e.target.value)}
                    className="w-9 h-9 rounded-xl cursor-pointer border-0 bg-transparent"
                  />
                  <p className="text-[10px]" style={{ color: 'rgba(255,255,255,0.3)' }}>
                    {t('customizeColor')}
                  </p>
                </div>
              )}
            </div>
          )
        })}
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
      locale={locale}
    />
  )
}

// ══════════════════════════════════════════════════════════
// AssetGrid
// ══════════════════════════════════════════════════════════
function AssetGrid({ assets, selectedId, optional, onSelect, locale }: {
  assets:     Asset[]
  selectedId: string | null
  optional:   boolean
  onSelect:   (id: string | null) => void
  locale?:    string
}) {
  if (assets.length === 0) {
    return (
      <p className="text-sm py-6 text-center" style={{ color: 'rgba(255,255,255,0.2)' }}>{makeT(locale ?? 'es')('noOptions')}</p>
    )
  }

  return (
    <div className="grid grid-cols-4 gap-2 lg:grid-cols-3 lg:gap-2.5">
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
              border: `2px solid ${isActive ? '#a78bfa' : 'rgba(255,255,255,0.08)'}`,
              background: 'linear-gradient(160deg, rgba(255,255,255,0.05), rgba(255,255,255,0.015))',
              transform: isActive ? 'scale(1.06)' : undefined,
              boxShadow: isActive
                ? '0 0 24px rgba(124,58,237,0.55), inset 0 1px 0 rgba(255,255,255,0.15)'
                : 'inset 0 1px 0 rgba(255,255,255,0.05)',
              animationDelay: `${Math.min(i * 30, 360)}ms`,
            }}
          >
            {asset.cdnUrl && (
              <Image src={pickThumb(asset)} alt={asset.name} fill className="object-cover" unoptimized />
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
  onUnlock:     (id: string) => void
  locale:       string
}

function KeywordSection({ collectionId, state, onUnlock, locale }: KeywordSectionProps) {
  const [open, setOpen]     = useState(false)
  const [value, setValue]   = useState('')
  const [status, setStatus] = useState<'idle' | 'loading' | 'ok' | 'err'>('idle')
  const [label, setLabel]   = useState('')
  const t = makeT(locale)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!value.trim()) return
    setStatus('loading')
    const res  = await fetch(`/api/keywords?keyword=${encodeURIComponent(value.trim().toUpperCase())}&collectionId=${collectionId}`)
    const data = await res.json()
    if (data.valid) {
      setLabel(data.keyword.label)
      onUnlock(data.keyword.id)
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
          <span className="text-[9px] px-2 py-1 rounded-full" style={{ background: 'rgba(16,185,129,0.2)', color: '#6ee7b7' }}>
            🔓 {state.unlockedKeywords.length} {t('keysUnlocked')}
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
            placeholder={t('secretCode')}
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
            {status === 'loading' ? '…' : status === 'ok' ? '✓' : status === 'err' ? '✗' : t('unlock')}
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
          🔑 {t('haveSecretCode')}
        </button>
      )}
    </div>
  )
}

// ══════════════════════════════════════════════════════════
// LocaleSwitcher — selector de idioma (es/en/nl/fr)
// ══════════════════════════════════════════════════════════
function LocaleSwitcher({ locale, onChange }: { locale: string; onChange: (l: string) => void }) {
  const [open, setOpen] = useState(false)
  const [pos, setPos]   = useState({ top: 0, right: 0 })
  const btnRef = useRef<HTMLButtonElement>(null)
  const current = LOCALE_META[locale as Locale] ?? LOCALE_META.es

  function toggle() {
    if (!open && btnRef.current) {
      const r = btnRef.current.getBoundingClientRect()
      setPos({ top: r.bottom + 4, right: window.innerWidth - r.right })
    }
    setOpen(v => !v)
  }

  return (
    <div className="relative">
      <button
        ref={btnRef}
        onClick={toggle}
        className="text-xs px-2 py-1 rounded-lg fx-tap flex items-center gap-1"
        style={{ background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.6)' }}
      >
        {current.flag}
      </button>
      {/* Portal directo a <body> — evita quedar atrapado detrás del canvas del
          avatar o cualquier otro ancestro con su propio stacking context. */}
      {open && typeof document !== 'undefined' && createPortal(
        <>
          <div className="fixed inset-0 z-[999]" onClick={() => setOpen(false)} />
          <div
            className="fixed rounded-xl overflow-hidden z-[1000] fx-fade-in"
            style={{ top: pos.top, right: pos.right, background: '#161624', border: '1px solid rgba(255,255,255,0.08)', minWidth: 130 }}
          >
            {(Object.keys(LOCALE_META) as Locale[]).map(l => (
              <button
                key={l}
                onClick={() => { onChange(l); setOpen(false) }}
                className="w-full text-left text-xs px-3 py-2 flex items-center gap-2 fx-tap"
                style={{
                  background: l === locale ? 'rgba(124,58,237,0.2)' : 'transparent',
                  color: l === locale ? '#c4b5fd' : 'rgba(255,255,255,0.6)',
                }}
              >
                <span>{LOCALE_META[l].flag}</span> {LOCALE_META[l].label}
              </button>
            ))}
          </div>
        </>,
        document.body
      )}
    </div>
  )
}

// ══════════════════════════════════════════════════════════
// HairFitControls — escala/posición para cabello frontal
// que el admin marcó como allowTransform (algunas cabezas lo necesitan)
// ══════════════════════════════════════════════════════════
function HairFitControls({ asset, value, onChange, locale }: {
  asset:    Asset
  value:    AssetTransform
  onChange: (t: AssetTransform) => void
  locale:   string
}) {
  const t = makeT(locale)
  const isDefault = value.scale === 1 && value.offsetX === 0 && value.offsetY === 0

  function set(key: keyof AssetTransform, v: number) {
    onChange({ ...value, [key]: v })
  }

  return (
    <div className="mt-3 p-3 rounded-2xl space-y-2.5 fx-fade-in" style={{ background: 'rgba(124,58,237,0.08)', border: '1px solid rgba(124,58,237,0.2)' }}>
      <div className="flex items-center justify-between">
        <p className="text-[9px] font-semibold uppercase tracking-widest" style={{ color: '#a78bfa' }}>
          ✦ {t('adjustFit')}
        </p>
        {!isDefault && (
          <button onClick={() => onChange({ scale: 1, offsetX: 0, offsetY: 0 })} className="text-[9px]" style={{ color: 'rgba(255,255,255,0.35)' }}>
            ↩ {t('resetAdjustment')}
          </button>
        )}
      </div>
      <FitSlider label={`${t('scale')}  ${value.scale.toFixed(2)}×`} min={0.5} max={1.8} step={0.01} value={value.scale} onChange={v => set('scale', v)} />
      <FitSlider label={`${t('positionX')}  ${value.offsetX > 0 ? '+' : ''}${value.offsetX}px`} min={-200} max={200} step={4} value={value.offsetX} onChange={v => set('offsetX', v)} />
      <FitSlider label={`${t('positionY')}  ${value.offsetY > 0 ? '+' : ''}${value.offsetY}px`} min={-200} max={200} step={4} value={value.offsetY} onChange={v => set('offsetY', v)} />
    </div>
  )
}

function FitSlider({ label, min, max, step, value, onChange }: {
  label: string; min: number; max: number; step: number; value: number; onChange: (v: number) => void
}) {
  const pct = ((value - min) / (max - min)) * 100
  return (
    <div>
      <p className="text-[9px] mb-1" style={{ color: 'rgba(255,255,255,0.45)' }}>{label}</p>
      <input
        type="range"
        min={min} max={max} step={step}
        value={value}
        onChange={e => onChange(parseFloat(e.target.value))}
        className="w-full h-1 rounded-full appearance-none cursor-pointer"
        style={{ accentColor: '#a78bfa', background: `linear-gradient(to right, #a78bfa ${pct}%, rgba(255,255,255,0.1) 0%)` }}
      />
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
