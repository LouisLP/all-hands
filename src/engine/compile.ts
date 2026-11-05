import { gsap } from 'gsap'

import type { Action, FreePoint, Lane, Storyboard, Verb } from './storyboard'

export interface Rect {
  left: number
  top: number
  width: number
  height: number
}

/** The finished page, measured with no Camera. Rects are relative to the page's top left. */
export interface Layout {
  viewport: { width: number, height: number }
  rects: Partial<Record<string, Rect>>
}

/** One line of the table `draw()` works through: numeric state keys and where they get written. */
export interface Row {
  node: { kind: 'cursor', lane: Lane } | { kind: 'element', name: string }
  prop: 'presence' | 'translate' | 'opacity'
  keys: readonly string[]
}

export interface Compiled {
  timeline: gsap.core.Timeline
  /** Holds t = 0 until the timeline is seeked. */
  state: Record<string, number>
  rows: readonly Row[]
  duration: number
}

const LANE_VERBS: Record<Lane, readonly Verb[]> = {
  designer: ['move', 'reveal'],
  delegator: [],
}

const ENTRY: FreePoint = { x: 105, y: 105 }
const ANCHORS = {
  center: (r: Rect) => ({ x: r.left + r.width / 2, y: r.top + r.height / 2 }),
  corner: (r: Rect) => ({ x: r.left + r.width, y: r.top + r.height }),
}

const MOVE_SECONDS_PER_ROOT_PX = 0.03
const MIN_MOVE_SECONDS = 0.1
const REVEAL_SECONDS = 0.5
const PRESENCE_SECONDS = 0.1

function isLane(lane: string): lane is Lane {
  return lane in LANE_VERBS
}

export function compile(storyboard: Storyboard, layout: Layout): Compiled {
  if (storyboard.length === 0)
    throw new Error('The Storyboard has no Beats')

  const state: Record<string, number> = {}
  const latest: Record<string, number> = {}
  const rows: Row[] = []
  const timeline = gsap.timeline({ paused: true })

  function channel(key: string, initial: number) {
    state[key] = initial
    latest[key] = initial
  }

  // Explicit start values, because a plain `to` captures its start on first render, and
  // that would depend on the order seeks arrive in.
  function tween(key: string, to: number, at: number, duration: number, ease: string) {
    timeline.fromTo(
      state,
      { [key]: latest[key] },
      { [key]: to, duration, ease, immediateRender: false, lazy: false },
      at,
    )
    latest[key] = to
  }

  function pointOf(to: string | FreePoint, beatName: string) {
    if (typeof to !== 'string') {
      return { x: to.x / 100 * layout.viewport.width, y: to.y / 100 * layout.viewport.height }
    }
    const [name = '', anchor = 'center', ...rest] = to.split('.')
    const rect = layout.rects[name]
    if (!rect || !(anchor in ANCHORS) || rest.length > 0)
      throw new Error(`Unknown target "${to}" in Beat "${beatName}"`)
    return ANCHORS[anchor as keyof typeof ANCHORS](rect)
  }

  function runMove(lane: Lane, action: Extract<Action, { verb: 'move' }>, at: number, beatName: string) {
    const { x, y } = pointOf(action.to, beatName)
    const distance = Math.hypot(x - latest[`${lane}.x`]!, y - latest[`${lane}.y`]!)
    const duration = action.duration ?? Math.max(MIN_MOVE_SECONDS, MOVE_SECONDS_PER_ROOT_PX * Math.sqrt(distance))
    tween(`${lane}.x`, x, at, duration, 'power2.inOut')
    tween(`${lane}.y`, y, at, duration, 'power2.inOut')
    return duration
  }

  function runReveal(action: Extract<Action, { verb: 'reveal' }>, at: number, beatName: string) {
    const key = `${action.target}.opacity`
    if (!layout.rects[action.target])
      throw new Error(`Unknown target "${action.target}" in Beat "${beatName}"`)
    if (!(key in state)) {
      channel(key, 0)
      rows.push({ node: { kind: 'element', name: action.target }, prop: 'opacity', keys: [key] })
    }
    const duration = action.duration ?? REVEAL_SECONDS
    tween(key, 1, at, duration, 'none')
    return duration
  }

  function enter(lane: Lane, at: number) {
    const start = pointOf(ENTRY, '')
    channel(`${lane}.presence`, 0)
    channel(`${lane}.x`, start.x)
    channel(`${lane}.y`, start.y)
    rows.push(
      { node: { kind: 'cursor', lane }, prop: 'presence', keys: [`${lane}.presence`] },
      { node: { kind: 'cursor', lane }, prop: 'translate', keys: [`${lane}.x`, `${lane}.y`] },
    )
    tween(`${lane}.presence`, 1, at, PRESENCE_SECONDS, 'none')
  }

  let beatStart = 0
  for (const { name: beatName, lanes } of storyboard) {
    let beatEnd = beatStart
    for (const [lane, actions] of Object.entries(lanes) as [string, readonly Action[]][]) {
      if (!isLane(lane))
        throw new Error(`Unknown lane "${lane}" in Beat "${beatName}"`)
      let at = beatStart
      for (const action of actions) {
        if (!LANE_VERBS[lane].includes(action.verb))
          throw new Error(`The ${lane} can't "${action.verb}" in Beat "${beatName}"`)
        if (!(`${lane}.presence` in state))
          enter(lane, at)
        at += action.verb === 'move' ? runMove(lane, action, at, beatName) : runReveal(action, at, beatName)
      }
      beatEnd = Math.max(beatEnd, at)
    }
    beatStart = beatEnd
  }

  return { timeline, state, rows, duration: timeline.duration() }
}
