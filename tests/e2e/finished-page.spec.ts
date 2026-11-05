import { expect, test } from '@playwright/test'

import { contrastRatio, requiredRatio } from '../support/contrast'

const BUILD_NAMES = [
  'hero', 'hero-meta', 'hero-marks-top', 'title', 'name', 'role', 'hero-marks-bottom', 'hero-intro', 'hero-button', 'hero-shapes',
  'about', 'about-panel', 'about-label', 'about-heading', 'about-body', 'about-body1', 'about-body2',
  'work', 'work-heading',
  ...[1, 2, 3].flatMap(n => ['', '-index', '-title', '-link', '-details', '-description', '-stack', '-arrow'].map(part => `card${n}${part}`)),
  'contact', 'contact-button', 'footer', 'contact-links', 'colophon',
]

test.describe('with JavaScript off', () => {
  test.use({ javaScriptEnabled: false })

  test('the whole page is there as semantic HTML', async ({ page }) => {
    await page.goto('')
    await expect(page.getByRole('main')).toHaveCount(1)
    await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1)
    await expect(page.getByRole('heading', { level: 1 })).toContainText('Louis LP')
    await expect(page.getByRole('heading', { level: 1 })).toContainText('Design Engineer')
    await expect(page.getByRole('heading', { level: 2 })).toHaveCount(3)
    await expect(page.getByRole('article')).toHaveCount(3)

    for (const link of await page.getByRole('article').getByRole('link').all())
      await expect(link).toHaveAttribute('href', /^https:\/\//)

    const getInTouch = page.getByRole('link', { name: 'Get in touch' })
    await expect(getInTouch).toHaveCount(2)
    await expect(getInTouch.first()).toHaveAttribute('href', '#contact')
    await expect(getInTouch.last()).toHaveAttribute('href', /^mailto:/)
  })
})

test('the built index.html already holds the page', async ({ request }) => {
  const html = await (await request.get('')).text()
  for (const text of ['Louis LP', 'Design Engineer', 'Selected work', 'Agile UI', 'Colour Combos', 'Kaki', 'Get in touch'])
    expect(html).toContain(text)
})

test('every Build target has exactly one data-build name', async ({ page }) => {
  await page.goto('')
  const names = await page.locator('[data-build]').evaluateAll(els => els.map(el => el.getAttribute('data-build')))
  expect([...names].sort()).toEqual([...BUILD_NAMES].sort())
})

test('hydrates cleanly and loads nothing from other origins', async ({ page, baseURL }) => {
  const problems: string[] = []
  const foreign: string[] = []
  page.on('console', (m) => {
    if (m.type() === 'error' || m.type() === 'warning')
      problems.push(m.text())
  })
  page.on('pageerror', e => problems.push(e.message))
  page.on('request', (r) => {
    if (new URL(r.url()).origin !== new URL(baseURL!).origin)
      foreign.push(r.url())
  })
  await page.goto('', { waitUntil: 'networkidle' })
  expect(problems).toEqual([])
  expect(foreign).toEqual([])
})

test('hydrates the prerendered page instead of rendering it again', async ({ page }) => {
  await page.addInitScript(() => {
    new MutationObserver((records) => {
      if (records.some(r => [...r.removedNodes].some(n => n instanceof Element && n.querySelector('#hero, #contact'))))
        document.documentElement.dataset.remounted = 'true'
    }).observe(document, { subtree: true, childList: true })
  })
  await page.goto('', { waitUntil: 'networkidle' })
  await expect(page.locator('html')).not.toHaveAttribute('data-remounted')
})

test('self-hosted fonts are used, and nothing animates', async ({ page }) => {
  // A remembered skip, because the Build animates its cursors and opens in system type.
  await page.addInitScript(() => sessionStorage.setItem('all-hands:skip', '1'))
  await page.goto('')
  await page.evaluate(() => document.fonts.ready)
  const state = await page.evaluate(() => ({
    faces: [...document.fonts].filter(f => f.status === 'loaded').map(f => `${f.family.replaceAll('"', '')} ${f.weight}`),
    animations: document.getAnimations().length,
  }))
  expect(state.faces.sort()).toEqual(['Anton 400', 'Archivo 400', 'Archivo 600', 'JetBrains Mono 500'])
  expect(state.animations).toBe(0)
})

