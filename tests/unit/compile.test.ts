import { describe, expect, it } from 'vitest'

import { compile } from '../../src/engine/compile'
import type { Layout } from '../../src/engine/compile'
import { approve, beat, box, brief, BUILD_NAMES, dup, fit, move, nudge, pan, reject, replace, reveal, setType, type } from '../../src/engine/storyboard'
import type { Storyboard } from '../../src/engine/storyboard'
import { storyboard as realStoryboard } from '../../src/storyboard'

const VIEWPORT = { width: 1000, height: 500 }
const PAGE = { width: 1000, height: 4000 }

// Every name sits at the same box unless a test says otherwise.
function layoutWith(overrides: Partial<Layout['rects']> = {}): Layout {
  const rect = { left: 0, top: 0, width: 100, height: 100 }
  return {
    viewport: VIEWPORT,
    page: PAGE,
    rects: { ...Object.fromEntries(BUILD_NAMES.map(name => [name, rect])), ...overrides },
    fontSizes: Object.fromEntries(BUILD_NAMES.map(name => [name, 100])),
    texts: Object.fromEntries(BUILD_NAMES.map(name => [name, { text: `The text of ${name}`, systemWidthEm: 4 }])),
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
    expect(() => compile([beat('gone', { designer: [reveal('name')] })], { ...layoutWith(), rects }))
      .toThrow(/unknown target "name"/i)
  })

  it('refuses a verb not allowed for the Teammate', () => {
    // @ts-expect-error the Delegator makes no edits
    const storyboard = [beat('overreach', { delegator: [reveal('name')] })]
    expect(() => compile(storyboard, layoutWith())).toThrow(/delegator can't "reveal"/i)
  })

  it('refuses a verb outside each Teammate\'s job', () => {
    // @ts-expect-error the Delegator makes no edits
    const delegatorTypes = [beat('overreach', { delegator: [type('name')] })]
    expect(() => compile(delegatorTypes, layoutWith())).toThrow(/delegator can't "type"/i)
    // @ts-expect-error only the Delegator rejects
    const designerRejects = [beat('overreach', { designer: [reject('No.', 'name')] })]
    expect(() => compile(designerRejects, layoutWith())).toThrow(/designer can't "reject"/i)
    // @ts-expect-error only the Delegator approves
    const backendApproves = [beat('overreach', { backend: [approve('Yes.', 'name')] })]
    expect(() => compile(backendApproves, layoutWith())).toThrow(/backend can't "approve"/i)
    // @ts-expect-error Backend replaces data, and doesn't lay out boxes
    const backendBoxes = [beat('overreach', { backend: [box('name')] })]
    expect(() => compile(backendBoxes, layoutWith())).toThrow(/backend can't "box"/i)
    // @ts-expect-error duplicating is the Agents' job
    const designerDups = [beat('overreach', { designer: [dup('card2', 'card1')] })]
    expect(() => compile(designerDups, layoutWith())).toThrow(/designer can't "dup"/i)
    // @ts-expect-error the type gesture is the Designer's
    const agentSets = [beat('overreach', { agent1: [setType('title', { name: 40 })] })]
    expect(() => compile(agentSets, layoutWith())).toThrow(/agent1 can't "setType"/i)
  })

  it('refuses typing into an element that holds more than text', () => {
    const { card1: _card1, ...texts } = layoutWith().texts
    const storyboard = [beat('nested', { designer: [type('card1')] })]
    expect(() => compile(storyboard, { ...layoutWith(), texts })).toThrow(/can't type into "card1"/i)
  })

  it('refuses two actions on one value at once', () => {
    const storyboard = [beat('clash', {
      designer: [reveal('name', { duration: 1 })],
      backend: [reveal('name', { duration: 1 })],
    })]
    expect(() => compile(storyboard, layoutWith())).toThrow(/overlap/i)
  })

  it('refuses a Brief in place anywhere but the start', () => {
    const storyboard = [
      beat('first', { designer: [reveal('name', { duration: 1 })] }),
      beat('second', { delegator: [brief('Late.', 'name', { inPlace: true })] }),
    ]
    expect(() => compile(storyboard, layoutWith())).toThrow(/in place/i)
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
    expect(compiled.briefs).toEqual([{ lane: 'delegator', kind: 'brief', text: 'Too safe.' }])

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

describe('the opening frame', () => {
  const opening = compile([
    beat('opening', { delegator: [brief('Make it a poster.', { x: 30, y: 20 }, { inPlace: true, duration: 2 })] }),
    beat('then', { designer: [reveal('name', { duration: 1 })] }),
  ], layoutWith())

  it('has the Delegator and first Brief in place at t = 0', () => {
    expect(opening.state).toMatchObject({ 'delegator.presence': 1, 'delegator.x': 300, 'delegator.y': 100, 'brief0.presence': 1 })
  })

  it('takes no travel time, and clears the Brief when it ends', () => {
    expect(opening.duration).toBe(3)
    expect(snapshotAt(opening, 2)).toMatchObject({ 'brief0.presence': 0 })
  })

  it('leaves the Designer out until called', () => {
    opening.timeline.seek(0, false)
    expect(opening.state).toMatchObject({ 'designer.presence': 0 })
    expect(snapshotAt(opening, 2.5)).toMatchObject({ 'designer.presence': 1 })
  })

  it('fades the line during the final Beat, and not before', () => {
    expect(snapshotAt(opening, 2)).toMatchObject({ 'line.presence': 1 })
    expect(snapshotAt(opening, 2.5)['line.presence']).toBeCloseTo(0.5, 5)
    expect(snapshotAt(opening, 3)).toMatchObject({ 'line.presence': 0 })
  })
})

describe('verdicts', () => {
  it('tags approvals and rejections for the overlay, timed like a Brief', () => {
    const compiled = compile([
      beat('verdicts', { delegator: [reject('Tighter.', 'name', { duration: 1 }), approve('Good.', 'name', { duration: 1 })] }),
    ], layoutWith())
    expect(compiled.briefs.map(({ kind, text }) => [kind, text])).toEqual([['reject', 'Tighter.'], ['approve', 'Good.']])
    expect(snapshotAt(compiled, compiled.duration - 0.5)).toMatchObject({ 'brief0.presence': 0, 'brief1.presence': 1 })
  })
})

describe('typed text', () => {
  it('types from numeric state, and takes the finished text by default', () => {
    const compiled = compile([beat('typing', { designer: [type('name', { duration: 1 })] })], layoutWith())
    const { length } = 'The text of name'
    expect(compiled.texts.name).toEqual(['The text of name'])
    const travel = compiled.duration - 1
    expect(snapshotAt(compiled, travel)).toMatchObject({ 'name.chars': 0 })
    expect(snapshotAt(compiled, travel + 0.5)['name.chars']).toBeCloseTo(length / 2, 5)
    expect(snapshotAt(compiled, compiled.duration)).toMatchObject({ 'name.chars': length })
  })

  it('swaps a placeholder by emptying it, switching source and typing the real text', () => {
    const swap = [
      beat('placeholder', { designer: [type('name', { text: 'Lorem', duration: 1 })] }),
      beat('real', { backend: [replace('name', { duration: 1 })] }),
    ]
    const compiled = compile(swap, layoutWith())
    expect(compiled.texts.name).toEqual(['Lorem', 'The text of name'])
    expect(snapshotAt(compiled, compiled.duration)).toMatchObject({ 'name.source': 1, 'name.chars': 16 })

    const midway = compiled.duration - 1.1
    expect(snapshotAt(compiled, midway)).toEqual(snapshotAt(compile(swap, layoutWith()), midway))
    expect(snapshotAt(compiled, midway)['name.source']).toBe(0)
  })

  it('refuses typing over text, and replacing nothing', () => {
    expect(() => compile([beat('twice', { designer: [type('name', { duration: 1 }), type('name', { duration: 1 })] })], layoutWith()))
      .toThrow(/isn't empty/i)
    expect(() => compile([beat('nothing', { backend: [replace('name')] })], layoutWith())).toThrow(/nothing to replace/i)
  })
})

describe('the hero type gesture', () => {
  const layout = layoutWith({
    title: { left: 20, top: 60, width: 1000, height: 400 },
    name: { left: 20, top: 60, width: 1000, height: 285 },
    role: { left: 20, top: 345, width: 1000, height: 115 },
  })
  const fontSizes = { ...layout.fontSizes, name: 300, role: 100 }
  const texts = { ...layout.texts, name: { text: 'Louis LP', systemWidthEm: 4 }, role: { text: 'Design Engineer', systemWidthEm: 8 } }
  const gesture = [beat('gesture', { designer: [setType('title', { name: 30, role: 20 })] })]
  const fresh = () => compile(gesture, { ...layout, fontSizes, texts })

  it('opens with system type at small sizes, the lines stacked in the middle of the box', () => {
    const { state } = fresh()
    expect(state).toMatchObject({ 'title.font': 0, 'name.fontSize': 30, 'role.fontSize': 20 })
    // The name takes 0.95 of its 30px and the role 1.15 of its 20px, in a 400px box from 60.
    const top = 60 + (400 - 28.5 - 23) / 2
    expect(state['name.y']).toBeCloseTo(top - 60, 5)
    expect(state['role.y']).toBeCloseTo(top + 28.5 - 345, 5)
  })

  it('wraps the selection around the opening text', () => {
    const { state } = fresh()
    expect(state).toMatchObject({ 'selection.presence': 0, 'selection.x': 20, 'selection.width': 160 })
    expect(state['selection.y']).toBeCloseTo(60 + (400 - 51.5) / 2, 5)
    expect(state['selection.height']).toBeCloseTo(51.5, 5)
  })

  it('ends one continuous drag at the finished sizes, with the handle on the corner', () => {
    const compiled = fresh()
    expect(snapshotAt(compiled, compiled.duration)).toMatchObject({
      'title.font': 1,
      'name.fontSize': 300,
      'role.fontSize': 100,
      'name.y': 0,
      'role.y': 0,
      'designer.x': 1020,
      'designer.y': 460,
      'selection.y': 60,
      'selection.width': 1000,
      'selection.height': 400,
      'selection.presence': 0,
    })
  })

  it('switches the font before the size starts to change', () => {
    const compiled = fresh()
    let t = 0
    while (snapshotAt(compiled, t)['title.font'] === 0) t += 0.01
    expect(snapshotAt(compiled, t)['name.fontSize']).toBe(30)
  })

  it('refuses the gesture on anything that isn\'t plain text', () => {
    const { name: _name, ...withoutName } = texts
    expect(() => compile(gesture, { ...layout, fontSizes, texts: withoutName })).toThrow(/can't set type on "name"/i)
  })
})

describe('layout verbs', () => {
  it('locks every element to its finished size', () => {
    const compiled = compile([beat('still', { designer: [reveal('name')] })], layoutWith({
      about: { left: 0, top: 0, width: 640, height: 480 },
    }))
    expect(compiled.state).toMatchObject({ 'about.width': 640, 'about.height': 480 })
    expect(compiled.rows).toContainEqual({ node: { kind: 'element', name: 'about' }, prop: 'lock', keys: ['about.width', 'about.height'] })
  })

  it('drags a box out from its top left to its bottom right', () => {
    const compiled = compile([beat('box', { designer: [box('about', { duration: 1 })] })], layoutWith({
      about: { left: 100, top: 200, width: 300, height: 400 },
    }))
    expect(compiled.state).toMatchObject({ 'about.clip': 1 })
    const travel = compiled.duration - 1
    expect(snapshotAt(compiled, travel)).toMatchObject({ 'designer.x': 100, 'designer.y': 200, 'about.clip': 1 })
    expect(snapshotAt(compiled, compiled.duration)).toMatchObject({ 'designer.x': 400, 'designer.y': 600, 'about.clip': 0 })
  })

  it('holds a nudged element off from the start, and drags it home', () => {
    const compiled = compile([beat('nudge', { designer: [nudge('name', { x: 20, y: -10 }, { duration: 1 })] })], layoutWith({
      name: { left: 0, top: 100, width: 100, height: 100 },
    }))
    expect(compiled.state).toMatchObject({ 'name.x': 20, 'name.y': -10 })
    const travel = compiled.duration - 1
    expect(snapshotAt(compiled, travel)).toMatchObject({ 'designer.x': 70, 'designer.y': 140 })
    expect(snapshotAt(compiled, compiled.duration)).toMatchObject({ 'name.x': 0, 'name.y': 0, 'designer.x': 50, 'designer.y': 150 })
  })

  it('duplicates by carrying a copy from one element to another', () => {
    const compiled = compile([beat('dup', { agent1: [dup('card2', 'card1', { duration: 1 })] })], layoutWith({
      card1: { left: 0, top: 100, width: 100, height: 50 },
      card2: { left: 0, top: 150, width: 100, height: 50 },
    }))
    expect(compiled.state).toMatchObject({ 'card2.opacity': 0, 'card2.x': 0, 'card2.y': -50 })
    expect(snapshotAt(compiled, compiled.duration)).toMatchObject({ 'card2.opacity': 1, 'card2.y': 0, 'agent1.x': 50, 'agent1.y': 175 })
  })

  it('bends a move and runs a drag straight', () => {
    const offLine = (compiled: Compiled, start: number, end: number) => {
      compiled.timeline.seek(start + (end - start) * 0.25, false)
      // From 0,0 to 400,400, so a straight path has x equal to y.
      return Math.abs(compiled.state['designer.x']! - compiled.state['designer.y']!)
    }
    const layout = layoutWith({ name: { left: 0, top: 0, width: 400, height: 400 } })
    const moved = compile([
      beat('start', { designer: [move('name.origin', { duration: 1 }), move('name.corner', { duration: 1 })] }),
    ], layout)
    expect(offLine(moved, 1, 2)).toBeGreaterThan(1)

    const dragged = compile([beat('drag', { designer: [box('name', { duration: 1 })] })], layout)
    expect(offLine(dragged, dragged.duration - 1, dragged.duration)).toBeLessThan(0.001)
  })
})

describe('the real Storyboard', () => {
  it('compiles against every Build name', () => {
    expect(compile(realStoryboard, layoutWith()).duration).toBeGreaterThan(0)
  })

  it('leaves nothing on the page at t = 0 but name and role', () => {
    const { state } = compile(realStoryboard, layoutWith())
    const hides = (name: string) => state[`${name}.opacity`] === 0 || state[`${name}.clip`] === 1 || state[`${name}.chars`] === 0
    // Wrappers paint nothing of their own, so they count as hidden when all they hold is.
    const wrappers = ['hero', 'title', 'about', 'about-body', 'work', 'footer', 'card1-title', 'card1-details', 'card2-title', 'card2-details', 'card3-title', 'card3-details']
    const hiddenBy: Partial<Record<string, string>> = { 'contact-button': 'contact-button', 'contact-links': 'contact-links', 'colophon': 'colophon' }
    const visible = BUILD_NAMES.filter(name =>
      !wrappers.includes(name) && !hides(hiddenBy[name] ?? name) && !hides(name.match(/^card\d/)?.[0] ?? name),
    )
    expect(visible).toEqual(['name', 'role'])
  })

  it('brings the Team on in order, when a Brief or approval calls them', () => {
    const compiled = compile(realStoryboard, layoutWith())
    const entrance = (lane: string) => {
      for (let t = 0; t <= compiled.duration; t += 0.05) {
        compiled.timeline.seek(t, false)
        if (compiled.state[`${lane}.presence`]! > 0)
          return t
      }
      return Number.POSITIVE_INFINITY
    }
    const times = ['delegator', 'designer', 'backend', 'agent1'].map(entrance)
    expect(times).toEqual([...times].sort((a, b) => a - b))
    expect(times[0]).toBe(0)
    expect(entrance('agent2')).toBe(entrance('agent1'))
  })

  it('has "Tighter." followed by the approval that releases the Agents', () => {
    const { briefs } = compile(realStoryboard, layoutWith())
    const kinds = briefs.map(({ kind, text }) => `${kind} ${text}`)
    const tighter = kinds.indexOf('reject Tighter.')
    expect(tighter).toBeGreaterThan(-1)
    expect(kinds[tighter + 1]).toMatch(/^approve /)
  })

  it('ends every typed element on its finished text', () => {
    const layout = layoutWith()
    const { texts } = compile(realStoryboard, layout)
    for (const [name, sources] of Object.entries(texts))
      expect(sources!.at(-1), name).toBe(layout.texts[name]!.text)
  })
})
