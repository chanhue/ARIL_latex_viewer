export type StoredFile = {
  /** Original file name. This is what PDF links are matched against. */
  name: string
  /** Public URL the browser can fetch. Local: /api/files/... — Vercel: blob URL. */
  url: string
  size: number
  contentType: string
}

export type Presentation = {
  id: string
  title: string
  presenter: string
  /** YYYY-MM-DD */
  date: string
  pdf: StoredFile
  videos: StoredFile[]
  createdAt: string
}

export type PresentationSummary = Omit<Presentation, 'pdf' | 'videos'> & {
  pdfUrl: string
  videoCount: number
}
