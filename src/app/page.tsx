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
  // every week, seminars are one guest at a time. Side by side rather than
  // stacked, so neither buries the other and both are one glance away.
  const meetings = all.filter((item) => item.kind === 'meeting')
  const seminars = all.filter((item) => item.kind === 'seminar')

  return (
    <div className="page page-wide">
      {/* Deciding who presents is not a property of either list, so it sits
          above both rather than inside one of them. */}
      <div className="page-toolbar">
        <Link href="/order" className="button">진행 여부</Link>
      </div>

      <div className="home-columns">
      <section className="section">
        <div className="section-head">
          <h1>Lab Meetings</h1>
          <div className="page-actions">
            <Link href="/template" className="button">템플릿</Link>
            <Link
              href="/meetings/new"
              className="button button-primary button-add"
              aria-label="새 랩미팅"
              title="새 랩미팅"
            >
              +
            </Link>
          </div>
        </div>
        <EventList items={meetings} emptyText="No meetings yet." />
      </section>

      <section className="section">
        <div className="section-head">
          <h2>Lab Seminars</h2>
          <div className="page-actions">
            <Link
              href="/seminars/new"
              className="button button-primary button-add"
              aria-label="새 랩세미나"
              title="새 랩세미나"
            >
              +
            </Link>
          </div>
        </div>
        <EventList items={seminars} emptyText="No seminars yet." />
      </section>
      </div>
    </div>
  )
}
