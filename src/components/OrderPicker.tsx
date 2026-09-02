'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import type { Meeting, Presentation } from '@/lib/types'

/**
 * Check who is presenting, then draw the speaking order.
 *
 * The draw runs on the server and is saved on the meeting, so the order is one
 * shared fact rather than something each person rolls for themselves.
 */
export function OrderPicker({
  meeting,
  slots,
}: {
  meeting: Meeting
  slots: Presentation[]
}) {
  const router = useRouter()

  // Reopening the page keeps the previous selection: whoever was in the last
  // draw stays checked, and before any draw everyone is.
  const [checked, setChecked] = useState<string[]>(() =>
    meeting.order.length > 0 ? meeting.order : slots.map((slot) => slot.presenter),
  )
  const [order, setOrder] = useState<string[]>(meeting.order)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const toggle = (name: string) => {
    setChecked((current) =>
      current.includes(name) ? current.filter((n) => n !== name) : [...current, name],
    )
  }

  const send = async (body: Record<string, unknown>) => {
    setError('')
    setBusy(true)
    try {
      const response = await fetch(`/api/meetings/${meeting.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(payload.error ?? '실패했습니다.')
      setOrder(payload.order as string[])
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : '실패했습니다.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="order-picker">
      <ul className="check-list">
        {slots.map((slot) => {
          const on = checked.includes(slot.presenter)
          return (
            <li key={slot.id}>
              <label className={on ? 'on' : undefined}>
                <input
                  type="checkbox"
                  checked={on}
                  disabled={busy}
                  onChange={() => toggle(slot.presenter)}
                />
                <span className="check-name">{slot.presenter}</span>
                {!slot.pdf && <span className="check-note">자료 없음</span>}
              </label>
            </li>
          )
        })}
      </ul>

      {slots.length === 0 && <p className="template-empty">발표자가 없습니다.</p>}

      {error && <p className="form-error">{error}</p>}

      <div className="form-actions">
        {order.length > 0 && (
          <button
            type="button"
            className="button"
            disabled={busy}
            onClick={() => void send({ clear: true })}
          >
            지우기
          </button>
        )}
        <button
          type="button"
          className="button button-primary"
          disabled={busy || checked.length === 0}
          onClick={() => void send({ presenters: checked })}
        >
          {busy ? '뽑는 중…' : order.length > 0 ? '다시 뽑기' : '순서 뽑기'}
        </button>
      </div>

      {order.length > 0 && (
        <ol className="order-list">
          {order.map((name, index) => (
            <li key={name}>
              <span className="order-no">{index + 1}</span>
              <span className="order-name">{name}</span>
            </li>
          ))}
        </ol>
      )}
    </div>
  )
}
