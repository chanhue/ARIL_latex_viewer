// Naming rules for the meeting -> person -> files hierarchy.
//
//   26.09.02 LAB Meeting/
//     김찬희/
//       slides.pdf
//       figs/
//         demo.mp4
//
// `figs/` matches where a LaTeX project keeps its figures, so a link written as
// \href{figs/demo.mp4}{...} points at the same place in the source tree and in
// the uploaded folder. (Matching only ever compares file names, so the path in
// the link does not actually have to agree — but it reads better when it does.)
//
// Kept dependency-free so `node --test` can cover it, and shared by the upload
// route (which builds storage keys) and the UI (which shows the tree).

/** `2026-09-02` -> `26.09.02` */
export function shortDate(date) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(date ?? '').trim())
  if (!match) return null
  const [, year, month, day] = match
  return `${year.slice(2)}.${month}.${day}`
}

/**
 * The auto-generated meeting name. A second meeting on the same day gets a
 * counter so the name — and therefore the storage folder — stays unique.
 *
 * @param {string} date YYYY-MM-DD
 * @param {string[]} taken titles already in use
 */
export function meetingTitleFor(date, taken = []) {
  const short = shortDate(date)
  if (!short) return null

  const base = `${short} LAB Meeting`
  const used = new Set(taken.map((t) => String(t).trim()))
  if (!used.has(base)) return base

  for (let n = 2; n < 1000; n += 1) {
    const candidate = `${base} (${n})`
    if (!used.has(candidate)) return candidate
  }
  return `${base} (${Date.now()})`
}

/**
 * Turn a display name into one safe storage path segment.
 *
 * Hangul and spaces are kept — the whole point is that the Blob dashboard and
 * the local .data directory stay readable. Only characters that would break a
 * path or escape it are removed.
 */
export function sanitizeSegment(name) {
  const cleaned = String(name ?? '')
    .replace(/[\u0000-\u001f\u007f]/g, '')
    .replace(/[/\\?%*:|"<>]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    // A segment of only dots would resolve to the parent directory.
    .replace(/^\.+$/, '')
  return cleaned
}

/** Subfolder holding a presenter's videos, mirroring a LaTeX project's figs/. */
export const MEDIA_FOLDER = 'figs'

/**
 * Storage key for one uploaded file.
 * Videos go in `figs/`; the PDF sits at the person's root.
 */
export function storageKey({ meetingFolder, presenter, fileName, kind }) {
  const meeting = sanitizeSegment(meetingFolder)
  const person = sanitizeSegment(presenter)
  const file = sanitizeSegment(fileName)
  if (!meeting || !person || !file) return null
  return kind === 'video'
    ? `${meeting}/${person}/${MEDIA_FOLDER}/${file}`
    : `${meeting}/${person}/${file}`
}

/** Two people in one meeting cannot share a name — the folders would collide. */
export function presenterTaken(presenter, existing = []) {
  const target = sanitizeSegment(presenter).toLowerCase()
  if (!target) return false
  return existing.some((name) => sanitizeSegment(name).toLowerCase() === target)
}
