# What makes Swarm's choreography work?

Researched 2026-11-04 for [#3](https://github.com/LouisLP/all-hands/issues/3). Everything here is my own description. Neither source has a licence, so no code or assets are reproduced.

## The short answer

Swarm is convincing because it _isn't_ an animation. It's a small simulation of people working: tasks with dependencies, cursors that claim one task each, and a fixed vocabulary of design-tool gestures. Scroll doesn't play it. Scroll only tells the crew how far down the page they're allowed to work and how much of a hurry they're in.

That's the finding that matters most for us, because **our standing decision works differently**. We scrub a deterministic timeline. Swarm has no timeline, can't run backward, and never un-builds. It gives us plenty of craft to learn from, but no evidence that scrubbing feels good. [#5](https://github.com/LouisLP/all-hands/issues/5) has to find that out alone.

## What I could and couldn't see

I can't watch the live page, so I have **not** seen Swarm in motion. Treat every claim about how it _feels_ as inference from source.

| Source | What I did | How far to trust it |
| --- | --- | --- |
| [`califa/swarm-site`](https://github.com/califa/swarm-site) at `486d72a` | Read the [minified bundle](https://github.com/califa/swarm-site/blob/486d72a/assets/index-BcWSe1v5.js). The repo holds build output only, with no original source. The live page's `index.html` names the same bundle file. | Mechanics are solid. Names are gone, so intent is my reading. |
| [`DhvanilPatel/swarm-cursors`](https://github.com/DhvanilPatel/swarm-cursors) at `18fd261` | Read the [engine](https://github.com/DhvanilPatel/swarm-cursors/blob/18fd261/swarm-rebuild/swarm.js) and [README](https://github.com/DhvanilPatel/swarm-cursors/blob/18fd261/README.md). | Readable, and closely matches the bundle, so I used it to decode the bundle. It's a derivative, and I note where it differs. |
| Extension demo video | Looked at 9 stills, one every 4 seconds, from `media/demo.mp4`. | Shows the extension rebuilding someone else's page, not Swarm itself, and stills aren't motion. |

Timings below are calculated from constants in the source, not measured. Neither project was run. Site claims come from the bundle unless linked otherwise.

## How scroll maps to progress

It's a one-way ratchet with a tachometer attached. Three things come off the scroll position:

- A high-water mark, the lowest point the viewport has ever reached. A task is available once it sits above that mark and its dependencies are done ([`available`](https://github.com/DhvanilPatel/swarm-cursors/blob/18fd261/swarm-rebuild/swarm.js#L2256)). The mark only goes up, so scrolling back changes nothing.
- A smoothed scroll speed that decays over about a second ([`step`](https://github.com/DhvanilPatel/swarm-cursors/blob/18fd261/swarm-rebuild/swarm.js#L2297)).
- A global tempo, computed from that speed plus the backlog per cursor. It runs from 2.1x to 4.5x, so even at rest everything plays at more than double the authored speed.

The work itself runs on wall-clock time. A tiny scroll starts the Build (so does poking the orbiting cursors with the pointer), a viewport's worth of work then finishes with no further input, and the crew runs out of permitted work until the Spectator scrolls again. Stop scrolling and the page _keeps building_. I think that's the core of the illusion: the work plainly doesn't depend on your finger, so it reads as other people's labour.

There's no scroll-jacking either. It's a normal tall document (4,060 design pixels on a 1280-wide canvas, scaled down to fit), with nothing pinned except the nav and no pans or zooms. Cursors and elements live in document coordinates, so a cursor scrolls away with the thing it's working on, like someone busy elsewhere on a shared canvas. Cursors working on the sticky nav switch to screen coordinates and stay with it. That's useful for our reduced-motion rule: the browser's own scroll is the only camera Swarm has, and it gets by fine.

The extension adds a useful calibration. Its [Tour mode](https://github.com/DhvanilPatel/swarm-cursors/blob/18fd261/swarm-rebuild/swarm.js#L3668) auto-scrolls at 230px/s when the backlog is low, slows to 80, and stops when the crew falls behind. So its author settled on about 230px/s as the pace a crew can hold, which puts Swarm's page (about 3,300px of actual scrolling on an 800px-tall window) near 15 seconds at the very least. In the demo stills, the on-screen counter climbs from about 33 to 277 layers in 28 seconds with 19 to 24 cursors, or 8 to 9 layers a second. It's a dense page and I read those numbers off small frames, so take the order of magnitude only.

## How the crew behaves

Crew size follows demand. The site idles at 6 cursors and caps at 48, and the target rises with scroll speed and backlog. New cursors arrive from the viewport's sides as often as every 35ms. A cursor with nothing to do for 2.5 seconds leaves, except for a core group that stays. So the page gets busier when you push it and calmer when you don't, with no authored pacing at all.

Choosing work is one rule: each free cursor [picks](https://github.com/DhvanilPatel/swarm-cursors/blob/18fd261/swarm-rebuild/swarm.js#L2272) the best available task, favouring what's visible, then what's higher up the page, then what's nearby. Tasks are claimed exclusively. Top-down order and short travel both emerge from that rule, so nobody authored the shot order.

Most of the believability in the motion comes from small things in [`moveTo`](https://github.com/DhvanilPatel/swarm-cursors/blob/18fd261/swarm-rebuild/swarm.js#L2552):

- Duration grows with the square root of distance, so long moves are only a little slower than short ones, like a real hand. Before tempo, moves run from about 0.14 to 0.9 seconds.
- Free moves arc to a random side by a small fraction of the distance. Drags run dead straight and slower, with symmetric easing. That difference alone separates "moving to" from "doing".
- Free moves have an easing discontinuity: a couple of slow frames, then a jump about 40% of the way. It might be accidental. I'd guess it reads as a flick of the wrist, but only a viewer can confirm that.
- The cursor squashes slightly on press, swaps shape per tool (arrow, crosshair, I-beam, pen, resize arrows, a doubled arrow for duplicating), and never fully rests. Idle cursors wander slowly around the middle of the viewport.

Typing is about one character per frame at the site's minimum tempo, with extra pauses at spaces, at line breaks and at random. A long paragraph takes a second or two. Nothing is slow enough to read as a demo, and with this many cursors, most actions are glimpsed rather than watched. **Volume is doing real work here**, and we won't have it.

Two more details I wouldn't have guessed. The fast-cursor variation (one in four) only applies during flocking, because every cursor at work uses the same motion model. And the site's cursors are **unlabelled**: names are assigned in the data but never rendered, and the stylesheet's label class goes unused. The extension's only use of the names is a row of small initials in its toolbar. The stills agree. Labelled Teammates are ours, untested by Swarm.

## The build primitives

All of these resolve in roughly 0.3 to 2 seconds at minimum tempo. The extension documents the same set under [How it works](https://github.com/DhvanilPatel/swarm-cursors/blob/18fd261/README.md#how-it-works).

- [Boxes](https://github.com/DhvanilPatel/swarm-cursors/blob/18fd261/swarm-rebuild/swarm.js#L2676): a crosshair drags out a neutral grey square-cornered shape with live size badge and handles, pauses, then fill, radius and stroke fade in over about 220ms.
- [Text](https://github.com/DhvanilPatel/swarm-cursors/blob/18fd261/swarm-rebuild/swarm.js#L2748): drag a text box (or click, for short labels), switch to the I-beam, type with a blinking caret.
- Headings: typed small at 18px, then stepped up through tool-style font sizes until they land.
- [Guides](https://github.com/DhvanilPatel/swarm-cursors/blob/18fd261/swarm-rebuild/swarm.js#L2872): rulers slide in only when someone needs them, a red guide is dragged out, the rulers leave shortly after, and the guide fades once its text settles.
- Snapping: guide-bound text is deliberately typed a few dozen pixels off, then dragged until it snaps with a flash. This is the best trick in the piece, in my opinion. A visible small correction says "person" louder than any amount of precision.
- [Duplicates](https://github.com/DhvanilPatel/swarm-cursors/blob/18fd261/swarm-rebuild/swarm.js#L2913): select, press, drag a copy with red spacing measurements, from whichever finished copy is closest, so repetition spreads outward. Differing copies then get a separate double-click, select-all and retype, often by a different cursor.
- Lines: pen tool, anchor by anchor, rubber-banded to the cursor. Each section begins with its full-bleed rule and side rails, so structure arrives before content. The logo gets traced and filled the same way.

Dependencies keep it coherent ([task graph](https://github.com/DhvanilPatel/swarm-cursors/blob/18fd261/swarm-rebuild/swarm.js#L1267)). Children wait for their parent box, and copies wait for their master. You never see text floating with nothing behind it.

The design-tool chrome is also temporary. Selection boxes, rulers and guides exist only while someone's using them, so a quiet page looks finished rather than mid-edit. Swarm's page itself is nearly monochrome (ink, white, one indigo accent), which leaves the cursors as the main colour on screen.

## Where it sits against our map

| Standing decision | Swarm | What it means for us |
| --- | --- | --- |
| Scroll scrubs a deterministic timeline; back un-builds | Ratchet, wall-clock time, unseeded randomness, forward-only generators | Its engine shape doesn't transfer. State has to be a pure function of progress, with variation baked at authoring time ([#7](https://github.com/LouisLP/all-hands/issues/7), [#2](https://github.com/LouisLP/all-hands/issues/2)). |
| 4 to 5 Teammates | 6 to 48 anonymous cursors | Fewer cursors can't hide behind mass. Fewer elements, slower tempo and more legible individual actions. At 8 to 9 layers a second over 20-odd cursors, 5 Teammates manage perhaps 2. |
| First viewport shows name and role | Blank except a logo with orbiting cursors, until the first scroll | We can't use this opening, and we need our own. |
| Finished page is real semantic HTML; no JS lands on it | Empty root without JS; absolute-positioned divs and SVG paths on a fixed canvas; nothing links | Swarm dodged our hardest constraint, so it offers no model for it. |
| Reduced motion, skip | Neither appears in the source | No model here either. |
| Phones get a simplified Build | Same 1280 canvas scaled down | No model. It'd be tiny. |
| No copy explaining the simulation | The closing section states outright that cursors placed everything, with a live agent count | Don't borrow that. |
| Delegator briefs, approves, rejects | No hierarchy, no story, no mistakes beyond the snap offsets | This is our real differentiator. |

The scrub tension is the one to take into [#5](https://github.com/LouisLP/all-hands/issues/5). Scrubbing freezes the page when the Spectator stops, which removes the "they keep working without me" feeling I think Swarm depends on. My suggestion is to test a second, purely cosmetic layer driven by time rather than scroll: cursors idling, carets blinking, small drift. It holds no page state, so it can't break determinism. If it doesn't rescue the feel, the ratchet is the alternative worth comparing, which would reopen a standing decision. That's Louis's call, not this ticket's.

For the sound hook still open on the map, the extension routes everything through discrete events carrying plain numbers (position, size, kind), so a log can be replayed. Under scrubbing, the equivalent is firing events when progress crosses them going forward.

## Too distinctive to borrow

This is a judgement about taste and credit, not legal advice. The extension's own [credit section](https://github.com/DhvanilPatel/swarm-cursors/blob/18fd261/README.md#credit) names the motion design as Califa's and says large parts of its engine are adapted from his site, so **neither repo is a clean source**. Its author also asks people to check with Califa before reusing the code.

Off limits outright: all code from both repos, the cursor artwork, the logo, the mock product's copy, the colour rotation, and the list of computing pioneers' names.

Signature moves to stay away from:

- The opening: a blank canvas with cursors orbiting a logo, then fanning out. Our first-viewport rule already bars it.
- The crowd that grows with scroll speed, pouring in from the edges. It's the most "Swarm" idea in Swarm, and it contradicts a small fixed Team.
- The finale: cursors flocking in a lobed orbit around the pointer, swirl periodically reversing, bouncing off it. A small dodge by a working Teammate (still open on the map) is a different idea, and that's fine.
- The closing tally of how many agents built the page while you scrolled.
- Typing a heading tiny, then ticking it up through font sizes. A Designer dragging a corner after a Delegator's Brief ("bigger") would carry the same payoff in our own terms, and it suits poster type.
- The offset, drag-to-new-guide, flash-on-snap sequence as a recurring set piece. Guides themselves are fine. The _idea_ of a visible small correction is the lesson to keep, and our rejections are a better way to express it.
- A mock AI-orchestration product building itself as the punchline.
- From the extension: wiping any live page, and its [sound design](https://github.com/DhvanilPatel/swarm-cursors/blob/18fd261/README.md#how-it-works) of glass-piano pentatonic notes mapped to size and position. Worth remembering when sound comes back.

Free to use, because they belong to Figma and multiplayer tools generally: crosshair drags with size badges, selection handles, grey placeholders that take on a style, caret typing, tool-specific cursor shapes, option-drag duplication, red spacing measurements, pen anchors, rulers, and dependency-ordered tasks.

One caution on that list. Use all of it at the same speed on a near-monochrome canvas, and it'll read as a Swarm clone even with entirely original code. Our distance has to come from the Delegator's story, the colour arc and the poster type.

## Still uncertain

- Whether Swarm actually feels as good as the mechanics suggest. Anyone with a browser can settle this in a minute, and I couldn't.
- How long a full Build takes. The 15 seconds is a floor from the extension's Tour speed, not a measurement of the site.
- Whether the movement discontinuity is deliberate, or even visible.
- What happens on a fast flick to the bottom. By the code, the Spectator sees empty page while cursors work from the top of what's visible, but I can't say how that plays.
