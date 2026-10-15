import { gsap } from "gsap";
import { CustomEase } from "gsap/CustomEase";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { SplitText } from "gsap/SplitText";
import { ScrambleTextPlugin } from "gsap/ScrambleTextPlugin";
import { MorphSVGPlugin } from "gsap/MorphSVGPlugin";
import { Draggable } from "gsap/Draggable";
import { bus, type Mode, type Phase } from "./bus";

gsap.registerPlugin(CustomEase, ScrollTrigger, SplitText, ScrambleTextPlugin, MorphSVGPlugin, Draggable);

/**
 * One ease pair for almost everything (expoOut to settle, expoInOut to travel), plus a soft settle
 * for list steps. CSS mirrors these as --ease-out, --ease-io and --ease-settle in tokens.css.
 */
CustomEase.create("expoOut", "0.19,1,0.22,1");
CustomEase.create("expoInOut", "0.83,0,0.17,1");
CustomEase.create("settleOut", "0.5,1,0.89,1");

/** The only durations. Pick the nearest one rather than inventing a new number. */
export const DUR = { xs: 0.35, s: 0.5, m: 0.9, l: 1.2 } as const;

export const reducedMotion = () => matchMedia("(prefers-reduced-motion: reduce)").matches;
export const finePointer = () => matchMedia("(hover: hover) and (pointer: fine)").matches;

/** Scales a duration to zero under reduced motion */
export const d = (seconds: number) => (reducedMotion() ? 0 : seconds);

let phase: Phase = "idle";
let idleWaiters: (() => void)[] = [];

export const getPhase = () => phase;

export function setPhase(next: Phase) {
  phase = next;
  document.documentElement.dataset.phase = next;
  bus.emit("transition:phase", { phase: next });
  if (next === "idle") {
    const waiters = idleWaiters;
    idleWaiters = [];
    waiters.forEach((fn) => fn());
  }
}

/** Resolves when no page transition is running. Scroll reveals and hover effects wait on this. */
export const whenIdle = () => (phase === "idle" ? Promise.resolve() : new Promise<void>((r) => idleWaiters.push(r)));

export const getMode = (): Mode => (document.documentElement.dataset.mode === "os" ? "os" : "modern");

export { gsap, ScrollTrigger, SplitText, CustomEase, MorphSVGPlugin, Draggable };
