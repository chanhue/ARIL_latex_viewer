import Link from 'next/link'
import { MeetingCreateForm } from '@/components/MeetingCreateForm'

export const dynamic = 'force-dynamic'

export default function NewSeminarPage() {
  return (
    <div className="page page-narrow">
      <div className="page-head">
        <h1>New Seminar</h1>
        <p>날짜와 발표자 한 명을 정하면 폴더가 만들어집니다.</p>
      </div>
      <MeetingCreateForm kind="seminar" members={[]} />
      <p className="back-link">
        <Link href="/">← 목록</Link>
      </p>
    </div>
  )
}
