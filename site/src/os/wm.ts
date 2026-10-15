import { Draggable } from "gsap/Draggable";
import { DUR, d, gsap } from "../core/motion";

gsap.registerPlugin(Draggable);
import { esc } from "../lib/html";
import { glyph, icon, type IconName } from "./icons";
import { menubar, wireMenubar, type Menu } from "./menu";

/**
 * The ASH/OS 98 window manager. Windows are fixed boxes in #overlay positioned with left/top/width/height,
 * so transforms stay free for the open, close and minimise zooms. Every window and the live site window
 * share one z counter; #overlay must not form a stacking context, so windows and #frame interleave.
 */

export type WinKind = "doc" | "explorer" | "notepad" | "dialog" | "viewer" | "game";

export type WinSpec = {
  /** One window per id: opening it again focuses (and restores) the existing one */
  id: string;
  title: string;
  icon: IconName;
  kind: WinKind;
  w: number;
  /** Omit for content height (dialogs) */
  h?: number;
  body: string;
  /** Real Win98 menus. Every item's action goes to onMenu. */
  menus?: Menu[];
  onMenu?(action: string, el: HTMLElement, win: Win): void;
  /** Dialogs have only a close button and never maximise */
  dialog?: boolean;
  /** Reading windows (case studies): about 70% of the desktop, centred, maximised on small screens */
  large?: boolean;
  /** "corner" rests the window at the top right instead of the cascade */
  place?: "corner";
  /** Wires behaviour once the window is in the DOM; returns its cleanup */
  mount?(el: HTMLElement, win: Win): (() => void) | void;
};

export type Win = {
  id: string;
  el: HTMLElement;
  spec: WinSpec;
  task: HTMLButtonElement;
  drag: Draggable | null;
  min: boolean;
  max: boolean;
  prev: { left: number; top: number; width: number; height: number } | null;
  opener: HTMLElement | null;
  cleanup: (() => void) | void;
  menuOff: () => void;
};

/** The live site window registers itself as a task so it shares focus, z order and the taskbar */
export type SiteTask = {
  task: HTMLButtonElement;
  setZ(z: number): void;
  setActive(on: boolean): void;
  isMin(): boolean;
  restore(): void;
};

const Z_BASE = 100;
const Z_CEIL = 800;

let layer: HTMLElement | null = null;
let tasks: HTMLElement | null = null;
let taskbar: HTMLElement | null = null;
let site: SiteTask | null = null;
let zTop = Z_BASE;
let opened = 0;
const wins = new Map<string, Win>();
let order: string[] = [];

export const isPhone = () => matchMedia("(max-width: 767px)").matches;

/** The desktop area windows live in: the viewport minus the taskbar */
export function desk() {
  const tb = taskbar?.offsetHeight ?? 30;
  return { w: innerWidth, h: Math.max(0, innerHeight - tb) };
}

export function initWM(opts: { layer: HTMLElement; tasks: HTMLElement; taskbar: HTMLElement }) {
  layer = opts.layer;
  tasks = opts.tasks;
  taskbar = opts.taskbar;
}

export function registerSite(s: SiteTask) {
  site = s;
}

export const openWindows = () => [...wins.values()];
export const getWin = (id: string) => wins.get(id) ?? null;

/** Next z index. When the counter nears the taskbar layer, every task is renumbered in focus order. */
export function nextZ() {
  if (zTop + 2 >= Z_CEIL) {
    zTop = Z_BASE;
    for (const id of order) {
      if (id === "site") site?.setZ((zTop += 2));
      else wins.get(id)?.el.style.setProperty("z-index", String((zTop += 2)));
    }
  }
  zTop += 2;
  return zTop;
}

function markActive(id: string | null) {
  for (const w of wins.values()) {
    const on = w.id === id;
    w.el.classList.toggle("is-active", on);
    w.task.setAttribute("aria-pressed", String(on && !w.min));
  }
  if (site) {
    site.setActive(id === "site");
    site.task.setAttribute("aria-pressed", String(id === "site" && !site.isMin()));
  }
}

/** Raises a task to the top and marks it active. `id` is a window id or "site". */
export function focusTask(id: string, moveFocus = false) {
  order = order.filter((x) => x !== id).concat(id);
  if (id === "site") {
    if (!site) return;
    site.setZ(nextZ());
    markActive("site");
    return;
  }
  const w = wins.get(id);
  if (!w) return;
  w.el.style.zIndex = String(nextZ());
  markActive(id);
  if (moveFocus && !w.el.contains(document.activeElement)) w.el.focus({ preventScroll: true });
}

