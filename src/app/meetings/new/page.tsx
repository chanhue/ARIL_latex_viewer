import Link from 'next/link'
import { MeetingCreateForm } from '@/components/MeetingCreateForm'

export default function NewMeetingPage() {
  return (
    <div className="page page-narrow">
      <div className="page-head">
        <h1>새 랩미팅</h1>
        <p>날짜를 고르면 폴더가 만들어집니다. 그 안에 각자 이름으로 자료를 올립니다.</p>
      </div>
      <MeetingCreateForm />
      <p className="back-link">
        <Link href="/">← 랩미팅 목록</Link>
      </p>
    </div>
  )
}
