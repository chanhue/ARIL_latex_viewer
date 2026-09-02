import { NextResponse } from 'next/server'
import { getMeeting } from '@/lib/db'
import { createEmptySlot, fillSlot, findSlot } from '@/lib/slots'
import { sanitizeSegment } from '@/lib/meeting.mjs'
import { usingVercelBlob } from '@/lib/storage'
import type { StoredFile } from '@/lib/types'

export const dynamic = 'force-dynamic'

/**
 * Only Blob URLs are accepted. Without this the endpoint would happily store
 * any URL a caller supplied, and the viewer would then render it — an open
 * redirect dressed up as a slide.
 */
function isAllowedUrl(url: unknown): url is string {
  if (typeof url !== 'string') return false
  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    return false
  }
  if (parsed.protocol !== 'https:') return false
  return (
    parsed.hostname.endsWith('.public.blob.vercel-storage.com') ||
    parsed.hostname === 'blob.vercel-storage.com'
  )
}

function parseFile(value: unknown): StoredFile | null {
  if (!value || typeof value !== 'object') return null
  const file = value as Record<string, unknown>
  if (typeof file.name !== 'string' || !file.name.trim()) return null
  if (!isAllowedUrl(file.url)) return null
  return {
    name: file.name,
    url: file.url,
    size: typeof file.size === 'number' && file.size >= 0 ? file.size : 0,
    contentType:
      typeof file.contentType === 'string' ? file.contentType : 'application/octet-stream',
  }
}

/**
 * Two jobs, told apart by whether `pdf` is present:
 *
 *   without pdf  register an empty slot — a name on the meeting page with
 *                nothing uploaded yet
 *   with pdf     record files already uploaded straight to Blob by the
 *                browser, the second half of the direct-upload flow
 *
 * The multipart path (/api/upload) is what local development uses instead.
 */
export async function POST(request: Request) {
  let payload: Record<string, unknown>
  try {
    payload = await request.json()
  } catch {
    return NextResponse.json({ error: '잘못된 요청입니다.' }, { status: 400 })
  }

  const meetingId = String(payload.meetingId ?? '')
  const presenter = String(payload.presenter ?? '').trim()

  const meeting = await getMeeting(meetingId)
  if (!meeting) return NextResponse.json({ error: '랩미팅을 찾을 수 없습니다.' }, { status: 404 })

  if (!presenter) return NextResponse.json({ error: '이름을 입력해 주세요.' }, { status: 400 })
  if (!sanitizeSegment(presenter)) {
    return NextResponse.json({ error: '이름으로 쓸 수 없는 문자입니다.' }, { status: 400 })
  }

  /* ---- empty slot ---- */

  // Explicit rather than inferred from a missing pdf: "only changing the
  // videos" also arrives without one, and must not be mistaken for this.
  if (payload.slotOnly === true) {
    if (await findSlot(meetingId, presenter)) {
      return NextResponse.json({ error: '이미 등록된 이름입니다.' }, { status: 409 })
    }
    const slot = await createEmptySlot(meetingId, presenter)
    return NextResponse.json({ id: slot.id }, { status: 201 })
  }

  /* ---- record a direct upload ---- */

  if (!usingVercelBlob) {
    return NextResponse.json(
      { error: '파일 등록은 Blob 업로드 환경에서만 쓰입니다.' },
      { status: 501 },
    )
  }

  const keepPdf = payload.keepPdf === true
  const keepVideoNames = Array.isArray(payload.keepVideos)
    ? payload.keepVideos.map((name) => String(name))
    : []

  const pdf = payload.pdf ? parseFile(payload.pdf) : null
  if (payload.pdf && !pdf) {
    return NextResponse.json({ error: 'PDF 정보가 올바르지 않습니다.' }, { status: 400 })
  }

  const rawVideos = Array.isArray(payload.videos) ? payload.videos : []
  const videos: StoredFile[] = []
  for (const raw of rawVideos) {
    const video = parseFile(raw)
    if (!video) return NextResponse.json({ error: '영상 정보가 올바르지 않습니다.' }, { status: 400 })
    videos.push(video)
  }

  try {
    const slot = await fillSlot({ meetingId, presenter, pdf, videos, keepPdf, keepVideoNames })
    return NextResponse.json({ id: slot.id }, { status: 201 })
  } catch (err) {
    console.error('failed to record presentation', err)
    return NextResponse.json({ error: '저장 중 오류가 발생했습니다.' }, { status: 500 })
  }
}
