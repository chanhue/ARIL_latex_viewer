import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getMeeting, listPresentations } from '@/lib/db'
import { UploadForm, type UploadMode } from '@/components/UploadForm'

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
  const mode: UploadMode = process.env.BLOB_READ_WRITE_TOKEN ? 'blob' : 'multipart'

  return (
    <div className="page page-narrow">
      <div className="page-head">
        <h1>자료 올리기</h1>
        <p>
          {meeting.title} · PDF 안에 <code>{'\\href{figs/demo.mp4}{...}'}</code> 로 링크를
          걸어두고 같은 이름의 영상을 함께 올리면, 그 링크 자리에서 영상이 재생됩니다.
        </p>
      </div>

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
