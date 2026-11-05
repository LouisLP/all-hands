import { expect, test } from '@playwright/test'
import type { Page, Route } from '@playwright/test'

const MANDARIN = 'rgb(253, 85, 10)'
const NEUTRAL = 'rgb(180, 180, 178)'
const ENGINE = '**/assets/engine-*.js'

const html = (page: Page) => page.locator('html')
const hero = (page: Page) => page.locator('[data-build="hero"]')
const hint = (page: Page) => page.getByTestId('desktop-hint')
const track = (page: Page) => page.locator('.track')
const line = (page: Page) => page.locator('.build-line')
const skipLink = (page: Page) => page.getByRole('link', { name: 'Skip' })
const overrides = (page: Page) => page.locator('.camera [style], .camera[style]').count()
const scrollY = (page: Page) => page.evaluate(() => window.scrollY)
const remembered = (page: Page) => page.evaluate(() => sessionStorage.getItem('all-hands:skip'))

async function expectFinishedPage(page: Page) {
  await expect(track(page)).toHaveCount(0)
  await expect(page.locator('.overlay')).toHaveCount(0)
  await expect(html(page)).not.toHaveAttribute('data-entry')
  await expect(hero(page)).toHaveCSS('background-color', MANDARIN)
  await expect(line(page)).toBeHidden()
  expect(await overrides(page)).toBe(0)
}

async function scrollTo(page: Page, y: number) {
  await page.evaluate(async (y) => {
    window.scrollTo(0, y)
    for (let frame = 0; frame < 3; frame++)
      await new Promise(requestAnimationFrame)
  }, y)
}

async function ready(page: Page) {
  await page.goto('')
  await track(page).waitFor({ state: 'attached' })
  return track(page).evaluate(el => el.getBoundingClientRect().height)
}

/** Keeps the engine chunk from arriving until the returned function is called. */
async function holdEngine(page: Page) {
  const held: Route[] = []
  await page.route(ENGINE, (route) => {
    held.push(route)
  })
  return async () => {
    await Promise.all(held.map(route => route.continue()))
    await page.unroute(ENGINE)
  }
}

function watchEngineRequests(page: Page) {
  const requests: string[] = []
  page.on('request', (r) => {
    if (/assets\/(?:engine|storyboard)-/.test(r.url()))
      requests.push(r.url())
  })
  return requests
}

test.describe('first paint on a passing device', () => {
  test('shows name and role in system type on the neutral canvas', async ({ page }) => {
    await holdEngine(page)
    await page.goto('', { waitUntil: 'domcontentloaded' })
    await expect(html(page)).toHaveAttribute('data-entry', 'pending')
    await expect(page.locator('body')).toHaveCSS('background-color', NEUTRAL)
    for (const name of ['name', 'role']) {
      const element = page.locator(`[data-build="${name}"]`)
      await expect(element).toBeVisible()
      expect(await element.evaluate(el => getComputedStyle(el).fontFamily)).toContain('system-ui')
    }
    await expect(page.locator('[data-build="hero-intro"]')).toBeHidden()
    await expect(line(page)).toBeVisible()
    await expect(hint(page)).toBeHidden()
  })

  test('the page is marked before the body is parsed', async ({ page }) => {
    await page.addInitScript(() => {
      new MutationObserver((_, observer) => {
        if (document.body) {
          document.documentElement.setAttribute('data-at-body', document.documentElement.dataset.entry ?? 'none')
          observer.disconnect()
        }
      }).observe(document, { subtree: true, childList: true })
    })
    await page.goto('')
    await expect(html(page)).toHaveAttribute('data-at-body', 'pending')
  })

  test('the engine lifts the neutral canvas when it starts', async ({ page }) => {
    await ready(page)
    await expect(html(page)).toHaveAttribute('data-entry', 'running')
    await expect(line(page)).toBeVisible()
    await expect(hint(page)).toBeHidden()
  })
})

test.describe('failing the check', () => {
  test.use({ viewport: { width: 800, height: 900 } })

  test('never requests the engine, and shows the hint', async ({ page }) => {
    const requests = watchEngineRequests(page)
    await page.goto('', { waitUntil: 'networkidle' })
    expect(requests).toEqual([])
    await expect(track(page)).toHaveCount(0)
    await expect(hint(page)).toBeVisible()
    await expect(line(page)).toBeHidden()
    await expect(hero(page)).toHaveCSS('background-color', MANDARIN)
  })

  test('a hash goes to the section, with the hint', async ({ page }) => {
    await page.goto('#contact')
    await expect(page.locator('#contact')).toBeInViewport()
    await expect(hint(page)).toBeVisible()
  })
})

