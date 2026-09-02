'use client'

import { useEffect, useState } from 'react'

/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * One slide thumbnail for the overview grid.
 *
 * Thumbnails are rendered through a small queue and cached as data URLs: a
 * 40-slide deck opening the grid would otherwise kick off 40 simultaneous
 * pdf.js renders and stall the tab right when the presenter wants to jump.
 */

const CONCURRENCY = 3
const cache = new Map<string, string>()

let active = 0
const waiting: Array<() => void> = []

async function withSlot<T>(fn: () => Promise<T>): Promise<T> {
  if (active >= CONCURRENCY) await new Promise<void>((resolve) => waiting.push(resolve))
  active += 1
  try {
    return await fn()
  } finally {
    active -= 1
    waiting.shift()?.()
  }
}

export function PageThumb({
  doc,
  pageNumber,
  width,
}: {
  doc: any
  pageNumber: number
  width: number
}) {
  const cacheKey = `${doc?.fingerprints?.[0] ?? 'doc'}:${pageNumber}:${width}`
  const [src, setSrc] = useState<string | null>(() => cache.get(cacheKey) ?? null)

  useEffect(() => {
    if (src || !doc) return
    let cancelled = false

    void withSlot(async () => {
      if (cancelled) return
      const page = await doc.getPage(pageNumber)
      const unscaled = page.getViewport({ scale: 1 })
      const viewport = page.getViewport({ scale: width / unscaled.width })

      const canvas = document.createElement('canvas')
      canvas.width = Math.floor(viewport.width)
      canvas.height = Math.floor(viewport.height)
      const context = canvas.getContext('2d')
      if (!context) return

      await page.render({ canvasContext: context, viewport }).promise
      if (cancelled) return

      const dataUrl = canvas.toDataURL('image/jpeg', 0.72)
      cache.set(cacheKey, dataUrl)
      setSrc(dataUrl)
    }).catch((err) => {
      if (err?.name !== 'RenderingCancelledException') console.error('thumbnail failed', err)
    })

    return () => {
      cancelled = true
    }
  }, [doc, pageNumber, width, src, cacheKey])

  return (
    <div className="deck-thumb-image">
      {src ? <img src={src} alt={`슬라이드 ${pageNumber}`} /> : <div className="deck-thumb-skeleton" />}
    </div>
  )
}
