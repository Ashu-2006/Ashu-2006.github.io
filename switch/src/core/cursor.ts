import { bus } from "./bus";
import { finePointer, getMode, getPhase, gsap, reducedMotion } from "./motion";

/*
 * The cursor (bybang technique). A 14px square with mix-blend-mode: difference that chases the pointer
 * at 38% of the remaining distance per frame. Over links and buttons it leaves the pointer and takes
 * over the element's exact rect. Over media it becomes a 16px circle with a word-masked label, over
 * text a 3x26 I-beam. In OS mode it swaps to pixel-art arrow, hand and hourglass, moved 1:1.
 */

type State = "default" | "link" | "media" | "drag" | "label" | "text" | "hide";
type OsState = "arrow" | "hand" | "busy" | "hide";
type Resolved = { state: State; target: HTMLElement | null; label: string };

const LINK = 'a[href], button:not(:disabled), [data-cursor="link"], [role="button"], [role="switch"], summary, label[for], select';
const TEXT = "p, h1, h2, h3, h4, h5, h6, li, dd, dt, figcaption, blockquote, td, th, time";
const FIELD = 'input:not([type="checkbox"]):not([type="radio"]):not([type="range"]):not([type="button"]):not([type="submit"]), textarea, [contenteditable="true"]';
const HIT = `[data-cursor], [data-cursor-label], ${LINK}`;
const LERP = 0.38;
const PAD = 8;
/** Links bigger than this get the media circle instead of a full rect takeover */
const MAX_RECT = { w: 560, h: 220 };

/*
 * Pixel maps for OS mode. X is the ink outline, O the white fill, "." transparent. 1 cell is 1 CSS px.
 */
const ARROW = [
  "X...........",
  "XX..........",
  "XOX.........",
  "XOOX........",
  "XOOOX.......",
  "XOOOOX......",
  "XOOOOOX.....",
  "XOOOOOOX....",
  "XOOOOOOOX...",
  "XOOOOOOOOX..",
  "XOOOOOOOOOX.",
  "XOOOOOOXXXXX",
  "XOOOXOOX....",
  "XOOXXOOX....",
  "XOX..XOOX...",
  "XX...XOOX...",
  "X.....XOOX..",
  "......XOOX..",
  ".......XOOX.",
  ".......XOOX.",
  "........XX..",
];
const HAND = [
  ".....XX.........",
  "....XOOX........",
  "....XOOX........",
  "....XOOX........",
  "....XOOX........",
  "....XOOXXX......",
  "....XOOXOOXXX...",
  "....XOOXOOXOOXX.",
  ".XX.XOOXOOXOOXOX",
  "XOOXXOOOOOOOOXOX",
  "XOOOXOOOOOOOOOOX",
  ".XOOXOOOOOOOOOOX",
  "..XOOOOOOOOOOOOX",
  "..XOOOOOOOOOOOX.",
  "...XOOOOOOOOOOX.",
  "...XOOOOOOOOOX..",
  "....XOOOOOOOOX..",
  "....XOOOOOOOOX..",
  "....XXXXXXXXXX..",
];
const HOURGLASS = [
  "XXXXXXXXXXXXX",
  "XOOOOOOOOOOOX",
  ".XXXXXXXXXXX.",
  ".XOOOOOOOOOX.",
  ".XOXXXXXXXOX.",
  ".XOOXXXXXOOX.",
  "..XOOXXXOOX..",
  "...XOOXOOX...",
  "....XOOOX....",
  ".....XOX.....",
  "....XOOOX....",
  "...XOOOOOX...",
  "..XOOOXOOOX..",
  ".XOOOOXOOOOX.",
  ".XOOOXXXOOOX.",
  ".XOXXXXXXXOX.",
  ".XXXXXXXXXXX.",
  "XOOOOOOOOOOOX",
  "XXXXXXXXXXXXX",
];

/** Hotspots in cells, so the pixel tip sits exactly on the pointer */
const HOT: Record<Exclude<OsState, "hide">, [number, number]> = { arrow: [0, 0], hand: [5, 0], busy: [6, 9] };

