'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { meetingTitleFor } from '@/lib/meeting.mjs'
import type { MeetingKind } from '@/lib/types'

function today() {
  const now = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
}

/**
 * One form for both kinds.
 *
 * A meeting is one decision — which date — and the slots come from the saved
 * roster. A seminar is one person, so it asks for the name here instead; there
 * is no template because the presenter is different every time.
 */
export function MeetingCreateForm({
  kind,
  members,
}: {
  kind: MeetingKind
  /** The roster template. Unused for a seminar. */
  members: string[]
}) {
  const router = useRouter()
  const [date, setDate] = useState(today)
  const [presenter, setPresenter] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const seminar = kind === 'seminar'

  // Only a preview: the server picks the final name, and adds a counter if this
  // date already has one of the same kind.
  const previewTitle = meetingTitleFor(date, [], kind) ?? '날짜를 골라 주세요'

  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    setError('')

    if (seminar && !presenter.trim()) {
      setError('발표자 이름을 입력해 주세요.')
      return
    }

    setBusy(true)
    try {
      const response = await fetch('/api/meetings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date,
          kind,
          ...(seminar ? { presenters: [presenter.trim()] } : {}),
        }),
      })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(payload.error ?? '만들지 못했습니다.')
      router.push(`/m/${payload.id}`)
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : '만들지 못했습니다.')
      setBusy(false)
    }
  }

  return (
    <form className="form" onSubmit={submit}>
      <label className="field">
        <span>날짜</span>
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
        <small>폴더 이름: <code>{previewTitle}</code></small>
      </label>

      {seminar ? (
        <label className="field">
          <span>발표자</span>
          <input
            value={presenter}
            onChange={(e) => setPresenter(e.target.value)}
            placeholder="김찬희"
            required
          />
          <small>세미나는 발표자 한 명입니다.</small>
        </label>
      ) : (
        <div className="field">
          <span>템플릿 명단</span>
          {members.length === 0 ? (
            <p className="template-empty">
              저장된 명단이 없습니다. 슬롯 없이 만들어지고, 각자 올릴 때 생깁니다.{' '}
              <Link href="/template">템플릿 편집</Link>
            </p>
          ) : (
            <ul className="chip-list">
              {members.map((name) => (
                <li key={name}>{name}</li>
              ))}
            </ul>
          )}
          <small>
            이 명단대로 슬롯이 만들어집니다. <Link href="/template">템플릿 편집</Link>
          </small>
        </div>
      )}

      {error && <p className="form-error">{error}</p>}

      <div className="form-actions">
        <button type="submit" className="button button-primary" disabled={busy}>
          {busy ? '만드는 중…' : '만들기'}
        </button>
      </div>
    </form>
  )
}
