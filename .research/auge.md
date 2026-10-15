# auge-xp.com motion teardown (works/don-molinico, home, /works)

Method: Playwright 1.64.1 + Chromium at 1440x900, rAF samplers (curtain/overlay/hero transforms), video frames, and a read of the Next.js (Turbopack) bundles. All numbers below come from the shipped JS unless marked "measured". Credits (console signature): Manuel Mancini (Tech Director), Fabio Minerva (Design Director). Awwwards SOTD for Don Molinico (Apr 25 2026) with Developer Award. CMS: Prismic.

## 1. Summary of the feel

It feels expensive because nothing is ever just "fading". Every state change is a mask: clip-path insets, overflow-hidden line masks, a curved color curtain, scaleY reveals. Everything uses one family of ease-out-expo curves (`0.19,1,.22,1`) so motion snaps fast and then settles for a long time, and one ease-in-out-expo (`.83,0,.17,1`) for travel. Text never fades: it rises 130% out of a mask, or scrambles into place per character in a mixed bold-sans / italic-serif font pair. Page changes are a branded title card (pale yellow curtain, project thumbnail, scrambled title, 000-100 counter) rather than a crossfade, and the old page physically slides 40px up under a 40% dim while the curtain rises. A WebGL post layer adds a pointer lens and a click shockwave. Sound design is wired into the same events. It works because of consistency: one ease pair, one mask vocabulary (130% overshoot), one rhythm (0.5s/0.9s/1.2s), and all motion gated by a single `transitionPhase` state machine so hover effects never fight transitions.

## 2. Page transition (home card -> /works/slug), desktop >= 1024px, fine pointer

State machine (`69885`): `idle -> covering -> revealing -> idle`, 12s safety timeout back to idle. While not idle, hover effects, parallax triggers and carousel ticking are suspended (`areHoverEffectsSuspended`, `isPageCovered`).

Layers (z-index): page content, curtain `z-55` (`fixed inset-0`, bg `--color-accent #fdf48b`), shared-element overlay `z-59` (the thumbnail clone, above the curtain), cursor `z-100`.

Timeline (t = 0 at pointerup; click counts only if pointer moved < 6px):

