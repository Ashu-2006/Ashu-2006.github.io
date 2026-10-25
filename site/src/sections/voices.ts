import { DUR, SplitText, d, gsap, reducedMotion } from "../core/motion";
import { pad2 } from "../lib/html";

/** How long each quote holds before the next slides in, s. Long enough to read the longest quote twice. */
const DWELL = 14;
/** Delay between words as a quote rises in, s */
const WORD_STAGGER = 0.012;
/** A horizontal drag past this many px moves one quote */
const SWIPE_PX = 50;

/**
 * Voices: a horizontal track, one quote in view. It advances on its own every DWELL seconds and ping-pongs
 * (1 to 4, then back to 1) rather than jumping from the end to the start. It holds while the pointer or
 * keyboard focus is on the section, so someone reading is never cut off, and while it is off screen or the
 * tab is hidden; the bar under it shows the time left. Prev, Next, arrow keys and a drag move it by hand.
 * Each arriving quote's words rise in. Reduced motion: no autoplay, the track moves without easing.
 */
export function mountVoices(root: HTMLElement): () => void {
  const section = root.querySelector<HTMLElement>(".vc");
  const stage = root.querySelector<HTMLElement>("[data-vc]");
  const track = root.querySelector<HTMLElement>("[data-vc-track]");
  const prev = root.querySelector<HTMLButtonElement>("[data-vc-prev]");
  const next = root.querySelector<HTMLButtonElement>("[data-vc-next]");
  const count = root.querySelector<HTMLElement>("[data-vc-n]");
  const bar = root.querySelector<HTMLElement>("[data-vc-bar]");
  if (!section || !stage || !track || !prev || !next) return () => {};
  const slides = Array.from(track.querySelectorAll<HTMLElement>("[data-vc-slide]"));
  if (!slides.length) return () => {};
  const still = reducedMotion();
  const splits = still ? [] : slides.map((s) => SplitText.create(s.querySelector("p")!, { type: "words" }));
  let at = 0;
  let dir = 1;
  let move: gsap.core.Tween | null = null;
  let rise: gsap.core.Timeline | null = null;

  /* Only the quote in view is exposed to assistive tech and the tab order */
  const expose = () =>
    slides.forEach((s, i) => {
      s.classList.toggle("is-on", i === at);
      s.toggleAttribute("inert", i !== at);
      s.setAttribute("aria-hidden", String(i !== at));
    });

  const riseIn = (i: number) => {
    if (still) return;
    rise?.progress(1);
    const who = slides[i].querySelector("figcaption");
    rise = gsap.timeline();
    rise.fromTo(splits[i].words, { y: 20, autoAlpha: 0 }, { y: 0, autoAlpha: 1, duration: d(DUR.s), ease: "expo.out", stagger: WORD_STAGGER }, 0.25);
    if (who) rise.fromTo(who, { y: 20, autoAlpha: 0 }, { y: 0, autoAlpha: 1, duration: d(DUR.s), ease: "expo.out" }, "-=0.3");
  };

  /* --- Dwell timer: a paused tween on the bar; finishing it advances --- */
  const timer = gsap.fromTo(bar ?? {}, { scaleX: 0 }, { scaleX: 1, duration: DWELL, ease: "none", paused: true, onComplete: () => auto() });
  let inView = false;
  let held = false;
  const sync = () => {
    if (still) return;
    if (inView && !held && !document.hidden) timer.play();
    else timer.pause();
  };

  const go = (to: number) => {
    to = Math.max(0, Math.min(slides.length - 1, to));
    if (to === at) return;
    at = to;
    if (count) count.textContent = pad2(at + 1);
    expose();
    move?.kill();
    move = gsap.to(track, { xPercent: -100 * at, duration: still ? 0 : d(1.1), ease: "expo.inOut" });
    riseIn(at);
    timer.restart();
    sync();
  };
  /* Autoplay turns round at either end instead of wrapping */
  const auto = () => {
    if (at + dir < 0 || at + dir >= slides.length) dir = -dir;
    go(at + dir);
  };
  /* By hand: wrap round, and carry on autoplaying in the direction chosen */
  const step = (s: number) => {
    dir = s;
    go((at + s + slides.length) % slides.length);
  };

  expose();
  if (!still) {
    gsap.set(splits[0].words, { autoAlpha: 0 });
    gsap.set(slides[0].querySelector("figcaption"), { autoAlpha: 0 });
  }
  let first = true;
  const io = new IntersectionObserver(
    ([e]) => {
      inView = e.isIntersecting;
      if (inView && first) {
        first = false;
        riseIn(0);
      }
      sync();
    },
    { rootMargin: "0px 0px -15% 0px" },
  );
  io.observe(stage);

  /* Reading holds it: pointer over the quote or its controls (not the whole full-bleed section), or focus inside */
  const nav = prev.parentElement!;
  const hold = () => {
    held = stage.matches(":hover") || nav.matches(":hover") || section.contains(document.activeElement);
    sync();
  };
  /* Focus moving between two controls blurs one before focusing the other: check once it has landed */
  const holdLater = () => setTimeout(hold, 0);
  const onKey = (e: KeyboardEvent) => {
    if (e.key === "ArrowRight") step(1);
    else if (e.key === "ArrowLeft") step(-1);
  };
  let downX: number | null = null;
  const onDown = (e: PointerEvent) => void (downX = e.clientX);
  const onUp = (e: PointerEvent) => {
    if (downX === null) return;
    const dx = e.clientX - downX;
    downX = null;
    if (Math.abs(dx) > SWIPE_PX) step(dx < 0 ? 1 : -1);
  };
  const onPrev = () => step(-1);
  const onNext = () => step(1);
  prev.addEventListener("click", onPrev);
  next.addEventListener("click", onNext);
  for (const el of [stage, nav]) {
    el.addEventListener("pointerenter", hold);
    el.addEventListener("pointerleave", hold);
  }
  section.addEventListener("focusin", hold);
  section.addEventListener("focusout", holdLater);
  section.addEventListener("keydown", onKey);
  stage.addEventListener("pointerdown", onDown);
  window.addEventListener("pointerup", onUp);
  document.addEventListener("visibilitychange", sync);

  return () => {
    timer.kill();
    move?.kill();
    rise?.kill();
    io.disconnect();
    splits.forEach((s) => s.revert());
    prev.removeEventListener("click", onPrev);
    next.removeEventListener("click", onNext);
    for (const el of [stage, nav]) {
      el.removeEventListener("pointerenter", hold);
      el.removeEventListener("pointerleave", hold);
    }
    section.removeEventListener("focusin", hold);
    section.removeEventListener("focusout", holdLater);
    section.removeEventListener("keydown", onKey);
    stage.removeEventListener("pointerdown", onDown);
    window.removeEventListener("pointerup", onUp);
    document.removeEventListener("visibilitychange", sync);
  };
}
