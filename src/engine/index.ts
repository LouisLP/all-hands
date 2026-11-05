import { compile } from './compile'
import { createDrawing } from './draw'
import { driveByScroll } from './driver'
import { measure } from './measure'
import { createOverlay } from './overlay'
import type { Storyboard } from './storyboard'

export type Phase = 'ready' | 'finished' | 'skipped' | 'exited'

export interface BuildOptions {
  /** The `.build` element, holding `.pinned` and its `.camera`. */
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

export function createBuild({ root, storyboard, onPhase }: BuildOptions): Build {
  const pinned = root.querySelector<HTMLElement>('.pinned')!
  const camera = root.querySelector<HTMLElement>('.camera')!
  let teardown: (() => void) | undefined
  let destroyed = false

  function start() {
    const compiled = compile(storyboard, measure(camera))
    const lanes = new Set(compiled.rows.flatMap(({ node }) => (node.kind === 'cursor' ? [node.lane] : [])))
    const overlay = createOverlay(pinned, lanes)
    const drawing = createDrawing(compiled.rows, compiled.state, camera, overlay)

    const track = document.createElement('div')
    track.className = 'track'
    const length = Math.round(compiled.duration * PX_PER_SECOND)
    track.style.height = `${length}px`
    root.append(track)

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

    // The first draw comes first, so `ready` never shows the finished page for a frame.
    seek(0)
    const stopDriving = driveByScroll(length, progress => seek(progress * compiled.duration))
    teardown = () => {
      stopDriving()
      compiled.timeline.kill()
      drawing.clear()
      overlay.element.remove()
      track.remove()
    }
    onPhase?.('ready')
  }

  void document.fonts.ready.then(() => {
    if (!destroyed)
      start()
  })

  function destroy() {
    destroyed = true
    teardown?.()
    teardown = undefined
  }

  function leave(phase: Phase) {
    if (destroyed)
      return
    destroy()
    onPhase?.(phase)
  }

  return {
    // #18 adds the rest: top of page, `h1` focus, and remembering a skip.
    skip: () => leave('skipped'),
    exit: () => leave('exited'),
    destroy,
  }
}
