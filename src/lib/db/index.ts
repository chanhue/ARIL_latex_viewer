import type { Presentation, PresentationSummary } from '../types'

/**
 * Picks a backend from the environment, so the same code runs unconfigured on
 * a laptop and on Vercel:
 *
 *   DATABASE_URL set  -> Postgres (Neon)
 *   otherwise         -> ./.data/db.json
 *
 * Both modules export the same five functions; nothing else in the app knows
 * which one it is talking to.
 */

export const usingPostgres = Boolean(process.env.DATABASE_URL)

type Backend = {
  listPresentations: () => Promise<PresentationSummary[]>
  getPresentation: (id: string) => Promise<Presentation | null>
  addPresentation: (p: Presentation) => Promise<Presentation>
  removePresentation: (id: string) => Promise<Presentation | null>
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

export async function listPresentations(): Promise<PresentationSummary[]> {
  return (await backend()).listPresentations()
}

export async function getPresentation(id: string): Promise<Presentation | null> {
  return (await backend()).getPresentation(id)
}

export async function addPresentation(p: Presentation): Promise<Presentation> {
  return (await backend()).addPresentation(p)
}

export async function removePresentation(id: string): Promise<Presentation | null> {
  return (await backend()).removePresentation(id)
}
