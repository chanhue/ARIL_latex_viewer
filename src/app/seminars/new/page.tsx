import Link from 'next/link'
import { MeetingCreateForm } from '@/components/MeetingCreateForm'

export const dynamic = 'force-dynamic'

export default function NewSeminarPage() {
  return (
    <div className="page page-narrow">
      <div className="page-head">
        <h1>New Seminar</h1>
      </div>
      <MeetingCreateForm kind="seminar" members={[]} />
      <p className="back-link">
        <Link href="/">← 목록</Link>
      </p>
    </div>
  )
}
