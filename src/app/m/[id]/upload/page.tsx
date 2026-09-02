import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getMeeting, listPresentations } from '@/lib/db'
import { UploadForm, type UploadMode } from '@/components/UploadForm'
import { usingVercelBlob } from '@/lib/storage'

export const dynamic = 'force-dynamic'

export default async function UploadPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ presenter?: string }>
}) {
  const { id } = await params
  const { presenter } = await searchParams

  const meeting = await getMeeting(id)
  if (!meeting) notFound()

  const presentations = await listPresentations(id)

  // Decided on the server: the browser must not have to guess whether direct
  // Blob upload is configured.
  const mode: UploadMode = usingVercelBlob ? 'blob' : 'multipart'

  // On Vercel the multipart path writes to a read-only filesystem and always
  // fails. Say so on the page rather than after the upload has been attempted.
  const brokenHere = Boolean(process.env.VERCEL) && mode === 'multipart'

  // Names only, never values. The dashboard is not a reliable answer to "is the
  // token there" — OIDC credentials are issued at runtime and never appear in
  // the stored variable list — so report what this process can actually see.
  const storageVars = brokenHere
    ? Object.keys(process.env)
        .filter((key) => /BLOB|POSTGRES|DATABASE|NEON/i.test(key))
        .sort()
    : []

  return (
    <div className="page page-narrow">
      <div className="page-head">
        <h1>자료 올리기</h1>
        <p>
          {meeting.title} · PDF 안에 <code>{'\\href{figs/demo.mp4}{...}'}</code> 로 링크를
          걸어두고 같은 이름의 영상을 함께 올리면, 그 링크 자리에서 영상이 재생됩니다.
        </p>
      </div>

      {brokenHere && (
        <div className="form-error">
          <p style={{ margin: 0 }}>
            Blob 스토어가 연결되지 않아 업로드가 동작하지 않습니다. Vercel 프로젝트의 Storage 탭에서
            Blob(Public)을 이 프로젝트에 연결하고 <strong>재배포</strong>해 주세요. 환경변수는 빌드
            시점에 주입되므로, 연결만 하고 재배포하지 않으면 반영되지 않습니다.
          </p>
          <p style={{ margin: '10px 0 0' }}>
            지금 이 서버가 보고 있는 관련 환경변수{' '}
            {storageVars.length === 0 ? (
              <strong>없음</strong>
            ) : (
              <code>{storageVars.join(', ')}</code>
            )}
          </p>
        </div>
      )}

      <UploadForm
        mode={mode}
        meeting={meeting}
        knownPresenters={presentations.map((p) => p.presenter)}
        initialPresenter={presenter ?? ''}
      />

      <p className="back-link">
        <Link href={`/m/${meeting.id}`}>← {meeting.title}</Link>
      </p>
    </div>
  )
}
