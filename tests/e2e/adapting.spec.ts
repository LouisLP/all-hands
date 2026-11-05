import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'

// What the Build does when the world changes under it: the window, the OS setting, the keyboard.

const track = (page: Page) => page.locator('.track')
const camera = (page: Page) => page.locator('.camera')
const pinnedHtml = (page: Page) => page.locator('.pinned').evaluate(el => el.outerHTML)
const scrollY = (page: Page) => page.evaluate(() => window.scrollY)
const trackLength = (page: Page) => track(page).evaluate(el => el.getBoundingClientRect().height)

async function ready(page: Page) {
  await page.goto('')
  await track(page).waitFor({ state: 'attached' })
  return trackLength(page)
}

async function scrollTo(page: Page, y: number) {
  await page.evaluate(async (y) => {
    window.scrollTo(0, y)
    for (let frame = 0; frame < 3; frame++)
      await new Promise(requestAnimationFrame)
  }, y)
}

/** Waits past the rebuild's frame, and past ScrollTrigger's own 200ms refresh after a resize. */
async function settle(page: Page) {
  await page.waitForTimeout(350)
}

const progressOf = async (page: Page) => (await scrollY(page)) / (await trackLength(page))

test.describe('resizing', () => {
  test('re-measures, recompiles and seeks to the same progress', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    const length = await ready(page)
    await scrollTo(page, Math.round(length * 0.4))
    const before = await progressOf(page)

    await page.setViewportSize({ width: 1100, height: 700 })
    await settle(page)

    await expect(track(page)).toHaveCount(1)
    await expect(page.locator('.overlay')).toHaveCount(1)
    expect(await progressOf(page)).toBeCloseTo(before, 2)
    await expect(page.locator('html')).toHaveAttribute('data-entry', 'running')
  })

  test('draws what a fresh load at that size draws', async ({ page, browser, baseURL }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    const length = await ready(page)
    await scrollTo(page, Math.round(length * 0.55))
    await page.setViewportSize({ width: 1100, height: 700 })
    await settle(page)
    const y = Math.round(await trackLength(page) * 0.3)
    await scrollTo(page, y)

    const context = await browser.newContext({ viewport: { width: 1100, height: 700 }, baseURL })
    const fresh = await context.newPage()
    await ready(fresh)
    await scrollTo(fresh, y)
    expect(await pinnedHtml(page)).toBe(await pinnedHtml(fresh))
    await context.close()
  })

  test('locks sections to the new finished size', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await ready(page)
    await scrollTo(page, 100)
    await page.setViewportSize({ width: 1100, height: 700 })
    await settle(page)
    const { hero, clientWidth } = await page.evaluate(() => ({
      hero: document.querySelector('[data-build="hero"]')!.getBoundingClientRect().width,
      clientWidth: document.documentElement.clientWidth,
    }))
    expect(hero).toBe(clientWidth)
  })

  for (const [where, y] of [['just', 150], ['well', 2000]] as const) {
    test(`${where} below the Track, stays finished and past it`, async ({ page }) => {
      await page.setViewportSize({ width: 1440, height: 900 })
      const length = await ready(page)
      await scrollTo(page, length + y)

      await page.setViewportSize({ width: 1100, height: 700 })
      await settle(page)

      expect(await scrollY(page)).toBeGreaterThanOrEqual(await trackLength(page))
      expect(await page.locator('.camera [style], .camera[style]').count()).toBe(0)
      await expect(page.locator('.overlay')).toBeHidden()
    })
  }

  test('below the Track, the same content stays on screen', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    const length = await ready(page)
    const contact = page.locator('#contact')
    await scrollTo(page, length + await contact.evaluate(el => (el as HTMLElement).offsetTop))
    await expect(contact).toBeInViewport()

    await page.setViewportSize({ width: 1100, height: 700 })
    await settle(page)
    await expect(contact).toBeInViewport()
  })

  test('leaves nothing behind after several in a row', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await ready(page)
    for (const width of [1300, 1200, 1100, 1400]) {
      await page.setViewportSize({ width, height: 800 })
      await page.waitForTimeout(50)
    }
    await settle(page)
    await expect(track(page)).toHaveCount(1)
    await expect(page.locator('.overlay')).toHaveCount(1)
    await expect(page.locator('.cursor')).toHaveCount(5)
  })

  test('still un-builds by scrolling afterwards', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    const length = await ready(page)
    await scrollTo(page, length + 100)
    await page.setViewportSize({ width: 1100, height: 700 })
    await settle(page)
    await scrollTo(page, Math.round(await trackLength(page) / 2))
    await expect(page.locator('.overlay')).toBeVisible()
    expect(await page.locator('.camera [style]').count()).toBeGreaterThan(0)
  })
})

