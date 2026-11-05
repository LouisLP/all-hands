import { gsap } from 'gsap'

import type {
  Action,
  BoxAction,
  CrestAction,
  DupAction,
  FillAction,
  FitAction,
  FreePoint,
  Lane,
  LeaveAction,
  NoteAction,
  NudgeAction,
  PanAction,
  ReplaceAction,
  RevealAction,
  SetTypeAction,
  Storyboard,
  Target,
  TypeAction,
  Verb,
} from './storyboard'

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
  /** Each element's finished font size, in px. */
  fontSizes: Partial<Record<string, number>>
  /** Only elements holding nothing but text, which are the ones that can be typed. */
  texts: Partial<Record<string, { text: string, systemWidthEm: number }>>
}

type Prop = 'camera' | 'presence' | 'translate' | 'opacity' | 'tokens' | 'lock' | 'offset' | 'clip' | 'text' | 'fontSize' | 'font' | 'box' | 'fill' | 'crest'

/** One line of the table `draw()` works through: numeric state keys and where they get written. */
export interface Row {
  node:
    | { kind: 'root' }
    | { kind: 'camera' }
    | { kind: 'line' }
    | { kind: 'selection' }
    | { kind: 'cursor', lane: Lane }
    | { kind: 'brief', index: number }
    | { kind: 'element', name: string }
  prop: Prop
  keys: readonly string[]
}

export interface Note {
  lane: Lane
  kind: NoteAction['verb']
  text: string
}

export interface Compiled {
  timeline: gsap.core.Timeline
  /** Holds t = 0 until the timeline is seeked. */
  state: Record<string, number>
  rows: readonly Row[]
  /** The text of each Brief, approval and rejection, which `index` in a brief Row points at. */
  briefs: readonly Note[]
  /** Every text an element shows at some point, which its `source` state picks from. */
  texts: Readonly<Partial<Record<string, readonly string[]>>>
  duration: number
}

interface Point {
  x: number
  y: number
}

interface Pose extends Point {
  scale: number
}

const AGENT_VERBS: readonly Verb[] = ['move', 'reveal', 'type', 'dup', 'fill', 'leave']
const LANE_VERBS: Record<Lane, readonly Verb[]> = {
  delegator: ['brief', 'approve', 'reject', 'leave'],
  designer: ['move', 'reveal', 'box', 'type', 'nudge', 'setType', 'fill', 'crest', 'leave'],
  backend: ['move', 'reveal', 'replace', 'leave'],
  agent1: AGENT_VERBS,
  agent2: AGENT_VERBS,
}
const CAMERA_VERBS: readonly Verb[] = ['pan', 'fit']

/** Where cursors come in from and go out to. */
const OFF_SCREEN: FreePoint = { x: 105, y: 105 }
const ANCHORS = {
  center: (r: Rect) => ({ x: r.left + r.width / 2, y: r.top + r.height / 2 }),
  corner: (r: Rect) => ({ x: r.left + r.width, y: r.top + r.height }),
  origin: (r: Rect) => ({ x: r.left, y: r.top }),
}

const EASE = 'power2.inOut'
// A move's two axes ease differently, which bends its path. A drag's don't, so it runs straight.
const ARC_EASE = 'sine.inOut'
const DRAG_EASE = 'power1.inOut'
const MOVE_SECONDS_PER_ROOT_PX = 0.03
const DRAG_SECONDS_PER_ROOT_PX = 0.05
const MIN_MOVE_SECONDS = 0.1
const REVEAL_SECONDS = 0.5
const PRESENCE_SECONDS = 0.1
const BRIEF_SECONDS = 1.5
const CAMERA_SECONDS = 1.5
const FIT_MARGIN_PX = 24
const TYPE_SECONDS_PER_CHAR = 0.03
const MAX_TYPE_SECONDS = 1.5
const ERASE_SECONDS = 0.25
const SELECT_HOLD_SECONDS = 0.35
/** Long enough to be a tween GSAP can seek in both directions, short enough to read as a switch. */
const SWITCH_SECONDS = 0.001

const CAMERA_KEYS = ['camera.x', 'camera.y', 'camera.scale'] as const

function isLane(lane: string): lane is Lane {
  return lane in LANE_VERBS
}

