# Which scroll-scrubbing approach and animation library should the Build use?

Researched 2026-11-04 for [#2](https://github.com/LouisLP/all-hands/issues/2). Versions tested: `gsap` 3.15.1, `motion` 14.9.1, `motion-v` 2.11.0, `lenis` 1.3.27.

## The short answer

Hand-roll the timeline. The Build is a pure `render(t)` over a list of clips, driven by native scroll through a `position: sticky` stage, with no animation library and no smooth-scroll library. I'd take that over GSAP even though GSAP is a very good library and passes nearly every test here.

The reason is what the Build actually is. Cursors, typing, drawing and fills mostly reduce to "set this DOM state for this `t`", and a tween library's best features (eases, sequencing, cross-browser value parsing) are small wins against **45 KB gzipped** of proprietary code. A working core plus scroll binding came to **0.5 KB** in my test. That number is flattering, since the real engine will grow (I'd guess 2 to 5 KB), but it won't come close. It also fits the standing decision of an "own engine", and for a Design Engineer portfolio the engine is part of what's on show.

If authoring by hand turns out to be a slog, GSAP core is the fallback. Keep the engine's interface down to `seek(t)` and swapping the inside later stays cheap. Motion and native CSS are the two I'd rule out as the driver, for different reasons below.

## The comparison

| | GSAP + ScrollTrigger | Motion (`motion`) | Native CSS scroll-driven | Hand-rolled |
| --- | --- | --- | --- | --- |
| Licence | Free but proprietary, Webflow can change it | MIT | None needed | Ours |
| Browser support | Doesn't depend on `ScrollTimeline` (my reading, not checked per browser) | Uses `ScrollTimeline` where available | Chrome 115, Safari 26, Firefox 159 | Anything with `scroll` and `sticky` |
| Measured size, gzipped | 27.6 KB core, 45.2 KB with ScrollTrigger | 25.4 KB `animate`, 28.1 KB with `scroll` | 0 KB | 0.5 KB today, more later |
| Vue fit | Framework-agnostic | Vanilla package is agnostic, `motion-v` is the Vue layer | CSS only | Framework-agnostic |
| Typing | `TextPlugin`, or a proxy tween | Motion value plus change listener (undocumented for this use) | No real text changes | One clip |
| Determinism in my test | Passes, except one `attr` gotcha | Passes | Not tested, it's the browser's job | Passes |
| Docs cover scrubbing? | Yes, `scrub` is a first-class option | Barely: `time` is settable, seek behaviour is unstated | Yes | We write them |

## Licensing

