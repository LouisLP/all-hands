import { readFileSync } from 'node:fs'

import { describe, expect, it } from 'vitest'

import { LOAD_CHECK, SKIP_KEY } from '../../src/entry'

const html = readFileSync('index.html', 'utf8')

describe('the inline <head> script', () => {
  it('uses the shell\'s load check', () => {
    expect(html).toContain(`'${LOAD_CHECK}'`)
  })

  it('reads the key a skip is remembered under', () => {
    expect(html).toContain(`'${SKIP_KEY}'`)
  })
})
