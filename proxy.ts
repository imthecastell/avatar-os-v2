import { NextRequest } from 'next/server'
import createMiddleware from 'next-intl/middleware'
import { routing } from './lib/i18n/routing'

const intlMiddleware = createMiddleware(routing)

// Auth is handled server-side in each protected layout
export function proxy(request: NextRequest) {
  return intlMiddleware(request)
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico|.*\\..*).*)'],
}
