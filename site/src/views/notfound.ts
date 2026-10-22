import { bus } from "../core/bus";
import { lenis, scrollToTarget } from "../core/scroll";
import { mountReveals } from "../lib/reveal";

/**
 * 404: the line rises in, one way out, and Night Drive driving its attract loop underneath as a preview
 * that Play turns into the real game. "Or play it in 1998" ([data-play-os], wired in os/boot.ts) flips to the desktop with
 * NightDrive.exe open, so the preview steps aside while the site is in 1998.
 */
export function mount(root: HTMLElement) {
  const cleanups = [mountReveals(root)];
  const home = root.querySelector<HTMLAnchorElement>("[data-nf-home]");
  const stage = root.querySelector<HTMLElement>("[data-nf-stage]");
  if (home) cleanups.push(mountBack(home));
  if (stage) cleanups.push(mountPreview(stage));
  return () => cleanups.forEach((fn) => fn());
}

/**
 * Arriving from another page of this site, the way out is back to that page. Arriving from outside (an
 * old link in a resume, a typed URL) there is nothing of ours to go back to, so it stays a link home.
 * The router pushes a state object on every client navigation; a fresh load from outside has none.
 */
function mountBack(home: HTMLAnchorElement) {
  const sameOrigin = document.referrer.startsWith(`${location.origin}/`);
  if (history.length < 2 || (history.state === null && !sameOrigin)) return () => {};
  home.textContent = "Go back";
  /* Modified clicks keep the link's own meaning (home, in a new tab); stopping here keeps the router out */
  const onClick = (e: MouseEvent) => {
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();
    history.back();
  };
  home.addEventListener("click", onClick);
  return () => home.removeEventListener("click", onClick);
}

function mountPreview(stage: HTMLElement) {
  let stop: (() => void) | null = null;
  /* Bumped on every start and stop, so a slow chunk load cannot mount into a preview that was stopped meanwhile */
  let token = 0;

  const start = () => {
    if (stop) return;
    const t = ++token;
    import("../game").then(
      ({ mountGame }) => {
        if (t !== token) return;
        stage.textContent = "";
        stop = mountGame(stage, { look: "clean", preview: true });
      },
      () => {
        if (t !== token) return;
        stage.innerHTML = `<p class="nf__fail">Night Drive could not load. Reload the page to try again.</p>`;
      },
    );
  };

  const end = () => {
    token++;
    stop?.();
    stop = null;
  };

  /* After the page has painted and settled, so the game never competes with the first frame */
  let live = true;
  const kick = () => live && start();
  if ("requestIdleCallback" in window) requestIdleCallback(kick, { timeout: 1500 });
  else setTimeout(kick, 300);
  /* Two copies of the game would fight over the sound and the GPU */
  const off = bus.on("mode:change", ({ mode }) => (mode === "os" ? end() : start()));

  /* Play can grow the stage (phones), so centre it once it has its playing size. Lenis still holds the old page height. */
  const onWake = (e: MouseEvent) => {
    if (!(e.target as Element).closest("[data-act=wake]")) return;
    requestAnimationFrame(() => {
      lenis?.resize();
      scrollToTarget(stage, { offset: -Math.max(0, (window.innerHeight - stage.offsetHeight) / 2) });
    });
  };
  stage.addEventListener("click", onWake);

  return () => {
    live = false;
    stage.removeEventListener("click", onWake);
    off();
    end();
  };
}
