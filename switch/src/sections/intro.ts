import { bus } from "../core/bus";
import { getPhase, whenIdle } from "../core/motion";

/** The loader may not exist yet or may be skipped; never hold the hero longer than this. */
const INTRO_FALLBACK_MS = 3500;

let introDone = false;
bus.on("intro:done", () => {
  introDone = true;
});

/**
 * Runs `fn` once the first-load intro is over. After a client navigation the intro is long done, so it
 * only waits for the curtain to be idle. On first load it waits for `intro:done`, or a 3.5s fallback.
 * Returns a cancel function for the view cleanup.
 */
export function afterIntro(fn: () => void): () => void {
  let dead = false;
  let fired = false;
  const run = () => {
    if (dead || fired) return;
    fired = true;
    fn();
  };
  const html = document.documentElement;
  const navigated = getPhase() !== "idle";
  if (introDone || navigated || html.dataset.intro === "done") {
    whenIdle().then(run);
    return () => void (dead = true);
  }
  const off = bus.on("intro:done", () => whenIdle().then(run));
  const timer = window.setTimeout(run, INTRO_FALLBACK_MS);
  return () => {
    dead = true;
    off();
    clearTimeout(timer);
  };
}