export function compile(storyboard: Storyboard, layout: Layout): Compiled {
  if (storyboard.length === 0)
    throw new Error('The Storyboard has no Beats')

  const state: Record<string, number> = {}
  const latest: Record<string, number> = {}
  const latestEnd: Record<string, number> = {}
  const rows: Row[] = []
  const briefs: Note[] = []
  const texts: Record<string, string[]> = {}
  const left = new Set<Lane>()
  const timeline = gsap.timeline({ paused: true })

  function channel(key: string, initial: number) {
    state[key] = initial
    latest[key] = initial
  }

  // Explicit start values, because a plain `to` captures its start on first render, and
  // that would depend on the order seeks arrive in.
  function tween(key: string, to: number, at: number, duration: number, ease: string) {
    // Tweens of one key have to run in order, or seeking would depend on where it came from.
    if (at < (latestEnd[key] ?? 0) - 1e-9)
      throw new Error(`Two actions overlap on "${key}"`)
    timeline.fromTo(
      state,
      { [key]: latest[key] },
      { [key]: to, duration, ease, immediateRender: false, lazy: false },
      at,
    )
    latest[key] = to
    latestEnd[key] = at + duration
  }

  /** An element's state keys and table row, made on first use. Returns the key prefix. */
  function elementRow(name: string, prop: Prop, initial: Record<string, number>) {
    const keys = Object.keys(initial).map(key => `${name}.${key}`)
    if (!(keys[0]! in state)) {
      for (const [key, value] of Object.entries(initial))
        channel(`${name}.${key}`, value)
      rows.push({ node: { kind: 'element', name }, prop, keys })
    }
    return name
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

  function rectOf(name: string, beatName: string) {
    const rect = layout.rects[name]
    if (!rect)
      throw new Error(`Unknown target "${name}" in Beat "${beatName}"`)
    return rect
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
    const rect = rectOf(action.target, beatName)
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

  function pagePoint(screen: Point, pose: Pose) {
    return { x: (screen.x - pose.x) / pose.scale, y: (screen.y - pose.y) / pose.scale }
  }

  function screenPoint(page: Point, pose: Pose) {
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

  function screenDistance(lane: Lane, to: Point, at: number) {
    const start = poseAt(at)
    const from = screenPoint({ x: latest[`${lane}.x`]!, y: latest[`${lane}.y`]! }, start)
    return Math.hypot(to.x - from.x, to.y - from.y)
  }

  function arc(lane: Lane, to: Point, at: number, duration: number) {
    tween(`${lane}.x`, to.x, at, duration, EASE)
    tween(`${lane}.y`, to.y, at, duration, ARC_EASE)
    return duration
  }

  // Cursors live in page coordinates, and `draw()` maps them through the Camera. So one
  // that stops on an element stays on it when the Camera moves. A free point is a place on
  // the screen, which only means something once the move ends, so it's converted using the
  // Camera at that moment. Time comes from the distance on screen, so a move takes the same
  // time however far the page is zoomed out.
  function moveSeconds(distance: number, override?: number) {
    return override ?? Math.max(MIN_MOVE_SECONDS, MOVE_SECONDS_PER_ROOT_PX * Math.sqrt(distance))
  }

  function runMoveToPage(lane: Lane, to: Point, at: number, override?: number) {
    const distance = screenDistance(lane, screenPoint(to, poseAt(at)), at)
    return arc(lane, to, at, moveSeconds(distance, override))
  }

  function runMove(lane: Lane, to: Target | FreePoint, at: number, beatName: string, override?: number) {
    if (typeof to === 'string')
      return runMoveToPage(lane, anchorPoint(to, beatName), at, override)
    const screenEnd = freePoint(to)
    const duration = moveSeconds(screenDistance(lane, screenEnd, at), override)
    return arc(lane, pagePoint(screenEnd, poseAt(at + duration)), at, duration)
  }

  function dragSeconds(lane: Lane, to: Point, at: number, override?: number) {
    const distance = screenDistance(lane, screenPoint(to, poseAt(at)), at)
    return override ?? Math.max(MIN_MOVE_SECONDS, DRAG_SECONDS_PER_ROOT_PX * Math.sqrt(distance))
  }

  function runDrag(lane: Lane, to: Point, at: number, duration: number) {
    tween(`${lane}.x`, to.x, at, duration, DRAG_EASE)
    tween(`${lane}.y`, to.y, at, duration, DRAG_EASE)
  }

  function runReveal(action: RevealAction, at: number, beatName: string) {
    rectOf(action.target, beatName)
    const name = elementRow(action.target, 'opacity', { opacity: 0 })
    const duration = action.duration ?? REVEAL_SECONDS
    tween(`${name}.opacity`, 1, at, duration, 'none')
    return duration
  }

  function runBox(lane: Lane, action: BoxAction, at: number, beatName: string) {
    const rect = rectOf(action.target, beatName)
    const name = elementRow(action.target, 'clip', { clip: 1 })
    const travel = runMoveToPage(lane, ANCHORS.origin(rect), at)
    const corner = ANCHORS.corner(rect)
    const duration = dragSeconds(lane, corner, at + travel, action.duration)
    runDrag(lane, corner, at + travel, duration)
    tween(`${name}.clip`, 0, at + travel, duration, DRAG_EASE)
    return travel + duration
  }

  function runFill(lane: Lane, action: FillAction | CrestAction, at: number, beatName: string) {
    const rect = rectOf(action.target, beatName)
    const name = elementRow(action.target, action.verb, { [action.verb]: 0 })
    const travel = runMoveToPage(lane, ANCHORS.origin(rect), at)
    const corner = ANCHORS.corner(rect)
    const duration = dragSeconds(lane, corner, at + travel, action.duration)
    runDrag(lane, corner, at + travel, duration)
    tween(`${name}.${action.verb}`, 1, at + travel, duration, DRAG_EASE)
    return travel + duration
  }

  function runLeave(lane: Lane, action: LeaveAction, at: number, beatName: string) {
    const travel = runMove(lane, OFF_SCREEN, at, beatName, action.duration)
    tween(`${lane}.presence`, 0, at + travel, PRESENCE_SECONDS, 'none')
    left.add(lane)
    return travel + PRESENCE_SECONDS
  }

  function textOf(target: string, beatName: string) {
    const entry = layout.texts[target]
    if (!entry)
      throw new Error(`Can't type into "${target}", which isn't plain text, in Beat "${beatName}"`)
    return entry.text
  }

  function typingSeconds(text: string, override?: number) {
    return override ?? Math.min(MAX_TYPE_SECONDS, text.length * TYPE_SECONDS_PER_CHAR)
  }

  function textRow(target: string, beatName: string) {
    rectOf(target, beatName)
    textOf(target, beatName)
    texts[target] ??= []
    return elementRow(target, 'text', { source: 0, chars: 0 })
  }

  /** Points the element at `text`, which it can only change to while it's empty. */
  function useSource(name: string, text: string, at: number) {
    const sources = texts[name]!
    const first = sources.length === 0
    const index = sources.push(text) - 1
    if (first)
      return 0
    tween(`${name}.source`, index, at, SWITCH_SECONDS, 'none')
    return SWITCH_SECONDS
  }

  function runType(lane: Lane, action: TypeAction, at: number, beatName: string) {
    const name = textRow(action.target, beatName)
    if (latest[`${name}.chars`]! > 0)
      throw new Error(`Can't type into "${name}", which isn't empty, in Beat "${beatName}"`)
    const text = action.text ?? textOf(name, beatName)
    const travel = runMoveToPage(lane, ANCHORS.origin(rectOf(name, beatName)), at)
    const start = at + travel
    const switched = useSource(name, text, start)
    const duration = typingSeconds(text, action.duration)
    tween(`${name}.chars`, text.length, start + switched, duration, 'none')
    return travel + switched + duration
  }

  function runReplace(lane: Lane, action: ReplaceAction, at: number, beatName: string) {
    const name = textRow(action.target, beatName)
    if (latest[`${name}.chars`] === 0)
      throw new Error(`Nothing to replace in "${name}" in Beat "${beatName}"`)
    const text = textOf(name, beatName)
    const travel = runMoveToPage(lane, ANCHORS.origin(rectOf(name, beatName)), at)
    const start = at + travel
    tween(`${name}.chars`, 0, start, ERASE_SECONDS, 'none')
    const switched = useSource(name, text, start + ERASE_SECONDS)
    const duration = typingSeconds(text, action.duration)
    tween(`${name}.chars`, text.length, start + ERASE_SECONDS + switched, duration, 'none')
    return travel + ERASE_SECONDS + switched + duration
  }

  function offsetRow(target: string, x: number, y: number) {
    return elementRow(target, 'offset', { x, y })
  }

  function runNudge(lane: Lane, action: NudgeAction, at: number, beatName: string) {
    const rect = rectOf(action.target, beatName)
    const name = offsetRow(action.target, action.from.x, action.from.y)
    const home = ANCHORS.center(rect)
    const travel = runMoveToPage(lane, { x: home.x + action.from.x, y: home.y + action.from.y }, at)
    const duration = dragSeconds(lane, home, at + travel, action.duration)
    runDrag(lane, home, at + travel, duration)
    tween(`${name}.x`, 0, at + travel, duration, DRAG_EASE)
    tween(`${name}.y`, 0, at + travel, duration, DRAG_EASE)
    return travel + duration
  }

  function runDup(lane: Lane, action: DupAction, at: number, beatName: string) {
    const to = rectOf(action.target, beatName)
    const from = rectOf(action.from, beatName)
    const name = offsetRow(action.target, from.left - to.left, from.top - to.top)
    elementRow(action.target, 'opacity', { opacity: 0 })
    const travel = runMoveToPage(lane, ANCHORS.center(from), at)
    const home = ANCHORS.center(to)
    const duration = dragSeconds(lane, home, at + travel, action.duration)
    tween(`${name}.opacity`, 1, at + travel, PRESENCE_SECONDS, 'none')
    runDrag(lane, home, at + travel, duration)
    tween(`${name}.x`, 0, at + travel, duration, DRAG_EASE)
    tween(`${name}.y`, 0, at + travel, duration, DRAG_EASE)
    return travel + duration
  }

  function runSetType(lane: Lane, action: SetTypeAction, at: number, beatName: string) {
    if ('selection.presence' in state)
      throw new Error(`There's one selection, and a second setType in Beat "${beatName}"`)
    const rect = rectOf(action.target, beatName)

    // At the opening size the lines stack in the middle of the box, as they do in the first
    // paint. They only reach their finished places at the end of the drag.
    const opening = Object.entries(action.opening).map(([name, px]) => {
      const box = rectOf(name, beatName)
      const finished = layout.fontSizes[name]
      const text = layout.texts[name]
      if (!finished || !text)
        throw new Error(`Can't set type on "${name}", which isn't plain text, in Beat "${beatName}"`)
      return { name, px, box, finished, lineHeight: px * box.height / finished, width: px * text.systemWidthEm }
    })
    const stack = opening.reduce((sum, { lineHeight }) => sum + lineHeight, 0)
    const width = Math.max(...opening.map(line => line.width))
    const top = rect.top + (rect.height - stack) / 2
    let lineTop = top
    const lines = opening.map(({ name, px, box, finished, lineHeight }) => {
      elementRow(name, 'fontSize', { fontSize: px })
      offsetRow(name, 0, lineTop - box.top)
      lineTop += lineHeight
      return { name, finished }
    })

    const font = elementRow(action.target, 'font', { font: 0 })
    channel('selection.presence', 0)
    channel('selection.x', rect.left)
    channel('selection.y', top)
    channel('selection.width', width)
    channel('selection.height', stack)
    rows.push(
      { node: { kind: 'selection' }, prop: 'presence', keys: ['selection.presence'] },
      { node: { kind: 'selection' }, prop: 'box', keys: ['selection.x', 'selection.y', 'selection.width', 'selection.height', ...CAMERA_KEYS] },
    )

    let t = at + runMoveToPage(lane, { x: rect.left + width, y: top + stack }, at)
    tween('selection.presence', 1, t, PRESENCE_SECONDS, 'none')
    t += SELECT_HOLD_SECONDS
    tween(`${font}.font`, 1, t, SWITCH_SECONDS, 'none')
    t += SELECT_HOLD_SECONDS

    // One continuous drag, so the handle, the box and the type all share a duration and ease.
    const corner = ANCHORS.corner(rect)
    const duration = dragSeconds(lane, corner, t, action.duration)
    runDrag(lane, corner, t, duration)
    tween('selection.y', rect.top, t, duration, DRAG_EASE)
    tween('selection.width', rect.width, t, duration, DRAG_EASE)
    tween('selection.height', rect.height, t, duration, DRAG_EASE)
    for (const { name, finished } of lines) {
      tween(`${name}.fontSize`, finished, t, duration, DRAG_EASE)
      tween(`${name}.y`, 0, t, duration, DRAG_EASE)
    }
    t += duration
    tween('selection.presence', 0, t, PRESENCE_SECONDS, 'none')
    return t + PRESENCE_SECONDS - at
  }

  function runNote(lane: Lane, action: NoteAction, at: number, beatName: string) {
    const inPlace = action.verb === 'brief' && action.inPlace
    const index = briefs.push({ lane, kind: action.verb, text: action.text }) - 1
    const key = `brief${index}.presence`
    channel(key, inPlace ? 1 : 0)
    rows.push({ node: { kind: 'brief', index }, prop: 'presence', keys: [key] })
    const shown = action.duration ?? BRIEF_SECONDS
    const travel = inPlace ? 0 : runMove(lane, action.at, at, beatName)
    if (!inPlace)
      tween(key, 1, at + travel, PRESENCE_SECONDS, 'none')
    tween(key, 0, at + travel + shown - PRESENCE_SECONDS, PRESENCE_SECONDS, 'none')
    return travel + shown
  }

  function placeCursor(lane: Lane, presence: number, start: Point) {
    channel(`${lane}.presence`, presence)
    channel(`${lane}.x`, start.x)
    channel(`${lane}.y`, start.y)
    rows.push(
      { node: { kind: 'cursor', lane }, prop: 'presence', keys: [`${lane}.presence`] },
      { node: { kind: 'cursor', lane }, prop: 'translate', keys: [`${lane}.x`, `${lane}.y`, ...CAMERA_KEYS] },
    )
  }

  function enter(lane: Lane, action: Action, at: number, beatName: string) {
    if (action.verb === 'brief' && action.inPlace) {
      if (at !== 0)
        throw new Error(`A Brief can only be in place at the very start, not in Beat "${beatName}"`)
      placeCursor(lane, 1, typeof action.at === 'string' ? anchorPoint(action.at, beatName) : freePoint(action.at))
      return
    }
    placeCursor(lane, 0, pagePoint(freePoint(OFF_SCREEN), poseAt(at)))
    tween(`${lane}.presence`, 1, at, PRESENCE_SECONDS, 'none')
  }

  function runAction(lane: Lane, action: Action, at: number, beatName: string) {
    switch (action.verb) {
      case 'move':
        return runMove(lane, action.to, at, beatName, action.duration)
      case 'reveal':
        return runReveal(action, at, beatName)
      case 'box':
        return runBox(lane, action, at, beatName)
      case 'type':
        return runType(lane, action, at, beatName)
      case 'replace':
        return runReplace(lane, action, at, beatName)
      case 'nudge':
        return runNudge(lane, action, at, beatName)
      case 'dup':
        return runDup(lane, action, at, beatName)
      case 'setType':
        return runSetType(lane, action, at, beatName)
      case 'fill':
      case 'crest':
        return runFill(lane, action, at, beatName)
      case 'leave':
        return runLeave(lane, action, at, beatName)
      case 'brief':
      case 'approve':
      case 'reject':
        return runNote(lane, action, at, beatName)
      default:
        throw new Error(`The ${lane} can't "${action.verb}" in Beat "${beatName}"`)
    }
  }

  channel('camera.x', 0)
  channel('camera.y', 0)
  channel('camera.scale', 1)
  rows.push({ node: { kind: 'camera' }, prop: 'camera', keys: CAMERA_KEYS }, { node: { kind: 'root' }, prop: 'tokens', keys: [] })

  // Every box keeps its finished size for the whole Build, so nothing it holds can reflow the page.
  for (const [name, rect] of Object.entries(layout.rects))
    elementRow(name, 'lock', { width: rect!.width, height: rect!.height })

  let beatStart = 0
  let lastBeatStart = 0
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
        if (left.has(lane))
          throw new Error(`The ${lane} has already left, and can't "${action.verb}" in Beat "${beatName}"`)
        if (!(`${lane}.presence` in state))
          enter(lane, action, at, beatName)
        at += runAction(lane, action, at, beatName)
      }
      beatEnd = Math.max(beatEnd, at)
    }
    lastBeatStart = beatStart
    beatStart = beatEnd
  }

  // "Scroll to build · Skip" stays up through the Build, and goes during the final Beat.
  channel('line.presence', 1)
  rows.push({ node: { kind: 'line' }, prop: 'presence', keys: ['line.presence'] })
  if (beatStart > lastBeatStart)
    tween('line.presence', 0, lastBeatStart, beatStart - lastBeatStart, 'none')

  return { timeline, state, rows, briefs, texts, duration: timeline.duration() }
}
