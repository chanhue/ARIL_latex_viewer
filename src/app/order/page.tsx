import Link from 'next/link'
import { getRunOrder, getTemplate } from '@/lib/db'
import { OrderPicker } from '@/components/OrderPicker'

export const dynamic = 'force-dynamic'

export default async function OrderPage() {
  const [members, order] = await Promise.all([getTemplate(), getRunOrder()])

  // The checklist is something you scan for a name, so it goes in name order.
  // The drawn order below is separate and stays as drawn.
  const roster = members.slice().sort((a, b) => a.localeCompare(b, 'ko'))

  return (
    <div className="page page-narrow">
      <div className="page-head">
        <h1>진행 여부</h1>
      </div>

      <OrderPicker members={roster} initialOrder={order} />

      <p className="back-link">
        <Link href="/">← 목록</Link>
      </p>
    </div>
  )
}
