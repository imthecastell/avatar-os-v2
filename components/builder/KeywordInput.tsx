'use client'

import { useState } from 'react'

interface Props {
  collectionId: string
  onUnlock: (keywordId: string) => void
}

export default function KeywordInput({ collectionId, onUnlock }: Props) {
  const [open, setOpen] = useState(false)
  const [value, setValue] = useState('')
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!value.trim()) return
    setStatus('loading')

    const res = await fetch(
      `/api/keywords?keyword=${encodeURIComponent(value)}&collectionId=${collectionId}`
    )
    const data = await res.json()

    if (data.valid) {
      setStatus('success')
      onUnlock(data.keyword.id)
      setTimeout(() => setOpen(false), 1500)
    } else {
      setStatus('error')
      setTimeout(() => setStatus('idle'), 2000)
    }
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="text-sm text-violet-400 hover:text-violet-300 transition-colors flex items-center gap-1.5"
      >
        🔑 Tengo una clave secreta
      </button>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="flex gap-2">
      <input
        autoFocus
        type="text"
        value={value}
        onChange={e => setValue(e.target.value)}
        placeholder="Ingresa tu clave..."
        className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:border-violet-500"
      />
      <button
        type="submit"
        disabled={status === 'loading'}
        className="bg-violet-600 hover:bg-violet-500 text-white text-sm px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50"
      >
        {status === 'loading' ? '...' : status === 'success' ? '✓' : status === 'error' ? '✗' : 'Desbloquear'}
      </button>
      <button
        type="button"
        onClick={() => setOpen(false)}
        className="text-gray-500 hover:text-white text-sm px-2"
      >
        ✕
      </button>
    </form>
  )
}
