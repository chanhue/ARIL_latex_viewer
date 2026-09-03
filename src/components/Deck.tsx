'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { playerBox, resolveLink, videoOptions } from '@/lib/link-match.mjs'
import type { Presentation, StoredFile } from '@/lib/types'
import { PageThumb } from './PageThumb'

/* eslint-disable @typescript-eslint/no-explicit-any */

type Overlay = {
  key: string
  left: number
  top: number
  width: number
  height: number
} & (
  | { kind: 'video'; src: string; name: string; grown: boolean; opts: ReturnType<typeof videoOptions> }
  | { kind: 'link'; href: string }
)

type Status = 'loading' | 'ready' | 'error'

/** How close to the bottom edge the pointer must come to raise the bar. */
const REVEAL_ZONE = 96

/**
 * Renders the PDF ourselves with pdf.js rather than handing it to the browser's
 * viewer, because that is the only way to reach the link annotations and swap
 * them for real <video> elements sitting exactly where the author put them.
 */
export function Deck({
  presentation,
}: {
  // An empty slot has no slides; the page filters those out before rendering.
  presentation: Presentation & { pdf: StoredFile }
}) {
  const { pdf, videos } = presentation

  const [doc, setDoc] = useState<any>(null)
  const [numPages, setNumPages] = useState(0)
  const [page, setPage] = useState(1)
  const [status, setStatus] = useState<Status>('loading')
  const [errorMessage, setErrorMessage] = useState('')
  const [size, setSize] = useState({ width: 0, height: 0 })
  const [overlays, setOverlays] = useState<Overlay[]>([])

  const [presenting, setPresenting] = useState(false)
  const [blackout, setBlackout] = useState(false)
  const [overview, setOverview] = useState(false)
  const [lightbox, setLightbox] = useState<{ src: string; name: string } | null>(null)
  const [hintVisible, setHintVisible] = useState(false)
  const [barPeek, setBarPeek] = useState(false)

  const rootRef = useRef<HTMLDivElement>(null)
  const stageRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const renderTaskRef = useRef<any>(null)
  const stageSizeRef = useRef({ w: 0, h: 0 })
  const [stageSize, setStageSize] = useState({ w: 0, h: 0 })

  // Match by file name, so the author writes `\href{demo.mp4}` and uploads
  // demo.mp4 without the two ever needing to agree on a URL.
  const videoIndex = useMemo(
    () => videos.map((v: StoredFile) => ({ name: v.name, url: v.url })),
    [videos],
  )

  /* ---------------------------------------------------------------- load */

  useEffect(() => {
    let cancelled = false
    let loaded: any = null

    ;(async () => {
      const pdfjs: any = await import('pdfjs-dist')
      pdfjs.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs'
      const task = pdfjs.getDocument({ url: pdf.url })
      const document = await task.promise
      if (cancelled) {
        document.destroy()
        return
      }
      loaded = document
      setDoc(document)
      setNumPages(document.numPages)
      setStatus('ready')
    })().catch((err) => {
      if (cancelled) return
      console.error('failed to open pdf', err)
      setErrorMessage(err?.message ?? 'PDF를 여는 데 실패했습니다.')
      setStatus('error')
    })

    return () => {
      cancelled = true
      loaded?.destroy()
    }
  }, [pdf.url])

  /* ------------------------------------------------------------ measure */

  useEffect(() => {
    const el = stageRef.current
    if (!el) return
    const observer = new ResizeObserver((entries) => {
      const rect = entries[0].contentRect
      const next = { w: Math.floor(rect.width), h: Math.floor(rect.height) }
      // Ignore sub-pixel churn; every change here costs a full re-render.
      if (Math.abs(next.w - stageSizeRef.current.w) < 2 && Math.abs(next.h - stageSizeRef.current.h) < 2) return
      stageSizeRef.current = next
      setStageSize(next)
    })
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  /* ------------------------------------------------------------- render */

  useEffect(() => {
    if (!doc || stageSize.w < 10 || stageSize.h < 10) return
    let cancelled = false

    ;(async () => {
      renderTaskRef.current?.cancel()

      const pdfPage = await doc.getPage(page)
      if (cancelled) return

      const unscaled = pdfPage.getViewport({ scale: 1 })
      const scale = Math.min(stageSize.w / unscaled.width, stageSize.h / unscaled.height)
      const viewport = pdfPage.getViewport({ scale })

      const canvas = canvasRef.current
      if (!canvas) return

      // Render at device resolution or Beamer's hairlines turn to mush on a
      // projector; cap at 2x so a 4K screen does not blow up memory.
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      canvas.width = Math.floor(viewport.width * dpr)
      canvas.height = Math.floor(viewport.height * dpr)
      canvas.style.width = `${viewport.width}px`
      canvas.style.height = `${viewport.height}px`

      const context = canvas.getContext('2d')
      if (!context) return

      const task = pdfPage.render({
        canvasContext: context,
        viewport,
        transform: dpr === 1 ? undefined : [dpr, 0, 0, dpr, 0, 0],
      })
      renderTaskRef.current = task
      await task.promise
      if (cancelled) return

      setSize({ width: viewport.width, height: viewport.height })

      /* ---- link annotations become the overlay layer ---- */

      const annotations = await pdfPage.getAnnotations({ intent: 'display' })
      if (cancelled) return

      const found: Overlay[] = []
      for (const annotation of annotations) {
        if (annotation.subtype !== 'Link') continue
        const raw: string | undefined = annotation.url ?? annotation.unsafeUrl
        const resolved = resolveLink(raw ?? '', videoIndex)
        if (!resolved) continue

        const rect = viewport.convertToViewportRectangle(annotation.rect)
        const left = Math.min(rect[0], rect[2])
        const top = Math.min(rect[1], rect[3])
        const width = Math.abs(rect[2] - rect[0])
        const height = Math.abs(rect[3] - rect[1])
        if (width < 2 || height < 2) continue

        if (resolved.kind === 'video') {
          // A word-sized link cannot host a player at its own size, but the
          // author still meant "here" — grow the box around the link instead of
          // sending the clip off to a separate window.
          const box = playerBox(
            { left, top, width, height },
            viewport.width,
            viewport.height,
          )
          found.push({
            key: `${annotation.id}`,
            ...box,
            kind: 'video',
            src: resolved.src,
            name: resolved.name,
            opts: videoOptions(raw ?? ''),
          })
        } else {
          found.push({ key: `${annotation.id}`, left, top, width, height, kind: 'link', href: resolved.href })
        }
      }

      // A link wrapped around several lines of text yields one rect per line.
      // For a video that would mean several players; keep only the largest.
      const byVideo = new Map<string, Overlay>()
      const result: Overlay[] = []
      for (const item of found) {
        if (item.kind !== 'video') {
          result.push(item)
          continue
        }
        const existing = byVideo.get(item.src)
        if (!existing || item.width * item.height > existing.width * existing.height) {
          byVideo.set(item.src, item)
        }
      }
      setOverlays([...result, ...byVideo.values()])

      // Warm the neighbours so arrowing through the deck feels instant.
      if (page < doc.numPages) doc.getPage(page + 1).catch(() => {})
      if (page > 1) doc.getPage(page - 1).catch(() => {})
    })().catch((err) => {
      // Cancelling an in-flight render is normal when pages change quickly.
      if (err?.name === 'RenderingCancelledException') return
      console.error('failed to render page', err)
    })

    return () => {
      cancelled = true
    }
  }, [doc, page, stageSize.w, stageSize.h, videoIndex])

  /* ---------------------------------------------------------- navigation */

  const go = useCallback(
    (delta: number) => {
      setPage((current) => Math.min(Math.max(current + delta, 1), numPages || 1))
      setBlackout(false)
    },
    [numPages],
  )

  const goTo = useCallback(
    (target: number) => {
      setPage(Math.min(Math.max(target, 1), numPages || 1))
      setBlackout(false)
    },
    [numPages],
  )

  const togglePresent = useCallback(async () => {
    const el = rootRef.current
    if (!el) return
    try {
      if (document.fullscreenElement) await document.exitFullscreen()
      else await el.requestFullscreen()
    } catch (err) {
      // Fullscreen can be refused (permissions, embedded frames). Still switch
      // to the distraction-free layout so the talk can go ahead.
      console.warn('fullscreen unavailable', err)
      setPresenting((v) => !v)
    }
  }, [])

  /** Read the stage box now and re-render the page at that size. */
  const measureStage = useCallback(() => {
    const el = stageRef.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    const next = { w: Math.floor(rect.width), h: Math.floor(rect.height) }
    if (next.w < 10 || next.h < 10) return
    if (next.w === stageSizeRef.current.w && next.h === stageSizeRef.current.h) return
    stageSizeRef.current = next
    setStageSize(next)
  }, [])

  /**
   * In presentation mode the control bar sits off the bottom edge and comes
   * back when the pointer nears it.
   *
   * Tracking the pointer rather than putting a hover strip over the bottom of
   * the slide: a strip would swallow clicks aimed at a video that happens to
   * sit low on the page, and making it click-through would stop :hover firing.
   */
  useEffect(() => {
    if (!presenting) {
      setBarPeek(false)
      return
    }

    const onMove = (event: MouseEvent) => {
      setBarPeek(event.clientY >= window.innerHeight - REVEAL_ZONE)
    }
    window.addEventListener('mousemove', onMove)
    return () => window.removeEventListener('mousemove', onMove)
  }, [presenting])

  useEffect(() => {
    const onChange = () => {
      setPresenting(Boolean(document.fullscreenElement))
      setBarPeek(false)
      // The ResizeObserver catches this too, but only after the browser has
      // laid out the fullscreen element and React has dropped the stage's
      // padding — long enough to show one frame of the slide at its old,
      // smaller size. Measure again on the next two frames so the slide is
      // already filling the screen when the transition finishes.
      requestAnimationFrame(() => {
        measureStage()
        requestAnimationFrame(measureStage)
      })
    }
    document.addEventListener('fullscreenchange', onChange)
    return () => document.removeEventListener('fullscreenchange', onChange)
  }, [measureStage])

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null
      const tag = target?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || target?.isContentEditable) return
      // Space belongs to a focused video: it is play/pause there.
      if (tag === 'VIDEO' && (event.key === ' ' || event.key === 'ArrowLeft' || event.key === 'ArrowRight')) return

      switch (event.key) {
        case 'ArrowRight':
        case 'ArrowDown':
        case 'PageDown':
        case ' ':
          event.preventDefault()
          go(1)
          break
        case 'ArrowLeft':
        case 'ArrowUp':
        case 'PageUp':
          event.preventDefault()
          go(-1)
          break
        case 'Home':
          event.preventDefault()
          goTo(1)
          break
        case 'End':
          event.preventDefault()
          goTo(numPages)
          break
        case 'f':
        case 'F':
          event.preventDefault()
          void togglePresent()
          break
        case 'b':
        case 'B':
          event.preventDefault()
          setBlackout((v) => !v)
          break
        case 'g':
        case 'G':
        case 'o':
        case 'O':
          event.preventDefault()
          setOverview((v) => !v)
          break
        case 'Escape':
          if (lightbox) setLightbox(null)
          else if (overview) setOverview(false)
          break
        case '?':
          setHintVisible((v) => !v)
          break
        default:
          break
      }
    }

    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [go, goTo, numPages, togglePresent, lightbox, overview])

  /* --------------------------------------------------------------- view */

  const videoCount = overlays.filter((o) => o.kind === 'video').length

  return (
    <div ref={rootRef} className={`deck${presenting ? ' presenting' : ''}`}>
      <div className="deck-stage-wrap">
        <div ref={stageRef} className="deck-stage">
          {status === 'loading' && <p className="deck-message">발표 자료를 불러오는 중…</p>}
          {status === 'error' && (
            <p className="deck-message deck-message-error">
              PDF를 열지 못했습니다.
              <span>{errorMessage}</span>
            </p>
          )}

          <div
            className="deck-page"
            style={{ width: size.width || undefined, height: size.height || undefined }}
            hidden={status !== 'ready'}
          >
            <canvas ref={canvasRef} className="deck-canvas" />

            {overlays.map((overlay) => {
              const style = {
                left: `${overlay.left}px`,
                top: `${overlay.top}px`,
                width: `${overlay.width}px`,
                height: `${overlay.height}px`,
              }

              if (overlay.kind === 'link') {
                return (
                  <a
                    key={overlay.key}
                    className="deck-link"
                    style={style}
                    href={overlay.href}
                    target="_blank"
                    rel="noreferrer noopener"
                    title={overlay.href}
                  />
                )
              }

              return (
                <video
                  // Keyed by page as well so switching slides tears the element
                  // down — that is what stops the audio of the previous clip.
                  key={`${page}:${overlay.key}`}
                  // A grown box sits on top of the slide rather than filling a
                  // space the author left for it, so it gets an edge.
                  className={`deck-video${overlay.grown ? ' grown' : ''}`}
                  style={style}
                  src={overlay.src}
                  controls
                  playsInline
                  preload="metadata"
                  autoPlay={overlay.opts.autoplay}
                  loop={overlay.opts.loop}
                  muted={overlay.opts.muted}
                  onDoubleClick={() => setLightbox({ src: overlay.src, name: overlay.name })}
                />
              )
            })}
          </div>

          {blackout && <div className="deck-blackout" onClick={() => setBlackout(false)} />}
        </div>

        <button
          type="button"
          className="deck-edge deck-edge-left"
          onClick={() => go(-1)}
          disabled={page <= 1}
          aria-label="이전 슬라이드"
        />
        <button
          type="button"
          className="deck-edge deck-edge-right"
          onClick={() => go(1)}
          disabled={page >= numPages}
          aria-label="다음 슬라이드"
        />
      </div>

      <div className={`deck-bar${presenting && barPeek ? ' peek' : ''}`}>
        <div className="deck-bar-left">
          <button type="button" onClick={() => go(-1)} disabled={page <= 1}>←</button>
          <span className="deck-counter">
            <input
              type="number"
              value={page}
              min={1}
              max={numPages || 1}
              onChange={(event) => {
                const next = Number(event.target.value)
                if (Number.isFinite(next)) goTo(next)
              }}
            />
            <span>/ {numPages || '–'}</span>
          </span>
          <button type="button" onClick={() => go(1)} disabled={page >= numPages}>→</button>
        </div>

        <div className="deck-bar-right">
          {videoCount > 0 && <span className="deck-tag">이 슬라이드 영상 {videoCount}개</span>}
          <button type="button" onClick={() => setOverview(true)}>슬라이드 목록</button>
          <button type="button" className="deck-primary" onClick={() => void togglePresent()}>
            {presenting ? '발표 종료' : '발표 모드'}
          </button>
        </div>
      </div>

      {overview && doc && (
        <div className="deck-overview" onClick={() => setOverview(false)}>
          <div className="deck-overview-grid" onClick={(event) => event.stopPropagation()}>
            {Array.from({ length: numPages }, (_, index) => index + 1).map((n) => (
              <button
                key={n}
                type="button"
                className={`deck-thumb${n === page ? ' current' : ''}`}
                onClick={() => {
                  goTo(n)
                  setOverview(false)
                }}
              >
                <PageThumb doc={doc} pageNumber={n} width={220} />
                <span>{n}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {lightbox && (
        <div className="deck-lightbox" onClick={() => setLightbox(null)}>
          <video
            src={lightbox.src}
            controls
            autoPlay
            playsInline
            onClick={(event) => event.stopPropagation()}
          />
          <p>{lightbox.name}</p>
        </div>
      )}

      {hintVisible && (
        <div className="deck-hint" onClick={() => setHintVisible(false)}>
          <dl>
            <dt>→ / Space</dt><dd>다음</dd>
            <dt>←</dt><dd>이전</dd>
            <dt>F</dt><dd>발표 모드</dd>
            <dt>B</dt><dd>화면 끄기</dd>
            <dt>G</dt><dd>슬라이드 목록</dd>
            <dt>?</dt><dd>이 도움말</dd>
          </dl>
        </div>
      )}
    </div>
  )
}