/** Marks whichever task is on top as active, or none when everything is minimised */
function focusTopmost() {
  for (let i = order.length - 1; i >= 0; i--) {
    const id = order[i];
    if (id === "site" ? site && !site.isMin() : wins.get(id) && !wins.get(id)!.min) {
      focusTask(id, true);
      return;
    }
  }
  markActive(null);
}

export function forgetTask(id: string) {
  order = order.filter((x) => x !== id);
}

function center(el: Element | null) {
  if (!el) return null;
  const r = el.getBoundingClientRect();
  if (!r.width && !r.height) return null;
  return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
}

/** Zooms a window toward or away from a screen point with transform-origin at that point */
function zoom(el: HTMLElement, point: { x: number; y: number } | null, dir: "in" | "out", dur: number) {
  const left = el.offsetLeft;
  const top = el.offsetTop;
  const origin = point ? `${point.x - left}px ${point.y - top}px` : "50% 50%";
  gsap.killTweensOf(el, "scale,opacity");
  if (dir === "in") {
    return gsap.fromTo(
      el,
      { scale: point ? 0.05 : 0.92, opacity: 0, transformOrigin: origin },
      { scale: 1, opacity: 1, duration: d(dur), ease: "expoOut", clearProps: "transform,opacity" },
    );
  }
  return gsap.to(el, { scale: point ? 0.05 : 0.92, opacity: 0, transformOrigin: origin, duration: d(dur), ease: "expoInOut" });
}

function boundsFor(el: HTMLElement) {
  const { w, h } = desk();
  return { minX: 0, minY: 0, maxX: Math.max(0, w - el.offsetWidth), maxY: Math.max(0, h - el.offsetHeight) };
}

function place(w: Win) {
  const el = w.el;
  const { w: dw, h: dh } = desk();
  if (isPhone()) {
    Object.assign(el.style, { left: "0px", top: "0px", width: `${dw}px`, height: `${dh}px` });
    return;
  }
  if (w.spec.large) {
    const lw = Math.round(Math.min(w.spec.w, Math.max(dw * 0.72, Math.min(dw - 16, 720))));
    const lh = Math.round(Math.min(w.spec.h ?? dh, dh * 0.9));
    Object.assign(el.style, { width: `${lw}px`, height: `${lh}px`, left: `${Math.round((dw - lw) / 2)}px`, top: `${Math.round((dh - lh) / 2)}px` });
    return;
  }
  const width = Math.min(w.spec.w, dw - 16);
  el.style.width = `${width}px`;
  el.style.height = w.spec.h ? `${Math.min(w.spec.h, dh - 16)}px` : "auto";
  if (w.spec.place === "corner") {
    el.style.left = `${Math.max(0, dw - width - 24)}px`;
    el.style.top = "24px";
    return;
  }
  if (!w.spec.h && el.offsetHeight > dh - 16) el.style.height = `${dh - 16}px`;
  const height = el.offsetHeight;
  const iconsRight = document.querySelector(".os-icons")?.getBoundingClientRect().right ?? 0;
  const areaX = Math.min(iconsRight + 16, Math.max(8, dw - width - 8));
  const areaW = dw - areaX - 8;
  const step = (opened % 6) * 26;
  const left = Math.round(areaX + Math.max(0, (areaW - width) / 2) - 52 + step);
  const top = Math.round(Math.max(8, (dh - height) / 2 - 60 + step));
  el.style.left = `${Math.max(0, Math.min(left, dw - width))}px`;
  el.style.top = `${Math.max(0, Math.min(top, dh - height))}px`;
}

const MAX_ICON = (on: boolean) => glyph(on ? "restore" : "max");

function chrome(spec: WinSpec) {
  const menu = spec.menus?.length ? menubar(spec.menus) : "";
  const ctl = spec.dialog
    ? `<button class="os-btn os-win__btn" type="button" data-act="close" aria-label="Close" title="Close">${glyph("close")}</button>`
    : `<button class="os-btn os-win__btn" type="button" data-act="min" aria-label="Minimise" title="Minimise">${glyph("min")}</button><button class="os-btn os-win__btn" type="button" data-act="max" aria-label="Maximise" title="Maximise">${MAX_ICON(false)}</button><button class="os-btn os-win__btn os-win__btn--close" type="button" data-act="close" aria-label="Close" title="Close">${glyph("close")}</button>`;
  return `<div class="os-win__bar" data-cursor="drag" data-cursor-label="Drag">
  <span class="os-win__icon">${icon(spec.icon, 16)}</span>
  <span class="os-win__title" id="os-t-${spec.id}">${esc(spec.title)}</span>
  <span class="os-win__ctl">${ctl}</span>
</div>${menu}<div class="os-win__body">${spec.body}</div>`;
}

