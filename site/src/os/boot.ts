import { bus } from "../core/bus";

/**
 * Keeps ASH/OS 98 (about 90 KB of desktop, window manager and Draggable) out of the first page load.
 * The chunk is fetched in idle time once the first page has settled, or sooner on intent (pointer over
 * or focus on the switch or a "Play in 1998" button), and wired only when it is first needed, so the
 * flip still starts at once.
 */
type OS = typeof import("./index");
let mod: Promise<OS> | null = null;

const load = () => (mod ??= import("./index"));
const ready = () => load().then((m) => (m.initOS(), m));

const isOSTrigger = (t: EventTarget | null) => t instanceof Element && !!t.closest("[data-switch], [data-play-os]");

export function initOSLoader() {
  document.addEventListener("click", (e) => {
    if (!isOSTrigger(e.target)) return;
    e.preventDefault();
    const play = (e.target as Element).closest("[data-play-os]");
    void ready().then((m) => (play ? m.playInOS() : m.toggleMode()));
  });

  if (document.documentElement.dataset.boot === "os") {
    void ready();
    return;
  }

  const intent = (e: Event) => isOSTrigger(e.target) && void load();
  document.addEventListener("pointerover", intent, { passive: true });
  document.addEventListener("focusin", intent);
  document.addEventListener("touchstart", intent, { passive: true });

  const off = bus.on("intro:done", () => {
    off();
    const prefetch = () => ("requestIdleCallback" in window ? requestIdleCallback(() => void load(), { timeout: 3000 }) : void load());
    window.setTimeout(prefetch, 2500);
  });
}
