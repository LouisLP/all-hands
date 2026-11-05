import { describe, expect, it } from 'vitest'

import { compile } from '../../src/engine/compile'
import type { Layout } from '../../src/engine/compile'
import { beat, BUILD_NAMES, move, reveal } from '../../src/engine/storyboard'
import type { Storyboard } from '../../src/engine/storyboard'
import { storyboard as realStoryboard } from '../../src/storyboard'

const VIEWPORT = { width: 1000, height: 500 }

// Every name sits at the same box unless a test says otherwise.
function layoutWith(overrides: Partial<Layout['rects']> = {}): Layout {
  const box = { left: 0, top: 0, width: 100, height: 100 }
  return {
    viewport: VIEWPORT,
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
    expect(() => compile([beat('gone', { designer: [reveal('name')] })], { viewport: VIEWPORT, rects }))
      .toThrow(/unknown target "name"/i)
  })

  it('refuses a verb not allowed for the Teammate', () => {
    // @ts-expect-error the Delegator makes no edits
    const storyboard = [beat('overreach', { delegator: [reveal('name')] })]
    expect(() => compile(storyboard, layoutWith())).toThrow(/delegator can't "reveal"/i)
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

describe('the real Storyboard', () => {
  it('compiles against every Build name', () => {
    expect(compile(realStoryboard, layoutWith()).duration).toBeGreaterThan(0)
  })
})
