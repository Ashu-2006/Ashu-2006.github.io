import { finePointer } from "../core/motion";
import { SITE } from "../content";
import { esc } from "../lib/html";
import { CASES, docName } from "./apps";
import { icon, iconMask, logoMark, type IconName } from "./icons";
import { blip, setSound, soundOn } from "./sound";
import { SITE_TITLE } from "./site";

/**
 * ASH/OS 98's desktop. The wallpaper, logo and icon columns render into #os (behind the live site);
 * the taskbar, Start menu and the CRT scanlines render into #overlay so they sit above every window.
 * Built once on first entry and kept; os.css hides the overlay half outside OS mode.
 */

export type DeskAction = { kind: "open"; id: string; from: HTMLElement } | { kind: "start"; id: string };

type DeskItem = { id: string; label: string; icon: IconName; extra?: string };

const ITEMS: DeskItem[] = [
  { id: "work", label: "Work", icon: "work" },
  ...CASES.map((p) => ({ id: `doc:${p.slug}`, label: docName(p), icon: "doc" as IconName })),
  { id: "about", label: "About.txt", icon: "txt" },
  { id: "contact", label: "Contact.exe", icon: "exe" },
  { id: "play", label: "Playground", icon: "play" },
  { id: "game", label: "NightDrive.exe", icon: "car" },
  { id: "welcome", label: "Welcome.txt", icon: "txt" },
  { id: "bin", label: "Recycle Bin", icon: "bin" },
  { id: "site", label: SITE_TITLE, icon: "site", extra: "os-icon--site" },
];

type StartSub = { id: string; label: string; icon: IconName; bold?: boolean };
type StartEntry = { id: string; label: string; icon: IconName; sep?: boolean; big?: boolean; sub?: StartSub[]; flyoutOnly?: boolean };

/** A page item's flyout: Open (the OS window, also the item's own click) or View page (flip back and route) */
const pageSub = (id: string, ic: IconName): StartSub[] => [
  { id, label: "Open", icon: ic, bold: true },
  { id: `page:${id}`, label: "View page", icon: "site" },
];

const START: StartEntry[] = [
  { id: "site", label: "Back to 2026", icon: "logo", big: true },
  {
    id: "programs",
    label: "Programs",
    icon: "folder",
    sep: true,
    flyoutOnly: true,
    sub: [
      { id: "game", label: "NightDrive.exe", icon: "car", bold: true },
      { id: "welcome", label: "Welcome.txt", icon: "txt" },
    ],
  },
  { id: "work", label: "Work", icon: "work", sub: pageSub("work", "work") },
  { id: "play", label: "Playground", icon: "play", sub: pageSub("play", "play") },
  { id: "about", label: "About", icon: "txt", sub: pageSub("about", "txt") },
  { id: "contact", label: "Contact", icon: "exe", sub: pageSub("contact", "exe") },
  { id: "shutdown", label: "Shut down...", icon: "site", sep: true },
];

const iconButton = (it: DeskItem) =>
  `<li class="os-icons__cell${it.extra ? ` ${it.extra}` : ""}"><button class="os-icon" type="button" data-open="${esc(it.id)}" style="--os-mask:${iconMask(it.icon)}"><span class="os-icon__img">${icon(it.icon, 32)}</span><span class="os-icon__label">${esc(it.label)}</span></button></li>`;

const startItem = (it: StartEntry) => {
  const sep = it.sep ? '<li class="os-start__sep" role="separator"></li>' : "";
  const label = `<span class="os-start__text"><u>${esc(it.label[0])}</u>${esc(it.label.slice(1))}</span>`;
  const cls = `os-start__item${it.big ? " os-start__item--big" : ""}`;
  if (!it.sub) {
    return `${sep}<li role="none"><button class="${cls}" type="button" role="menuitem" data-start="${it.id}" tabindex="-1">${icon(it.icon, 32)}${label}</button></li>`;
  }
  const sub = `<ul class="os-start__sub" role="menu" aria-label="${esc(it.label)}">${it.sub
    .map(
      (s) =>
        `<li role="none"><button class="os-start__item os-start__item--sub" type="button" role="menuitem" data-start="${s.id}" tabindex="-1">${icon(s.icon, 16)}<span class="os-start__text">${s.bold ? `<b>${esc(s.label)}</b>` : esc(s.label)}</span></button></li>`,
    )
    .join("")}</ul>`;
  return `${sep}<li class="os-start__group" role="none"><button class="${cls}" type="button" role="menuitem" aria-haspopup="menu" aria-expanded="false" data-start="${it.id}"${it.flyoutOnly ? " data-flyout-only" : ""} tabindex="-1">${icon(it.icon, 32)}${label}<span class="os-start__arrow" aria-hidden="true"></span></button>${sub}</li>`;
};

