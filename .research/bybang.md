# bybang.co (Estudio Bang) motion and interaction teardown

Source of truth: the shipped Vite bundle (`/assets/index-Df87kvrA.js`, 543 KB, readable enough to quote), the CSS (`index-Bx5W3wfa.css`), the lazy chunk `ScrollImageDistortion-XCswPwLj.js`, plus live Playwright measurement at 1440x900. Screenshots are in `D:/Coding/ash-portfolio/.research/bybang/`. Scratch scripts and raw bundles: `C:/Users/ashut/AppData/Local/Temp/research-bybang/`.

Caveat: headless Chromium ran at about 12 fps, so I measured the cursor lerp from code first and confirmed it numerically (per-frame ratios 0.376, 0.374, 0.370, 0.365). No velocity-based cursor effect exists in the code.

## 1. Summary of the feel

A near-empty white page where the cursor is the main character. The cursor is not a pointer; it is a 16px white square under `mix-blend-mode: difference` that trails the mouse at lerp 0.38 per frame, and when you touch anything interactive it stops following the mouse and instead morphs into that element's exact bounding box, inverting the text beneath it like a selection highlight. Over photos it becomes a small circle with a word-masked label ("Cortaderas Norte"), and over body text it turns into a 3x26 I-beam. Photos respond to the pointer too: a WebGL layer adds simplex-noise grain displacement around the cursor and bends card edges with scroll velocity. It works because every state change is a single CSS class toggle with overshoot easing (`cubic-bezier(.68,-.48,.28,1.48)`), the palette is only white, #141414 and 30% grey (so the blend inversion is always legible), and nothing else on the page competes: no hover animation on text, no parallax, one font family. The "feel" is 90% cursor, 10% shader.

## 2. Cursor

### Anatomy (DOM)
```
div.custom-cursor            fixed, left/top 0, z-index 1300, pointer-events none, mix-blend-mode difference
  span.custom-cursor__label          14px/500, tracking -.04em, above the shape, per-word masked spans
  span.custom-cursor__shape          background #fff, 100% x 100%, clip-path / radius / transform per state
    span.custom-cursor__split--nw    black triangle (expand icon half), clip-path polygon(0 0,100% 0,0 100%)
    span.custom-cursor__split--se    black triangle, clip-path polygon(100% 0,100% 100%,0 100%)
    ::before/::after                 black 24x5 / 5x24 bars (unused cross, opacity 0)
  span.custom-cursor__social-icon x2 (LinkedIn, Instagram svg, opacity 0, scale .62)
```
Size is driven by CSS vars `--cursor-width/--cursor-height` (default 16px), set from JS. Position is `transform: translate3d(x,y,0) translate(-50%,-50%)` (centered on the point).

### Follow physics (exact, from bundle)
```js
// per rAF tick, frame-based (NOT dt-corrected)
m += (g - m) * 0.38;  p += (v - p) * 0.38;   // m,p = drawn pos; g,v = goal
// goal = mouse (c,f) normally; = center of hovered element rect when a link target is active
```
- Measured: 37.6% of remaining distance per frame at about 12 fps; at 60 fps that is 90% settled in about 80 ms (5 frames), 99% in about 160 ms. Very tight, almost no float; reads as "snappy but not 1:1".
- First appearance snaps to the mouse (`m=c; p=f`), no fly-in from a corner. Initial seed is `--site-grid-edge + 8` (24px at desktop).
- Listens on `pointermove` and `mousemove` (document), `pointerdown`, `click`, `mouseleave`, `scroll` (passive, rAF-coalesced `elementFromPoint` refresh), `resize`, `focus`, `pageshow`, and a custom `estudio:cursor-refresh` event (dispatched in a rAF loop for 1200 ms after route/case changes so the state re-resolves under a stationary pointer).
- Velocity effects: none. No stretch, rotation, skew, trail. Do not add them if you want the same feel.

### Sizing and transition
- Default: `width/height` transition `.52s cubic-bezier(.68,-.48,.28,1.48)` (overshoots, about 48% undershoot first, then 48% overshoot). Opacity `.18s ease`.
- States `--text`, `--plus`, `--minus`, `--project-index-row`: `.26s cubic-bezier(.65,0,.35,1)` (no overshoot).
- Shape transitions: bg `.32s ease`, radius `.52s` overshoot bezier, clip-path `.46s` overshoot bezier, transform `.52s` overshoot bezier. will-change on shape.

