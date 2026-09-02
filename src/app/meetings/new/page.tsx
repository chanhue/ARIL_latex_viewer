import Link from 'next/link'
import { getTemplate } from '@/lib/db'
import { MeetingCreateForm } from '@/components/MeetingCreateForm'

export const dynamic = 'force-dynamic'

export default async function NewMeetingPage() {
  const members = await getTemplate()

  return (
    <div className="page page-narrow">
      <div className="page-head">
        <h1>New Meeting</h1>
      </div>
      <MeetingCreateForm kind="meeting" members={members} />
      <p className="back-link">
        <Link href="/">← 목록</Link>
      </p>
    </div>
  )
}
