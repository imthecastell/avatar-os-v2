'use client'

import { useState } from 'react'
import type { SiteSettings } from '@/types'

interface Props {
  initialSettings: SiteSettings | null
}

const inputS = {
  background: 'rgba(255,255,255,0.06)',
  borderColor: 'rgba(255,255,255,0.1)',
  color: 'white',
} as const

const LANGS: { key: 'welcomeMessageEs' | 'welcomeMessageEn' | 'welcomeMessageNl' | 'welcomeMessageFr'; label: string; flag: string }[] = [
  { key: 'welcomeMessageEs', label: 'Español',    flag: '🇪🇸' },
  { key: 'welcomeMessageEn', label: 'English',    flag: '🇬🇧' },
  { key: 'welcomeMessageNl', label: 'Nederlands', flag: '🇳🇱' },
  { key: 'welcomeMessageFr', label: 'Français',   flag: '🇫🇷' },
]

export default function SettingsPanel({ initialSettings }: Props) {
  const [form, setForm] = useState<Partial<SiteSettings>>(initialSettings ?? {
    welcomeMessageEs: '', welcomeMessageEn: '', welcomeMessageNl: '', welcomeMessageFr: '',
    creatorName: '', socialInstagram: '', socialTiktok: '', socialTwitter: '', socialWebsite: '',
  })
  const [saving, setSaving] = useState(false)
  const [saved, setSaved]   = useState(false)
  const [error, setError]   = useState<string | null>(null)

  function set<K extends keyof SiteSettings>(key: K, value: string) {
    setForm(f => ({ ...f, [key]: value }))
    setSaved(false)
  }

  async function save() {
    setSaving(true)
    setError(null)
    const res = await fetch('/api/settings', {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        welcome_message_es: form.welcomeMessageEs || null,
        welcome_message_en: form.welcomeMessageEn || null,
        welcome_message_nl: form.welcomeMessageNl || null,
        welcome_message_fr: form.welcomeMessageFr || null,
        creator_name:       form.creatorName || null,
        social_instagram:   form.socialInstagram || null,
        social_tiktok:      form.socialTiktok || null,
        social_twitter:     form.socialTwitter || null,
        social_website:     form.socialWebsite || null,
      }),
    })
    setSaving(false)
    if (res.ok) { setSaved(true); setTimeout(() => setSaved(false), 2500) }
    else { const d = await res.json().catch(() => ({} as { error?: string })); setError(d.error ?? `HTTP ${res.status} — ¿se aplicó la migración 008_site_settings.sql?`) }
  }

  return (
    <div className="space-y-6">

      {/* Nombre del creador */}
      <div>
        <p className="text-[9px] font-semibold uppercase tracking-widest mb-1.5" style={{ color: 'rgba(255,255,255,0.25)' }}>Tu nombre</p>
        <input
          value={form.creatorName ?? ''}
          onChange={e => set('creatorName', e.target.value)}
          placeholder="Ej. Castells"
          className="w-full text-sm rounded-xl px-3 py-2.5 border focus:outline-none focus:border-violet-500"
          style={inputS}
        />
      </div>

      {/* Mensajes de bienvenida por idioma */}
      <div>
        <p className="text-[9px] font-semibold uppercase tracking-widest mb-1.5" style={{ color: 'rgba(255,255,255,0.25)' }}>Mensaje de bienvenida</p>
        <div className="space-y-2">
          {LANGS.map(l => (
            <div key={l.key} className="flex gap-2 items-start">
              <span className="text-lg leading-none pt-2.5">{l.flag}</span>
              <textarea
                value={(form[l.key] as string) ?? ''}
                onChange={e => set(l.key, e.target.value)}
                placeholder={`Mensaje en ${l.label}…`}
                rows={2}
                className="flex-1 text-sm rounded-xl px-3 py-2.5 border focus:outline-none focus:border-violet-500 resize-none"
                style={inputS}
              />
            </div>
          ))}
        </div>
      </div>

      {/* Redes sociales */}
      <div>
        <p className="text-[9px] font-semibold uppercase tracking-widest mb-1.5" style={{ color: 'rgba(255,255,255,0.25)' }}>Redes sociales</p>
        <div className="space-y-2">
          {[
            { key: 'socialInstagram' as const, icon: '📷', ph: 'https://instagram.com/tu_usuario' },
            { key: 'socialTiktok'    as const, icon: '🎵', ph: 'https://tiktok.com/@tu_usuario' },
            { key: 'socialTwitter'   as const, icon: '🐦', ph: 'https://x.com/tu_usuario' },
            { key: 'socialWebsite'   as const, icon: '🌐', ph: 'https://tu-sitio.com' },
          ].map(s => (
            <div key={s.key} className="flex gap-2 items-center">
              <span className="text-base w-5 text-center">{s.icon}</span>
              <input
                value={(form[s.key] as string) ?? ''}
                onChange={e => set(s.key, e.target.value)}
                placeholder={s.ph}
                className="flex-1 text-sm rounded-xl px-3 py-2.5 border focus:outline-none focus:border-violet-500"
                style={inputS}
              />
            </div>
          ))}
        </div>
      </div>

      {error && (
        <p className="text-xs px-3 py-2 rounded-xl" style={{ background: 'rgba(239,68,68,0.1)', color: '#fca5a5' }}>{error}</p>
      )}

      <button
        onClick={save}
        disabled={saving}
        className="text-sm font-semibold px-5 py-2.5 rounded-xl transition-all disabled:opacity-50"
        style={{ background: saved ? 'rgba(16,185,129,0.8)' : 'rgba(124,58,237,0.8)', color: 'white' }}
      >
        {saving ? 'Guardando…' : saved ? '✓ Guardado' : 'Guardar cambios'}
      </button>
    </div>
  )
}
