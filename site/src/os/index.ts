import "../styles/os.css";
import "../styles/game.css";
import { bus } from "../core/bus";
import { gsap } from "../core/motion";
import { navigate } from "../core/router";
import { PROJECTS } from "../content";
import { aboutWindow, binWindow, closeSiteWindow, contactWindow, docWindow, gameWindow, playWindow, setPageOpener, welcomeWindow, workWindow } from "./apps";
import type { DeskAction } from "./desktop";
import { buildDesktop } from "./desktop";
import { bootIntoOS, configureFlip, currentMode, exitInstant, isFlipping, shutdown, toModern, toOS } from "./flip";
import { resizeFrozen } from "./site";
import { read, write } from "./store";
import { closeWindow, focusedWindow, getWin, initWM, openWindow, relayout, type WinSpec } from "./wm";

/**
 * ASH/OS 98 entry, loaded on demand by ./boot.ts, which owns the [data-switch] clicks. Boots straight
 * into the desktop when the stored mode is os (index.html sets html[data-boot="os"] before paint), and
 * keeps the OS honest about routing: anything that changes the route flips back to 2026 first.
 */

const BASE = import.meta.env.BASE_URL;
let started = false;

/** Flips to whichever mode is not current */
export function toggleMode() {
  return currentMode() === "os" ? toModern() : enterOS();
}

/** Flips to 1998. The very first time, the Work folder opens with Welcome.txt on top, so there is content at once. */
async function enterOS() {
  await toOS();
  if (currentMode() !== "os" || read("switch:welcomed")) return;
  write("switch:welcomed", "1");
  openWindow(workWindow());
  openWindow(welcomeWindow());
}

function specFor(id: string): WinSpec | null {
  if (id === "work") return workWindow();
  if (id === "about") return aboutWindow();
  if (id === "contact") return contactWindow();
  if (id === "play") return playWindow();
  if (id === "bin") return binWindow();
  if (id === "welcome") return welcomeWindow();
  if (id === "game") return gameWindow();
  if (id.startsWith("doc:")) {
    const p = PROJECTS.find((x) => `doc:${x.slug}` === id);
    return p ? docWindow(p) : null;
  }
  return null;
}

/** Flips back to 2026 and routes. Routes never change while the site is a window. */
async function openPage(path: string) {
  if (isFlipping()) return;
  await toModern();
  navigate(`${BASE}${path}`);
}

const PAGES: Record<string, string> = { work: "work/", play: "playground/", about: "about/", contact: "contact/" };

function act(a: DeskAction) {
  if (isFlipping()) return;
  if (a.kind === "start" && a.id.startsWith("page:")) {
    const path = PAGES[a.id.slice(5)];
    if (path) void openPage(path);
    return;
  }
  if (a.id === "site") {
    void toModern();
    return;
  }
  if (a.kind === "start" && a.id === "shutdown") {
    void shutdown();
    return;
  }
  const spec = specFor(a.id);
  if (spec) openWindow(spec, a.kind === "open" ? a.from : null);
}

/** Wires the switch and the OS layer. Call once, after the router has mounted the first page. */
export function initOS() {
  if (started) return;
  started = true;

  configureFlip({
    act,
    site: {
      onMax: () => void toModern(),
      onClose: () => {
        openWindow(
          closeSiteWindow(() => {
            const dlg = getWin("alert:close-site");
            if (dlg) void closeWindow(dlg);
            void toModern();
          }),
        );
      },
    },
  });

  setPageOpener((path) => void openPage(path));

  /* "Open in browser", "Open full case" and the Start menu's "View page": flip back, then route */
  document.addEventListener("click", (e) => {
    const btn = (e.target as Element | null)?.closest<HTMLElement>("[data-open-page]");
    if (!btn || currentMode() !== "os") return;
    e.preventDefault();
    void openPage(btn.dataset.openPage!);
  });

  const desk = buildDesktop(act);
  initWM({ layer: desk.layer, tasks: desk.tasks, taskbar: desk.taskbar });

  document.addEventListener("keydown", (e) => {
    if (e.key !== "Escape" || currentMode() !== "os" || isFlipping()) return;
    if (desk.startOpen()) {
      desk.closeStart(true);
      return;
    }
    const w = focusedWindow();
    if (w) {
      e.preventDefault();
      void closeWindow(w);
    }
  });

  /* Back and forward while the site is a window: leave OS mode at once, the curtain covers the rest */
  bus.on("transition:phase", ({ phase }) => {
    if (phase === "covering" && currentMode() === "os") exitInstant();
  });

  let resizeTimer = 0;
  window.addEventListener("resize", () => {
    clearTimeout(resizeTimer);
    resizeTimer = window.setTimeout(() => {
      if (currentMode() !== "os" || isFlipping()) return;
      resizeFrozen();
      relayout();
      desk.paintWallpaper();
    }, 150);
  });

  if (document.documentElement.dataset.boot === "os") void bootIntoOS();

  if (import.meta.env.DEV) {
    Object.assign(window, {
      __switch: toggleMode,
      __os: { toOS: enterOS, toModern, shutdown, gsap, open: (id: string) => act({ kind: "start", id }) },
    });
  }
}
