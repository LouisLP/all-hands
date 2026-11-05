import { approve, beat, box, brief, crest, dup, fill, fit, leave, move, nudge, pan, reject, replace, reveal, setType, type } from './engine/storyboard'
import type { Storyboard } from './engine/storyboard'

const PLACEHOLDER_BODY = 'Placeholder text about the person this page is for.'
const PLACEHOLDER_TITLE = 'Project'

// #21 tunes the timing.
const hero: Storyboard = [
  beat('Hero: the Delegator sits alone by name and role', {
    delegator: [brief('Make it a poster.', { x: 30, y: 46 }, { inPlace: true, duration: 2.5 })],
  }),
  beat('Hero: the Designer sets the type', {
    designer: [setType('title', { name: 32, role: 32 }, { duration: 2.8, large: true })],
  }),
  beat('Hero: the Designer adds the shapes and the button', {
    designer: [
      reveal('hero-meta', { duration: 0.3 }),
      reveal('hero-marks-top', { duration: 0.3 }),
      reveal('hero-marks-bottom', { duration: 0.3 }),
      move('hero-shapes'),
      reveal('hero-shapes'),
      box('hero-button'),
      reveal('hero-intro', { duration: 0.3 }),
    ],
  }),
  beat('Hero: the Delegator approves', {
    delegator: [approve('Good.', 'hero-button', { duration: 1.3 })],
  }),
]

const about: Storyboard = [
  beat('About: the Designer lays out grey boxes', {
    camera: [pan('about')],
    designer: [box('about-panel', { duration: 1.1, large: true }), box('about-body', { duration: 1.1, large: true })],
  }),
  beat('About: the Designer places the text slightly off, then corrects it', {
    designer: [
      reveal('about-label', { duration: 0.2 }),
      type('about-heading', { duration: 1.2 }),
      type('about-body1', { text: PLACEHOLDER_BODY, duration: 0.5 }),
      type('about-body2', { text: PLACEHOLDER_BODY, duration: 0.5 }),
      nudge('about-heading', { x: 22, y: 14 }),
    ],
  }),
  beat('About: a Brief calls Backend in', {
    delegator: [brief('Real words.', 'about-body.origin', { duration: 1 })],
  }),
  beat('About: Backend swaps in the real bio', {
    backend: [replace('about-body1', { duration: 0.8 }), replace('about-body2', { duration: 0.8 })],
  }),
]

const projects: Storyboard = [
  beat('Projects: the Designer makes one card', {
    camera: [pan('work')],
    designer: [
      box('work-heading', { large: true }),
      box('card1', { large: true }),
      reveal('card1-index', { duration: 0.2 }),
      type('card1-link', { text: PLACEHOLDER_TITLE, duration: 0.3 }),
      type('card1-description', { duration: 0.6 }),
      reveal('card1-stack', { duration: 0.2 }),
    ],
  }),
  beat('Projects: the Delegator rejects it', {
    delegator: [reject('Tighter.', 'card1-details.corner', { duration: 1.2 })],
  }),
  beat('Projects: the Designer fixes it', {
    designer: [nudge('card1-details', { x: 48, y: 0 }), nudge('card1-title', { x: 40, y: 0 })],
  }),
  beat('Projects: the Delegator approves', {
    delegator: [approve('Yes. Do the rest.', 'card1-details.corner', { duration: 1 })],
  }),
  beat('Projects: the approval releases the Agents, who duplicate the card', {
    agent1: [dup('card2', 'card1', { large: true }), reveal('card2-index', { duration: 0.2 }), type('card2-link', { text: PLACEHOLDER_TITLE, duration: 0.3 })],
    agent2: [dup('card3', 'card1', { large: true }), reveal('card3-index', { duration: 0.2 }), type('card3-link', { text: PLACEHOLDER_TITLE, duration: 0.3 })],
  }),
  beat('Projects: the Agents fill a card each, while Backend adds real names and links', {
    agent1: [type('card2-description', { duration: 0.8 }), reveal('card2-stack', { duration: 0.2 })],
    agent2: [type('card3-description', { duration: 0.8 }), reveal('card3-stack', { duration: 0.2 })],
    backend: [
      replace('card1-link', { duration: 0.3 }),
      reveal('card1-arrow', { duration: 0.2 }),
      replace('card2-link', { duration: 0.3 }),
      reveal('card2-arrow', { duration: 0.2 }),
      replace('card3-link', { duration: 0.3 }),
      reveal('card3-arrow', { duration: 0.2 }),
    ],
  }),
]

