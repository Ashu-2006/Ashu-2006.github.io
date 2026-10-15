import { Draggable } from "gsap/Draggable";
import { DUR, ScrollTrigger, d, gsap, reducedMotion } from "../core/motion";

gsap.registerPlugin(Draggable);
import { scrollToTarget, startScroll, stopScroll } from "../core/scroll";
import { esc } from "../lib/html";
import { glyph, icon } from "./icons";
import { desk, focusTask, isPhone, registerSite, siteTaskButton } from "./wm";

/**
 * The live site as a window. Freezing pins #frame to the viewport at its current scroll position
 * (the document keeps its height, so window.scrollY and every ScrollTrigger pin stay exactly where they
 * were), then #frame is transformed into the client area of a window chrome drawn behind it.
 * The geometry is one rect, the client area in screen pixels, so collapse, drag, minimise and the zoom
 * back all animate the same three numbers.
 */

export const SITE_TITLE = "ashutosh-rana.html";

type Rect = { x: number; y: number; w: number };
type Insets = { t: number; r: number; b: number; l: number };

const frame = () => document.getElementById("frame")!;
const viewport = () => document.getElementById("viewport")!;

let frozen = false;
let savedY = 0;
let fw = 0;
let fh = 0;
let chromeEl: HTMLElement | null = null;
let task: HTMLButtonElement | null = null;
let drag: Draggable | null = null;
let insets: Insets = { t: 0, r: 0, b: 0, l: 0 };
let minimised = false;
let hiddenForPhone = false;
const rect: Rect = { x: 0, y: 0, w: 0 };
let handlers: { onMax(): void; onClose(): void } = { onMax: () => {}, onClose: () => {} };

export const isFrozen = () => frozen;
export const siteRect = () => ({ ...rect, h: (rect.w * fh) / Math.max(1, fw) });
export const fullRect = (): Rect => ({ x: 0, y: 0, w: fw });
export const siteMinimised = () => minimised;

/** Applies the rect to #frame (transform) and to the chrome around it (box) */
export function applySite() {
  if (!chromeEl || !fw) return;
  const s = rect.w / fw;
  const h = rect.w * (fh / fw);
  frame().style.transform = `translate(${rect.x}px, ${rect.y}px) scale(${s})`;
  Object.assign(chromeEl.style, {
    left: `${rect.x - insets.l}px`,
    top: `${rect.y - insets.t}px`,
    width: `${rect.w + insets.l + insets.r}px`,
    height: `${h + insets.t + insets.b}px`,
  });
}

/** Freezes the live site where it is. Safe to call twice. */
export function freeze() {
  if (frozen) return;
  frozen = true;
  const html = document.documentElement;
  savedY = window.scrollY;
  fw = html.clientWidth;
  fh = window.innerHeight;
  document.body.style.minHeight = `${html.scrollHeight}px`;
  Object.assign(frame().style, {
    position: "fixed",
    top: "0px",
    left: "0px",
    width: `${fw}px`,
    height: `${fh}px`,
    overflow: "clip",
    transformOrigin: "0 0",
  });
  const vp = viewport();
  vp.style.marginTop = `${-savedY}px`;
  vp.inert = true;
  stopScroll();
  wheelTarget = savedY;
  const url = chromeEl?.querySelector<HTMLInputElement>(".os-site__url");
  if (url) url.value = `http://${location.host || "ashutoshdesigns.me"}${location.pathname}`;
  rect.x = 0;
  rect.y = 0;
  rect.w = fw;
  ScrollTrigger.addEventListener("refreshInit", thaw);
  ScrollTrigger.addEventListener("refresh", refreeze);
}

/**
 * ScrollTrigger can refresh while the site is frozen (load, resize, a view reacting to mode:change) and
 * it measures at other scroll positions. For the length of a refresh the frame goes back to document
 * flow (absolute at the top, no offset, no scale) so every start and end comes out exactly as in modern
 * mode, then it is pinned to the viewport again before the next paint.
 */
function thaw() {
  const f = frame();
  f.style.transform = "";
  f.style.position = "absolute";
  viewport().style.marginTop = "0px";
}

function refreeze() {
  if (!frozen) return;
  frame().style.position = "fixed";
  viewport().style.marginTop = `${-savedY}px`;
  if (window.scrollY !== savedY) window.scrollTo(0, savedY);
  applySite();
}

/** Returns the live site to normal flow and scroll at the position it was frozen at */
export function unfreeze() {
  if (!frozen) return;
  frozen = false;
  gsap.ticker.remove(wheelTick);
  wheelOn = false;
  savedY = wheelTarget = Math.round(savedY);
  ScrollTrigger.removeEventListener("refreshInit", thaw);
  ScrollTrigger.removeEventListener("refresh", refreeze);
  const f = frame();
  for (const p of ["position", "top", "left", "width", "height", "overflow", "transform", "transformOrigin", "zIndex", "visibility", "opacity"] as const) {
    f.style[p] = "";
  }
  const vp = viewport();
  vp.style.marginTop = "";
  vp.inert = false;
  document.body.style.minHeight = "";
  window.scrollTo(0, savedY);
  scrollToTarget(savedY, { immediate: true });
  startScroll();
  ScrollTrigger.refresh();
}

