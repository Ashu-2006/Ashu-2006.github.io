import { DUR, ScrollTrigger, gsap, reducedMotion } from "./motion";
import { setTransition, type TransitionRequest } from "./router";

/*
 * The page curtain (auge technique). A cobalt sheet with a domed leading edge rises over the page
 * while the old page drifts up 40px under a 40% dim. A title card scrambles the next page's name in,
 * mixing Instrument Sans and Instrument Serif italic per character, with a 000 to 100 counter. If the
 * click came from a project thumbnail, the image is cloned and flown onto a slot above the title.
 * On reveal the card exits upward, the sheet lifts away and the new page rises from +40px.
 */

type Face = "sans" | "serif";

const GLYPHS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
const FONTS: Record<Face, string> = {
  sans: '600 100px "Instrument Sans"',
  serif: 'italic 400 100px "Instrument Serif"',
};
const widthCache = new Map<Face, Map<string, number>>();
const poolCache = new Map<string, string[]>();

/** Advance widths of every scramble glyph per face, measured once the face has loaded */
function glyphWidths(face: Face): Map<string, number> | null {
  const cached = widthCache.get(face);
  if (cached) return cached;
  const ctx = document.createElement("canvas").getContext("2d");
  if (!ctx) return null;
  ctx.font = FONTS[face];
  const map = new Map<string, number>();
  for (const g of GLYPHS) map.set(g, ctx.measureText(g).width);
  if (document.fonts.check(FONTS[face])) widthCache.set(face, map);
  return map;
}

/** The six glyphs closest in width to `ch`, so a scrambling line never changes length */
function poolFor(face: Face, ch: string): string[] {
  if (!GLYPHS.includes(ch)) return [ch];
  const key = face + ch;
  const hit = poolCache.get(key);
  if (hit) return hit;
  const widths = glyphWidths(face);
  if (!widths) return [ch];
  const target = widths.get(ch) ?? 0;
  const pool = [...GLYPHS].sort((a, b) => Math.abs((widths.get(a) ?? 0) - target) - Math.abs((widths.get(b) ?? 0) - target)).slice(0, 6);
  if (widthCache.has(face)) poolCache.set(key, pool);
  return pool;
}

/** Random faces, a third serif, never three of the same face in a row */
function pickFaces(n: number): Face[] {
  const out: Face[] = [];
  for (let i = 0; i < n; i++) {
    let f: Face = Math.random() < 1 / 3 ? "serif" : "sans";
    if (i >= 2 && out[i - 1] === f && out[i - 2] === f) f = f === "sans" ? "serif" : "sans";
    out.push(f);
  }
  return out;
}

const span = (cls: string, text = "") => {
  const s = document.createElement("span");
  s.className = cls;
  if (text) s.textContent = text;
  return s;
};

export type ScrambleTitle = {
  /** The masked line inners, for rise and exit tweens */
  lines: HTMLElement[];
  /** Adds the line rise and the per-character scramble to `tl` at `at`; returns the scramble length */
  enter(tl: gsap.core.Timeline, at: number, duration?: number): number;
  /** Adds the upward exit to `tl` at `at` */
  exit(tl: gsap.core.Timeline, at: number): void;
};

/**
 * Builds the mixed sans and serif-italic display title inside `host` (which carries the .ts styles):
 * characters get fixed pixel widths, words are grouped into masked lines, and the whole thing is
 * scaled down to fit when a single word is wider than the host.
 */
