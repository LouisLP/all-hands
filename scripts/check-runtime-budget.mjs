// The spec's runtime budget: a scripted scroll through the whole Track at 1440x900, in
// Chromium, timing rAF intervals and draw(). It builds its own copy, instrumented only to
// time draw(). Pass --headed to run on the real GPU instead of headless software rendering.
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'

import { chromium } from '@playwright/test'
import { preview } from 'vite'

const LIMITS = {
  1: { p95Frame: 20, longestFrame: 50, p95Draw: 4 },
  4: { p95Frame: 33, longestFrame: 100, p95Draw: 8 },
}
const OUT_DIR = 'node_modules/.tmp/dist-profile'
const PORT = 4175
const RUNS = 3
const PX_PER_SECOND = 800
const headed = process.argv.includes('--headed')

process.env.VITE_PROFILE_DRAW = '1'
await promisify(execFile)('pnpm', ['vite-ssg', 'build'], { env: process.env })

function percentile(values, p) {
  const sorted = [...values].sort((a, b) => a - b)
  return sorted[Math.min(sorted.length - 1, Math.ceil(sorted.length * p) - 1)] ?? 0
}

function scrollThroughTrack(pxPerSecond) {
  const length = document.querySelector('.track').getBoundingClientRect().height
  const camera = document.querySelector('.camera')
  const frames = []
  window.scrollTo(0, 0)
  performance.clearMeasures('draw')
  return new Promise((resolve) => {
    let started
    let previous
    function frame(now) {
      started ??= now
      if (previous !== undefined) {
        frames.push({
          interval: now - previous,
          progress: window.scrollY / length,
          zoomedOut: camera.style.transform.includes('scale'),
        })
      }
      previous = now
      const y = (now - started) / 1000 * pxPerSecond
      if (y > length) {
        resolve({ frames, draws: performance.getEntriesByName('draw').map(e => e.duration) })
        return
      }
      window.scrollTo(0, y)
      requestAnimationFrame(frame)
    }
    requestAnimationFrame(frame)
  })
}

const server = await preview({
  build: { outDir: OUT_DIR },
  preview: { port: PORT, strictPort: true },
})
const browser = await chromium.launch({ headless: !headed })
let failed = false
try {
  console.log(`Chromium ${browser.version()}, ${headed ? 'headed' : 'headless'}, ${RUNS} runs at ${PX_PER_SECOND}px/s\n`)
  for (const [rate, limits] of Object.entries(LIMITS)) {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
    const cdp = await page.context().newCDPSession(page)
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: Number(rate) })
    await page.goto(`http://localhost:${PORT}/all-hands/`)
    await page.locator('.track').waitFor({ state: 'attached' })

    const frames = []
    const draws = []
    for (let run = 1; run <= RUNS; run++) {
      const result = await page.evaluate(scrollThroughTrack, PX_PER_SECOND)
      frames.push(...result.frames.map(frame => ({ ...frame, run })))
      draws.push(...result.draws)
    }
    await page.close()

    const intervals = frames.map(f => f.interval)
    const zoomed = frames.filter(f => f.zoomedOut).map(f => f.interval)
    const worst = frames.reduce((a, b) => (b.interval > a.interval ? b : a))
    const rows = [
      ['p95 frame interval', percentile(intervals, 0.95), limits.p95Frame],
      ['longest frame', worst.interval, limits.longestFrame],
      ['p95 draw()', percentile(draws, 0.95), limits.p95Draw],
    ]

    console.log(`${rate}x CPU, ${frames.length} frames, ${draws.length} draws`)
    for (const [name, value, limit] of rows) {
      const ok = value <= limit
      failed ||= !ok
      console.log(`${ok ? 'pass' : 'FAIL'}  ${name.padEnd(20)} ${value.toFixed(1).padStart(7)}ms  limit ${limit}ms`)
    }
    console.log(`      zoomed out only: p95 ${percentile(zoomed, 0.95).toFixed(1)}ms, longest ${Math.max(...zoomed).toFixed(1)}ms, ${zoomed.length} frames`)
    const slow = frames.filter(f => f.interval > limits.longestFrame)
    for (const f of slow)
      console.log(`      over the limit: ${f.interval.toFixed(1)}ms in run ${f.run}, at ${(f.progress * 100).toFixed(0)}% of the Track`)
    console.log()
  }
}
finally {
  await browser.close()
  await server.close()
}
process.exit(failed ? 1 : 0)