| t | event |
|---|---|
| 0 | `clickProject` sound. Source card cursor label cleared. `runSurfacePulse(x,y)`: WebGL ripple from cursor, 0.9s, ring radius `80 + 400*(1-(1-p)^3)`, band width 0.32*radius, amplitude `45px * pow(1-p,2)`. Navigation is deferred 0.55s (`delayedCall`). Without WebGL it fires immediately. |
| 0.55 | `trigger()` stores card rect, media rect, hover-zoom scale (1.04 if hovered), parallax Y. Overlay `<div fixed z-59 overflow-hidden>` with `<img>` is placed exactly over the card (FLIP start). Source media set `visibility:hidden` once the overlay image is decoded (max 120ms wait). `curtain.cover()` starts. `raiseCurtain` sound (+0.12s). |
| 0.55 to 1.45 | Curtain root goes from `yPercent:100, y:40` (below the fold, 940px at 900 high) to `0,0`: **0.9s expoInOut**. Its top edge is an arc: inner bg div has `top:-40px; bottom:-40px; left/right:-50%; border-radius: 50% / 299px` (299 = round(40/(1-sqrt(.75)))), so the leading edge is a convex dome 40px tall and 200% wide. |
| same | Current page content (`[data-page-content]`, `[data-exit-shift]`) tweens `y: -40px` (`--content-shift-distance`) **0.9s expoInOut**, parallax under the curtain. A `[data-page-content-dim]` overlay goes 0 to 0.4 opacity (0.9s; ease `"none"` for the shared-element variant, expoInOut otherwise). |
| same | Overlay thumbnail FLIPs from card rect to the curtain's media slot (`[data-curtain-media-slot]`: width `innerWidth*2/12` = 240px, height width/1.6 = 150px, margin 40px above the title). **2.05s expoOut** (TITLE_REVEAL_END 1.55 + 0.5). Inner img animates from its oversized parallax box (top offset `-5%` of height, height 110%) to `top/left 0`, `y:0`, `scale:1`. Because it is expoOut, 90% of the move is done in the first ~0.7s (measured: 703,0,417x469 at 0.76s to 600,189,240x150 by ~2.3s). On complete the slot's own img is made visible and the overlay img hidden (seamless swap). |
| 0.55 + 0.55 = 1.1 | Title lines start: each line's inner span `yPercent 130 -> 0`, **duration K = max(1 - 0.15*(lines-1), 0) = 1.0s, expoOut**, per-line stagger 0.15s. Lines live in `clip-path: inset(0.25em -9999px 0.25em -9999px)` boxes. Font size `max(36px, 5.729vw)`, `leading 0.86`, uppercase, centered, scaled down to fit 90vw. |
| same | Per-character scramble (custom GSAP plugin `typeScramble`, ease none): char tween duration `K/3`, chars staggered across K in a random order; unrevealed chars show random glyphs from a pool of the 6 nearest-width letters (so line width does not jitter). Each char is randomly Greed Bold (sans) or Farnham Display italic (serif), 1/3 vs 2/3, never 3 in a row of the same face; spans get fixed pixel width to prevent reflow. Scramble blip sound throttled to 200ms. |
| same | Counter (`TransitionCounter`, bottom center, `text-content-xs`, uppercase, 3 digits): wrapper rises `yPercent 130 -> 0` expoOut, number tweens 0 to 100 over **1.2s linear**, `padStart(3,"0")`. |
| 1.45 | `onCovered` -> `router.push('/works/slug')`. |
| 2.1 | `onRevealed` (title done). Provider waits for BOTH `revealed` and `contentReady` (pathname === href), then holds **1.0s** (TITLE_HOLD_DURATION). |
| ~3.1 | `curtain.release({curtainDelay:0.2})`. `markReady()` fires so the new page can start its intro. |
| 3.1 to 4.2 | Curtain goes `yPercent -100, y -40` (**0.9s expoInOut**, after 0.2s delay in shared-element case). Media slot, title lines, counter: `yPercent -130`, **0.7s expoInOut, stagger 0.1s** (they exit upward faster than the curtain). New page content tweens `y: 40 -> 0` **0.9s expoInOut** (it entered pre-offset by +40, mirror of the exit). `willChange` is set only during the tween. On complete: phase `idle`, `markTransitionComplete()` unlocks scroll reveals. |

Minimum click-to-interactive on a fast network is about 4.2s. This is deliberate: the title card is the content. Measured in headless on slow route fetch the hold simply extends until the route is ready.

Plain nav links (menu, footer, accent buttons, award rows, mobile) use `navigate(href,{title})`: same curtain, no thumbnail, no shared element. Title comes from a Prismic `pageTitles` map or the link label.

First load of any URL: same curtain machinery, but the loader variant is a cream page showing `AUGE` (Greed, bold) plus italic serif subline scrambling ("Experience"), counter, then a black arc curtain sweeps in and lifts to reveal the home carousel mid-spin (see 4).

**Going back:** browser back/popstate runs NO curtain. Measured: curtain stays parked at translateY -940px, pathname and title swap within ~300ms (hard cut, scroll reset to 0). Only app-initiated navigations get the ceremony.

Scroll reset: `enforceScrollTop()` sets `history.scrollRestoration="manual"`, clears ScrollTrigger scroll memory, forces `scrollTo(0,0)` for 500ms via rAF until the user wheels/touches.

## 3. Details page (/works/don-molinico)

Structure (document height ~7200px at 1440x900, content wrapper `relative min-h-dvh bg-background` over a fixed hero):

