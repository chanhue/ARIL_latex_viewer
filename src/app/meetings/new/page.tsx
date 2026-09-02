import Link from 'next/link'
import { getTemplate } from '@/lib/db'
import { MeetingCreateForm } from '@/components/MeetingCreateForm'

export const dynamic = 'force-dynamic'

export default async function NewMeetingPage() {
  const members = await getTemplate()

  return (
    <div className="page page-narrow">
      <div className="page-head">
        <h1>새 랩미팅</h1>
        <p>날짜를 고르면 템플릿 명단대로 폴더와 슬롯이 만들어집니다.</p>
      </div>
      <MeetingCreateForm members={members} />
      <p className="back-link">
        <Link href="/">← 랩미팅 목록</Link>
      </p>
    </div>
  )
}
