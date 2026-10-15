# Switch: build brief

A third, separate portfolio at `switch/`, served at `/switch/`. Nothing in `hero/` or `retro/` is edited.
Copy and media come read-only from `hero/src/content` (via `src/content.ts`) and `hero/public/media`
(served at `<base>media/`). Research teardowns of the three reference sites live in `../.research/`:
`auge.md` (transitions, details page), `neutomni.md` (SVG motion, the "retro switch", selected works),
`bybang.md` (cursor and hover). Read the sections relevant to your slice before you build.

## Concept

**Switch.** By default the site is a quiet, precise modern editorial portfolio: warm paper, ink, one
cobalt accent. Every state change is a mask, never a fade. In the header sits a physical toggle labelled
`NOW / 1998`. Flip it and the whole live site collapses (scale to 0.45 from the bottom-left) into a
window titled `ashutosh-rana.html` sitting on **ASH/OS 98**, a cobalt desktop where the same work opens
as draggable windows. Flip it back and the window zooms to full screen again. The joke lands because
the modern site was "running inside" the old machine the whole time. The two modes share ink, cobalt and
content, so it reads as one website with two speeds, not two websites.

Coherence rules:
- One accent (cobalt `--cobalt`). One ease pair (expoOut to settle, expoInOut to travel). Four durations
  (0.35, 0.5, 0.9, 1.2s). Text rises out of masks or scrambles. Media wipes open. Nothing fades in place
  except the dim layer under the curtain.
- Three voices in modern mode: Instrument Sans (UI and display, tight tracking), Instrument Serif italic
  (`<em>`, the human voice inside headlines, one or two words per heading), JetBrains Mono uppercase
  (`.label`, metadata, counters). OS mode adds Pixelify Sans for window chrome only.
- No page is long. Budgets at 1440x900: home at most 5 viewport heights including the pinned works
  scroll, case pages at most 6, about at most 4, work index and playground at most 3, contact exactly 1. Cut copy before adding sections.

## Information architecture

**This is a multi-page website.** Every nav item is its own route with its own pre-rendered HTML file,
reached through the curtain transition. Never link a nav item to a `#section` on the home page.

| Route | Owner | Content |
|---|---|---|
| `/switch/` | B | Hero (giant wordmark, intro, clock, availability). Selected work (pinned clip-path stack, 5 case projects). A short "All work" link row into `/work/`. Footer. At most 5 viewport heights. |
| `/switch/work/` | E | The full index of all projects: bybang dimming rows with a following cover image, filter by kind, evidence tags. At most 3 viewport heights. |
| `/switch/work/:slug/` | C | Case page for any project, the auge details page structure, condensed. Next project at the end. |
| `/switch/about/` | C | Short bio, how I work (rolling polygon), experience, facts. |
| `/switch/playground/` | E | bybang home, closely: an infinite-scrolling mosaic of PLAY items on a 16-column grid (scroll wraps forever, both directions), the rect cursor, a near-full-page modal on click with the media fitted (contain) on the left and the piece's info on the right. No footer (infinite). Exempt from the height budget. |
| `/switch/contact/` | B | One viewport: the big morph CTA, email with copy, availability, socials, clock. No footer on this page. |
| 404 | B | One line and a link home. |

Nav (header): Work `work/`, Playground `playground/`, About `about/`, Contact `contact/`. The footer on
every other page is compact (one short band) and links to `contact/`.
| OS mode | Desktop icons: `Work` folder, one icon per case project, `About.txt`, `Contact.exe`, `Playground` folder, `Recycle Bin`. Start menu, taskbar, clock. |

Projects: `PROJECTS` from content. `tier: "case"` are the deep ones; the first 5 by array order are the
Selected work stack. Every project has a case route.

## Tokens and CSS rules

All tokens are in `src/styles/tokens.css`. Use variables only; never a raw hex or a new duration in a
page stylesheet. Base utilities in `src/styles/base.css`: `.label`, `.mask > .mask__in`, `.plx > .plx__in`,
`.page-x`, `.sr-only`. 12-column grid, gutter `--gutter`, gap `--gap`, column width `--col`.
Mobile breakpoint 767px (4 columns), tablet 1023px.