for (const [width, height] of [[320, 568], [360, 740], [568, 320], [768, 1024], [1024, 768], [1440, 900], [2560, 1080]] as const) {
  test.describe(`${width}x${height}`, () => {
    test.use({ viewport: { width, height } })

    // A remembered skip, because a passing width otherwise starts on the neutral canvas.
    test.beforeEach(async ({ page }) => {
      await page.addInitScript(() => sessionStorage.setItem('all-hands:skip', '1'))
    })

    test('nothing overflows sideways', async ({ page }) => {
      await page.goto('')
      await page.evaluate(() => document.fonts.ready)
      const result = await page.evaluate(() => {
        const limit = document.documentElement.clientWidth
        const over: string[] = []
        const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT)
        const range = document.createRange()
        while (walker.nextNode()) {
          const node = walker.currentNode
          if (!node.textContent?.trim() || node.parentElement?.closest('.visually-hidden'))
            continue
          range.selectNodeContents(node)
          const { left, right } = range.getBoundingClientRect()
          if (left < 0 || right > limit)
            over.push(`${node.textContent.trim()}: ${left.toFixed(1)}–${right.toFixed(1)} of ${limit}`)
        }
        return { over, scrollWidth: document.documentElement.scrollWidth, limit }
      })
      expect(result.over).toEqual([])
      expect(result.scrollWidth).toBeLessThanOrEqual(result.limit)
    })

    test('name and role sit in the first viewport', async ({ page }) => {
      await page.goto('')
      await page.evaluate(() => document.fonts.ready)
      for (const name of ['name', 'role']) {
        const box = await page.locator(`[data-build="${name}"]`).boundingBox()
        expect(box).not.toBeNull()
        expect(box!.y).toBeGreaterThanOrEqual(0)
        expect(box!.y + box!.height).toBeLessThanOrEqual(height)
      }
    })

    test('page text passes contrast, and Crest stays on Get in touch', async ({ page }) => {
      await page.goto('')
      await page.evaluate(() => document.fonts.ready)
      const { samples, crest } = await page.evaluate(() => {
        const parse = (c: string) => {
          const m = c.match(/[\d.]+/g)!.map(Number)
          return { rgb: [m[0]!, m[1]!, m[2]!] as const, a: m[3] ?? 1 }
        }
        const samples = []
        const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT)
        while (walker.nextNode()) {
          const el = walker.currentNode.parentElement!
          if (!walker.currentNode.textContent?.trim() || el.closest('.visually-hidden'))
            continue
          const css = getComputedStyle(el)
          let ground: Element = el
          let bg = parse(getComputedStyle(ground).backgroundColor)
          while (bg.a === 0 && ground.parentElement) {
            ground = ground.parentElement
            bg = parse(getComputedStyle(ground).backgroundColor)
          }
          samples.push({
            text: walker.currentNode.textContent.trim().slice(0, 30),
            fg: parse(css.color).rgb,
            bg: bg.rgb,
            px: Number.parseFloat(css.fontSize),
            weight: Number(css.fontWeight),
          })
        }
        const crest = [...document.body.querySelectorAll('*')]
          .filter(el => getComputedStyle(el).backgroundColor === 'rgb(224, 243, 84)')
          .map(el => el.getAttribute('data-build'))
        return { samples, crest }
      })
      expect(samples.length).toBeGreaterThan(10)
      for (const s of samples)
        expect(contrastRatio(s.fg, s.bg), `${s.text} at ${s.px}px`).toBeGreaterThanOrEqual(requiredRatio(s.px, s.weight))
      expect(crest.sort()).toEqual(['contact-button', 'hero-button'])
    })
  })
}
