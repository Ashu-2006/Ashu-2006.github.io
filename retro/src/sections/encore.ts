import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { SplitText } from "gsap/SplitText";
import type { Cleanup } from "../core/router";
import { reducedMotion } from "../core/scroll";
import { sound } from "../core/sound";

gsap.registerPlugin(ScrollTrigger, SplitText);

/** Below this column width the address breaks after the @ and is fitted by its longer line */
const STACK_BELOW = 600;
/** Fitted type stops just short of the column, so the unkerned split letters never touch its edge */
const FIT = 0.99;
const COPIED_MS = 2400;
const HINT_MS = 4200;
const STAGGER = 0.03;

const shortcut = () => (/Mac|iPhone|iPad|iPod/.test(navigator.userAgent) ? "Cmd" : "Ctrl");

/** Contact: the address fitted to the column and dropped in like split-flap letters, a copy button, the socials */
export function mount(root: HTMLElement): Cleanup {
  const section = root.querySelector<HTMLElement>(".encore");
  const box = section?.querySelector<HTMLElement>("[data-email-box]");
  const email = section?.querySelector<HTMLAnchorElement>("[data-email]");
  const button = section?.querySelector<HTMLButtonElement>("[data-copy]");
  const roll = section?.querySelector<HTMLElement>("[data-copy-roll]");
  let label = roll?.querySelector<HTMLElement>(".encore__copy-label");
  if (!section || !box || !email || !button || !roll || !label) return () => {};

  const reduce = reducedMotion();
  let alive = true;
  let fittedFor = -1;
  let fitRaf = 0;
  let liveRaf = 0;
  let timer = 0;
  let split: SplitText | null = null;
  let tl: gsap.core.Timeline | null = null;
  let trigger: ScrollTrigger | null = null;

  /**
   * Scale so the line (or the longer stacked line) fills the column. Optical sizing redraws the letters wider
   * as they get smaller, so one proportional step overshoots: re-measure until the size settles.
   */
  const fit = () => {
    const width = box.clientWidth;
    const lines = email.querySelectorAll<HTMLElement>(".encore__email-line");
    if (!width || lines.length < 2) return;
    fittedFor = width;
    const stacked = width < STACK_BELOW;
    const target = width * FIT;
    let size = parseFloat(getComputedStyle(email).fontSize) || 100;
    for (let pass = 0; pass < 5; pass++) {
      email.style.fontSize = `${size}px`;
      const a = lines[0].getBoundingClientRect().width;
      const b = lines[1].getBoundingClientRect().width;
      const span = stacked ? Math.max(a, b) : a + b;
      if (!span) return;
      const next = (size * target) / span;
      if (Math.abs(next - size) < 0.2) {
        size = Math.min(size, next);
        break;
      }
      size = next;
    }
    email.style.fontSize = `${size.toFixed(2)}px`;
  };

  /* Refit on the next frame: resizing inside the observer callback would feed the observer its own change */
  const ro = new ResizeObserver(() => {
    if (box.clientWidth === fittedFor) return;
    cancelAnimationFrame(fitRaf);
    fitRaf = requestAnimationFrame(fit);
  });
  ro.observe(box);
  fit();
  Promise.all([document.fonts.load("800 100px Fraunces"), document.fonts.ready])
    .catch(() => undefined)
    .then(() => {
      if (!alive) return;
      fittedFor = -1;
      fit();
    });

  const settle = () => {
    split?.revert();
    split = null;
    tl = null;
    fittedFor = -1;
    fit();
  };

  if (!reduce) {
    split = SplitText.create(email, { type: "chars", tag: "span", aria: "none", charsClass: "encore__char" });
    const chars = split.chars;
    gsap.set(chars, { rotateX: -95, opacity: 0, transformOrigin: "50% 0%" });
    trigger = ScrollTrigger.create({
      trigger: box,
      start: "top 85%",
      end: "max",
      once: true,
      onEnter: () => {
        const depth = parseFloat(getComputedStyle(email).fontSize) * 6;
        const t = gsap.timeline({ onComplete: settle });
        t.set(chars, { transformPerspective: depth })
          .to(chars, { rotateX: 0, duration: 0.64, ease: "power4.out", stagger: STAGGER }, 0)
          .to(chars, { opacity: 1, duration: 0.12, ease: "none", stagger: STAGGER }, 0);
        for (let i = 0; i < chars.length; i += 3) t.call(() => sound.tick(0.8 + Math.random() * 0.4), [], i * STAGGER + 0.06);
        tl = t;
      },
    });
  }

  const setLabel = (text: string) => {
    if (!label || label.textContent === text) return;
    const prev = label;
    const next = document.createElement("span");
    next.className = "encore__copy-label";
    next.textContent = text;
    prev.setAttribute("aria-hidden", "true");
    roll.append(next);
    label = next;
    if (reduce) {
      prev.remove();
      return;
    }
    gsap.fromTo(next, { yPercent: 110, opacity: 0 }, { yPercent: 0, opacity: 1, duration: 0.45, ease: "power3.out" });
    gsap.to(prev, { yPercent: -110, opacity: 0, duration: 0.45, ease: "power3.out", onComplete: () => prev.remove() });
  };

  /** Clear first, then set on the next frame, so the same message is announced again on a second press */
  const announce = (text: string) => {
    const live = document.querySelector<HTMLElement>("[data-announce]");
    if (!live) return;
    live.textContent = "";
    cancelAnimationFrame(liveRaf);
    liveRaf = requestAnimationFrame(() => (live.textContent = text));
  };

  const copy = async () => {
    const text = button.dataset.copy ?? "";
    window.clearTimeout(timer);
    try {
      if (!navigator.clipboard?.writeText) throw new Error("Clipboard API unavailable");
      await navigator.clipboard.writeText(text);
      if (!alive) return;
      setLabel("Copied");
      announce("Email copied");
      sound.tick(1.3);
      timer = window.setTimeout(() => setLabel("Copy email"), COPIED_MS);
    } catch {
      /* Insecure origin or a denied permission: select the address so the keyboard shortcut copies it */
      if (!alive) return;
      tl?.progress(1);
      const selection = getSelection();
      if (selection) {
        const range = document.createRange();
        range.selectNodeContents(email);
        selection.removeAllRanges();
        selection.addRange(range);
      }
      const hint = `Press ${shortcut()}+C to copy`;
      setLabel(hint);
      announce(hint);
      timer = window.setTimeout(() => setLabel("Copy email"), HINT_MS);
    }
  };

  const onClick = () => void copy();
  button.addEventListener("click", onClick);

  return () => {
    alive = false;
    button.removeEventListener("click", onClick);
    ro.disconnect();
    cancelAnimationFrame(fitRaf);
    cancelAnimationFrame(liveRaf);
    window.clearTimeout(timer);
    trigger?.kill();
    tl?.kill();
    split?.revert();
    gsap.killTweensOf(roll.children);
  };
}