Each agent owns its own stylesheet(s); class names are BEM-ish and prefixed by the owner's block
(`.hero__`, `.works__`, `.case__`, `.os-`, `.cursor`, `.curtain`), so files never collide.

## Shared modules (written by the orchestrator, do not rewrite; propose changes in your report)

- `core/motion.ts`: GSAP with every plugin registered (ScrollTrigger, SplitText, ScrambleText, MorphSVG,
  Draggable, CustomEase). Eases `expoOut`, `expoInOut`, `settleOut`. `DUR`, `d()` (zero under reduced
  motion), `reducedMotion()`, `finePointer()`, `setPhase/getPhase/whenIdle` (page transition state),
  `getMode()`. Import gsap from here, not from "gsap", so plugins are always registered.
- `core/bus.ts`: typed events. `route:enter`, `route:leave`, `transition:phase`, `intro:done`,
  `mode:change`, `cursor:refresh`. Add an event only by telling the orchestrator.
- `core/router.ts`: client routing. `navigate(url, {thumb?, quick?})`, `setTransition(t)`, `afterMount`.
  Clicking any internal `<a>` navigates; the element marked `data-flip` inside the link is passed to the
  transition as `thumb`. `data-native` on a link opts out.
- `core/scroll.ts`: Lenis (lerp 0.08) wired to ScrollTrigger. `scrollToTarget`, `stopScroll`, `startScroll`.
- `lib/reveal.ts`: the reveal vocabulary. Write `data-reveal="rise|lines|up|scramble|media"`,
  `data-parallax`, `data-delay`, `data-reveal-now` in templates and call `mountReveals(root)` in the view.
  Reveals wait for the transition to be idle.
- `lib/html.ts`: `esc`, `mediaUrl`, `mediaTag` (image or muted looping video sized from media.json),
  `pad2`. Videos carry `data-autoplay` and are played by `core/ambient.ts` only while on screen.
- `templates/routes.ts`: routes, `label(route)` (curtain title), `render`, `prerender`.

Pages are strings rendered by templates (also pre-rendered at build), then a view's `mount(root)` wires
behaviour and returns a cleanup that kills every listener, observer, ticker and tween it made.

## Contracts between slices

### Cursor (owned by Agent A, used by everyone)
Desktop fine pointer only; touch keeps the native cursor. The cursor resolves its state from the element
under the pointer:
- `a`, `button`, `[data-cursor="link"]`: the rect takeover (bybang). Cursor leaves the mouse and morphs
  into the element's exact rect, white with `mix-blend-mode: difference`, overshoot ease.
- `[data-cursor="media"]` with optional `data-cursor-label="Open case"`: 16px circle with a word-masked
  label above it. Use on project images.
- `[data-cursor="drag"]`, `[data-cursor-label]`: small circle with label (works stack, OS title bars).
- Text (`p`, `h1`-`h4`, `li`, `dd` not inside a link): 3x26 I-beam.
- `[data-cursor="hide"]`: hidden (canvases that draw their own pointer).
- Under `html[data-mode="os"]` the cursor becomes a pixel arrow (and a pixel hand over links, an
  hourglass while `html[data-busy]` is set). No rect takeover in OS mode.
Anyone who swaps DOM under a still pointer emits `cursor:refresh`.

### Page transition (owned by Agent A)
`initTransition()` calls `setTransition({cover, reveal})`. Cover: cobalt curtain with a domed top edge
rises (0.9s expoInOut) while the old page shifts up 40px under a 40% dim; a title card shows
`req.title` scrambling in, mixing Instrument Sans 600 and Instrument Serif italic per character, with a
000 to 100 mono counter; if `req.thumb` exists it is cloned and FLIPped onto a slot above the title
(expoOut). Reveal: hold about 0.4s, then curtain, title and counter exit upward and the new page slides
up from +40px. Target click to interactive: about 2.4s with a thumb, 1.6s without, 0.9s for `quick`
(back/forward: no title hold, no thumb). Never a hard cut.

