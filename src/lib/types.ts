export type StoredFile = {
  /** Original file name. This is what PDF links are matched against. */
  name: string
  /** Public URL the browser can fetch. Local: /api/files/... — Vercel: blob URL. */
  url: string
  size: number
  contentType: string
}

/**
 * A lab meeting has several presenters, taken from the roster template.
 * A seminar has exactly one, named when it is created. Everything else about
 * them — folders, slots, the viewer — is identical.
 */
export type MeetingKind = 'meeting' | 'seminar'

/**
 * One event — the "26.09.02 LAB Meeting" folder.
 */
export type Meeting = {
  id: string
  kind: MeetingKind
  /** YYYY-MM-DD */
  date: string
  /** Display name, auto-generated from the date. Unique across meetings. */
  title: string
  /** Storage path prefix, sanitised from the title. */
  folder: string
  /**
   * Presenter names in the order they will speak, empty until someone draws it.
   * Stored rather than computed so everyone in the room sees the same list.
   */
  order: string[]
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
  pdf: StoredFile | null
  videos: StoredFile[]
  createdAt: string
  updatedAt: string
}

export type MeetingSummary = Meeting & {
  /** How many people have uploaded — what the meeting list counts. */
  uploadedCount: number
}

/** A presentation together with the meeting it belongs to. */
export type PresentationWithMeeting = Presentation & { meeting: Meeting }

/**
 * The roster a new meeting is built from. One list for the whole site: a lab
 * has the same members week to week, so retyping the names every time is the
 * chore this removes.
 */
export type Template = { members: string[] }
