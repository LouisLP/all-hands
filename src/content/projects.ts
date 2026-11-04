/** Placeholder copy, adapted from LouisLP/me until the final-copy issue. */
export type ProjectTone = 'cream' | 'mandarin' | 'forest'

export interface Project {
  title: string
  description: string
  meta: string
  href: string
  tone: ProjectTone
}

export const projects: readonly Project[] = [
  {
    title: 'Agile UI',
    description: 'The component library I built at Agile Robots, with a Figma file that matches the CSS one-to-one.',
    meta: 'Vue · Figma · Storybook',
    href: 'https://louislp.github.io/me/projects/agile-ui',
    tone: 'cream',
  },
  {
    title: 'Colour Combos',
    description: 'A browser for all 348 combinations in Sanzo Wada\'s 1930s colour dictionary.',
    meta: 'Vue · Reka UI · Agentic AI',
    href: 'https://louislp.github.io/japanese-colour-combos/',
    tone: 'mandarin',
  },
  {
    title: 'Kaki',
    description: 'Grab the curve by its handles, watch a persimmon act it out, copy the CSS.',
    meta: 'Svelte · cubic-bezier()',
    href: 'https://louislp.github.io/kaki/',
    tone: 'forest',
  },
]
