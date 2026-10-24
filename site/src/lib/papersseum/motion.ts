/**
 * Character motion for the Papersseum pixel bots, ported from web/components/character/character-idle.ts (anime.js)
 * to GSAP with the same durations, curves and seeded timing. Units are SVG user units: 1 is one pixel cell.
 * Reduced motion and the "still" state add nothing, so the static pose stands.
 */
import { CustomEase, gsap, reducedMotion } from "../../core/motion";
import { PLAYER_COLORS, type CharacterState } from "./character";

const MS = { instant: 70, fast: 140, moderate: 240, slow: 420, loop: 1600 } as const;
const s = (ms: number) => ms / 1000;
const EASE = {
  smooth: CustomEase.create("ppSmooth", "0.23,1,0.32,1"),
  swing: CustomEase.create("ppSwing", "0.32,0.72,0,1"),
  move: CustomEase.create("ppMove", "0.77,0,0.175,1"),
};
const HOP = "power2.out";
const BLINK_GAP: [number, number] = [3000, 5000];
const WIGGLE_GAP: [number, number] = [2600, 4400];
const GLANCE_GAP: [number, number] = [5200, 8400];
const GAZE_REACH = 0.5;
const WIN_HOPS = [2, 2, 3];
const DROP_MAX = 3;

function hash(str: string) {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}
const phase = (key: string) => hash(key) / 4294967296;
const between = ([lo, hi]: [number, number], t: number) => lo + (hi - lo) * t;

type Parts = { svg: SVGSVGElement; figure: SVGGElement; antenna: SVGGElement; gaze: SVGGElement; lids: SVGGElement; rects: SVGRectElement[]; accents: SVGRectElement[]; bodies: SVGRectElement[] };

function parts(svg: SVGSVGElement): Parts | null {
  const layer = (n: string) => svg.querySelector<SVGGElement>(`[data-layer="${n}"]`);
  const figure = layer("figure");
  const antenna = layer("antenna");
  const gaze = layer("gaze");
  const lids = layer("lids");
  if (!figure || !antenna || !gaze || !lids) return null;
  const rects = Array.from(svg.querySelectorAll<SVGRectElement>("rect"));
  return { svg, figure, antenna, gaze, lids, rects, accents: rects.filter((r) => r.classList.contains("bot__accent")), bodies: rects.filter((r) => r.classList.contains("bot__body")) };
}

/**
 * Starts a bot's motion for a state and returns the cleanup. `lookAt` makes the eyes follow the pointer by up to
 * half a cell instead of glancing on their own.
 */
