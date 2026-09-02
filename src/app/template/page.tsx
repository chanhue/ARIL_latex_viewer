import Link from 'next/link'
import { getTemplate } from '@/lib/db'
import { TemplateEditor } from '@/components/TemplateEditor'

export const dynamic = 'force-dynamic'

export default async function TemplatePage() {
  const members = await getTemplate()

  return (
    <div className="page page-narrow">
      <div className="page-head">
        <h1>템플릿</h1>
        <p>
          랩미팅을 만들 때 이 명단대로 발표자 슬롯이 생깁니다. 날짜만 고르면 되도록
          여기에 한 번 저장해 두세요. 세미나는 이 명단을 쓰지 않습니다.
        </p>
      </div>

      <TemplateEditor initialMembers={members} />

      <p className="back-link">
        <Link href="/">← 목록</Link>
      </p>
    </div>
  )
}
