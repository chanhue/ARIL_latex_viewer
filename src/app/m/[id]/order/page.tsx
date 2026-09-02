import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getMeeting, listPresentations } from '@/lib/db'
import { OrderPicker } from '@/components/OrderPicker'
import { sortSlots } from '@/lib/slots'

export const dynamic = 'force-dynamic'

export default async function OrderPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const meeting = await getMeeting(id)
  if (!meeting) notFound()

  const slots = sortSlots(await listPresentations(id))

  return (
    <div className="page page-narrow">
      <div className="page-head">
        <h1>발표 순서</h1>
      </div>

      <OrderPicker meeting={meeting} slots={slots} />

      <p className="back-link">
        <Link href={`/m/${meeting.id}`}>← {meeting.title}</Link>
      </p>
    </div>
  )
}
