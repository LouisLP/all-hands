// The language a Storyboard is written in: typed data, with no GSAP and no DOM.

export const BUILD_NAMES = [
  'hero', 'hero-meta', 'hero-marks-top', 'title', 'name', 'role', 'hero-marks-bottom', 'hero-intro', 'hero-button', 'hero-shapes',
  'about', 'about-panel', 'about-label', 'about-heading', 'about-body', 'about-body1', 'about-body2',
  'work', 'work-heading',
  'card1', 'card1-index', 'card1-title', 'card1-link', 'card1-details', 'card1-description', 'card1-stack', 'card1-arrow',
  'card2', 'card2-index', 'card2-title', 'card2-link', 'card2-details', 'card2-description', 'card2-stack', 'card2-arrow',
  'card3', 'card3-index', 'card3-title', 'card3-link', 'card3-details', 'card3-description', 'card3-stack', 'card3-arrow',
  'contact', 'contact-button', 'footer', 'contact-links', 'colophon',
] as const

export type BuildName = typeof BUILD_NAMES[number]

/** `origin` is the top-left corner. `corner` is the bottom-right one, where a resize handle sits. */
export type Anchor = 'center' | 'corner' | 'origin'

/** A named element, meaning its center, or one of its anchors. */
export type Target = BuildName | `${BuildName}.${Anchor}`

/** A free position, in percentages of the viewport. */
export interface FreePoint {
  x: number
  y: number
}

/** A distance from an element's finished place, in px. */
export interface Offset {
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

/** Drags the element's box out, from its top-left corner to its bottom-right one. */
export interface BoxAction extends ActionOptions {
  verb: 'box'
  target: BuildName
}

/** Types into an empty element: its finished text, or `text` for a placeholder. */
export interface TypeAction extends ActionOptions {
  verb: 'type'
  target: BuildName
  text?: string
}

/** Deletes what's typed in the element, then types its finished text. */
export interface ReplaceAction extends ActionOptions {
  verb: 'replace'
  target: BuildName
}

/** Drags an element into its finished place. It sits `from` away from it until then. */
export interface NudgeAction extends ActionOptions {
  verb: 'nudge'
  target: BuildName
  from: Offset
}

/** Picks up a copy of `from` and drags it to `target`'s finished place. */
export interface DupAction extends ActionOptions {
  verb: 'dup'
  target: BuildName
  from: BuildName
}

/**
 * The hero type gesture. Selects `target`, switches it from system type to its finished
 * font, then drags the corner handle until each line reaches its finished size. `opening`
 * lists the lines from the top, with the px size each starts at, which is the first paint's.
 */
export interface SetTypeAction extends ActionOptions {
  verb: 'setType'
  target: BuildName
  opening: Partial<Record<BuildName, number>>
}

/**
 * Drags across the element while its page tokens go from neutral to final. The tokens are
 * scoped to it, so everything it holds changes with it, and nothing else does. Leaves Crest.
 */
export interface FillAction extends ActionOptions {
  verb: 'fill'
  target: BuildName
}

/** A fill of the Crest token alone, which only the Designer gets to use. */
export interface CrestAction extends ActionOptions {
  verb: 'crest'
  target: BuildName
}

/** The cursor goes off screen and is gone for the rest of the Build. */
export interface LeaveAction extends ActionOptions {
  verb: 'leave'
}

interface NoteOptions extends ActionOptions {
  /** Up from the very first frame, with the cursor already there. Only for t = 0. */
  inPlace?: boolean
}

/** The cursor goes to `at`, then the Brief shows for `duration` and clears. */
export interface BriefAction extends NoteOptions {
  verb: 'brief'
  text: string
  at: Target | FreePoint
}

/** A Brief that signs work off. */
export interface ApproveAction extends ActionOptions {
  verb: 'approve'
  text: string
  at: Target | FreePoint
}

/** A Brief that sends work back. */
export interface RejectAction extends ActionOptions {
  verb: 'reject'
  text: string
  at: Target | FreePoint
}

/** Back to full size, with the top of `target` at the top of the viewport, as far as the page allows. */
export interface PanAction extends ActionOptions {
  verb: 'pan'
  target: BuildName
}

/** Zooms out until the whole page fits the viewport. */
export interface FitAction extends ActionOptions {
  verb: 'fit'
}

export type NoteAction = BriefAction | ApproveAction | RejectAction

export type Action =
  | MoveAction | RevealAction | BoxAction | TypeAction | ReplaceAction | NudgeAction | DupAction | SetTypeAction
  | FillAction | CrestAction | LeaveAction
  | NoteAction
  | PanAction | FitAction
export type Verb = Action['verb']

type AgentAction = MoveAction | RevealAction | TypeAction | DupAction | FillAction | LeaveAction

/** Each lane runs in sequence. The Delegator only briefs, approves, rejects and leaves, and makes no edits. */
export interface Lanes {
  delegator?: readonly (NoteAction | LeaveAction)[]
  designer?: readonly (MoveAction | RevealAction | BoxAction | TypeAction | NudgeAction | SetTypeAction | FillAction | CrestAction | LeaveAction)[]
  backend?: readonly (MoveAction | RevealAction | ReplaceAction | LeaveAction)[]
  agent1?: readonly AgentAction[]
  agent2?: readonly AgentAction[]
  camera?: readonly (PanAction | FitAction)[]
}

/** The lanes with a cursor. */
export type Lane = Exclude<keyof Lanes, 'camera'>

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

export function box(target: BuildName, options: ActionOptions = {}): BoxAction {
  return { verb: 'box', target, ...options }
}

export function type(target: BuildName, options: ActionOptions & { text?: string } = {}): TypeAction {
  return { verb: 'type', target, ...options }
}

export function replace(target: BuildName, options: ActionOptions = {}): ReplaceAction {
  return { verb: 'replace', target, ...options }
}

export function nudge(target: BuildName, from: Offset, options: ActionOptions = {}): NudgeAction {
  return { verb: 'nudge', target, from, ...options }
}

export function dup(target: BuildName, from: BuildName, options: ActionOptions = {}): DupAction {
  return { verb: 'dup', target, from, ...options }
}

export function setType(target: BuildName, opening: SetTypeAction['opening'], options: ActionOptions = {}): SetTypeAction {
  return { verb: 'setType', target, opening, ...options }
}

export function fill(target: BuildName, options: ActionOptions = {}): FillAction {
  return { verb: 'fill', target, ...options }
}

export function crest(target: BuildName, options: ActionOptions = {}): CrestAction {
  return { verb: 'crest', target, ...options }
}

export function leave(options: ActionOptions = {}): LeaveAction {
  return { verb: 'leave', ...options }
}

export function brief(text: string, at: Target | FreePoint, options: NoteOptions = {}): BriefAction {
  return { verb: 'brief', text, at, ...options }
}

export function approve(text: string, at: Target | FreePoint, options: ActionOptions = {}): ApproveAction {
  return { verb: 'approve', text, at, ...options }
}

export function reject(text: string, at: Target | FreePoint, options: ActionOptions = {}): RejectAction {
  return { verb: 'reject', text, at, ...options }
}

export function pan(target: BuildName, options: ActionOptions = {}): PanAction {
  return { verb: 'pan', target, ...options }
}

export function fit(options: ActionOptions = {}): FitAction {
  return { verb: 'fit', ...options }
}
