import { NextResponse } from 'next/server'
import { getPresentation, removePresentation } from '@/lib/db'
import { deleteFolder } from '@/lib/storage'
import { slotUrls } from '@/lib/slots'
import { sanitizeSegment } from '@/lib/meeting.mjs'

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
