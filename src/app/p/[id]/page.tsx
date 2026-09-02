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

  return (
    <div className="viewer">
      <div className="viewer-head">
        <div>
          <h1>{presentation.title}</h1>
          <p>
            {presentation.presenter} · {presentation.date}
            {presentation.videos.length > 0 && (
              <span className="viewer-videos">
                영상 {presentation.videos.map((v) => v.name).join(', ')}
              </span>
            )}
          </p>
        </div>
        <Link href="/" className="button">목록</Link>
      </div>
      <Deck presentation={presentation} />
    </div>
  )
}
