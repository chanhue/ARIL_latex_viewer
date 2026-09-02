import { NextResponse } from 'next/server'
import { addPresentation, listPresentations } from '@/lib/db'
import type { Presentation, StoredFile } from '@/lib/types'

export const dynamic = 'force-dynamic'

export async function GET() {
  return NextResponse.json({ presentations: await listPresentations() })
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

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
    contentType: typeof file.contentType === 'string' ? file.contentType : 'application/octet-stream',
  }
}

/**
 * Records a presentation whose files are already in Blob storage — the second
 * half of the direct-upload flow. The multipart path (/api/upload) is what
 * local development uses instead.
 */
export async function POST(request: Request) {
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return NextResponse.json(
      { error: '이 엔드포인트는 Blob 업로드 환경에서만 쓰입니다.' },
      { status: 501 },
    )
  }

  let payload: Record<string, unknown>
  try {
    payload = await request.json()
  } catch {
    return NextResponse.json({ error: '잘못된 요청입니다.' }, { status: 400 })
  }

  const id = String(payload.id ?? '')
  const title = String(payload.title ?? '').trim()
  const presenter = String(payload.presenter ?? '').trim()
  const date = String(payload.date ?? '').trim()

  if (!UUID.test(id)) return NextResponse.json({ error: '잘못된 요청입니다.' }, { status: 400 })
  if (!title) return NextResponse.json({ error: '제목을 입력해 주세요.' }, { status: 400 })
  if (!presenter) return NextResponse.json({ error: '발표자를 입력해 주세요.' }, { status: 400 })
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json({ error: '날짜 형식이 올바르지 않습니다.' }, { status: 400 })
  }

  const pdf = parseFile(payload.pdf)
  if (!pdf) return NextResponse.json({ error: 'PDF 정보가 올바르지 않습니다.' }, { status: 400 })

  const rawVideos = Array.isArray(payload.videos) ? payload.videos : []
  const videos: StoredFile[] = []
  for (const raw of rawVideos) {
    const video = parseFile(raw)
    if (!video) return NextResponse.json({ error: '영상 정보가 올바르지 않습니다.' }, { status: 400 })
    videos.push(video)
  }

  const presentation: Presentation = {
    id,
    title,
    presenter,
    date,
    pdf,
    videos,
    createdAt: new Date().toISOString(),
  }

  try {
    await addPresentation(presentation)
    return NextResponse.json({ id }, { status: 201 })
  } catch (err) {
    console.error('failed to record presentation', err)
    return NextResponse.json({ error: '저장 중 오류가 발생했습니다.' }, { status: 500 })
  }
}
