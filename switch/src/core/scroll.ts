import Lenis from "lenis";
import { gsap, ScrollTrigger, reducedMotion } from "./motion";

export let lenis: Lenis | null = null;

/** Lenis drives the page, GSAP's ticker drives Lenis, ScrollTrigger reads Lenis. */
export function initScroll() {
  lenis = new Lenis({ lerp: 0.08, wheelMultiplier: 0.95, smoothWheel: !reducedMotion() });
  lenis.on("scroll", ScrollTrigger.update);
  gsap.ticker.add((time) => lenis?.raf(time * 1000));
  gsap.ticker.lagSmoothing(0);

  /* Lenis owns the scroll position, so a keyboard focus jump below the fold has to be scrolled through it */
  document.addEventListener("focusin", (e) => {
    const el = e.target as HTMLElement | null;
    if (!el || !lenis || lenis.isStopped || !el.matches(":focus-visible") || el.closest("[data-lenis-prevent]")) return;
    const r = el.getBoundingClientRect();
    const top = 96;
    const bottom = innerHeight - 48;
    if (r.top >= top && r.bottom <= bottom) return;
    scrollToTarget(el, { offset: -innerHeight * 0.35, duration: 0.6 });
  });
  return lenis;
}

export function scrollToTarget(target: number | string | HTMLElement, opts: { immediate?: boolean; offset?: number; duration?: number } = {}) {
  const offset = opts.offset ?? 0;
  if (lenis) {
    lenis.scrollTo(target, { offset, immediate: opts.immediate || reducedMotion(), force: true, duration: opts.duration ?? 1.3 });
    return;
  }
  const el = typeof target === "string" ? document.querySelector<HTMLElement>(target) : target;
  const y = typeof el === "number" ? el : el ? el.getBoundingClientRect().top + scrollY + offset : 0;
  window.scrollTo({ top: y, behavior: opts.immediate ? "auto" : "smooth" });
}

export const stopScroll = () => lenis?.stop();
export const startScroll = () => lenis?.start();
