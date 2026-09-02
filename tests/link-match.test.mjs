import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  linkBasename,
  isVideoLink,
  resolveLink,
  isInlineSize,
} from '../src/lib/link-match.mjs'

const videos = [
  { name: 'demo.mp4', url: '/api/files/abc/demo.mp4' },
  { name: 'Results_2024.MOV', url: '/api/files/abc/Results_2024.MOV' },
]

test('linkBasename strips hyperref pseudo-schemes', () => {
  assert.equal(linkBasename('run:demo.mp4'), 'demo.mp4')
  assert.equal(linkBasename('file:///home/me/slides/demo.mp4'), 'demo.mp4')
  assert.equal(linkBasename('video://demo.mp4'), 'demo.mp4')
})

test('linkBasename strips paths, queries and fragments', () => {
  assert.equal(linkBasename('./videos/Demo.MP4?loop=1#t=3'), 'demo.mp4')
  assert.equal(linkBasename('..\\media\\clip.webm'), 'clip.webm')
  assert.equal(linkBasename('https://cdn.example.com/a/b/c.mp4'), 'c.mp4')
})

test('linkBasename survives malformed percent-encoding', () => {
  assert.equal(linkBasename('run:100%.mp4'), '100%.mp4')
  assert.equal(linkBasename('run:%ED%95%9C%EA%B8%80.mp4'), '한글.mp4')
})

test('linkBasename rejects empty input', () => {
  assert.equal(linkBasename(''), null)
  assert.equal(linkBasename('   '), null)
  assert.equal(linkBasename(null), null)
})

test('isVideoLink only accepts video extensions', () => {
  assert.equal(isVideoLink('run:demo.mp4'), true)
  assert.equal(isVideoLink('clip.WEBM'), true)
  assert.equal(isVideoLink('https://example.com/paper.pdf'), false)
  assert.equal(isVideoLink('https://youtube.com/watch?v=xyz'), false)
})

test('resolveLink prefers an uploaded video, case-insensitively', () => {
  assert.deepEqual(resolveLink('run:demo.mp4', videos), {
    kind: 'video', src: '/api/files/abc/demo.mp4', name: 'demo.mp4', source: 'upload',
  })
  // Author wrote a throwaway absolute URL; the upload still wins.
  assert.deepEqual(resolveLink('https://example.com/videos/DEMO.mp4', videos), {
    kind: 'video', src: '/api/files/abc/demo.mp4', name: 'demo.mp4', source: 'upload',
  })
  assert.equal(resolveLink('results_2024.mov', videos).source, 'upload')
})

test('resolveLink falls back to streaming a remote video', () => {
  assert.deepEqual(resolveLink('https://cdn.example.com/talk.mp4', videos), {
    kind: 'video', src: 'https://cdn.example.com/talk.mp4', name: 'talk.mp4', source: 'remote',
  })
})

test('resolveLink keeps ordinary hyperlinks intact', () => {
  assert.deepEqual(resolveLink('https://arxiv.org/abs/1234.5678', videos), {
    kind: 'link', href: 'https://arxiv.org/abs/1234.5678',
  })
})

test('resolveLink drops unresolvable local-file links', () => {
  // `run:missing.mp4` with nothing uploaded is a dead link, not a hyperlink.
  assert.equal(resolveLink('run:missing.mp4', videos), null)
  assert.equal(resolveLink('', videos), null)
})

test('isInlineSize separates a placeholder box from a word-sized link', () => {
  // 60% x 45% of the slide: a real placeholder image.
  assert.equal(isInlineSize(576, 243, 960, 540), true)
  // A hyperlinked word.
  assert.equal(isInlineSize(80, 14, 960, 540), false)
  // Wide but only a line tall (a hyperlinked caption) stays a badge.
  assert.equal(isInlineSize(600, 16, 960, 540), false)
  assert.equal(isInlineSize(100, 100, 0, 0), false)
})

test('videoOptions reads playback flags from the link', async () => {
  const { videoOptions } = await import('../src/lib/link-match.mjs')

  assert.deepEqual(videoOptions('demo.mp4'), { autoplay: false, loop: false, muted: false })
  assert.deepEqual(videoOptions('demo.mp4?loop'), { autoplay: false, loop: true, muted: true })
  assert.deepEqual(videoOptions('demo.mp4?autoplay&loop'), { autoplay: true, loop: true, muted: true })
  assert.deepEqual(videoOptions('demo.mp4#muted'), { autoplay: false, loop: false, muted: true })
  assert.deepEqual(videoOptions('run:demo.mp4?loop=1'), { autoplay: false, loop: true, muted: true })
  // A file that merely contains the word must not trigger the flag.
  assert.deepEqual(videoOptions('looping_demo.mp4'), { autoplay: false, loop: false, muted: false })
  assert.deepEqual(videoOptions('demo.mp4?loop=0'), { autoplay: false, loop: false, muted: false })
})
