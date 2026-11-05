import { isBuildPending, markBuildRunning, showFinishedPage, skipToFinishedPage } from '../entry'
import { compile } from './compile'
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

export function createBuild({ root, storyboard, onPhase }: BuildOptions): Build {
  const pinned = root.querySelector<HTMLElement>('.pinned')!
  const camera = root.querySelector<HTMLElement>('.camera')!
  let teardown: (() => void) | undefined
  let trackLength = 0
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

  function start() {
    // In the same task as the first draw, so the finished layout is measured but never painted.
    markBuildRunning()
    const compiled = compile(storyboard, measure(camera))
    const lanes = new Set(compiled.rows.flatMap(({ node }) => (node.kind === 'cursor' ? [node.lane] : [])))
    const overlay = createOverlay(pinned, lanes, compiled.briefs)
    const drawing = createDrawing(compiled, camera, pinned.querySelector<HTMLElement>('.build-line')!, overlay)

    const track = document.createElement('div')
    track.className = 'track'
    const length = Math.round(compiled.duration * PX_PER_SECOND)
    track.style.height = `${length}px`
    root.append(track)
    trackLength = length
    window.scrollTo(0, restoredScroll())
    window.addEventListener('pagehide', saveScroll)

    let finished = false
    function seek(t: number) {
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

    // Draws straight away, so `ready` never shows the finished page for a frame.
    const stopDriving = driveByScroll(length, guarded(progress => seek(progress * compiled.duration)))
    teardown = () => {
      window.removeEventListener('pagehide', saveScroll)
      stopDriving()
      compiled.timeline.kill()
      drawing.clear()
      overlay.element.remove()
      track.remove()
    }
    onPhase?.('ready')
  }

  void document.fonts.ready.then(guarded(() => {
    // Not pending means the 3s fallback has already shown the finished page.
    if (!destroyed && isBuildPending())
      start()
  }))

  function destroy() {
    destroyed = true
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
