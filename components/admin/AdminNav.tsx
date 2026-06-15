'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

const NAV_ITEMS = [
  { key: 'assets',   label: 'Assets',    href: 'assets' },
  { key: 'layers',   label: 'Capas',     href: 'layers' },
  { key: 'preview',  label: 'Preview',   href: 'preview' },
  { key: 'keywords', label: 'Keywords',  href: 'keywords' },
]

export default function AdminNav({ locale }: { locale: string }) {
  const pathname = usePathname()
  const router = useRouter()

  async function handleLogout() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push(`/${locale}/admin/login`)
  }

  return (
    <nav className="border-b border-gray-800 bg-gray-950">
      <div className="max-w-7xl mx-auto px-4 flex items-center justify-between h-14">
        <div className="flex items-center gap-1">
          <span className="text-white font-semibold text-sm mr-4">Avatar OS</span>
          {NAV_ITEMS.map(item => {
            const href = `/${locale}/admin/${item.href}`
            const active = pathname.includes(`/admin/${item.href}`)
            return (
              <Link
                key={item.key}
                href={href}
                className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${
                  active
                    ? 'bg-violet-600 text-white'
                    : 'text-gray-400 hover:text-white hover:bg-gray-800'
                }`}
              >
                {item.label}
              </Link>
            )
          })}
        </div>

        <button
          onClick={handleLogout}
          className="text-sm text-gray-500 hover:text-white transition-colors"
        >
          Cerrar sesión
        </button>
      </div>
    </nav>
  )
}
