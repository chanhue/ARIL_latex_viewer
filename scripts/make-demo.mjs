/**
 * Builds a demo deck and uploads it to a running dev server.
 *
 *   npm run dev          # in one terminal
 *   npm run demo         # in another
 *
 * The generated PDF exercises every branch of resolveLink():
 *   slide 2  a large placeholder box linked to demo.mp4   -> inline player
 *   slide 3  a word-sized link to demo.mp4                -> badge + lightbox
 *   slide 3  an ordinary https link                       -> stays a hyperlink
 *   slide 4  a link to a file that was never uploaded     -> rendered as nothing
 *
 * Text is English on purpose: the standard PDF fonts have no Hangul, and
 * embedding a Korean face would drag in fontkit just to draw a demo.
 */

import { promises as fs } from 'node:fs'
import { execFile } from 'node:child_process'
import path from 'node:path'
import { promisify } from 'node:util'
import { PDFDocument, PDFName, PDFArray, PDFString, StandardFonts, rgb } from 'pdf-lib'
import ffmpegPath from 'ffmpeg-static'

const run = promisify(execFile)

const OUT_DIR = path.join(process.cwd(), 'demo-assets')
const VIDEO_PATH = path.join(OUT_DIR, 'demo.mp4')
const PDF_PATH = path.join(OUT_DIR, 'demo-slides.pdf')
const SERVER = process.env.DEMO_URL ?? 'http://localhost:4321'

// Beamer with aspectratio=169 is 160mm x 90mm.
const PAGE_WIDTH = (160 / 25.4) * 72
const PAGE_HEIGHT = (90 / 25.4) * 72

const INK = rgb(0.11, 0.13, 0.18)
const MUTED = rgb(0.45, 0.49, 0.56)
const ACCENT = rgb(0.24, 0.49, 0.9)

/** pdf-lib has no link helper, so build the annotation dictionary by hand. */
function addLinkAnnotation(pdfDoc, page, { x, y, width, height, uri }) {
  const annotation = pdfDoc.context.obj({
    Type: 'Annot',
    Subtype: 'Link',
    Rect: [x, y, x + width, y + height],
    // Zero-width border: the viewer draws its own affordance.
    Border: [0, 0, 0],
    F: 4, // print flag
    A: {
      Type: 'Action',
      S: 'URI',
      URI: PDFString.of(uri),
    },
  })
  const ref = pdfDoc.context.register(annotation)

  let annots = page.node.lookup(PDFName.of('Annots'), PDFArray)
  if (!annots) {
    annots = pdfDoc.context.obj([])
    page.node.set(PDFName.of('Annots'), annots)
  }
  annots.push(ref)
}

async function buildVideo() {
  if (!ffmpegPath) throw new Error('ffmpeg-static did not provide a binary')
  await run(ffmpegPath, [
    '-y',
    '-f', 'lavfi',
    '-i', 'testsrc2=size=640x360:rate=25:duration=8',
    '-pix_fmt', 'yuv420p',
    '-c:v', 'libx264',
    '-preset', 'veryfast',
    // Lets the browser start playing before the whole file arrives.
    '-movflags', '+faststart',
    VIDEO_PATH,
  ])
  const { size } = await fs.stat(VIDEO_PATH)
  console.log(`[demo] demo.mp4        ${(size / 1024).toFixed(0)} KB`)
}

