import { randomUUID } from 'node:crypto'
import { addPresentation, listPresentations, updatePresentation } from '@/lib/db'
import { deleteStoredFiles } from '@/lib/storage'
import { sanitizeSegment } from '@/lib/meeting.mjs'
import type { Presentation, StoredFile } from '@/lib/types'

/**
 * Find the slot a person already has in a meeting.
 *
 * Names are compared the way folders are, so "홍 길동" and "홍  길동" are the
 * same person — otherwise two slots would fight over one storage folder.
 */
export async function findSlot(
  meetingId: string,
  presenter: string,
): Promise<Presentation | null> {
  const target = sanitizeSegment(presenter).toLowerCase()
  if (!target) return null
  const slots = await listPresentations(meetingId)
  return slots.find((slot) => sanitizeSegment(slot.presenter).toLowerCase() === target) ?? null
}

/**
 * Put a person's files into their slot, creating the slot if this is the first
 * time they have uploaded.
 *
 * `keepPdf` and `keepVideoNames` say which of the files already there survive.
 * That is what makes re-uploading a partial edit — swap one clip, leave the
 * slides alone — instead of an all-or-nothing replacement. A newly uploaded
 * file with the same name as a kept one wins, since that is plainly an
 * intentional overwrite.
 *
 * Files that end up referenced by nothing are deleted from storage; otherwise
 * every correction would leave a copy behind that nobody can reach or clean up.
 *
 * A slot may end up with no PDF at all. That is a real state — someone puts the
 * clips up on Monday and the slides on Thursday — and the meeting page and the
 * viewer both already handle it.
 */
export async function fillSlot(options: {
  meetingId: string
  presenter: string
  pdf: StoredFile | null
  videos: StoredFile[]
  keepPdf?: boolean
  keepVideoNames?: string[]
}): Promise<Presentation> {
  const existing = await findSlot(options.meetingId, options.presenter)
  const now = new Date().toISOString()

  const keepPdf = options.keepPdf ?? false
  const keepNames = new Set((options.keepVideoNames ?? []).map((name) => name.toLowerCase()))

  const survivingPdf = keepPdf ? (existing?.pdf ?? null) : null
  const pdf = options.pdf ?? survivingPdf

  const incomingNames = new Set(options.videos.map((video) => video.name.toLowerCase()))
  const keptVideos = (existing?.videos ?? []).filter(
    (video) =>
      keepNames.has(video.name.toLowerCase()) && !incomingNames.has(video.name.toLowerCase()),
  )
  const videos = [...keptVideos, ...options.videos]

  if (existing) {
    const stillUsed = new Set(
      [pdf?.url, ...videos.map((video) => video.url)].filter(Boolean) as string[],
    )
    const orphaned = [existing.pdf, ...existing.videos].filter(
      (file): file is StoredFile => Boolean(file) && !stillUsed.has(file!.url),
    )

    const updated = await updatePresentation(existing.id, {
      presenter: options.presenter,
      pdf,
      videos,
    })

    // After the record, never before: a file deleted while the row still points
    // at it is a broken page, whereas an undeleted file is only clutter.
    if (updated && orphaned.length > 0) {
      await deleteStoredFiles(orphaned).catch((err) =>
        console.error('failed to remove replaced files', err),
      )
    }
    if (updated) return updated
  }

  const presentation: Presentation = {
    id: randomUUID(),
    meetingId: options.meetingId,
    presenter: options.presenter,
    pdf,
    videos,
    createdAt: now,
    updatedAt: now,
  }
  return addPresentation(presentation)
}

/** Register a name with no files yet, so the meeting page shows who is missing. */
export async function createEmptySlot(
  meetingId: string,
  presenter: string,
): Promise<Presentation> {
  const now = new Date().toISOString()
  const presentation: Presentation = {
    id: randomUUID(),
    meetingId,
    presenter,
    pdf: null,
    videos: [],
    createdAt: now,
    updatedAt: now,
  }
  return addPresentation(presentation)
}

/** Every file URL belonging to a slot, for cleaning up storage. */
export function slotUrls(presentation: Presentation): string[] {
  const urls = presentation.videos.map((video) => video.url)
  if (presentation.pdf) urls.unshift(presentation.pdf.url)
  return urls
}

/**
 * Display order for a meeting: people who have uploaded first, then everyone
 * else, each group alphabetical.
 *
 * Reading the list during a meeting means finding the next deck, so what is
 * actually there comes first; the empty slots stay visible underneath as the
 * list of who still owes something. Alphabetical within each group because
 * upload order is arbitrary and shifts under you as people submit.
 */
export function sortSlots(slots: Presentation[]): Presentation[] {
  return slots.slice().sort((a, b) => {
    const filled = Number(Boolean(b.pdf)) - Number(Boolean(a.pdf))
    if (filled !== 0) return filled
    return a.presenter.localeCompare(b.presenter, 'ko')
  })
}
