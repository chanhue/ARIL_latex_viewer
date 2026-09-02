import { NextResponse } from 'next/server'

/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * Hands the browser a short-lived token so it can PUT straight to Vercel Blob.
 *
 * This exists because a serverless function may only receive 4.5MB of request
 * body — a 200MB result clip cannot pass through the server at all. The file
 * goes browser -> Blob directly, and only the resulting URL comes back to us.
 *
 * Unused locally: without BLOB_READ_WRITE_TOKEN the app posts files to
 * /api/upload instead.
 */

const ALLOWED_CONTENT_TYPES = [
  'application/pdf',
  'video/mp4',
  'video/webm',
  'video/ogg',
  'video/quicktime',
  'video/x-m4v',
]

const MAX_BYTES = 500 * 1024 * 1024

export async function POST(request: Request) {
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return NextResponse.json(
      { error: 'Blob 업로드가 설정되지 않았습니다.' },
      { status: 501 },
    )
  }

  // Dynamic so the package stays optional for local installs.
  const { handleUpload } = (await import('@vercel/blob/client')) as any
  const body = await request.json()

  try {
    const result = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async () => ({
        allowedContentTypes: ALLOWED_CONTENT_TYPES,
        maximumSizeInBytes: MAX_BYTES,
        // Paths are already namespaced by a per-presentation UUID, and the
        // file name has to survive verbatim for link matching to work.
        addRandomSuffix: false,
      }),
      // Nothing to do: the record is written by POST /api/presentations once
      // every file has landed.
      onUploadCompleted: async () => {},
    })
    return NextResponse.json(result)
  } catch (err) {
    console.error('blob token failed', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : '업로드 토큰 발급에 실패했습니다.' },
      { status: 400 },
    )
  }
}