function taskButton(id: string, title: string, ic: IconName) {
  const b = document.createElement("button");
  b.type = "button";
  b.className = "os-btn os-task";
  b.dataset.task = id;
  b.setAttribute("aria-pressed", "false");
  b.innerHTML = `${icon(ic, 16)}<span class="os-task__label">${esc(title)}</span>`;
  return b;
}

/** A taskbar button for the site window, created here so the taskbar owns all its buttons */
export function siteTaskButton(title: string) {
  const b = taskButton("site", title, "site");
  tasks?.prepend(b);
  return b;
}

/** Opens a window, or focuses and restores it if it is already open. `from` is the icon it zooms out of. */
export function openWindow(spec: WinSpec, from: HTMLElement | null = null): Win | null {
  if (!layer || !tasks) return null;
  const existing = wins.get(spec.id);
  if (existing) {
    if (existing.min) restoreWindow(existing);
    focusTask(existing.id, true);
    return existing;
  }
  const el = document.createElement("section");
  el.className = `os-win os-win--${spec.kind}${spec.dialog ? " os-win--dialog" : ""}`;
  el.setAttribute("role", "dialog");
  el.setAttribute("aria-labelledby", `os-t-${spec.id}`);
  el.tabIndex = -1;
  el.dataset.win = spec.id;
  el.innerHTML = chrome(spec);
  layer.append(el);

  const task = taskButton(spec.id, spec.title, spec.icon);
  tasks.append(task);

  const w: Win = { id: spec.id, el, spec, task, drag: null, min: false, max: false, prev: null, opener: from, cleanup: undefined, menuOff: () => {} };
  wins.set(spec.id, w);
  place(w);
  opened++;

  if (!isPhone()) {
    const bar = el.querySelector<HTMLElement>(".os-win__bar")!;
    w.drag = Draggable.create(el, {
      type: "left,top",
      trigger: bar,
      zIndexBoost: false,
      onPress() {
        focusTask(w.id);
        this.applyBounds(boundsFor(el));
      },
    })[0];
    bar.addEventListener("dblclick", (e) => {
      if ((e.target as Element).closest("button") || spec.dialog) return;
      toggleMax(w);
    });
  }

  el.addEventListener("pointerdown", () => focusTask(w.id), true);
  el.addEventListener("focusin", () => {
    if (!el.classList.contains("is-active")) focusTask(w.id);
  });
  el.querySelector(".os-win__ctl")!.addEventListener("click", (e) => {
    const act = (e.target as Element).closest<HTMLElement>("[data-act]")?.dataset.act;
    if (act === "close") closeWindow(w);
    else if (act === "min") minimiseWindow(w);
    else if (act === "max") toggleMax(w);
  });
  task.addEventListener("click", () => {
    if (w.min) {
      restoreWindow(w);
      focusTask(w.id, true);
    } else if (w.el.classList.contains("is-active")) minimiseWindow(w);
    else focusTask(w.id, true);
  });

  w.cleanup = spec.mount?.(el, w);
  if (spec.menus) w.menuOff = wireMenubar(el, spec.menus, (a) => w.spec.onMenu?.(a, w.el, w));
  if (spec.large && !isPhone() && innerWidth < 1100) setMax(w, true, false);
  focusTask(w.id, true);
  zoom(el, center(from), "in", DUR.xs);
  return w;
}

function destroy(w: Win) {
  w.cleanup?.();
  w.menuOff();
  w.drag?.kill();
  gsap.killTweensOf(w.el);
  w.el.remove();
  w.task.remove();
  wins.delete(w.id);
  forgetTask(w.id);
}

/** Closes a window back into the icon it came from (or in place), then returns focus to that icon */
export async function closeWindow(w: Win, opts: { toTask?: boolean } = {}) {
  if (!wins.has(w.id) || w.el.dataset.closing) return;
  w.el.dataset.closing = "1";
  const target = opts.toTask ? center(w.task) : w.opener?.isConnected ? center(w.opener) : null;
  if (!w.min) await zoom(w.el, target, "out", DUR.xs);
  const opener = w.opener;
  destroy(w);
  if (!opts.toTask) {
    if (opener?.isConnected && opener.offsetParent) opener.focus({ preventScroll: true });
    focusTopmost();
  }
}