### Retro switch and OS (owned by Agent D)
`templates/switch.ts` exports `switchControl()` markup; Agent A places it in the header. `initOS()`
wires it. The mode lives on `html[data-mode]` and in `localStorage["switch:mode"]`; `index.html` sets
`html[data-boot="os"]` before paint when the stored mode is os, and the OS layer must boot straight into
the desktop then (no animation). `mode:change` is emitted on every flip. `#os` is the desktop layer
(behind), `#frame` is the live site that becomes the window, `#overlay` is free for fixed layers that
must sit above everything (curtain, cursor, OS windows dragged over the frame).

## File ownership

| Agent | Owns |
|---|---|
| A: chrome and motion | `core/cursor.ts`, `core/transition.ts`, `core/loader.ts`, `core/chrome.ts`, `templates/chrome.ts`, `styles/chrome.css`, `styles/cursor.css`, `styles/transition.css`, `styles/loader.css` |
| B: home, footer, contact | `templates/home.ts`, `templates/footer.ts`, `templates/contact.ts`, `views/home.ts`, `views/contact.ts`, `views/notfound.ts`, `sections/*` except `sections/polygon.ts`, `styles/home.css`, `styles/footer.css`, `styles/contact.css` |
| C: case and about | `templates/case.ts`, `templates/about.ts`, `views/case.ts`, `views/about.ts`, `sections/polygon.ts`, `styles/case.css`, `styles/about.css` |
| D: switch and OS | `templates/switch.ts`, `os/*`, `styles/switch.css`, `styles/os.css` |
| E: work index and playground | `templates/work.ts`, `templates/playground.ts`, `views/work.ts`, `views/playground.ts`, `styles/work.css`, `styles/playground.css` |
| G: Night Drive game | `game/*` (entry `mountGame(container, opts)` in `game/index.ts`), `styles/game.css`. Lives in OS mode as `NightDrive.exe`; D adds the icon and window that hosts it. |
| Orchestrator | everything else (`main.ts`, `core/motion|bus|router|scroll|ambient`, `lib/*`, `templates/routes.ts`, tokens, base, `index.html`, `vite.config.ts`) |

Edit only files you own. If you need a change in a shared file, say exactly what and why in your report.

## Engineering rules

- TypeScript strict; `npx tsc --noEmit` must pass for your files. Other agents are editing in parallel,
  so ignore errors in files you do not own.
- No `as any`, no `@ts-ignore`, no eslint-disable, no empty catch.
- Never use em dashes or en dashes anywhere (copy, comments, docs). Use commas, colons, periods.
- Comments: short JSDoc on exported functions and on non-obvious mechanics, matching the existing files.
- Copy: reuse content fields. New microcopy is short, plain, first person, no marketing register.
- Every animation respects `reducedMotion()` (use `d()`), every pointer effect is gated on
  `finePointer()`, and every view cleanup kills what it made (navigate home, to a case and back
  three times without leaks or duplicated tickers).
- States and edges: long project names, projects with 1 shot or no `decision`, videos vs images, slow
  media, 375px phones, 1023px tablets, 1920px wide screens, keyboard focus order, `prefers-reduced-motion`.
- Semantics: one `h1` per page, landmarks, alt text from content, buttons for actions, links for routes.

## Visual verification (required, continuous)

The dev server runs at `http://localhost:5176/switch/` (HMR on). Do not start another one on that port.
Check your work visually while you build, not only at the end:
- Make a scratch dir `C:/Users/ashut/AppData/Local/Temp/switch-<agent>/` with `npm i playwright@1.64.1`
  (Chromium is installed) and write small Node scripts that load your page at 1440x900 and 390x844,
  scroll to your section, hover, click, and save screenshots to `D:/Coding/ash-portfolio/.research/shots/<agent>/`.
  Do not use the shared Playwright MCP browser (other agents use it).
- Look at the screenshots with the Read tool, judge them as a demanding designer (alignment to the grid,
  optical spacing, type hierarchy, contrast, whether the motion frame mid-transition looks intentional),
  and fix what you see. Capture at least one mid-animation frame for every motion you build.
- Log console errors and failed network requests in every script and fix any that come from your files.

## Report

When done, return: what you built (by file), every state and edge from the rules above and what happened
to each, screenshots paths you looked at, anything left unfinished, and any change you need in a file you
do not own.
