import { NextRequest, NextResponse } from 'next/server'
import createMiddleware from 'next-intl/middleware'
import { createServerClient } from '@supabase/ssr'
import { routing } from './lib/i18n/routing'

const intlMiddleware = createMiddleware(routing)

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Protect admin routes — skip only the login page itself
  const isAdminRoute = /^\/(es|en)\/admin/.test(pathname)
  const isLoginRoute = /^\/(es|en)\/admin\/login/.test(pathname)

  if (isAdminRoute && !isLoginRoute) {
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll: () => request.cookies.getAll(),
          setAll: () => {},    // read-only in proxy
        },
      }
    )

    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      const locale = pathname.startsWith('/en/') ? 'en' : 'es'
      return NextResponse.redirect(new URL(`/${locale}/admin/login`, request.url))
    }
  }

  return intlMiddleware(request)
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico|.*\\..*).*)'],
}
