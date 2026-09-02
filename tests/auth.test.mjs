import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  labPassword,
  passwordMatches,
  timingSafeEqual,
  createSession,
  verifySession,
  SESSION_MAX_AGE,
} from '../src/lib/auth.mjs'

const SECRET = 'lab-meeting-2026'

test('labPassword treats blank as unset (site stays open)', () => {
  assert.equal(labPassword({ LAB_PASSWORD: 'hunter2' }), 'hunter2')
  assert.equal(labPassword({ LAB_PASSWORD: '  padded  ' }), 'padded')
  assert.equal(labPassword({ LAB_PASSWORD: '' }), null)
  assert.equal(labPassword({ LAB_PASSWORD: '   ' }), null)
  assert.equal(labPassword({}), null)
})

test('passwordMatches accepts only the exact password', async () => {
  assert.equal(await passwordMatches(SECRET, SECRET), true)
  assert.equal(await passwordMatches('wrong', SECRET), false)
  assert.equal(await passwordMatches('', SECRET), false)
  // A prefix must not pass.
  assert.equal(await passwordMatches('lab-meeting-202', SECRET), false)
  assert.equal(await passwordMatches(SECRET + 'x', SECRET), false)
})

test('passwordMatches refuses when no password is configured', async () => {
  assert.equal(await passwordMatches('anything', ''), false)
  assert.equal(await passwordMatches('anything', null), false)
})

test('a fresh session verifies', async () => {
  const token = await createSession(SECRET)
  assert.equal(await verifySession(token, SECRET), true)
})

test('a session does not verify under a different password', async () => {
  const token = await createSession(SECRET)
  // Changing the lab password must log everyone out.
  assert.equal(await verifySession(token, 'new-password'), false)
})

test('a tampered expiry is rejected', async () => {
  const token = await createSession(SECRET)
  const [, signature] = token.split('.')
  const forged = `${Date.now() + 999_999_999}.${signature}`
  assert.equal(await verifySession(forged, SECRET), false)
})

test('an expired session is rejected', async () => {
  const issued = Date.now() - (SESSION_MAX_AGE + 60) * 1000
  const token = await createSession(SECRET, issued)
  assert.equal(await verifySession(token, SECRET), false)
  // ...but was valid when it was issued.
  assert.equal(await verifySession(token, SECRET, issued + 1000), true)
})

test('malformed tokens are rejected without throwing', async () => {
  for (const bad of ['', '.', 'abc', 'abc.def', '.sig', '123', null, undefined, 12345]) {
    assert.equal(await verifySession(bad, SECRET), false)
  }
})

test('timingSafeEqual is a plain equality check', () => {
  assert.equal(timingSafeEqual('abc', 'abc'), true)
  assert.equal(timingSafeEqual('abc', 'abd'), false)
  assert.equal(timingSafeEqual('abc', 'abcd'), false)
  assert.equal(timingSafeEqual('abc', null), false)
})
