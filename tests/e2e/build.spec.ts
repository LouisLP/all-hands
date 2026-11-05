import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'

import { auditText, contrastRatio, requiredRatio } from '../support/contrast'

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

// Evenly spaced scroll positions, because a step per few px takes too long on the whole Track.
function stops(trackLength: number, count = 150, upTo = 1) {
  return Array.from({ length: count }, (_, i) => Math.round(trackLength * upTo * i / count))
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
  await expect(page.locator('.build > main.pinned > .overlay[aria-hidden="true"] .cursor')).toHaveCount(5)
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
  await expect(page.locator('.build-line')).toBeHidden()
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
  for (const y of stops(trackLength, 100, 0.25)) {
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

test('the opening frame shows name, role, the Delegator and the first Brief, and nothing else', async ({ page }) => {
  await ready(page)
  await expect(page.locator('.cursor[data-teammate="delegator"]')).toBeVisible()
  await expect(page.locator('.cursor[data-teammate="delegator"] .brief').first()).toHaveText('Make it a poster.')
  await expect(page.locator('.cursor[data-teammate="delegator"] .brief').first()).toBeVisible()
  for (const teammate of ['designer', 'backend', 'agent1', 'agent2'])
    await expect(page.locator(`.cursor[data-teammate="${teammate}"]`)).toBeHidden()

  await expect(page.locator('[data-build="name"]')).toBeVisible()
  await expect(page.locator('[data-build="role"]')).toBeVisible()
  const family = await page.locator('[data-build="name"]').evaluate(el => getComputedStyle(el).fontFamily)
  expect(family).toContain('system-ui')
  for (const name of ['hero-meta', 'hero-intro', 'hero-shapes'])
    await expect(page.locator(`[data-build="${name}"]`)).toHaveCSS('opacity', '0')
  await expect(page.locator('[data-build="hero-button"]')).toHaveCSS('clip-path', /inset/)

  await expect(page.locator('.build-line')).toBeVisible()
  await expect(page.locator('.build-line')).toHaveText('Scroll to build · Skip')
})

test('Skip is a real link that takes you to the finished page', async ({ page }) => {
  const trackLength = await ready(page)
  await scrollTo(page, trackLength / 2)
  const skip = page.locator('.build-line a')
  await expect(skip).toHaveAttribute('href', '#hero')
  await skip.click()
  await expect(page.locator('.track')).toHaveCount(0)
  await expect(page.locator('.overlay')).toHaveCount(0)
  await expect(page.locator('.build-line')).toBeHidden()
  await expect(page.locator('[data-build="name"]')).toBeInViewport()
  await expect(page.locator('html')).not.toHaveAttribute('style')
  await expect(page.locator('.camera [style]')).toHaveCount(0)
})

test('the line stays up through the Build, fades at the Landing, and comes back on the way up', async ({ page }) => {
  const trackLength = await ready(page)
  const line = page.locator('.build-line')
  await scrollTo(page, trackLength / 2)
  await expect(line).toHaveCSS('opacity', '1')
  await scrollTo(page, trackLength - 1)
  expect(Number(await line.evaluate(el => getComputedStyle(el).opacity))).toBeLessThan(0.05)
  await scrollTo(page, trackLength)
  await expect(line).toBeHidden()
  await scrollTo(page, trackLength / 2)
  await expect(line).toBeVisible()
})

test('the hero type grows at a real font size, and nothing around it moves', async ({ page }) => {
  const trackLength = await ready(page)
  const name = page.locator('[data-build="name"]')
  const boxes = () => page.evaluate(() => Object.fromEntries(
    ['hero', 'title', 'name', 'role', 'hero-button', 'about', 'work', 'contact'].map((build) => {
      const { width, height } = document.querySelector(`[data-build="${build}"]`)!.getBoundingClientRect()
      return [build, { width: Math.round(width * 100) / 100, height: Math.round(height * 100) / 100 }]
    }),
  ))

  const opening = await boxes()
  await scrollTo(page, trackLength + 1)
  const finished = await name.evaluate(el => Number.parseFloat(getComputedStyle(el).fontSize))
  expect(finished).toBeGreaterThan(100)
  expect(await boxes()).toEqual(opening)

  await scrollTo(page, 0)
  const sizes = new Set<string>()
  let sawAnton = false
  for (const y of stops(trackLength, 60, 0.25)) {
    await scrollTo(page, y)
    const fontSize = await name.evaluate(el => el.style.fontSize)
    sizes.add(fontSize)
    sawAnton ||= (await name.evaluate(el => getComputedStyle(el).fontFamily)).includes('Anton')
    expect(await boxes(), `at scroll ${y}`).toEqual(opening)
  }
  expect(sizes.size).toBeGreaterThan(3)
  expect([...sizes].map(Number.parseFloat)).toContain(finished)
  expect(sawAnton).toBe(true)
})

test('typed text keeps its full text hidden, shows the typed part aria-hidden, and collapses at the end', async ({ page }) => {
  const trackLength = await ready(page)
  const heading = page.locator('[data-build="about-heading"]')
  const full = (await heading.locator('.visually-hidden').textContent())!
  expect(full.length).toBeGreaterThan(10)
  await expect(heading.locator('.typed[aria-hidden="true"]')).toHaveText('')

  let partial = false
  for (const y of stops(trackLength, 400)) {
    if (partial)
      break
    await scrollTo(page, y)
    const shown = (await heading.locator('.typed').textContent())!
    partial = shown.length > 0 && shown.length < full.length
    if (partial) {
      expect(full.startsWith(shown)).toBe(true)
      await expect(heading.locator('.typed')).toHaveAttribute('data-typing')
    }
  }
  expect(partial).toBe(true)
  await expect(page.getByRole('heading', { name: full })).toHaveCount(1)

  await scrollTo(page, trackLength)
  expect(await heading.evaluate(el => el.innerHTML)).toBe(full)
})

test('Backend swaps a placeholder for the real bio', async ({ page }) => {
  const trackLength = await ready(page)
  const shown = page.locator('[data-build="about-body1"] .typed')
  const seen = new Set<string>()
  for (const y of stops(trackLength, 150, 0.6)) {
    await scrollTo(page, y)
    seen.add((await shown.textContent())!)
  }
  expect([...seen]).toContain('Placeholder text about the person this page is for.')
  expect([...seen].some(text => text.startsWith('I spent years'))).toBe(true)
})

test('the Delegator rejects the card, then approves it, before the Agents arrive', async ({ page }) => {
  const trackLength = await ready(page)
  const firstSeen = new Map<string, number>()
  const watched = {
    tighter: { selector: '.brief[data-kind="reject"]', text: 'Tighter.' },
    approved: { selector: '.brief[data-kind="approve"]', text: 'Yes. Do the rest.' },
    agent1: { selector: '.cursor[data-teammate="agent1"]', text: 'Agent 1' },
    agent2: { selector: '.cursor[data-teammate="agent2"]', text: 'Agent 2' },
    backend: { selector: '.cursor[data-teammate="backend"]', text: 'Backend' },
  }
  for (const y of stops(trackLength)) {
    await scrollTo(page, y)
    const seen = await page.evaluate(targets => Object.entries(targets).flatMap(([name, { selector, text }]) => {
      const el = [...document.querySelectorAll<HTMLElement>(selector)].find(el => el.textContent.includes(text))
      return el?.checkVisibility() ? [name] : []
    }), watched)
    for (const name of seen) {
      if (!firstSeen.has(name))
        firstSeen.set(name, y)
    }
  }
  expect(firstSeen.get('backend')).toBeLessThan(firstSeen.get('tighter')!)
  expect(firstSeen.get('tighter')).toBeLessThan(firstSeen.get('approved')!)
  expect(firstSeen.get('approved')).toBeLessThan(firstSeen.get('agent1')!)
  expect(firstSeen.get('agent1')).toBe(firstSeen.get('agent2'))
})

test('the ambient layer runs without writing to the DOM', async ({ page }) => {
  await ready(page)
  await scrollTo(page, 500)
  const before = await pinnedHtml(page)
  await page.waitForTimeout(600)
  expect(await pinnedHtml(page)).toBe(before)
  const animation = await page.locator('.cursor-body').first().evaluate(el => getComputedStyle(el).animationName)
  expect(animation).toBe('idle-drift')
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
  await expect(page.locator('html')).not.toHaveAttribute('style')
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
  const tooSafe = brief.filter({ hasText: 'Too safe.' })

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
    shown = await tooSafe.isVisible()
  }
  expect(shown).toBe(true)

  expect((await pointer.boundingBox())!.height).toBeCloseTo(atFullSize!.pointer, 1)
  expect((await delegator.locator('.cursor-label').boundingBox())!.height).toBeCloseTo(atFullSize!.label, 1)
  expect((await tooSafe.boundingBox())!.height).toBeCloseTo(atFullSize!.brief, 1)

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

const background = (page: Page, name: string) =>
  page.locator(`[data-build="${name}"]`).evaluate(el => getComputedStyle(el).backgroundColor)

const NEUTRAL_MANDARIN = 'rgb(180, 180, 178)'
const NEUTRAL_CREST = 'rgb(255, 255, 255)'

test('"Too safe." triggers colour, and Crest arrives after its Brief and before "Ship it."', async ({ page }) => {
  const trackLength = await ready(page)
  const first = new Map<string, number>()
  const see = (what: string, y: number) => {
    if (!first.has(what))
      first.set(what, y)
  }
  const briefUp = (text: string) => page.locator('.brief').filter({ hasText: text }).isVisible()

  for (const y of stops(trackLength, 300)) {
    await scrollTo(page, y)
    if (await briefUp('Too safe.'))
      see('too safe', y)
    if (await background(page, 'hero') !== NEUTRAL_MANDARIN)
      see('colour', y)
    if (await briefUp('One thing to click.'))
      see('brief', y)
    if (await background(page, 'contact-button') !== NEUTRAL_CREST)
      see('closing band', y)
    if (await background(page, 'hero-button') !== NEUTRAL_CREST)
      see('hero button', y)
    if (await briefUp('Ship it.'))
      see('ship it', y)
  }

  const order = ['too safe', 'colour', 'brief', 'closing band', 'hero button', 'ship it'].map(what => first.get(what)!)
  expect(order.every(y => y !== undefined)).toBe(true)
  expect(order).toEqual([...order].sort((a, b) => a - b))
  expect(new Set(order).size).toBe(order.length)
})

test('colour tokens pass through values between neutral and final', async ({ page }) => {
  const trackLength = await ready(page)
  const seen = new Set<string>()
  for (const y of stops(trackLength, 300, 1))
    seen.add((await (scrollTo(page, y).then(() => background(page, 'hero')))))
  expect(seen).toContain(NEUTRAL_MANDARIN)
  expect(seen).toContain('rgb(253, 85, 10)')
  expect(seen.size).toBeGreaterThan(3)
})

test('the page\'s colours don\'t change when overrides clear', async ({ page }) => {
  const trackLength = await ready(page)
  // These two only hold filled sections, so what they inherit from the neutral root never shows.
  const colours = () => page.locator('[data-build]:not([data-build="about"], [data-build="work"])').evaluateAll(els => els.map((el) => {
    const { backgroundColor, color, borderTopColor, fill } = getComputedStyle(el)
    return [el.getAttribute('data-build'), backgroundColor, color, borderTopColor, fill].join(' ')
  }))
  await scrollTo(page, trackLength - 1)
  const pinned = await colours()
  await scrollTo(page, trackLength)
  expect(await colours()).toEqual(pinned)
})

test('the cursors come back with the Camera, then leave one by one, Backend first and Delegator last', async ({ page }) => {
  const trackLength = await ready(page)
  const viewport = page.viewportSize()!
  const team = ['backend', 'agent1', 'agent2', 'designer', 'delegator']
  const lastSeen = new Map<string, number>()
  const start = Math.round(trackLength * 0.9)
  let home = false

  for (let y = start; y < trackLength; y += 8) {
    await scrollTo(page, y)
    const { visible, transform } = await page.evaluate(team => ({
      transform: document.querySelector<HTMLElement>('.camera')!.style.transform,
      visible: team.flatMap((name) => {
        const el = document.querySelector(`.cursor[data-teammate="${name}"]`)!
        return el.checkVisibility() ? [{ name, ...el.getBoundingClientRect().toJSON() }] : []
      }),
    }), team)
    for (const { name } of visible)
      lastSeen.set(name, y)
    // Nobody is carried off by the Camera: the moment it's home, all five are on screen.
    if (transform === 'none' && !home) {
      home = true
      expect(visible.map(({ name }) => name)).toEqual(team)
      for (const { left, top } of visible) {
        expect(left).toBeLessThan(viewport.width)
        expect(top).toBeLessThan(viewport.height)
      }
    }
  }

  expect(home).toBe(true)
  const leaving = team.map(name => lastSeen.get(name)!)
  expect(leaving).toEqual([...leaving].sort((a, b) => a - b))
  expect(new Set(leaving).size).toBe(team.length)
  await scrollTo(page, trackLength - 1)
  // The Delegator is still fading out here, but off screen.
  await expect(page.locator('.cursor:visible:not([data-teammate="delegator"])')).toHaveCount(0)
  await expect(page.locator('.cursor[data-teammate="delegator"]')).not.toBeInViewport()
  await expect(page.locator('.brief:visible')).toHaveCount(0)
  await expect(page.locator('.selection')).toBeHidden()
})

// Required test 8, on everything drawn, which takes in the overlay's labels and Briefs when they're up.
test('page text passes contrast at each stage of the Build', async ({ page }) => {
  const trackLength = await ready(page)
  let checked = 0
  for (const y of stops(trackLength, 120)) {
    await scrollTo(page, y)
    const samples = await page.evaluate(auditText)
    checked += samples.length
    for (const s of samples)
      expect(contrastRatio(s.fg, s.bg), `"${s.text}" at ${s.px}px, scroll ${y}`).toBeGreaterThanOrEqual(requiredRatio(s.px, s.weight))
  }
  expect(checked).toBeGreaterThan(120)
})

// Required test 8, for every label and Brief whether or not it's up at this moment.
test('cursor and Brief labels pass contrast', async ({ page }) => {
  await ready(page)
  const samples = await page.locator('.cursor-label, .brief').evaluateAll(els => els.map((el) => {
    const { color, backgroundColor, fontSize, fontWeight } = getComputedStyle(el)
    const rgb = (c: string) => c.match(/[\d.]+/g)!.slice(0, 3).map(Number) as [number, number, number]
    return { text: el.textContent, fg: rgb(color), bg: rgb(backgroundColor), px: Number.parseFloat(fontSize), weight: Number(fontWeight) }
  }))
  expect(samples.length).toBeGreaterThan(5)
  for (const s of samples)
    expect(contrastRatio(s.fg, s.bg), s.text ?? '').toBeGreaterThanOrEqual(requiredRatio(s.px, s.weight))
})
