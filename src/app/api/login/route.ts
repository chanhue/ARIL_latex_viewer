import { NextResponse } from 'next/server'
import {
  AUTH_COOKIE,
  SESSION_MAX_AGE,
  createSession,
  labPassword,
  passwordMatches,
} from '@/lib/auth.mjs'

export const runtime = 'nodejs'

export async function POST(request: Request) {
  const password = labPassword()
  if (!password) return NextResponse.json({ ok: true })

  let submitted = ''
  try {
    const body = await request.json()
    submitted = String(body?.password ?? '')
  } catch {
    return NextResponse.json({ error: '잘못된 요청입니다.' }, { status: 400 })
  }

  if (!(await passwordMatches(submitted, password))) {
    // A small fixed delay: enough to make guessing over the network tedious
    // without pretending this is real rate limiting.
    await new Promise((resolve) => setTimeout(resolve, 600))
    return NextResponse.json({ error: '비밀번호가 맞지 않습니다.' }, { status: 401 })
  }

  const response = NextResponse.json({ ok: true })
  response.cookies.set(AUTH_COOKIE, await createSession(password), {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: SESSION_MAX_AGE,
  })
  return response
}
