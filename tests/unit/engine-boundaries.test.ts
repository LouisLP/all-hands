import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

const ENGINE = 'src/engine'
const GSAP_ALLOWED = ['compile.ts', 'driver.ts']

const modules = readdirSync(ENGINE).map(file => ({
  file,
  imports: [...readFileSync(join(ENGINE, file), 'utf8').matchAll(/from '([^']+)'|import\('([^']+)'\)/g)].map(m => m[1] ?? m[2]),
}))

describe('engine boundaries', () => {
  it('finds the engine', () => {
    expect(modules.map(m => m.file)).toEqual(expect.arrayContaining(GSAP_ALLOWED))
  })

  it('imports no Vue', () => {
    const offenders = modules.filter(m => m.imports.some(i => i === 'vue' || i?.endsWith('.vue')))
    expect(offenders.map(m => m.file)).toEqual([])
  })

  it('imports GSAP only in the compile and driver modules', () => {
    const offenders = modules.filter(m => m.imports.some(i => i?.startsWith('gsap')) && !GSAP_ALLOWED.includes(m.file))
    expect(offenders.map(m => m.file)).toEqual([])
  })
})
