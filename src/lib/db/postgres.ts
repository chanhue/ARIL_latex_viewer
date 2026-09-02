import type { Presentation, PresentationSummary, StoredFile } from '../types'

/**
 * Postgres backend, used when DATABASE_URL is set — which on Vercel means a
 * Neon store attached to the project.
 *
 * Neon's serverless driver talks HTTP rather than holding a TCP connection, so
 * it survives serverless functions being frozen and thawed between requests.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

type Row = {
  id: string
  title: string
  presenter: string
  date: string
  pdf: StoredFile
  videos: StoredFile[]
  created_at: string | Date
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
 * One table, created on first use. At this size a migration tool would be more
 * moving parts than the schema it manages.
 */
async function sql() {
  const query = await connect()
  if (!schemaReady) {
    schemaReady = (async () => {
      await query`
        CREATE TABLE IF NOT EXISTS presentations (
          id         TEXT PRIMARY KEY,
          title      TEXT NOT NULL,
          presenter  TEXT NOT NULL,
          date       TEXT NOT NULL,
          pdf        JSONB NOT NULL,
          videos     JSONB NOT NULL DEFAULT '[]'::jsonb,
          created_at TIMESTAMPTZ NOT NULL DEFAULT now()
        )
      `
      await query`CREATE INDEX IF NOT EXISTS presentations_date_idx ON presentations (date DESC)`
    })().catch((err) => {
      // Let the next request retry rather than caching the failure forever.
      schemaReady = null
      throw err
    })
  }
  await schemaReady
  return query
}

function toPresentation(row: Row): Presentation {
  return {
    id: row.id,
    title: row.title,
    presenter: row.presenter,
    date: row.date,
    pdf: row.pdf,
    videos: row.videos ?? [],
    createdAt: new Date(row.created_at).toISOString(),
  }
}

function summarise(p: Presentation): PresentationSummary {
  const { pdf, videos, ...rest } = p
  return { ...rest, pdfUrl: pdf.url, videoCount: videos.length }
}

export async function listPresentations(): Promise<PresentationSummary[]> {
  const query = await sql()
  const rows = (await query`
    SELECT * FROM presentations ORDER BY date DESC, created_at DESC
  `) as Row[]
  return rows.map((row) => summarise(toPresentation(row)))
}

export async function getPresentation(id: string): Promise<Presentation | null> {
  const query = await sql()
  const rows = (await query`SELECT * FROM presentations WHERE id = ${id}`) as Row[]
  return rows[0] ? toPresentation(rows[0]) : null
}

export async function addPresentation(p: Presentation): Promise<Presentation> {
  const query = await sql()
  await query`
    INSERT INTO presentations (id, title, presenter, date, pdf, videos, created_at)
    VALUES (
      ${p.id}, ${p.title}, ${p.presenter}, ${p.date},
      ${JSON.stringify(p.pdf)}::jsonb, ${JSON.stringify(p.videos)}::jsonb, ${p.createdAt}
    )
  `
  return p
}

export async function removePresentation(id: string): Promise<Presentation | null> {
  const query = await sql()
  const rows = (await query`
    DELETE FROM presentations WHERE id = ${id} RETURNING *
  `) as Row[]
  return rows[0] ? toPresentation(rows[0]) : null
}
