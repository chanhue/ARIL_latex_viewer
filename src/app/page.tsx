import Link from 'next/link'
import { listMeetings } from '@/lib/db'
import type { MeetingSummary } from '@/lib/types'

export const dynamic = 'force-dynamic'

function EventList({ items, emptyText }: { items: MeetingSummary[]; emptyText: string }) {
  if (items.length === 0) {
    return (
      <div className="empty">
        <p>{emptyText}</p>
      </div>
    )
  }

  return (
    <ul className="meeting-list">
      {items.map((item) => (
        <li key={item.id}>
          <Link href={`/m/${item.id}`}>
            <span className="meeting-title">{item.title}</span>
            <span className="meeting-meta">
              {item.uploadedCount === 0 ? (
                <em className="pending">발표자 없음</em>
              ) : (
                <em className="done">발표자 {item.uploadedCount}명</em>
              )}
            </span>
          </Link>
        </li>
      ))}
    </ul>
  )
}

export default async function HomePage() {
  const all = await listMeetings()

  // Same structure, different rhythm: meetings come from the roster template
  // every week, seminars are one guest at a time. Keeping them in separate
  // lists means neither buries the other.
  const meetings = all.filter((item) => item.kind === 'meeting')
  const seminars = all.filter((item) => item.kind === 'seminar')

  return (
    <div className="page">
      <section className="section">
        <div className="page-head page-head-row">
          <div>
            <h1>Lab Meetings</h1>
            <p>회차를 만들고, 각자 자기 이름 아래에 발표 자료와 영상을 올립니다.</p>
          </div>
          <div className="page-actions">
            <Link href="/template" className="button">템플릿</Link>
            <Link href="/meetings/new" className="button button-primary">새 랩미팅</Link>
          </div>
        </div>
        <EventList items={meetings} emptyText="No meetings yet." />
      </section>

      <section className="section">
        <div className="page-head page-head-row">
          <div>
            <h2>Lab Seminars</h2>
            <p>발표자 한 명이 진행합니다. 날짜와 이름만 정하면 됩니다.</p>
          </div>
          <div className="page-actions">
            <Link href="/seminars/new" className="button button-primary">새 랩세미나</Link>
          </div>
        </div>
        <EventList items={seminars} emptyText="No seminars yet." />
      </section>
    </div>
  )
}
