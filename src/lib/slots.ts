import { randomUUID } from 'node:crypto'
import { addPresentation, listPresentations, updatePresentation } from '@/lib/db'
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
 * Re-uploading replaces what was there. That is the behaviour people expect
 * when they notice a typo ten minutes before the meeting.
 */
export async function fillSlot(options: {
  meetingId: string
  presenter: string
  pdf: StoredFile
  videos: StoredFile[]
}): Promise<Presentation> {
  const existing = await findSlot(options.meetingId, options.presenter)
  const now = new Date().toISOString()

  if (existing) {
    const updated = await updatePresentation(existing.id, {
      presenter: options.presenter,
      pdf: options.pdf,
      videos: options.videos,
    })
    if (updated) return updated
  }

  const presentation: Presentation = {
    id: randomUUID(),
    meetingId: options.meetingId,
    presenter: options.presenter,
    pdf: options.pdf,
    videos: options.videos,
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
