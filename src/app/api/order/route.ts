import { NextResponse } from 'next/server'
import { getRunOrder, getTemplate, setRunOrder } from '@/lib/db'
import { sanitizeSegment, shuffleOrder } from '@/lib/meeting.mjs'

export const dynamic = 'force-dynamic'

export async function GET() {
  return NextResponse.json({ order: await getRunOrder() })
}

/**
 * Draw the running order for the ticked people, or clear it.
 *
 * The shuffle happens here rather than in the browser so that everyone opening
 * the page sees the same list — an order each viewer rolled for themselves
 * would be worse than none at all.
 */
export async function PUT(request: Request) {
  let payload: Record<string, unknown>
  try {
    payload = await request.json()
  } catch {
    return NextResponse.json({ error: '잘못된 요청입니다.' }, { status: 400 })
  }

  if (payload.clear === true) {
    return NextResponse.json({ order: await setRunOrder([]) })
  }

  if (!Array.isArray(payload.presenters)) {
    return NextResponse.json({ error: '잘못된 요청입니다.' }, { status: 400 })
  }

  // Only people on the roster can be drawn; the list arrives from the browser
  // and is not to be trusted as-is.
  const members = await getTemplate()
  const known = new Map(
    members.map((name) => [sanitizeSegment(name).toLowerCase(), name]),
  )

  const chosen: string[] = []
  for (const raw of payload.presenters) {
    const match = known.get(sanitizeSegment(String(raw ?? '')).toLowerCase())
    if (match && !chosen.includes(match)) chosen.push(match)
  }

  return NextResponse.json({ order: await setRunOrder(shuffleOrder(chosen)) })
}
