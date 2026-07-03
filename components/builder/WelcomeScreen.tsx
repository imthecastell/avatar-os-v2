'use client'

import { useState } from 'react'
import dynamic from 'next/dynamic'
import type { AvatarState, Layer, Asset, SiteSettings, Collection } from '@/types'
import { makeT } from '@/lib/i18n/dict'

const AvatarCanvas = dynamic(() => import('@/components/builder/AvatarCanvas'), {
  ssr: false,
  loading: () => <div className="w-full h-full" style={{ background: 'rgba(255,255,255,0.02)' }} />,
})

interface Props {
  locale:     string
  collection: Collection
  layers:     Layer[]
  assets:     Asset[]
  settings:   SiteSettings | null
  onEnter:    (unlock: { keywordId: string; isXtra: boolean } | null) => void
}

const SOCIAL_ICONS: Record<string, string> = {
  socialInstagram: '📷',
  socialTiktok:    '🎵',
  socialTwitter:   '🐦',
  socialWebsite:   '🌐',
}

export default function WelcomeScreen({ locale, collection, layers, assets, settings, onEnter }: Props) {
  const t = makeT(locale)
  const [keyword, setKeyword]   = useState('')
  const [status, setStatus]     = useState<'idle' | 'loading' | 'err'>('idle')

  const message =
    (locale === 'es' ? settings?.welcomeMessageEs :
     locale === 'nl' ? settings?.welcomeMessageNl :
     locale === 'fr' ? settings?.welcomeMessageFr :
     settings?.welcomeMessageEn) || settings?.welcomeMessageEs || null

  const creatorState: AvatarState | null = settings?.creatorAvatarState ?? null

  const socials = (['socialInstagram', 'socialTiktok', 'socialTwitter', 'socialWebsite'] as const)
    .map(key => ({ key, url: settings?.[key] }))
    .filter((s): s is { key: typeof s.key; url: string } => !!s.url)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!keyword.trim()) { onEnter(null); return }
    setStatus('loading')
    const res  = await fetch(`/api/keywords?keyword=${encodeURIComponent(keyword.trim().toUpperCase())}&collectionId=${collection.id}`)
    const data = await res.json()
    if (data.valid) {
      const isXtra = (data.keyword.label as string)?.toLowerCase().includes('xtra') ||
                     (data.keyword.keyword as string)?.toLowerCase().includes('xtra')
      onEnter({ keywordId: data.keyword.id, isXtra })
    } else {
      setStatus('err')
      setTimeout(() => setStatus('idle'), 2000)
    }
  }

  return (
    <div
      className="h-screen w-full flex flex-col items-center overflow-y-auto relative fx-fade-in"
      style={{
        background: 'radial-gradient(circle at 50% 0%, rgba(124,58,237,0.18), transparent 55%), linear-gradient(180deg, #0d0a1a 0%, #07070e 60%)',
        color: 'white',
      }}
    >
      {/* Textura decorativa de fondo */}
      <div className="absolute inset-0 pointer-events-none opacity-40" style={{
        backgroundImage: 'radial-gradient(rgba(255,255,255,0.05) 1px, transparent 1px)',
        backgroundSize: '28px 28px',
      }} />

      <div className="relative w-full max-w-sm flex flex-col items-center px-6 pt-10 pb-8 gap-6">

        {/* Proyecto */}
        <div className="text-center">
          <p className="text-[10px] font-semibold uppercase tracking-[0.25em]" style={{ color: '#a78bfa' }}>
            Castells Season 6
          </p>
          <p className="text-[11px] mt-0.5" style={{ color: 'rgba(255,255,255,0.35)' }}>
            Pursuit of Consciencia
          </p>
        </div>

        {/* Avatar del creador */}
        <div className="relative w-48 h-48 fx-float">
          <div className="absolute inset-0 rounded-full blur-3xl fx-breathe" style={{ background: 'radial-gradient(circle, #7c3aed, transparent 70%)' }} />
          <div
            className="relative w-full h-full rounded-[32px] overflow-hidden"
            style={{ boxShadow: '0 24px 60px rgba(0,0,0,0.8), inset 0 1px 0 rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.08)' }}
          >
            {creatorState ? (
              <AvatarCanvas state={creatorState} layers={layers} assets={assets} size={800} />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-4xl" style={{ background: 'linear-gradient(135deg, rgba(124,58,237,0.25), rgba(168,85,247,0.1))' }}>
                ✦
              </div>
            )}
          </div>
        </div>

        {/* Mensaje de bienvenida */}
        <div className="text-center space-y-1">
          {settings?.creatorName && (
            <p className="text-xs font-semibold" style={{ color: '#c4b5fd' }}>{settings.creatorName}</p>
          )}
          <p className="text-sm leading-relaxed" style={{ color: 'rgba(255,255,255,0.7)' }}>
            {message ?? '✦'}
          </p>
        </div>

        {/* Redes sociales */}
        {socials.length > 0 && (
          <div className="flex flex-col items-center gap-2">
            <p className="text-[9px] font-semibold uppercase tracking-widest" style={{ color: 'rgba(255,255,255,0.25)' }}>
              {t('followUs')}
            </p>
            <div className="flex gap-2">
              {socials.map(s => (
                <a
                  key={s.key}
                  href={s.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-9 h-9 rounded-full flex items-center justify-center text-base fx-tap"
                  style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.08)' }}
                >
                  {SOCIAL_ICONS[s.key]}
                </a>
              ))}
            </div>
          </div>
        )}

        {/* CTA principal */}
        <button
          onClick={() => onEnter(null)}
          className="w-full text-sm font-semibold py-3 rounded-2xl fx-shimmer fx-tap mt-2"
          style={{
            background: 'linear-gradient(90deg,#6d28d9,#9333ea,#c084fc,#9333ea,#6d28d9)',
            color: 'white',
            boxShadow: '0 4px 24px rgba(124,58,237,0.4)',
          }}
        >
          ✨ {t('welcomeCta')}
        </button>

        {/* Palabra clave */}
        <div className="w-full">
          <p className="text-[10px] text-center mb-2" style={{ color: 'rgba(255,255,255,0.3)' }}>
            {t('haveKeyword')}
          </p>
          <form onSubmit={handleSubmit} className="flex flex-col gap-2">
            <input
              type="text"
              value={keyword}
              onChange={e => { setKeyword(e.target.value.toUpperCase()); setStatus('idle') }}
              placeholder={t('keywordPlaceholder')}
              disabled={status === 'loading'}
              className="w-full text-xs rounded-xl px-3 py-2.5 focus:outline-none transition-colors"
              style={{
                background: 'rgba(255,255,255,0.05)',
                border: status === 'err' ? '1px solid rgba(239,68,68,0.6)' : '1px solid rgba(255,255,255,0.1)',
                color: 'white',
                letterSpacing: '0.05em',
              }}
            />
            <button
              type="submit"
              disabled={status === 'loading'}
              className="w-full text-xs font-semibold px-4 py-2.5 rounded-xl fx-tap shrink-0 disabled:opacity-50"
              style={{ background: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.8)', border: '1px solid rgba(255,255,255,0.1)' }}
            >
              {status === 'loading' ? '…' : keyword.trim() ? t('unlockExperience') : t('continueToBuilder')}
            </button>
          </form>
          {status === 'err' && (
            <p className="text-[10px] text-center mt-1.5" style={{ color: '#fca5a5' }}>{t('wrongCode')}</p>
          )}
        </div>

      </div>
    </div>
  )
}
