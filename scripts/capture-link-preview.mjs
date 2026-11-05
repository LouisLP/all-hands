// Screenshots the finished hero into public/og-image.png. Run `pnpm build` first, then again
// after this so dist/ picks the image up. Rerun it when the hero changes.
import { chromium } from '@playwright/test'
import { preview } from 'vite'

const PORT = 4176
const OUTPUT = 'public/og-image.png'

const server = await preview({ preview: { port: PORT, strictPort: true } })
const browser = await chromium.launch()
try {
  // With JavaScript off, the page is the finished page and nothing can start the Build.
  // The hero overflows a 1200x630 viewport, so it's laid out at 1800x945 and scaled down.
  const context = await browser.newContext({
    viewport: { width: 1800, height: 945 },
    deviceScaleFactor: 2 / 3,
    javaScriptEnabled: false,
  })
  const page = await context.newPage()
  await page.goto(`http://localhost:${PORT}/all-hands/`, { waitUntil: 'networkidle' })
  await page.screenshot({ path: OUTPUT })
  console.log(`Wrote ${OUTPUT}`)
}
finally {
  await browser.close()
  await server.close()
}
