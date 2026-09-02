import type {
  Meeting,
  MeetingSummary,
  Presentation,
  PresentationWithMeeting,
} from '../types'

/**
 * Picks a backend from the environment, so the same code runs unconfigured on
 * a laptop and on Vercel:
 *
 *   DATABASE_URL set  -> Postgres (Neon)
 *   otherwise         -> ./.data/db.json
 *
 * Both modules export the same functions; nothing else in the app knows which
 * one it is talking to.
 */

export const usingPostgres = Boolean(process.env.DATABASE_URL)

type Backend = {
  listMeetings: () => Promise<MeetingSummary[]>
  getMeeting: (id: string) => Promise<Meeting | null>
  meetingTitles: () => Promise<string[]>
  addMeeting: (meeting: Meeting) => Promise<Meeting>
  setMeetingOrder: (id: string, order: string[]) => Promise<Meeting | null>
  removeMeeting: (
    id: string,
  ) => Promise<{ meeting: Meeting; presentations: Presentation[] } | null>

  listPresentations: (meetingId: string) => Promise<Presentation[]>
  getPresentation: (id: string) => Promise<PresentationWithMeeting | null>
  addPresentation: (presentation: Presentation) => Promise<Presentation>
  updatePresentation: (
    id: string,
    patch: Partial<Omit<Presentation, 'id' | 'meetingId' | 'createdAt'>>,
  ) => Promise<Presentation | null>
  removePresentation: (id: string) => Promise<Presentation | null>

  getTemplate: () => Promise<string[]>
  setTemplate: (members: string[]) => Promise<string[]>
}

// Loaded lazily so the unused backend's driver is never imported — that keeps
// @neondatabase/serverless genuinely optional for local use.
let backendPromise: Promise<Backend> | null = null

function backend(): Promise<Backend> {
  if (!backendPromise) {
    backendPromise = usingPostgres ? import('./postgres') : import('./json')
  }
  return backendPromise
}

export async function listMeetings() {
  return (await backend()).listMeetings()
}

export async function getMeeting(id: string) {
  return (await backend()).getMeeting(id)
}

export async function meetingTitles() {
  return (await backend()).meetingTitles()
}

export async function addMeeting(meeting: Meeting) {
  return (await backend()).addMeeting(meeting)
}

export async function setMeetingOrder(id: string, order: string[]) {
  return (await backend()).setMeetingOrder(id, order)
}

export async function removeMeeting(id: string) {
  return (await backend()).removeMeeting(id)
}

export async function listPresentations(meetingId: string) {
  return (await backend()).listPresentations(meetingId)
}

export async function getPresentation(id: string) {
  return (await backend()).getPresentation(id)
}

export async function addPresentation(presentation: Presentation) {
  return (await backend()).addPresentation(presentation)
}

export async function updatePresentation(
  id: string,
  patch: Partial<Omit<Presentation, 'id' | 'meetingId' | 'createdAt'>>,
) {
  return (await backend()).updatePresentation(id, patch)
}

export async function removePresentation(id: string) {
  return (await backend()).removePresentation(id)
}

export async function getTemplate() {
  return (await backend()).getTemplate()
}

export async function setTemplate(members: string[]) {
  return (await backend()).setTemplate(members)
}
