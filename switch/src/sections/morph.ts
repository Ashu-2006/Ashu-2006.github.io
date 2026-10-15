import { DUR, finePointer, gsap, reducedMotion } from "../core/motion";
import { MORPH_SHAPES, SHAPE_BOX } from "./shapes";

const SVG_NS = "http://www.w3.org/2000/svg";
const MAX_TRAILS = 8;
/** On touch the shape walks the track on its own, one way per this many seconds */
const AUTO_SECONDS = 9;
const HALF = SHAPE_BOX / 2;
const STEPS = MORPH_SHAPES.length - 1;

/** Diamond to circle, rotating 90 degrees per checkpoint, as a paused timeline scrubbed by progress */
function morphTimeline(shape: SVGPathElement) {
  const tl = gsap.timeline({ paused: true, defaults: { ease: "none" } });
  for (let i = 1; i <= STEPS; i++) {
    tl.to(
      shape,
      { morphSVG: { shape: MORPH_SHAPES[i], type: "rotational", origin: "50% 50%" }, rotation: 90 * i, svgOrigin: `${HALF} ${HALF}`, duration: 1 },
      i - 1,
    );
  }
  return tl;
}

/**
 * The "Let's talk" morph (neutomni): the pointer's x over `area` scrubs the shape from diamond to circle
 * while it follows along `track`. Each checkpoint it passes leaves a 1px outline that fades out. Touch
 * auto-plays slowly while on screen; reduced motion shows the finished circle, still.
 *
 * Markup: `[data-morph-track]` containing `[data-morph]` (the moving element) with `path[data-morph-shape]`,
 * plus optional `[data-morph-tick]` checkpoint marks (one per shape) that light up as the shape passes.
 */
export function mountMorph(area: HTMLElement, trailClass: string): () => void {
  const track = area.querySelector<HTMLElement>("[data-morph-track]");
  const mover = area.querySelector<HTMLElement>("[data-morph]");
  const shape = area.querySelector<SVGPathElement>("[data-morph-shape]");
  const ticks = Array.from(area.querySelectorAll<HTMLElement>("[data-morph-tick]"));
  if (!track || !mover || !shape) return () => {};
  let lit = -1;
  /** Marks the checkpoint nearest to the shape on the optional scale under the track */
  const light = (p: number) => {
    const k = Math.round(p * STEPS);
    if (k === lit) return;
    lit = k;
    ticks.forEach((t, i) => t.classList.toggle("is-on", i === k));
  };

  const tl = morphTimeline(shape);
  const state = { p: 0 };
  let span = 0;
  let last = 0;
  const trails: SVGSVGElement[] = [];
  const anims: gsap.core.Animation[] = [];

  const measure = () => {
    span = Math.max(0, track.clientWidth - mover.offsetWidth);
  };

  const trail = (k: number) => {
    const svg = document.createElementNS(SVG_NS, "svg");
    svg.setAttribute("viewBox", `0 0 ${SHAPE_BOX} ${SHAPE_BOX}`);
    svg.setAttribute("class", trailClass);
    svg.setAttribute("aria-hidden", "true");
    const path = document.createElementNS(SVG_NS, "path");
    path.setAttribute("d", MORPH_SHAPES[k]);
    path.setAttribute("transform", `rotate(${90 * k} ${HALF} ${HALF})`);
    svg.appendChild(path);
    svg.style.transform = `translate3d(${(k / STEPS) * span}px, -50%, 0)`;
    track.insertBefore(svg, mover);
    trails.push(svg);
    if (trails.length > MAX_TRAILS) trails.shift()?.remove();
    anims.push(
      gsap.fromTo(
        svg,
        { opacity: 1 },
        {
          opacity: 0,
          duration: DUR.l + trails.length * DUR.xs,
          ease: "expoOut",
          onComplete: () => {
            svg.remove();
            const at = trails.indexOf(svg);
            if (at >= 0) trails.splice(at, 1);
          },
        },
      ),
    );
  };

  /** Renders progress: morph, position, and an outline for every checkpoint crossed since the last frame */
  const render = () => {
    const p = gsap.utils.clamp(0, 1, state.p);
    tl.progress(p);
    mover.style.transform = `translate3d(${(p * span).toFixed(1)}px, -50%, 0)`;
    const now = p * STEPS;
    for (let k = Math.ceil(Math.min(last, now)); k <= Math.floor(Math.max(last, now)); k++) {
      if (k !== last) trail(k);
    }
    last = now;
    light(p);
  };

  const cleanups: (() => void)[] = [];
  measure();
  if (reducedMotion()) {
    /* Static: the finished circle resting on its own checkpoint at the end of the track */
    tl.progress(1);
    light(1);
    const place = () => {
      measure();
      mover.style.transform = `translate3d(${span}px, -50%, 0)`;
    };
    place();
    const ro = new ResizeObserver(place);
    ro.observe(track);
    cleanups.push(() => ro.disconnect());
  } else {
    render();
    const ro = new ResizeObserver(() => {
      measure();
      mover.style.transform = `translate3d(${(gsap.utils.clamp(0, 1, state.p) * span).toFixed(1)}px, -50%, 0)`;
    });
    ro.observe(track);
    cleanups.push(() => ro.disconnect());
    if (finePointer()) {
      const onMove = (e: PointerEvent) => {
        const r = track.getBoundingClientRect();
        const target = gsap.utils.clamp(0, 1, span ? (e.clientX - r.left - mover.offsetWidth / 2) / span : 0);
        gsap.to(state, { p: target, duration: DUR.xs, ease: "expoOut", overwrite: true, onUpdate: render });
      };
      area.addEventListener("pointermove", onMove);
      cleanups.push(() => area.removeEventListener("pointermove", onMove));
    } else {
      const auto = gsap.to(state, { p: 1, duration: AUTO_SECONDS, ease: "sine.inOut", yoyo: true, repeat: -1, paused: true, onUpdate: render });
      anims.push(auto);
      const io = new IntersectionObserver(([e]) => (e.isIntersecting ? auto.play() : auto.pause()));
      io.observe(track);
      cleanups.push(() => io.disconnect());
    }
  }

  return () => {
    cleanups.forEach((fn) => fn());
    gsap.killTweensOf(state);
    anims.forEach((a) => a.kill());
    tl.kill();
    trails.forEach((t) => t.remove());
  };
}

/**
 * The small footer mark: the same diamond-to-circle morph, played forward while `link` is hovered or
 * focused and back on leave. No trails, no tracking: it stays light.
 */
export function mountHoverMorph(link: HTMLElement): () => void {
  const shape = link.querySelector<SVGPathElement>("[data-morph-shape]");
  if (!shape || reducedMotion()) return () => {};
  const tl = morphTimeline(shape);
  const state = { p: 0 };
  const go = (p: number) => gsap.to(state, { p, duration: DUR.m, ease: "expoOut", overwrite: true, onUpdate: () => void tl.progress(state.p) });
  const on = () => go(1);
  const off = () => go(0);
  link.addEventListener("pointerenter", on);
  link.addEventListener("pointerleave", off);
  link.addEventListener("focus", on);
  link.addEventListener("blur", off);
  return () => {
    gsap.killTweensOf(state);
    tl.kill();
    link.removeEventListener("pointerenter", on);
    link.removeEventListener("pointerleave", off);
    link.removeEventListener("focus", on);
    link.removeEventListener("blur", off);
  };
}
