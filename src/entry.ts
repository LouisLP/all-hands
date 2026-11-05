// What the inline <head> script decided, and the ways out of it. It's on <html> as `data-entry`:
//   pending   the check passed, and the neutral canvas shows until the engine starts
//   running   the engine has started
//   hint      the check failed, so the finished page shows with the desktop hint
//   (absent)  the finished page, which is also how the page arrives with no JS

// index.html can't import these, so tests/unit/entry.test.ts checks it uses the same values.
export const LOAD_CHECK = '(min-width: 1024px) and (hover: hover) and (pointer: fine)'
export const SKIP_KEY = 'all-hands:skip'

const html = () => document.documentElement

export const isBuildPending = () => html().dataset.entry === 'pending'

export function markBuildRunning() {
  html().dataset.entry = 'running'
}

export function showFinishedPage() {
  delete html().dataset.entry
}

/** Only for a page with no Track left, since it goes to the top. */
export function skipToFinishedPage() {
  showFinishedPage()
  try {
    sessionStorage.setItem(SKIP_KEY, '1')
  }
  catch {
    // Storage can be blocked. The skip still works, and just isn't remembered.
  }
  window.scrollTo(0, 0)
  document.querySelector<HTMLElement>('h1')?.focus()
}