const contact: Storyboard = [
  beat('Contact: the Designer lays out the closing band', {
    camera: [pan('contact')],
    designer: [box('contact', { large: true }), box('contact-button', { large: true }), type('contact-button', { text: 'Contact', duration: 0.3 })],
  }),
  beat('Contact: Backend adds the real contact link', {
    backend: [replace('contact-button', { duration: 0.4 }), reveal('contact-links', { duration: 0.3 }), reveal('colophon', { duration: 0.3 })],
  }),
]

const turn: Storyboard = [
  beat('Turn: the Camera pulls back to the whole grey page', {
    camera: [fit({ duration: 2.4 })],
  }),
  beat('Turn: the Delegator rejects all of it', {
    delegator: [reject('Too safe.', 'work', { duration: 2 })],
  }),
]

const colour: Storyboard = [
  beat('Colour: "Too safe." sends the Designer to set the palette', {
    designer: [fill('hero', { duration: 2.8 }), fill('about-panel', { duration: 2.4 }), fill('about-body', { duration: 1.6 })],
  }),
  beat('Colour: the Delegator approves the palette', {
    delegator: [approve('Yes. All of it.', 'about-panel.corner', { duration: 1.4 })],
  }),
  beat('Colour: the approval releases the Agents, who fill the rest', {
    agent1: [fill('work-heading', { duration: 1 }), fill('card2', { duration: 2.4 }), fill('contact', { duration: 2.4 })],
    agent2: [fill('card1', { duration: 2.8 }), fill('card3', { duration: 2.8 })],
  }),
]

const crestPart: Storyboard = [
  beat('Crest: a Brief asks for one thing to click', {
    delegator: [brief('One thing to click.', 'contact-button', { duration: 1 })],
  }),
  beat('Crest: the Designer fills the closing band, then the hero button', {
    designer: [crest('contact-button', { duration: 1 }), crest('hero-button', { duration: 0.6 })],
  }),
  beat('Crest: the Delegator signs off', {
    delegator: [approve('Ship it.', 'hero-button', { duration: 1 })],
  }),
]

// The cursors have to land as the Camera does, or a free point misses, and they'd go off
// with the page they were on. The Delegator can't move, but "Ship it." left them on the hero.
// Large motion like the Camera's, so under reduced motion they cut along with it.
const RETURN = { duration: 1.6, large: true }

const landing: Storyboard = [
  beat('Landing: the Camera returns to the hero, and the Team comes with it', {
    camera: [pan('hero', RETURN)],
    backend: [move({ x: 72, y: 30 }, RETURN)],
    agent1: [move({ x: 60, y: 62 }, RETURN)],
    agent2: [move({ x: 80, y: 66 }, RETURN)],
    designer: [move({ x: 48, y: 36 }, RETURN)],
  }),
  beat('Landing: Backend leaves first', { backend: [leave({ duration: 0.5 })] }),
  beat('Landing: Agent 1 leaves', { agent1: [leave({ duration: 0.5 })] }),
  beat('Landing: Agent 2 leaves', { agent2: [leave({ duration: 0.5 })] }),
  beat('Landing: the Designer leaves', { designer: [leave({ duration: 0.5 })] }),
  beat('Landing: the Delegator leaves last', { delegator: [leave({ duration: 0.7 })] }),
]

export const storyboard: Storyboard = [...hero, ...about, ...projects, ...contact, ...turn, ...colour, ...crestPart, ...landing]