1. **Fixed hero media layer** (`#work-hero-slot`, portal-moved out of the page flow, `fixed`): looping muted video, poster `<img>` underneath fades out when the video has `loadeddata` (`opacity 0 -> 1, 0.8s expoOut`). Media is oversized 10% each side (`top:-10%vh; left:-10%vw; w:120%; h:120%`). A black overlay sits above it. Spacer `h-dvh` pushes real content below the fold, so the content slides up over a pinned image.
2. **Hero title** (Greed Bold, uppercase, `leading 0.85`, `font-size clamp(64px, 10vw+100px, 12.5vw)` = 180px at 1440, `text-wrap:balance`, centered, `mix-blend-mode:difference; color:white`): `position:sticky; top:20px`, `py 60px`. Category label under it (`text-content-xs` uppercase, 12px at 1440).
3. **Info band**: 12-col grid, gutter `max(20px,2.083vw)`, gap `max(10px,1.04vw)`. Cols 2-3: year (13-18px) + accent pill "View project" (bg #fdf48b, radius 3px, `px 24px py 8px`). Cols 4-5: "Techs" label (xs, uppercase, scrambles in) + list (13px, `overflow-hidden` rows). Cols 7-11: awards table; each row `grid-cols-5`, 1px bottom border in foreground, text scrambles. Rows: year / name / category.
4. **Description**: label (xs uppercase scramble) + `text-content-lg` (51px at 1440, leading 1.0) rich text in cols 2-11, split by lines.
5. **Media modules** (CMS slice zone): full-bleed `bgColor` panels (e.g. red #a51f22, orange), 160px vertical padding, media in cols 3-10 (8 of 12), caption label in cols 4-5 and body text (13px) in cols 6-9, `mt-10`. Video modules use a lightbox (below).
6. **Next project**: label "NEXT PROJECT" cols 3-4 right-aligned, 16:9 thumbnail cols 5-8, Greed Bold title cols 9-10 (`text-content-md` 28px, uppercase) + category. Padding `py 160px`.
7. Fixed chrome: logo top-right, round-corner menu pill bottom-right (60x40, 3px radius, expands to a menu panel), legal footer bottom-left and social links bottom-right (`mix-blend-difference`).

### Animations, in order

**Hero intro (WorkEntrySequence)** after `ready` (i.e. when the curtain starts lifting):
- Wheel, touchmove and nav keys are `preventDefault`-ed for the duration.
- Page auto-scrolls itself: `gsap.to({y:0},{y: heroIntroScroll(), duration:1.3, ease:"expoOut", onUpdate: scrollTo})`. `heroIntroScroll` = height of title block + category + gutter (measured 440px at 1440x900; fallback `innerHeight/2`). This is what makes the hero image shrink away and the title land in the lower half with no user input.
- Title lines: after `0.39s` (+0.2 if arriving through a curtain release), each `[data-hero-title-inner]` goes `yPercent 130 -> 0`, **0.38s expoOut, stagger 0.18s**, from `visibility:hidden` initial state. Then the category scrambles in, 0.38s ease none, delayed by `0.18*lines`.
- Hero media scale: `ScrollTrigger {start:0, end: innerHeight, scrub:true}`: `scale = lerp(1, 0.8333, p)`, black overlay `autoAlpha = 0.2*p`. Measured: scale 0.9185 at scrollY 440. `will-change` toggled by `onToggle`.
- Title shrink: `ScrollTrigger {trigger: spacer, start:"top top+=20", end:"+=0.3*innerHeight", scrub:true}` interpolates `fontSize` from 180px to `--text-content-md` (28px), `y` to the pinned top bar position, category margin 20 -> tiny. A second fixed copy of the title ("top bar", `top:20px`, `py 20`) slides in with `y: 0 -> -barHeight` scrubbed over `0 ... heroIntroScroll`, so the big title and the compact title hand off.

**Scroll reveals** (all gated on `transitionComplete`, so nothing plays under the curtain; IntersectionObserver with `rootMargin: 0 0 -8% 0`, threshold 0, one-shot; elements already in the viewport on mount reveal immediately):
- `useLineReveal`: GSAP `SplitText.create(el,{type:"lines", mask:"lines", aria:"none"})`; lines `yPercent 130` initially; masks get `overflow-clip-margin:0.35em` so descenders are not cut. Reveal: `yPercent 0`, **0.8s expoOut, stagger 0.08**. Used for description, mini-module text.
- `useParagraphReveal`: each `[data-paragraph-inner]` inside an `overflow-hidden` parent starts at `yPercent 130`; reveals **0.8s expoOut stagger 0.12** (next-project uses 0.5s, stagger 0.14, delay 0.14) AND scrambles its text for the same duration, height locked during scramble to avoid reflow.
- `useScrambleTitle` (every small uppercase label): placeholder text is a scrambled version of the real label (width-matched glyph pool) so layout is stable; on reveal `typeScramble` for `duration` (default 1s) ease none. After reveal, a global idle loop re-scrambles 1-3 random letters per label every ~1.5s (words) or whole labels every 8s (hover capable only), 0.5s each. This gives the page a "alive" shimmer.
- `useItemsReveal` (award rows): initial `opacity:0, y:24`; reveal `opacity 1, y 0`, **0.6s expoOut, stagger 0.08**.
- `MediaMaskReveal` (every image/video module): wrapper clip-path starts `inset(0 0 0 100%)` for even groups and `inset(0 100% 0 0)` for odd groups (alternating wipe direction); inner media `scale:1.2`. Reveal timeline: clip-path to `inset(0)` and media scale to 1, both **1.2s expoOut**, played only after the media is loaded (max 3s shared deadline per group). `clearProps` afterwards. On a plain `<img>` this reads as a curtain wipe plus slow zoom-out.

**Image parallax** (`MediaParallax`): inner box is `top:-5%; height:110%`; one `ScrollTrigger {trigger, start:"top bottom", end:"bottom top", scrub:true}`; `yPercent = lerp(-4.545, +4.545, p)` (4.545% of 110% = 5% of the frame). Disabled while the page is covered. Reduced motion skips it.

**Hover on media**: `scale 1.04, 0.6s, expoOut, overwrite:auto`; out is the same to scale 1. Cursor morphs to an accent pill labelled "Play" / "View project" (see cursor). Hover suspended during transitions.

**Video lightbox** (reel and some modules): click -> full-screen black layer `fixed inset-0 z-50` fades in `opacity 0 -> 1, 0.5s expoInOut`; wheel/touch/keys locked; video preloaded; once covered AND `loadeddata` (7s timeout), a black inner layer fades out `0.45s expoOut`, video plays, cursor label "Close", control bar (play/pause, scrub bar 4px high rounded, accent progress, `m:ss / m:ss`) hides after 5s idle with `yPercent 100, opacity 0, 0.4s expoOut`. Close: black layer in `0.45s expoInOut`, then lightbox out `0.5s expoInOut`.

**Award row hover** (`AwardRowLink`): two absolutely-positioned masks (`bg-white` + a `mix-blend-difference` copy), `yPercent 100 -> 0`, **0.5s expoOut**, entering from the edge nearest the pointer (top half enters from top: -100, bottom half from +100) and exiting toward the pointer's exit side. Row text scrambles with 0.04s per-cell stagger. Reads as an inverted bar sweeping through the row.

**Accent button hover** (`AccentLink`): label scramble (0.12s delay, 0.6s) plus hover sound. Info-section buttons (footer CTAs) use two clip-path masks `inset(0 0 0 100%)` <-> `inset(0)` at **0.35s expoInOut**.

**Next-project footer**: thumbnail is a 16:9 `MediaParallax` inside `MediaMaskReveal`. Hover: scale 1.04, title paragraphs scramble (lock:false), cursor label "View project". Click: `runSurfacePulse` then `trigger()` exactly like the home card but passing `mediaParallaxY` (current transform Y of the parallax box) and `mediaScale`, so the FLIP starts from the true visual state. The curtain then runs the full sequence in section 2; arrival runs the hero intro.

**Cursor** (`84898`, `pointer: fine` only, `z-100`, `mix-blend-mode:difference`): default is an 11px accent diamond (square rotated 45deg), centered via `xPercent/yPercent -50`. Position uses `gsap.quickTo(x|y, {duration:0.35, ease:"expoOut"})`. A tilt reacts to vertical mouse speed: `v = 0.5*v + 0.5*dy/dt`, `rotation = clamp(-6,6,-10*v)` springing back `0.6s expoOut`. Over links/buttons it grows. When a view sets a label ("Play", "Close", "View project") the diamond morphs into an accent pill: width/height tween **0.4s expoOut**, offset `x:20,y:28`, text scrambles in with a clip-path inset reveal (open 0.5s expoOut, close 0.35s expoOut). Label change while visible: wipe out 0.15s, swap, wipe in 0.25s. Collapse back to the diamond: size 11px `0.3s expoOut` (delay 0.1), rotation 45deg `0.22s expoInOut`.

**Smooth scroll**: custom `SmoothWheelScroll`, NOT Lenis. Wheel events are `preventDefault`-ed; a target scroll accumulates deltas (LINE mode x 16.67px, PAGE mode x innerHeight); a gsap ticker eases real `scrollTo` toward the target with `y += (target - y) * (1 - exp(-0.08 * deltaRatio(60)))` (about 7.7% per frame at 60fps), snapping when within 0.5px; `ScrollTrigger.update()` after every write. If the user scrolls natively (scrollY drifts more than 1px from what we set) the loop aborts. Arrow keys 40px, Page keys 87.5% of viewport, Home/End. Honors `data-native-scroll`, scrollable inner elements, and reduced motion.

## 4. Home (/) and list (/works)

**Home**: split screen, top 60% a horizontal infinite carousel, bottom 40% the wordmark `AUGE` (Greed Bold, fit-to-width, `leading 0.75`, each letter wrapped for "letter push") plus intro copy and the menu pill. `html/body overflow hidden`. No native scroll at all.
- Cards: 7 projects tripled to fill; card width = `viewport/3.45` (417px). Heights follow a **staircase profile by position**: `heightPct = lerp over [60,70,80,90,100]` indexed by (x/cardWidth) from -1 to 3, so cards shrink toward the left edge; image box is `-inset-x-[15%]` wider than the card and shifts in x by `0.2*0.15*cardW*(1-2*t)` for a lateral parallax. Measured heights at 1440: 324, 338, 392, 446, 500, 540px.
- Input: wheel (own gesture classifier, 500ms gesture gap, delta 22px per line), drag with pointer capture (move >6px = drag, else click). Wheel: target-lerp `1-0.85^deltaRatio(60)` (15% per frame). Release: momentum `clamp(-4w,4w, 260*velocity)`, snaps to the nearest card on touch/no-hover, free-spin on desktop; settle tween duration `clamp(0.9,1.8, 0.9+0.0009*dist)` **expoOut**. Idle auto-drift on desktop: velocity eases to 200px/s (`1-0.95^dr` per frame), stops on hover.
- Step sound: 6-note sequence per card crossing; hover sound randomly picks from 4 files avoiding repeats.
- Hover card: image scale 1.04 (0.6s expoOut); cursor pill "View project"; title (Greed uppercase `text-content-md`, `leading 0.85`) and category slide up from `overflow-hidden` masks below the card, **0.34s expoOut** with scramble, line stagger 0.07s (0.5s/0.14s on touch); on leave 0.22s expoOut. Neighbors are not dimmed; only one hovered card is "active".
- Entry: on `ready`, carousel starts with a high velocity (`200 + dist/0.333` px/s) decaying exponentially, so it visibly decelerates into rest as the curtain lifts.
- Wordmark letters: mouse proximity push. For each letter, `target = strength * 0.5*(1+cos(PI*d/R)) * (dx/d)` where `R = 2.4*avgLetterWidth`; letters ease with `1-0.86^deltaRatio(60)`; ticker runs only while any letter is displaced. Entry: letters mask-reveal `yPercent 130 -> 0` 0.8s expoOut (delay 0.25 to 0.4).
- WebGL "surface" pass (desktop, fine pointer, no reduced motion, `webgl2`): the DOM is rasterized into textures (text drawn to canvas, images/videos as textures) and drawn through a fullscreen shader with: pointer lens `source = p - delta*spot*0.14` with `spot = exp(-(d/520)^2 * 2)`, content-velocity "bow" `curve = 60 * velocityFactor` (edge band 90px, power 1, sine across the axis) so the whole page bends with scroll/drag speed, and the click ripple ring. Falls back to plain DOM after 2 context losses or sessionStorage retreat count >= 2. Treat as optional polish.

**/works list**: viewport-locked vertical wheel list. Step height = `innerHeight/12`. Rows: index `(001)` in xs right-aligned to the center image, title (Greed, 60px scaled by width/1920), thumbnail at far left (small). Rows lie on a bowed path: index and title x-offsets and thumbnail width interpolate by distance from center (`[0.35,0.15,0.06,0.02,0]` weights per step). The active row's media is a 5-col, 1.6:1 image (`5*colW+4*gap` wide, centered) revealed with `scaleY 0 -> 1` from `transform-origin: bottom` while its inner img counter-scales `1/scaleY` and zooms `1.2 -> 1`, black overlay 0.3 -> 0 (ease `settleOut` = `0.5,1,.89,1`). Sound sequence per step. Click -> same shared-element + curtain path.

**Menu**: pill 60x40 (3px radius) bottom-right expands to menu panel (radius 10px) with `expoOut`: width/height tween `max(0.6, total)`, items slide `x:40 -> 0` **0.65s expoOut stagger 0.025** after 0.15s, closing reverses at timeScale 1.7. Items: 38px, active item marked by an accent clip-path highlight that FLIPs between items (`inset(0 100% 0 0)` <-> `inset(0)`, 0.4s expoInOut / 0.5s expoOut) and per-item text recolors via `background-clip:text` gradients so the text inside the highlight inverts live.

## 5. Typography, color, grid, spacing

- Fonts: **PP Neue Montreal** 400/500 (UI and body, `letter-spacing: normal`), **Greed Bold** (display, all-caps titles, very tight native spacing, `leading 0.85`), **Farnham Display** (italic serif accent, used only inside the scramble title mix). All loaded `font-display: swap` with metric-matched fallbacks (`size-adjust 90.9% / 85.5% / 95.9%`).
- Fluid scale (desktop >=1024): xs `max(10px, .833vw)` lh 1.3 (12px at 1440), sm `max(13px,1.25vw)` lh 1.25 (18px), md `max(18px,1.979vw)` lh 1.2 (28.5px), lg `max(24px,3.542vw)` lh 1.25 (51px), xl `max(58px,12.5vw)` (180px). Nav 38px. Mobile fixed: 10/13/18/24/58.
- Colors: background `#edeee5` (warm paper), foreground `#000`, accent `#fdf48b` (butter yellow). Black `#000` panels for reels. Titles use `mix-blend-mode:difference` white so they invert over imagery. Dim overlay 40% black during transitions.
- Grid: 12 columns desktop, 4 mobile. Gutter `max(20px, 2.083vw)`, gap `max(10px, 1.042vw)`. Content blocks start at col 2 or 3; media is 8 of 12 centered. Vertical rhythm is 60/100/160px (`lg:py-40` = 160px).
- Radii are tiny and consistent: 3px (pills, buttons), 9-10px (big buttons, menu panel).
- Text-masking recipe: wrapper `overflow:hidden` (or `clip-path: inset(0.25em -9999px 0.25em -9999px)`), `margin-block:-0.25em`, inner `padding-block:0.25em`. The -0.25em/+0.25em trick keeps tight leading from clipping ascenders and descenders. Overshoot is **130%** (not 100%) so the text is fully hidden even with the padding.
- Rotation guard: a 45s overlay if a touch device is landscape-short; a "screen too short" notice below ~600px height. Reload-on-resize when viewport changes materially while idle.

## 6. Libraries and evidence

- Next.js (App Router, Turbopack chunks `/_next/static/chunks/*.js`, `next-size-adjust` meta), React 19 with `ViewTransition` strings present (not used for the page transition).
- **GSAP 3.15.0** bundled (not on `window`): core, `ScrollTrigger`, `SplitText` (confirmed `an.version="3.15.0"`), `CustomEase`, `@gsap/react` `useGSAP`. Custom eases registered once: `expoOut = 0.19,1,.22,1`, `expoInOut = .83,0,.17,1`, `settleOut = 0.5,1,.89,1`. Plus a custom plugin `typeScramble`.
- No Lenis, no Locomotive, no Barba/Swup (the curtain is a React context `PageCurtainProvider` calling `router.push`). Smooth scroll is a ~60 line custom wheel interpolator.
- WebGL2 raw (no three.js): hand-written vertex/fragment shaders for DOM-texture compositing and the screen warp.
- WebAudio sound system (buffers decoded on idle, gain 0.6, mute persists on `<html data-sound-on>`, suspended after 30s idle).
- Prismic (rich text, slices), Cookiebot, GA4, IntersectionObserver reveal engine, ResizeObserver, `matchMedia` gating (`(hover:hover) and (pointer:fine)`, `prefers-reduced-motion`).
- Evidence: `window` has only `next`; bundle strings `ease:"expoOut"`, `create("expoOut","0.19,1,.22,1")`, `MASK_REVEAL_OPEN_DURATION:.5`, `TITLE_HOLD_DURATION:1`, `TITLE_REVEAL_END:1.55`, `SplitText.create(...,{type:"lines",mask:"lines"})`, shader sources, `radius:520,strength:.14*...`.
- Reduced motion: every tween is `duration * !reduced` (zero), parallax is skipped, `[data-page-content]{transform:none!important}`.

## 7. Most stealable techniques (ranked)

1. **One ease pair, everywhere.** Register `expoOut (0.19,1,.22,1)` and `expoInOut (.83,0,.17,1)` and use nothing else. Durations: 0.35 / 0.5 / 0.9 / 1.2. This alone is ~40% of the "feel".
   ```js
   CustomEase.create("expoOut","0.19,1,.22,1"); CustomEase.create("expoInOut",".83,0,.17,1");
   ```
2. **Text rises out of a 130% mask, never fades.**
   ```html
   <span class="mask"><span class="inner">TEXT</span></span>
   ```
   ```css
   .mask{display:block;overflow:hidden;margin-block:-.25em}
   .inner{display:block;padding-block:.25em}
   ```
   ```js
   gsap.set(".inner",{yPercent:130});
   gsap.to(".inner",{yPercent:0,duration:.8,ease:"expoOut",stagger:.08}); // trigger via IO rootMargin "0 0 -8% 0"
   // multi-line paragraphs: SplitText.create(el,{type:"lines",mask:"lines"}); set masks overflow-clip-margin:.35em
   ```
3. **Curtain page transition with a title card.** Fixed `z-55` layer, accent color, domed top edge, content shifts 40px under a 40% dim.
   ```css
   .curtain-bg{position:absolute;top:-40px;bottom:-40px;left:-50%;right:-50%;border-radius:50%/299px;background:#fdf48b}
   ```
   ```js
   // cover
   gsap.set(curtain,{yPercent:100,y:40});
   tl.to(curtain,{yPercent:0,y:0,duration:.9,ease:"expoInOut"},0)
     .to(pageContent,{y:-40,duration:.9,ease:"expoInOut"},0)
     .to(dim,{opacity:.4,duration:.9,ease:"expoInOut"},0)
     .to(titleInners,{yPercent:0,duration:1,ease:"expoOut",stagger:.15},.55)
     .to(counter,{value:100,duration:1.2,ease:"none",onUpdate:fmt},.55)
     .call(()=>router.push(href),null,.9);
   // wait until route committed AND title done, hold 1s, then
   // release: curtain yPercent:-100,y:-40 (.9 expoInOut); title/counter yPercent:-130 (.7 expoInOut, stagger .1); new content y:40->0 (.9 expoInOut)
   ```
   Pre-offset the incoming content +40px so the exit and entrance share one visual axis. Gate hover and scroll triggers on a `phase` store (`idle|covering|revealing`).
4. **FLIP the thumbnail onto the curtain, not into the hero.** Clone the card image into a `fixed z-59` overlay at the card's rect, hide the source, tween the overlay to a slot above the title (width 16.67vw, 16:10, 40px gap) with `2.05s expoOut`, then swap to the slot's own img. Seed the overlay's inner image with the card's current parallax Y and hover scale so there is no jump.
5. **Self-driving hero intro with scroll scrub handoff.** Lock input, then drive real scroll:
   ```js
   const o={y:0}; gsap.to(o,{y:heroIntroScroll,duration:1.3,ease:"expoOut",onUpdate:()=>{scrollTo(0,o.y);ScrollTrigger.update()}});
   ScrollTrigger.create({start:0,end:()=>innerHeight,scrub:true,onUpdate:s=>{gsap.set(media,{scale:1-s.progress/6});gsap.set(shade,{autoAlpha:.2*s.progress})}});
   ```
   Hero media is `fixed`, 120% oversized, content scrolls over it (`h-100dvh` spacer). The title is `position:sticky`, `mix-blend-mode:difference`, and shrinks 180px -> 28px by scrubbing `fontSize` over `0.3*innerHeight`.
6. **Per-character scramble with width-stable glyph pools.** Reveal as `render(progress)`: `revealedCount = max(0,(p-.3)/.7)*n`, a random permutation decides which char resolves when, unresolved chars draw from a pool of the 6 glyphs closest in advance width (precompute per font), redraw pool every 50ms, ease none, 0.5-1s. Lock element width/height while running. Use for labels, hover on links, loader title, cursor pill text. Mixed faces (sans bold + italic serif, 1/3 vs 2/3, no more than 2 in a row) in the loader title give it its signature.
7. **Alternating clip-path wipes plus 1.2 -> 1 scale for every media block.**
   ```js
   gsap.set(wrap,{clipPath: i%2? "inset(0 100% 0 0)":"inset(0 0 0 100%)"}); gsap.set(media,{scale:1.2});
   tl.to(wrap,{clipPath:"inset(0 0 0 0)",duration:1.2,ease:"expoOut"}).to(media,{scale:1,duration:1.2,ease:"expoOut"},0);
   ```
   Start only when the media is decoded (max 3s), and `clearProps` after. Add scrubbed parallax: inner box `top:-5%;height:110%`, `yPercent` from -4.545 to +4.545 across `top bottom -> bottom top`.
8. **A cursor that is both pointer and label.** 11px accent diamond (45deg square), `mix-blend-mode:difference`, `quickTo(x/y,{duration:.35,ease:"expoOut"})`, tilt `clamp(-6,6,-10*vy)` back to 0 in 0.6s; contextual label morphs the diamond into a 3px-radius accent pill ("Play", "Close", "View project") with a clip-path text reveal (0.5s open / 0.35s close).
   Bonus that costs almost nothing: smooth wheel interpolation `y += (target-y)*(1-Math.exp(-.08*ticker.deltaRatio(60)))` with `preventDefault` on wheel, and a sound layer (click, hover shuffle, curtain whoosh) behind a mute toggle.

Files and artifacts: screenshots and contact sheets in `D:/Coding/ash-portfolio/.research/auge/` (sheet-click.png, sheet-release.png, sheet-load.png, sheet-detail-scroll.png, home-*.png, works-page.png). Raw bundles and sampler JSON in `C:/Users/ashut/AppData/Local/Temp/research-auge/`.
