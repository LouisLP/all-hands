import { describe, expect, it } from 'vitest'

import { compile } from '../../src/engine/compile'
import type { Layout } from '../../src/engine/compile'
import { beat, brief, BUILD_NAMES, fit, move, pan, reveal } from '../../src/engine/storyboard'
import type { Storyboard } from '../../src/engine/storyboard'
import { storyboard as realStoryboard } from '../../src/storyboard'

const VIEWPORT = { width: 1000, height: 500 }
const PAGE = { width: 1000, height: 4000 }

// Every name sits at the same box unless a test says otherwise.
function layoutWith(overrides: Partial<Layout['rects']> = {}): Layout {
  const box = { left: 0, top: 0, width: 100, height: 100 }
  return {
    viewport: VIEWPORT,
    page: PAGE,
    rects: { ...Object.fromEntries(BUILD_NAMES.map(name => [name, box])), ...overrides },
  }
}

const twoMoves: Storyboard = [
  beat('Designer crosses the page and reveals the name', {
    designer: [move({ x: 0, y: 0 }), move('hero.corner'), reveal('name'), move({ x: 100, y: 100 })],
  }),
]

type Compiled = ReturnType<typeof compile>

// Only what `draw()` reads, because GSAP keeps its own cache on the state object.
function snapshot({ rows, state }: Compiled) {
  return Object.fromEntries(rows.flatMap(row => row.keys).map(key => [key, state[key]]))
}

function snapshotAt(compiled: Compiled, t: number) {
  compiled.timeline.seek(t, false)
  return snapshot(compiled)
}

describe('time', () => {
  it('runs Beats one after another, each as long as its longest lane', () => {
    const { duration } = compile([
      beat('first', { designer: [reveal('name', { duration: 2 })] }),
      beat('second', { designer: [reveal('role', { duration: 3 })] }),
    ], layoutWith())
    expect(duration).toBe(5)
  })

  it('gives a move a time proportional to the square root of its distance', () => {
    // From the entry point (105%, 105%) of a 1000x500 viewport: 300, 400 is 500px away.
    const near = compile([beat('near', { designer: [move({ x: 75, y: 25 })] })], layoutWith())
    // The same direction at four times the distance takes twice as long.
    const far = compile([beat('far', { designer: [move({ x: -15, y: -215 })] })], layoutWith())
    expect(far.duration).toBeCloseTo(near.duration * 2, 5)
  })

  it('lets an action override the duration of its verb', () => {
    const { duration } = compile([beat('slow', { designer: [move({ x: 0, y: 0 }, { duration: 7 })] })], layoutWith())
    expect(duration).toBe(7)
  })
})

describe('targets', () => {
  it('resolves anchors from the measured layout, and free moves from the viewport', () => {
    const compiled = compile([
      beat('tour', {
        designer: [
          move('name.corner', { duration: 1 }),
          move('role', { duration: 1 }),
          move({ x: 50, y: 10 }, { duration: 1 }),
        ],
      }),
    ], layoutWith({
      name: { left: 10, top: 20, width: 300, height: 40 },
      role: { left: 100, top: 200, width: 60, height: 20 },
    }))

    expect(snapshotAt(compiled, 1)).toMatchObject({ 'designer.x': 310, 'designer.y': 60 })
    expect(snapshotAt(compiled, 2)).toMatchObject({ 'designer.x': 130, 'designer.y': 210 })
    expect(snapshotAt(compiled, 3)).toMatchObject({ 'designer.x': 500, 'designer.y': 50 })
  })
})

