import { test } from 'node:test'
import assert from 'node:assert/strict'
import { parseRange } from '../src/lib/http-range.mjs'

const SIZE = 1000

test('no header serves the whole file', () => {
  assert.equal(parseRange(null, SIZE), null)
  assert.equal(parseRange('', SIZE), null)
})

test('open-ended range runs to the last byte', () => {
  assert.deepEqual(parseRange('bytes=0-', SIZE), { start: 0, end: 999 })
  assert.deepEqual(parseRange('bytes=500-', SIZE), { start: 500, end: 999 })
})

test('closed range is inclusive', () => {
  assert.deepEqual(parseRange('bytes=0-499', SIZE), { start: 0, end: 499 })
})

test('range past EOF is clamped, not rejected', () => {
  assert.deepEqual(parseRange('bytes=900-99999', SIZE), { start: 900, end: 999 })
})

test('suffix range returns the tail', () => {
  assert.deepEqual(parseRange('bytes=-200', SIZE), { start: 800, end: 999 })
  // Larger than the file: the whole file.
  assert.deepEqual(parseRange('bytes=-5000', SIZE), { start: 0, end: 999 })
})

test('unsatisfiable ranges are flagged for a 416', () => {
  assert.deepEqual(parseRange('bytes=1000-1200', SIZE), { unsatisfiable: true })
  assert.deepEqual(parseRange('bytes=600-500', SIZE), { unsatisfiable: true })
})

test('malformed and multi-range headers fall back to a full response', () => {
  assert.equal(parseRange('bytes=abc-def', SIZE), null)
  assert.equal(parseRange('items=0-10', SIZE), null)
  assert.equal(parseRange('bytes=0-10, 20-30', SIZE), null)
  assert.equal(parseRange('bytes=-', SIZE), null)
  assert.equal(parseRange('bytes=-0', SIZE), null)
})
