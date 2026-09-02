// Pure logic that decides what a PDF hyperlink should turn into.
// Kept dependency-free (.mjs) so it can be unit-tested with `node --test`
// without a build step. Imported by both the client Deck and the tests.

const VIDEO_EXTENSIONS = new Set(['mp4', 'webm', 'ogv', 'ogg', 'm4v', 'mov'])

// hyperref/Beamer emit a handful of pseudo-schemes for "open this local file".
// `\href{run:demo.mp4}` and `\href{file:demo.mp4}` are the common ones.
const LOCAL_SCHEMES = /^(run|file|video|media):(\/\/)?/i

/**
 * Reduce a raw annotation URL to a comparable file name.
 * `run:./videos/Demo.MP4?loop=1#t=3` -> `demo.mp4`
 * @param {string} rawUrl
 * @returns {string|null} lowercased basename, or null if it has no usable name
 */
export function linkBasename(rawUrl) {
  if (typeof rawUrl !== 'string') return null
  let s = rawUrl.trim()
  if (!s) return null

  s = s.replace(LOCAL_SCHEMES, '')
  // Drop query and fragment before looking at the extension.
  s = s.split('#')[0].split('?')[0]
  // Normalise Windows separators that sometimes survive in PDFs.
  s = s.replace(/\\/g, '/')

  const last = s.split('/').filter(Boolean).pop()
  if (!last) return null

  let name
  try {
    name = decodeURIComponent(last)
  } catch {
    name = last // malformed percent-encoding: use it as-is rather than throwing
  }
  return name.toLowerCase()
}

/** @param {string} rawUrl */
export function extensionOf(rawUrl) {
  const base = linkBasename(rawUrl)
  if (!base) return null
  const dot = base.lastIndexOf('.')
  if (dot <= 0 || dot === base.length - 1) return null
  return base.slice(dot + 1)
}

/** Does this link point at something we should render as a <video>? */
export function isVideoLink(rawUrl) {
  const ext = extensionOf(rawUrl)
  return ext !== null && VIDEO_EXTENSIONS.has(ext)
}

function isAbsoluteHttp(rawUrl) {
  return /^https?:\/\//i.test(String(rawUrl ?? '').trim())
}

/**
 * Decide what a link annotation becomes on screen.
 *
 * Resolution order, deliberately forgiving because the author writes the link
 * in LaTeX long before they know what the upload will be called:
 *   1. basename matches an uploaded video  -> play the uploaded file
 *   2. video extension + absolute http(s)  -> play that remote URL directly
 *   3. anything else                       -> stays an ordinary hyperlink
 *
 * @param {string} rawUrl
 * @param {Array<{name: string, url: string}>} videos uploaded alongside the PDF
 * @returns {{kind:'video', src:string, name:string, source:'upload'|'remote'}
 *          |{kind:'link', href:string}
 *          |null}
 */
export function resolveLink(rawUrl, videos = []) {
  const raw = typeof rawUrl === 'string' ? rawUrl.trim() : ''
  if (!raw) return null

  const base = linkBasename(raw)

  if (base) {
    const hit = videos.find((v) => String(v.name).toLowerCase() === base)
    if (hit) return { kind: 'video', src: hit.url, name: hit.name, source: 'upload' }
  }

  if (isVideoLink(raw) && isAbsoluteHttp(raw)) {
    return { kind: 'video', src: raw, name: base ?? raw, source: 'remote' }
  }

  // A bare `run:`/`file:` target we could not resolve is a dead link, not a
  // hyperlink worth rendering — the file simply was not uploaded.
  if (LOCAL_SCHEMES.test(raw)) return null

  return { kind: 'link', href: raw }
}

/**
 * A link drawn around a word is far too small to host a player. Above this
 * size we inline the video; below it we drop a badge that opens a lightbox.
 * Measured against the rendered slide, so it scales with the viewport.
 */
export function isInlineSize(width, height, slideWidth, slideHeight) {
  if (!(slideWidth > 0) || !(slideHeight > 0)) return false
  return width / slideWidth >= 0.12 && height / slideHeight >= 0.12
}

/**
 * Playback flags carried on the link itself, so the author controls them from
 * LaTeX without touching the site: `\href{demo.mp4?loop&muted}{...}`.
 * Recognised anywhere in the query or fragment.
 *
 * @param {string} rawUrl
 * @returns {{autoplay:boolean, loop:boolean, muted:boolean}}
 */
export function videoOptions(rawUrl) {
  const s = String(rawUrl ?? '')
  const cut = s.search(/[?#]/)
  const tail = cut === -1 ? '' : s.slice(cut + 1).toLowerCase()
  const has = (flag) => new RegExp(`(^|[?#&,;])${flag}(=(1|true|yes))?([&,;#]|$)`).test(tail)

  const loop = has('loop')
  const autoplay = has('autoplay')
  // Browsers block autoplay with sound; muting is the only way it actually
  // starts. Looping a result clip implies it is ambient, so mute that too.
  const muted = has('muted') || autoplay || loop
  return { autoplay, loop, muted }
}
