import { randomUUID } from 'node:crypto'
import { NextResponse } from 'next/server'
import { addPresentation } from '@/lib/db'
import { putFile, safeFileName } from '@/lib/storage'
import type { Presentation, StoredFile } from '@/lib/types'

export const runtime = 'nodejs'
// Uploading a talk plus a couple of clips can take a while on lab wifi.
export const maxDuration = 60

const VIDEO_EXTENSIONS = ['mp4', 'webm', 'ogv', 'ogg', 'm4v', 'mov']
const MAX_VIDEO_BYTES = 500 * 1024 * 1024

function extensionOf(name: string) {
  return name.split('.').pop()?.toLowerCase() ?? ''
}

export async function POST(request: Request) {
  let form: FormData
  try {
    form = await request.formData()
  } catch {
    return NextResponse.json({ error: '업로드를 읽지 못했습니다. 파일이 너무 큰지 확인해 주세요.' }, { status: 400 })
  }

  const title = String(form.get('title') ?? '').trim()
  const presenter = String(form.get('presenter') ?? '').trim()
  const date = String(form.get('date') ?? '').trim()
  const pdf = form.get('pdf')

  if (!title) return NextResponse.json({ error: '제목을 입력해 주세요.' }, { status: 400 })
  if (!presenter) return NextResponse.json({ error: '발표자를 입력해 주세요.' }, { status: 400 })
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json({ error: '날짜 형식이 올바르지 않습니다.' }, { status: 400 })
  }
  if (!(pdf instanceof File) || pdf.size === 0) {
    return NextResponse.json({ error: 'PDF 파일을 선택해 주세요.' }, { status: 400 })
  }
  if (extensionOf(pdf.name) !== 'pdf') {
    return NextResponse.json({ error: '발표 자료는 PDF만 올릴 수 있습니다.' }, { status: 400 })
  }

  const videoFiles = form
    .getAll('videos')
    .filter((v): v is File => v instanceof File && v.size > 0)

  for (const video of videoFiles) {
    if (!VIDEO_EXTENSIONS.includes(extensionOf(video.name))) {
      return NextResponse.json(
        { error: `'${video.name}'은(는) 지원하지 않는 영상 형식입니다. (${VIDEO_EXTENSIONS.join(', ')})` },
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

  const id = randomUUID()

  const store = async (file: File): Promise<StoredFile> => {
    const name = safeFileName(file.name)
    const buffer = Buffer.from(await file.arrayBuffer())
    const url = await putFile(`${id}/${name}`, buffer, file.type || 'application/octet-stream')
    return { name, url, size: file.size, contentType: file.type || 'application/octet-stream' }
  }

  try {
    const storedPdf = await store(pdf)
    // Sequential rather than Promise.all: a few hundred MB of clips buffered
    // in memory at once is how a small box runs out of RAM.
    const storedVideos: StoredFile[] = []
    for (const video of videoFiles) storedVideos.push(await store(video))

    const presentation: Presentation = {
      id,
      title,
      presenter,
      date,
      pdf: storedPdf,
      videos: storedVideos,
      createdAt: new Date().toISOString(),
    }
    await addPresentation(presentation)
    return NextResponse.json({ id }, { status: 201 })
  } catch (err) {
    console.error('upload failed', err)
    return NextResponse.json({ error: '저장 중 오류가 발생했습니다.' }, { status: 500 })
  }
}