async function buildPdf() {
  const pdfDoc = await PDFDocument.create()
  const bold = await pdfDoc.embedFont(StandardFonts.HelveticaBold)
  const regular = await pdfDoc.embedFont(StandardFonts.Helvetica)

  const newPage = () => {
    const page = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT])
    page.drawRectangle({ x: 0, y: 0, width: PAGE_WIDTH, height: PAGE_HEIGHT, color: rgb(1, 1, 1) })
    return page
  }

  const heading = (page, text) => {
    page.drawText(text, { x: 34, y: PAGE_HEIGHT - 46, size: 19, font: bold, color: INK })
    page.drawLine({
      start: { x: 34, y: PAGE_HEIGHT - 56 },
      end: { x: PAGE_WIDTH - 34, y: PAGE_HEIGHT - 56 },
      thickness: 0.8,
      color: rgb(0.85, 0.87, 0.9),
    })
  }

  /* ---- 1. title ---- */
  const title = newPage()
  title.drawText('Video-in-Slide Demo', { x: 34, y: PAGE_HEIGHT - 110, size: 28, font: bold, color: INK })
  title.drawText('ARIL Lab Meeting', { x: 34, y: PAGE_HEIGHT - 140, size: 14, font: regular, color: MUTED })
  title.drawText(new Date().toISOString().slice(0, 10), {
    x: 34, y: 40, size: 10, font: regular, color: MUTED,
  })

  /* ---- 2. inline player ---- */
  const inline = newPage()
  heading(inline, 'Inline player')
  inline.drawText('The box below is an image hyperlinked to demo.mp4.', {
    x: 34, y: PAGE_HEIGHT - 80, size: 11, font: regular, color: MUTED,
  })

  const box = { x: 34, y: 48, width: 240, height: 120 }
  inline.drawRectangle({
    ...box,
    color: rgb(0.93, 0.95, 0.98),
    borderColor: ACCENT,
    borderWidth: 1,
  })
  inline.drawText('demo.mp4', {
    x: box.x + 12, y: box.y + box.height / 2 - 4, size: 13, font: bold, color: ACCENT,
  })
  // `?loop` makes the viewer loop it muted, the usual case for a result clip.
  addLinkAnnotation(pdfDoc, inline, { ...box, uri: 'run:demo.mp4?loop' })

  inline.drawText('The viewer replaces exactly this', {
    x: 300, y: 140, size: 10, font: regular, color: MUTED,
  })
  inline.drawText('rectangle with a real <video>.', {
    x: 300, y: 126, size: 10, font: regular, color: MUTED,
  })

  /* ---- 3. small link + external link ---- */
  const small = newPage()
  heading(small, 'Small link and a normal link')

  const clipLabel = 'Watch the clip (demo.mp4)'
  const clipWidth = regular.widthOfTextAtSize(clipLabel, 12)
  small.drawText(clipLabel, { x: 34, y: PAGE_HEIGHT - 92, size: 12, font: regular, color: ACCENT })
  addLinkAnnotation(pdfDoc, small, {
    x: 34, y: PAGE_HEIGHT - 96, width: clipWidth, height: 16, uri: 'demo.mp4',
  })
  small.drawText('-> too small for a player, so it becomes a badge that opens a lightbox.', {
    x: 34, y: PAGE_HEIGHT - 112, size: 9, font: regular, color: MUTED,
  })

  const paperLabel = 'arxiv.org/abs/2501.00001'
  const paperWidth = regular.widthOfTextAtSize(paperLabel, 12)
  small.drawText(paperLabel, { x: 34, y: PAGE_HEIGHT - 150, size: 12, font: regular, color: ACCENT })
  addLinkAnnotation(pdfDoc, small, {
    x: 34, y: PAGE_HEIGHT - 154, width: paperWidth, height: 16,
    uri: 'https://arxiv.org/abs/2501.00001',
  })
  small.drawText('-> not a video, so it stays an ordinary hyperlink.', {
    x: 34, y: PAGE_HEIGHT - 170, size: 9, font: regular, color: MUTED,
  })

  /* ---- 4. dead link ---- */
  const dead = newPage()
  heading(dead, 'Missing file')
  const deadLabel = 'never-uploaded.mp4'
  const deadWidth = regular.widthOfTextAtSize(deadLabel, 12)
  dead.drawText(deadLabel, { x: 34, y: PAGE_HEIGHT - 92, size: 12, font: regular, color: MUTED })
  addLinkAnnotation(pdfDoc, dead, {
    x: 34, y: PAGE_HEIGHT - 96, width: deadWidth, height: 16, uri: 'run:never-uploaded.mp4',
  })
  dead.drawText('-> the file was not uploaded, so the viewer renders no overlay at all.', {
    x: 34, y: PAGE_HEIGHT - 112, size: 9, font: regular, color: MUTED,
  })

  /* ---- 5. closing ---- */
  const end = newPage()
  end.drawText('Questions?', { x: 34, y: PAGE_HEIGHT / 2, size: 26, font: bold, color: INK })

  const bytes = await pdfDoc.save()
  await fs.writeFile(PDF_PATH, bytes)
  console.log(`[demo] demo-slides.pdf ${(bytes.length / 1024).toFixed(0)} KB, ${pdfDoc.getPageCount()} pages`)
}

/** The dev server may be behind the shared lab password; log in if so. */
async function sessionCookie() {
  const password = process.env.LAB_PASSWORD?.trim()
  if (!password) return null

  const response = await fetch(`${SERVER}/api/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password }),
  })
  if (!response.ok) throw new Error('LAB_PASSWORD is set but the login was rejected')

  const setCookie = response.headers.get('set-cookie')
  if (!setCookie) throw new Error('login succeeded but returned no session cookie')
  return setCookie.split(';')[0]
}

async function upload() {
  const [pdfBytes, videoBytes] = await Promise.all([
    fs.readFile(PDF_PATH),
    fs.readFile(VIDEO_PATH),
  ])

  const form = new FormData()
  form.set('title', 'Video-in-Slide Demo')
  form.set('presenter', 'ARIL')
  form.set('date', new Date().toISOString().slice(0, 10))
  form.set('pdf', new File([pdfBytes], 'demo-slides.pdf', { type: 'application/pdf' }))
  form.append('videos', new File([videoBytes], 'demo.mp4', { type: 'video/mp4' }))

  const cookie = await sessionCookie()
  const response = await fetch(`${SERVER}/api/upload`, {
    method: 'POST',
    body: form,
    headers: cookie ? { cookie } : undefined,
  })
  const payload = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(payload.error ?? `upload failed (${response.status})`)

  console.log(`[demo] uploaded -> ${SERVER}/p/${payload.id}`)
  return payload.id
}

async function main() {
  await fs.mkdir(OUT_DIR, { recursive: true })
  await buildVideo()
  await buildPdf()

  try {
    await upload()
  } catch (err) {
    console.error(`[demo] could not upload to ${SERVER}: ${err.message}`)
    console.error('[demo] the files are in demo-assets/ — start `npm run dev` and upload them at /upload')
    process.exitCode = 1
  }
}

main().catch((err) => {
  console.error('[demo] failed:', err)
  process.exit(1)
})
