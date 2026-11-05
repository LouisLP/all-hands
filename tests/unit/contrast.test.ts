import { readFileSync } from 'node:fs'

import { describe, expect, it } from 'vitest'

import { FINAL_TOKENS, mixToken, NEUTRAL_TOKENS } from '../../src/engine/draw'
import { contrastRatio, hexToRgb, palette, requiredRatio } from '../support/contrast'

const ratio = (a: string, b: string) => contrastRatio(hexToRgb(a), hexToRgb(b))

describe('palette', () => {
  it.each([
    ['Forest and Cream', palette.forest, palette.cream, 6.5],
    ['Crest on Forest', palette.crest, palette.forest, 6.44],
    ['Ink on Crest', palette.ink, palette.crest, 12.65],
    ['Cream on Ink', palette.cream, palette.ink, 12.77],
    ['Ink on Mandarin', palette.ink, palette.mandarin, 4.79],
  ])('%s matches the spec table', (_name, a, b, expected) => {
    expect(ratio(a, b)).toBeCloseTo(expected, 1)
  })

  it('matches the tokens the page uses', () => {
    const css = readFileSync(new URL('../../src/styles/tokens.css', import.meta.url), 'utf8')
    for (const [name, value] of Object.entries(palette))
      expect(css).toContain(`--${name}: ${value};`)
  })
})

describe('colour tokens', () => {
  const rgb = (css: string) => css.match(/\d+/g)!.map(Number) as [number, number, number]

  it('end the fills on the page\'s own values', () => {
    for (const [name, value] of Object.entries(palette))
      expect(FINAL_TOKENS[`--${name}` as keyof typeof FINAL_TOKENS]).toBe(value)
  })

  it('go from the neutral value to the final one', () => {
    expect(rgb(mixToken('--mandarin', 0))).toEqual([...hexToRgb(NEUTRAL_TOKENS['--mandarin'])])
    expect(rgb(mixToken('--mandarin', 1))).toEqual([...hexToRgb(palette.mandarin)])
    expect(rgb(mixToken('--mandarin', 0.5))).toEqual([217, 133, 94])
  })

  // The pairs that share a fill, so they're always at the same mix.
  it.each([
    ['--ink', '--mandarin'],
    ['--forest', '--cream'],
    ['--cream', '--ink'],
    ['--ink', '--crest'],
  ] as const)('keep %s on %s readable at every step of a fill', (fg, bg) => {
    for (let mix = 0; mix <= 1; mix += 0.05)
      expect(contrastRatio(rgb(mixToken(fg, mix)), rgb(mixToken(bg, mix))), `at ${mix}`).toBeGreaterThanOrEqual(4.5)
  })
})

describe('requiredRatio', () => {
  it('asks 3 of large text and 4.5 of the rest', () => {
    expect(requiredRatio(24, 400)).toBe(3)
    expect(requiredRatio(19, 700)).toBe(3)
    expect(requiredRatio(19, 600)).toBe(4.5)
    expect(requiredRatio(14, 700)).toBe(4.5)
  })
})
