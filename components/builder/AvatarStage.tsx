'use client'

import { forwardRef, useImperativeHandle, useMemo, useRef, useCallback } from 'react'
import AvatarCanvas from '@/components/builder/AvatarCanvas'
import type { AvatarCompositor } from '@/lib/engine/compositor'
import type { AvatarState, Layer, Asset } from '@/types'

// Capas de escenario — NO levitan. Todo lo demás es el personaje y flota junto.
const STATIC_KEYS = new Set(['background', 'frame', 'arch', 'flower', 'window', 'effect-final'])

// blendMode de canvas → valor válido de CSS mix-blend-mode
function cssBlend(mode: string): React.CSSProperties['mixBlendMode'] {
  return (mode === 'source-over' ? 'normal' : mode) as React.CSSProperties['mixBlendMode']
}

export interface AvatarStageHandle {
  /** Fusiona los tres grupos en un solo PNG estático (espera renders en vuelo) */
  exportPNG: () => Promise<string>
}

interface Props {
  state:  AvatarState
  layers: Layer[]
  assets: Asset[]
  size?:  number
}

/**
 * Escenario por grupos: el personaje levita (fx-float) sobre un fondo
 * estático; los overlays superiores (effect-final) quedan quietos encima
 * usando CSS mix-blend-mode para que la mezcla cruce los canvas.
 * El PNG exportado se fusiona plano — sin animación.
 */
const AvatarStage = forwardRef<AvatarStageHandle, Props>(function AvatarStage(
  { state, layers, assets, size = 2048 }, ref
) {
  const compsRef = useRef<Map<string, AvatarCompositor>>(new Map())

  // Orden de render del compositor: orderIndex, con effect-final forzado al final
  const groups = useMemo(() => {
    const base   = [...layers].sort((a, b) => a.orderIndex - b.orderIndex).filter(l => l.layerKey !== 'effect-final')
    const effect = layers.filter(l => l.layerKey === 'effect-final')
    const sorted = [...base, ...effect]

    const charIdx = sorted.map((l, i) => (!STATIC_KEYS.has(l.layerKey) ? i : -1)).filter(i => i >= 0)
    const firstChar = charIdx[0] ?? sorted.length
    const lastChar  = charIdx[charIdx.length - 1] ?? -1

    return {
      // estáticos por debajo del personaje (fondo, marco, arco…)
      under: sorted.filter((l, i) => STATIC_KEYS.has(l.layerKey) && i < firstChar),
      // el personaje completo — levita en bloque
      chars: sorted.filter(l => !STATIC_KEYS.has(l.layerKey)),
      // estáticos por encima (effect-final) — cada uno en su canvas para
      // que su blend mode se aplique sobre TODO lo de abajo vía CSS
      overs: sorted.filter((l, i) => STATIC_KEYS.has(l.layerKey) && i > lastChar),
    }
  }, [layers])

  // Callbacks estables por key: si cambiaran en cada render, AvatarCanvas
  // re-inicializaría el compositor (y perdería su caché) en cada re-render
  const readyCbCache = useRef(new Map<string, (c: AvatarCompositor) => void>())
  const onReady = useCallback((key: string) => {
    let cb = readyCbCache.current.get(key)
    if (!cb) {
      cb = (c: AvatarCompositor) => { compsRef.current.set(key, c) }
      readyCbCache.current.set(key, cb)
    }
    return cb
  }, [])

  useImperativeHandle(ref, () => ({
    async exportPNG() {
      const comps = [...compsRef.current.values()]
      await Promise.all(comps.map(c => c.whenIdle()))

      const out = document.createElement('canvas')
      out.width = out.height = size
      const ctx = out.getContext('2d')!

      const under = compsRef.current.get('under')
      const chars = compsRef.current.get('chars')
      if (under) ctx.drawImage(under.getCanvas(), 0, 0)
      if (chars) ctx.drawImage(chars.getCanvas(), 0, 0)

      for (const layer of groups.overs) {
        const comp = compsRef.current.get(`over-${layer.id}`)
        if (!comp) continue
        ctx.globalCompositeOperation = layer.blendMode as GlobalCompositeOperation
        ctx.globalAlpha = layer.opacity ?? 1
        ctx.drawImage(comp.getCanvas(), 0, 0)
        ctx.globalAlpha = 1
        ctx.globalCompositeOperation = 'source-over'
      }

      return out.toDataURL('image/png')
    },
  }), [groups.overs, size])

  return (
    <div className="relative w-full h-full">
      {/* Escenario estático */}
      <div className="absolute inset-0">
        <AvatarCanvas state={state} layers={groups.under} assets={assets} size={size} onCompositorReady={onReady('under')} />
      </div>

      {/* Personaje — levita en bloque */}
      <div className="absolute inset-0 fx-float">
        <AvatarCanvas state={state} layers={groups.chars} assets={assets} size={size} onCompositorReady={onReady('chars')} />

        {/* Parpadeo — dos óvalos (uno por ojo, no una franja) del tono de piel
            actual, calibrados sobre el grupo "Expression" real del SVG de
            cabeza (medido por posición de píxel en las 6 formas de cabeza:
            ambos ojos caen siempre en la misma banda). Aparecen y desaparecen
            con fx-blink. Solo viven en la vista previa — no forman parte de
            ningún canvas, así que nunca aparecen en el PNG exportado. */}
        <div
          className="absolute fx-blink pointer-events-none"
          style={{
            top: '40%', left: '38.8%', width: '8%', height: '11%',
            borderRadius: '50%',
            background: state.tokens['skin-color'] ?? '#C68642',
            transformOrigin: 'center',
          }}
        />
        <div
          className="absolute fx-blink pointer-events-none"
          style={{
            top: '40%', left: '53.2%', width: '8%', height: '11%',
            borderRadius: '50%',
            background: state.tokens['skin-color'] ?? '#C68642',
            transformOrigin: 'center',
          }}
        />
      </div>

      {/* Overlays superiores — quietos, blend vía CSS sobre todo lo de abajo.
          Internamente se renderizan en normal/alpha 1; el blend real lo pone
          el CSS aquí y el merge manual en exportPNG. */}
      {groups.overs.map(layer => (
        <div
          key={layer.id}
          className="absolute inset-0"
          style={{ mixBlendMode: cssBlend(layer.blendMode), opacity: layer.opacity ?? 1 }}
        >
          <AvatarCanvas
            state={state}
            layers={[{ ...layer, blendMode: 'source-over', opacity: 1 }]}
            assets={assets}
            size={size}
            onCompositorReady={onReady(`over-${layer.id}`)}
          />
        </div>
      ))}
    </div>
  )
})

export default AvatarStage
