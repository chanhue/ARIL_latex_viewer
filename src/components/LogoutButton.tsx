'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'

export function LogoutButton() {
  const router = useRouter()
  const [busy, setBusy] = useState(false)

  return (
    <button
      type="button"
      className="button"
      disabled={busy}
      onClick={async () => {
        setBusy(true)
        await fetch('/api/logout', { method: 'POST' })
        router.replace('/login')
        router.refresh()
      }}
    >
      나가기
    </button>
  )
}
