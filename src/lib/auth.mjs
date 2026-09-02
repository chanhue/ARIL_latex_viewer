// Shared-password session handling.
//
// Written against Web Crypto only (no node:crypto, no Buffer) because the same
// code has to run in Next.js middleware, which is the Edge runtime. That also
// makes it testable with `node --test`, since Node 20 exposes the same globals.

const encoder = new TextEncoder()

export const AUTH_COOKIE = 'aril_session'
export const SESSION_MAX_AGE = 60 * 60 * 24 * 30 // 30 days

/** The configured lab password, or null when the site is left open. */
export function labPassword(env = process.env) {
  const value = env.LAB_PASSWORD
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

function base64url(bytes) {
  let binary = ''
  for (const byte of new Uint8Array(bytes)) binary += String.fromCharCode(byte)
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

async function hmac(secret, message) {
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  return base64url(await crypto.subtle.sign('HMAC', key, encoder.encode(message)))
}

async function sha256(value) {
  return base64url(await crypto.subtle.digest('SHA-256', encoder.encode(value)))
}

/**
 * Compare without leaking where the first difference is. Both inputs here are
 * fixed-length digests, so the early length check reveals nothing.
 */
export function timingSafeEqual(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') return false
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i += 1) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}

/**
 * Compare a submitted password against the configured one. Both sides are
 * hashed first so the comparison runs in constant time whatever the lengths.
 */
export async function passwordMatches(input, secret) {
  if (typeof input !== 'string' || typeof secret !== 'string' || !secret) return false
  const [a, b] = await Promise.all([sha256(input), sha256(secret)])
  return timingSafeEqual(a, b)
}

/**
 * A session is just a signed expiry stamp — there are no user accounts to
 * carry. Signing with the password itself means changing the password
 * invalidates every outstanding session, which is the behaviour you want when
 * someone leaves the lab.
 */
export async function createSession(secret, now = Date.now()) {
  const payload = String(now + SESSION_MAX_AGE * 1000)
  return `${payload}.${await hmac(secret, payload)}`
}

export async function verifySession(token, secret, now = Date.now()) {
  if (typeof token !== 'string' || !secret) return false
  const dot = token.indexOf('.')
  if (dot <= 0) return false

  const payload = token.slice(0, dot)
  const signature = token.slice(dot + 1)
  if (!/^\d+$/.test(payload)) return false

  // Verify before trusting the expiry: an unsigned stamp means nothing.
  const expected = await hmac(secret, payload)
  if (!timingSafeEqual(signature, expected)) return false

  return Number(payload) > now
}
