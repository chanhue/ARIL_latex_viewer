import type { Metadata } from 'next'
import Link from 'next/link'
import { labPassword } from '@/lib/auth.mjs'
import { LogoutButton } from '@/components/LogoutButton'
import './globals.css'

export const metadata: Metadata = {
  title: 'ARIL 랩미팅',
  description: '발표 자료를 올리고 그대로 발표 모드로 넘어가는 랩미팅용 뷰어',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  // Only offer a way out when there is something to log out of.
  const guarded = Boolean(labPassword())

  return (
    <html lang="ko">
      <body>
        <header className="site-header">
          <Link href="/" className="brand">
            ARIL <span>랩미팅</span>
          </Link>
          <nav>
            <Link href="/upload" className="button button-primary">발표 올리기</Link>
            {guarded && <LogoutButton />}
          </nav>
        </header>
        <main>{children}</main>
      </body>
    </html>
  )
}