test.describe('a coarse pointer with no hover', () => {
  test.skip(({ browserName }) => browserName === 'firefox', 'Firefox has no mobile emulation')
  test.use({ viewport: { width: 1280, height: 800 }, hasTouch: true, isMobile: true })

  test('fails the check even when wide', async ({ page }) => {
    const requests = watchEngineRequests(page)
    await page.goto('', { waitUntil: 'networkidle' })
    expect(requests).toEqual([])
    await expect(hint(page)).toBeVisible()
  })
})

test.describe('with JavaScript off', () => {
  test.use({ javaScriptEnabled: false })

  test('there\'s no hint and no neutral canvas', async ({ page }) => {
    await page.goto('')
    await expect(html(page)).not.toHaveAttribute('data-entry')
    await expect(hint(page)).toBeHidden()
    await expect(line(page)).toBeHidden()
    await expect(hero(page)).toHaveCSS('background-color', MANDARIN)
    await expect(page.locator('[data-build="hero-intro"]')).toBeVisible()
  })
})

test.describe('when the engine doesn\'t start', () => {
  test('about 3s without it shows the finished page, and a late engine stays out', async ({ page }) => {
    const release = await holdEngine(page)
    await page.goto('', { waitUntil: 'domcontentloaded' })
    await page.waitForTimeout(2000)
    await expect(html(page)).toHaveAttribute('data-entry', 'pending')
    await expect(html(page)).not.toHaveAttribute('data-entry', { timeout: 2000 })
    await expectFinishedPage(page)

    await release()
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(200)
    await expectFinishedPage(page)
  })

  test('fonts holding the engine past 3s also leave the finished page', async ({ page }) => {
    await page.route('**/fonts/anton-400.woff2', () => {})
    await page.goto('', { waitUntil: 'commit' })
    await expect(html(page)).not.toHaveAttribute('data-entry', { timeout: 6000 })
    await expectFinishedPage(page)
  })

  test('a failed engine load shows the finished page straight away', async ({ page }) => {
    await page.route(ENGINE, route => route.abort())
    await page.goto('')
    await expect(html(page)).not.toHaveAttribute('data-entry', { timeout: 1500 })
    await expectFinishedPage(page)
  })

  test('a failed app load still reaches the finished page', async ({ page }) => {
    await page.route('**/assets/app-*.js', route => route.abort())
    await page.goto('')
    await expect(html(page)).not.toHaveAttribute('data-entry', { timeout: 5000 })
    await expect(hero(page)).toHaveCSS('background-color', MANDARIN)
  })
})

test.describe('skip', () => {
  async function skipFromMidBuild(page: Page) {
    const length = await ready(page)
    await scrollTo(page, length / 2)
    await skipLink(page).click()
  }

  test('ends at the top of the finished page, with the h1 focused', async ({ page }) => {
    await skipFromMidBuild(page)
    await expectFinishedPage(page)
    expect(await scrollY(page)).toBe(0)
    await expect(page.getByRole('heading', { level: 1 })).toBeFocused()
    await expect(hint(page)).toBeHidden()
    expect(new URL(page.url()).hash).toBe('')
  })

  test('is remembered: a reload never requests the engine', async ({ page }) => {
    await skipFromMidBuild(page)
    const requests = watchEngineRequests(page)
    await page.reload({ waitUntil: 'networkidle' })
    expect(requests).toEqual([])
    await expectFinishedPage(page)
    await expect(hint(page)).toBeHidden()
  })

  test('works before the engine has loaded', async ({ page }) => {
    await holdEngine(page)
    await page.goto('', { waitUntil: 'domcontentloaded' })
    await skipLink(page).click()
    await expectFinishedPage(page)
    await expect(page.getByRole('heading', { level: 1 })).toBeFocused()
    expect(await remembered(page)).toBe('1')
  })

  test('isn\'t remembered in a new session', async ({ page, browser, baseURL }) => {
    await skipFromMidBuild(page)
    const context = await browser.newContext({ baseURL })
    await ready(await context.newPage())
    await context.close()
  })
})

