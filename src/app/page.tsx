import Link from 'next/link'
import { listMeetings } from '@/lib/db'

export const dynamic = 'force-dynamic'

export default async function HomePage() {
  const meetings = await listMeetings()

  return (
    <div className="page">
      <div className="page-head">
        <h1>랩미팅</h1>
        <p>회차를 만들고, 각자 자기 이름 아래에 발표 자료와 영상을 올립니다.</p>
      </div>

      {meetings.length === 0 ? (
        <div className="empty">
          <p>아직 만들어진 랩미팅이 없습니다.</p>
          <Link href="/meetings/new" className="button button-primary">첫 랩미팅 만들기</Link>
        </div>
      ) : (
        <ul className="meeting-list">
          {meetings.map((meeting) => (
            <li key={meeting.id}>
              <Link href={`/m/${meeting.id}`}>
                <span className="meeting-title">{meeting.title}</span>
                <span className="meeting-meta">
                  {meeting.slotCount === 0 ? (
                    <em className="pending">발표자 없음</em>
                  ) : (
                    <>
                      <span className="meeting-people">{meeting.presenters.join(', ')}</span>
                      {meeting.uploadedCount < meeting.slotCount ? (
                        <em className="pending">
                          {meeting.slotCount - meeting.uploadedCount}명 미제출
                        </em>
                      ) : (
                        <em className="done">전원 제출</em>
                      )}
                    </>
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
