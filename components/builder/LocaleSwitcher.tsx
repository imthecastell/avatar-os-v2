'use client'

import { useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { LOCALE_META, type Locale } from '@/lib/i18n/dict'

export default function LocaleSwitcher({ locale, onChange }: { locale: string; onChange: (l: string) => void }) {
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