test('a hash on load counts as a skip, then goes to that section', async ({ page }) => {
  const requests = watchEngineRequests(page)
  await page.goto('#contact', { waitUntil: 'networkidle' })
  expect(requests).toEqual([])
  await expect(track(page)).toHaveCount(0)
  await expect(page.locator('#contact')).toBeInViewport()
  await expect(hint(page)).toBeHidden()
  expect(await remembered(page)).toBe('1')
})

test.describe('narrowing below the check', () => {
  test('exits for this visit: not remembered, and only a reload checks again', async ({ page }) => {
    const length = await ready(page)
    await scrollTo(page, length / 2)

    await page.setViewportSize({ width: 800, height: 720 })
    await expect(track(page)).toHaveCount(0)
    await expectFinishedPage(page)
    await expect.poll(() => scrollY(page)).toBe(0)
    await expect(hint(page)).toBeHidden()
    expect(await remembered(page)).toBeNull()

    await page.setViewportSize({ width: 1280, height: 720 })
    await page.waitForTimeout(200)
    await expectFinishedPage(page)

    await page.reload()
    await track(page).waitFor({ state: 'attached' })
  })

  test('below the Track, the same content stays on screen', async ({ page }) => {
    const length = await ready(page)
    const contact = page.locator('#contact')
    await scrollTo(page, length + await contact.evaluate(el => (el as HTMLElement).offsetTop))
    await expect(contact).toBeInViewport()

    await page.setViewportSize({ width: 800, height: 720 })
    await expect(track(page)).toHaveCount(0)
    await expect(contact).toBeInViewport()
  })

  test('before the engine loads, the finished page shows and it never starts', async ({ page }) => {
    const release = await holdEngine(page)
    await page.goto('', { waitUntil: 'domcontentloaded' })
    await page.setViewportSize({ width: 800, height: 720 })
    await expect(html(page)).not.toHaveAttribute('data-entry')
    await release()
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(200)
    await expectFinishedPage(page)
  })
})

test.describe('reloading', () => {
  test('mid-Build restores scroll and seeks to match', async ({ page }) => {
    const length = await ready(page)
    const y = Math.round(length / 2)
    await scrollTo(page, y)
    const pinned = await page.locator('.pinned').evaluate(el => el.outerHTML)

    await page.reload()
    await track(page).waitFor({ state: 'attached' })
    await expect(html(page)).toHaveAttribute('data-entry', 'running')
    expect(await scrollY(page)).toBe(y)
    expect(await page.locator('.pinned').evaluate(el => el.outerHTML)).toBe(pinned)
  })

  test('below the Track seeks to the end, and scrolling back un-builds', async ({ page }) => {
    const length = await ready(page)
    await scrollTo(page, length + 300)

    await page.reload()
    await track(page).waitFor({ state: 'attached' })
    expect(await scrollY(page)).toBe(length + 300)
    expect(await overrides(page)).toBe(0)
    await expect(page.locator('.overlay')).toBeHidden()
    await expect(line(page)).toBeHidden()

    await scrollTo(page, length / 2)
    await expect(line(page)).toBeVisible()
    expect(await overrides(page)).toBeGreaterThan(0)
  })

  test('a fresh visit starts at the top, whatever was saved', async ({ page }) => {
    const length = await ready(page)
    await scrollTo(page, length / 2)
    await page.goto('about:blank')
    await ready(page)
    expect(await scrollY(page)).toBe(0)
  })
})

test.describe('production errors', () => {
  test('while starting, the engine goes and the finished page shows', async ({ page }) => {
    await page.addInitScript(() => {
      const original = Element.prototype.getBoundingClientRect
      Element.prototype.getBoundingClientRect = function () {
        if (this.classList.contains('camera'))
          throw new Error('Boom')
        return original.call(this)
      }
    })
    await page.goto('', { waitUntil: 'networkidle' })
    await expect(html(page)).not.toHaveAttribute('data-entry')
    await expectFinishedPage(page)
  })

  test('while scrubbing, the engine goes and the finished page shows', async ({ page }) => {
    const length = await ready(page)
    await page.evaluate(() => {
      Object.defineProperty(HTMLElement.prototype, 'style', {
        get() {
          throw new Error('Boom')
        },
      })
    })
    await scrollTo(page, length / 2)
    await expectFinishedPage(page)
    expect(await remembered(page)).toBeNull()
  })
})
