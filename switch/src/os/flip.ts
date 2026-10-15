import { bus, type Mode } from "../core/bus";
import { DUR, d, gsap, reducedMotion } from "../core/motion";
import { stopScroll } from "../core/scroll";
import { logoMark } from "./icons";
import { buildDesktop, type DeskAction, type Desktop } from "./desktop";
import {
  chrome,
  freeze,
  fullRect,
  hideForPhone,
  isFrozen,
  mountSite,
  restRect,
  setSite,
  tweenSite,
  unfreeze,
  unhideSite,
} from "./site";
import { click } from "./sound";
import { write } from "./store";
import { closeAll, destroyAll, focusTask, isPhone } from "./wm";

/**
 * The two flips and the screens around them. Modern to OS: the knob lands, the live site freezes, a
 * scanline flash crosses the screen and the site collapses into a window on the desktop. OS to modern
 * is the reverse. Phones skip the window: the site powers off like a CRT and the desktop is full screen.
 */

const html = document.documentElement;
const wait = (s: number) => new Promise<void>((r) => setTimeout(r, s * 1000));

let mode: Mode = "modern";
let busy = false;
let ownsBusy = false;
let desktop: Desktop | null = null;
let siteHandlers: { onMax(): void; onClose(): void } = { onMax: () => {}, onClose: () => {} };
let onAction: (a: DeskAction) => void = () => {};

export const currentMode = () => mode;
export const isFlipping = () => busy;

/** Wires the flips to the desktop actions and the site window buttons (set once by initOS) */
export function configureFlip(opts: { act(a: DeskAction): void; site: { onMax(): void; onClose(): void } }) {
  onAction = opts.act;
  siteHandlers = opts.site;
}

function setBusy(on: boolean) {
  busy = on;
  if (on && !html.hasAttribute("data-busy")) {
    html.dataset.busy = "";
    ownsBusy = true;
  } else if (!on && ownsBusy) {
    delete html.dataset.busy;
    ownsBusy = false;
  }
  if (!on) bus.emit("cursor:refresh", {});
}

/** Every switch on the page shows the same state */
export function setSwitches(on: boolean) {
  document.querySelectorAll<HTMLElement>("[data-switch], [data-switch-mirror]").forEach((b) => b.setAttribute("aria-checked", String(on)));
}

function setMode(next: Mode) {
  mode = next;
  if (next === "os") html.dataset.mode = "os";
  else html.dataset.mode = "modern";
  write("switch:mode", next);
  bus.emit("mode:change", { mode: next });
}

/** Shows the OS layers and builds the desktop on first use */
function showOS() {
  desktop = buildDesktop((a) => onAction(a));
  html.dataset.os = "";
  document.getElementById("os")!.removeAttribute("aria-hidden");
  desktop.paintWallpaper();
  desktop.setClock(true);
  mountSite(desktop.layer, siteHandlers);
  return desktop;
}

function hideOS() {
  delete html.dataset.os;
  document.getElementById("os")!.setAttribute("aria-hidden", "true");
  desktop?.setClock(false);
  desktop?.closeStart();
}

/** One-shot full screen layer in #overlay, removed by the caller */
function screen(cls: string, inner: string) {
  const el = document.createElement("div");
  el.className = cls;
  el.setAttribute("aria-hidden", "true");
  el.innerHTML = inner;
  document.getElementById("overlay")!.append(el);
  return el;
}

/** The CRT flourish: a scanline flash with a bright band, plus a brief chromatic jitter on the frame */
function flash() {
  if (reducedMotion()) return;
  const el = screen("os-flash", "");
  el.addEventListener("animationend", () => el.remove(), { once: true });
  window.setTimeout(() => el.remove(), 600);
  const frame = document.getElementById("frame")!;
  const shadow = (x: number) =>
    `drop-shadow(${x}px 0 0 color-mix(in srgb, var(--cobalt) 70%, transparent)) drop-shadow(${-x}px 0 0 color-mix(in srgb, var(--os-face-hi) 60%, transparent))`;
  gsap.to(
    {},
    {
      duration: DUR.xs,
      ease: "none",
      onUpdate() {
        const p = this.progress();
        frame.style.filter = p < 1 ? shadow(Math.round((Math.random() * 2 - 1) * 4 * (1 - p))) : "";
      },
      onComplete: () => void (frame.style.filter = ""),
    },
  );
}

function iconCells() {
  return desktop ? [...desktop.icons.querySelectorAll<HTMLElement>(".os-icons__cell")] : [];
}

/** NOW to 1998. About 1.3s with motion, instant without. */
export async function toOS() {
  if (busy || mode === "os") return;
  setBusy(true);
  try {
    await toOSInner();
  } finally {
    setBusy(false);
  }
}

async function toOSInner() {
  stopScroll();
  setSwitches(true);
  click(true);
  await wait(d(0.16));

  freeze();
  const D = showOS();
  setMode("os");
  const phone = isPhone();
  const frame = document.getElementById("frame")!;
  const siteChrome = chrome()!;
  const cells = iconCells();

  if (phone) {
    setSite(fullRect());
    hideForPhone(false);
    siteChrome.hidden = true;
  } else {
    hideForPhone(false);
    setSite(fullRect());
  }
  focusTask("site");

  const tl = gsap.timeline();
  tl.set(cells, { autoAlpha: 0 }).set(D.taskbar, { yPercent: 100 });
  flash();

  if (phone) {
    frame.style.transform = "";
    tl.to(frame, { scaleY: 0.004, transformOrigin: "50% 50%", duration: d(DUR.xs * 0.6), ease: "expoInOut" }, d(0.05))
      .to(frame, { scaleX: 0, duration: d(DUR.xs * 0.5), ease: "expoInOut" })
      .add(() => {
        gsap.set(frame, { clearProps: "transform,transformOrigin" });
        frame.style.transformOrigin = "0 0";
        hideForPhone(true);
      });
  } else {
    tl.fromTo(siteChrome, { opacity: 0 }, { opacity: 1, duration: d(DUR.xs), ease: "expoOut" }, d(0.2));
    tl.add(tweenSite(restRect(), { duration: d(DUR.s), ease: "expoInOut" }), d(0.06));
  }
  tl.to(cells, { autoAlpha: 1, duration: 0.001, stagger: d(0.03) }, d(phone ? 0.3 : 0.42));
  tl.to(D.taskbar, { yPercent: 0, duration: d(DUR.xs), ease: "expoOut" }, d(phone ? 0.25 : 0.5));
  await tl;
  tl.kill();
  gsap.set([...cells, D.taskbar], { clearProps: "opacity,visibility,transform" });
  D.icons.tabIndex = -1;
  D.icons.focus({ preventScroll: true });

}