export function closeAll(toTask: boolean) {
  return Promise.all([...wins.values()].map((w) => closeWindow(w, { toTask })));
}

export async function minimiseWindow(w: Win) {
  if (w.min) return;
  w.min = true;
  w.task.setAttribute("aria-pressed", "false");
  await zoom(w.el, center(w.task), "out", DUR.xs);
  if (w.min) w.el.hidden = true;
  focusTopmost();
}

export function restoreWindow(w: Win) {
  if (!w.min) return;
  w.min = false;
  w.el.hidden = false;
  zoom(w.el, center(w.task), "in", DUR.xs);
}

export const toggleMax = (w: Win) => setMax(w, !w.max, true);

/** Maximises to the whole desktop or restores the previous box */
function setMax(w: Win, on: boolean, animate: boolean) {
  if (w.spec.dialog || isPhone() || w.max === on) return;
  const el = w.el;
  const btn = el.querySelector<HTMLElement>('[data-act="max"]');
  const dur = animate ? d(DUR.xs) : 0;
  if (on) {
    w.prev = { left: el.offsetLeft, top: el.offsetTop, width: el.offsetWidth, height: el.offsetHeight };
    const { w: dw, h: dh } = desk();
    gsap.to(el, { left: 0, top: 0, width: dw, height: dh, duration: dur, ease: "expoOut" });
    w.drag?.disable();
  } else if (w.prev) {
    gsap.to(el, { ...w.prev, duration: dur, ease: "expoOut" });
    w.drag?.enable();
  }
  w.max = on;
  el.classList.toggle("is-max", w.max);
  if (btn) {
    btn.innerHTML = MAX_ICON(w.max);
    btn.setAttribute("aria-label", w.max ? "Restore" : "Maximise");
    btn.title = w.max ? "Restore" : "Maximise";
  }
}

/** Keeps every window inside the desktop after a resize; phones get full screen windows */
export function relayout() {
  const { w: dw, h: dh } = desk();
  for (const w of wins.values()) {
    if (isPhone()) {
      place(w);
      continue;
    }
    const el = w.el;
    if (w.max) {
      Object.assign(el.style, { left: "0px", top: "0px", width: `${dw}px`, height: `${dh}px` });
      continue;
    }
    if (el.offsetWidth > dw) el.style.width = `${dw}px`;
    if (el.offsetHeight > dh) el.style.height = `${dh}px`;
    el.style.left = `${Math.max(0, Math.min(el.offsetLeft, dw - el.offsetWidth))}px`;
    el.style.top = `${Math.max(0, Math.min(el.offsetTop, dh - el.offsetHeight))}px`;
  }
}

/** The window that holds keyboard focus, else the active one */
export function focusedWindow(): Win | null {
  const host = (document.activeElement as Element | null)?.closest<HTMLElement>("[data-win]");
  if (host) return wins.get(host.dataset.win!) ?? null;
  for (const w of wins.values()) if (w.el.classList.contains("is-active") && !w.min) return w;
  return null;
}

/** Drops every window instantly (used when the site leaves OS mode without animation) */
export function destroyAll() {
  [...wins.values()].forEach(destroy);
  opened = 0;
}

/**
 * Swaps what a window shows (WordPad's Previous and Next case) without closing it: same box, same
 * menus, new id, title, taskbar label and body. If the target is already open elsewhere, that one is focused.
 */
export function retarget(w: Win, spec: WinSpec) {
  const other = wins.get(spec.id);
  if (other && other !== w) {
    if (other.min) restoreWindow(other);
    focusTask(other.id, true);
    return;
  }
  w.cleanup?.();
  wins.delete(w.id);
  order = order.map((x) => (x === w.id ? spec.id : x));
  w.id = spec.id;
  w.spec = spec;
  wins.set(spec.id, w);
  const el = w.el;
  el.dataset.win = spec.id;
  el.setAttribute("aria-labelledby", `os-t-${spec.id}`);
  const title = el.querySelector<HTMLElement>(".os-win__title")!;
  title.id = `os-t-${spec.id}`;
  title.textContent = spec.title;
  w.task.dataset.task = spec.id;
  w.task.querySelector(".os-task__label")!.textContent = spec.title;
  el.querySelector(".os-win__body")!.innerHTML = spec.body;
  w.cleanup = spec.mount?.(el, w);
}
