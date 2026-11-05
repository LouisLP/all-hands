import type { Compiled, Row } from './compile'
import { SYSTEM_FONT, SYSTEM_WEIGHT } from './measure'
import type { Overlay } from './overlay'

/** The grey stage. #17 interpolates these to the final palette. */
const NEUTRAL_TOKENS = {
  '--mandarin': '#b4b4b2',
  '--forest': '#4a4a48',
  '--cream': '#f0f0ee',
  '--crest': '#ffffff',
  '--ink': '#1b1b1b',
  // What the page's unbuilt sections sit on, the same grey as the hero's field.
  '--canvas': '#b4b4b2',
}

const WRITERS: Record<Exclude<Row['prop'], 'text'>, (el: HTMLElement | SVGElement, values: readonly number[]) => void> = {
  tokens(el) {
    for (const [token, value] of Object.entries(NEUTRAL_TOKENS))
      el.style.setProperty(token, value)
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
