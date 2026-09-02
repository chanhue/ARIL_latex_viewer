import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { AUTH_COOKIE, labPassword, verifySession } from '@/lib/auth.mjs'

/**
 * One shared lab password guards the whole site.
 *
 * With LAB_PASSWORD unset the middleware steps aside entirely, so local
 * development and a lab-server deployment need no configuration.
 *
 * Note the limit of this on Vercel: uploaded files live on Blob's public CDN
 * under unguessable URLs, and those URLs are not behind this check. The
 * password protects the listing and the viewer, not a leaked file link.
 */
export async function middleware(request: NextRequest) {
  const password = labPassword()
  if (!password) return NextResponse.next()

  const token = request.cookies.get(AUTH_COOKIE)?.value
  if (token && (await verifySession(token, password))) return NextResponse.next()

  // Fetches want a status they can read, not a login page in the response body.
  if (request.nextUrl.pathname.startsWith('/api/')) {
    return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 })
  }

  const url = request.nextUrl.clone()
  url.pathname = '/login'
  url.search = ''
  const next = request.nextUrl.pathname + request.nextUrl.search
  if (next !== '/') url.searchParams.set('next', next)
  return NextResponse.redirect(url)
}

export const config = {
  matcher: [
    // Everything except the login flow itself and Next's static output —
    // without these exclusions the redirect would loop.
    '/((?!login|api/login|api/logout|_next/static|_next/image|favicon.ico).*)',
  ],
}
