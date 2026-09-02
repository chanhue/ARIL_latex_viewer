import type {
  Meeting,
  MeetingSummary,
  Presentation,
  PresentationWithMeeting,
  StoredFile,
} from '../types'

/**
 * Postgres backend, used when DATABASE_URL is set — which on Vercel means a
 * Neon store attached to the project.
 *
 * Neon's serverless driver talks HTTP rather than holding a TCP connection, so
 * it survives serverless functions being frozen and thawed between requests.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

type MeetingRow = {
  id: string
  date: string
  title: string
  folder: string
  created_at: string | Date
}

type PresentationRow = {
  id: string
  meeting_id: string
  presenter: string
  title: string
  pdf: StoredFile | null
  videos: StoredFile[] | null
  created_at: string | Date
  updated_at: string | Date
}

let sqlPromise: Promise<any> | null = null
let schemaReady: Promise<void> | null = null

async function connect() {
  if (!sqlPromise) {
    sqlPromise = (async () => {
      const { neon } = await import('@neondatabase/serverless')
      return neon(process.env.DATABASE_URL as string)
    })()
  }
  return sqlPromise
}

/**
 * Two tables, created on first use. At this size a migration tool would be
 * more moving parts than the schema it manages.
 */
async function sql() {
  const query = await connect()
  if (!schemaReady) {
    schemaReady = (async () => {
      await query`
        CREATE TABLE IF NOT EXISTS meetings (
          id         TEXT PRIMARY KEY,
          date       TEXT NOT NULL,
          title      TEXT NOT NULL UNIQUE,
          folder     TEXT NOT NULL,
          created_at TIMESTAMPTZ NOT NULL DEFAULT now()
        )
      `
      await query`
        CREATE TABLE IF NOT EXISTS presentations (
          id         TEXT PRIMARY KEY,
          meeting_id TEXT NOT NULL REFERENCES meetings(id) ON DELETE CASCADE,
          presenter  TEXT NOT NULL,
          title      TEXT NOT NULL DEFAULT '',
          pdf        JSONB,
          videos     JSONB NOT NULL DEFAULT '[]'::jsonb,
          created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
        )
      `
      await query`CREATE INDEX IF NOT EXISTS meetings_date_idx ON meetings (date DESC)`
      await query`
        CREATE INDEX IF NOT EXISTS presentations_meeting_idx ON presentations (meeting_id)
      `
    })().catch((err) => {
      // Let the next request retry rather than caching the failure forever.
      schemaReady = null
      throw err
    })
  }
  await schemaReady
  return query
}

function toMeeting(row: MeetingRow): Meeting {
  return {
    id: row.id,
    date: row.date,
    title: row.title,
    folder: row.folder,
    createdAt: new Date(row.created_at).toISOString(),
  }
}

function toPresentation(row: PresentationRow): Presentation {
  return {
    id: row.id,
    meetingId: row.meeting_id,
    presenter: row.presenter,
    title: row.title ?? '',
    pdf: row.pdf ?? null,
    videos: row.videos ?? [],
    createdAt: new Date(row.created_at).toISOString(),
    updatedAt: new Date(row.updated_at).toISOString(),
  }
}

/* ------------------------------------------------------------- meetings */

export async function listMeetings(): Promise<MeetingSummary[]> {
  const query = await sql()
  const rows = (await query`
    SELECT m.*,
           COALESCE(p.slot_count, 0)    AS slot_count,
           COALESCE(p.uploaded_count, 0) AS uploaded_count,
           COALESCE(p.presenters, ARRAY[]::text[]) AS presenters
    FROM meetings m
    LEFT JOIN (
      SELECT meeting_id,
             COUNT(*)                              AS slot_count,
             COUNT(pdf)                            AS uploaded_count,
             ARRAY_AGG(presenter ORDER BY created_at) AS presenters
      FROM presentations
      GROUP BY meeting_id
    ) p ON p.meeting_id = m.id
    ORDER BY m.date DESC, m.created_at DESC
  `) as Array<MeetingRow & { slot_count: number; uploaded_count: number; presenters: string[] }>

  return rows.map((row) => ({
    ...toMeeting(row),
    slotCount: Number(row.slot_count),
    uploadedCount: Number(row.uploaded_count),
    presenters: row.presenters ?? [],
  }))
}

export async function getMeeting(id: string): Promise<Meeting | null> {
  const query = await sql()
  const rows = (await query`SELECT * FROM meetings WHERE id = ${id}`) as MeetingRow[]
  return rows[0] ? toMeeting(rows[0]) : null
}