/** Draws a pixel map as one crisp SVG, merging runs of equal cells into single rects */
function pixelSvg(map: string[], name: string) {
  const w = Math.max(...map.map((r) => r.length));
  let rects = "";
  map.forEach((row, y) => {
    let x = 0;
    while (x < row.length) {
      const c = row[x];
      let run = 1;
      while (row[x + run] === c) run++;
      if (c !== ".") rects += `<rect x="${x}" y="${y}" width="${run}" height="1" class="cursor__px-${c === "X" ? "k" : "w"}"/>`;
      x += run;
    }
  });
  return `<svg class="cursor__os cursor__os--${name}" width="${w}" height="${map.length}" viewBox="0 0 ${w} ${map.length}" shape-rendering="crispEdges" aria-hidden="true">${rects}</svg>`;
}

/** True when the pointer is over real text: the element itself owns text, or it is inline inside a text block */
function overText(t: Element) {
  const block = t.closest(TEXT);
  if (!block) return false;
  if (t !== block) return true;
  return Array.from(block.childNodes).some((n) => n.nodeType === Node.TEXT_NODE && (n.textContent ?? "").trim() !== "");
}

function resolve(t: Element | null): Resolved {
  const none: Resolved = { state: "default", target: null, label: "" };
  if (!t) return none;
  const hit = t.closest<HTMLElement>(HIT);
  if (hit) {
    const kind = hit.dataset.cursor;
    const label = hit.dataset.cursorLabel ?? "";
    if (kind === "hide") return { state: "hide", target: hit, label: "" };
    if (kind === "media") return { state: "media", target: hit, label };
    if (kind === "drag") return { state: "drag", target: hit, label: label || "Drag" };
    if (kind === "text") return { state: "text", target: hit, label: "" };
    if (!kind && label && !hit.matches(LINK)) return { state: "label", target: hit, label };
    const r = hit.getBoundingClientRect();
    if (r.width > MAX_RECT.w || r.height > MAX_RECT.h) return { state: "media", target: hit, label };
    return { state: "link", target: hit, label: "" };
  }
  if (t.closest(FIELD) || overText(t)) return { state: "text", target: null, label: "" };
  return none;
}

type Tone = "" | "cobalt" | "accent";

/** Computed rgb() strings of the cobalt tokens, read once from the stylesheet */
function cobaltColors() {
  const probe = document.createElement("span");
  document.body.append(probe);
  const out = new Set<string>();
  for (const v of ["--cobalt", "--cobalt-deep"]) {
    probe.style.color = `var(${v})`;
    out.add(getComputedStyle(probe).color);
  }
  probe.remove();
  return out;
}

const TRANSPARENT = /^(transparent|rgba\(0, 0, 0, 0\))$/;

/**
 * What the cursor sits on. "cobalt" when the nearest painted background is cobalt (or a surface is
 * tagged data-cursor-tone="cobalt"), "accent" when the hovered text itself is cobalt. A difference
 * blend over either would turn the cursor yellow.
 */
function toneOf(t: Element | null, cobalts: Set<string>): Tone {
  if (!t) return "";
  /* The attribute is a fallback for surfaces the computed walk cannot see (images, gradients) */
  const tagged: Tone = t.closest('[data-cursor-tone="cobalt"]') ? "cobalt" : "";
  let accent = false;
  let n: Element | null = t;
  for (let depth = 0; n && depth < 16; depth++, n = n.parentElement) {
    const cs = getComputedStyle(n);
    if (depth < 3 && cobalts.has(cs.color)) accent = true;
    /* A background clipped to the glyphs is a text colour, not a surface */
    if (cs.backgroundClip === "text") {
      if (depth < 3 && (cobalts.has(cs.backgroundColor) || cs.backgroundImage.includes(Array.from(cobalts)[0]))) accent = true;
      continue;
    }
    if (!TRANSPARENT.test(cs.backgroundColor)) return cobalts.has(cs.backgroundColor) ? "cobalt" : accent ? "accent" : tagged;
  }
  return accent ? "accent" : tagged;
}

