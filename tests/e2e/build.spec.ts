import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'

// `seek` is internal, so these reach it the way the Spectator does, through the scroll driver.
// Scroll maps 1:1 to t, so a scroll position stands for a t.

async function ready(page: Page) {
  await page.goto('')
  await page.locator('.track').waitFor({ state: 'attached' })
  return page.locator('.track').evaluate(el => el.getBoundingClientRect().height)
}

// ScrollTrigger reads scroll on its next tick, so give it a frame or two.
async function scrollTo(page: Page, y: number) {
  await page.evaluate(async (y) => {
    window.scrollTo(0, y)
    for (let frame = 0; frame < 3; frame++)
      await new Promise(requestAnimationFrame)
  }, y)
}

const pinnedHtml = (page: Page) => page.locator('.pinned').evaluate(el => el.outerHTML)

test('the engine and GSAP load in their own chunk, after the page', async ({ page, request }) => {
  const html = await (await request.get('')).text()
  const entry = html.match(/src="([^"]+\.js)"/)![1]!
  const scripts: string[] = []
  page.on('request', (r) => {
    if (r.url().endsWith('.js'))
      scripts.push(new URL(r.url()).pathname)
  })
  await ready(page)

  const entrySource = await (await request.get(entry)).text()
  expect(entrySource).not.toContain('ScrollTrigger')
  expect(html).not.toContain('modulepreload')
  expect(scripts.filter(s => s !== entry).length).toBeGreaterThan(0)
})

test('the page sits inside the spec\'s structure', async ({ page }) => {
  await ready(page)
  await expect(page.locator('.build > main.pinned > .camera [data-build="hero"]')).toHaveCount(1)
  await expect(page.locator('.build > main.pinned > .overlay[aria-hidden="true"] .cursor')).toHaveCount(2)
  await expect(page.locator('.build > .track')).toHaveCount(1)
})

test('below the load check there\'s no Track and no engine', async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 800, height: 900 } })
  const page = await context.newPage()
  const scripts: string[] = []
  page.on('request', (r) => {
    if (r.url().endsWith('.js'))
      scripts.push(r.url())
  })
  await page.goto('', { waitUntil: 'networkidle' })
  await expect(page.locator('.track')).toHaveCount(0)
  await expect(page.locator('.overlay')).toHaveCount(0)
  expect(scripts).toHaveLength(1)
  await context.close()
})

test('it measures after the fonts are ready', async ({ page }) => {
  await page.route('**/fonts/anton-400.woff2', async (route) => {
    await new Promise(resolve => setTimeout(resolve, 800))
    await route.continue()
  })
  await page.goto('')
  await page.locator('.track').waitFor({ state: 'attached' })
  const anton = await page.evaluate(() => [...document.fonts].find(f => f.family.includes('Anton'))?.status)
  expect(anton).toBe('loaded')
})

test('the Beat scrubs: the cursor reaches its anchor and the shapes fade in', async ({ page }) => {
  const trackLength = await ready(page)
  const shapes = page.locator('[data-build="hero-shapes"]')
  const cursor = page.locator('.cursor[data-teammate="designer"]')

  await expect(cursor).toBeHidden()
  await expect(shapes).toHaveCSS('opacity', '0')

  const anchor = await shapes.evaluate((el) => {
    const r = el.getBoundingClientRect()
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 }
  })

  let nearest = Number.POSITIVE_INFINITY
  for (let y = 0; y < trackLength; y += 20) {
    await scrollTo(page, y)
    if (!await cursor.isVisible())
      continue
    const at = await cursor.evaluate((el) => {
      const r = el.getBoundingClientRect()
      return { x: r.left, y: r.top }
    })
    nearest = Math.min(nearest, Math.hypot(at.x - anchor.x, at.y - anchor.y))
  }
  expect(nearest).toBeLessThan(1)

  await scrollTo(page, trackLength - 1)
  await expect(shapes).toHaveCSS('opacity', '1')
})

// Required test 1
test('at the end of the Track the DOM is the prerendered page, with no overrides', async ({ page, request }) => {
  const prerendered = await (await request.get('')).text()
  const trackLength = await ready(page)

  await scrollTo(page, trackLength / 2)
  await scrollTo(page, trackLength)

  const result = await page.evaluate((html) => {
    const parsed = new DOMParser().parseFromString(html, 'text/html')
    return {
      expected: parsed.querySelector('.camera')!.outerHTML,
      actual: document.querySelector('.camera')!.outerHTML,
      overrides: document.querySelectorAll('.camera [style], .camera[style]').length,
      overlayHidden: document.querySelector<HTMLElement>('.overlay')!.hidden,
    }
  }, prerendered)

  expect(result.actual).toBe(result.expected)
  expect(result.overrides).toBe(0)
  expect(result.overlayHidden).toBe(true)
})

// Required test 2
test('forward, backward and random seeks to the same t give the same DOM', async ({ page }) => {
  const trackLength = await ready(page)
  const stops = Array.from({ length: 9 }, (_, i) => Math.round(trackLength * i / 8))

  const forward = new Map<number, string>()
  for (const y of stops) {
    await scrollTo(page, y)
    forward.set(y, await pinnedHtml(page))
  }

  for (const y of [...stops].reverse()) {
    await scrollTo(page, y)
    expect(await pinnedHtml(page), `backward to ${y}`).toBe(forward.get(y))
  }

  for (const i of [5, 0, 8, 2, 7, 1, 6, 3, 8, 4, 0]) {
    await scrollTo(page, stops[i]!)
    expect(await pinnedHtml(page), `random to ${stops[i]}`).toBe(forward.get(stops[i]!))
  }
})

