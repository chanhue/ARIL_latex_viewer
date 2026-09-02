import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  shortDate,
  meetingTitleFor,
  sanitizeSegment,
  storageKey,
  presenterTaken,
} from '../src/lib/meeting.mjs'

test('shortDate renders the lab folder convention', () => {
  assert.equal(shortDate('2026-09-02'), '26.09.02')
  assert.equal(shortDate('2026-12-31'), '26.12.31')
  assert.equal(shortDate('2026-9-2'), null)
  assert.equal(shortDate(''), null)
  assert.equal(shortDate(null), null)
})

test('meetingTitleFor builds the auto name', () => {
  assert.equal(meetingTitleFor('2026-09-02'), '26.09.02 LAB Meeting')
})

test('a second meeting on the same day gets a counter', () => {
  const taken = ['26.09.02 LAB Meeting']
  assert.equal(meetingTitleFor('2026-09-02', taken), '26.09.02 LAB Meeting (2)')
  assert.equal(
    meetingTitleFor('2026-09-02', [...taken, '26.09.02 LAB Meeting (2)']),
    '26.09.02 LAB Meeting (3)',
  )
  // A different date is unaffected by what is taken.
  assert.equal(meetingTitleFor('2026-09-09', taken), '26.09.09 LAB Meeting')
})

test('sanitizeSegment keeps Hangul and spaces', () => {
  assert.equal(sanitizeSegment('김찬희'), '김찬희')
  assert.equal(sanitizeSegment('26.09.02 LAB Meeting'), '26.09.02 LAB Meeting')
  assert.equal(sanitizeSegment('  홍 길동  '), '홍 길동')
})

test('sanitizeSegment strips path-breaking characters', () => {
  assert.equal(sanitizeSegment('a/b'), 'ab')
  assert.equal(sanitizeSegment('a\\b'), 'ab')
  assert.equal(sanitizeSegment('a:b*c?d'), 'abcd')
  assert.equal(sanitizeSegment('..'), '')
  assert.equal(sanitizeSegment('...'), '')
  // A leading dot on a real name is fine; only an all-dots segment is dropped.
  assert.equal(sanitizeSegment('.hidden'), '.hidden')
  assert.equal(sanitizeSegment(''), '')
  assert.equal(sanitizeSegment(null), '')
})

test('storageKey mirrors the folder layout', () => {
  assert.equal(
    storageKey({
      meetingFolder: '26.09.02 LAB Meeting',
      presenter: '김찬희',
      fileName: 'slides.pdf',
      kind: 'pdf',
    }),
    '26.09.02 LAB Meeting/김찬희/slides.pdf',
  )
  assert.equal(
    storageKey({
      meetingFolder: '26.09.02 LAB Meeting',
      presenter: '김찬희',
      fileName: 'demo.mp4',
      kind: 'video',
    }),
    '26.09.02 LAB Meeting/김찬희/figs/demo.mp4',
  )
})

test('storageKey refuses a segment that sanitises away', () => {
  const base = { meetingFolder: '26.09.02 LAB Meeting', fileName: 'a.pdf', kind: 'pdf' }
  assert.equal(storageKey({ ...base, presenter: '..' }), null)
  assert.equal(storageKey({ ...base, presenter: '' }), null)
  assert.equal(storageKey({ ...base, presenter: '김', fileName: '/' }), null)
})

test('storageKey cannot escape its folder', () => {
  const key = storageKey({
    meetingFolder: '26.09.02 LAB Meeting',
    presenter: '../../etc',
    fileName: 'passwd',
    kind: 'pdf',
  })

  // The safety property is not "contains no dots" — `....etc` is a perfectly
  // ordinary directory name. It is that no *segment* is `.` or `..`, and that
  // the caller's input contributed no separators of its own.
  const segments = key.split('/')
  assert.deepEqual(segments, ['26.09.02 LAB Meeting', '....etc', 'passwd'])
  for (const segment of segments) {
    assert.ok(segment !== '.' && segment !== '..', `traversal segment: ${segment}`)
  }
})

test('storageKey puts every video under the same figs/ folder', () => {
  const of = (fileName) =>
    storageKey({ meetingFolder: 'M', presenter: 'P', fileName, kind: 'video' })
  assert.equal(of('a.mp4'), 'M/P/figs/a.mp4')
  // A name carrying its own path must not create a nested folder.
  assert.equal(of('sub/dir/b.mp4'), 'M/P/figs/subdirb.mp4')
})

test('presenterTaken compares names as folders would', () => {
  const existing = ['김찬희', '홍 길동']
  assert.equal(presenterTaken('김찬희', existing), true)
  assert.equal(presenterTaken('  김찬희 ', existing), true)
  assert.equal(presenterTaken('홍  길동', existing), true)
  assert.equal(presenterTaken('이영희', existing), false)
  assert.equal(presenterTaken('', existing), false)
})

test('normalizeMembers drops blanks and keeps order', async () => {
  const { normalizeMembers } = await import('../src/lib/meeting.mjs')
  assert.deepEqual(normalizeMembers(['김찬희', '', '  ', '홍길동']), {
    members: ['김찬희', '홍길동'],
  })
  assert.deepEqual(normalizeMembers([]), { members: [] })
  assert.deepEqual(normalizeMembers(['  여백  ']), { members: ['여백'] })
})

test('normalizeMembers rejects duplicates and unusable names', async () => {
  const { normalizeMembers } = await import('../src/lib/meeting.mjs')
  assert.ok('error' in normalizeMembers(['김찬희', '김찬희']))
  // Same folder after sanitising counts as a duplicate.
  assert.ok('error' in normalizeMembers(['홍 길동', '홍  길동']))
  assert.ok('error' in normalizeMembers(['..']))
  assert.ok('error' in normalizeMembers(['/']))
  assert.ok('error' in normalizeMembers('not an array'))
  assert.ok('error' in normalizeMembers(['x'.repeat(51)]))
  assert.ok('error' in normalizeMembers(new Array(101).fill(0).map((_, i) => `p${i}`)))
})
