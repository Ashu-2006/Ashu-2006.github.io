import "./style.css";
import { mountScrambles } from "./scramble";
import { mountWork } from "./work";

const IMAGES = Array.from({ length: 8 }, (_, i) => `${import.meta.env.BASE_URL}images/photo-${i + 1}.jpg`);
const SLOT_INTERVAL_MS = 1000;
const SKIP_EVENTS = ["pointerdown", "keydown", "wheel", "touchstart", "resize"] as const;

const hero = document.getElementById("hero")!;
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

function runIntro(onDone: () => void) {
  const anims = hero.getAnimations({ subtree: true }).filter((a) => a instanceof CSSAnimation && a.animationName.startsWith("hero-"));
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

mountSlot(hero.querySelector<HTMLElement>("[data-slot-inner]")!);
const scrambles = mountScrambles(hero);
runIntro(() => scrambles.forEach((s) => s.markDirty()));
mountWork(document.getElementById("work")!);
