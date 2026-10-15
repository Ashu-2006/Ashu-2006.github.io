import Lenis from "lenis";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

export const reducedMotion = () => matchMedia("(prefers-reduced-motion: reduce)").matches;
export const finePointer = () => matchMedia("(pointer: fine)").matches;

export let lenis: Lenis | null = null;

/** Lenis drives the page, GSAP's ticker drives Lenis, ScrollTrigger reads Lenis. Reduced motion is handled inside Lenis. */
export function initScroll() {
  lenis = new Lenis({ lerp: 0.09, wheelMultiplier: 0.95, smoothWheel: true });
  lenis.on("scroll", ScrollTrigger.update);
  gsap.ticker.add((time) => lenis?.raf(time * 1000));
  gsap.ticker.lagSmoothing(0);
  return lenis;
}

export function scrollToTarget(target: number | string | HTMLElement, opts: { immediate?: boolean; offset?: number } = {}) {
  const offset = opts.offset ?? 0;
  if (lenis) {
    lenis.scrollTo(target, { offset, immediate: opts.immediate || reducedMotion(), force: true, duration: 1.4 });
    return;
  }
  const el = typeof target === "string" ? document.querySelector<HTMLElement>(target) : target;
  const y = typeof el === "number" ? el : el ? el.getBoundingClientRect().top + scrollY + offset : 0;
  window.scrollTo({ top: y, behavior: opts.immediate ? "auto" : "smooth" });
}

export const stopScroll = () => lenis?.stop();
export const startScroll = () => lenis?.start();
