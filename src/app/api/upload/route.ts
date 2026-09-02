import { NextResponse } from 'next/server'
import { getMeeting } from '@/lib/db'
import { fillSlot } from '@/lib/slots'
import { putFile, safeFileName, usingVercelBlob } from '@/lib/storage'
import { sanitizeSegment, storageKey } from '@/lib/meeting.mjs'
import type { StoredFile } from '@/lib/types'

export const runtime = 'nodejs'
// Uploading a talk plus a couple of clips can take a while on lab wifi.
export const maxDuration = 60

const VIDEO_EXTENSIONS = ['mp4', 'webm', 'ogv', 'ogg', 'm4v', 'mov']
const MAX_VIDEO_BYTES = 500 * 1024 * 1024

function extensionOf(name: string) {
  return name.split('.').pop()?.toLowerCase() ?? ''
}

/**
 * Vercel's filesystem is read-only, so this route cannot work there. Say so
 * plainly instead of letting the write fail deep inside and surfacing as a
 * generic "could not save" — the fix is a configuration change, and the
 * message should name it.
 */
function misconfigured(): string | null {
  if (!process.env.VERCEL) return null
  if (!usingVercelBlob) {
    return 'Vercel에 Blob 스토어가 연결되어 있지 않아 파일을 저장할 수 없습니다. Storage 탭에서 Blob(Public)을 추가한 뒤 재배포해 주세요.'
  }
  return null
}

/**
 * Multipart upload into a person's slot. Used when the app is running against
 * local disk; on Vercel the browser uploads to Blob directly instead, because
 * a serverless function may only receive 4.5MB of request body.
 */
export async function POST(request: Request) {
  const problem = misconfigured()
  if (problem) return NextResponse.json({ error: problem }, { status: 503 })

  let form: FormData
  try {
    form = await request.formData()
  } catch {
    return NextResponse.json(
      { error: '업로드를 읽지 못했습니다. 파일이 너무 큰지 확인해 주세요.' },
      { status: 400 },
    )
  }

  const meetingId = String(form.get('meetingId') ?? '')
  const presenter = String(form.get('presenter') ?? '').trim()
  const pdf = form.get('pdf')

  const meeting = await getMeeting(meetingId)
  if (!meeting) return NextResponse.json({ error: '랩미팅을 찾을 수 없습니다.' }, { status: 404 })

  if (!presenter) return NextResponse.json({ error: '이름을 입력해 주세요.' }, { status: 400 })
  if (!sanitizeSegment(presenter)) {
    return NextResponse.json({ error: '이름으로 쓸 수 없는 문자입니다.' }, { status: 400 })
  }
  if (!(pdf instanceof File) || pdf.size === 0) {
    return NextResponse.json({ error: 'PDF 파일을 선택해 주세요.' }, { status: 400 })
  }
  if (extensionOf(pdf.name) !== 'pdf') {
    return NextResponse.json({ error: '발표 자료는 PDF만 올릴 수 있습니다.' }, { status: 400 })
  }

  const videoFiles = form
    .getAll('videos')
    .filter((value): value is File => value instanceof File && value.size > 0)

  for (const video of videoFiles) {
    if (!VIDEO_EXTENSIONS.includes(extensionOf(video.name))) {
      return NextResponse.json(
        {
          error: `'${video.name}'은(는) 지원하지 않는 영상 형식입니다. (${VIDEO_EXTENSIONS.join(', ')})`,
        },
        { status: 400 },
      )
    }
    if (video.size > MAX_VIDEO_BYTES) {
      return NextResponse.json(
        { error: `'${video.name}'이(가) 너무 큽니다. 영상 한 개는 500MB까지 올릴 수 있습니다.` },
        { status: 400 },
      )
    }
  }

  const store = async (file: File, kind: 'pdf' | 'video'): Promise<StoredFile> => {
    const name = safeFileName(file.name)
    const key = storageKey({ meetingFolder: meeting.folder, presenter, fileName: name, kind })
    if (!key) throw new Error(`could not build a storage path for ${name}`)

    const buffer = Buffer.from(await file.arrayBuffer())
    const contentType = file.type || 'application/octet-stream'
    const url = await putFile(key, buffer, contentType)
    return { name, url, size: file.size, contentType }
  }

  try {
    const storedPdf = await store(pdf, 'pdf')
    // Sequential rather than Promise.all: a few hundred MB of clips buffered
    // in memory at once is how a small box runs out of RAM.
    const storedVideos: StoredFile[] = []
    for (const video of videoFiles) storedVideos.push(await store(video, 'video'))

    const slot = await fillSlot({
      meetingId,
      presenter,
      pdf: storedPdf,
      videos: storedVideos,
    })
    return NextResponse.json({ id: slot.id }, { status: 201 })
  } catch (err) {
    console.error('upload failed', err)
    const detail = err instanceof Error ? err.message : String(err)
    // Read-only filesystem is the one failure here with an actionable cause.
    if (/EROFS|read-only/i.test(detail)) {
      return NextResponse.json(
        { error: '파일을 저장할 수 없습니다. 이 환경은 디스크 쓰기가 불가능합니다 (Blob 스토어 연결 필요).' },
        { status: 503 },
      )
    }
    return NextResponse.json({ error: `저장 중 오류가 발생했습니다: ${detail}` }, { status: 500 })
  }
}
