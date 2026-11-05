import type { Note } from './compile'
import type { Lane } from './storyboard'

const POINTER = '<svg viewBox="0 0 16 20" width="16" height="20"><path d="M1 1v15l4-4 3 7 3-1-3-7h6z" /></svg>'

const LABELS: Record<Lane, string> = {
  delegator: 'Delegator',
  designer: 'Designer',
  backend: 'Backend',
  agent1: 'Agent 1',
  agent2: 'Agent 2',
}

export interface Overlay {
  element: HTMLElement
  selection: HTMLElement
  cursor: (lane: Lane) => HTMLElement
  brief: (index: number) => HTMLElement
}

export function createOverlay(
  parent: HTMLElement,
  lanes: Iterable<Lane>,
  briefs: readonly Note[],
): Overlay {
  const element = document.createElement('div')
  element.className = 'overlay'
  element.setAttribute('aria-hidden', 'true')

  const selection = document.createElement('div')
  selection.className = 'selection'
  element.append(selection)

  const cursors = new Map<Lane, { cursor: HTMLElement, body: HTMLElement }>()
  for (const lane of lanes) {
    const cursor = document.createElement('div')
    cursor.className = 'cursor'
    cursor.dataset.teammate = lane

    // Separate from the scrubbed transform on `cursor`, so idle drift can never touch it.
    const body = document.createElement('div')
    body.className = 'cursor-body'
    body.innerHTML = POINTER

    const label = document.createElement('span')
    label.className = 'cursor-label'
    label.textContent = LABELS[lane]
    body.append(label)
    cursor.append(body)

    element.append(cursor)
    cursors.set(lane, { cursor, body })
  }

  // Inside its cursor, because a Brief goes where the cursor goes.
  const bubbles = briefs.map(({ lane, kind, text }) => {
    const bubble = document.createElement('p')
    bubble.className = 'brief'
    bubble.dataset.kind = kind
    bubble.textContent = text
    cursors.get(lane)!.body.append(bubble)
    return bubble
  })
  parent.append(element)

  return { element, selection, cursor: lane => cursors.get(lane)!.cursor, brief: index => bubbles[index]! }
}
