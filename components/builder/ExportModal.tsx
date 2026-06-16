'use client'

import { useRef, useState } from 'react'

interface Props {
  dataUrl:   string
  shareUrl?: string
  onClose:   () => void
}

export default function ExportModal({ dataUrl, shareUrl, onClose }: Props) {
  const linkRef              = useRef<HTMLAnchorElement>(null)
  const [copied, setCopied] = useState(false)

  function handleDownload() {
    const link      = linkRef.current!
    link.href       = dataUrl
    link.download   = `avatar-${Date.now()}.png`
    link.click()
  }

  async function handleShare() {
    if (!navigator.share) { handleDownload(); return }
    const blob = await (await fetch(dataUrl)).blob()
    const file = new File([blob], 'avatar.png', { type: 'image/png' })
    await navigator.share({ title: 'Mi Avatar', files: [file] })
  }

  async function handleCopyLink() {
    if (!shareUrl) return
    await navigator.clipboard.writeText(shareUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(12px)' }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div
        className="w-full max-w-xs rounded-3xl overflow-hidden flex flex-col"
        style={{ background: '#111120', border: '1px solid rgba(255,255,255,0.08)' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-5 pb-3">
          <div>
            <p className="text-sm font-semibold text-white">Tu Avatar está listo ✦</p>
            <p className="text-[10px] mt-0.5" style={{ color: 'rgba(255,255,255,0.35)' }}>Cada pieza es única, como tú.</p>
          </div>
          <button
            onClick={onClose}
            className="text-lg leading-none"
            style={{ color: 'rgba(255,255,255,0.3)' }}
          >✕</button>
        </div>

        {/* Preview */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={dataUrl}
          alt="Avatar preview"
          className="w-full aspect-square object-contain"
          style={{ background: 'rgba(255,255,255,0.03)' }}
        />

        {/* Actions */}
        <div className="p-4 space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={handleDownload}
              className="text-sm font-semibold py-2.5 rounded-xl transition-all"
              style={{ background: 'linear-gradient(135deg,#6d28d9,#9333ea)', color: 'white' }}
            >
              Descargar PNG
            </button>
            {typeof navigator !== 'undefined' && 'share' in navigator ? (
              <button
                onClick={handleShare}
                className="text-sm font-medium py-2.5 rounded-xl transition-all"
                style={{ background: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.8)' }}
              >
                Compartir
              </button>
            ) : (
              <div />
            )}
          </div>

          {shareUrl && (
            <button
              onClick={handleCopyLink}
              className="w-full text-xs py-2.5 rounded-xl transition-all flex items-center justify-center gap-2"
              style={{
                background: copied ? 'rgba(16,185,129,0.15)' : 'rgba(255,255,255,0.05)',
                color: copied ? '#6ee7b7' : 'rgba(255,255,255,0.45)',
                border: `1px solid ${copied ? 'rgba(16,185,129,0.3)' : 'rgba(255,255,255,0.07)'}`,
              }}
            >
              {copied ? '✓ Link copiado' : '🔗 Copiar link del avatar'}
            </button>
          )}
        </div>
      </div>

      <a ref={linkRef} className="hidden" />
    </div>
  )
}
