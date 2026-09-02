export type StoredFile = {
  /** Original file name. This is what PDF links are matched against. */
  name: string
  /** Public URL the browser can fetch. Local: /api/files/... — Vercel: blob URL. */
  url: string
  size: number
  contentType: string
}

/**
 * One lab meeting — the "26.09.02 LAB Meeting" folder.
 */
export type Meeting = {
  id: string
  /** YYYY-MM-DD */
  date: string
  /** Display name, auto-generated from the date. Unique across meetings. */
  title: string
  /** Storage path prefix, sanitised from the title. */
  folder: string
  createdAt: string
}

/**
 * One person's slot inside a meeting.
 *
 * `pdf: null` is an empty slot — the meeting was set up with this person's name
 * but they have not uploaded yet. That distinction is the whole point of
 * pre-registering names: the meeting page can show who is still missing.
 */
export type Presentation = {
  id: string
  meetingId: string
  presenter: string
  /** Optional talk title; empty string when the presenter did not give one. */
  title: string
  pdf: StoredFile | null
  videos: StoredFile[]
  createdAt: string
  updatedAt: string
}

export type MeetingSummary = Meeting & {
  /** How many people have a slot, and how many of those have uploaded. */
  slotCount: number
  uploadedCount: number
  presenters: string[]
}

/** A presentation together with the meeting it belongs to. */
export type PresentationWithMeeting = Presentation & { meeting: Meeting }
