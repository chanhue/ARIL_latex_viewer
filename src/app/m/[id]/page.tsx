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

  return (
    <div className="page">
      <div className="page-head">
        <h1>{meeting.title}</h1>
        <p>{presentations.filter((p) => p.pdf).length}명 제출</p>
      </div>

      <MeetingSlots meeting={meeting} presentations={presentations} />

      <p className="back-link">
        <Link href="/">← 목록</Link>
      </p>
    </div>
  )
}