// Required test 3
test('seeking back to 0 after a full run matches a fresh start', async ({ page }) => {
  const trackLength = await ready(page)
  const fresh = await pinnedHtml(page)
  await scrollTo(page, trackLength + 200)
  await scrollTo(page, trackLength / 2)
  await scrollTo(page, 0)
  expect(await pinnedHtml(page)).toBe(fresh)
})

// Required test 5
test('scrolling across the end of the Track moves the hero 1:1 with no jump', async ({ page }) => {
  const trackLength = await ready(page)
  const end = Math.round(trackLength)
  const heights = new Set<number>()

  for (const y of [0, end - 200, end - 50, end - 1, end, end + 1, end + 50, end + 400, end + 1, end, end - 1, end - 50]) {
    await scrollTo(page, y)
    const measured = await page.evaluate(() => ({
      scrollY: window.scrollY,
      heroTop: document.querySelector('[data-build="hero"]')!.getBoundingClientRect().top,
      height: document.documentElement.scrollHeight,
    }))
    expect(measured.scrollY).toBe(y)
    expect(measured.heroTop, `hero at scroll ${y}`).toBeCloseTo(-Math.max(0, y - end), 0)
    heights.add(measured.height)
  }
  expect([...heights]).toHaveLength(1)
})

test('below the Track the page scrolls on natively to the footer', async ({ page }) => {
  await ready(page)
  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight))
  await expect(page.locator('[data-build="colophon"]')).toBeInViewport()
})

// Finds where the Camera is furthest out, by walking the Track.
async function zoomedOut(page: Page, trackLength: number) {
  let lowest = { y: 0, width: Number.POSITIVE_INFINITY }
  for (let y = 0; y < trackLength; y += Math.ceil(trackLength / 60)) {
    await scrollTo(page, y)
    const width = await page.locator('.camera').evaluate(el => el.getBoundingClientRect().width)
    if (width < lowest.width)
      lowest = { y, width }
  }
  await scrollTo(page, lowest.y)
  return lowest.y
}

// Required test 7
for (const viewport of [
  { width: 1024, height: 600 },
  { width: 1024, height: 768 },
  { width: 1440, height: 900 },
  { width: 1920, height: 1080 },
  { width: 2560, height: 1440 },
]) {
  test(`the whole page fits the zoomed-out view at ${viewport.width}x${viewport.height}`, async ({ browser, baseURL }) => {
    const context = await browser.newContext({ viewport, baseURL })
    const page = await context.newPage()
    const trackLength = await ready(page)
    await zoomedOut(page, trackLength)

    const box = await page.locator('.camera').evaluate((el) => {
      const { left, top, right, bottom, width } = el.getBoundingClientRect()
      return { left, top, right, bottom, width, offsetWidth: (el as HTMLElement).offsetWidth }
    })
    expect(box.width).toBeLessThan(box.offsetWidth)
    expect(box.left).toBeGreaterThanOrEqual(0)
    expect(box.top).toBeGreaterThanOrEqual(0)
    expect(box.right).toBeLessThanOrEqual(viewport.width)
    expect(box.bottom).toBeLessThanOrEqual(viewport.height)
    await context.close()
  })
}

test('a cursor and a Brief stay at screen size while zoomed out, and on their target', async ({ page }) => {
  const trackLength = await ready(page)
  const delegator = page.locator('.cursor[data-teammate="delegator"]')
  const pointer = delegator.locator('svg')
  const brief = delegator.locator('.brief')

  // Before the Camera moves, wherever the first Brief is up.
  let atFullSize: { pointer: number, label: number, brief: number } | undefined
  for (let y = 0; y < trackLength && !atFullSize; y += 40) {
    await scrollTo(page, y)
    if (await brief.first().isVisible()) {
      const transform = await page.locator('.camera').evaluate(el => (el as HTMLElement).style.transform)
      expect(transform).toBe('none')
      atFullSize = {
        pointer: (await pointer.boundingBox())!.height,
        label: (await delegator.locator('.cursor-label').boundingBox())!.height,
        brief: (await brief.first().boundingBox())!.height,
      }
    }
  }
  expect(atFullSize).toBeDefined()

  const start = await zoomedOut(page, trackLength)
  let shown = false
  for (let y = start; y < trackLength && !shown; y += 40) {
    await scrollTo(page, y)
    shown = await brief.last().isVisible()
  }
  expect(shown).toBe(true)

  expect((await pointer.boundingBox())!.height).toBeCloseTo(atFullSize!.pointer, 1)
  expect((await delegator.locator('.cursor-label').boundingBox())!.height).toBeCloseTo(atFullSize!.label, 1)
  expect((await brief.last().boundingBox())!.height).toBeCloseTo(atFullSize!.brief, 1)

  const { cursor, target } = await page.evaluate(() => {
    const cursor = document.querySelector('.cursor[data-teammate="delegator"]')!.getBoundingClientRect()
    const target = document.querySelector('[data-build="work"]')!.getBoundingClientRect()
    return { cursor: { x: cursor.left, y: cursor.top }, target: { x: target.left + target.width / 2, y: target.top + target.height / 2 } }
  })
  expect(Math.hypot(cursor.x - target.x, cursor.y - target.y)).toBeLessThan(1)
})

test('the Camera ends with no transform before the page unpins, and clears at the end', async ({ page }) => {
  const trackLength = await ready(page)
  const camera = page.locator('.camera')
  await zoomedOut(page, trackLength)
  await expect(camera).not.toHaveCSS('transform', 'none')

  await scrollTo(page, trackLength - 1)
  await expect(camera).toHaveCSS('transform', 'none')
  expect(await camera.getAttribute('style')).toBe('transform: none;')

  await scrollTo(page, trackLength)
  await expect(camera).toHaveCSS('transform', 'none')
  expect(await camera.getAttribute('style')).toBeNull()
})
