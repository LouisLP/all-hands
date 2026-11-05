import type { Row } from './compile'
import type { Overlay } from './overlay'

const WRITERS: Record<Row['prop'], (el: HTMLElement, values: readonly number[]) => void> = {
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
  opacity(el, [opacity]) {
    el.style.opacity = String(opacity)
  },
}

export interface Drawing {
  /** Writes whatever changed since the last draw. */
  draw: () => void
  /** Removes every override, which leaves the plain finished page. */
  clear: () => void
}

export function createDrawing(
  rows: readonly Row[],
  state: Readonly<Record<string, number>>,
  camera: HTMLElement,
  overlay: Overlay,
): Drawing {
  function elementOf({ node }: Row) {
    switch (node.kind) {
      case 'camera': return camera
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

  function draw() {
    overlay.element.hidden = false
    for (const row of table) {
      const values = row.keys.map(key => state[key]!)
      const signature = values.join()
      if (signature !== row.written) {
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
