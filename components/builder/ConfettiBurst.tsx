'use client'

import { useState } from 'react'

const COLORS = ['#a78bfa', '#f472b6', '#facc15', '#34d399', '#60a5fa', '#fb923c']

interface Piece {
  dx: string; dy: string; rot: string; c: string; delay: string
}

/** Ráfaga de confetti CSS. Re-móntalo con una `key` distinta para re-disparar. */
export default function ConfettiBurst({ count = 22 }: { count?: number }) {
  // Posiciones calculadas una sola vez por montaje — re-renders del padre
  // no deben cambiar trayectorias a mitad de vuelo
  const [pieces] = useState<Piece[]>(() =>
    Array.from({ length: count }, (_, i) => {
      const angle = (Math.PI * 2 * i) / count + Math.random() * 0.5
      const dist  = 60 + Math.random() * 90
      return {
        dx:    `${Math.round(Math.cos(angle) * dist)}px`,
        dy:    `${Math.round(Math.sin(angle) * dist - 40)}px`,
        rot:   `${Math.round(Math.random() * 540 - 270)}deg`,
        c:     COLORS[i % COLORS.length],
        delay: `${(Math.random() * 0.12).toFixed(2)}s`,
      }
    })
  )

  return (
    <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-30" aria-hidden>
      {pieces.map((p, i) => (
        <span
          key={i}
          className="fx-confetti-piece"
          style={{ '--dx': p.dx, '--dy': p.dy, '--rot': p.rot, '--c': p.c, animationDelay: p.delay } as React.CSSProperties}
        />
      ))}
    </div>
  )
}