export function animateBot(svg: SVGSVGElement, o: { state: CharacterState; seed: string; lookAt?: boolean }) {
  const p = parts(svg);
  if (!p || reducedMotion() || o.state === "still") return () => {};
  const anims: gsap.core.Animation[] = [];
  const offs: (() => void)[] = [];
  const seed = o.seed;
  gsap.set([p.figure, p.lids], { transformOrigin: "50% 100%" });
  gsap.set(p.lids, { transformOrigin: "50% 50%" });

  if (o.state === "dead") {
    anims.push(gsap.to(svg, { opacity: 0.3, duration: s(MS.slow), ease: EASE.smooth }));
    anims.push(gsap.to(p.rects, { y: (_i, el: SVGRectElement) => 1 + (hash(`${seed}:${el.getAttribute("x")},${el.getAttribute("y")}`) % DROP_MAX), duration: s(MS.slow), ease: EASE.smooth }));
    return () => anims.forEach((a) => a.kill());
  }

  /* Blink: the eye row closes toward its middle */
  const blinkGap = between(BLINK_GAP, phase(`${seed}/blink-gap`));
  anims.push(
    gsap
      .timeline({ repeat: -1, repeatDelay: s(blinkGap), delay: s(phase(`${seed}/blink`) * blinkGap) })
      .to(p.lids, { scaleY: 0.1, duration: s(MS.fast / 2), ease: EASE.smooth })
      .to(p.lids, { scaleY: 1, duration: s(MS.fast / 2), ease: EASE.smooth }),
  );

  /* Antenna wiggle, one cell each way */
  if (p.antenna.childElementCount) {
    const gap = between(WIGGLE_GAP, phase(`${seed}/wiggle-gap`));
    const dir = phase(`${seed}/wiggle-dir`) < 0.5 ? -1 : 1;
    anims.push(
      gsap
        .timeline({ repeat: -1, repeatDelay: s(gap), delay: s(phase(`${seed}/wiggle`) * gap) })
        .to(p.antenna, { x: dir, duration: s(MS.moderate), ease: EASE.swing })
        .to(p.antenna, { x: -dir, duration: s(MS.slow), ease: EASE.swing })
        .to(p.antenna, { x: 0, duration: s(MS.moderate), ease: EASE.swing }),
    );
  }

  if (o.state === "working") {
    const L = MS.loop;
    anims.push(
      gsap
        .timeline({ repeat: -1, delay: s(phase(`${seed}/work`) * L) })
        .to(p.figure, { scaleY: 0.92, duration: s(L * 0.15), ease: EASE.smooth })
        .to(p.figure, { y: -2, scaleY: 1.05, duration: s(L * 0.3), ease: HOP })
        .to(p.figure, { y: 0, scaleY: 1, duration: s(L * 0.25), ease: EASE.move })
        .to(p.figure, { scaleY: 0.94, duration: s(L * 0.06), ease: EASE.smooth })
        .to(p.figure, { scaleY: 1, duration: s(L * 0.24), ease: EASE.smooth }),
    );
  }

  if (o.state === "win") {
    /* Three hops read as one bounce: each landing squashes and the next take-off stretches out of it */
    const tl = gsap.timeline();
    for (const h of WIN_HOPS) {
      tl.to(p.figure, { y: -h, scaleY: 1.05, duration: s(MS.fast + MS.instant), ease: HOP }).to(p.figure, { y: 0, scaleY: 0.9, duration: s(MS.fast), ease: EASE.move });
    }
    tl.to(p.figure, { scaleY: 1, duration: s(MS.fast), ease: EASE.smooth });
    /* The accent cells flash through all five player colours, rippling out from the centre */
    const cells = p.accents.length ? p.accents : p.bodies;
    const flash = gsap.timeline();
    PLAYER_COLORS.forEach((c) => flash.to(cells, { fill: c, duration: s(MS.instant), ease: "none", stagger: { each: 0.012, grid: [12, 12], from: "center" } }));
    flash.to(cells, { fill: "", duration: s(MS.fast), ease: "none", clearProps: "fill" });
    tl.add(flash, `-=${s(MS.fast)}`);
    anims.push(tl);
  }

  if (o.lookAt) {
    const qx = gsap.quickTo(p.gaze, "x", { duration: s(MS.moderate), ease: EASE.smooth });
    const qy = gsap.quickTo(p.gaze, "y", { duration: s(MS.moderate), ease: EASE.smooth });
    const onMove = (e: PointerEvent) => {
      const r = svg.getBoundingClientRect();
      if (!r.width) return;
      const dx = (e.clientX - r.left - r.width / 2) / r.width;
      const dy = (e.clientY - r.top - r.height / 2) / r.height;
      const len = Math.hypot(dx, dy);
      const k = len > 0 ? Math.min(1, len) / len : 0;
      qx(Math.round(dx * k * GAZE_REACH * 2) / 2);
      qy(Math.round(dy * k * GAZE_REACH * 2) / 2);
    };
    window.addEventListener("pointermove", onMove, { passive: true });
    offs.push(() => window.removeEventListener("pointermove", onMove));
  } else {
    const gap = between(GLANCE_GAP, phase(`${seed}/glance-gap`));
    const d = (phase(`${seed}/glance-dir`) < 0.5 ? -1 : 1) * GAZE_REACH;
    anims.push(
      gsap
        .timeline({ repeat: -1, repeatDelay: s(gap), delay: s(phase(`${seed}/glance`) * gap) })
        .to(p.gaze, { x: d, duration: s(MS.moderate), ease: EASE.smooth })
        .to(p.gaze, { x: 0, duration: s(MS.moderate), ease: EASE.smooth }, `+=${s(MS.loop)}`)
        .to(p.gaze, { x: -d, duration: s(MS.moderate), ease: EASE.smooth }, `+=${s(gap)}`)
        .to(p.gaze, { x: 0, duration: s(MS.moderate), ease: EASE.smooth }, `+=${s(MS.loop)}`),
    );
  }

  return () => {
    anims.forEach((a) => a.kill());
    offs.forEach((f) => f());
    gsap.set([p.figure, p.antenna, p.gaze, p.lids, ...p.rects], { clearProps: "transform" });
    gsap.set(svg, { clearProps: "opacity" });
    p.rects.forEach((r) => r.style.removeProperty("fill"));
  };
}
