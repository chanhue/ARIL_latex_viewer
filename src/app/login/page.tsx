'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { Suspense, useState } from 'react'

function LoginForm() {
  const router = useRouter()
  const params = useSearchParams()
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    setError('')
    setBusy(true)

    try {
      const response = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(payload.error ?? '로그인에 실패했습니다.')

      // Only same-site paths, so a crafted ?next= cannot bounce someone off
      // to another host after they log in.
      const next = params.get('next')
      const target = next && next.startsWith('/') && !next.startsWith('//') ? next : '/'
      router.replace(target)
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : '로그인에 실패했습니다.')
      setPassword('')
      setBusy(false)
    }
  }

  return (
    <form className="form login-form" onSubmit={submit}>
      <label className="field">
        <span>랩 공용 비밀번호</span>
        <input
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          autoFocus
          autoComplete="current-password"
          required
        />
      </label>

      {error && <p className="form-error">{error}</p>}

      <button type="submit" className="button button-primary" disabled={busy}>
        {busy ? '확인 중…' : '들어가기'}
      </button>
    </form>
  )
}

export default function LoginPage() {
  return (
    <div className="page page-narrow login-page">
      <div className="page-head">
        <h1>ARIL 랩미팅</h1>
        <p>랩에서 공유하는 비밀번호를 입력하세요.</p>
      </div>
      {/* useSearchParams needs a Suspense boundary during prerender. */}
      <Suspense fallback={null}>
        <LoginForm />
      </Suspense>
    </div>
  )
}