function chromeMarkup() {
  const host = location.host || "ashutoshdesigns.me";
  return `<div class="os-win__bar os-site__bar" data-cursor="drag" data-cursor-label="Drag">
  <span class="os-win__icon">${icon("site", 16)}</span>
  <span class="os-win__title" id="os-t-site">${SITE_TITLE}</span>
  <span class="os-win__ctl"><button class="os-btn os-win__btn" type="button" data-act="min" aria-label="Minimise" title="Minimise">${glyph("min")}</button><button class="os-btn os-win__btn" type="button" data-act="max" aria-label="Maximise: back to 2026" title="Maximise: back to 2026">${glyph("max")}</button><button class="os-btn os-win__btn os-win__btn--close" type="button" data-act="close" aria-label="Close" title="Close">${glyph("close")}</button></span>
</div>
<div class="os-site__addr"><label class="os-site__addr-label" for="os-site-url">Address</label><input class="os-field os-site__url" id="os-site-url" type="text" readonly value="http://${esc(host)}${esc(location.pathname)}"><button class="os-btn os-btn--text os-btn--sm" type="button" data-act="max">Maximise to use</button></div>
<div class="os-site__well"><div class="os-site__client"></div></div>
<p class="os-site__foot">Scroll over the page to browse it. Maximise to click around.</p>`;
}

/*
 * Wheel over the site window browses the frozen page, like scrolling a real browser window: the target
 * is clamped to the document, eased toward on the GSAP ticker, and written to both the offset and the
 * real window scroll so ScrollTrigger pins and scrubs inside the window stay in step.
 */
let wheelTarget = 0;
let wheelOn = false;

function wheelTick() {
  const diff = wheelTarget - savedY;
  const next = Math.abs(diff) < 0.5 ? wheelTarget : savedY + diff * 0.2;
  savedY = Math.round(next * 100) / 100;
  viewport().style.marginTop = `${-savedY}px`;
  window.scrollTo(0, savedY);
  if (savedY === wheelTarget) {
    gsap.ticker.remove(wheelTick);
    wheelOn = false;
  }
}

function onWheel(e: WheelEvent) {
  if (!frozen || document.documentElement.dataset.mode !== "os" || isPhone() || minimised) return;
  e.preventDefault();
  const max = Math.max(0, document.documentElement.scrollHeight - window.innerHeight);
  const unit = e.deltaMode === 1 ? 40 : e.deltaMode === 2 ? window.innerHeight : 1;
  wheelTarget = Math.max(0, Math.min(max, wheelTarget + e.deltaY * unit * 1.2));
  if (reducedMotion()) {
    savedY = wheelTarget;
    viewport().style.marginTop = `${-savedY}px`;
    window.scrollTo(0, savedY);
    return;
  }
  if (!wheelOn) {
    wheelOn = true;
    gsap.ticker.add(wheelTick);
  }
}

/** Builds the chrome once into the OS layer and registers the site as a task */
export function mountSite(layer: HTMLElement, h: { onMax(): void; onClose(): void }) {
  handlers = h;
  if (chromeEl) return;
  chromeEl = document.createElement("section");
  chromeEl.className = "os-win os-site";
  chromeEl.setAttribute("aria-labelledby", "os-t-site");
  chromeEl.innerHTML = chromeMarkup();
  layer.prepend(chromeEl);
  measureInsets();

  task = siteTaskButton(SITE_TITLE);
  task.addEventListener("click", () => {
    if (isPhone()) handlers.onMax();
    else if (minimised) restoreSite();
    else if (chromeEl?.classList.contains("is-active")) minimiseSite();
    else focusTask("site");
  });

  registerSite({
    task,
    setZ(z) {
      chromeEl!.style.zIndex = String(z);
      frame().style.zIndex = String(z + 1);
    },
    setActive: (on) => chromeEl!.classList.toggle("is-active", on),
    isMin: () => minimised || hiddenForPhone,
    restore: restoreSite,
  });

  const bar = chromeEl.querySelector<HTMLElement>(".os-site__bar")!;
  bar.addEventListener("dblclick", (e) => {
    if (!(e.target as Element).closest("button")) handlers.onMax();
  });
  chromeEl.addEventListener("click", (e) => {
    const act = (e.target as Element).closest<HTMLElement>("[data-act]")?.dataset.act;
    if (act === "max") handlers.onMax();
    else if (act === "min") minimiseSite();
    else if (act === "close") handlers.onClose();
  });
  chromeEl.addEventListener("pointerdown", () => focusTask("site"), true);
  frame().addEventListener("pointerdown", () => {
    if (frozen && document.documentElement.dataset.mode === "os") focusTask("site");
  });
  frame().addEventListener("wheel", onWheel, { passive: false });
  frame().addEventListener("dblclick", () => {
    if (frozen && document.documentElement.dataset.mode === "os" && !isPhone()) handlers.onMax();
  });

  drag = Draggable.create(chromeEl, {
    type: "left,top",
    trigger: bar,
    zIndexBoost: false,
    onPress() {
      focusTask("site");
      const { w, h: dh } = desk();
      this.applyBounds({ minX: 0, minY: 0, maxX: Math.max(0, w - chromeEl!.offsetWidth), maxY: Math.max(0, dh - chromeEl!.offsetHeight) });
    },
    onDrag() {
      rect.x = Math.round(this.x + insets.l);
      rect.y = Math.round(this.y + insets.t);
      applySite();
    },
  })[0];
}

