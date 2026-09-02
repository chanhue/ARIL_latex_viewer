import { promises as fs } from 'node:fs'
import path from 'node:path'
import type { Presentation, PresentationSummary } from '../types'

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

type Shape = { presentations: Presentation[] }

let writeQueue: Promise<unknown> = Promise.resolve()

async function readAll(): Promise<Shape> {
  try {
    const raw = await fs.readFile(DB_FILE, 'utf8')
    const parsed = JSON.parse(raw) as Partial<Shape>
    return { presentations: parsed.presentations ?? [] }
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return { presentations: [] }
    throw err
  }
}

async function writeAll(data: Shape): Promise<void> {
  await fs.mkdir(DATA_DIR, { recursive: true })
  // Write-then-rename so a crash mid-write cannot leave truncated JSON behind.
  const tmp = DB_FILE + '.' + process.pid + '.tmp'
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

function summarise(p: Presentation): PresentationSummary {
  const { pdf, videos, ...rest } = p
  return { ...rest, pdfUrl: pdf.url, videoCount: videos.length }
}

export async function listPresentations(): Promise<PresentationSummary[]> {
  const { presentations } = await readAll()
  return presentations
    .slice()
    .sort((a, b) => (a.date === b.date ? b.createdAt.localeCompare(a.createdAt) : b.date.localeCompare(a.date)))
    .map(summarise)
}

export async function getPresentation(id: string): Promise<Presentation | null> {
  const { presentations } = await readAll()
  return presentations.find((p) => p.id === id) ?? null
}

export async function addPresentation(p: Presentation): Promise<Presentation> {
  return transact((data) => {
    data.presentations.push(p)
    return p
  })
}

export async function removePresentation(id: string): Promise<Presentation | null> {
  return transact((data) => {
    const index = data.presentations.findIndex((p) => p.id === id)
    if (index === -1) return null
    return data.presentations.splice(index, 1)[0]
  })
}
