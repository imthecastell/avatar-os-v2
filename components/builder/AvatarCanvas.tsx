'use client'

import { useEffect, useRef, useCallback } from 'react'
import { AvatarCompositor } from '@/lib/engine/compositor'
import type { AvatarState, Layer, Asset } from '@/types'

interface Props {
  state: AvatarState
  layers: Layer[]
  assets: Asset[]
  onCompositorReady?: (compositor: AvatarCompositor) => void
  /** Resolución interna del canvas. 2048 para export final; menor para previews (menos memoria en iPad). */
  size?: number
}

export default function AvatarCanvas({ state, layers, assets, onCompositorReady, size = 2048 }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const compositorRef = useRef<AvatarCompositor | null>(null)

  useEffect(() => {
    if (!canvasRef.current) return
    const compositor = new AvatarCompositor()
    compositor.init(canvasRef.current, size)
    compositorRef.current = compositor
    onCompositorReady?.(compositor)

    return () => compositor.clearCache()
  }, [onCompositorReady, size])

  useEffect(() => {
    if (!compositorRef.current) return
    compositorRef.current.render(state, layers, assets).catch(err =>
      console.warn('[AvatarCanvas] render error', err)
    )
  }, [state, layers, assets])

  return (
    <canvas
      ref={canvasRef}
      className="w-full h-full object-contain rounded-xl"
      style={{ imageRendering: 'auto' }}
    />
  )
}
