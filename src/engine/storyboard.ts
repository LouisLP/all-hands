// The language a Storyboard is written in: typed data, with no GSAP and no DOM.

export const BUILD_NAMES = [
  'hero', 'hero-meta', 'hero-marks-top', 'name', 'role', 'hero-marks-bottom', 'hero-intro', 'hero-button', 'hero-shapes',
  'about', 'about-panel', 'about-label', 'about-heading', 'about-body',
  'work', 'work-heading',
  'card1', 'card1-index', 'card1-title', 'card1-link', 'card1-details',
  'card2', 'card2-index', 'card2-title', 'card2-link', 'card2-details',
  'card3', 'card3-index', 'card3-title', 'card3-link', 'card3-details',
  'contact', 'contact-button', 'footer', 'contact-links', 'colophon',
] as const

export type BuildName = typeof BUILD_NAMES[number]

/** `corner` is the bottom-right one, where a resize handle sits. */
export type Anchor = 'center' | 'corner'

/** A named element, meaning its center, or one of its anchors. */
export type Target = BuildName | `${BuildName}.${Anchor}`

/** A free position, in percentages of the viewport. */
export interface FreePoint {
  x: number
  y: number
}

interface ActionOptions {
  /** Authored seconds, replacing the time the verb would take. */
  duration?: number
  /** Names a sound for later. Nothing plays it yet. */
  cue?: string
}

export interface MoveAction extends ActionOptions {
  verb: 'move'
  to: Target | FreePoint
}

export interface RevealAction extends ActionOptions {
  verb: 'reveal'
  target: BuildName
}

export type Action = MoveAction | RevealAction
export type Verb = Action['verb']

/** Each lane runs in sequence. The Delegator gets brief, approve and reject in #16, and makes no edits. */
export interface Lanes {
  designer?: readonly (MoveAction | RevealAction)[]
  delegator?: readonly never[]
}

export type Lane = keyof Lanes

export interface Beat {
  name: string
  lanes: Lanes
}

export type Storyboard = readonly Beat[]

export function beat(name: string, lanes: Lanes): Beat {
  return { name, lanes }
}

export function move(to: Target | FreePoint, options: ActionOptions = {}): MoveAction {
  return { verb: 'move', to, ...options }
}

export function reveal(target: BuildName, options: ActionOptions = {}): RevealAction {
  return { verb: 'reveal', target, ...options }
}
