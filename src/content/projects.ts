export type ProjectTone = 'cream' | 'mandarin' | 'forest'

export interface Project {
  title: string
  description: string
  stack: readonly string[]
  href: string
  tone: ProjectTone
}

export const projects: readonly Project[] = [
  {
    title: 'Agile UI',
    description: 'The component library I built at Agile Robots: 100% test and Storybook coverage, and a Figma file that matches the CSS one-to-one.',
    stack: ['Vue', 'Figma', 'Storybook'],
    href: 'https://louislp.github.io/me/projects/agile-ui',
    tone: 'cream',
  },
  {
    title: 'Colour Combos',
    description: 'All 348 combinations from Sanzo Wada\'s 1930s colour dictionary. Find one you like and walk away with a full scale and the code for it.',
    stack: ['Vue', 'Reka UI', 'Agentic AI'],
    href: 'https://louislp.github.io/japanese-colour-combos/',
    tone: 'mandarin',
  },
  {
    title: 'Kaki',
    description: 'An easing playground: grab the curve by its handles, watch a persimmon act it out, copy the CSS.',
    stack: ['Svelte', 'cubic-bezier()'],
    href: 'https://louislp.github.io/kaki/',
    tone: 'forest',
  },
]