/** A non-interactive copy of the header switch for the taskbar's Back to 2026 button */
const mirrorSwitch = () =>
  `<span class="switch os-back__switch" aria-checked="true" data-switch-mirror aria-hidden="true"><span class="switch__track"><span class="switch__label switch__label--now"><span class="switch__word">NOW</span></span><span class="switch__label switch__label--then"><span class="switch__word">1998</span></span><span class="switch__knob"></span></span></span>`;

export type Desktop = {
  desk: HTMLElement;
  layer: HTMLElement;
  taskbar: HTMLElement;
  tasks: HTMLElement;
  icons: HTMLElement;
  startOpen(): boolean;
  closeStart(focusButton?: boolean): void;
  setClock(on: boolean): void;
  paintWallpaper(): void;
};

let built: Desktop | null = null;

/** Builds the desktop once. `act` receives every icon activation and Start menu choice. */
export function buildDesktop(act: (a: DeskAction) => void): Desktop {
  if (built) return built;
  const os = document.getElementById("os")!;
  const overlay = document.getElementById("overlay")!;

  const desk = document.createElement("div");
  desk.className = "os-desk";
  desk.innerHTML = `<div class="os-desk__logo" aria-hidden="true">${logoMark(12)}<span class="os-desk__word">ASH/OS<b>98</b></span></div><ul class="os-icons" aria-label="Desktop">${ITEMS.map(iconButton).join("")}</ul>`;
  os.append(desk);

  const layer = document.createElement("div");
  layer.className = "os-layer";
  layer.innerHTML = `<div class="os-taskbar" role="region" aria-label="Taskbar">
  <button class="os-btn os-start-btn" type="button" aria-haspopup="menu" aria-expanded="false" aria-controls="os-start">${icon("logo", 16)}<span>Start</span></button>
  <span class="os-taskbar__grip" aria-hidden="true"></span>
  <div class="os-tasks" role="group" aria-label="Open windows"></div>
  <button class="os-btn os-back" type="button" data-back aria-label="Back to 2026">${mirrorSwitch()}<span class="os-back__label">Back to 2026</span></button>
  <div class="os-tray"><button class="os-tray__sound" type="button" aria-pressed="${soundOn()}" aria-label="Sound">${icon(soundOn() ? "speaker" : "mute", 16)}</button><time class="os-tray__clock" data-os-clock></time></div>
</div>
<div class="os-start" id="os-start" role="menu" aria-label="Start" hidden>
  <div class="os-start__band" aria-hidden="true"><span>ASH/OS <b>98</b></span></div>
  <ul class="os-start__list" role="none">${START.map(startItem).join("")}</ul>
</div>
<div class="os-crt" aria-hidden="true"></div>`;
  overlay.append(layer);

  const icons = desk.querySelector<HTMLElement>(".os-icons")!;
  const taskbar = layer.querySelector<HTMLElement>(".os-taskbar")!;
  const tasks = layer.querySelector<HTMLElement>(".os-tasks")!;
  const startBtn = layer.querySelector<HTMLButtonElement>(".os-start-btn")!;
  const start = layer.querySelector<HTMLElement>(".os-start")!;
  const sound = layer.querySelector<HTMLButtonElement>(".os-tray__sound")!;
  const clock = layer.querySelector<HTMLTimeElement>("[data-os-clock]")!;

  /* Icons: one click (or tap, or Enter) opens; an empty desktop click clears the selection */
  const select = (btn: HTMLElement | null) => {
    icons.querySelectorAll(".is-sel").forEach((b) => b.classList.remove("is-sel"));
    btn?.classList.add("is-sel");
  };
  icons.addEventListener("click", (e) => {
    const btn = (e.target as Element).closest<HTMLElement>("[data-open]");
    if (!btn) return;
    select(btn);
    act({ kind: "open", id: btn.dataset.open!, from: btn });
  });
  layer.querySelector("[data-back]")!.addEventListener("click", () => act({ kind: "start", id: "site" }));
  icons.addEventListener("focusin", (e) => select((e.target as Element).closest<HTMLElement>("[data-open]")));
  desk.addEventListener("pointerdown", (e) => {
    if (!(e.target as Element).closest("[data-open]")) select(null);
  });

  /* Start menu */
  const items = () => [...start.querySelectorAll<HTMLElement>(".os-start__list > li > [data-start]")];
  const subItems = (group: Element) => [...group.querySelectorAll<HTMLElement>(".os-start__sub [data-start]")];
  const setFlyout = (group: Element | null) => {
    start.querySelectorAll(".os-start__group").forEach((g) => {
      const on = g === group;
      g.classList.toggle("is-open", on);
      g.firstElementChild?.setAttribute("aria-expanded", String(on));
    });
  };
  const openStart = () => {
    start.hidden = false;
    startBtn.setAttribute("aria-expanded", "true");
    startBtn.classList.add("is-down");
    blip();
    items()[0]?.focus({ preventScroll: true });
  };
  const closeStart = (focusButton = false) => {
    if (start.hidden) return;
    setFlyout(null);
    start.hidden = true;
    startBtn.setAttribute("aria-expanded", "false");
    startBtn.classList.remove("is-down");
    if (focusButton) startBtn.focus({ preventScroll: true });
  };
  startBtn.addEventListener("click", () => (start.hidden ? openStart() : closeStart()));
  start.addEventListener("click", (e) => {
    const it = (e.target as Element).closest<HTMLElement>("[data-start]");
    if (!it) return;
    const group = it.closest(".os-start__group");
    if (group && !it.closest(".os-start__sub") && (it.hasAttribute("data-flyout-only") || !finePointer())) {
      setFlyout(group.classList.contains("is-open") ? null : group);
      return;
    }
    closeStart();
    act({ kind: "start", id: it.dataset.start! });
  });
  start.addEventListener("keydown", (e) => {
    const active = document.activeElement as HTMLElement;
    const group = active.closest(".os-start__group");
    const inSub = Boolean(active.closest(".os-start__sub"));
    if (inSub && group) {
      const subs = subItems(group);
      const j = subs.indexOf(active);
      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault();
        subs[(j + (e.key === "ArrowDown" ? 1 : -1) + subs.length) % subs.length].focus({ preventScroll: true });
      } else if (e.key === "ArrowLeft" || e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        setFlyout(null);
        (group.firstElementChild as HTMLElement).focus({ preventScroll: true });
      }
      return;
    }
    if (e.key === "ArrowRight" && group) {
      e.preventDefault();
      setFlyout(group);
      subItems(group)[0]?.focus({ preventScroll: true });
      return;
    }
    const list = items();
    const i = list.indexOf(active);
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      const next = (i + (e.key === "ArrowDown" ? 1 : -1) + list.length) % list.length;
      list[next].focus({ preventScroll: true });
    } else if (e.key === "Home" || e.key === "End") {
      e.preventDefault();
      list[e.key === "Home" ? 0 : list.length - 1].focus({ preventScroll: true });
    } else if (e.key === "Tab") closeStart();
  });
  start.addEventListener("pointerover", (e) => {
    const it = (e.target as Element).closest<HTMLElement>("[data-start]");
    if (!it || !finePointer()) return;
    it.focus({ preventScroll: true });
    if (!it.closest(".os-start__sub")) setFlyout(it.closest(".os-start__group"));
  });
  document.addEventListener("pointerdown", (e) => {
    if (start.hidden) return;
    const t = e.target as Element;
    if (!start.contains(t) && !startBtn.contains(t)) closeStart();
  });

  /* Tray */
  sound.addEventListener("click", () => {
    const on = !soundOn();
    setSound(on);
    sound.setAttribute("aria-pressed", String(on));
    sound.innerHTML = icon(on ? "speaker" : "mute", 16);
    blip();
  });

  const timeFmt = new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit", timeZone: SITE.timeZone });
  const dateFmt = new Intl.DateTimeFormat("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric", timeZone: SITE.timeZone });
  let clockTimer = 0;
  const tick = () => {
    const now = new Date();
    const t = timeFmt.format(now);
    if (clock.textContent !== t) clock.textContent = t;
    clock.dateTime = now.toISOString();
    clock.title = `${dateFmt.format(now)}, Jabalpur`;
  };
  const setClock = (on: boolean) => {
    clearInterval(clockTimer);
    if (!on) return;
    tick();
    clockTimer = window.setInterval(tick, 10000);
  };

  built = {
    desk,
    layer,
    taskbar,
    tasks,
    icons,
    startOpen: () => !start.hidden,
    closeStart,
    setClock,
    paintWallpaper: () => paintWallpaper(desk),
  };
  return built;
}

