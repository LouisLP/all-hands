import { gsap } from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'

/** Reports 0–1 across the first `length` px of scroll: raw, undamped and with no `pin:`. */
export function driveByScroll(length: number, onProgress: (progress: number) => void) {
  gsap.registerPlugin(ScrollTrigger)
  const trigger = ScrollTrigger.create({
    start: 0,
    end: length,
    onUpdate: self => onProgress(self.progress),
  })
  // Read from scroll directly, because the trigger hasn't refreshed yet on a restored scroll.
  onProgress(Math.min(1, window.scrollY / length))
  return () => trigger.kill()
}
