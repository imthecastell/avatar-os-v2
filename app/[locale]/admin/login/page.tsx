'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter, useParams } from 'next/navigation'

export default function AdminLoginPage() {
  const [email,    setEmail]    = useState('')
  const [password, setPassword] = useState('')
  const [error,    setError]    = useState('')
  const [loading,  setLoading]  = useState(false)
  const router = useRouter()
  const params = useParams()
  const locale = params.locale as string

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    const supabase = createClient()
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) {
      setError(error.message)
      setLoading(false)
      return
    }
    router.push(`/${locale}/admin`)
  }

  const inputC = 'w-full text-sm rounded-xl px-4 py-3 border focus:outline-none transition-colors focus:border-violet-500'
  const inputS = { background: 'rgba(255,255,255,0.05)', borderColor: 'rgba(255,255,255,0.1)', color: 'white' }

  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ background: '#07070e' }}>
      <div
        className="w-full max-w-sm rounded-3xl p-8"
        style={{ background: '#111120', border: '1px solid rgba(255,255,255,0.08)' }}
      >
        {/* Logo */}
        <div className="flex items-center gap-3 mb-8">
          <div
            className="w-9 h-9 rounded-xl flex items-center justify-center text-lg"
            style={{ background: 'linear-gradient(135deg,#7c3aed,#a855f7)' }}
          >
            ✦
          </div>
          <div>
            <p className="text-sm font-semibold text-white">Avatar OS</p>
            <p className="text-[10px]" style={{ color: 'rgba(255,255,255,0.3)' }}>Admin panel</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            required
            autoComplete="email"
            className={inputC}
            style={inputS}
          />
          <input
            type="password"
            placeholder="Contraseña"
            value={password}
            onChange={e => setPassword(e.target.value)}
            required
            autoComplete="current-password"
            className={inputC}
            style={inputS}
          />

          {error && (
            <p className="text-xs px-1" style={{ color: 'rgba(252,165,165,1)' }}>{error}</p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full text-sm font-semibold py-3 rounded-xl disabled:opacity-50 transition-all mt-1"
            style={{ background: 'linear-gradient(135deg,#7c3aed,#a855f7)', color: 'white' }}
          >
            {loading ? 'Iniciando sesión…' : 'Entrar'}
          </button>
        </form>
      </div>
    </div>
  )
}
