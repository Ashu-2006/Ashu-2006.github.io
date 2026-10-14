import { gsap } from "gsap";
import { bus } from "./bus";
import { reducedMotion } from "./scroll";

/**
 * The route change is the racing stripes crossing the screen. Three pill-ended bands (poppy, rust,
 * harvest) brake in from the left to cover, the page swaps underneath, then they pull away to the right.
 * They lean into the motion and stand straight at rest, so the cover is always complete.
 */
export type Arrival = "load" | "wipe" | "cut";

let arrival: Arrival = "load";
let covered = false;
let cutPending = false;
let waiting: (() => void)[] = [];

const wipe = () => document.querySelector<HTMLElement>("[data-wipe]");
const bars = (el: HTMLElement) => el.querySelectorAll<HTMLElement>("i");

const LEAN = -14;
const OFF = 102;

/** The bars outgrow the viewport by a pill radius on each side, so their rounded ends never show at rest */
function prime(el: HTMLElement) {
  if (el.dataset.primed !== undefined) return;
  el.dataset.primed = "";
  gsap.set(el, { overflow: "hidden" });
  gsap.set(bars(el), {
    width: "calc(100% + 36vh)",
    marginLeft: "-18vh",
    marginBlock: "-1px",
    borderRadius: "999px",
    x: 0,
    xPercent: -OFF,
    skewX: 0,
    force3D: true,
  });
}

const settle = (tl: gsap.core.Timeline) => new Promise<void>((resolve) => tl.eventCallback("onComplete", () => resolve()));

function release() {
  covered = false;
  document.documentElement.removeAttribute("data-arrival");
  const list = waiting;
  waiting = [];
  list.forEach((fn) => fn());
}

/** The next route change cuts straight across, because the outgoing page already shows the incoming one */
export function cutNext() {
  cutPending = true;
}

/** Drops a cut that was asked for but never used (the router was busy) */
export function clearCut() {
  cutPending = false;
}

/** How the page that is mounting arrived: first load, under the stripes, or a straight cut */
export const arriving = (): Arrival => arrival;

let introDone = false;
bus.on("intro:done", () => {
  introDone = true;
  if (!covered) release();
});

/** Resolves as the page is uncovered: the stripes start to leave, or on first load the loader lets go */
export function whenRevealing(): Promise<void> {
  const loading = arrival === "load" && !introDone && !reducedMotion();
  if (!covered && !loading) return Promise.resolve();
  return new Promise((resolve) => {
    waiting.push(resolve);
    if (loading) setTimeout(resolve, 5000);
  });
}

export function cover(): Promise<void> {
  const el = wipe();
  covered = true;
  if (cutPending) {
    cutPending = false;
    arrival = "cut";
    document.documentElement.dataset.arrival = "cut";
    return Promise.resolve();
  }
  arrival = "wipe";
  if (!el) return Promise.resolve();
  prime(el);
  const b = bars(el);
  gsap.killTweensOf([el, ...b]);
  if (reducedMotion()) {
    gsap.set(b, { xPercent: 0, skewX: 0 });
    gsap.set(el, { opacity: 0 });
    return settle(gsap.timeline().to(el, { opacity: 1, duration: 0.15, ease: "none" }));
  }
  gsap.set(el, { opacity: 1 });
  gsap.set(b, { xPercent: -OFF, skewX: LEAN });
  const tl = gsap.timeline();
  tl.to(b, { xPercent: 0, duration: 0.56, ease: "power3.out", stagger: 0.06 }, 0);
  tl.to(b, { skewX: 0, duration: 0.62, ease: "power2.out", stagger: 0.06 }, 0);
  return settle(tl);
}

export async function reveal(): Promise<void> {
  const el = wipe();
  const cut = arrival === "cut";
  release();
  if (cut || !el) return;
  const b = bars(el);
  if (reducedMotion()) {
    await settle(gsap.timeline().to(el, { opacity: 0, duration: 0.15, ease: "none" }));
  } else {
    const tl = gsap.timeline();
    tl.to(b, { xPercent: OFF, duration: 0.7, ease: "power2.in", stagger: 0.06 }, 0.04);
    tl.to(b, { skewX: LEAN, duration: 0.45, ease: "power2.in", stagger: 0.06 }, 0.04);
    await settle(tl);
  }
  gsap.set(b, { xPercent: -OFF, skewX: 0 });
  gsap.set(el, { opacity: 1 });
}
