// Single-range `Range: bytes=...` parsing, per RFC 7233.
// Dependency-free so it can be unit-tested directly with `node --test`.

/**
 * @param {string|null} header raw Range header value
 * @param {number} size total size of the file in bytes
 * @returns {{start:number,end:number}|{unsatisfiable:true}|null}
 *   null      -> ignore the header, serve the whole file (200)
 *   range     -> serve 206 with those inclusive byte offsets
 *   unsatisf. -> serve 416
 */
export function parseRange(header, size) {
  if (!header) return null
  const match = /^bytes=(\d*)-(\d*)$/.exec(String(header).trim())
  if (!match) return null

  const [, rawStart, rawEnd] = match
  if (rawStart === '' && rawEnd === '') return null

  let start
  let end
  if (rawStart === '') {
    // Suffix form: `bytes=-500` means "the last 500 bytes".
    const suffix = Number(rawEnd)
    if (!Number.isFinite(suffix) || suffix <= 0) return null
    start = Math.max(0, size - suffix)
    end = size - 1
  } else {
    start = Number(rawStart)
    end = rawEnd === '' ? size - 1 : Number(rawEnd)
  }

  if (!Number.isFinite(start) || !Number.isFinite(end)) return null
  if (start > end || start >= size) return { unsatisfiable: true }
  return { start, end: Math.min(end, size - 1) }
}
