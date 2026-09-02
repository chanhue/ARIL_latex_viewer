'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { meetingTitleFor } from '@/lib/meeting.mjs'

function today() {
  const now = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
}

/**
 * Creating a meeting takes a date and nothing else. Names are optional: fill
 * them in to see who is still missing on the meeting page, or leave the list
 * empty and let each person's slot appear when they upload.
 */
export function MeetingCreateForm() {
  const router = useRouter()
  const [date, setDate] = useState(today)
  const [names, setNames] = useState<string[]>([])
  const [draft, setDraft] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  // Only a preview: the server picks the final name, and adds a counter if this
  // date already has a meeting.
  const previewTitle = meetingTitleFor(date) ?? '날짜를 골라 주세요'

  const addName = () => {
    const name = draft.trim()
    if (!name) return
    if (names.some((n) => n.toLowerCase() === name.toLowerCase())) {
      setError('이미 추가한 이름입니다.')
      return
    }
    setNames((current) => [...current, name])
    setDraft('')
    setError('')
  }

  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    setError('')
    setBusy(true)

    // A name typed but not yet added with Enter should not be silently lost.
    const pending = draft.trim()
    const presenters = pending && !names.includes(pending) ? [...names, pending] : names

    try {
      const response = await fetch('/api/meetings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date, presenters }),
      })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(payload.error ?? '랩미팅을 만들지 못했습니다.')
      router.push(`/m/${payload.id}`)
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : '랩미팅을 만들지 못했습니다.')
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

      <div className="field">
        <span>발표자 (선택)</span>
        <div className="name-input">
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                // Enter adds a name; it must not submit the whole form.
                event.preventDefault()
                addName()
              }
            }}
            placeholder="이름을 적고 Enter"
          />
          <button type="button" className="button" onClick={addName}>추가</button>
        </div>
        <small>미리 넣어두면 누가 아직 안 올렸는지 보입니다. 나중에 추가해도 됩니다.</small>
      </div>

      {names.length > 0 && (
        <ul className="chip-list">
          {names.map((name) => (
            <li key={name}>
              {name}
              <button
                type="button"
                onClick={() => setNames((current) => current.filter((n) => n !== name))}
                aria-label={`${name} 제거`}
              >
                ✕
              </button>
            </li>
          ))}
        </ul>
      )}

      {error && <p className="form-error">{error}</p>}

      <div className="form-actions">
        <button type="submit" className="button button-primary" disabled={busy}>
          {busy ? '만드는 중…' : '랩미팅 만들기'}
        </button>
      </div>
    </form>
  )
}
