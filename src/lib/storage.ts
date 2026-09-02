import { promises as fs } from 'node:fs'
import path from 'node:path'

/**
 * Two backends behind one interface:
 *   - local disk  (default, no configuration, what `npm run dev` uses)
 *   - Vercel Blob (when BLOB_READ_WRITE_TOKEN is present)
 *
 * Everything else in the app only ever sees the returned public URL, so the
 * two are interchangeable.
 */

const DATA_DIR = path.join(process.cwd(), '.data')
const BLOB_DIR = path.join(DATA_DIR, 'blobs')

/**
 * Find the Blob read-write token.
 *
 * Normally this is `BLOB_READ_WRITE_TOKEN`, injected when a store is connected
 * to the project. But Vercel lets you set a prefix on the store's variables in
 * Advanced Options, which produces e.g. `SLIDES_BLOB_READ_WRITE_TOKEN` — so
 * fall back to any variable ending in that name rather than silently dropping
 * to the local-disk path, which cannot work on Vercel at all.
 */
export function blobToken(): string | null {
  const direct = process.env.BLOB_READ_WRITE_TOKEN
  if (direct) return direct

  for (const [key, value] of Object.entries(process.env)) {
    if (value && key.endsWith('BLOB_READ_WRITE_TOKEN')) return value
  }
  return null
}

export const usingVercelBlob = Boolean(blobToken())

/** Strip anything that could escape the storage directory. */
export function safeFileName(name: string): string {
  const base = path
    .basename(String(name))
    .replace(/[\u0000-\u001f\u007f]/g, '')
    .replace(/[/\\]/g, '')
  const cleaned = base.replace(/^\.+/, '').trim()
  return cleaned || 'file'
}

export async function putFile(
  key: string,
  data: Buffer,
  contentType: string,
): Promise<string> {
  if (usingVercelBlob) {
    // Optional dependency: only needed for a Vercel deployment.
    const { put } = await import('@vercel/blob')
    const blob = await put(key, data, {
      access: 'public',
      contentType,
      addRandomSuffix: false,
      token: blobToken() ?? undefined,
    })
    return blob.url
  }

  const dest = path.join(BLOB_DIR, key)
  await fs.mkdir(path.dirname(dest), { recursive: true })
  await fs.writeFile(dest, data)
  // Encode each segment so spaces and Hangul survive the round trip.
  return '/api/files/' + key.split('/').map(encodeURIComponent).join('/')
}

/** Resolve a stored key to an absolute path, refusing anything outside BLOB_DIR. */
export function localPathFor(segments: string[]): string | null {
  const resolved = path.resolve(BLOB_DIR, ...segments)
  const root = path.resolve(BLOB_DIR)
  if (resolved !== root && !resolved.startsWith(root + path.sep)) return null
  return resolved
}

/**
 * Remove a whole folder of uploads.
 *
 * @param prefix storage path of the folder, e.g. `26.09.02 LAB Meeting/김찬희`
 * @param urls   the public URLs of everything inside it
 *
 * Blob has no directories, so there the URLs are what gets deleted; locally the
 * folder is removed outright, which also sweeps up anything the database lost
 * track of.
 */
export async function deleteFolder(prefix: string, urls: string[]): Promise<void> {
  if (usingVercelBlob) {
    const { del } = await import('@vercel/blob')
    if (urls.length) await del(urls, { token: blobToken() ?? undefined })
    return
  }

  const target = localPathFor(prefix.split('/'))
  if (!target) return
  await fs.rm(target, { recursive: true, force: true })
}
