import { beat, move, reveal } from './engine/storyboard'
import type { Storyboard } from './engine/storyboard'

export const storyboard: Storyboard = [
  beat('Designer places the hero shapes', {
    designer: [move('hero-shapes'), reveal('hero-shapes'), move({ x: 110, y: 40 })],
  }),
]
