import { gsap } from 'gsap'

import type { Action, BriefAction, FitAction, FreePoint, Lane, PanAction, RevealAction, Storyboard, Target, Verb } from './storyboard'

export interface Rect {
  left: number
  top: number
  width: number
  height: number
}

/** The finished page, measured with no Camera. Rects are relative to the page's top left. */
export interface Layout {
  viewport: { width: number, height: number }
  page: { width: number, height: number }
  rects: Partial<Record<string, Rect>>
}

/** One line of the table `draw()` works through: numeric state keys and where they get written. */
export interface Row {
  node:
    | { kind: 'camera' }
    | { kind: 'cursor', lane: Lane }
    | { kind: 'brief', index: number }
    | { kind: 'element', name: string }
  prop: 'camera' | 'presence' | 'translate' | 'opacity'
  keys: readonly string[]
}

export interface Compiled {
  timeline: gsap.core.Timeline
  /** Holds t = 0 until the timeline is seeked. */
  state: Record<string, number>
  rows: readonly Row[]
  /** The text of each Brief, which `index` in a brief Row points at. */
  briefs: readonly { lane: Lane, text: string }[]
  duration: number
}

interface Pose {
  x: number
  y: number
  scale: number
}

const LANE_VERBS: Record<Lane, readonly Verb[]> = {
  designer: ['move', 'reveal'],
  delegator: ['brief'],
}
const CAMERA_VERBS: readonly Verb[] = ['pan', 'fit']

const ENTRY: FreePoint = { x: 105, y: 105 }
const ANCHORS = {
  center: (r: Rect) => ({ x: r.left + r.width / 2, y: r.top + r.height / 2 }),
  corner: (r: Rect) => ({ x: r.left + r.width, y: r.top + r.height }),
}

const EASE = 'power2.inOut'
const MOVE_SECONDS_PER_ROOT_PX = 0.03
const MIN_MOVE_SECONDS = 0.1
const REVEAL_SECONDS = 0.5
const PRESENCE_SECONDS = 0.1
const BRIEF_SECONDS = 1.5
const CAMERA_SECONDS = 1.5
const FIT_MARGIN_PX = 24

const CAMERA_KEYS = ['camera.x', 'camera.y', 'camera.scale'] as const

function isLane(lane: string): lane is Lane {
  return lane in LANE_VERBS
}

