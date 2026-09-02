import { NextResponse } from 'next/server'
import { getPresentation, removePresentation, updatePresentation } from '@/lib/db'
import { deleteFolder, deleteStoredFiles } from '@/lib/storage'
import { slotUrls } from '@/lib/slots'
import { sanitizeSegment } from '@/lib/meeting.mjs'
import type { StoredFile } from '@/lib/types'

export const dynamic = 'force-dynamic'

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const presentation = await getPresentation(id)
  if (!presentation) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json({ presentation })
}

/**
 * Empty a slot, keeping the person on the schedule.
 *
 * This is the only destructive action the meeting page offers. Removing a
 * person is deliberately not one: who presents comes from the roster template,
 * and an empty slot is a normal state rather than something to tidy away.
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
  if (payload.clearFiles !== true) {
    return NextResponse.json({ error: '잘못된 요청입니다.' }, { status: 400 })
  }

  const presentation = await getPresentation(id)
  if (!presentation) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const files = [presentation.pdf, ...presentation.videos].filter(
    (file): file is StoredFile => file !== null,
  )

  const updated = await updatePresentation(id, { pdf: null, videos: [] })
  if (!updated) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // Record first, files second: an orphaned file is clutter, a row pointing at
  // a deleted file is a broken page.
  if (files.length > 0) {
    await deleteStoredFiles(files).catch((err) =>
      console.error('failed to remove slot files', err),
    )
  }
  return NextResponse.json({ ok: true })
}

/**
 * Not reachable from the meeting page, which only ever clears files. Kept as
 * the way to undo a name added by mistake, since nothing else can remove one.
 */
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params

  // Read first: the meeting folder is needed to locate the files, and it is
  // gone from the join once the row is deleted.
  const presentation = await getPresentation(id)
  if (!presentation) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const removed = await removePresentation(id)
  if (!removed) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const folder = `${presentation.meeting.folder}/${sanitizeSegment(presentation.presenter)}`
  await deleteFolder(folder, slotUrls(removed))
  return NextResponse.json({ ok: true })
}
