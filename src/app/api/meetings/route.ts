import { randomUUID } from 'node:crypto'
import { NextResponse } from 'next/server'
import { addMeeting, getTemplate, listMeetings, meetingTitles } from '@/lib/db'
import { createEmptySlot } from '@/lib/slots'
import {
  isMeetingKind,
  meetingTitleFor,
  normalizeMembers,
  sanitizeSegment,
} from '@/lib/meeting.mjs'
import type { Meeting, MeetingKind } from '@/lib/types'

export const dynamic = 'force-dynamic'

export async function GET() {
  return NextResponse.json({ meetings: await listMeetings() })
}

/**
 * Create a meeting or a seminar.
 *
 * A meeting with no `presenters` uses the saved roster template, which is the
 * normal case: picking a date is the only decision. A seminar has no template —
 * it is one person, named here.
 */
export async function POST(request: Request) {
  let payload: Record<string, unknown>
  try {
    payload = await request.json()
  } catch {
    return NextResponse.json({ error: '잘못된 요청입니다.' }, { status: 400 })
  }

  // The cast is redundant when the JSDoc predicate is honoured and load-bearing
  // when it is not; either way the check above is what makes it true.
  const kind: MeetingKind = isMeetingKind(payload.kind)
    ? (payload.kind as MeetingKind)
    : 'meeting'
  const date = String(payload.date ?? '').trim()
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json({ error: '날짜를 골라 주세요.' }, { status: 400 })
  }

  // The title carries a counter when a date already has a meeting, which is
  // also what keeps the storage folder unique.
  const title = meetingTitleFor(date, await meetingTitles(), kind)
  if (!title) return NextResponse.json({ error: '날짜가 올바르지 않습니다.' }, { status: 400 })

  const folder = sanitizeSegment(title)
  if (!folder) return NextResponse.json({ error: '폴더 이름을 만들 수 없습니다.' }, { status: 400 })

  const meeting: Meeting = {
    id: randomUUID(),
    kind,
    date,
    title,
    folder,
    createdAt: new Date().toISOString(),
  }

  const source = Array.isArray(payload.presenters)
    ? payload.presenters
    : kind === 'seminar'
      ? []
      : await getTemplate()

  const result = normalizeMembers(source)
  if ('error' in result) return NextResponse.json({ error: result.error }, { status: 400 })
  const names = result.members

  if (kind === 'seminar' && names.length !== 1) {
    return NextResponse.json({ error: '발표자 한 명을 입력해 주세요.' }, { status: 400 })
  }

  try {
    await addMeeting(meeting)
    for (const name of names) await createEmptySlot(meeting.id, name)
    return NextResponse.json({ id: meeting.id, title: meeting.title }, { status: 201 })
  } catch (err) {
    console.error('failed to create meeting', err)
    return NextResponse.json({ error: '랩미팅을 만들지 못했습니다.' }, { status: 500 })
  }
}
