import Link from 'next/link'
import { listMeetings } from '@/lib/db'

export const dynamic = 'force-dynamic'

export default async function HomePage() {
  const meetings = await listMeetings()

  return (
    <div className="page">
      <div className="page-head page-head-row">
        <div>
          {/* English heading with a Korean line under it, the way the lab site
              sets an English title over Korean detail. */}
          <h1>Lab Meetings</h1>
          <p>회차를 만들고, 각자 자기 이름 아래에 발표 자료와 영상을 올립니다.</p>
        </div>
        <div className="page-actions">
          <Link href="/template" className="button">템플릿</Link>
          <Link href="/meetings/new" className="button button-primary">새 랩미팅</Link>
        </div>
      </div>

      {meetings.length === 0 ? (
        <div className="empty">
          <p>No meetings yet.</p>
          <Link href="/meetings/new" className="button button-primary">첫 랩미팅 만들기</Link>
        </div>
      ) : (
        <ul className="meeting-list">
          {meetings.map((meeting) => (
            <li key={meeting.id}>
              <Link href={`/m/${meeting.id}`}>
                <span className="meeting-title">{meeting.title}</span>
                <span className="meeting-meta">
                  {meeting.uploadedCount === 0 ? (
                    <em className="pending">발표자 없음</em>
                  ) : (
                    <em className="done">발표자 {meeting.uploadedCount}명</em>
                  )}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
