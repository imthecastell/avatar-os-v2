'use client'

import { useRef } from 'react'

interface Props {
  dataUrl: string
  onClose: () => void
}

export default function ExportModal({ dataUrl, onClose }: Props) {
  const linkRef = useRef<HTMLAnchorElement>(null)

  function handleDownload() {
    const link = linkRef.current!
    link.href = dataUrl
    link.download = `avatar-${Date.now()}.png`
    link.click()
  }

  async function handleShare() {
    if (!navigator.share) {
      handleDownload()
      return
    }
    const blob = await (await fetch(dataUrl)).blob()
    const file = new File([blob], 'avatar.png', { type: 'image/png' })
    await navigator.share({ title: 'Mi Avatar', files: [file] })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70">
      <div className="bg-gray-900 border border-gray-700 rounded-2xl p-6 max-w-sm w-full mx-4">
        <h2 className="text-lg font-semibold text-white mb-1">Tu Avatar está listo</h2>
        <p className="text-sm text-gray-400 mb-4">Cada pieza es única, como tú.</p>

        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={dataUrl}
          alt="Avatar preview"
          className="w-full aspect-square object-contain rounded-xl mb-4 bg-gray-800"
        />

        <div className="flex gap-2">
          <button
            onClick={handleDownload}
            className="flex-1 bg-violet-600 hover:bg-violet-500 text-white font-medium py-2 rounded-xl text-sm transition-colors"
          >
            Descargar PNG
          </button>
          {typeof navigator !== 'undefined' && 'share' in navigator && (
            <button
              onClick={handleShare}
              className="flex-1 bg-gray-700 hover:bg-gray-600 text-white font-medium py-2 rounded-xl text-sm transition-colors"
            >
              Compartir
            </button>
          )}
        </div>

        <button
          onClick={onClose}
          className="mt-3 w-full text-sm text-gray-500 hover:text-white transition-colors"
        >
          Cerrar
        </button>

        {/* Hidden download anchor */}
        <a ref={linkRef} className="hidden" />
      </div>
    </div>
  )
}
