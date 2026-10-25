import { finePointer, gsap, reducedMotion } from "../core/motion";
import { lenis } from "../core/scroll";

/** Resting drift, px per second */
const SPEED = 28;
/** Scroll velocity (px per frame, from Lenis) to drift speed. Scrolling down pushes the rail forward. */
const SCROLL_GAIN = 9;
/** How quickly the drift settles back to SPEED, per second; higher is snappier */
const SETTLE = 2.4;
/** A pointer must travel this far before a press becomes a drag (and the tile's click is cancelled) */
const DRAG_PX = 6;

/**
 * Playground ticker: two identical tracks drift left forever as one flat strip. Scrolling adds speed, hovering
 * eases it to a stop, dragging scrubs it with a flick on release. Runs only while on screen. Reduced motion
 * keeps the plain scrollable row from the stylesheet.
 */
export function mountTicker(root: ParentNode): () => void {
  const rail = root.querySelector<HTMLElement>("[data-tk-rail]");
  const tracks = rail ? Array.from(rail.querySelectorAll<HTMLElement>(".tk__track")) : [];
  if (!rail || tracks.length !== 2 || reducedMotion()) return () => {};
  rail.classList.add("is-live");

  let trackW = 1;
  const measure = () => {
    trackW = tracks[0].offsetWidth || 1;
  };
  measure();

  let x = 0;
  let speed = SPEED;
  let hover = false;
  let drag: { id: number; last: number; t: number; v: number; moved: boolean } | null = null;

  const render = () => {
    const shift = `translate3d(${-x}px,0,0)`;
    tracks.forEach((t) => (t.style.transform = shift));
  };

  const tick = (_t: number, deltaMs: number) => {
    const dt = Math.min(deltaMs, 64) / 1000;
    if (!drag) {
      const target = hover ? 0 : SPEED + (lenis?.velocity ?? 0) * SCROLL_GAIN;
      speed += (target - speed) * Math.min(1, dt * SETTLE);
      x += speed * dt;
    }
    x = ((x % trackW) + trackW) % trackW;
    render();
  };

  let running = false;
  const run = (on: boolean) => {
    if (on === running) return;
    running = on;
    if (on) gsap.ticker.add(tick);
    else gsap.ticker.remove(tick);
  };
  let visible = false;
  const sync = () => run(visible && !document.hidden);
  const io = new IntersectionObserver(([e]) => {
    visible = e.isIntersecting;
    sync();
  });
  io.observe(rail);
  document.addEventListener("visibilitychange", sync);
  const ro = new ResizeObserver(() => {
    measure();
    render();
  });
  ro.observe(rail);
  render();

  const fine = finePointer();
  const onEnter = () => (hover = fine);
  const onLeave = () => (hover = false);
  const onDown = (e: PointerEvent) => {
    if (e.button !== 0) return;
    drag = { id: e.pointerId, last: e.clientX, t: performance.now(), v: 0, moved: false };
  };
  const onMove = (e: PointerEvent) => {
    if (!drag || e.pointerId !== drag.id) return;
    const dx = e.clientX - drag.last;
    if (!drag.moved) {
      if (Math.abs(dx) < DRAG_PX) return;
      drag.moved = true;
      rail.setPointerCapture(e.pointerId);
      rail.classList.add("is-dragging");
    }
    const now = performance.now();
    drag.v = (-dx / Math.max(1, now - drag.t)) * 1000;
    drag.t = now;
    drag.last = e.clientX;
    x -= dx;
  };
  const onUp = (e: PointerEvent) => {
    if (!drag || e.pointerId !== drag.id) return;
    if (drag.moved) {
      /* The flick carries on and settles back to the resting drift */
      speed = Math.max(-2400, Math.min(2400, drag.v));
      rail.classList.remove("is-dragging");
      /* Swallow the click that ends a drag, so releasing over a tile does not open it */
      rail.addEventListener("click", stopClick, { capture: true, once: true });
      window.setTimeout(() => rail.removeEventListener("click", stopClick, true), 0);
    }
    drag = null;
  };
  const stopClick = (c: Event) => c.preventDefault();
  const onFocus = () => (hover = true);
  const noNativeDrag = (e: DragEvent) => e.preventDefault();
  rail.addEventListener("pointerenter", onEnter);
  rail.addEventListener("pointerleave", onLeave);
  rail.addEventListener("focusin", onFocus);
  rail.addEventListener("focusout", onLeave);
  rail.addEventListener("pointerdown", onDown);
  rail.addEventListener("pointermove", onMove);
  rail.addEventListener("pointerup", onUp);
  rail.addEventListener("pointercancel", onUp);
  rail.addEventListener("dragstart", noNativeDrag);

  return () => {
    run(false);
    io.disconnect();
    ro.disconnect();
    document.removeEventListener("visibilitychange", sync);
    rail.removeEventListener("pointerenter", onEnter);
    rail.removeEventListener("pointerleave", onLeave);
    rail.removeEventListener("focusin", onFocus);
    rail.removeEventListener("focusout", onLeave);
    rail.removeEventListener("pointerdown", onDown);
    rail.removeEventListener("pointermove", onMove);
    rail.removeEventListener("pointerup", onUp);
    rail.removeEventListener("pointercancel", onUp);
    rail.removeEventListener("dragstart", noNativeDrag);
    rail.classList.remove("is-live", "is-dragging");
  };
}
