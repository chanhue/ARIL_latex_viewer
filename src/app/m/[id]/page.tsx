import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getMeeting, listPresentations } from '@/lib/db'
import { MeetingSlots } from '@/components/MeetingSlots'
import { sortSlots } from '@/lib/slots'

export const dynamic = 'force-dynamic'

export default async function MeetingPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const meeting = await getMeeting(id)
  if (!meeting) notFound()

  const presentations = sortSlots(await listPresentations(id))
  const submitted = presentations.filter((p) => p.pdf).length

  return (
    <div className="page">
      <div className="section-head">
        <div>
          <h1>{meeting.title}</h1>
          <p>{submitted}명 제출</p>
        </div>
        {/* A seminar has one presenter, so there is no order to draw. */}
        {meeting.kind !== 'seminar' && (
          <div className="page-actions">
            <Link href={`/m/${meeting.id}/order`} className="button">발표 순서</Link>
          </div>
        )}
      </div>

      {meeting.order.length > 0 && (
        <ol className="order-strip">
          {meeting.order.map((name, index) => (
            <li key={name}>
              <span className="order-no">{index + 1}</span>
              {name}
            </li>
          ))}
        </ol>
      )}

      <MeetingSlots meeting={meeting} presentations={presentations} />

      <p className="back-link">
        <Link href="/">← 목록</Link>
      </p>
    </div>
  )
}
