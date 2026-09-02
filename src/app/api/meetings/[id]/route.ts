import { NextResponse } from 'next/server'
import { getMeeting, listPresentations, removeMeeting, setMeetingOrder } from '@/lib/db'
import { deleteFolder } from '@/lib/storage'
import { slotUrls } from '@/lib/slots'
import { sanitizeSegment, shuffleOrder } from '@/lib/meeting.mjs'

export const dynamic = 'force-dynamic'

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const meeting = await getMeeting(id)
  if (!meeting) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json({ meeting, presentations: await listPresentations(id) })
}

/**
 * Draw the speaking order for the checked presenters, or clear it.
 *
 * The shuffle happens here rather than in the browser so that everyone opening
 * the page sees the same list — an order each viewer rolled for themselves
 * would be worse than none at all.
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params

  let payload: Record<string, unknown>
  try {
    payload = await request.json()
  } catch {
    return NextResponse.json({ error: '잘못된 요청입니다.' }, { status: 400 })
  }

  const meeting = await getMeeting(id)
  if (!meeting) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  if (payload.clear === true) {
    const cleared = await setMeetingOrder(id, [])
    return NextResponse.json({ order: cleared?.order ?? [] })
  }

  if (!Array.isArray(payload.presenters)) {
    return NextResponse.json({ error: '잘못된 요청입니다.' }, { status: 400 })
  }

  // Only people who actually have a slot in this meeting can be drawn; the
  // list of names arrives from the browser and is not to be trusted as-is.
  const slots = await listPresentations(id)
  const known = new Map(
    slots.map((slot) => [sanitizeSegment(slot.presenter).toLowerCase(), slot.presenter]),
  )

  const chosen: string[] = []
  for (const raw of payload.presenters) {
    const match = known.get(sanitizeSegment(String(raw ?? '')).toLowerCase())
    if (match && !chosen.includes(match)) chosen.push(match)
  }

  const updated = await setMeetingOrder(id, shuffleOrder(chosen))
  return NextResponse.json({ order: updated?.order ?? [] })
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const removed = await removeMeeting(id)
  if (!removed) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // Files go after the records: an orphaned blob is harmless, a record pointing
  // at a deleted file is a broken page.
  const urls = removed.presentations.flatMap(slotUrls)
  await deleteFolder(removed.meeting.folder, urls)
  return NextResponse.json({ ok: true })
}
