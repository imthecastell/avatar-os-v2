'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

const NAV_ITEMS = [
  { key: 'studio',      label: 'Studio',      href: '' },
  { key: 'collections', label: 'Colecciones', href: 'collections' },
  { key: 'keywords',    label: 'Keywords',    href: 'keywords' },
]

export default function AdminNav({ locale }: { locale: string }) {
  const pathname = usePathname()
  const router   = useRouter()

  async function handleLogout() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push(`/${locale}/admin/login`)
  }

  const adminRoot = `/${locale}/admin`

  return (
    <nav className="shrink-0 flex items-center justify-between px-4 h-[52px] border-b" style={{ background: '#0b0b16', borderColor: 'rgba(255,255,255,0.06)' }}>
      {/* Brand */}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2 mr-2">
          <div className="w-6 h-6 rounded-lg flex items-center justify-center text-sm" style={{ background: 'linear-gradient(135deg,#7c3aed,#a855f7)' }}>
            ✦
          </div>
          <span className="text-sm font-semibold text-white">Avatar OS</span>
        </div>

        {/* Nav pills */}
        <div className="flex items-center gap-0.5 rounded-xl p-0.5" style={{ background: 'rgba(255,255,255,0.05)' }}>
          {NAV_ITEMS.map(item => {
            const href   = item.href ? `${adminRoot}/${item.href}` : adminRoot
            const active = item.href
              ? pathname.includes(`/admin/${item.href}`)
              : pathname === adminRoot || pathname === `${adminRoot}/`
            return (
              <Link
                key={item.key}
                href={href}
                className="px-3 py-1 rounded-lg text-xs font-medium transition-all"
                style={{
                  background: active ? 'rgba(139,92,246,0.85)' : 'transparent',
                  color: active ? 'white' : 'rgba(255,255,255,0.45)',
                }}
              >
                {item.label}
              </Link>
            )
          })}
        </div>
      </div>

      {/* Right actions */}
      <div className="flex items-center gap-3">
        <Link
          href={`/${locale}/builder`}
          target="_blank"
          className="flex items-center gap-1.5 text-xs rounded-lg px-2.5 py-1.5 transition-all"
          style={{ background: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.5)' }}
        >
          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
          </svg>
          Builder
        </Link>

        <button
          onClick={handleLogout}
          className="text-xs transition-colors"
          style={{ color: 'rgba(255,255,255,0.3)' }}
          onMouseEnter={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.7)')}
          onMouseLeave={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.3)')}
        >
          Salir
        </button>
      </div>
    </nav>
  )
}
