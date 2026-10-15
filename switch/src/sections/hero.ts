import { DUR, d, gsap, reducedMotion } from "../core/motion";
import { revealOne } from "../lib/reveal";
import { afterIntro } from "./intro";
import { fitText } from "./kit";
import { mountSwaps } from "./swap";

/** The portrait slot shows the next photo this often, as on the main site */
const SLOT_MS = 1000;

/** Cycles the portraits in the slot while it is on screen and the tab is visible. Still under reduced motion. */
function mountSlot(slot: HTMLElement): () => void {
  const imgs = Array.from(slot.querySelectorAll<HTMLImageElement>("img"));
  if (!imgs.length) return () => {};
  let index = Math.floor(Math.random() * imgs.length);
  imgs[index].classList.add("is-on");
  if (reducedMotion() || imgs.length < 2) return () => {};
  let timer = 0;
  let visible = false;
  /* Swap only once the next photo is decoded, so the slot never flashes empty */
  const step = () => {
    const nextIndex = (index + 1) % imgs.length;
    const next = imgs[nextIndex];
    const swap = () => {
      imgs[index].classList.remove("is-on");
      index = nextIndex;
      next.classList.add("is-on");
    };
    next.decode().then(swap, swap);
  };
  const run = () => {
    clearInterval(timer);
    if (visible && !document.hidden) timer = window.setInterval(step, SLOT_MS);
  };
  const io = new IntersectionObserver(([e]) => {
    visible = e.isIntersecting;
    run();
  });
  io.observe(slot);
  document.addEventListener("visibilitychange", run);
  return () => {
    clearInterval(timer);
    io.disconnect();
    document.removeEventListener("visibilitychange", run);
  };
}

/**
 * Hero: fit the name to its six columns, cycle the portrait, wire the face swap, and play the entrance
 * (characters rise through their masks, the portrait wipes up) once the loader has lifted.
 */
export function mountHero(root: HTMLElement): () => void {
  const hero = root.querySelector<HTMLElement>(".hero");
  const fitBox = root.querySelector<HTMLElement>("[data-hero-fit]");
  const name = root.querySelector<HTMLElement>("[data-hero-name]");
  const slot = root.querySelector<HTMLElement>("[data-hero-slot]");
  if (!hero || !fitBox || !name || !slot) return () => {};
  const cleanups: (() => void)[] = [];
  const anims: gsap.core.Animation[] = [];
  let dead = false;

  cleanups.push(fitText(fitBox, name, "--hero-fs"));
  cleanups.push(mountSlot(slot));
  const { swaps, stop } = mountSwaps(hero);
  cleanups.push(stop);

  /* Rows are measured in the real face; regroup once it has loaded */
  const relayout = () => !dead && swaps.forEach((s) => s.layout(true));
  document.fonts?.load('500 1em "Instrument Sans"').then(relayout, relayout);

  const nameChars = Array.from(name.querySelectorAll<HTMLElement>(".sw__c"));
  const intro = swaps.find((s) => s.root.classList.contains("hero__intro"));
  const scrambles = Array.from(hero.querySelectorAll<HTMLElement>("[data-hero]"));
  hero.classList.add("is-split");

  if (reducedMotion()) {
    gsap.set(slot, { clipPath: "none" });
    scrambles.forEach((el) => gsap.set(el, { visibility: "visible" }));
  } else {
    const introChars = () => (intro ? intro.chars.map((c) => c.el) : []);
    gsap.set([...nameChars, ...introChars()], { yPercent: 120 });
    cleanups.push(
      afterIntro(() => {
        if (dead) return;
        relayout();
        const tl = gsap.timeline({ onComplete: () => swaps.forEach((s) => s.markDirty()) });
        const [l1, l2] = Array.from(name.querySelectorAll<HTMLElement>(".hero__word")).map((w) => Array.from(w.querySelectorAll<HTMLElement>(".sw__c")));
        tl.to(l1 ?? [], { yPercent: 0, duration: d(DUR.l), ease: "expoOut", stagger: 0.04 }, 0);
        tl.to(l2 ?? [], { yPercent: 0, duration: d(DUR.l), ease: "expoOut", stagger: 0.04 }, 0.2);
        tl.fromTo(slot, { clipPath: "inset(100% 0% 0% 0%)" }, { clipPath: "inset(0% 0% 0% 0%)", duration: d(DUR.l), ease: "expoOut" }, 0.35);
        tl.fromTo(slot.querySelectorAll("img"), { scale: 1.2 }, { scale: 1, duration: d(DUR.l), ease: "expoOut" }, 0.35);
        (intro?.rowEls ?? []).forEach((row, r) => {
          const chars = Array.from(row.querySelectorAll<HTMLElement>(".sw__c"));
          tl.to(chars, { yPercent: 0, duration: d(DUR.m), ease: "expoOut", stagger: 0.006 }, 0.5 + r * 0.08);
        });
        anims.push(tl);
        scrambles.forEach((el, i) => {
          el.dataset.reveal = el.dataset.hero;
          el.dataset.delay = String(0.8 + i * 0.1);
          const a = revealOne(el, i);
          if (a) anims.push(a);
        });
      }),
    );
  }

  return () => {
    dead = true;
    anims.forEach((a) => a.kill());
    cleanups.forEach((fn) => fn());
  };
}
