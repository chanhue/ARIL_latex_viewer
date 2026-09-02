'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useMemo, useState } from 'react'
import { sanitizeSegment, storageKey } from '@/lib/meeting.mjs'
import type { Meeting, StoredFile } from '@/lib/types'

/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * Two upload paths behind one form:
 *
 *   'blob'      each file goes browser -> Vercel Blob directly, then the
 *               metadata is recorded. Required on Vercel, where a serverless
 *               function may only receive 4.5MB of request body.
 *   'multipart' everything is posted to /api/upload, which writes to disk.
 *               The local default.
 *
 * Either way the files land under `<meeting folder>/<presenter>/`, with videos
 * in a `figs/` subfolder.
 */
export type UploadMode = 'blob' | 'multipart'

export type ExistingSlot = {
  presenter: string
  pdf: StoredFile | null
  videos: StoredFile[]
}

function formatSize(bytes: number) {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

export function UploadForm({
  mode,
  meeting,
  slots,
  initialPresenter,
}: {
  mode: UploadMode
  meeting: Meeting
  /** Everyone in this meeting who already has files, so the panel can follow
      the name field as it is edited. */
  slots: ExistingSlot[]
  initialPresenter: string
}) {
  const router = useRouter()

  const [presenter, setPresenter] = useState(initialPresenter)
  const [pdf, setPdf] = useState<File | null>(null)
  const [videos, setVideos] = useState<File[]>([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [progress, setProgress] = useState<Record<string, number>>({})

  // Marked for deletion, applied when the form is saved.
  const [dropPdf, setDropPdf] = useState(false)
  const [droppedVideos, setDroppedVideos] = useState<string[]>([])

  const existing = useMemo(() => {
    const key = sanitizeSegment(presenter).toLowerCase()
    if (!key) return null
    return slots.find((slot) => sanitizeSegment(slot.presenter).toLowerCase() === key) ?? null
  }, [presenter, slots])

  // Typing a different name means a different person's files; anything marked
  // for deletion on the previous one no longer applies.
  useEffect(() => {
    setDropPdf(false)
    setDroppedVideos([])
  }, [existing?.presenter])

  const keepPdf = Boolean(existing?.pdf) && !dropPdf
  const keptVideoNames = (existing?.videos ?? [])
    .filter((video) => !droppedVideos.includes(video.name))
    .map((video) => video.name)

  const totalSize = useMemo(
    () => (pdf?.size ?? 0) + videos.reduce((sum, v) => sum + v.size, 0),
    [pdf, videos],
  )

  const addVideos = (incoming: FileList | null) => {
    if (!incoming) return
    setVideos((current) => {
      const next = [...current]
      for (const file of Array.from(incoming)) {
        // The same name twice would make link matching ambiguous.
        if (!next.some((v) => v.name.toLowerCase() === file.name.toLowerCase())) next.push(file)
      }
      return next
    })
  }

  /* ------------------------------------------------- browser -> Blob */

  const uploadDirect = async (file: File, kind: 'pdf' | 'video'): Promise<StoredFile> => {
    const key = storageKey({
      meetingFolder: meeting.folder,
      presenter,
      fileName: file.name,
      kind,
    })
    if (!key) throw new Error(`'${file.name}' 의 저장 경로를 만들 수 없습니다.`)

    const { upload } = (await import('@vercel/blob/client')) as any
    const blob = await upload(key, file, {
      access: 'public',
      handleUploadUrl: '/api/blob-upload',
      contentType: file.type || undefined,
      onUploadProgress: (event: { percentage: number }) => {
        setProgress((current) => ({ ...current, [file.name]: Math.round(event.percentage) }))
      },
    })
    return {
      name: file.name,
      url: blob.url,
      size: file.size,
      contentType: file.type || 'application/octet-stream',
    }
  }

  const submitViaBlob = async () => {
    // Sequential: parallel uploads of several hundred MB just fight each other
    // for the same uplink and make the progress bars meaningless.
    const storedPdf = pdf ? await uploadDirect(pdf, 'pdf') : null
    const storedVideos: StoredFile[] = []
    for (const video of videos) storedVideos.push(await uploadDirect(video, 'video'))

    const response = await fetch('/api/presentations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        meetingId: meeting.id,
        presenter,
        pdf: storedPdf ?? undefined,
        videos: storedVideos,
        keepPdf,
        keepVideos: keptVideoNames,
      }),
    })
    const payload = await response.json().catch(() => ({}))
    if (!response.ok) throw new Error(payload.error ?? '저장에 실패했습니다.')
    return payload.id as string
  }

  /* -------------------------------------------------- multipart POST */

  const submitViaMultipart = async () => {
    const body = new FormData()
    body.set('meetingId', meeting.id)
    body.set('presenter', presenter)
    body.set('keepPdf', keepPdf ? '1' : '0')
    for (const name of keptVideoNames) body.append('keepVideos', name)
    if (pdf) body.set('pdf', pdf)
    for (const video of videos) body.append('videos', video)

    const response = await fetch('/api/upload', { method: 'POST', body })
    const payload = await response.json().catch(() => ({}))
    if (!response.ok) throw new Error(payload.error ?? '업로드에 실패했습니다.')
    return payload.id as string
  }

  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    setError('')

    if (!presenter.trim()) {
      setError('이름을 입력해 주세요.')
      return
    }
    if (!pdf && !keepPdf) {
      setError('PDF 파일을 선택해 주세요.')
      return
    }

    setBusy(true)
    setProgress({})
    try {
      const id = mode === 'blob' ? await submitViaBlob() : await submitViaMultipart()
      router.push(`/p/${id}`)
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : '업로드에 실패했습니다.')
      setBusy(false)
    }
  }

  const percentFor = (name: string) => (mode === 'blob' && busy ? progress[name] : undefined)

  const existingRow = (file: StoredFile, dropped: boolean, toggle: () => void) => (
    <li key={file.url} className={dropped ? 'dropped' : undefined}>
      <code>{file.name}</code>
      <span>{formatSize(file.size)}</span>
      <button
        type="button"
        disabled={busy}
        onClick={toggle}
        title={dropped ? '삭제 취소' : '삭제'}
        aria-label={`${file.name} ${dropped ? '삭제 취소' : '삭제'}`}
      >
        {dropped ? '↺' : '✕'}
      </button>
    </li>
  )

  return (
    <form className="form" onSubmit={submit}>
      <label className="field">
        <span>이름</span>
        <input
          value={presenter}
          onChange={(e) => setPresenter(e.target.value)}
          list="known-presenters"
          placeholder="김찬희"
          required
        />
        <datalist id="known-presenters">
          {slots.map((slot) => (
            <option key={slot.presenter} value={slot.presenter} />
          ))}
        </datalist>
        <small>
          저장 위치: <code>{meeting.folder}/{presenter.trim() || '이름'}/</code>
        </small>
      </label>

      {existing && (existing.pdf || existing.videos.length > 0) && (
        <div className="field">
          <span>현재 올라와 있는 파일</span>
          <ul className="file-list existing-files">
            {existing.pdf && existingRow(existing.pdf, dropPdf, () => setDropPdf((v) => !v))}
            {existing.videos.map((video) =>
              existingRow(video, droppedVideos.includes(video.name), () =>
                setDroppedVideos((current) =>
                  current.includes(video.name)
                    ? current.filter((name) => name !== video.name)
                    : [...current, video.name],
                ),
              ),
            )}
          </ul>
          <small>
            ✕ 로 표시한 파일은 저장할 때 삭제됩니다. 같은 이름으로 새로 올리면 덮어씁니다.
          </small>
        </div>
      )}

      <label className="field">
        <span>발표 자료 (PDF)</span>
        <input
          type="file"
          accept="application/pdf,.pdf"
          onChange={(e) => setPdf(e.target.files?.[0] ?? null)}
          required={!keepPdf}
        />
        {pdf ? (
          <small>
            {pdf.name} · {formatSize(pdf.size)}
            {percentFor(pdf.name) !== undefined && ` · ${percentFor(pdf.name)}%`}
          </small>
        ) : (
          keepPdf && <small>고르지 않으면 위의 PDF를 그대로 둡니다.</small>
        )}
      </label>

      <label className="field">
        <span>영상 (선택, 여러 개 가능) → <code>figs/</code></span>
        <input
          type="file"
          accept="video/*,.mp4,.webm,.mov,.m4v"
          multiple
          onChange={(e) => {
            addVideos(e.target.files)
            e.target.value = ''
          }}
        />
      </label>

      {videos.length > 0 && (
        <ul className="file-list">
          {videos.map((video) => {
            const percent = percentFor(video.name)
            return (
              <li key={video.name}>
                <code>{video.name}</code>
                <span>{percent !== undefined ? `${percent}%` : formatSize(video.size)}</span>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => setVideos((current) => current.filter((v) => v !== video))}
                  aria-label={`${video.name} 제거`}
                >
                  ✕
                </button>
                {percent !== undefined && (
                  <div className="file-progress" style={{ width: `${percent}%` }} />
                )}
              </li>
            )
          })}
        </ul>
      )}

      {error && <p className="form-error">{error}</p>}

      <div className="form-actions">
        {totalSize > 0 && <span className="muted">올릴 파일 {formatSize(totalSize)}</span>}
        <button type="submit" className="button button-primary" disabled={busy}>
          {busy ? '올리는 중…' : existing ? '저장하고 열기' : '올리고 열기'}
        </button>
      </div>
    </form>
  )
}