/** 1998 back to NOW. Windows drop into the taskbar, the site zooms back to full and scroll resumes. */
export async function toModern() {
  if (busy || mode === "modern") return;
  setBusy(true);
  try {
    await toModernInner();
  } finally {
    setBusy(false);
  }
}

async function toModernInner() {
  const D = desktop!;
  D.closeStart();
  setSwitches(false);
  click(false);
  setMode("modern");
  const phone = isPhone();
  const frame = document.getElementById("frame")!;
  const siteChrome = chrome()!;
  const closing = closeAll(true);

  unhideSite();
  const tl = gsap.timeline();
  if (phone) {
    hideForPhone(false);
    siteChrome.hidden = true;
    setSite(fullRect());
    frame.style.transform = "";
    tl.fromTo(frame, { scaleX: 0, scaleY: 0.004, transformOrigin: "50% 50%" }, { scaleX: 1, duration: d(DUR.xs * 0.5), ease: "expoInOut" }, d(0.1)).to(
      frame,
      { scaleY: 1, duration: d(DUR.xs), ease: "expoOut" },
    );
  } else {
    tl.add(tweenSite(fullRect(), { duration: d(DUR.s), ease: "expoInOut" }), d(0.12));
    tl.to(siteChrome, { opacity: 0, duration: d(DUR.xs), ease: "expoInOut" }, d(0.3));
  }
  tl.to(D.taskbar, { yPercent: 100, duration: d(DUR.xs), ease: "expoInOut" }, d(0.1));
  tl.add(() => flash(), d(phone ? 0.05 : 0.3));
  await Promise.all([tl, closing]);
  tl.kill();
  finishModern();
  document.querySelector<HTMLElement>("#chrome [data-switch]")?.focus({ preventScroll: true });
}

function finishModern() {
  const D = desktop;
  destroyAll();
  const frame = document.getElementById("frame")!;
  gsap.set(frame, { clearProps: "transform,transformOrigin,filter" });
  unfreeze();
  hideOS();
  if (D) gsap.set(D.taskbar, { clearProps: "transform" });
  const c = chrome();
  if (c) {
    c.style.opacity = "";
    c.hidden = false;
  }
}

/** Leaves OS mode with no animation, for back/forward pressed while the site is a window */
export function exitInstant() {
  if (mode === "modern" && !isFrozen()) return;
  gsap.killTweensOf(document.getElementById("frame"));
  setSwitches(false);
  if (mode === "os") setMode("modern");
  finishModern();
  setBusy(false);
}

/** The block progress screen shown when the site loads straight into OS mode */
function bootScreen() {
  const blocks = Array.from({ length: 14 }, () => "<i></i>").join("");
  return screen(
    "os-screen",
    `<div class="os-boot">${logoMark(8)}<p class="os-boot__word">ASH/OS<b>98</b></p><div class="os-boot__bar">${blocks}</div><p class="os-boot__note">Starting ASH/OS 98</p></div>`,
  );
}

/**
 * Stored mode was os: render the desktop and the collapsed site at once, then play a 1.2s boot screen
 * over it. data-boot stays on <html> until the boot screen is gone so the loader keeps out of the way.
 */
export async function bootIntoOS() {
  setBusy(true);
  try {
    await bootInner();
  } finally {
    setBusy(false);
  }
}

async function bootInner() {
  setSwitches(true);
  freeze();
  const D = showOS();
  setMode("os");
  if (isPhone()) hideForPhone(true);
  else setSite(restRect());
  focusTask("site");

  if (!reducedMotion()) {
    const el = bootScreen();
    const cells = [...el.querySelectorAll("i")];
    const tl = gsap.timeline();
    cells.forEach((c, i) => tl.add(() => c.classList.add("is-on"), 0.15 + i * 0.065));
    tl.to({}, { duration: 0.1 });
    await tl;
    tl.kill();
    el.remove();
    flash();
  }
  delete html.dataset.boot;
  D.icons.tabIndex = -1;

}

/** Start, Shut down: the orange safe-to-turn-off screen for 1.5s, then the site comes back in 2026 */
export async function shutdown() {
  if (busy || mode !== "os") return;
  setBusy(true);
  try {
    await shutdownInner();
  } finally {
    setBusy(false);
  }
}

async function shutdownInner() {
  desktop?.closeStart();
  const el = screen("os-screen", `<p class="os-safe">It's now safe to turn off<br>your computer.</p>`);
  el.setAttribute("role", "status");
  el.removeAttribute("aria-hidden");
  await wait(1.5);
  setSwitches(false);
  click(false);
  setMode("modern");
  unhideSite();
  finishModern();
  el.replaceChildren();
  await gsap.to(el, { clipPath: "inset(50% 0% 50% 0%)", duration: d(DUR.xs), ease: "expoInOut" });
  el.remove();
  flash();

}
