import type { Lane } from './storyboard'

const POINTER = '<svg viewBox="0 0 16 20" width="16" height="20"><path d="M1 1v15l4-4 3 7 3-1-3-7h6z" /></svg>'

const LABELS: Record<Lane, string> = {
  designer: 'Designer',
  delegator: 'Delegator',
}

export interface Overlay {
  element: HTMLElement
  cursor: (lane: Lane) => HTMLElement
}

export function createOverlay(parent: HTMLElement, lanes: Iterable<Lane>): Overlay {
  const element = document.createElement('div')
  element.className = 'overlay'
  element.setAttribute('aria-hidden', 'true')

  const cursors = new Map<Lane, HTMLElement>()
  for (const lane of lanes) {
    const cursor = document.createElement('div')
    cursor.className = 'cursor'
    cursor.dataset.teammate = lane
    cursor.innerHTML = POINTER

    const label = document.createElement('span')
    label.className = 'cursor-label'
    label.textContent = LABELS[lane]
    cursor.append(label)

    element.append(cursor)
    cursors.set(lane, cursor)
  }
  parent.append(element)

  return { element, cursor: lane => cursors.get(lane)! }
}
