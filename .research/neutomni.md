# neutomni.com motion teardown

Method: Playwright 1.64.1 (Chromium, 1440x900), DOM and computed-style introspection, the Slater custom-code bundles and inline scripts read in full, the Webflow IX2/IX3 interaction JSON parsed out of the main Webflow bundle (48 action lists, 101 events), screenshots and video. Evidence files: `D:/Coding/ash-portfolio/.research/neutomni/` (PNGs, contact sheets `sheet-*.png`). Scratch scripts: `C:/Users/ashut/AppData/Local/Temp/research-neutomni/`.

## 1. Overall feel

A single-colour (#cf1830 red on white) Webflow studio site that behaves like a small piece of software. Every section is a pinned, scroll-scrubbed "scene" with one idea: a giant logo shrinking into the nav, a hero video scaling up, a canvas polygon rolling along a catenary road and turning into a circle, a diagonal clip-path wipe between case studies, price cards flipping up like boarding passes, and finally the whole pricing page collapsing into a window on a Windows-XP "Bliss" desktop that then zooms out into a CRT monitor sitting on the white page. It works because of (a) one palette and one grid (20px gutters, 1400px content, no cards or shadows), (b) a mono + serif-italic + grotesk type trio used as a punctuation system (italic Editorial New is the "voice", Fira Code is the "label"), (c) physical metaphors (scissors cutting a dashed line, tickets, desktop OS, monitor) so each animation reads as an object not an effect, (d) restraint on easing: nearly everything is `power1/power2.inOut` or `inOutQuad`, 0.3 to 1s, with Lenis smoothing (lerp 0.07) under all of it.

## 2. The "retro switch"

Finding that matters: there is NO literal toggle control, no `localStorage`/`sessionStorage` key (both `{}`), no class/attribute flip on `html` or `body` (html only has `w-mod-js w-mod-ix lenis w-mod-ix3`), no sound, no CRT shader, no scanlines, no pixelation, no theme CSS variables swapped, no custom cursor change. The only "retro" assets are `.retro_ps` (monitor PNG), `.retro_mobile`, `.desktop_display`, `.wallpaper`. If you meant a control, I could not find one on desktop (1440 wide); the thing the site calls retro is a SCROLL-DRIVEN SWITCH inside `#pricing`, described below. It is one-way per scroll position (reversible by scrolling up, nothing persists).

Structure (`section#pricing.section.dark.above`, 9000px tall, `.sticky_blur` is `position: sticky; top:0; 100vh`; scroll range 8100px, absolute y 11263 to 20263):

```
.sticky_blur > .external_ps_wrap > img.retro_ps (monitor PNG, 2003x1800 at 100%)
                                 > .desktop_display (z 20)
   .wallpaper (Bliss photo) + .display_menu_bar (4 icons 24px + clock "Thu, Oct 15  4:14 AM")
   .files_wrap (right edge, 101px: Zefir.png, Natalia.png, Andrii.png, Testimonials folder, FAQ.md)
   .pricing_wrapper (full-bleed pricing page, becomes the window) + .pricing_icon "Pricing.html"
   .faq_wrapper 400x520, .testimonial_wrapper 700x440, 3 person windows 450x450 (all opacity 0)
```

Phase timeline (Webflow IX action list `a-6` "Service cards (desktop)", SCROLLING_IN_VIEW on `.blur-section`, % of the 8100px range, all eased `easeInOut`/`inOutQuad`):

| % | px into section | what happens |
|---|---|---|
| 0 to 15 | 0 to 1215 | `.shape` (a 70px-blurred blob, op .8) height 0 to 70, y 200 to 0 |
| 20 | 1620 | wrapper bg rgb r=255 (white) beginning; `.blur-text` filter ramps |
| 30 | 2430 | wrapper bg r=137 (sky blue). Three `.service_card` jump to y=860 (below fold). blob height 300 |
| 35 to 60 | 2835 to 4860 | cards fly up y 860 to 0 AND `rotateY` 180 to 0 (flip), staggered: card01 done @45, card02 @52, card03 @60. Headline "We keep our focus on important things" fades out @52 then price disclaimer + "Our packages" badge fade in |
| 60 | 4860 | wrapper bg settles at rgb(167,214,255) = #a7d6ff |
| 70 (JS, not IX) | 5670 (abs y 16933) | THE SWITCH, see below |
| 80 / 80.1 | 6480 | `.wallpaper` opacity 1 then 0 (hard cut, the Bliss photo is now baked into the monitor PNG) |
| 86 to 95 | 6966 to 7695 | `.external_ps_wrap` scale 1 to 0.3, rotateZ 0 to 6deg (measured ~1.6deg skew in matrix), y 0 to 100. `inOutQuad`. Monitor + white page revealed, contact CTA scrolls in |

The switch itself (inline Slater script `58771.js`, `updatePricing()` on rAF-throttled passive scroll): when `-stickyWrapper.top / (offsetHeight - innerHeight) >= 0.7`, a boolean flips and a TIME-BASED (not scrubbed) tween plays:
- `.pricing_wrapper`: `transform-origin: bottom left`, `scale(1)` to `scale(0.45)`, `left: 0 to 20px`, `top: 0 to -20px`, `transition: transform .5s, left .5s, top .5s` with `cubic-bezier(0.25, 0.46, 0.45, 0.94)` (const `EASE`).
- `.pricing_grabb` (72px title bar "Pricing.html" with red/grey traffic-light dots) and `.pricing_border.left/right/bottom` (20px frame strips) go opacity 0 to 1 over `.5s EASE`. This is what turns the page into a "window".
- Measured: wrapper 1440x900 at scroll 16900, 648x405 (scale .45) at 17000. `.display_menu_bar` and the file icons were already underneath, the shrinking page "reveals" them. Reversing past 0.7 plays the inverse (restores origin math, `scale(.45)` to `scale(1)` in .5s).
- Reduced motion: not handled on the switch (the canvas in section 3 handles `prefers-reduced-motion`).

The desktop is alive after the switch:
- Icons: `.file_item` hover (IX `a-55`): translucent white border + background fade, 300ms `outSine` (the rounded rect visible on the Testimonials folder in `sw-hoverfile.png`).
- Click icon opens its window (`setupPopup`): window starts at `scale(.05)` with `transform-origin` set to the icon centre, then `transition: transform .4s EASE, opacity .25s ease` to `scale(1)`, opacity 1. Close button reverses to the icon (`.3s`). The pricing window uses `flyToIcon`: from `scale(0)` at the icon, `.5s`, then rests at `scale(.45)` bottom-left.
- Windows are draggable (`makeDraggable`, mousedown/touch on `.xxx_grabb` title bar; `style.left/top` updates, clamped to parent and below the nav; `topZ` counter starting at 100000 for focus stacking; `transition:none` while dragging).
- Pricing window also minimises to its icon via its close dot; "Testimonials" is a chat-style window with 5 tabs (IX `a-58..a-62` click tab backgrounds); FAQ is `FAQ.md`.
- Clock: `.timing` shows `toLocaleDateString` + `toLocaleTimeString` (en-US) refreshed in `setInterval(..., 60)` (every 60 ms, almost certainly meant 60000).

To rebuild: IX scrub for the phases, one boolean IntersectionObserver-style threshold for the window collapse, CSS transitions for the .5s collapse, a flattened monitor PNG with transparent screen on top, desktop content scaled with the wrapper.

## 3. SVG and canvas animations (inventory)

30 inline SVGs, 0 SMIL, 0 CSS keyframes. Tools: GSAP 3.15 (SplitText, MorphSVG, ScrollTrigger, ScrollTo, Observer, all free since GSAP 3.13), Lottie via Webflow, one hand-written 2D canvas.

1. Loader logo (`.loader_logo`, 10 `<path>` letters, viewBox 1400x230): paths `y:-300` to `0`, `duration 2, ease power1.out, stagger {each .05, from:'center'}`. Letters rain from above, centre first. Runs on DOMContentLoaded.
2. Loader "cut along line" (IX `a-73`, plain DOM + `img.scissors`): scissors icon `x 7% to 100%` over 3000ms (delay 400, `inOutQuad`) while a solid line grows over a 2000px dashed SVG line (`.solid_line` width 9 to 102.5%). 5 dots (`.loader_dot`) slide -80 to 0 to +80 with staggered durations 2800/2700/2600/2500/2400 `inOutCubic`. Counter 000 to 100 (inline script `strip-h/t/o`): three vertical digit strips (`DIGIT_H=20`), one proxy tween `val 0 to 100, 3s, power2.inOut`, strips translate `-(v/100)*20`, `-(v/10)*20`, `-(v/5)*20`. Finale: `.top_cover` and `.bottom_cover` heights tween from 60%/40% to 0 in 1500ms with `cubic-bezier(.55,.055,.675,.19)` (easeInCubic) at delay 150, loader `display:none`. Total ~4.5s; mobile skips to 1s.
3. Logo-to-nav shrink (IX `a-30`, scroll-scrubbed 0 to 32%): 1400px logo SVG `.link` width 2000 to 180px; `.logo_invis` spacer 2000 to 0; `.nav_menu_wrap` y -5, `.logo` y -6. The oversized wordmark literally becomes the nav logo.
4. Hero text reveal: SplitType `lines`, from `opacity 0, blur(10px), y 15` to `1, 0, 0`, `duration .6, stagger .10, power1.out`. Nav `y20 to 0, .3s`, "flex-container" (hero card collage) `scale 0 to 1, .8s, power1.out` at +0.4s, timezone/buttons at +1s. Fired 4.5s after fonts ready (aligned with loader exit).
5. Process canvas `#pw-canvas` (not SVG, but the best piece): see technique #3 below. 4 to 12-gon rolls on a catenary-arch road, smoothing `lerp 0.2`, stroke 1.5px white, dashed axle line `[5,10]`.
6. Process columns (IX `a-64`, 0.7 scrub): `.process_cover._01.._04` heights 0 to 100% at scroll 30/45/60/75%; red columns grow upward at stagger 15%.
7. Morph slider `#morphSvg` ("Let's talk" CTA, desktop hover, touch drag below 992px): 6 outline shapes (#first diamond, #second hexagon, #third octagon, #fourth 12-gon, #fifth 16-gon, #sixth rounded circle-ish) in a 220x220 viewBox. A PAUSED `gsap.timeline` morphs `#first` through the rest with `morphSVG:{type:'rotational', origin:'50% 50%'}`, `rotation +90` per shape, `ease:'linear'`; its `.progress()` is set directly from mouse X over `.section.hover` (`mousemove`), so it is a scrubber. Shape x follows with `gsap.to(x, {duration:.1, ease:'none', overwrite:'auto'})`; the label `#morphLabel` follows with the same tween. Checkpoints at progress 0/.2/.4/.6/.8/1 leave a "trail clone": a stroke-only 1px copy of that checkpoint shape, rotated, `opacity 0` over `0.3 + trails.size * 0.4` s `power2.out`, removed onComplete. Mobile uses 4 shapes in a 120 viewBox.
8. Footer logo `#logo-svg` (1400x214, `#shape1..#shape7`): infinite GSAP timeline, 7 steps x 1s, `morphSVG:{shape, shapeIndex:'auto'}`, rotation 60,120,...,360,450, `svgOrigin '796 138'`, `ease power2.inOut`, then reset and rebuild. The "O" in NEUTOMNI cycles hexagon to heptagon to circle forever.
9. Circle CTA ring `.circle-cta` on each work slide: CircleType (`radius = circleSize * 0.9`) arcs "EXPLORE MORE" (Fira Code 500 14px uppercase, with bullets) around a 70px red circle with a 30px arrow SVG (24 viewBox, 2 paths). Ring rotates `rotateZ 0 to -360, 15s, linear, loop` (IX `a-43`). Circle scales 0 to 1.1 with `.circle-text`/arrow opacity 0 to 1 in 400ms (delay 100, `inOutQuad`) on `.slide_mask` hover (IX `a-40`), reverse on out (`a-48`). Position parallax: IX `a-41` mouse X/Y maps to `x,y -26px..+26px` (so it leans toward the pointer, not a full cursor follower). Native cursor is `none` over the image and CTA.
10. Pricing barcode (3 Lottie SVGs, 294x48, files `Scene-1 (8).json`, `(12).json`): scrubbed `PLUGIN_LOTTIE` 0 to 100% on card hover with `inOutQuad` 500ms, at the same time the ticket stub `.card_bottom` drops `y 16` and `rotateZ 5deg` with overshoot `cubic-bezier(.579,.423,.17,1.452)` and "button-text" fades in.
11. Hamburger icons (2 Lottie, 20x20), 6 `client_img` avatar SVGs (static), dashed lines (2000x2 / 2300x2 SVG, static `stroke-dasharray`).
12. "Stratchy" line (IX `a-7`): `.stratchy-text` width 28% to 100% scrubbed 15 to 70% (a text rule that stretches as you scroll through the Process intro).

## 4. Selected Works (the section to copy)

Markup: `#portfolio.sticky_wrap` 3600px tall (desktop only, `min-width:992px` via `gsap.matchMedia`), pinned child `.case_wrapper` 1420x900.
- Left (`.left_panel` 568px wide, bottom-aligned): 3 `.work_item` rows 548x80, `opacity .28` at rest, active = 1. Row = `01.` (Fira Code 500 16px) + project name (Editorial New italic 32px, red) on the left, `BRAND, DESIGN, WEBFLOW` (Fira Code 14px uppercase) right aligned, hairline divider between rows. Above: `h2` "Selected" + italic "Work" 118px (`--h2`), 300px intro paragraph at the top right of the left half.
- Right (`.right_panel` 852x900): stacked `.slide_mask` layers (all absolute, same size), each with `img.case_image` 937x990 (oversized so zoom never reveals edges) and the circle CTA that links to a Behance case study (`target`). No video previews, no page transition into a case (click opens the Behance gallery).

Scroll behaviour (inline script, the whole thing is ~100 lines):
- One `ScrollTrigger`: `start 'top top'`, `end '+=' + (n * innerHeight)` (n = 3, so 2700px), `pin: .case_wrapper`, `pinSpacing:true`, `anticipatePin:1`, `scrub: true` (Lenis already smooths; they note scrub .8 on top of Lenis felt laggy).
- One timeline, per slide step: mask `clipPath` from `polygon(100% 100%, 100% 100%, 100% 100%, 100% 100%)` (a point at bottom-right) to `polygon(0% 0%, 100% 0%, 100% 101%, 0% 101%)`, `duration .9, ease power2.inOut`; incoming `img scale 1.1 to 1` (`ease none`); outgoing `img scale 1 to 1.2` (`ease none`); outgoing row opacity 1 to .28 and incoming .28 to 1, `duration .28 ease none`, all starting at the same time. Each step is 1.0 timeline unit, reveal takes the first 0.9, 0.1 is a hold. First slide also reveals from the point (START_REVEALED=false, offset 1).
- Names enter via IX `a-84`: `.work_item` y 400/300/100 with blur to 0 over 1000ms `inOutQuad`, delays 0/150/450.
- Snap (the feel): after 90ms idle (wheel, scroll or touchend) it picks a label; going down it commits to the next image once its eased reveal is >= 10% done (`SNAP_FORWARD_AT=.1`), going up it commits back only if reveal < 90%. Then `lenis.scrollTo(target, {lerp: 0.1})`. No ScrollTrigger snap (that is only the fallback when Lenis is absent: `duration {min .45, max .65}, ease power1.inOut, delay .09`). Result: wheel notches never stop between images, but the first nudge already starts the wipe. Locked while touching or `lenis.isStopped`. Anchor links with `data-scroll-label="s1"` jump to a label via `jumpState` (1200ms lock).
- Mobile (below 992px): ScrollTrigger is off. A Swiper is destroyed and replaced by custom `.slides-stack` with prev/next buttons and swipe (>50px horizontal): same clip-path reveal in `.9s power2.inOut`, image 1.2 in / 1.4 out, text crossfade `.3s` (in at +.2), counter "01" fades 0.12s out/in, disabled button opacity .3.

## 5. Other motion and interaction

- Smooth scroll: `new Lenis({lerp: 0.07})` (0.3 on mobile), `lenis.on('scroll', ScrollTrigger.update)`, `gsap.ticker.add(t => lenis.raf(t*1000))`, `lagSmoothing(0)`.
- Blur reveal text (`[data-reveal="blur"]`, SplitText lines): `opacity 0, blur(10px), y 15` to `1, 0, 0`, `.4s power1.out, stagger .12`, `start 'top 85%'`, play once. Same pattern as the hero (SplitType). Used on headings across the page.
- Nav: IX `Navbar hides/appears` on scroll direction: `.navbar y -330` after 30% down, back to 0 on any scroll up, 500ms `inOutQuad`. Link underline (IX `a-35`): `scaleX 0 to 1`, `800ms cubic-bezier(.165,.84,.44,1)` (easeOutQuart), a second white underline follows at delay 250/550ms. Nav colour flips light/dark by section via `updateNavColorFromSections()` toggling `.light` on `.logo, .nav_link`.
- Hero video: IX `a-69`, `.video_wrap` scale .4 to 1 and y -100 to 0 over the first 50% of its section (dark section, mp4 on R2 `Scene-2.mp4`, autoplay muted).
- Video-section hero collage ("flex-container") and 3 fixed hero bits scale/opacity to 0 at 5% scroll (IX `a-8`, `Disappearing from hero`).
- Section title badges (`.title_wrap`, italic pill outline "Our Process", "Contact"): opacity 0 to 1 `.3s` at 10% in view; "A to B" glyph row blur/y15 to 0 `.3s inCirc`.
- Footer: `.footer` is `position: sticky; bottom`, reveal-by-uncover with `.footer_shadow` fading 1 to 0 in 500ms (IX `a-49`); big NEUTOMNI wordmark 1400x220 with the morphing O (item 8). Footer links: italic Editorial 16px with an underline sweep.
- Live clocks: `local time 00:31:11 (GMT+2)` for Europe/Warsaw updated every 1s in 3 places, plus a green square "OPEN FOR WORK" tag in Fira Code.
- Cookie banner (Flowappz) fixed bottom-left, red, 400x250: ignore.
- Pricing cards on hover: stub drops and tilts, see 3.10.

## 6. Typography, colour, grid

Tokens from `:root` (Webflow variables):
- Colours: `--red #cf1830` (text, headings, bg-tertiary), `--white #fff` (bg-primary), `--blue #6db1f0` (accent), `--grey #f8f4f4` (bg-secondary). Hexes seen only in the retro section: sky wrapper `#a7d6ff` / `#89cfff` (rgb 137,207,251 at 30%), `.shape` blob blur(70px) opacity .8, desktop window titles red on white, file names white 13px with soft text-shadow. Dark sections still resolve to white (`.section.dark` bg white), so the "dark" in the Pricing zone is only the sky blue and the hero video block (#161616 behind the case collage).
- Single mode only. There is no second "retro" palette; the retro room is a different set of photos, not tokens.
- Fonts (self-hosted woff2/otf/ttf on the Webflow CDN): `Editorial New` Regular and Italic (display serif, `--font-primary`, `--italic`), `Fira Code` 300 to 700 variable (labels, tags, numbers, `--font-tertiary`), `Vazirmatn` 100 to 900 variable (UI sans, `--font-secondary`, body). Hero statement uses Vazirmatn 400 52px with `letter-spacing -2px, line-height 100%`, followed by Editorial italic in the same size ("as much as we do").
- Sizes: h1 52/52, h2 118/110% on desktop (Selected Work heading; shrinks to 32/32 elsewhere), h3 32px, body 16/19.2 (120%), small 13, mono labels 14px uppercase with 19.2 line-height. Nearly no weights above 500.
- Grid: container `padding: 0 20px`, content width 1400 at 1440, no max-width. Everything is margin-less edge-to-edge in 20px frames; 2-col logic is 568 (left panel) + 852 (right panel). Breakpoints: 991 (tablet, drag instead of hover), 767 (mobile), IX uses `main/medium/small/tiny`.
- Spacing: sections 0 padding, height driven by sticky wrappers (500, 1800, 5363, 3600, 9000, 790 px). Vertical rhythm is set by scroll length, not padding.

## 7. Library stack (evidence)

- Webflow (`data-wf-site`, `w-mod-ix3`, IX2 + IX3 action lists in the main bundle, `Webflow` global, jQuery 3.5.1, Lottie via `PLUGIN_LOTTIE`, Webflow Variables `---mode--collection-...`). Most scroll scrubs (video scale, logo shrink, process columns, pricing phases, hover effects) are Webflow Interactions, not code.
- Slater (assets.slater.app/18712, ES modules) = the hand-written code: morph slider, popups/drag windows, pricing switch.
- GSAP 3.15.0: `gsap`, `ScrollTrigger`, `SplitText`, `MorphSVGPlugin`, `ScrollToPlugin`, `Observer` (all on `window`; `gsap.registerPlugin(MorphSVGPlugin,ScrollTrigger,SplitText,ScrollToPlugin,Observer)`). No DrawSVG, no Flip.
- Lenis 1.3.21 (unpkg), SplitType 0.3.4 (unpkg), CircleType 2.3.0 (jsdelivr), Swiper (destroyed and replaced), Cloudflare Turnstile + Flowappz cookie consent + GA4.
- `window.lenis` and `window.Lenis`; `html.lenis`. One `<canvas>` (process wheel). No three.js, Rive, Framer Motion, Next.
- 0 SMIL, 0 Web Animations API running at load, no WebGL.

## 8. Eight most stealable techniques (ranked by feel-per-effort)

1. Clip-path corner wipe stack with snap (Selected Works).
```js
const HIDDEN='polygon(100% 100%,100% 100%,100% 100%,100% 100%)', FULL='polygon(0 0,100% 0,100% 101%,0 101%)';
gsap.set(masks,{clipPath:HIDDEN}); gsap.set(imgs,{scale:1.1}); gsap.set(rows,{opacity:.28});
tl.to(masks[i],{clipPath:FULL,duration:.9,ease:'power2.inOut'},at)
  .to(imgs[i],{scale:1,ease:'none',duration:.9},at).to(imgs[i-1],{scale:1.2,ease:'none',duration:.9},at)
  .to(rows[i-1],{opacity:.28,duration:.28,ease:'none'},at).to(rows[i],{opacity:1,duration:.28,ease:'none'},at);
ScrollTrigger.create({animation:tl,trigger:sec,start:'top top',end:'+='+n*innerHeight,pin:pinEl,scrub:true});
// snap: on 90ms idle, progress p within a step: go forward if ease(p/.9)>=.1, back only if <.9; lenis.scrollTo(target,{lerp:.1})
```
2. Pricing page to desktop window collapse (the "switch"). Pinned `100vh` stage in a 9000px section. At scroll progress >= .7 flip one boolean; `.page{transform-origin:bottom left;transition:transform .5s cubic-bezier(.25,.46,.45,.94),left .5s,top .5s}` to `scale(.45); left:20px; top:-20px`; fade in title bar and 20px borders (`opacity .5s`). Under it: wallpaper, icon column, menu bar clock. Then scrub monitor zoom `scale 1 to .3, rotateZ 6deg, y 100` over 86 to 95% `inOutQuad`.
3. Rolling-polygon canvas on a catenary road. Per frame (scroll-lerped, `progress += (target-progress)*.2`): `nf = 4 + tPoly*8` (4 to 12 sides, continuous by inserting an edge midpoint and lerping vertices), `s = 2R sin(PI/n)` side, `a = R cos(PI/n)` apothem, road = `a*cosh(x/a)-a` arches of width `s` blended to a flat line by `circT` (second phase from 30%), `rotation = (d/s)*(2PI/nf) - PI/nf` so it rolls without slipping, `R = min(W,H)*.13`, strokes 1.5px, dashed axle `[5,10]`, DPR-aware `setTransform`, stop when `|delta|<.0005`.
4. Mouse-scrubbed shape morph with trails. `tl=gsap.timeline({paused:true})`, `.to(first,{morphSVG:{shape:'#second',type:'rotational',origin:'50% 50%'},rotation:90,duration:.2,ease:'linear'},0)`... one per checkpoint at progress 0/.2/.4/.6/.8/1; on `mousemove` `tl.progress(clamp((mx-shape/2)/(trackW-shape)))`, move shape `x` with `duration:.1, ease:'none', overwrite:'auto'`; when progress crosses a checkpoint clone that path as a 1px stroke SVG, `gsap.to(clone,{opacity:0,duration:.3+n*.4,ease:'power2.out'})` and remove.
5. Wordmark that becomes the nav. Hero logo SVG at 1400px wide pinned top; scrub (0 to 32% of the first section) width 2000 to 180 and `y -6`, swap an invisible spacer 2000 to 0. In code: ScrollTrigger scrub on `.logo{scale}` + nav height.
6. Loader as an object: top and bottom red covers (60%/40% height) that split open at `1500ms cubic-bezier(.55,.055,.675,.19)` after a `3s power2.inOut` progress (scissors on a dashed line, 5 dots with staggered 2.4 to 2.8s `inOutCubic`, 3-strip rolling counter with `y = -(v/100)*20`, etc.). Logo letters: `y:-300 to 0, 2s, power1.out, stagger{each:.05,from:'center'}`.
7. Blur-line text reveal: `SplitText.create(el,{type:'lines',autoSplit:true,onSplit:s=>gsap.fromTo(s.lines,{opacity:0,filter:'blur(10px)',y:15},{opacity:1,filter:'blur(0)',y:0,duration:.4,ease:'power1.out',stagger:.12,scrollTrigger:{trigger:el,start:'top 85%'}})})`. Hero variant: `.6s`, stagger `.10`.
8. Ticket-stub hover and circular "Explore more" cursor. Stub: `y:16, rotate:5deg, .5s cubic-bezier(.579,.423,.17,1.452)` plus Lottie scrub to frame 100; ring CTA: CircleType radius `0.9*size`, `rotate:-360, 15s linear, repeat:-1`, circle `scale 0 to 1.1 .4s inOutQuad`, `x,y` lean `-26..26px` by pointer, `cursor:none` on the target.

Also reuse: `Lenis lerp .07` + `ScrollTrigger.update` + `gsap.ticker` wiring, and the overall rule: one colour, three fonts, hairlines, 120% line-height, 20px frame.

Caveat: I did not take pixel timing of the 0.5s switch via screenshots (headless screenshots took ~900ms each on this page). Values come from the inline source and IX JSON, and endpoints were verified by computed styles (scale 1 at 16900, .45 at 17000).
