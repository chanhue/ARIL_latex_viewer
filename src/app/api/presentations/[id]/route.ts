import { NextResponse } from 'next/server'
import { getPresentation, removePresentation } from '@/lib/db'
import { deletePresentationFiles } from '@/lib/storage'

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
  const removed = await removePresentation(id)
  if (!removed) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // Files go after the record: an orphaned blob is harmless, a record pointing
  // at a deleted file is a broken page.
  await deletePresentationFiles(id, [removed.pdf.url, ...removed.videos.map((v) => v.url)])
  return NextResponse.json({ ok: true })
}