export function compile(storyboard: Storyboard, layout: Layout): Compiled {
  if (storyboard.length === 0)
    throw new Error('The Storyboard has no Beats')

  const state: Record<string, number> = {}
  const latest: Record<string, number> = {}
  const rows: Row[] = []
  const briefs: { lane: Lane, text: string }[] = []
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

  // The Camera's path, kept so a cursor can work out where the page will be at any point.
  const easeCamera = gsap.parseEase(EASE)
  const cameraPath: { start: number, end: number, from: Pose, to: Pose }[] = []

  function poseAt(t: number): Pose {
    const segment = cameraPath.filter(({ start }) => start <= t).at(-1)
    if (!segment)
      return { x: 0, y: 0, scale: 1 }
    if (t >= segment.end)
      return segment.to
    const { start, end, from, to } = segment
    const progress = easeCamera((t - start) / (end - start))
    return {
      x: from.x + (to.x - from.x) * progress,
      y: from.y + (to.y - from.y) * progress,
      scale: from.scale + (to.scale - from.scale) * progress,
    }
  }

  function poseOf(action: PanAction | FitAction, beatName: string): Pose {
    const { viewport, page } = layout
    if (action.verb === 'fit') {
      const scale = Math.min(
        1,
        (viewport.width - FIT_MARGIN_PX * 2) / page.width,
        (viewport.height - FIT_MARGIN_PX * 2) / page.height,
      )
      return { x: (viewport.width - page.width * scale) / 2, y: (viewport.height - page.height * scale) / 2, scale }
    }
    const rect = layout.rects[action.target]
    if (!rect)
      throw new Error(`Unknown target "${action.target}" in Beat "${beatName}"`)
    const lowest = Math.max(0, page.height - viewport.height)
    // `+ 0` turns -0 into 0, so the end of a pan reads as no transform.
    return { x: 0, y: -Math.min(rect.top, lowest) + 0, scale: 1 }
  }

  function runCamera(action: PanAction | FitAction, at: number, beatName: string) {
    const to = poseOf(action, beatName)
    const duration = action.duration ?? CAMERA_SECONDS
    cameraPath.push({ start: at, end: at + duration, from: poseAt(at), to })
    tween('camera.x', to.x, at, duration, EASE)
    tween('camera.y', to.y, at, duration, EASE)
    tween('camera.scale', to.scale, at, duration, EASE)
    return duration
  }

  function pagePoint(screen: { x: number, y: number }, pose: Pose) {
    return { x: (screen.x - pose.x) / pose.scale, y: (screen.y - pose.y) / pose.scale }
  }

  function screenPoint(page: { x: number, y: number }, pose: Pose) {
    return { x: pose.x + page.x * pose.scale, y: pose.y + page.y * pose.scale }
  }

  function freePoint(point: FreePoint) {
    return { x: point.x / 100 * layout.viewport.width, y: point.y / 100 * layout.viewport.height }
  }

  function anchorPoint(to: Target, beatName: string) {
    const [name = '', anchor = 'center', ...rest] = to.split('.')
    const rect = layout.rects[name]
    if (!rect || !(anchor in ANCHORS) || rest.length > 0)
      throw new Error(`Unknown target "${to}" in Beat "${beatName}"`)
    return ANCHORS[anchor as keyof typeof ANCHORS](rect)
  }

  // Cursors live in page coordinates, and `draw()` maps them through the Camera. So one
  // that stops on an element stays on it when the Camera moves. A free point is a place on
  // the screen, which only means something once the move ends, so it's converted using the
  // Camera at that moment. Time comes from the distance on screen, so a move takes the same
  // time however far the page is zoomed out.
  function runMove(lane: Lane, to: Target | FreePoint, at: number, beatName: string, override?: number) {
    const start = poseAt(at)
    const named = typeof to === 'string' ? anchorPoint(to, beatName) : undefined
    const screenEnd = named ? screenPoint(named, start) : freePoint(to as FreePoint)
    const screenStart = screenPoint({ x: latest[`${lane}.x`]!, y: latest[`${lane}.y`]! }, start)
    const distance = Math.hypot(screenEnd.x - screenStart.x, screenEnd.y - screenStart.y)
    const duration = override ?? Math.max(MIN_MOVE_SECONDS, MOVE_SECONDS_PER_ROOT_PX * Math.sqrt(distance))
    const { x, y } = named ?? pagePoint(screenEnd, poseAt(at + duration))
    tween(`${lane}.x`, x, at, duration, EASE)
    tween(`${lane}.y`, y, at, duration, EASE)
    return duration
  }

  function runReveal(action: RevealAction, at: number, beatName: string) {
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

  function runBrief(lane: Lane, action: BriefAction, at: number, beatName: string) {
    const travel = runMove(lane, action.at, at, beatName)
    const index = briefs.push({ lane, text: action.text }) - 1
    const key = `brief${index}.presence`
    channel(key, 0)
    rows.push({ node: { kind: 'brief', index }, prop: 'presence', keys: [key] })
    const shown = action.duration ?? BRIEF_SECONDS
    tween(key, 1, at + travel, PRESENCE_SECONDS, 'none')
    tween(key, 0, at + travel + shown - PRESENCE_SECONDS, PRESENCE_SECONDS, 'none')
    return travel + shown
  }

  function enter(lane: Lane, at: number) {
    const start = pagePoint(freePoint(ENTRY), poseAt(at))
    channel(`${lane}.presence`, 0)
    channel(`${lane}.x`, start.x)
    channel(`${lane}.y`, start.y)
    rows.push(
      { node: { kind: 'cursor', lane }, prop: 'presence', keys: [`${lane}.presence`] },
      { node: { kind: 'cursor', lane }, prop: 'translate', keys: [`${lane}.x`, `${lane}.y`, ...CAMERA_KEYS] },
    )
    tween(`${lane}.presence`, 1, at, PRESENCE_SECONDS, 'none')
  }

  function runAction(lane: Lane, action: Action, at: number, beatName: string) {
    switch (action.verb) {
      case 'move':
        return runMove(lane, action.to, at, beatName, action.duration)
      case 'reveal':
        return runReveal(action, at, beatName)
      case 'brief':
        return runBrief(lane, action, at, beatName)
      default:
        throw new Error(`The ${lane} can't "${action.verb}" in Beat "${beatName}"`)
    }
  }

  channel('camera.x', 0)
  channel('camera.y', 0)
  channel('camera.scale', 1)
  rows.push({ node: { kind: 'camera' }, prop: 'camera', keys: CAMERA_KEYS })

  let beatStart = 0
  for (const { name: beatName, lanes } of storyboard) {
    let beatEnd = beatStart

    // The Camera goes first, because the cursors' free points depend on where it will be.
    const { camera = [], ...teammates } = lanes
    let cameraAt = beatStart
    for (const action of camera as readonly Action[]) {
      if (!CAMERA_VERBS.includes(action.verb))
        throw new Error(`The camera can't "${action.verb}" in Beat "${beatName}"`)
      cameraAt += runCamera(action as PanAction | FitAction, cameraAt, beatName)
    }
    beatEnd = Math.max(beatEnd, cameraAt)

    for (const [lane, actions] of Object.entries(teammates) as [string, readonly Action[]][]) {
      if (!isLane(lane))
        throw new Error(`Unknown lane "${lane}" in Beat "${beatName}"`)
      let at = beatStart
      for (const action of actions) {
        if (!LANE_VERBS[lane].includes(action.verb))
          throw new Error(`The ${lane} can't "${action.verb}" in Beat "${beatName}"`)
        if (!(`${lane}.presence` in state))
          enter(lane, at)
        at += runAction(lane, action, at, beatName)
      }
      beatEnd = Math.max(beatEnd, at)
    }
    beatStart = beatEnd
  }

  return { timeline, state, rows, briefs, duration: timeline.duration() }
}
