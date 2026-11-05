import type { Layout } from './compile'

/** The neutral type the page opens in, matching the first paint in build.css. */
export const SYSTEM_FONT = 'system-ui, sans-serif'
export const SYSTEM_WEIGHT = '600'

/** Reads the finished layout, relative to the Camera's origin so scroll position doesn't matter. */
export function measure(camera: HTMLElement): Layout {
  const origin = camera.getBoundingClientRect()
  const ruler = document.createElement('canvas').getContext('2d')!
  ruler.font = `${SYSTEM_WEIGHT} 100px ${SYSTEM_FONT}`

  const rects: Layout['rects'] = {}
  const fontSizes: Layout['fontSizes'] = {}
  const texts: Layout['texts'] = {}
  for (const el of camera.querySelectorAll<HTMLElement>('[data-build]')) {
    const name = el.dataset.build!
    const { left, top, width, height } = el.getBoundingClientRect()
    rects[name] = { left: left - origin.left, top: top - origin.top, width, height }
    fontSizes[name] = Number.parseFloat(getComputedStyle(el).fontSize)
    if (el.children.length === 0 && el.textContent) {
      const text = el.textContent
      texts[name] = { text, systemWidthEm: ruler.measureText(text).width / 100 }
    }
  }
  return {
    viewport: { width: document.documentElement.clientWidth, height: window.innerHeight },
    page: { width: origin.width, height: origin.height },
    rects,
    fontSizes,
    texts,
  }
}
