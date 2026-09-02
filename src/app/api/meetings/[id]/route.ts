import { NextResponse } from 'next/server'
import { getMeeting, listPresentations, removeMeeting } from '@/lib/db'
import { deleteFolder } from '@/lib/storage'
import { slotUrls } from '@/lib/slots'

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