export function buildScrambleTitle(host: HTMLElement, text: string): ScrambleTitle {
  host.textContent = "";
  host.style.removeProperty("font-size");
  host.setAttribute("aria-label", text);
  const words = text.toUpperCase().split(/\s+/).filter(Boolean);
  const total = words.reduce((n, w) => n + w.length, 0);
  const faces = pickFaces(total);
  const chars: { el: HTMLSpanElement; ch: string; face: Face; at: number }[] = [];
  const wordEls: HTMLSpanElement[] = [];

  let i = 0;
  words.forEach((word, wi) => {
    const w = span("ts__word");
    w.setAttribute("aria-hidden", "true");
    for (const ch of word) {
      const face = faces[i++];
      const c = span(`ts__char ts__char--${face}`, ch);
      w.append(c);
      chars.push({ el: c, ch, face, at: 0 });
    }
    wordEls.push(w);
    host.append(w);
    if (wi < words.length - 1) host.append(" ");
  });

  const room = host.clientWidth;
  const widest = Math.max(...wordEls.map((w) => w.getBoundingClientRect().width), 1);
  if (room > 0 && widest > room) {
    const size = parseFloat(getComputedStyle(host).fontSize);
    host.style.fontSize = `${Math.floor(size * (room / widest) * 0.98)}px`;
  }
  chars.forEach((c) => (c.el.style.width = `${c.el.getBoundingClientRect().width}px`));

  const rows: HTMLSpanElement[][] = [];
  let lastTop = Number.NaN;
  wordEls.forEach((w) => {
    const top = Math.round(w.offsetTop);
    if (top !== lastTop) rows.push([]);
    rows[rows.length - 1].push(w);
    lastTop = top;
  });
  host.textContent = "";
  const lines = rows.map((row) => {
    const mask = span("mask ts__line");
    const inner = span("mask__in");
    row.forEach((w, wi) => {
      inner.append(w);
      if (wi < row.length - 1) inner.append(" ");
    });
    mask.append(inner);
    host.append(mask);
    return inner;
  });

  const order = chars.map((_, k) => k).sort(() => Math.random() - 0.5);
  order.forEach((k, rank) => (chars[k].at = 0.3 + 0.7 * ((rank + 1) / Math.max(order.length, 1))));
  const shuffle = () => {
    chars.forEach((c) => {
      const pool = poolFor(c.face, c.ch);
      c.el.textContent = pool[Math.floor(Math.random() * pool.length)];
    });
  };
  const settle = () => chars.forEach((c) => (c.el.textContent = c.ch));

  if (reducedMotion()) settle();
  else shuffle();

  return {
    lines,
    enter(tl, at, duration) {
      const k = duration ?? Math.max(0.65 - 0.1 * (lines.length - 1), 0.45);
      if (reducedMotion()) {
        settle();
        return 0;
      }
      gsap.set(lines, { yPercent: 130 });
      tl.to(lines, { yPercent: 0, duration: DUR.m, ease: "expoOut", stagger: 0.12 }, at);
      const state = { p: 0 };
      let last = 0;
      tl.to(
        state,
        {
          p: 1,
          duration: k,
          ease: "none",
          onUpdate: () => {
            const now = performance.now();
            const swap = now - last > 50;
            if (swap) last = now;
            for (const c of chars) {
              if (state.p >= c.at) {
                if (c.el.textContent !== c.ch) c.el.textContent = c.ch;
              } else if (swap) {
                const pool = poolFor(c.face, c.ch);
                c.el.textContent = pool[Math.floor(Math.random() * pool.length)];
              }
            }
          },
          onComplete: settle,
        },
        at,
      );
      return k;
    },
    exit(tl, at) {
      tl.to(lines, { yPercent: -130, duration: 0.7, ease: "expoInOut", stagger: 0.1 }, at);
    },
  };
}

/** Pads a counter value to three digits */
export const counterText = (v: number) => String(Math.round(v)).padStart(3, "0");

/**
 * Everything that drifts with the page under the curtain. #main moves by transform (no layout shift) unless a
 * ScrollTrigger pin is active inside it; a transform would then re-parent the fixed pin, so it falls back to `top`.
 * Chrome rows always move by transform.
 */
export function pageShift() {
  const main = document.getElementById("main");
  const rows = Array.from(document.querySelectorAll<HTMLElement>("[data-page-shift]"));
  const prop = ScrollTrigger.getAll().some((t) => t.isActive && t.pin && main?.contains(t.pin)) ? "top" : "y";
  return {
    set(y: number) {
      if (main) gsap.set(main, { [prop]: y });
      gsap.set(rows, { y });
    },
    to(tl: gsap.core.Timeline, y: number, duration: number, at: number) {
      if (main) tl.to(main, { [prop]: y, duration, ease: "expoInOut" }, at);
      tl.to(rows, { y, duration, ease: "expoInOut" }, at);
    },
    clear() {
      if (main) gsap.set(main, { clearProps: "top,transform" });
      gsap.set(rows, { clearProps: "transform" });
    },
  };
}

const el = <K extends keyof HTMLElementTagNameMap>(tag: K, cls: string, parent: HTMLElement) => {
  const node = document.createElement(tag);
  node.className = cls;
  parent.append(node);
  return node;
};