### States per target (measured live)
| Target | Classes | Size | Shape | Label |
|---|---|---|---|---|
| Blank page | `--visible` | 16x16 | white square, radius 0 | none |
| Nav link, language, footer links, logo, buttons (selector list X) | `--link` | element rect (e.g. "projects," 68.75x18; footer link 74.3x13; lang 25.8x17); logo rect + 16px (V*2) = 46x40 | square, scale 1 | none |
| Mosaic image, about image, case media, intro image | `--image` | 16x16 | circle (`border-radius:50%`, `scale(1.04)`) | `data-cursor-label` (project title) above |
| Expandable media (case hero, team photo, team row) | `--image --expandable --labeled` | 34x34 | two triangles pushed apart +-3px (expand glyph) | "Expand" / "Expand <name>" |
| Lightbox / team overlay | `--collapse` | 24x24 | triangles +-1px, scale .72 | "Collapse" |
| Body text (p, h1-6, li, dd, figcaption, etc, not inside a link/image) | `--text` | 3x26 | I-beam bar, `scaleY(1.08)` | none |
| Plus target (`.about-team-member__legacy-plus-target`) | `--plus` | 16x16 | plus via clip-path polygon(37% 12%, 63% 12% ...) | none |
| Expanded plus | `--minus` | 16x16 | plus rotated 45deg (reads as close X) | none |
| Social icons in team | `--social --social-linkedin/instagram` | 16x16 | shape fades, svg scales .62 to 1 in .42s overshoot | none |
| Studio (admin) inputs | `--studio-input` | 34x34 | circle | none |
| Contact form fields | `--link --input-focused` | field rect | square, blinks `contactCursorBlink .44s steps(1,end) x2`, then `--input-hidden` (opacity 0) after 440 ms so the native caret takes over | none |
| Desktop project index row | `--image --project-index-row` | 16x16 | circle, no label on desktop (label variant with 40px/700 title + 14px uppercase meta exists for `.project-index-card`, mobile list) | n/a |

"Magnetic pull" is not a pull toward the element; it is a full takeover. While `E` (the active link element) is set, the goal becomes the element rect centre and size is the rect size. The mouse position is ignored until you leave. This is stronger than any magnetic effect (100% capture) and is why it feels so deliberate. The element itself never moves.

### Label reveal
Label is rebuilt as `<span class=label-word style="--word-index:i"><span class=label-word-inner>word</span></span>`. Words are `overflow:hidden; display:inline-block`; inner is `translateY(115%)` and goes to 0 on `--labeled` with `.3s cubic-bezier(.16,1,.3,1)`, delay `i * 24ms`. Exit (`--label-exiting`) reverses: `.3s`, delay `(count - i - 1) * 24ms`, then DOM cleared after 620 ms. Label box: `bottom: calc(100% + 8px)`, width 176px, `text-wrap: balance`, `max-height 31.2px` (two lines), 4px padding, white (blend turns it into inverted text). Label is suppressed after you click an item (`C` guard) and on `max-width:980px`.

### Blend, hide/show, touch
- `mix-blend-mode: difference`, white fill. On #fff bg the cursor renders black; on dark photo it renders light. The site chrome (`.site-chrome`, color #fff, fixed, z 50) and the "bang" overlay wordmark use the same blend so everything inverts together.
- Hidden until first pointer event (opacity 0, `--visible` adds 1). `document mouseleave` removes all state classes and resets to 16px. `window focus/pageshow` re-evaluates.
- Native cursor hidden only inside `@media (hover:hover) and (pointer:fine)` via `.public-experience, .public-experience * { cursor:none !important }`. Otherwise `.custom-cursor{display:none}` and the native cursor stays. JS also early-returns if `matchMedia('(hover:hover) and (pointer:fine)')` fails.

