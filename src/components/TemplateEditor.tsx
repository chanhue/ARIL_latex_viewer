'use client'

import { useRouter } from 'next/navigation'
import { useMemo, useState } from 'react'

/**
 * The roster is edited as lines of text rather than a list of input rows.
 *
 * It is a short list that changes as a whole — someone joins, someone leaves,
 * the order shifts. A textarea makes reordering a matter of moving a line, and
 * pasting a list from elsewhere just works. Rows of inputs with up/down arrows
 * would be more chrome for less.
 */
export function TemplateEditor({ initialMembers }: { initialMembers: string[] }) {
  const router = useRouter()
  const [text, setText] = useState(initialMembers.join('\n'))
  const [saved, setSaved] = useState(initialMembers.join('\n'))
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)

  const members = useMemo(
    () => text.split('\n').map((line) => line.trim()).filter(Boolean),
    [text],
  )

  const duplicate = useMemo(() => {
    const seen = new Set<string>()
    for (const name of members) {
      const key = name.replace(/\s+/g, ' ').toLowerCase()
      if (seen.has(key)) return name
      seen.add(key)
    }
    return null
  }, [members])

  const dirty = text !== saved

  const save = async (event: React.FormEvent) => {
    event.preventDefault()
    setError('')
    setDone(false)
    setBusy(true)

    try {
      const response = await fetch('/api/template', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ members }),
      })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(payload.error ?? '저장하지 못했습니다.')

      const next = (payload.members as string[]).join('\n')
      setText(next)
      setSaved(next)
      setDone(true)
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : '저장하지 못했습니다.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <form className="form" onSubmit={save}>
      <label className="field">
        <span>발표자 명단 — 한 줄에 한 명</span>
        <textarea
          className="roster"
          value={text}
          onChange={(event) => {
            setText(event.target.value)
            setDone(false)
          }}
          rows={12}
          spellCheck={false}
          placeholder={'김찬희\n홍길동\n이영희'}
        />
        <small>
          {members.length}명
          {duplicate && <> · 중복: <strong>{duplicate}</strong></>}
          {' · '}이 명단대로 랩미팅에 슬롯이 만들어집니다.
        </small>
      </label>

      {error && <p className="form-error">{error}</p>}
      {done && !dirty && <p className="form-ok">저장했습니다.</p>}

      <div className="form-actions">
        {dirty && <span className="muted">저장하지 않은 변경이 있습니다</span>}
        <button
          type="submit"
          className="button button-primary"
          disabled={busy || Boolean(duplicate) || !dirty}
        >
          {busy ? '저장 중…' : '저장'}
        </button>
      </div>
    </form>
  )
}