Nothing here blocks a public portfolio, GSAP included. The [standard licence](https://gsap.com/community/standard-license/) (effective 2025-04-30, last modified 2025-05-30) permits use "on any website, web application, or digital interface", and the [pricing page](https://gsap.com/pricing/) says "GSAP is now free for everyone", plugins included. Prohibited uses are tools "that allow users to build visual animations without code" and compete with Webflow. The Build _looks_ like a design tool, but the Spectator can only scroll and skip, so I read it as a website rather than a tool. That's my reading and not legal advice.

The strings are what differ. Webflow "may terminate" the licence for non-compliance, and can amend it by posting new terms, though you can stay on earlier versions if you reject them. The licence also says nothing specific about public repos. None of this bites today, but it would start to matter if the engine ever became a visual authoring tool people could use.

[Motion is MIT](https://raw.githubusercontent.com/motiondivision/motion/main/LICENSE.md), with a separate paid Motion+ tier we wouldn't need. [Lenis is MIT](https://raw.githubusercontent.com/darkroomengineering/lenis/main/README.md) too. A hand-rolled engine has no licence question at all, since it's ours.

One stale page to ignore: the [ScrollTrigger docs](https://gsap.com/docs/v3/Plugins/ScrollTrigger/) still call ScrollSmoother a members-only benefit, which conflicts with the pricing page. The npm package ships it.

## Browser support

CSS scroll-driven animations only just became cross-browser. [MDN's browser-compat data](https://raw.githubusercontent.com/mdn/browser-compat-data/main/css/properties/animation-timeline.json) lists `animation-timeline` in Chrome 115, Safari 26 and Firefox 159. [Firefox 159 shipped on 2026-10-27](https://www.firefox.com/en-US/firefox/159.0/releasenotes/), eight days before this note, and [MDN's `ScrollTimeline` page](https://developer.mozilla.org/en-US/docs/Web/API/ScrollTimeline) reads "Baseline 2026, Newly available" as of October 2026. Anyone on an older Firefox or Safari gets nothing from it, and a Build that relies on it would need a second driver anyway. (The [caniuse page](https://caniuse.com/?search=animation-timeline) wouldn't give me its table, so these versions come from MDN's data.)

The hand-rolled path needs only `scroll` events, `requestAnimationFrame` and `position: sticky`, so support isn't a live question.

## Bundle size

I bundled each import with esbuild (minified, production, ES2022) and compressed it with gzip level 9, so these are tree-shaken numbers rather than whole-package ones.

| Import | Minified | Gzip | Brotli |
| --- | --- | --- | --- |
| `gsap` core | 70.6 KB | 27.6 KB | 25.0 KB |
| `gsap` + `ScrollTrigger` | 114.7 KB | 45.2 KB | 40.7 KB |
| `gsap` + `ScrollTrigger` + `TextPlugin` + `DrawSVGPlugin` | 128.5 KB | 50.1 KB | 44.6 KB |
| `motion/mini` `animate` (no sequences) | 8.4 KB | 3.3 KB | 3.0 KB |
| `motion` `animate` (sequences) | 69.4 KB | 25.4 KB | 23.3 KB |
| `motion` `animate` + `scroll` | 76.2 KB | 28.1 KB | 25.6 KB |
| `motion-v` `motion` + `useScroll`, Vue external | 147.8 KB | 49.7 KB | 44.3 KB |
| `lenis` | 18.7 KB | 5.4 KB | 4.9 KB |
| Hand-rolled core + scroll binding | 0.8 KB | 0.5 KB | 0.4 KB |

Vendor numbers run a little lower than these. [Motion's docs](https://motion.dev/docs/animate) say 22 KB for hybrid and 3.2 KB for mini, and [its comparison page](https://motion.dev/docs/gsap-vs-motion) (written by Motion, and it shows) says 23 KB for GSAP. The important catch is that Motion's small build has no sequences, so the honest Motion number for a timeline is **25 KB**, roughly level with GSAP core. Motion's size advantage disappears for this job.

The hand-rolled figure is a floor. It has one ease and no colour or path helpers.

## Determinism and reversal

This is the question that matters most, so I tested it rather than trusting docs. In headless Chromium 156, each candidate built the same 10-second choreography: a cursor move, typing, a colour fill, an SVG stroke draw, and a discrete state flip. I recorded the state at 11 probe times, each from a fresh instance jumping straight there. Then I drove one instance forward, backward, and through 200 random jumps, comparing against those records for 222 checks in all.

| Candidate | Mismatches out of 222 |
| --- | --- |
| Hand-rolled | 0 |
| Motion | 0 |
| GSAP | 150, **all** on the discrete state flip; the other fields had none |

The GSAP failures have a narrow cause, which I isolated with a separate probe. A string `attr` doesn't revert when its starting value is absent or empty, whether written with `tl.set()` or with a very short `fromTo`. `data-s=""` going to `approved` stays `approved` after seeking back, while `draft` going to `approved` reverts properly, as do numeric attributes and object properties. It's easy to avoid once you know, and it's precisely the sort of trap a scrubbed timeline walks into, because a tween only snapshots its start value when it first renders. [GSAP's docs warn about this family of problem](https://gsap.com/resources/mistakes/) for `.from()` tweens. I didn't find this `attr` case documented, and I only tested 3.15.1.

Two more behaviours are worth designing around. `tl.call()` fired on a forward seek and _again_ on the way back (count went 1, then 2, with events on), and [`seek()` suppresses events by default](https://gsap.com/docs/v3/GSAP/Timeline/seek()/). So callbacks can't carry Build state, in any library. State has to come from `t`. Also, GSAP's `set()` on CSS left computed values as inline styles after reverting (`display: block`, `opacity: 1`). It looks identical, but the DOM isn't back where it started.

Motion passing needs a qualifier, because my first run failed it badly. Motion appears to resolve keyframes asynchronously (inferred from behaviour, I didn't read its source), because seeking right after creating an animation left it stuck: 192 mismatches. Once the test waited two frames after creating and after each seek, it passed cleanly. Its docs give `time` as "Gets and sets the current time", and neither [the `animate` page](https://motion.dev/docs/animate) nor [the timeline page](https://motion.dev/docs/timeline) says how seeking interacts with callbacks or backward movement. Passing my test isn't the same as being a supported use.

Hand-rolled passes by construction, as long as every clip's `apply(p)` depends only on `p`. That rule is what the whole design rests on, and it's easy to unit test by comparing DOM snapshots across seek paths.

Runtime cost doesn't separate them. With 1000 clips, the median seek was under 0.5 ms for all three, in JS only (style, layout and paint aren't included, and those dominate either way). Building 1000 `fromTo` tweens took GSAP about 390 ms against Motion's 10 ms and hand-rolled's 0.1 ms. I didn't dig into why, and 200 tweens took GSAP 42 ms, so it's unlikely to matter at the Build's size. These are single runs on one machine, so treat them as rough.

## Non-tween effects

Typing is the deciding case, because a tween library has nothing to interpolate. GSAP's [`TextPlugin`](https://gsap.com/docs/v3/Plugins/TextPlugin/) swaps text a character at a time and passed my tests, as did a tweened counter with `onUpdate` slicing a string. Motion got there with a motion value and a `change` listener, which works but which the docs don't describe for this. [Motion's `onUpdate`](https://motion.dev/docs/animate) "currently works only for single value animations".

CSS can't do it at all. It animates property values rather than DOM text, so typing would be a monospace width or clip trick, which doesn't suit real poster type. Cursors targeting measured layout positions need JS to write keyframes anyway. Add the fact that the [off-main-thread benefit](https://developer.chrome.com/docs/css-ui/scroll-driven-animations) applies to composited properties like `transform` rather than to text, and most of what makes CSS attractive doesn't reach this Build. Chrome's own [guidance](https://developer.chrome.com/docs/modern-web-guidance/guides/ui-behaviors/scrollytelling) says "ALWAYS use the native CSS implementation", which is right for decoration and wrong for this.

Hand-rolled treats these all alike:

```ts
{ start: 2, duration: 4, apply: (p) => { el.textContent = msg.slice(0, Math.round(p * msg.length)) } }
```

The same shape covers `stroke-dashoffset`, fills, and discrete flips like a comment appearing. A sound cue later becomes a list of times the playhead crosses, with direction known, which answers the map's open item about a hook for sound without reworking anything. I wouldn't mix CSS timelines in as an optimization either: two clocks are how a cursor ends up out of step with what it's editing.

## Vue

This barely discriminates. The standing decision is a framework-agnostic TypeScript engine in a thin Vue shell, so the engine shouldn't touch `motion-v` (nearly **50 KB** with Vue external, and it's built around components). Plain `gsap` and plain `motion` both work without Vue involvement, and [Vue's docs](https://vuejs.org/guide/extras/animation) use GSAP in their own watcher example.

The real rule applies to any option: Vue mounts the stage and tears the engine down in `onMounted` and `onBeforeUnmount`, and shouldn't re-render a subtree the engine is mutating. I reasoned that from how Vue patches the DOM and didn't test it.

## Smooth scroll

We don't need a smooth-scroll library, and I'd avoid one. Firefox's docs explain [why scroll-linked JS looks bad](https://firefox-source-docs.mozilla.org/performance/scroll-linked_effects.html): the visual scroll position updates on the compositor thread, so effects "lag a little bit behind", and an element repositioned to fight the scroll will jitter. Their fix is `position: sticky`, and that's the Build's layout: a tall spacer with a sticky stage.

My inference, which [#5](https://github.com/LouisLP/all-hands/issues/5) should check, is that the stage holding still means lag shows up as the playhead trailing slightly rather than as anything shaking. I haven't watched this run with real scroll input.

If scrubbing feels mechanical, damp the _playhead_ instead of the scroll: `cur += (target - cur) * k` each frame. It's what [ScrollTrigger's numeric `scrub`](https://gsap.com/docs/v3/Plugins/ScrollTrigger/) does ("take 0.5 seconds to catch up"), and it takes three lines. State still depends only on the playhead, and the page keeps its native scrollbar, keyboard scrolling and anchors, which is what the skip needs.

The alternatives bring their own problems. [Lenis](https://raw.githubusercontent.com/darkroomengineering/lenis/main/README.md) is 5.4 KB and lists a Safari 60 fps cap (30 in low power mode), trouble over iframes, and possible `position: fixed` lag on pre-M1 Safari. [ScrollSmoother](https://gsap.com/docs/v3/Plugins/ScrollSmoother/) moves the content with `matrix3d()` transforms, which breaks `position: fixed` inside it and doesn't smooth touch by default. Neither solves a problem a sticky stage has.

## What you give up

Going without a library has real costs, and this is the list to weigh:

- Eases beyond a cubic-bezier function (about 30 lines, or a tiny dependency).
- Colour interpolation. `color-mix()` or a small OKLCH lerp would do, and the Build's fills gain colour, so this needs to look good.
- A timeline authoring API with labels and relative positions. This is the largest cost, and it matters for [#3](https://github.com/LouisLP/all-hands/issues/3)'s choreography: writing many Teammates' moves as absolute times gets painful fast, so the engine needs some sequencing helper.
- Years of cross-browser bug fixes. We only write `transform`, `opacity`, text, and SVG attributes, which limits exposure, but it's still on us.
- ScrollTrigger's range recalculation on resize and its pinning. Sticky replaces pinning, and the progress calculation reads the spacer's rect each frame.

Switch to GSAP core (27.6 KB, no ScrollTrigger needed) if the sequencing helper starts growing into a worse GSAP, and avoid string `attr` sets with empty starting values when you do.

## What I couldn't verify

- Only Chromium was tested, since no Firefox or WebKit build was available. Determinism should carry over for the hand-rolled path, but I haven't shown that.
- No test used real scrolling: seeks were direct calls. Feel, wheel stepping and trackpad behaviour all belong to #5, which could still change the damping advice or overturn scrubbing itself.
- The 0.5 KB core is a test harness engine rather than the real thing.
- The GSAP licence reading is mine, not a lawyer's.
