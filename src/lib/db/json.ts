import { promises as fs } from 'node:fs'
import path from 'node:path'
import type {
  Meeting,
  MeetingSummary,
  Presentation,
  PresentationWithMeeting,
} from '../types'

/**
 * JSON-file backend — the default for local development. No server to run, no
 * migrations, and the data is greppable.
 *
 * Not usable on Vercel: the filesystem is read-only and per-request, so writes
 * vanish. `./index.ts` switches to the Postgres backend when DATABASE_URL is
 * set.
 *
 * Writes are serialised through a promise chain so two uploads landing at the
 * same moment cannot interleave a read-modify-write and lose one of them.
 */

const DATA_DIR = path.join(process.cwd(), '.data')
const DB_FILE = path.join(DATA_DIR, 'db.json')

type Shape = { meetings: Meeting[]; presentations: Presentation[]; template: string[] }

let writeQueue: Promise<unknown> = Promise.resolve()

async function readAll(): Promise<Shape> {
  try {
    const raw = await fs.readFile(DB_FILE, 'utf8')
    const parsed = JSON.parse(raw) as Partial<Shape>
    return {
      meetings: parsed.meetings ?? [],
      presentations: parsed.presentations ?? [],
      template: parsed.template ?? [],
    }
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
      return { meetings: [], presentations: [], template: [] }
    }
    throw err
  }
}

async function writeAll(data: Shape): Promise<void> {
  await fs.mkdir(DATA_DIR, { recursive: true })
  // Write-then-rename so a crash mid-write cannot leave truncated JSON behind.
  const tmp = `${DB_FILE}.${process.pid}.tmp`
  await fs.writeFile(tmp, JSON.stringify(data, null, 2), 'utf8')
  await fs.rename(tmp, DB_FILE)
}

function transact<T>(fn: (data: Shape) => Promise<T> | T): Promise<T> {
  const next = writeQueue.then(async () => {
    const data = await readAll()
    const result = await fn(data)
    await writeAll(data)
    return result
  })
  // Keep the chain alive even if this transaction rejects.
  writeQueue = next.catch(() => {})
  return next
}

/* ------------------------------------------------------------- meetings */

export async function listMeetings(): Promise<MeetingSummary[]> {
  const { meetings, presentations } = await readAll()
  return meetings
    .slice()
    .sort((a, b) =>
      a.date === b.date ? b.createdAt.localeCompare(a.createdAt) : b.date.localeCompare(a.date),
    )
    .map((meeting) => {
      const slots = presentations.filter((p) => p.meetingId === meeting.id)
      const uploaded = slots.filter((p) => p.pdf)
      return {
        ...meeting,
        slotCount: slots.length,
        uploadedCount: uploaded.length,
        // Only people who actually uploaded. The list and the count on the
        // meeting list have to agree, and empty slots belong on the meeting
        // page where you can act on them.
        presenters: uploaded.map((p) => p.presenter),
      }
    })
}

export async function getMeeting(id: string): Promise<Meeting | null> {
  const { meetings } = await readAll()
  return meetings.find((m) => m.id === id) ?? null
}

export async function meetingTitles(): Promise<string[]> {
  const { meetings } = await readAll()
  return meetings.map((m) => m.title)
}

export async function addMeeting(meeting: Meeting): Promise<Meeting> {
  return transact((data) => {
    data.meetings.push(meeting)
    return meeting
  })
}

export async function removeMeeting(
  id: string,
): Promise<{ meeting: Meeting; presentations: Presentation[] } | null> {
  return transact((data) => {
    const index = data.meetings.findIndex((m) => m.id === id)
    if (index === -1) return null
    const [meeting] = data.meetings.splice(index, 1)

    const removed = data.presentations.filter((p) => p.meetingId === id)
    data.presentations = data.presentations.filter((p) => p.meetingId !== id)
    return { meeting, presentations: removed }
  })
}

/* -------------------------------------------------------- presentations */

export async function listPresentations(meetingId: string): Promise<Presentation[]> {
  const { presentations } = await readAll()
  return presentations
    .filter((p) => p.meetingId === meetingId)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
}

export async function getPresentation(id: string): Promise<PresentationWithMeeting | null> {
  const { meetings, presentations } = await readAll()
  const presentation = presentations.find((p) => p.id === id)
  if (!presentation) return null
  const meeting = meetings.find((m) => m.id === presentation.meetingId)
  if (!meeting) return null
  return { ...presentation, meeting }
}

export async function addPresentation(presentation: Presentation): Promise<Presentation> {
  return transact((data) => {
    data.presentations.push(presentation)
    return presentation
  })
}

export async function updatePresentation(
  id: string,
  patch: Partial<Omit<Presentation, 'id' | 'meetingId' | 'createdAt'>>,
): Promise<Presentation | null> {
  return transact((data) => {
    const presentation = data.presentations.find((p) => p.id === id)
    if (!presentation) return null
    Object.assign(presentation, patch, { updatedAt: new Date().toISOString() })
    return presentation
  })
}

export async function removePresentation(id: string): Promise<Presentation | null> {
  return transact((data) => {
    const index = data.presentations.findIndex((p) => p.id === id)
    if (index === -1) return null
    return data.presentations.splice(index, 1)[0]
  })
}

/* -------------------------------------------------------------- template */

export async function getTemplate(): Promise<string[]> {
  const { template } = await readAll()
  return template
}

export async function setTemplate(members: string[]): Promise<string[]> {
  return transact((data) => {
    data.template = members
    return members
  })
}