## 3. Hover interaction inventory
1. Nav links: `opacity .2 to 1`, `.24s ease` (on home all are 1). Cursor morph provides the real hover feedback. No text roll, no underline.
2. Mosaic image: DOM `.mosaic-item__media` has `transition: transform .9s cubic-bezier(.22,1,.36,1)` to `scale(1.04)`. The DOM node is `visibility:hidden` while WebGL draws it, but the scale ratio is read each frame and fed to the shader as `uZoom`, so the zoom still shows.
3. Mosaic image (WebGL): grain displacement around pointer. See section 4.
4. Project index rows (`.project-index-desktop__row`): rows sit at `--desktop-row-opacity .3`; hovered row goes to 1 (`mouseenter`, `pointerover`, `pointermove` all call setActive). Meta (VILLA GESELL, RESIDENTIAL, ARQ2G, 2026) fades in `.18s` at 10px uppercase, opacity .5. The 232x312 cover on the left swaps image. Row 24px/700/-.05em, number 10px at .3 opacity.
5. Footer cookie banner: hover swaps "cookie?" for choices (opacity swap).
6. Team social icon: `scale(1.12)`. Team row hover: `background #0000000d`. Contact inputs hover: `#1414140d` bg. Submit hover: bg #000 (error: #c7161d).
7. Logo and buttons: `whileTap={{scale:.9}}` (framer).
8. Clock: digits roll (`.clock-label__roll`, 17px tall mask, value slides).
No other hover animation exists. Restraint is the point.

## 4. Other motion

### Loader (about 6 to 8 s on cold load; counter is tied to real asset loading)
- White full-screen (`z 100`). Centre 217px square (`min(217px, 44.8vw-ish)`) cycles through placeholder images by crossfading layer opacity; white pixel "bang" mark (3 blocks, grid 10.028 x 12px) sits on top.
- Counter 0 to 100, bottom-right, 14px, `#2e2e2e`, measured 0 at 2.2 s, 31 at 4.3 s, 68 at 5.6 s, 100 at 6.7 s, loader gone about 8 s. Tied to fonts (4 faces via `document.fonts.load`) and images (data attrs `data-intro-loaded-images`).
- Exit "burst": 8 `burst-tile` squares (same size) plus the main image fly up.
  - Main image: `y:-145vh, scale .92, rotate -2deg`, `.82s cubic-bezier(.75,0,.95,.22)` (strong ease-in, accelerates away).
  - Tiles: `x = (k-.5)*min(760, 260+n*52) + sin((i+1)*1.7)*58`, `y = -(148 + i%4*9)vh`, `rotate = (i even ? -1 : 1)*(4 + i%5*1.6)deg`, `scale = max(.48, .86 - min(i,12)*.032)`, opacity .94, `.86s` same bezier, stagger `i*18ms`.
  - Loader bg `#fff` to transparent `.24s` delay `.08s`; whole exit `.84s linear`; counter `y:-28, opacity 0 .24s linear`.
- Then mosaic items "intro-drop": each starts `landingStartY` above (about -128px to -(item top + 130px)), lands with `ease [.16,1,.3,1]` (expo out), `duration .78 + (k%9)*.105` (0.78 to 1.62 s), `delay (k*3%12)*.06 + cycle*.018` (0 to 0.72 s). Staggered pseudo-random drop is what makes the arrival feel organic.

### Home scroll
- Lenis, `new Lenis({autoRaf:true, infinite:true, syncTouch:true})`, otherwise defaults (lerp about .1). Measured: 14 wheel ticks of 260 px moved scrollY 24480 to 28120 (3640 px exactly) with visible smoothing lag, settling within about 1 s. `html.lenis`, scrollbars hidden (`scrollbar-width:none`), `overscroll-behavior:none`.
- The rail is a fake infinite loop: 9 copies (`du*2+1`) of a 680-unit tall cycle (`Ki=680`), total 56160 px at 900 px tall (1 unit = 1vh, or .58vw min); Lenis `infinite` wraps scroll. Start scroll lands mid-rail (scrollY 24480 after load) so you can go either direction. Each item is positioned by CSS vars `--start --cols --top` on a 16-column grid.
- Cases and about overlays use their own Lenis on a wrapper (`wrapper/content/eventsTarget`, `smoothWheel:true, syncTouch:false`). Esc closes the case (keydown).

