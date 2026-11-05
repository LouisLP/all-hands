# Build spec

A standalone proof-of-concept portfolio for Louis, aimed at Design Engineer roles. A Team of labelled cursors assembles the page as the Spectator scrolls. Language comes from [`CONTEXT.md`](../CONTEXT.md).

This file is the implementation contract. It consolidates [map #1](https://github.com/LouisLP/all-hands/issues/1), and where an older ticket disagrees, this file wins. Nothing here has been built yet: the engine design has only had a one-section prototype (#5) and a throwaway layout probe (#7).

**Success:** Louis would send it to a hiring manager, and 2–3 design-engineer friends understand the idea unprompted.

## Standing rules

- Fully scripted, with no live AI. No on-page copy explains that it's a simulation.
- Teammates are named by job title, never as invented people.
- The Delegator only briefs, approves and rejects. Other Teammates make every edit.
- The Spectator can scroll and skip, and nothing else.
- Scroll scrubs a deterministic timeline 1:1 with no damping, so scrolling back un-builds the page.
- The first viewport always shows name and role.
- The finished page is real semantic HTML. No-JS, skip and phones all land on it.
- Own engine and choreography. [Swarm](https://github.com/califa/swarm-site) has no licence, so reuse none of its code, assets or copy, and credit it in the colophon.

Too close to Swarm to borrow: cursors orbiting a logo, a crowd that grows with scroll speed, a flocking finale, a closing tally, heading tick-up through font sizes, and the offset, drag-to-guide, flash-on-snap set piece. Full reasoning is in the [Swarm findings](https://github.com/LouisLP/all-hands/blob/research/swarm-choreography/docs/research/swarm-choreography.md).

## Stack

- TypeScript in strict mode, in a thin Vue 3 + Vite shell, hosted on GitHub Pages.
- GSAP core + ScrollTrigger. Only the engine's compile and driver modules import GSAP. The engine imports no Vue.
- Vitest for compile and state, Playwright in Chromium, Firefox and WebKit for behaviour.
- The built `index.html` contains the whole finished page. Use `vite-ssg` unless the first issue finds a simpler way to get that.

## Finished page

Sections: hero, short about, 3 projects, contact. Project cards link out, and there are no detail pages. The page is designed down to 320px and is static, with no entrance animations. Check Anton caps at 320px, because long words in poster type can overflow.

The visual reference is variant A in the [theme prototype](https://github.com/LouisLP/all-hands/blob/prototype/theme-type/prototypes/theme-type/index.html). Start from Louis's CSS reset (the `css-reset` skill), including `-webkit-font-smoothing: antialiased`.

- **Type:** Anton caps for display, Archivo for body. Name and role fill the first viewport.
- **Shape:** hard rectangles, quarter circles and full-bleed bands. No rounded corners.
- **Mono:** JetBrains Mono 500 for the annotation layer only.
- **Fonts:** self-hosted subset WOFF2, not Google Fonts.

**Annotation layer:** inspired by [stripe.dev](https://stripe.dev/), a quiet technical layer over the poster type: `/ LABEL` headers on hairlines, `+` registration marks, a `[ FIG. 1 ]` frame around the hero shapes, superscript counts, square-cornered tags and `■` list bullets. Vibe only: reuse none of its code, assets or fonts. Its pale gradient, pills and bracketed keyboard shortcuts stay out, because they conflict with the palette, the no-rounded-corners rule and scroll-and-skip only.

| Colour | Value | Use |
|---|---|---|
| Mandarin | `#FD550A` | Hero field and one project band, with Ink text only |
| Forest | `#015D47` | About panel and one project band with Cream text; decorative shapes on Mandarin |
| Cream | `#F3E8D2` (estimated) | Text on Forest and Ink; quiet bands with Forest text |
| Crest | `#E0F354` | "Get in touch" only. The hero button has an Ink border on Mandarin. The closing band has Ink text and sits on Ink |
| Ink | `#012A20` | Headline on Mandarin, section header, footer |

| Text pair | Ratio | Allowed |
|---|---|---|
| Forest and Cream, either way | 6.50 | Any text |
| Crest on Forest | 6.44 | Any text |
| Ink on Crest | 12.65 | Any text |
| Cream on Ink | 12.77 | Any text |
| Ink on Mandarin | 4.79 | Any text |
| White on Mandarin | 3.24 | Large text only |
| Cream, Crest or Forest on Mandarin | 2.44–2.67 | Decorative only |
| Crest on Cream | 1.01 | Needs a border |

Copy is placeholder until the final-copy issue. Source it from [LouisLP/me](https://github.com/LouisLP/me), whose Kabuki and "Calm" rules don't apply here.

## The Build

Two movements. Sections are built top-down in grey with poster type. Then the Delegator rejects the whole grey page, and colour arrives across it in one go.

The eight parts below are the outline of the Storyboard. Each one is authored as one or more Beats. Brief wording is provisional, and scroll shares are targets reached by tuning Beat durations.

| # | Part | What happens | Scroll |
|---|---|---|---|
| 1 | Hero | The Delegator sits alone by name and role, with Brief "Make it a poster." The Designer enters, sets Anton and adds grey shapes and a grey hero button. The Delegator approves. | 15% |
| 2 | About | The Designer lays out grey boxes and places the text slightly off, then corrects it unprompted. A Brief calls Backend in, who swaps placeholder text for the real bio. | 15% |
| 3 | Projects | The Designer makes one card. The Delegator rejects it with "Tighter.", the Designer fixes it, and the Delegator approves. Agents 1 and 2 enter, then duplicate and fill one card each while Backend adds real names and links. | 25% |
| 4 | Contact | The Designer lays out the grey closing band, and Backend adds the real contact link. | 10% |
| 5 | Turn | The Camera pulls back to the whole grey page. The Delegator rejects all of it: "Too safe." | 5% |
| 6 | Colour | The Designer fills the Mandarin hero and Forest about panel, setting the palette. The Agents fill the project bands and section header. | 20% |
| 7 | Crest | A Brief asks for one thing to click. The Designer fills the closing band, then the hero button. The Delegator says "Ship it." | 5% |
| 8 | Landing | The Camera returns to the hero. Briefs clear, chrome goes, and cursors leave one by one: Backend first, Delegator last. The page unpins. | 5% |

Each approval or rejection causes the next action: the card approval releases the Agents, and "Too safe." triggers colour.

- **Opening frame:** name and role in neutral system type on the grey canvas, the Delegator's cursor and first Brief in place, and one small line, "Scroll to build · Skip". Skip is a real link. The line stays fixed through the Build and fades at the Landing.
- **Team:** Teammates enter when a Brief calls for them: Designer, Backend, then Agents.
- **Brief voice:** terse, real art direction.
- **Turn view:** zoom out with cursors and Briefs kept at screen size, and stay zoomed out through Colour and Crest.
- **Crest:** appears only in part 7.
- **Hero type gesture:** the Designer selects the existing text, the font switches to Anton, and one continuous corner-handle drag takes it to poster size at a real font size. Swap the gesture if it looks too close to Swarm's tick-up when built.
- **Comment bubbles:** above the pointer, because the name label sits below it.
- **Neutral stage:** start from the prototype's neutral token values (Mandarin `#B4B4B2`, Forest `#4A4A48`, Cream `#F0F0EE`, Crest `#FFFFFF`, Ink `#1B1B1B`).

| Teammate | Cursor | Label text |
|---|---|---|
| Delegator | Ink | Cream |
| Designer | Mandarin | Ink |
| Backend | Forest | Cream |
| Agents 1 and 2 | Cream, thin Forest outline | Forest |

Cursors keep these colours from the first frame, so the Team reads as the source of colour.

Gesture craft worth borrowing from Swarm's general design-tool vocabulary: move time proportional to the square root of distance, free moves that arc, drags that run straight, cursor shapes that change per tool, chrome that disappears when idle, and text placed slightly wrong and then visibly corrected.

## Engine

The Build runs on the real page. A typed Storyboard compiles into one GSAP timeline over a plain numeric state object, and one `draw()` writes temporary overrides onto the prerendered elements. When `t` reaches the end, every override is cleared, so "finished" means the plain page.

### Seam

```ts
// Loaded with a dynamic import, only when the load check passes
const build = createBuild({ root, storyboard, onPhase })
build.skip()    // final, remembered for the session
build.exit()    // one-way to the finished page, not remembered
build.destroy()
// onPhase: 'ready' | 'finished' | 'skipped' | 'exited'
```

- **Vue owns:** prerendered content with `data-build` names, the skip link, and calling `createBuild` in `onMounted` and `destroy` on unmount. It reads phases only, never per-frame state.
- **Engine owns:** measuring, compiling, state, `draw()`, the overlay, the Track, and resize and reduced-motion recompiles.
- **Internal:** `seek(t)` exists for tests and the scroll driver, not Vue.

### Structure

```html
<div class="build">          <!-- overflow-x: clip -->
  <main class="pinned">      <!-- position: sticky; top: 0 -->
    <div class="camera">…real page…</div>
    <div class="overlay" aria-hidden="true">…cursors, chrome, Briefs…</div>
  </main>
  <div class="track"></div>  <!-- added by the engine, height = Build scroll length -->
</div>
```

The sticky page stays pinned for the length of the Track, then scrolls natively. No code hands over from one to the other. Without JS there's no Track, so the page is simply in flow.

### Storyboard

- Typed TypeScript data: an ordered list of Beats.
- Each Beat has one sequential lane per Teammate plus a Camera lane, and ends when its longest lane ends. Beats run one after another, which makes them the sync points.
- Durations come from the verb, with optional overrides.
- Types limit the Delegator to brief, approve, reject and leave, and the Camera to `pan` and `fit`. Leaving isn't an edit, and part 8 needs it.
- Targets are named elements and anchor points, such as `name.corner`, resolved by measuring the finished layout with no Camera after `document.fonts.ready`. Free moves use percentages.
- Actions accept a `cue` field for later sound, with no implementation now.

```ts
beat('Agent fills cards while Designer tidies', {
  agent:    [dup('card1'), dup('card2'), fill('card3')],
  designer: [move('heading'), drag('heading.corner', { width: 600 })],
})
```

### Time, state and drawing

- One Track, with scroll mapping directly to `t` at a fixed px-per-authored-second rate. ScrollTrigger only reads progress: raw scrub, no damping, and no `pin:`.
- GSAP tweens only numeric state: character counts, 0–1 colour mixes, and thresholds for discrete changes such as font family. Typing has to be drawn from numeric state, because a string tween failed to revert on seek back in #2's probe.
- `draw()` is table-driven and skips unchanged values. Its overrides are limited to transform, opacity, font size, font family, colour tokens, visible text and clip.
- Section heights are locked to their finished size. Big type uses real font size inside a box locked to its finished size, so siblings don't reflow.
- The colour arc interpolates CSS colour tokens from neutral to final. Neutral values stay on the root, and each fill overrides them on its own element, so colour arrives where a Teammate puts it.
- A read-only ambient layer runs on wall-clock time over scrubbed state: caret blink and idle cursor drift, with no effect on the page and no visual progress. It's off under reduced motion and on the finished page. Cut the drift if it reads as noise.

### Camera

- A transform on the page, which is the one exception to the real-font-size rule. It only zooms out, and ends with no transform, so finished type isn't scaled.
- Anchors are mapped through it into the overlay, so cursors and Briefs stay at screen size at the Turn.
- The whole page has to fit the zoomed-out view at 1024px and above.

### Lifecycle

- **Load check:** `(min-width: 1024px) and (hover: hover) and (pointer: fine)`. One inline `<head>` script covers this check, the remembered skip, a hash in the URL and marking the page Build-pending, before first paint. Only passing devices download the engine and GSAP.
- **Failing the check:** the finished page, plus one quiet desktop hint line near the contact section or footer. Only the inline script shows it, so a desktop that skips and a browser with no JS never see it.
- **First paint on a pass:** CSS shows the neutral canvas with name and role visible in system type. If the engine hasn't started after about 3s or fails to load, the finished page shows.
- **After the Landing:** overrides clear when `t` reaches the end, and the finished page scrolls natively. Only scrolling back above that point un-builds. The Build stays scrubbable and finishing isn't remembered. A reload below that point seeks to the end.
- **Reload mid-Build:** restores scroll and seeks to match.
- **Resize:** re-measures, recompiles and seeks to the same progress. Cursors may jump.
- **Narrowing below the check:** the shell watches the media query and calls `exit()`, which jumps to the finished page for that visit. Widening doesn't restart it, and a reload checks again.
- **Skip:** seeks to the end, clears overrides, removes the Track, destroys the engine, goes to the top of the finished page and focuses its `h1`. Remembered in `sessionStorage`.
- **Deep link:** loading with a hash counts as a skip, then goes to that section.
- **Errors:** throw in dev. In production they destroy the engine and show the finished page.

### Accessibility and reduced motion

- Typed elements hold their full text visually hidden, plus an `aria-hidden` span with the typed characters, and collapse back to plain text when overrides clear. Find-in-page may match text that isn't drawn yet, which is accepted.
- The overlay is `aria-hidden`.
- **Focus:** the compiler records when each target is revealed, meaning the end of the last Beat that touches it. On `focusin`, if the element is off screen during the Build, the engine scrolls to that point. The browser can't do this natively, as #7's probe showed. Tabbing back can un-build later work, which is accepted.
- **Reduced motion:** large-motion actions are tagged in the Storyboard, including every pan and zoom, and the compiler replaces them with a short fade or cut that has the same end state. Changing the OS setting mid-visit recompiles at the same progress. A qualifying desktop with reduced motion still gets the Build.

## Performance budget

These are starting values chosen before anything has been built. Change them only with a recorded reason.

**Load**, measured with Lighthouse's default mobile profile on the finished page:

| Measure | Limit |
|---|---|
| LCP | 2.5s |
| CLS | 0.1 |
| Initial JS, gzipped, without the engine chunk | 40 KB |
| Fonts, total (Anton, Archivo 400 and 600, JetBrains Mono 500) | 100 KB |
| Everything on initial load, gzipped | 250 KB |

**Engine chunk:** 60 KB gzipped, including GSAP + ScrollTrigger (measured at 45.2 KB in #2). Failing devices never request it.

**Runtime**, at 1440×900 during a scripted scroll through the whole Track, measured in Chromium with rAF intervals:

| Measure | Unthrottled | 4× CPU throttle |
|---|---|---|
| p95 frame interval | 20ms | 33ms |
| Longest frame | 50ms | 100ms |
| p95 `draw()` time | 4ms | 8ms |

Firefox and WebKit get a visual check rather than a number. The zoomed-out view is the main risk, because it transforms the whole page.

## Required tests

1. `seek(end)` leaves the DOM identical to the prerendered page, with no overrides.
2. Forward, backward and random seeks to the same `t` give identical state and DOM.
3. Seeking back to `0` after a full run matches a fresh start.
4. Types and compile checks catch unknown targets and verbs not allowed for a Teammate.
5. Scrolling across the end of the Track moves the hero 1:1 with no jump, and document height never changes.
6. Tabbing to an unbuilt link during the Build leaves it on screen.
7. The whole page fits the zoomed-out view at 1024px and above.
8. The contrast check passes for page text at each Build stage, and for cursor and Brief labels, which #4 didn't measure.

## Closed questions from the map

- **Final copy, desktop hint and colophon:** build with placeholders and finish in a late issue, written by Louis. The colophon credits Swarm.
- **Link previews:** Open Graph and Twitter tags with a title, a description and one static 1200×630 image of the finished hero.
- **Pointer reactions:** cut from the proof of concept. The read-only ambient layer leaves room for them later.
- **Total scroll length:** set during the build. A normal scroll through the Build should feel unhurried with no padded Beat, and stay short enough that passing the content twice doesn't drag.

## Out of scope

- Sound, beyond the `cue` field
- Visitor interaction beyond scrolling and skipping
- Pointer reactions
- A simplified Build for phones or touch tablets
- Live AI
- Project detail pages
- Replacing `me` as the primary portfolio

## Still untested

- Real trackpad input in automation. Louis's own hands are the only evidence so far.
- Scrubbing over a full page, in Firefox, or with GSAP on the real page.
- Zoomed-out legibility, the cost of transforming the whole page, and type crispness when the Camera ends at no transform.
- Cursor outline, label sizes and whether idle drift reads as life or noise.
- Whether Louis's reported pixelated type is fixed by the reset and real font size. It didn't reproduce in headless browsers.

## Sources

| Ticket | Covers |
|---|---|
| [#2](https://github.com/LouisLP/all-hands/issues/2) | Scrubbing library ([findings](https://github.com/LouisLP/all-hands/blob/research/scroll-scrubbing/docs/research/scroll-scrubbing.md)) |
| [#3](https://github.com/LouisLP/all-hands/issues/3) | Swarm's choreography |
| [#4](https://github.com/LouisLP/all-hands/issues/4) | Theme and type |
| [#5](https://github.com/LouisLP/all-hands/issues/5) | Scrub feel ([prototype](https://github.com/LouisLP/all-hands/blob/prototype/scrub-feel/prototypes/scrub-feel.html)) |
| [#6](https://github.com/LouisLP/all-hands/issues/6) | Storyboard |
| [#7](https://github.com/LouisLP/all-hands/issues/7) | Engine, plus its [amendment](https://github.com/LouisLP/all-hands/issues/7#issuecomment-6625579738) |
| [#8](https://github.com/LouisLP/all-hands/issues/8) | Phones |
