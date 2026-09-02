'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useRef, useState } from 'react'

/**
 * Tick who is presenting this week; the order is drawn again on every change.
 *
 * The roster comes from the template, not from any one meeting: the running
 * order is settled on the spot, before anyone has opened a particular meeting.
 *
 * There is no draw button. Checking someone is the only action, and the order
 * is a consequence of it — a separate button would just be a step you could
 * forget to press after changing the ticks.
 *
 * The draw runs on the server and is saved on the meeting, so the order is one
 * shared fact rather than something each person rolls for themselves.
 */
export function OrderPicker({
  members,
  initialOrder,
}: {
  members: string[]
  initialOrder: string[]
}) {
  const router = useRouter()

  // Nothing is ticked on a meeting that has never been drawn. Coming back to
  // one that has keeps the previous selection rather than making you redo it.
  const [checked, setChecked] = useState<string[]>(initialOrder)
  const [order, setOrder] = useState<string[]>(initialOrder)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  // A burst of ticks should cost one draw, and a slow reply from an earlier
  // one must not overwrite the result of a later.
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const latest = useRef(0)

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current)
  }, [])

  const draw = useCallback(
    (names: string[]) => {
      if (timer.current) clearTimeout(timer.current)
      setBusy(true)

      timer.current = setTimeout(async () => {
        const mine = ++latest.current
        setError('')
        try {
          const response = await fetch('/api/order', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(
              names.length === 0 ? { clear: true } : { presenters: names },
            ),
          })
          const payload = await response.json().catch(() => ({}))
          if (mine !== latest.current) return // superseded by a later tick
          if (!response.ok) throw new Error(payload.error ?? '실패했습니다.')
          setOrder(payload.order as string[])
          router.refresh()
        } catch (err) {
          if (mine !== latest.current) return
          setError(err instanceof Error ? err.message : '실패했습니다.')
        } finally {
          if (mine === latest.current) setBusy(false)
        }
      }, 250)
    },
    [router],
  )

  const toggle = (name: string) => {
    const next = checked.includes(name)
      ? checked.filter((n) => n !== name)
      : [...checked, name]
    setChecked(next)
    draw(next)
  }

  if (members.length === 0) {
    return (
      <p className="template-empty">
        명단이 비어 있습니다. <Link href="/template">템플릿 편집</Link>
      </p>
    )
  }

  return (
    <div className="order-picker">
      <ul className="check-grid">
        {members.map((name) => {
          const on = checked.includes(name)
          return (
            <li key={name}>
              <label className={on ? 'on' : undefined}>
                <input type="checkbox" checked={on} onChange={() => toggle(name)} />
                <span className="check-name">{name}</span>
              </label>
            </li>
          )
        })}
      </ul>

      {error && <p className="form-error">{error}</p>}

      {order.length > 0 ? (
        <ol className={`order-list${busy ? ' drawing' : ''}`}>
          {order.map((name, index) => (
            <li key={name}>
              <span className="order-no">{index + 1}</span>
              <span className="order-name">{name}</span>
            </li>
          ))}
        </ol>
      ) : (
        <p className="order-hint">체크하면 순서가 정해집니다.</p>
      )}
    </div>
  )
}
