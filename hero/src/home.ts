import { mountScrambles } from "./scramble";
import { indexReveal } from "./reveal";

const IMAGES = Array.from({ length: 8 }, (_, i) => `${import.meta.env.BASE_URL}images/photo-${i + 1}.jpg`);
const SLOT_INTERVAL_MS = 1000;
const FONT_WAIT_MS = 1200;
const SKIP_EVENTS = ["pointerdown", "keydown", "wheel", "touchstart", "resize"] as const;

const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

function mountSlot(inner: HTMLElement) {
  const start = Math.floor(Math.random() * IMAGES.length);
  const imgs = IMAGES.map((src, i) => {
    const img = new Image();
    img.src = src;
    img.alt = "";
    img.decoding = "async";
    if (i === start) {
      img.dataset.on = "";
      img.fetchPriority = "high";
    }
    inner.append(img);
    return img;
  });

  let index = start;
  let timer = 0;
  const step = () => {
    delete imgs[index].dataset.on;
    index = (index + 1) % imgs.length;
    imgs[index].dataset.on = "";
  };
  const run = () => {
    window.clearInterval(timer);
    if (!document.hidden) timer = window.setInterval(step, SLOT_INTERVAL_MS);
  };
  if (reduced || imgs.length < 2) return;
  run();
  document.addEventListener("visibilitychange", run);
}

function runIntro(hero: HTMLElement, onDone: () => void) {
  const anims = hero
    .getAnimations({ subtree: true })
    .filter((a) => a instanceof CSSTransition || (a instanceof CSSAnimation && a.animationName.startsWith("hero-")));
  const skip = () => anims.forEach((a) => a.finish());
  const detach = () => SKIP_EVENTS.forEach((e) => window.removeEventListener(e, skip));

  SKIP_EVENTS.forEach((e) => window.addEventListener(e, skip, { passive: true }));
  if (window.scrollY > window.innerHeight / 2) skip();

  Promise.all(anims.map((a) => a.finished))
    .then(() => {
      detach();
      hero.dataset.state = "done";
      onDone();
    })
    .catch(() => detach());
}

export function mountHome() {
  const hero = document.getElementById("hero")!;
  mountSlot(hero.querySelector<HTMLElement>("[data-slot-inner]")!);
  const scrambles = mountScrambles(hero);
  const reveals = [...hero.querySelectorAll<HTMLElement>("[data-reveal]")];

  /* Hold the intro until the display face is in, so rows are measured once and the letters rise in the real font */
  let fontsLate = false;
  const relayout = () => scrambles.forEach((s) => s.layoutRows());
  const fontWait = new Promise((r) => window.setTimeout(r, FONT_WAIT_MS));
  const fontsIn = document.fonts.load('500 1em "Host Grotesk"').catch(() => []);
  fontsIn.then(() => (hero.dataset.state === "done" ? relayout() : (fontsLate = true)));

  Promise.race([fontsIn, fontWait]).then(() => {
    fontsLate = false;
    relayout();
    reveals.forEach(indexReveal);
    requestAnimationFrame(() => {
      hero.dataset.go = "";
      reveals.forEach((r) => (r.dataset.in = ""));
      runIntro(hero, () => {
        if (fontsLate) relayout();
        scrambles.forEach((s) => s.markDirty());
      });
    });
  });
}
