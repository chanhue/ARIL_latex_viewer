import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getPresentation } from '@/lib/db'
import { Deck } from '@/components/Deck'

export const dynamic = 'force-dynamic'

export default async function PresentationPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const presentation = await getPresentation(id)
  if (!presentation) notFound()

  // Pulled out as its own binding: narrowing `presentation.pdf` does not change
  // the type of `presentation` itself, so passing the whole object to <Deck>
  // would still carry `pdf: StoredFile | null`. Spreading the narrowed `pdf`
  // back in below is what makes it check out.
  const { pdf } = presentation

  // An empty slot has a name but no slides — there is nothing to present yet.
  if (!pdf) {
    return (
      <div className="page page-narrow">
        <div className="page-head">
          <h1>{presentation.presenter}</h1>
          <p>아직 자료를 올리지 않았습니다.</p>
        </div>
        <p className="back-link">
          <Link
            href={`/m/${presentation.meetingId}/upload?presenter=${encodeURIComponent(presentation.presenter)}`}
            className="button button-primary"
          >
            지금 올리기
          </Link>
        </p>
        <p className="back-link">
          <Link href={`/m/${presentation.meetingId}`}>← {presentation.meeting.title}</Link>
        </p>
      </div>
    )
  }

  return (
    <div className="viewer">
      <div className="viewer-head">
        <div>
          <h1>{presentation.presenter}</h1>
          <p>
            {presentation.meeting.title}
            {presentation.videos.length > 0 && (
              <span className="viewer-videos">
                figs/ {presentation.videos.map((v) => v.name).join(', ')}
              </span>
            )}
          </p>
        </div>
        <Link href={`/m/${presentation.meetingId}`} className="button">목록</Link>
      </div>
      <Deck presentation={{ ...presentation, pdf }} />
    </div>
  )
}
