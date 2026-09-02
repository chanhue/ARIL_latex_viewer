'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import type { Meeting, Presentation } from '@/lib/types'

/**
 * The folder view of one meeting: a row per person, showing whether they have
 * uploaded. Empty rows are the point of registering names in advance — at a
 * glance you can see who still owes slides.
 */
export function MeetingSlots({
  meeting,
  presentations,
}: {
  meeting: Meeting
  presentations: Presentation[]
}) {
  const router = useRouter()
  const [draft, setDraft] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const addPerson = async (event: React.FormEvent) => {
    event.preventDefault()
    const presenter = draft.trim()
    if (!presenter) return

    setBusy(true)
    setError('')
    try {
      const response = await fetch('/api/presentations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ meetingId: meeting.id, presenter, slotOnly: true }),
      })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(payload.error ?? '추가하지 못했습니다.')
      setDraft('')
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : '추가하지 못했습니다.')
    } finally {
      setBusy(false)
    }
  }

  /**
   * Clears a slot's files and leaves the name on the schedule. There is no
   * delete-the-person action here: who is presenting is decided by the roster
   * template, and a slot going empty is a normal state, not a mistake to be
   * cleaned up.
   */
  const clearFiles = async (slot: Presentation) => {
    if (!window.confirm(`${slot.presenter}의 자료를 삭제할까요?`)) return

    setBusy(true)
    try {
      await fetch(`/api/presentations/${slot.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clearFiles: true }),
      })
      router.refresh()
    } finally {
      setBusy(false)
    }
  }

  const removeMeeting = async () => {
    if (!window.confirm(`'${meeting.title}' 전체를 삭제할까요? 올라온 자료도 모두 지워집니다.`)) return
    setBusy(true)
    try {
      await fetch(`/api/meetings/${meeting.id}`, { method: 'DELETE' })
      router.push('/')
      router.refresh()
    } catch {
      setBusy(false)
    }
  }

  return (
    <div className="slots">
      <ul className="slot-list">
        {presentations.map((slot) => (
          <li key={slot.id} className={slot.pdf ? 'filled' : 'empty-slot'}>
            <div className="slot-main">
              <span className="slot-name">{slot.presenter}</span>
              {slot.pdf ? (
                <span className="slot-files">
                  <code>{slot.pdf.name}</code>
                  {slot.videos.length > 0 && (
                    <span className="slot-videos">
                      figs/ {slot.videos.map((v) => v.name).join(', ')}
                    </span>
                  )}
                </span>
              ) : (
                <span className="slot-files muted">아직 올리지 않음</span>
              )}
            </div>

            <div className="slot-actions">
              {slot.pdf && (
                <Link href={`/p/${slot.id}`} className="button button-primary">발표</Link>
              )}
              <Link
                href={`/m/${meeting.id}/upload?presenter=${encodeURIComponent(slot.presenter)}`}
                className="button"
              >
                {slot.pdf ? '교체' : '올리기'}
              </Link>
              {slot.pdf && (
                <button
                  type="button"
                  className="button icon-button"
                  disabled={busy}
                  onClick={() => clearFiles(slot)}
                  aria-label={`${slot.presenter} 자료 삭제`}
                  title="자료 삭제"
                >
                  ✕
                </button>
              )}
            </div>
          </li>
        ))}
      </ul>

      <form className="add-person" onSubmit={addPerson}>
        <input
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          placeholder="발표자 이름 추가"
          disabled={busy}
        />
        <button type="submit" className="button" disabled={busy || !draft.trim()}>추가</button>
      </form>

      {error && <p className="form-error">{error}</p>}

      <p className="danger-zone">
        <button type="button" onClick={removeMeeting} disabled={busy}>
          이 랩미팅 삭제
        </button>
      </p>
    </div>
  )
}
