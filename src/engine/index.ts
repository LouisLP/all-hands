import { isBuildPending, markBuildRunning, showFinishedPage, skipToFinishedPage } from '../entry'
import { compile } from './compile'
import type { Compiled } from './compile'
import { createDrawing } from './draw'
import { driveByScroll } from './driver'
import { measure } from './measure'
import { createOverlay } from './overlay'
import type { Storyboard } from './storyboard'

export type Phase = 'ready' | 'finished' | 'skipped' | 'exited'

export interface BuildOptions {
  /** The `.build` element, holding `.pinned` with its `.camera` and `.build-line`. */
  root: HTMLElement
  storyboard: Storyboard
  onPhase?: (phase: Phase) => void
}

export interface Build {
  skip: () => void
  exit: () => void
  destroy: () => void
}

const PX_PER_SECOND = 400
const SCROLL_KEY = 'all-hands:scroll'
const REDUCED_MOTION = '(prefers-reduced-motion: reduce)'

/** Where the last visit left off, if this load is a reload or a return to it. */
function restoredScroll() {
  const [navigation] = performance.getEntriesByType('navigation') as PerformanceNavigationTiming[]
  if (navigation?.type !== 'reload' && navigation?.type !== 'back_forward')
    return 0
  try {
    return Number(sessionStorage.getItem(SCROLL_KEY)) || 0
  }
  catch {
    return 0
  }
}

function saveScroll() {
  try {
    sessionStorage.setItem(SCROLL_KEY, String(window.scrollY))
  }
  catch {
    // Storage can be blocked. A reload then just starts from the top.
  }
}

/** When an element is done: the latest reveal among it and whatever holds it, up to `camera`. */
function revealOf(el: Element, camera: HTMLElement, reveals: Compiled['reveals']) {
  let latest: number | undefined
  for (let node: Element | null = el; node && node !== camera; node = node.parentElement) {
    const reveal = reveals[node.getAttribute('data-build') ?? '']
    if (reveal !== undefined)
      latest = Math.max(latest ?? 0, reveal)
  }
  return latest
}

function isOnScreen(el: Element) {
  const { top, left, bottom, right } = el.getBoundingClientRect()
  return top >= 0 && left >= 0 && bottom <= window.innerHeight && right <= document.documentElement.clientWidth
}

export function createBuild({ root, storyboard, onPhase }: BuildOptions): Build {
  const pinned = root.querySelector<HTMLElement>('.pinned')!
  const camera = root.querySelector<HTMLElement>('.camera')!
  const motion = window.matchMedia(REDUCED_MOTION)
  let teardown: (() => void) | undefined
  let trackLength = 0
  let finished = false
  let destroyed = false

  // Dev throws, so a bad Storyboard is loud. Production falls back to the finished page.
  function guarded<Args extends unknown[]>(work: (...args: Args) => void) {
    return (...args: Args) => {
      try {
        work(...args)
      }
      catch (error) {
        if (import.meta.env.DEV)
          throw error
        console.error(error)
        exit()
      }
    }
  }

  /** `scrollFor` gets the new Track's length, and says where the page should be on it. */
  function start(scrollFor: (length: number) => number) {
    // In the same task as the first draw, so the finished layout is measured but never painted.
    markBuildRunning()
    const compiled = compile(storyboard, measure(camera), { reducedMotion: motion.matches })
    const lanes = new Set(compiled.rows.flatMap(({ node }) => (node.kind === 'cursor' ? [node.lane] : [])))
    const overlay = createOverlay(pinned, lanes, compiled.briefs)
    const drawing = createDrawing(compiled, camera, pinned.querySelector<HTMLElement>('.build-line')!, overlay)

    const track = document.createElement('div')
    track.className = 'track'
    const length = Math.round(compiled.duration * PX_PER_SECOND)
    track.style.height = `${length}px`
    root.append(track)
    trackLength = length
    window.scrollTo(0, scrollFor(length))
    window.addEventListener('pagehide', saveScroll)

    let now = 0
    function seek(t: number) {
      now = t
      compiled.timeline.seek(t, false)
      const atEnd = t >= compiled.duration
      if (atEnd)
        drawing.clear()
      else
        drawing.draw()
      if (atEnd && !finished)
        onPhase?.('finished')
      finished = atEnd
    }

    // Draws here rather than waiting for the scroll to be read, so the link is already on
    // screen by the time the browser looks at whether it has to scroll to it.
    const onFocusIn = guarded(({ target }: FocusEvent) => {
      // A pointer can only reach what's already in view, and shouldn't jump the Build.
      if (finished || !(target instanceof Element) || !target.matches(':focus-visible'))
        return
      const reveal = revealOf(target, camera, compiled.reveals)
      if (reveal === undefined || (now >= reveal && isOnScreen(target)))
        return
      // Rounded up, so the last action on it is over and not a fraction short.
      window.scrollTo(0, Math.ceil(reveal / compiled.duration * length))
      seek(Math.min(1, window.scrollY / length) * compiled.duration)
    })
    camera.addEventListener('focusin', onFocusIn)

    // Draws straight away, so `ready` never shows the finished page for a frame.
    const stopDriving = driveByScroll(length, guarded(progress => seek(progress * compiled.duration)))
    teardown = () => {
      camera.removeEventListener('focusin', onFocusIn)
      window.removeEventListener('pagehide', saveScroll)
      stopDriving()
      compiled.timeline.kill()
      drawing.clear()
      overlay.element.remove()
      track.remove()
    }
  }

  // All in one task, so the finished layout it measures never paints. Runs in the event
  // itself, before the driver's next tick: past the Track the page isn't locked, so scroll
  // anchoring can already have pulled `scrollY` back onto the Track, and only `finished`
  // still knows which side it was on. Anchoring is also what keeps the content on screen.
  const rebuild = guarded(() => {
    if (!teardown)
      return
    const progress = finished ? 1 : window.scrollY / trackLength
    const below = finished ? Math.max(0, window.scrollY - trackLength) : 0
    teardown()
    teardown = undefined
    start(length => progress * length + below)
  })

  void document.fonts.ready.then(guarded(() => {
    // Not pending means the 3s fallback has already shown the finished page.
    if (destroyed || !isBuildPending())
      return
    start(restoredScroll)
    window.addEventListener('resize', rebuild)
    motion.addEventListener('change', rebuild)
    onPhase?.('ready')
  }))

  function destroy() {
    destroyed = true
    window.removeEventListener('resize', rebuild)
    motion.removeEventListener('change', rebuild)
    const finish = teardown
    teardown = undefined
    finish?.()
    showFinishedPage()
  }

  function leave(phase: Phase) {
    if (destroyed)
      return
    destroy()
    onPhase?.(phase)
  }

  function skip() {
    leave('skipped')
    skipToFinishedPage()
  }

  // Past the Track, the same content stays on screen. On it, that means the top of the page.
  function exit() {
    const below = Math.max(0, window.scrollY - trackLength)
    leave('exited')
    window.scrollTo(0, below)
  }

  return { skip, exit, destroy }
}
