// pdf.js runs its parser in a Web Worker. Next.js will not serve a file out of
// node_modules, so the worker is copied into public/ before dev and build.
// Keeping it a real file (rather than a bundler import) avoids the version
// mismatch errors pdf.js throws when the worker and API disagree.

import { createRequire } from 'node:module'
import { promises as fs } from 'node:fs'
import path from 'node:path'

const require = createRequire(import.meta.url)
const DEST = path.join(process.cwd(), 'public', 'pdf.worker.min.mjs')

const CANDIDATES = [
  'pdfjs-dist/build/pdf.worker.min.mjs',
  'pdfjs-dist/build/pdf.worker.mjs',
]

async function main() {
  let source = null
  for (const candidate of CANDIDATES) {
    try {
      source = require.resolve(candidate)
      break
    } catch {
      // try the next one
    }
  }

  if (!source) {
    console.error(
      '[pdf-worker] Could not find the pdf.js worker. Run `npm install` first.',
    )
    process.exit(1)
  }

  await fs.mkdir(path.dirname(DEST), { recursive: true })
  await fs.copyFile(source, DEST)

  const version = require('pdfjs-dist/package.json').version
  console.log(`[pdf-worker] copied pdf.js ${version} worker -> public/pdf.worker.min.mjs`)
}

main().catch((err) => {
  console.error('[pdf-worker] failed:', err)
  process.exit(1)
})