test.describe('the OS motion setting', () => {
  test('changing it mid-visit recompiles at the same progress, both ways', async ({ page }) => {
    const full = await ready(page)
    await scrollTo(page, Math.round(full * 0.5))
    const before = await progressOf(page)

    await page.emulateMedia({ reducedMotion: 'reduce' })
    await settle(page)
    const reduced = await trackLength(page)
    expect(reduced).toBeLessThan(full)
    expect(await progressOf(page)).toBeCloseTo(before, 2)

    await page.emulateMedia({ reducedMotion: 'no-preference' })
    await settle(page)
    expect(await trackLength(page)).toBe(full)
    expect(await progressOf(page)).toBeCloseTo(before, 2)
  })
})

test.describe('under reduced motion', () => {
  test.use({ contextOptions: { reducedMotion: 'reduce' } })

  test('a qualifying desktop still gets the Build, with a shorter Track', async ({ page }) => {
    await ready(page)
    await expect(page.locator('.cursor[data-teammate="delegator"]')).toBeVisible()
    await expect(page.locator('html')).toHaveAttribute('data-entry', 'running')
  })

  test('the Camera cuts, and never sits between two poses', async ({ page }) => {
    const length = await ready(page)
    const scales = new Set<string>()
    for (let y = 0; y < length; y += Math.ceil(length / 200)) {
      await scrollTo(page, y)
      const transform = await camera(page).evaluate(el => (el as HTMLElement).style.transform)
      scales.add(transform.match(/scale\(([^)]+)\)/)?.[1] ?? '1')
    }
    expect(scales.size).toBe(2)
  })

  test('the ambient layer is off', async ({ page }) => {
    const length = await ready(page)
    await scrollTo(page, Math.round(length / 2))
    const running = await page.evaluate(() => document.getAnimations().length)
    expect(running).toBe(0)
    expect(await page.locator('.cursor-body').first().evaluate(el => getComputedStyle(el).animationName)).toBe('none')
  })
})

test('the ambient layer is off on the finished page, and on during the Build', async ({ page }) => {
  const length = await ready(page)
  await scrollTo(page, Math.round(length / 2))
  expect(await page.evaluate(() => document.getAnimations().length)).toBeGreaterThan(0)
  await scrollTo(page, length)
  expect(await page.evaluate(() => document.getAnimations().length)).toBe(0)
})

// Required test 6, for each link on the page.
const LINKS = [
  ['the hero button', '[data-build="hero-button"]'],
  ['a project link', '[data-build="card3-link"]'],
  ['the contact button', '[data-build="contact-button"]'],
  ['a footer link', '[data-build="contact-links"] a'],
  ['the colophon link', '[data-build="colophon"] a'],
] as const

// A real key press sets :focus-visible. WebKit on a Mac doesn't Tab to links, so walk it there with Alt.
async function tabTo(page: Page, selector: string, browserName: string) {
  const key = browserName === 'webkit' ? 'Alt+Tab' : 'Tab'
  for (let press = 0; press < 20; press++) {
    await page.keyboard.press(key)
    if (await page.locator(selector).first().evaluate(el => el === document.activeElement))
      return
  }
  throw new Error(`Tab never reached ${selector}`)
}