/** The takeover radius: the target's own corner (or its full-size child's), grown by the padding */
function radiusOf(t: HTMLElement) {
  const corner = (e: Element) => getComputedStyle(e).borderTopLeftRadius;
  const rect = t.getBoundingClientRect();
  let r = corner(t);
  const child = t.firstElementChild;
  if (!parseFloat(r) && child) {
    const c = child.getBoundingClientRect();
    if (c.width >= rect.width * 0.85 && c.height >= rect.height * 0.85) r = corner(child);
  }
  const px = parseFloat(r);
  if (!px) return "";
  if (r.trim().endsWith("%")) return r;
  return `${Math.min(px + PAD / 2, (Math.min(rect.width, rect.height) + PAD) / 2)}px`;
}

/** Mounts the cursor in #overlay. Fine pointers only; touch keeps the native cursor. */
export function initCursor() {
  const overlay = document.getElementById("overlay");
  if (!overlay || !finePointer() || overlay.querySelector(".cursor")) return;
  const html = document.documentElement;
  html.classList.add("has-cursor");

  const el = document.createElement("div");
  el.className = "cursor";
  el.setAttribute("aria-hidden", "true");
  el.dataset.state = "default";
  el.innerHTML = `<span class="cursor__label"></span><span class="cursor__shape"></span>${pixelSvg(ARROW, "arrow")}${pixelSvg(HAND, "hand")}${pixelSvg(HOURGLASS, "busy")}`;
  overlay.append(el);
  const labelEl = el.querySelector<HTMLElement>(".cursor__label")!;

  let mx = 0;
  let my = 0;
  let x = 0;
  let y = 0;
  let visible = false;
  let current: Resolved = { state: "default", target: null, label: "" };
  let shownLabel = "";
  let labelTimer = 0;
  let lastW = 0;
  let lastH = 0;
  let os = getMode() === "os";

  const setLabel = (text: string) => {
    if (text === shownLabel) return;
    window.clearTimeout(labelTimer);
    if (!text) {
      const n = labelEl.children.length;
      Array.from(labelEl.children).forEach((w, i) => (w as HTMLElement).style.setProperty("--ri", String(n - i - 1)));
      el.classList.remove("is-labeled");
      el.classList.add("is-label-exit");
      labelTimer = window.setTimeout(() => {
        labelEl.textContent = "";
        el.classList.remove("is-label-exit");
      }, 620);
      shownLabel = "";
      return;
    }
    el.classList.remove("is-labeled", "is-label-exit");
    labelEl.innerHTML = text
      .split(/\s+/)
      .filter(Boolean)
      .map((w, i) => `<span class="cursor__word" style="--i:${i}"><span class="cursor__word-in">${w.replace(/[<&>]/g, "")}</span></span>`)
      .join(" ");
    void labelEl.offsetWidth;
    el.classList.add("is-labeled");
    shownLabel = text;
  };

  const cobalts = cobaltColors();
  let tone: Tone = "";
  let pointerTarget: Element | null = null;
  let frame = 0;
  const setTone = (next: Tone) => {
    tone = next;
    el.classList.toggle("is-on-cobalt", tone === "cobalt");
    el.classList.toggle("is-on-accent", tone === "accent");
  };
  /** The curtain owns the screen until its sheet is fully gone, even after the phase is idle */
  const curtainUp = () => getPhase() !== "idle" || html.hasAttribute("data-curtain");
  const apply = (next: Resolved) => {
    if (os) {
      const busy = html.hasAttribute("data-busy");
      const state: OsState = next.state === "hide" ? "hide" : busy ? "busy" : next.state === "link" || next.state === "media" ? "hand" : "arrow";
      el.dataset.os = state;
      if (state !== "hide") {
        el.style.setProperty("--hx", `${-HOT[state][0]}px`);
        el.style.setProperty("--hy", `${-HOT[state][1]}px`);
      }
      current = next;
      setLabel("");
      return;
    }
    if (curtainUp() && next.state !== "hide") next = { state: "default", target: null, label: "" };
    if (next.state !== "link" && current.state === "link") {
      el.style.removeProperty("width");
      el.style.removeProperty("height");
      el.style.removeProperty("--cursor-r");
      lastW = lastH = 0;
    }
    if (next.state === "link" && next.target && next.target !== current.target) {
      const r = radiusOf(next.target);
      if (r) el.style.setProperty("--cursor-r", r);
      else el.style.removeProperty("--cursor-r");
    }
    current = next;
    el.dataset.state = next.state;
    setLabel(next.state === "media" || next.state === "drag" || next.state === "label" ? next.label : "");
  };

  const refresh = () => {
    if (!visible) return;
    const t = document.elementFromPoint(mx, my);
    pointerTarget = t;
    setTone(os ? "" : toneOf(t, cobalts));
    apply(resolve(t));
  };

  let scrollQueued = false;
  const onScroll = () => {
    if (scrollQueued) return;
    scrollQueued = true;
    requestAnimationFrame(() => {
      scrollQueued = false;
      refresh();
    });
  };

  const show = () => {
    visible = true;
    x = mx;
    y = my;
    el.classList.add("is-visible");
  };
  const hide = () => {
    visible = false;
    el.classList.remove("is-visible", "is-down");
    apply({ state: "default", target: null, label: "" });
  };

  const onMove = (e: PointerEvent) => {
    if (e.pointerType && e.pointerType !== "mouse" && e.pointerType !== "pen") return;
    mx = e.clientX;
    my = e.clientY;
    if (!visible) show();
    const t = e.target instanceof Element ? e.target : null;
    if (t !== pointerTarget) {
      pointerTarget = t;
      if (!os) setTone(toneOf(t, cobalts));
    }
    const next = resolve(t);
    if (next.state !== current.state || next.target !== current.target || next.label !== current.label || os) apply(next);
  };

  const setMode = () => {
    const nextOs = getMode() === "os";
    if (nextOs !== os) {
      os = nextOs;
      el.classList.toggle("is-os", os);
      if (!os) delete el.dataset.os;
      x = mx;
      y = my;
    }
    refresh();
  };

  const tick = (_time: number, dt: number) => {
    if (!visible) return;
    if (os) {
      x = mx;
      y = my;
      el.style.transform = `translate3d(${x}px, ${y}px, 0)`;
      return;
    }
    /* Hover colour transitions can turn an element cobalt after the pointer arrives */
    if (++frame % 8 === 0 && pointerTarget) {
      const next = toneOf(pointerTarget, cobalts);
      if (next !== tone) setTone(next);
    }
    let gx = mx;
    let gy = my;
    const t = current.target;
    if (current.state === "link" && t) {
      if (!t.isConnected) {
        refresh();
      } else {
        const r = t.getBoundingClientRect();
        gx = r.left + r.width / 2;
        gy = r.top + r.height / 2;
        const w = Math.round(r.width + PAD);
        const h = Math.round(r.height + PAD);
        if (w !== lastW || h !== lastH) {
          el.style.width = `${w}px`;
          el.style.height = `${h}px`;
          lastW = w;
          lastH = h;
        }
      }
    }
    const k = reducedMotion() ? 1 : 1 - Math.pow(1 - LERP, dt / 16.67);
    x += (gx - x) * k;
    y += (gy - y) * k;
    if (Math.abs(gx - x) < 0.05) x = gx;
    if (Math.abs(gy - y) < 0.05) y = gy;
    el.style.transform = `translate3d(${x}px, ${y}px, 0) translate(-50%, -50%)`;
  };

  el.classList.toggle("is-os", os);
  apply(current);

  document.addEventListener("pointermove", onMove, { passive: true });
  document.addEventListener("pointerdown", () => el.classList.add("is-down"), { passive: true });
  document.addEventListener("pointerup", () => el.classList.remove("is-down"), { passive: true });
  html.addEventListener("mouseleave", hide);
  window.addEventListener("blur", () => el.classList.remove("is-down"));
  window.addEventListener("scroll", onScroll, { passive: true });
  window.addEventListener("resize", onScroll, { passive: true });
  window.addEventListener("pageshow", onScroll);
  bus.on("cursor:refresh", onScroll);
  bus.on("transition:phase", onScroll);
  bus.on("mode:change", setMode);
  new MutationObserver(setMode).observe(html, { attributes: true, attributeFilter: ["data-mode", "data-busy", "data-curtain"] });
  gsap.ticker.add(tick);
}
