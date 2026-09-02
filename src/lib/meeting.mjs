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
 * Two kinds of event share this whole structure. A lab meeting has several
 * presenters drawn from the roster template; a seminar has exactly one, named
 * when it is created.
 */
export const MEETING_KINDS = ['meeting', 'seminar']

const KIND_LABELS = { meeting: 'LAB Meeting', seminar: 'LAB Seminar' }

/** @param {unknown} kind */
export function isMeetingKind(kind) {
  return typeof kind === 'string' && MEETING_KINDS.includes(kind)
}

/**
 * The auto-generated event name. A second event of the same kind on the same
 * day gets a counter so the name — and therefore the storage folder — stays
 * unique.
 *
 * @param {string} date YYYY-MM-DD
 * @param {string[]} taken titles already in use
 * @param {'meeting'|'seminar'} kind
 */
export function meetingTitleFor(date, taken = [], kind = 'meeting') {
  const short = shortDate(date)
  if (!short) return null

  const label = KIND_LABELS[kind] ?? KIND_LABELS.meeting
  const base = `${short} ${label}`
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

/**
 * Clean up a roster of member names.
 *
 * The roster is the template a new meeting is built from, so the same rules
 * that protect storage paths apply here: a name has to survive sanitising, and
 * two members cannot collapse to the same folder.
 *
 * @param {unknown} input
 * @returns {{members: string[]} | {error: string}}
 */
export function normalizeMembers(input) {
  if (!Array.isArray(input)) return { error: '명단 형식이 올바르지 않습니다.' }
  if (input.length > 100) return { error: '명단이 너무 깁니다. (최대 100명)' }

  const members = []
  for (const raw of input) {
    const name = String(raw ?? '').trim()
    if (!name) continue // blank rows are just empty inputs, not an error

    if (!sanitizeSegment(name)) {
      return { error: `'${name}'은(는) 이름으로 쓸 수 없습니다.` }
    }
    if (name.length > 50) {
      return { error: `'${name.slice(0, 20)}…'은(는) 너무 깁니다.` }
    }
    if (presenterTaken(name, members)) {
      return { error: `'${name}'이(가) 중복됩니다.` }
    }
    members.push(name)
  }
  return { members }
}
