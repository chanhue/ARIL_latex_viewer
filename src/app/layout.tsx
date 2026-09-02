import type { Metadata } from 'next'
import Link from 'next/link'
import { labPassword } from '@/lib/auth.mjs'
import { LogoutButton } from '@/components/LogoutButton'
import './globals.css'

export const metadata: Metadata = {
  title: 'ARI LAB 랩미팅',
  description: '랩미팅 발표 자료를 올리고 그대로 발표 모드로 넘어가는 뷰어',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  // Only offer a way out when there is something to log out of.
  const guarded = Boolean(labPassword())

  return (
    <html lang="ko">
      <head>
        {/* Alice is the heading face on the lab's own site. Loaded with a link
            rather than next/font so a build without network still succeeds —
            it simply falls back to Georgia. */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Alice&display=swap"
        />
      </head>
      <body>
        <header className="site-header">
          <Link href="/" className="brand">
            ARI LAB <span>랩미팅</span>
          </Link>
          <nav>
            <Link href="/template" className="button">템플릿</Link>
            <Link href="/meetings/new" className="button button-primary">새 랩미팅</Link>
            {guarded && <LogoutButton />}
          </nav>
        </header>
        <main>{children}</main>
      </body>
    </html>
  )
}
