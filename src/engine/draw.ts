import type { Row } from './compile'
import type { Overlay } from './overlay'

const WRITERS: Record<Row['prop'], (el: HTMLElement, values: readonly number[]) => void> = {
  presence(el, [presence]) {
    el.style.display = presence === 0 ? 'none' : 'block'
    el.style.opacity = String(presence)
  },
  translate(el, [x, y]) {
    el.style.transform = `translate(${x}px, ${y}px)`
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
  const table = rows.map(row => ({
    ...row,
    el: row.node.kind === 'cursor'
      ? overlay.cursor(row.node.lane)
      : camera.querySelector<HTMLElement>(`[data-build="${row.node.name}"]`)!,
    written: undefined as string | undefined,
  }))

  return {
    draw() {
      overlay.element.hidden = false
      for (const row of table) {
        const values = row.keys.map(key => state[key]!)
        const signature = values.join()
        if (signature !== row.written) {
          WRITERS[row.prop](row.el, values)
          row.written = signature
        }
      }
    },
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
