import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  linkBasename,
  isVideoLink,
  resolveLink,
  playerBox,
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

test('playerBox leaves a placeholder-sized link alone', () => {
  // 60% x 45% of the slide: a real placeholder image.
  const box = playerBox({ left: 100, top: 100, width: 576, height: 243 }, 960, 540)
  assert.deepEqual(box, { left: 100, top: 100, width: 576, height: 243, grown: false })
})

test('playerBox grows a word-sized link around its own centre', () => {
  // A hyperlinked word in the middle of the slide.
  const box = playerBox({ left: 440, top: 263, width: 80, height: 14 }, 960, 540)
  assert.equal(box.grown, true)
  assert.equal(box.width, 288) // 30% of the slide width
  assert.equal(box.height, 162) // 16:9 of that
  // Still centred on the link.
  assert.equal(box.left + box.width / 2, 480)
  assert.equal(box.top + box.height / 2, 270)
})

test('playerBox keeps a grown box inside the slide', () => {
  // A hyperlinked caption hard against the bottom-right corner.
  const box = playerBox({ left: 900, top: 520, width: 56, height: 14 }, 960, 540)
  assert.equal(box.grown, true)
  assert.equal(box.left + box.width, 960)
  assert.equal(box.top + box.height, 540)
  assert.ok(box.left >= 0 && box.top >= 0)
})

test('playerBox passes the rect through when the slide has no size yet', () => {
  const rect = { left: 10, top: 10, width: 100, height: 100 }
  assert.deepEqual(playerBox(rect, 0, 0), { ...rect, grown: false })
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
