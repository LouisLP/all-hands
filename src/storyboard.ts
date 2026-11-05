import { beat, brief, fit, move, pan, reveal } from './engine/storyboard'
import type { Storyboard } from './engine/storyboard'

// Rough, to prove the Camera. #16 and #17 author the real Beats.
export const storyboard: Storyboard = [
  beat('Delegator briefs, and the Designer places the hero shapes', {
    delegator: [brief('Make it a poster.', 'hero-intro')],
    designer: [move('hero-shapes'), reveal('hero-shapes')],
  }),
  beat('Turn: the Camera pulls back to the whole page', {
    camera: [fit()],
    designer: [move('work-heading')],
  }),
  beat('Turn: the Delegator rejects all of it', {
    delegator: [brief('Too safe.', 'work', { duration: 2 })],
  }),
  // Both cursors stay on the page below the fold, so the return carries them off screen.
  beat('Landing: the Camera returns to the hero', {
    camera: [pan('hero')],
  }),
  // A pan to where the Camera already is. No transform, for a moment, before the page unpins.
  beat('Landing: the page settles', {
    camera: [pan('hero', { duration: 0.6 })],
  }),
]
