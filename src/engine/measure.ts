import type { Layout } from './compile'

/** Reads the finished layout, relative to the Camera's origin so scroll position doesn't matter. */
export function measure(camera: HTMLElement): Layout {
  const origin = camera.getBoundingClientRect()
  const rects: Layout['rects'] = {}
  for (const el of camera.querySelectorAll<HTMLElement>('[data-build]')) {
    const { left, top, width, height } = el.getBoundingClientRect()
    rects[el.dataset.build!] = { left: left - origin.left, top: top - origin.top, width, height }
  }
  return {
    viewport: { width: document.documentElement.clientWidth, height: window.innerHeight },
    rects,
  }
}
