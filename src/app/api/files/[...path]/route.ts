import { createReadStream } from 'node:fs'
import { promises as fs } from 'node:fs'
import { Readable } from 'node:stream'
import { NextResponse } from 'next/server'
import { localPathFor } from '@/lib/storage'
import { parseRange } from '@/lib/http-range.mjs'

/**
 * Serves files written by the local storage backend. On Vercel this route is
 * never hit — Blob URLs point straight at Vercel's CDN.
 *
 * Range support is not optional here: without it Chrome and Safari refuse to
 * seek in a <video>, and scrubbing a result clip mid-talk is the whole point.
 */

const CONTENT_TYPES: Record<string, string> = {
  pdf: 'application/pdf',
  mp4: 'video/mp4',
  m4v: 'video/mp4',
  webm: 'video/webm',
  ogv: 'video/ogg',
  ogg: 'video/ogg',
  mov: 'video/quicktime',
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  gif: 'image/gif',
}

function contentTypeFor(name: string): string {
  const ext = name.split('.').pop()?.toLowerCase() ?? ''
  return CONTENT_TYPES[ext] ?? 'application/octet-stream'
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ path: string[] }> },
) {
  const { path: segments } = await params
  const decoded = segments.map((s) => decodeURIComponent(s))
  const filePath = localPathFor(decoded)
  if (!filePath) return new NextResponse('Forbidden', { status: 403 })

  let stat
  try {
    stat = await fs.stat(filePath)
  } catch {
    return new NextResponse('Not found', { status: 404 })
  }
  if (!stat.isFile()) return new NextResponse('Not found', { status: 404 })

  const contentType = contentTypeFor(decoded[decoded.length - 1] ?? '')
  const baseHeaders = {
    'Content-Type': contentType,
    'Accept-Ranges': 'bytes',
    'Cache-Control': 'public, max-age=31536000, immutable',
  }

  const range = parseRange(request.headers.get('range'), stat.size)

  if (range && 'unsatisfiable' in range) {
    return new NextResponse('Range not satisfiable', {
      status: 416,
      headers: { ...baseHeaders, 'Content-Range': `bytes */${stat.size}` },
    })
  }

  if (range) {
    const stream = createReadStream(filePath, { start: range.start, end: range.end })
    return new NextResponse(Readable.toWeb(stream) as unknown as ReadableStream, {
      status: 206,
      headers: {
        ...baseHeaders,
        'Content-Range': `bytes ${range.start}-${range.end}/${stat.size}`,
        'Content-Length': String(range.end - range.start + 1),
      },
    })
  }

  const stream = createReadStream(filePath)
  return new NextResponse(Readable.toWeb(stream) as unknown as ReadableStream, {
    status: 200,
    headers: { ...baseHeaders, 'Content-Length': String(stat.size) },
  })
}
