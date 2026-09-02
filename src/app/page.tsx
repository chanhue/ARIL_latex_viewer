import Link from 'next/link'
import { listPresentations } from '@/lib/db'

export const dynamic = 'force-dynamic'

function formatDate(date: string) {
  const [year, month, day] = date.split('-')
  return `${year}. ${month}. ${day}`
}

export default async function HomePage() {
  const presentations = await listPresentations()

  return (
    <div className="page">
      <div className="page-head">
        <h1>발표 자료</h1>
        <p>PDF를 올리면 슬라이드 안의 영상 링크가 그 자리에서 바로 재생됩니다.</p>
      </div>

      {presentations.length === 0 ? (
        <div className="empty">
          <p>아직 올라온 발표가 없습니다.</p>
          <Link href="/upload" className="button button-primary">첫 발표 올리기</Link>
        </div>
      ) : (
        <ul className="deck-list">
          {presentations.map((item) => (
            <li key={item.id}>
              <Link href={`/p/${item.id}`}>
                <span className="deck-list-date">{formatDate(item.date)}</span>
                <span className="deck-list-title">{item.title}</span>
                <span className="deck-list-meta">
                  {item.presenter}
                  {item.videoCount > 0 && <em>영상 {item.videoCount}개</em>}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
