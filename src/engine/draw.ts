import type { Compiled, Row } from './compile'
import { SYSTEM_FONT, SYSTEM_WEIGHT } from './measure'
import type { Overlay } from './overlay'

/** The grey stage, which stays on the root. Fills override it on the elements they colour. */
export const NEUTRAL_TOKENS = {
  '--mandarin': '#b4b4b2',
  '--forest': '#4a4a48',
  '--cream': '#f0f0ee',
  '--crest': '#ffffff',
  '--ink': '#1b1b1b',
  // What the page's unbuilt sections sit on, the same grey as the hero's field.
  '--canvas': '#b4b4b2',
}

/** Where fills end up: the values in tokens.css, so nothing changes when overrides clear. */
export const FINAL_TOKENS = {
  '--mandarin': '#fd550a',
  '--forest': '#015d47',
  '--cream': '#f3e8d2',
  '--crest': '#e0f354',
  '--ink': '#012a20',
}

type Token = keyof typeof FINAL_TOKENS

const PAGE_TOKENS: readonly Token[] = ['--mandarin', '--forest', '--cream', '--ink']

const hexChannels = (hex: string) => [1, 3, 5].map(i => Number.parseInt(hex.slice(i, i + 2), 16))

/** A token's colour at `mix` between neutral (0) and final (1). */
export function mixToken(token: Token, mix: number) {
  const neutral = hexChannels(NEUTRAL_TOKENS[token])
  const channels = hexChannels(FINAL_TOKENS[token]).map((final, i) => Math.round(neutral[i]! + (final - neutral[i]!) * mix))
  return `rgb(${channels.join(', ')})`
}

const WRITERS: Record<Exclude<Row['prop'], 'text'>, (el: HTMLElement | SVGElement, values: readonly number[]) => void> = {
  tokens(el) {
    for (const [token, value] of Object.entries(NEUTRAL_TOKENS))
      el.style.setProperty(token, value)
  },
  fill(el, [mix = 0]) {
    for (const token of PAGE_TOKENS)
      el.style.setProperty(token, mixToken(token, mix))
  },
  crest(el, [mix = 0]) {
    el.style.setProperty('--crest', mixToken('--crest', mix))
  },
  camera(el, [x = 0, y = 0, scale = 1]) {
    // `none` at rest, because even an identity transform would make a stacking context.
    el.style.transform = x === 0 && y === 0 && scale === 1 ? 'none' : `translate(${x}px, ${y}px) scale(${scale})`
  },
  presence(el, [presence]) {
    el.style.display = presence === 0 ? 'none' : 'block'
    el.style.opacity = String(presence)
  },
  // Page coordinates, mapped through the Camera so the cursor stays at screen size.
  translate(el, [x = 0, y = 0, cameraX = 0, cameraY = 0, scale = 1]) {
    el.style.transform = `translate(${cameraX + x * scale}px, ${cameraY + y * scale}px)`
  },
  // The same mapping for the selection, whose box does scale with the page it's around.
  box(el, [x = 0, y = 0, width = 0, height = 0, cameraX = 0, cameraY = 0, scale = 1]) {
    el.style.transform = `translate(${cameraX + x * scale}px, ${cameraY + y * scale}px)`
    el.style.width = `${width * scale}px`
    el.style.height = `${height * scale}px`
  },
  opacity(el, [opacity]) {
    el.style.opacity = String(opacity)
  },
  lock(el, [width, height]) {
    el.style.width = `${width}px`
    el.style.height = `${height}px`
  },
  offset(el, [x = 0, y = 0]) {
    el.style.transform = x === 0 && y === 0 ? 'none' : `translate(${x}px, ${y}px)`
  },
  clip(el, [clip = 0]) {
    el.style.clipPath = clip === 0 ? 'none' : `inset(0 ${clip * 100}% ${clip * 100}% 0)`
  },
  fontSize(el, [fontSize]) {
    el.style.fontSize = `${fontSize}px`
  },
  // A threshold: system type up to the switch, then whatever the page says.
  font(el, [font = 0]) {
    el.style.fontFamily = font < 0.5 ? SYSTEM_FONT : ''
    el.style.fontWeight = font < 0.5 ? SYSTEM_WEIGHT : ''
    el.style.textTransform = font < 0.5 ? 'none' : ''
  },
}

export interface Drawing {
  /** Writes whatever changed since the last draw. */
  draw: () => void
  /** Removes every override, which leaves the plain finished page. */
  clear: () => void
}

export function createDrawing(
  { rows, state, texts }: Compiled,
  camera: HTMLElement,
  line: HTMLElement,
  overlay: Overlay,
): Drawing {
  function elementOf({ node }: Row): HTMLElement | SVGElement {
    switch (node.kind) {
      case 'root': return document.documentElement
      case 'camera': return camera
      case 'line': return line
      case 'selection': return overlay.selection
      case 'cursor': return overlay.cursor(node.lane)
      case 'brief': return overlay.brief(node.index)
      case 'element': return camera.querySelector<HTMLElement>(`[data-build="${node.name}"]`)!
    }
  }

  const table = rows.map(row => ({
    ...row,
    el: elementOf(row),
    written: undefined as string | undefined,
  }))

  // Typed elements, and the nodes they held, which go back untouched when overrides clear.
  const typed = new Map<HTMLElement | SVGElement, { original: ChildNode[], shown: HTMLElement }>()

  function typedSpans(el: HTMLElement | SVGElement) {
    let spans = typed.get(el)
    if (!spans) {
      const original = [...el.childNodes]
      const hidden = document.createElement('span')
      hidden.className = 'visually-hidden'
      hidden.append(...original)
      const shown = document.createElement('span')
      shown.className = 'typed'
      shown.setAttribute('aria-hidden', 'true')
      el.append(hidden, shown)
      spans = { original, shown }
      typed.set(el, spans)
    }
    return spans
  }

  function writeText(row: typeof table[number], [source = 0, chars = 0]: readonly number[]) {
    const { node } = row
    const sources = node.kind === 'element' ? texts[node.name] : undefined
    const text = sources?.[Math.round(source)] ?? ''
    const count = Math.round(chars)
    const { shown } = typedSpans(row.el)
    shown.textContent = text.slice(0, count)
    shown.toggleAttribute('data-typing', count > 0 && count < text.length)
  }

  function draw() {
    overlay.element.hidden = false
    for (const row of table) {
      const values = row.keys.map(key => state[key]!)
      const signature = values.join()
      if (signature !== row.written) {
        if (row.prop === 'text')
          writeText(row, values)
        else
          WRITERS[row.prop](row.el, values)
        row.written = signature
      }
    }
  }

  return {
    // Only the runtime budget's own build sets this, and the rest compile it out.
    draw: import.meta.env.VITE_PROFILE_DRAW ? timed(draw) : draw,
    clear() {
      overlay.element.hidden = true
      for (const [el, { original }] of typed)
        el.replaceChildren(...original)
      typed.clear()
      for (const row of table) {
        row.written = undefined
        // Reading first flushes the pending inline style. Otherwise Chromium and WebKit
        // write back an empty style="" after the removal.
        if (row.el.hasAttribute('style'))
          row.el.removeAttribute('style')
      }
    },
  }
}

function timed(draw: () => void) {
  return () => {
    const start = performance.now()
    draw()
    performance.measure('draw', { start, end: performance.now() })
  }
}