/** Registers the curtain with the router. Builds its layers once inside #overlay. */
export function initTransition() {
  const overlay = document.getElementById("overlay");
  if (!overlay || overlay.querySelector(".curtain")) return;

  const dim = el("div", "curtain-dim", overlay);
  const root = el("div", "curtain", overlay);
  root.setAttribute("aria-hidden", "true");
  const sheet = el("div", "curtain__sheet", root);
  el("div", "curtain__bg", sheet);
  const card = el("div", "curtain__card", root);
  const slotMask = el("div", "curtain__slot-mask", card);
  const slot = el("div", "curtain__slot", slotMask);
  const slotImg = el("img", "curtain__slot-img", slot);
  slotImg.alt = "";
  const titleHost = el("div", "curtain__title ts", card);
  const count = el("div", "curtain__count label mask", root);
  const countIn = el("span", "mask__in", count);
  countIn.textContent = "000";

  let coverTl: gsap.core.Timeline | null = null;
  let releaseTl: gsap.core.Timeline | null = null;
  let flipTween: gsap.core.Tween | null = null;
  let flipEl: HTMLElement | null = null;
  let hidden: HTMLElement | null = null;
  let title: ScrambleTitle | null = null;
  let started = 0;
  let readyAt = 0;
  let ownsBusy = false;

  const html = document.documentElement;
  const setBusy = (on: boolean) => {
    if (on && !html.hasAttribute("data-busy")) {
      html.dataset.busy = "";
      ownsBusy = true;
    } else if (!on && ownsBusy) {
      delete html.dataset.busy;
      ownsBusy = false;
    }
  };

  /** Puts every layer back to rest. Safe to call at any point. */
  const reset = () => {
    coverTl?.kill();
    releaseTl?.kill();
    flipTween?.kill();
    coverTl = releaseTl = flipTween = null;
    flipEl?.remove();
    flipEl = null;
    if (hidden) hidden.style.removeProperty("visibility");
    hidden = null;
    title = null;
    titleHost.textContent = "";
    card.classList.remove("has-thumb");
    slotImg.removeAttribute("src");
    slotImg.removeAttribute("style");
    slot.removeAttribute("style");
    countIn.textContent = "000";
    root.classList.remove("is-active", "is-blocking");
    gsap.set([root, sheet, slotMask.firstElementChild, countIn, dim], { clearProps: "all" });
    pageShift().clear();
    setBusy(false);
    delete html.dataset.curtain;
  };

  /** Clones the clicked thumbnail at its rect and flies it onto the slot above the title */
  const flip = (thumb: HTMLElement, tl: gsap.core.Timeline) => {
    const media = thumb.matches("img, video") ? thumb : thumb.querySelector<HTMLImageElement | HTMLVideoElement>("img, video");
    const src = media instanceof HTMLImageElement ? media.currentSrc || media.src : media instanceof HTMLVideoElement ? media.poster : "";
    const from = thumb.getBoundingClientRect();
    if (!src || !media || from.width < 2 || from.height < 2) return 0;
    const inner = media.getBoundingClientRect();

    /* Match the source frame: its aspect (clamped), its fit and position, and its painted backdrop,
       so a cover shown whole on paper-2 lands whole, and a crop lands as the same crop */
    const mcs = getComputedStyle(media);
    const fit = { objectFit: mcs.objectFit, objectPosition: mcs.objectPosition };
    let backdrop = "";
    for (let n: Element | null = media; n && n !== thumb.parentElement; n = n.parentElement) {
      const bg = getComputedStyle(n).backgroundColor;
      if (!/^(transparent|rgba\(0, 0, 0, 0\))$/.test(bg)) {
        backdrop = bg;
        break;
      }
    }
    const aspect = Math.min(2, Math.max(0.75, from.width / from.height));
    slot.style.aspectRatio = String(aspect);
    if (backdrop) slot.style.backgroundColor = backdrop;
    Object.assign(slotImg.style, fit);

    slotImg.src = src;
    card.classList.add("has-thumb");
    slotImg.style.visibility = "hidden";
    const to = slot.getBoundingClientRect();

    const box = document.createElement("div");
    box.className = "curtain-flip";
    const img = document.createElement("img");
    img.src = src;
    img.alt = "";
    Object.assign(img.style, fit);
    if (backdrop) box.style.backgroundColor = backdrop;
    box.append(img);
    overlay.append(box);
    gsap.set(box, { left: from.left, top: from.top, width: from.width, height: from.height });
    gsap.set(img, { left: inner.left - from.left, top: inner.top - from.top, width: inner.width, height: inner.height });
    flipEl = box;
    hidden = thumb;
    thumb.style.visibility = "hidden";

    tl.to(box, { left: to.left, top: to.top, width: to.width, height: to.height, duration: DUR.l, ease: "expoOut" }, 0);
    tl.to(img, { left: 0, top: 0, width: to.width, height: to.height, duration: DUR.l, ease: "expoOut" }, 0);
    tl.call(
      () => {
        slotImg.style.visibility = "visible";
        box.remove();
        if (flipEl === box) flipEl = null;
      },
      [],
      DUR.l,
    );
    return DUR.l;
  };

  setTransition({
    cover(req: TransitionRequest) {
      if (releaseTl) releaseTl.progress(1);
      reset();
      setBusy(true);
      root.classList.add("is-active", "is-blocking");
      html.dataset.curtain = "";
      started = performance.now();
      const shift = pageShift();

      if (reducedMotion()) {
        gsap.set(sheet, { yPercent: 0, y: 0 });
        title = buildScrambleTitle(titleHost, req.title);
        gsap.set(count, { autoAlpha: 0 });
        readyAt = 0;
        return new Promise<void>((resolve) => {
          coverTl = gsap.timeline({ onComplete: resolve });
          coverTl.fromTo(root, { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.2, ease: "none" });
        });
      }

      const quick = req.quick;
      const len = quick ? DUR.s : DUR.m;
      const tl = gsap.timeline();
      coverTl = tl;
      gsap.set(sheet, { yPercent: 100, y: 40 });
      tl.to(sheet, { yPercent: 0, y: 0, duration: len, ease: "expoInOut" }, 0);
      shift.to(tl, -40, len, 0);
      tl.fromTo(dim, { opacity: 0 }, { opacity: 0.4, duration: len, ease: req.thumb ? "none" : "expoInOut" }, 0);
      readyAt = len;

      if (!quick) {
        title = buildScrambleTitle(titleHost, req.title);
        const flipLen = req.thumb ? flip(req.thumb, tl) : 0;
        const at = 0.42;
        const k = title.enter(tl, at);
        gsap.set(countIn, { yPercent: 130 });
        tl.to(countIn, { yPercent: 0, duration: DUR.m, ease: "expoOut" }, 0.3);
        const counter = { v: 0 };
        tl.to(counter, { v: 100, duration: at + k - 0.3, ease: "none", onUpdate: () => (countIn.textContent = counterText(counter.v)) }, 0.3);
        readyAt = Math.max(at + k, flipLen, len);
      }

      return new Promise<void>((resolve) => tl.call(resolve, [], len));
    },

    reveal(req: TransitionRequest) {
      const shift = pageShift();
      gsap.set(dim, { opacity: 0 });

      if (reducedMotion()) {
        return new Promise<void>((resolve) => {
          releaseTl = gsap.timeline({
            onComplete: () => {
              releaseTl = null;
              reset();
              resolve();
            },
          });
          releaseTl.to(root, { autoAlpha: 0, duration: 0.2, ease: "none" });
        });
      }

      const quick = req.quick;
      const len = quick ? DUR.s : DUR.m;
      const hold = quick ? 0 : req.thumb ? 0.4 : 0.2;
      const elapsed = (performance.now() - started) / 1000;
      const wait = Math.max(0, readyAt + hold - elapsed);
      shift.set(40);

      return new Promise<void>((resolve) => {
        const tl = gsap.timeline({
          delay: wait,
          onComplete: () => {
            releaseTl = null;
            reset();
          },
        });
        releaseTl = tl;
        const sheetAt = quick ? 0 : 0.12;
        if (title) title.exit(tl, 0);
        if (!quick) {
          tl.to(slotMask.firstElementChild, { yPercent: -130, duration: 0.7, ease: "expoInOut" }, 0);
          tl.to(countIn, { yPercent: -130, duration: 0.7, ease: "expoInOut" }, 0.1);
        }
        tl.to(sheet, { yPercent: -100, y: -40, duration: len, ease: "expoInOut" }, sheetAt);
        shift.to(tl, 0, len, sheetAt);
        tl.call(() => root.classList.remove("is-blocking"), [], sheetAt + len * 0.5);
        tl.call(() => setBusy(false), [], sheetAt + len * 0.5);
        tl.call(resolve, [], sheetAt + len * (quick ? 0.6 : 0.5));
      });
    },
  });
}