const BAYER = [
  [0, 8, 2, 10],
  [12, 4, 14, 6],
  [3, 11, 1, 9],
  [15, 7, 13, 5],
];

/**
 * The wallpaper: a vertical gradient from --os-desk to --os-desk-dither drawn as a 4x4 ordered (Bayer)
 * dither, one CSS pixel per cell, so it reads as a 1998 sixteen colour gradient rather than a smooth blend.
 */
function paintWallpaper(desk: HTMLElement) {
  const css = getComputedStyle(document.documentElement);
  const a = css.getPropertyValue("--os-desk").trim();
  const b = css.getPropertyValue("--os-desk-dither").trim();
  const h = Math.max(1, Math.round(window.innerHeight));
  const c = document.createElement("canvas");
  c.width = 4;
  c.height = h;
  const ctx = c.getContext("2d");
  if (!ctx) return;
  ctx.fillStyle = a;
  ctx.fillRect(0, 0, 4, h);
  ctx.fillStyle = b;
  for (let y = 0; y < h; y++) {
    const t = Math.min(1, Math.max(0, (y / h - 0.15) / 0.85));
    for (let x = 0; x < 4; x++) if ((BAYER[y % 4][x] + 0.5) / 16 < t) ctx.fillRect(x, y, 1, 1);
  }
  desk.style.setProperty("--os-wall", `url(${c.toDataURL("image/png")})`);
  desk.style.setProperty("--os-wall-h", `${h}px`);
}
