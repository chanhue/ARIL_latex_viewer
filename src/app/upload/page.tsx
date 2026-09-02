import { UploadForm, type UploadMode } from '@/components/UploadForm'

export const dynamic = 'force-dynamic'

export default function UploadPage() {
  // Decided on the server: the browser must not have to guess whether direct
  // Blob upload is configured.
  const mode: UploadMode = process.env.BLOB_READ_WRITE_TOKEN ? 'blob' : 'multipart'

  return (
    <div className="page page-narrow">
      <div className="page-head">
        <h1>발표 올리기</h1>
        <p>
          PDF 안에 <code>{'\\href{run:demo.mp4}{...}'}</code> 로 링크를 걸어두고, 같은 이름의 영상
          파일을 함께 올리면 그 링크 자리에서 영상이 재생됩니다.
        </p>
      </div>

      <UploadForm mode={mode} />
    </div>
  )
}
