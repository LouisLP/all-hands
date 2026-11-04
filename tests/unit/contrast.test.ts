import { readFileSync } from 'node:fs'

import { describe, expect, it } from 'vitest'

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

describe('requiredRatio', () => {
  it('asks 3 of large text and 4.5 of the rest', () => {
    expect(requiredRatio(24, 400)).toBe(3)
    expect(requiredRatio(19, 700)).toBe(3)
    expect(requiredRatio(19, 600)).toBe(4.5)
    expect(requiredRatio(14, 700)).toBe(4.5)
  })
})