// Required test 2 and 3, on state. The Playwright suite repeats them on the DOM.
describe('seeking', () => {
  const points = [0, 0.1, 0.5, 1, 1.5, 2, 2.5, 3]
  const fractionsOfEnd = points.map(p => p / 3)

  it('gives the same state at a t whichever way it got there', () => {
    const forward = compile(twoMoves, layoutWith())
    const end = forward.duration
    const expected = fractionsOfEnd.map(f => snapshotAt(forward, f * end))

    const backward = compile(twoMoves, layoutWith())
    const seenBackward = [...fractionsOfEnd].reverse().map(f => snapshotAt(backward, f * end)).reverse()
    expect(seenBackward).toEqual(expected)

    const shuffled = compile(twoMoves, layoutWith())
    for (const i of [5, 0, 7, 2, 6, 1, 4, 3, 7, 0, 3]) {
      expect(snapshotAt(shuffled, fractionsOfEnd[i]! * end)).toEqual(expected[i])
    }
  })

  it('starts by jumping straight to the end without skipping any action', () => {
    const jumped = compile(twoMoves, layoutWith())
    const walked = compile(twoMoves, layoutWith())
    for (const f of fractionsOfEnd)
      snapshotAt(walked, f * walked.duration)
    expect(snapshotAt(jumped, jumped.duration)).toEqual(snapshotAt(walked, walked.duration))
  })

  it('matches a fresh start when it comes back to 0 after a full run', () => {
    const compiled = compile(twoMoves, layoutWith())
    const fresh = snapshot(compiled)
    snapshotAt(compiled, compiled.duration)
    expect(snapshotAt(compiled, 0)).toEqual(fresh)
  })

  it('hides the cursor and the revealed element at the start, and shows them later', () => {
    const compiled = compile(twoMoves, layoutWith())
    expect(compiled.state).toMatchObject({ 'designer.presence': 0, 'name.opacity': 0 })
    expect(snapshotAt(compiled, compiled.duration)).toMatchObject({ 'designer.presence': 1, 'name.opacity': 1 })
  })
})

