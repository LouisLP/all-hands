// The spec's load budget, measured on dist/. Run `pnpm build` first.
// Lighthouse needs a Chrome, so this uses the one Playwright installed.
import { execFile } from 'node:child_process'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { promisify } from 'node:util'
import { gzipSync } from 'node:zlib'

import { chromium } from '@playwright/test'
import { preview } from 'vite'

const KB = 1024
const LIMITS = { lcpMs: 2500, cls: 0.1, initialJsKb: 40, fontsKb: 100, everythingKb: 250, engineKb: 60 }
const DIST = 'dist'
const PORT = 4174

function files(dir) {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name)
    return statSync(path).isDirectory() ? files(path) : [path]
  })
}

const html = readFileSync(join(DIST, 'index.html'), 'utf8')
const gz = path => gzipSync(readFileSync(path), { level: 9 }).length

// Everything fetched on load: the HTML, the JS and CSS it names, and the fonts.
const named = [...html.matchAll(/(?:src|href)="\/all-hands\/([^"#]+\.(?:js|css))"/g)].map(m => join(DIST, m[1]))
const js = named.filter(p => p.endsWith('.js'))
const fonts = files(join(DIST, 'fonts')).filter(p => p.endsWith('.woff2'))

// Every other chunk loads only when the load check passes.
const lazyJs = files(join(DIST, 'assets')).filter(p => p.endsWith('.js') && !js.includes(p))
const engine = lazyJs.reduce((sum, p) => sum + gz(p), 0)

const initialJs = js.reduce((sum, p) => sum + gz(p), 0)
const fontBytes = fonts.reduce((sum, p) => sum + statSync(p).size, 0)
const everything = [join(DIST, 'index.html'), ...named].reduce((sum, p) => sum + gz(p), 0) + fontBytes

const server = await preview({ preview: { port: PORT, strictPort: true } })
const report = join('node_modules', '.tmp', 'lighthouse.json')
try {
  // Async, because the preview server shares this process and has to keep answering.
  await promisify(execFile)('pnpm', [
    'dlx',
    'lighthouse@12',
    `http://localhost:${PORT}/all-hands/`,
    '--quiet',
    '--only-categories=performance',
    '--output=json',
    `--output-path=${report}`,
    '--chrome-flags=--headless=new',
  ], { env: { ...process.env, CHROME_PATH: chromium.executablePath() } })
}
finally {
  await server.close()
}
const { audits } = JSON.parse(readFileSync(report, 'utf8'))

const rows = [
  ['LCP (ms)', audits['largest-contentful-paint'].numericValue, LIMITS.lcpMs, 0],
  ['CLS', audits['cumulative-layout-shift'].numericValue, LIMITS.cls, 3],
  ['Initial JS, gzip (KB)', initialJs / KB, LIMITS.initialJsKb, 1],
  ['Fonts, total (KB)', fontBytes / KB, LIMITS.fontsKb, 1],
  ['Everything, gzip (KB)', everything / KB, LIMITS.everythingKb, 1],
  ['Engine chunk, gzip (KB)', engine / KB, LIMITS.engineKb, 1],
]
let failed = false
for (const [name, value, limit, digits] of rows) {
  const ok = value <= limit
  failed ||= !ok
  console.log(`${ok ? 'pass' : 'FAIL'}  ${name.padEnd(24)} ${value.toFixed(digits).padStart(8)}  limit ${limit}`)
}
console.log(`\nCounted: ${[...named, ...fonts].map(p => relative(DIST, p)).join(', ')}`)
process.exit(failed ? 1 : 0)