function measureInsets() {
  if (!chromeEl) return;
  Object.assign(chromeEl.style, { left: "0px", top: "0px", width: "400px", height: "300px", visibility: "hidden" });
  const client = chromeEl.querySelector<HTMLElement>(".os-site__client")!;
  insets = {
    t: client.offsetTop,
    l: client.offsetLeft,
    r: chromeEl.offsetWidth - client.offsetLeft - client.offsetWidth,
    b: chromeEl.offsetHeight - client.offsetTop - client.offsetHeight,
  };
  chromeEl.style.visibility = "";
}

/** Where the site window rests: right of the icon columns, sitting on the taskbar, at most 0.45 scale */
export function restRect(): Rect {
  const { w: dw, h: dh } = desk();
  const iconsRight = document.querySelector(".os-icons")?.getBoundingClientRect().right ?? 0;
  const gap = 28;
  const x = Math.round(iconsRight + gap + insets.l);
  const maxW = dw - x - gap - insets.r;
  const maxH = dh - gap * 2 - insets.t - insets.b;
  const w = Math.round(Math.max(120, Math.min(fw * 0.45, maxW, (maxH * fw) / fh)));
  const h = (w * fh) / fw;
  return { x, y: Math.round(dh - gap - insets.b - h), w };
}

export function setChromeVisible(on: boolean) {
  if (chromeEl) chromeEl.hidden = !on;
}

export const chrome = () => chromeEl;

/** Tweens the site rect. All site motion goes through here. */
export function tweenSite(to: Rect, vars: gsap.TweenVars = {}) {
  gsap.killTweensOf(rect);
  return gsap.to(rect, { ...to, ...vars, onUpdate: applySite });
}

export function setSite(to: Rect) {
  gsap.killTweensOf(rect);
  Object.assign(rect, to);
  applySite();
}

export async function minimiseSite() {
  if (minimised || !chromeEl || !task) return;
  minimised = true;
  task.setAttribute("aria-pressed", "false");
  const b = task.getBoundingClientRect();
  const back = { ...rect };
  chromeEl.dataset.back = JSON.stringify(back);
  await Promise.all([
    tweenSite({ x: b.left, y: b.top, w: b.width }, { duration: d(DUR.xs), ease: "expoInOut" }),
    gsap.to([chromeEl, frame()], { opacity: 0, duration: d(DUR.xs), ease: "expoInOut" }),
  ]);
  if (minimised) {
    chromeEl.style.visibility = "hidden";
    frame().style.visibility = "hidden";
  }
}

export async function restoreSite() {
  if (!minimised || !chromeEl) return;
  minimised = false;
  const back = chromeEl.dataset.back ? (JSON.parse(chromeEl.dataset.back) as Rect) : restRect();
  chromeEl.style.visibility = "";
  frame().style.visibility = "";
  focusTask("site");
  await Promise.all([
    tweenSite(back, { duration: d(DUR.xs), ease: "expoOut" }),
    gsap.to([chromeEl, frame()], { opacity: 1, duration: d(DUR.xs), ease: "expoOut" }),
  ]);
}

/** Puts the site back in view instantly (before a zoom to full screen) */
export function unhideSite() {
  minimised = false;
  hiddenForPhone = false;
  if (chromeEl) {
    gsap.killTweensOf(chromeEl);
    chromeEl.style.visibility = "";
    chromeEl.style.opacity = "";
  }
  const f = frame();
  gsap.killTweensOf(f, "opacity");
  f.style.visibility = "";
  f.style.opacity = "";
}

/** Phones have no site window: the frame hides and only the taskbar button remains */
export function hideForPhone(on: boolean) {
  hiddenForPhone = on;
  if (chromeEl) chromeEl.hidden = on;
  const f = frame();
  f.style.visibility = on ? "hidden" : "";
  f.style.opacity = on ? "0" : "";
}

/** After a resize in OS mode: the frozen frame takes the new viewport size and the window re-rests */
export function resizeFrozen() {
  if (!frozen) return;
  fw = document.documentElement.clientWidth;
  fh = window.innerHeight;
  Object.assign(frame().style, { width: `${fw}px`, height: `${fh}px` });
  measureInsets();
  if (isPhone()) {
    hideForPhone(true);
    return;
  }
  hideForPhone(false);
  if (!minimised) setSite(restRect());
}

export function destroySite() {
  drag?.kill();
  drag = null;
}

export const savedScroll = () => savedY;
