import { NextResponse } from 'next/server'
import { getTemplate, setTemplate } from '@/lib/db'
import { normalizeMembers } from '@/lib/meeting.mjs'

export const dynamic = 'force-dynamic'

export async function GET() {
  return NextResponse.json({ members: await getTemplate() })
}

/**
 * Replace the roster wholesale. It is a short list edited as a whole, so there
 * is nothing to gain from per-member endpoints.
 */
export async function PUT(request: Request) {
  let payload: Record<string, unknown>
  try {
    payload = await request.json()
  } catch {
    return NextResponse.json({ error: '잘못된 요청입니다.' }, { status: 400 })
  }

  const result = normalizeMembers(payload.members)
  if ('error' in result) return NextResponse.json({ error: result.error }, { status: 400 })

  await setTemplate(result.members)
  return NextResponse.json({ members: result.members })
}
