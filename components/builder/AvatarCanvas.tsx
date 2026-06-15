'use client'

import { useEffect, useRef, useCallback } from 'react'
import { AvatarCompositor } from '@/lib/engine/compositor'
import type { AvatarState, Layer, Asset } from '@/types'

interface Props {
  state: AvatarState
  layers: Layer[]
  assets: Asset[]
  onCompositorReady?: (compositor: AvatarCompositor) => void
}

export default function AvatarCanvas({ state, layers, assets, onCompositorReady }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const compositorRef = useRef<AvatarCompositor | null>(null)

  useEffect(() => {
    if (!canvasRef.current) return
    const compositor = new AvatarCompositor()
    compositor.init(canvasRef.current)
    compositorRef.current = compositor
    onCompositorReady?.(compositor)

    return () => compositor.clearCache()
  }, [onCompositorReady])

  useEffect(() => {
    if (!compositorRef.current) return
    compositorRef.current.render(state, layers, assets)
  }, [state, layers, assets])

  return (
    <canvas
      ref={canvasRef}
      className="w-full h-full object-contain rounded-xl"
      style={{ imageRendering: 'auto' }}
    />
  )
}