// Required test 4. `pnpm type-check` fails if any of these errors disappears, and the
// compile step refuses the same mistakes in data the types can't see.
describe('checks', () => {
  it('refuses an unknown target', () => {
    // @ts-expect-error 'nmae' isn't a Build name
    const storyboard = [beat('typo', { designer: [reveal('nmae')] })]
    expect(() => compile(storyboard, layoutWith())).toThrow(/unknown target "nmae"/i)
  })

  it('refuses an unknown anchor', () => {
    // @ts-expect-error 'edge' isn't an anchor
    const storyboard = [beat('typo', { designer: [move('name.edge')] })]
    expect(() => compile(storyboard, layoutWith())).toThrow(/unknown target "name.edge"/i)
  })

  it('refuses a target missing from the page', () => {
    const { name: _name, ...rects } = layoutWith().rects
    expect(() => compile([beat('gone', { designer: [reveal('name')] })], { viewport: VIEWPORT, page: PAGE, rects }))
      .toThrow(/unknown target "name"/i)
  })

  it('refuses a verb not allowed for the Teammate', () => {
    // @ts-expect-error the Delegator makes no edits
    const storyboard = [beat('overreach', { delegator: [reveal('name')] })]
    expect(() => compile(storyboard, layoutWith())).toThrow(/delegator can't "reveal"/i)
  })

  it('refuses a Brief from anyone but the Delegator', () => {
    // @ts-expect-error only the Delegator writes Briefs
    const storyboard = [beat('overreach', { designer: [brief('Tighter.', 'name')] })]
    expect(() => compile(storyboard, layoutWith())).toThrow(/designer can't "brief"/i)
  })

  it('refuses a Camera verb from a Teammate, and any other verb from the Camera', () => {
    // @ts-expect-error a Teammate can't move the Camera
    const pans = [beat('overreach', { designer: [pan('hero')] })]
    expect(() => compile(pans, layoutWith())).toThrow(/designer can't "pan"/i)
    // @ts-expect-error the Camera only pans and fits
    const moves = [beat('overreach', { camera: [move('hero')] })]
    expect(() => compile(moves, layoutWith())).toThrow(/camera can't "move"/i)
  })

  it('refuses a pan to an unknown target', () => {
    // @ts-expect-error 'nmae' isn't a Build name
    const storyboard = [beat('typo', { camera: [pan('nmae')] })]
    expect(() => compile(storyboard, layoutWith())).toThrow(/unknown target "nmae"/i)
  })

  it('refuses a lane that does not exist', () => {
    // @ts-expect-error there's no intern
    const storyboard = [beat('stranger', { intern: [reveal('name')] })]
    expect(() => compile(storyboard, layoutWith())).toThrow(/unknown lane "intern"/i)
  })

  it('refuses a Storyboard with no time in it', () => {
    expect(() => compile([], layoutWith())).toThrow(/no Beats/i)
  })
})

describe('the Camera', () => {
  const pose = (compiled: Compiled, t: number) => {
    compiled.timeline.seek(t, false)
    const { state } = compiled
    return { x: state['camera.x'], y: state['camera.y'], scale: state['camera.scale'] }
  }

  it('starts with no transform even with nothing in its lane', () => {
    const compiled = compile([beat('still', { designer: [reveal('name')] })], layoutWith())
    expect(pose(compiled, 0)).toEqual({ x: 0, y: 0, scale: 1 })
  })

  it('fits the whole page and centres it, inside a margin', () => {
    const compiled = compile([beat('back', { camera: [fit({ duration: 1 })] })], layoutWith())
    const { x, y, scale } = pose(compiled, 1)
    // The 500px viewport less 24px each side, over a 4000px page.
    expect(scale).toBeCloseTo(452 / 4000, 4)
    expect(y).toBeCloseTo(24, 3)
    expect(x).toBeCloseTo((1000 - 1000 * scale!) / 2, 3)
  })

  it('never zooms in, even on a page shorter than the viewport', () => {
    const compiled = compile([beat('back', { camera: [fit({ duration: 1 })] })], {
      ...layoutWith(),
      page: { width: 400, height: 200 },
    })
    expect(pose(compiled, 1).scale).toBe(1)
  })

  it('pans at full size to the top of a target, and no further than the end of the page', () => {
    const compiled = compile([beat('down', {
      camera: [pan('about', { duration: 1 }), pan('contact', { duration: 1 })],
    })], layoutWith({
      about: { left: 0, top: 1200, width: 1000, height: 400 },
      contact: { left: 0, top: 3900, width: 1000, height: 100 },
    }))
    expect(pose(compiled, 1)).toEqual({ x: 0, y: -1200, scale: 1 })
    expect(pose(compiled, 2)).toEqual({ x: 0, y: -3500, scale: 1 })
  })

  it('ends with no transform after a fit and a pan back', () => {
    const compiled = compile([
      beat('back', { camera: [fit()] }),
      beat('return', { camera: [pan('hero')] }),
    ], layoutWith())
    expect(pose(compiled, compiled.duration)).toEqual({ x: 0, y: 0, scale: 1 })
  })

  it('makes a Beat last as long as its Camera lane', () => {
    const { duration } = compile([
      beat('first', { camera: [fit({ duration: 4 })], designer: [reveal('name', { duration: 1 })] }),
      beat('second', { designer: [reveal('role', { duration: 1 })] }),
    ], layoutWith())
    expect(duration).toBe(5)
  })

  it('seeks to the same pose whichever way it got there', () => {
    const storyboard = [beat('there and back', { camera: [fit({ duration: 1 }), pan('hero', { duration: 1 })] })]
    const forward = compile(storyboard, layoutWith())
    const expected = [0, 0.5, 1, 1.5, 2].map(t => pose(forward, t))
    const shuffled = compile(storyboard, layoutWith())
    for (const i of [4, 0, 3, 1, 2, 4, 0])
      expect(pose(shuffled, i / 2)).toEqual(expected[i])
  })
})

describe('cursors over the Camera', () => {
  function onScreen(compiled: Compiled, lane: string) {
    const { state } = compiled
    const scale = state['camera.scale']!
    return {
      x: state['camera.x']! + state[`${lane}.x`]! * scale,
      y: state['camera.y']! + state[`${lane}.y`]! * scale,
    }
  }

  it('keeps a named target in page coordinates, so the cursor stays on it', () => {
    const compiled = compile([
      beat('to the name', { designer: [move('name', { duration: 1 })] }),
      beat('back', { camera: [fit({ duration: 1 })] }),
    ], layoutWith({ name: { left: 100, top: 100, width: 100, height: 100 } }))
    expect(snapshotAt(compiled, 2)).toMatchObject({ 'designer.x': 150, 'designer.y': 150 })
  })

  it('lands a free move on its screen position under a moved Camera', () => {
    const compiled = compile([
      beat('back', { camera: [fit({ duration: 1 })] }),
      beat('across', { designer: [move({ x: 50, y: 10 }, { duration: 1 })] }),
    ], layoutWith())
    compiled.timeline.seek(2, false)
    const { x, y } = onScreen(compiled, 'designer')
    expect(x).toBeCloseTo(500, 2)
    expect(y).toBeCloseTo(50, 2)
  })

  it('aims a free move at where the Camera will be when it lands', () => {
    const compiled = compile([
      beat('together', { camera: [fit({ duration: 1 })], designer: [move({ x: 50, y: 10 }, { duration: 1 })] }),
    ], layoutWith())
    compiled.timeline.seek(1, false)
    const { x, y } = onScreen(compiled, 'designer')
    expect(x).toBeCloseTo(500, 2)
    expect(y).toBeCloseTo(50, 2)
  })

  it('times a move by its distance on screen, not on the page', () => {
    const across = (camera: Storyboard[number]['lanes']['camera']) => compile([
      beat('start', { camera, designer: [move({ x: 0, y: 0 }, { duration: 2 })] }),
      beat('across', { designer: [move({ x: 90, y: 0 })] }),
    ], layoutWith())
    const still = across([pan('hero', { duration: 1 })])
    const zoomed = across([fit({ duration: 1 })])
    expect(zoomed.duration).toBeCloseTo(still.duration, 5)
  })

  it('enters from off screen wherever the Camera is', () => {
    const compiled = compile([
      beat('back', { camera: [fit({ duration: 1 })] }),
      beat('enter', { designer: [move({ x: 50, y: 50 }, { duration: 1 })] }),
    ], layoutWith())
    compiled.timeline.seek(1, false)
    const { x, y } = onScreen(compiled, 'designer')
    expect(x).toBeCloseTo(1050, 2)
    expect(y).toBeCloseTo(525, 2)
  })
})

describe('Briefs', () => {
  it('moves the cursor first, shows the Brief for its duration, then clears it', () => {
    const compiled = compile([
      beat('note', { delegator: [brief('Too safe.', { x: 75, y: 25 }, { duration: 2 })] }),
    ], layoutWith())
    const travel = compiled.duration - 2
    expect(travel).toBeGreaterThan(0)
    expect(compiled.briefs).toEqual([{ lane: 'delegator', text: 'Too safe.' }])

    expect(snapshotAt(compiled, travel / 2)).toMatchObject({ 'brief0.presence': 0 })
    expect(snapshotAt(compiled, travel + 1)).toMatchObject({ 'brief0.presence': 1, 'delegator.x': 750, 'delegator.y': 125 })
    expect(snapshotAt(compiled, compiled.duration)).toMatchObject({ 'brief0.presence': 0 })
  })

  it('refuses an unknown place to brief from', () => {
    // @ts-expect-error 'nmae' isn't a Build name
    const storyboard = [beat('typo', { delegator: [brief('Tighter.', 'nmae')] })]
    expect(() => compile(storyboard, layoutWith())).toThrow(/unknown target "nmae"/i)
  })
})

describe('the real Storyboard', () => {
  it('compiles against every Build name', () => {
    expect(compile(realStoryboard, layoutWith()).duration).toBeGreaterThan(0)
  })
})