export async function meetingTitles(): Promise<string[]> {
  const query = await sql()
  const rows = (await query`SELECT title FROM meetings`) as Array<{ title: string }>
  return rows.map((row) => row.title)
}

export async function addMeeting(meeting: Meeting): Promise<Meeting> {
  const query = await sql()
  await query`
    INSERT INTO meetings (id, date, title, folder, created_at)
    VALUES (${meeting.id}, ${meeting.date}, ${meeting.title}, ${meeting.folder}, ${meeting.createdAt})
  `
  return meeting
}

export async function removeMeeting(
  id: string,
): Promise<{ meeting: Meeting; presentations: Presentation[] } | null> {
  const query = await sql()
  // Read the children before the cascade removes them — the caller needs their
  // URLs to clean up blob storage.
  const children = (await query`
    SELECT * FROM presentations WHERE meeting_id = ${id}
  `) as PresentationRow[]

  const rows = (await query`
    DELETE FROM meetings WHERE id = ${id} RETURNING *
  `) as MeetingRow[]
  if (!rows[0]) return null

  return { meeting: toMeeting(rows[0]), presentations: children.map(toPresentation) }
}

/* -------------------------------------------------------- presentations */

export async function listPresentations(meetingId: string): Promise<Presentation[]> {
  const query = await sql()
  const rows = (await query`
    SELECT * FROM presentations WHERE meeting_id = ${meetingId} ORDER BY created_at
  `) as PresentationRow[]
  return rows.map(toPresentation)
}

export async function getPresentation(id: string): Promise<PresentationWithMeeting | null> {
  const query = await sql()
  const rows = (await query`
    SELECT p.*, row_to_json(m.*) AS meeting
    FROM presentations p
    JOIN meetings m ON m.id = p.meeting_id
    WHERE p.id = ${id}
  `) as Array<PresentationRow & { meeting: MeetingRow }>
  if (!rows[0]) return null
  return { ...toPresentation(rows[0]), meeting: toMeeting(rows[0].meeting) }
}

export async function addPresentation(presentation: Presentation): Promise<Presentation> {
  const query = await sql()
  await query`
    INSERT INTO presentations
      (id, meeting_id, presenter, title, pdf, videos, created_at, updated_at)
    VALUES (
      ${presentation.id}, ${presentation.meetingId}, ${presentation.presenter},
      ${presentation.title},
      ${presentation.pdf ? JSON.stringify(presentation.pdf) : null}::jsonb,
      ${JSON.stringify(presentation.videos)}::jsonb,
      ${presentation.createdAt}, ${presentation.updatedAt}
    )
  `
  return presentation
}

export async function updatePresentation(
  id: string,
  patch: Partial<Omit<Presentation, 'id' | 'meetingId' | 'createdAt'>>,
): Promise<Presentation | null> {
  const query = await sql()

  // Read-modify-write rather than a clever single UPDATE. Building the SET
  // clause conditionally with tagged templates cannot express "leave this
  // column alone" and "set it to NULL" as different things — an omitted value
  // arrives as NULL either way, which would silently wipe an uploaded PDF.
  // Merging in JS keeps the semantics identical to the JSON backend, where
  // `pdf: null` clears and an absent key leaves it be.
  const existingRows = (await query`
    SELECT * FROM presentations WHERE id = ${id}
  `) as PresentationRow[]
  if (!existingRows[0]) return null

  const current = toPresentation(existingRows[0])
  const merged: Presentation = {
    ...current,
    ...patch,
    updatedAt: new Date().toISOString(),
  }

  const rows = (await query`
    UPDATE presentations SET
      presenter  = ${merged.presenter},
      title      = ${merged.title},
      pdf        = ${merged.pdf ? JSON.stringify(merged.pdf) : null}::jsonb,
      videos     = ${JSON.stringify(merged.videos)}::jsonb,
      updated_at = ${merged.updatedAt}
    WHERE id = ${id}
    RETURNING *
  `) as PresentationRow[]
  return rows[0] ? toPresentation(rows[0]) : null
}

export async function removePresentation(id: string): Promise<Presentation | null> {
  const query = await sql()
  const rows = (await query`
    DELETE FROM presentations WHERE id = ${id} RETURNING *
  `) as PresentationRow[]
  return rows[0] ? toPresentation(rows[0]) : null
}
