/** WCAG contrast. Plain functions, so the Playwright page audit and Vitest share one definition. */
export type Rgb = readonly [number, number, number]

function channel(value: number): number {
  const v = value / 255
  return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4
}

function luminance([r, g, b]: Rgb): number {
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b)
}

export function contrastRatio(a: Rgb, b: Rgb): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number]
  return (hi + 0.05) / (lo + 0.05)
}

export function hexToRgb(hex: string): Rgb {
  const channelAt = (i: number) => Number.parseInt(hex.slice(i, i + 2), 16)
  return [channelAt(1), channelAt(3), channelAt(5)]
}

/** WCAG large text: 24px and up, or 18.66px and up when bold. */
export function requiredRatio(fontSizePx: number, fontWeight: number): number {
  return fontSizePx >= 24 || (fontSizePx >= 18.66 && fontWeight >= 700) ? 3 : 4.5
}

export const palette = {
  mandarin: '#fd550a',
  forest: '#015d47',
  cream: '#f3e8d2',
  crest: '#e0f354',
  ink: '#012a20',
} as const

export interface TextSample {
  text: string
  fg: Rgb
  bg: Rgb
  px: number
  weight: number
}

/** Runs in the page: every piece of text that's drawn, and the colour it sits on. */
export function auditText(): TextSample[] {
  const parse = (c: string) => {
    const m = c.match(/[\d.]+/g)!.map(Number)
    return { rgb: [m[0]!, m[1]!, m[2]!] as const, a: m[3] ?? 1 }
  }
  // Fully clipped is the `box` verb at its start, with nothing dragged out yet.
  const isHidden = (el: Element) => {
    for (let at: Element | null = el; at; at = at.parentElement) {
      const { opacity, clipPath } = getComputedStyle(at)
      if (opacity === '0' || clipPath.includes('100%'))
        return true
    }
    return !el.checkVisibility()
  }
  const samples: TextSample[] = []
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT)
  while (walker.nextNode()) {
    const el = walker.currentNode.parentElement!
    if (!walker.currentNode.textContent?.trim() || el.closest('.visually-hidden') || isHidden(el))
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
  return samples
}
