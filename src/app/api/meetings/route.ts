import { randomUUID } from 'node:crypto'
import { NextResponse } from 'next/server'
import { addMeeting, listMeetings, meetingTitles } from '@/lib/db'
import { createEmptySlot } from '@/lib/slots'
import { meetingTitleFor, presenterTaken, sanitizeSegment } from '@/lib/meeting.mjs'
import type { Meeting } from '@/lib/types'

export const dynamic = 'force-dynamic'

export async function GET() {
  return NextResponse.json({ meetings: await listMeetings() })
}

/**
 * Create a meeting. `presenters` is optional — pass names to set up empty slots
 * up front, or leave it out and let slots appear as people upload.
 */
export async function POST(request: Request) {
  let payload: Record<string, unknown>
  try {
    payload = await request.json()
  } catch {
    return NextResponse.json({ error: '잘못된 요청입니다.' }, { status: 400 })
  }

  const date = String(payload.date ?? '').trim()
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json({ error: '날짜를 골라 주세요.' }, { status: 400 })
  }

  // The title carries a counter when a date already has a meeting, which is
  // also what keeps the storage folder unique.
  const title = meetingTitleFor(date, await meetingTitles())
  if (!title) return NextResponse.json({ error: '날짜가 올바르지 않습니다.' }, { status: 400 })

  const folder = sanitizeSegment(title)
  if (!folder) return NextResponse.json({ error: '폴더 이름을 만들 수 없습니다.' }, { status: 400 })

  const meeting: Meeting = {
    id: randomUUID(),
    date,
    title,
    folder,
    createdAt: new Date().toISOString(),
  }

  const rawPresenters = Array.isArray(payload.presenters) ? payload.presenters : []
  const names: string[] = []
  for (const raw of rawPresenters) {
    const name = String(raw ?? '').trim()
    if (!name) continue
    if (!sanitizeSegment(name)) {
      return NextResponse.json({ error: `'${name}'은(는) 이름으로 쓸 수 없습니다.` }, { status: 400 })
    }
    // Two identical names in one meeting would share a folder.
    if (presenterTaken(name, names)) {
      return NextResponse.json({ error: `'${name}'이(가) 중복됩니다.` }, { status: 400 })
    }
    names.push(name)
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