async function expectFullyOnScreen(page: Page, selector: string) {
  const { top, left, bottom, right, width, height, innerHeight, innerWidth } = await page.locator(selector).first().evaluate((el) => {
    const { top, left, bottom, right, width, height } = el.getBoundingClientRect()
    return { top, left, bottom, right, width, height, innerHeight: window.innerHeight, innerWidth: window.innerWidth }
  })
  expect(width).toBeGreaterThan(0)
  expect(height).toBeGreaterThan(0)
  expect(top).toBeGreaterThanOrEqual(0)
  expect(left).toBeGreaterThanOrEqual(0)
  expect(bottom).toBeLessThanOrEqual(innerHeight)
  expect(right).toBeLessThanOrEqual(innerWidth)
}

// Everything between the element and the page has to be there, not only the element.
async function expectDrawn(page: Page, selector: string) {
  const hidden = await page.locator(selector).first().evaluate((el) => {
    const camera = document.querySelector('.camera')
    const found: string[] = []
    for (let node: Element | null = el; node && node !== camera; node = node.parentElement) {
      const { opacity, clipPath } = getComputedStyle(node)
      if (opacity !== '1' || clipPath !== 'none')
        found.push(`${node.getAttribute('data-build') ?? node.tagName}: ${opacity} ${clipPath}`)
    }
    return found
  })
  expect(hidden).toEqual([])
}

for (const viewport of [{ width: 1024, height: 600 }, { width: 1440, height: 900 }]) {
  test.describe(`tabbing during the Build at ${viewport.width}x${viewport.height}`, () => {
    test.use({ viewport })

    for (const [name, selector] of LINKS) {
      test(`from the top, ${name} ends up on screen and drawn`, async ({ page, browserName }) => {
        await ready(page)
        await tabTo(page, selector, browserName)
        await page.waitForTimeout(100)
        await expectFullyOnScreen(page, selector)
        await expectDrawn(page, selector)
      })
    }
  })
}

test('the page stays at the reveal point once the link has focus', async ({ page, browserName }) => {
  await ready(page)
  await tabTo(page, '[data-build="contact-button"]', browserName)
  const y = await scrollY(page)
  await page.waitForTimeout(300)
  expect(await scrollY(page)).toBe(y)
  expect(y).toBeGreaterThan(0)
})

test('tabbing back leaves the link on screen', async ({ page, browserName }) => {
  await ready(page)
  await tabTo(page, '[data-build="colophon"] a', browserName)
  for (let press = 0; press < 4; press++) {
    await page.keyboard.press(browserName === 'webkit' ? 'Alt+Shift+Tab' : 'Shift+Tab')
    await page.waitForTimeout(50)
    if (await page.evaluate(() => document.activeElement?.tagName) === 'A')
      await expect(page.locator(':focus')).toBeInViewport({ ratio: 0.99 })
  }
})

test('below the Track, focus is left to the browser', async ({ page, browserName }) => {
  const length = await ready(page)
  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight))
  await page.waitForTimeout(100)
  await tabTo(page, '[data-build="colophon"] a', browserName)
  expect(await scrollY(page)).toBeGreaterThan(length)
  await expect(page.locator('.overlay')).toBeHidden()
})

test('a click doesn\'t jump the Build', async ({ page }) => {
  const length = await ready(page)
  // Mid-Build, with the first project link drawn but its card not yet coloured.
  await page.evaluate(() => document.addEventListener('click', event => event.preventDefault()))
  let y = 0
  let point: { x: number, y: number } | null = null
  for (let candidate = 0; candidate < length && !point; candidate += Math.ceil(length / 200)) {
    await scrollTo(page, candidate)
    y = candidate
    point = await page.evaluate(() => {
      const shown = document.querySelector('[data-build="card1-link"] .typed')
      const card = document.querySelector<HTMLElement>('[data-build="card1"]')!
      if (shown?.textContent !== 'Project' || card.style.clipPath !== 'none')
        return null
      const { left, top, width, height } = shown.getBoundingClientRect()
      const middle = { x: left + width / 2, y: top + height / 2 }
      return middle.y > 0 && middle.y < window.innerHeight ? middle : null
    })
  }
  expect(point).not.toBeNull()
  // The mouse rather than `click()`, whose scrolling into view would move the Build itself.
  await page.mouse.click(point!.x, point!.y)
  await page.waitForTimeout(100)
  expect(await scrollY(page)).toBe(y)
})
