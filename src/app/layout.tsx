import type { Metadata } from 'next'
import Link from 'next/link'
import { labPassword } from '@/lib/auth.mjs'
import { LogoutButton } from '@/components/LogoutButton'
import './globals.css'

export const metadata: Metadata = {
  title: 'Aril presentation',
  description: '랩미팅 발표 자료를 올리고 그대로 발표 모드로 넘어가는 뷰어',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  // Only offer a way out when there is something to log out of.
  const guarded = Boolean(labPassword())

  // Which commit is actually serving this page. "Is my change live yet?" is
  // otherwise guesswork against a CDN and a build queue; this answers it from
  // View Source. Vercel sets these automatically.
  const buildSha = process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? 'dev'
  const buildRef = process.env.VERCEL_GIT_COMMIT_REF ?? 'local'

  return (
    <html lang="ko">
      <head>
        {/* The lab site sets headings in Sofia Pro, which is not free, so
            Nunito Sans stands in — same rounded geometric feel. Alice is the
            serif it uses for short supporting lines. Loaded with a link rather
            than next/font so a build without network still succeeds; the page
            simply falls back to the system stack. */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Alice&family=Nunito+Sans:wght@400;600;700;800&display=swap"
        />
        <meta name="build" content={`${buildRef}@${buildSha}`} />
      </head>
      <body>
        <header className="site-header">
          <Link href="/" className="brand">
            Aril <span>presentation</span>
          </Link>
          {/* Only the way out lives here. Making a meeting and editing the
              roster belong to the meeting list, not to every page — a viewer
              in presentation mode has no use for them. */}
          {guarded && (
            <nav>
              <LogoutButton />
            </nav>
          )}
        </header>
        <main>{children}</main>
      </body>
    </html>
  )
}