### WebGL layer (hand-written WebGL1, no three/ogl)
One `<canvas class=scroll-image-distortion>`, fixed 100vw x 100vh, z-index 9 (38 when a case is not present), `pointer-events:none`, `alpha:true, antialias:false, powerPreference:'low-power'`, DPR capped at 2. A fullscreen quad shader draws each in-view card (`rect` uniform from `getBoundingClientRect`), scissored to that card. DOM media gets `data-image-distortion-ready` and `visibility:hidden`. Textures lazily uploaded, LRU of 18. Render loop is on-demand (rAF only while scroll velocity, hover easing or recent pointer activity, 1 s idle tail).
- Scroll curl: `T` = smoothed scroll speed, `target = min(px_per_s/800, 1)`, attack tau 25 ms, release tau 175 ms (`T += (target-T)*(1-exp(-dt/tau))`); `curl = .0486 * T`. In shader, `edgeProfile = 1 - sqrt(1 - cy^2)` where `cy = uv.y*2-1` over the viewport; `uv.x = .5 + (uv.x-.5)*(1 - edgeProfile*curl)`. Cards bow inward at the top and bottom of the screen proportional to velocity (visible on the top-left tile in `scroll-curl.png`). Off on touch and under 980px.
- Hover grain: `hover` eases 0 to 1 and back over 600 ms with `cubic-bezier(.4,0,.2,1)`. `uPointer` (0..1 in card space) follows the real pointer with `1 - .84^(dt/16.67)` (about 16%/frame). Shader: `circle = 1 - length((localUv-pointer)*(1,1/aspect))*15`; `disp = circle * snoise(gl_FragCoord.xy) * .0028 * hover * focusMask`; `uv += (disp, -disp)`; `focusMask = smoothstep(14px, 48px, distPx)` keeps a clear core under the cursor. Effect: pixel-scale noise tearing of the photo in a ring about 7% of card width around the cursor (see `cur-image.png`). Pointer drifts back to centre on leave. Edge alpha `smoothstep(0,.75,edgePx)`. Source credit in shader: codrops "shader-on-scroll" by jankohlbach (MIT) and Ashima simplex noise.
- Context-lost handling, `IntersectionObserver rootMargin 240px`, MutationObserver for re-sync.

### Page and route transitions
- SPA state machine, URL changes only for cases (`/projects/cortaderas`). Nav click: mosaic fades and blurs to near-white (`trans-projects-mid.png`) while the wordmark stays; new view staggers in. Master ease `_e = [.65,0,.35,1]` (used 62 times) with durations `.54, .58, .72, .82, .86, .92, .98, 1.04`. Soft ease `[.16,1,.3,1]` for arrivals (1.46 s and 1.58 s on big moves).
- Wordmark: `transition filter .76s, opacity .76s, transform .98s` all `cubic-bezier(.65,0,.35,1)`; moves up in contact view, blurs to 10px and .52 opacity when team overlay is open.
- Case card: sheet slides over the still-visible mosaic. Giant project title (case-title marquee, `caseTitleMarqueeRamp` keyframes) clipped across the top with the difference blend, so it inverts over the photos behind (`case-open.png`). Share / Close in 18px/600. Info table with Geist Mono 10px labels.
- Team overlay: image from `blur(8px) opacity 0 scale .985 y32` to clear in `.86s` delay `.08s`.
- Index entry: image `projectIndexDesktopImageIn .92s .15s backwards`; rows `projectIndexDesktopRowIn (.64s + i*34ms)` delay `.26s + i*58ms`, all `cubic-bezier(.65,0,.35,1)`.
- Grain overlay: fixed GIF (`texture-gif-tremendo.gif`, 290px tile, opacity .03, z 9999). Subtle animated film grain over everything.

## 5. Typography, colour, grid, spacing
- Fonts: Geist (400, 500, 600 woff2, preloaded) plus Geist Mono 500 (clock, case meta). `font-feature-settings: "ss01" 1` globally; `"ss09" 1` on titles and numbers. Tracking: -.04em UI/body, -.05em big titles, -.02em small caps meta.
- Sizes: nav 18/600; wordmark `clamp(48px, 5.14vw, 74px)`/500, line-height 76px (74px at 1440); index title 24/700; cursor label 14/500; meta 10 uppercase (.5 opacity); footer 14. Case body about 18px justified.
- Colours: page `#ffffff` (html `#f5f5f2` behind), ink `#141414`, muted `rgba(20,20,20,.3)`, faint `.2`, border `.08`, error `#c7161d`, accent `#946ec4` (nearly unused). Hover fills `#1414140d`.
- Wordmark layering trick: "estudio" (muted, z 1) sits under the photos so images eat it; "bang" (ink, z 1) plus an overlay copy of "bang" in white with `mix-blend-mode:difference` at z 39 above the photos, so "bang" always shows and inverts over images. Canvas z 9, chrome z 50, cursor z 1300, grain z 9999.
- Grid: 16 columns. `--site-grid-edge 32px`, `--site-grid-gap 32px` at 1440; `col = (100vw - 2*edge - 15*gap)/16` = 56px at 1440 (verified: 3 cols = 232, 2 = 144, 5 = 408, 6 = 496 wide items). Under 980px edge 20 / gap 18; small 16/15. Mosaic tile widths 144, 232, 320, 408, 496; aspect ratios like 232:277, 320:430, 144:194.
- Chrome: logo top-left (30x24 pixel mark), nav top-right with trailing commas ("Home, about, projects, ... careers."), language ENG/ESP and a two-city clock (BCN, BUE) bottom-right in mono, copyright bottom-centre in 11px at .3 opacity, cookie bottom-left as a 40px bold word.

## 6. Library stack (evidence)
- React + Vite (single `#root`, hashed `/assets/index-*.js`, `type=module`).
- framer-motion (`pe.button`, `pe.div`, `animate/exit/whileTap/transition`, spring defaults `stiffness 100, damping 10, mass 1`, `useIsPresent` for canvas z-index).
- Lenis (`new Uf({autoRaf, infinite, syncTouch})`, `html.lenis` class, 37 "lenis" strings in the bundle).
- react-router (3 strings; but nav is state-based, only cases push URLs).
- Custom WebGL1 shader chunk `ScrollImageDistortion-*.js` (13.5 KB, lazy loaded). No three, ogl, curtains, pixi.
- No GSAP, no ScrollTrigger. `window` exposes none of `gsap/Lenis/THREE/PIXI/Webflow/__NEXT_DATA__`.
- Cloudflare (RUM beacon), content from `/api/content?stage=published` (headless CMS), media on `/media/...`, grain on r2.dev, UI sound file `/audio/menu-cursor-select.wav` in bundle. Built by "Tremendo Studio".

## 7. Most stealable techniques (ranked)

### 1. Rect-morph difference cursor (the whole signature)
```ts
const el = cursor; let x=mx, y=my, gx=mx, gy=my, target=null;
const LERP = 0.38;
addEventListener('pointermove', e => { mx=e.clientX; my=e.clientY; show();
  target = e.target.closest(LINKS) ?? null; el.classList.toggle('is-link', !!target); });
function tick(){
  if (target?.isConnected) { const r=target.getBoundingClientRect(); gx=r.left+r.width/2; gy=r.top+r.height/2;
    el.style.setProperty('--w', r.width+'px'); el.style.setProperty('--h', r.height+'px'); }
  else { gx=mx; gy=my; }
  x += (gx-x)*LERP; y += (gy-y)*LERP;
  el.style.transform = `translate3d(${x}px,${y}px,0) translate(-50%,-50%)`;
  requestAnimationFrame(tick); }
```
```css
.cursor{position:fixed;left:0;top:0;width:var(--w,16px);height:var(--h,16px);mix-blend-mode:difference;
  pointer-events:none;z-index:1300;opacity:0;
  transition:opacity .18s ease,width .52s cubic-bezier(.68,-.48,.28,1.48),height .52s cubic-bezier(.68,-.48,.28,1.48)}
.cursor__shape{background:#fff;width:100%;height:100%}
@media (hover:hover) and (pointer:fine){ .app,.app *{cursor:none!important} }
@media not all and (hover:hover) and (pointer:fine){ .cursor{display:none} }
```
Gotchas: re-run target resolution on `scroll` (rAF-coalesced `elementFromPoint`), on route change, and on `mouseleave` hide it. Re-read the rect each frame so moving targets stay tracked.

### 2. Class-per-state cursor with CSS vars and two easings
Overshoot bezier `.68,-.48,.28,1.48` (.52s) for size/radius/clip-path; crisp `.65,0,.35,1` (.26s) for text/plus/row. States: link (rect), image (16px circle, scale 1.04), expandable (34px, two triangles +-3px), text (3x26 bar). Implement as classes toggled in one `resolve(target)` function; JS only sets `--w/--h`.

### 3. Word-masked cursor label
Split label into words, wrap each in `overflow:hidden` + inner span; inner `translateY(115%)` to 0, `.3s cubic-bezier(.16,1,.3,1)`, `transition-delay: calc(var(--i)*24ms)`. Exit reverses the stagger order; clear DOM after 620 ms. Position `bottom: calc(100% + 8px)`, 14px/500/-.04em, width 176px, `text-wrap:balance`.

### 4. Difference-blend z-index sandwich (wordmark and chrome)
Chrome is `position:fixed; color:#fff; mix-blend-mode:difference` so nav inverts over images. Wordmark = muted half under images (z 1) + a white duplicate of the key word at z 39 with difference. Layers: images 5, canvas 9, wordmark overlay 39, chrome 50, cursor 1300, grain 9999. Keep the palette to white, #141414, 30% grey so inversion stays legible.

### 5. Pointer grain-displacement shader on image tiles
One fixed full-screen WebGL1 canvas, one quad per in-view tile (scissor to its rect, `getBoundingClientRect` as uniform), hide DOM image with `visibility:hidden`. Fragment:
```glsl
float circle = 1.0 - length((localUv - uPointer) * vec2(1.0, 1.0/aspect)) * 15.0;
float focus  = smoothstep(14.0, 48.0, length((localUv-uPointer)*uRect.zw));
uv += vec2(1.,-1.) * circle * snoise(gl_FragCoord.xy) * 0.0028 * uHover * focus;
```
JS: `hover` eased 600 ms `cubic-bezier(.4,0,.2,1)`, `pointer += (target-pointer)*(1-.84**(dt/16.67))`, render only while something is animating (+1 s tail). Add `uZoom = mediaRect.w/itemRect.w` so CSS hover scale 1.04 (`.9s cubic-bezier(.22,1,.36,1)`) still shows. Fallback: leave the DOM image visible if WebGL fails. Skip on touch.

### 6. Scroll-velocity edge curl
Smooth speed `T`: `target=min(v/800,1)`, tau 25 ms up, 175 ms down. `uv.x = .5+(uv.x-.5)*(1 - (1-sqrt(1-cy*cy))*(.0486*T))` with `cy` from screen Y, applied to screen UV before mapping into cards. Gives a subtle barrel bend only while scrolling fast. Gate by `(hover:hover)` and width > 980.

### 7. Infinite Lenis mosaic on a 16-column data grid
Items store `{start, cols, top}`; width = `cols*col + (cols-1)*gap`, `col=(100vw-2*edge-15*gap)/16`, `top` in vh units. Render 9 copies of a 680-unit cycle, `new Lenis({infinite:true, autoRaf:true, syncTouch:true})`, start mid-rail. Intro drop: each tile `y` from above, expo-out `[.16,1,.3,1]`, duration `.78 + (k%9)*.105`, delay `(k*3%12)*.06`.

### 8. Accelerating "burst" loader exit and project-index dimming
Loader: counter tied to real preloads; exit flies centre image (`y:-145vh, scale .92, rotate -2deg`) and 8 clones (`stagger 18ms`, rotate +-(4..10)deg, scale .86 to .48) using ease-in `[.75,0,.95,.22]` over .82 to .86 s, then bg fade `.24s`. Project index: rows at opacity .3, hovered row 1, meta fades `.18s`, cover image swaps; entry `projectIndexDesktopRowIn (.64s + i*34ms)` delay `.26s + i*58ms`, ease `.65,0,.35,1`.

## Porting notes for ash-portfolio
- Highest value per hour: techniques 1 to 4 (pure CSS plus about 60 lines JS, no dependencies). Technique 5 is the other half of the wow and needs about 200 lines of WebGL, copy-paste friendly because it is raw WebGL1.
- Do not add velocity stretch to the cursor; the site proves the feel comes from the 0.38 lerp plus rect takeover plus overshoot bezier.
- Easing tokens to adopt: `--ease-io: cubic-bezier(.65,0,.35,1)`, `--ease-out: cubic-bezier(.16,1,.3,1)`, `--ease-soft-out: cubic-bezier(.22,1,.36,1)`, `--ease-back: cubic-bezier(.68,-.48,.28,1.48)`, `--ease-in-burst: cubic-bezier(.75,0,.95,.22)`.
- Respect `prefers-reduced-motion` (the original does not appear to): drop to lerp 1, no overshoot, no WebGL curl.
