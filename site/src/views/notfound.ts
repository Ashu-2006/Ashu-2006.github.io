import { DUR, d, gsap, ScrollTrigger } from "../core/motion";
import { lenis, scrollToTarget } from "../core/scroll";
import { mountReveals } from "../lib/reveal";

/**
 * 404: the line rises in, the footer still works, and Night Drive can be played two ways. "Now" opens it
 * on this page with flat pixels; "1998" ([data-play-os], wired in os/boot.ts) flips to the desktop with
 * NightDrive.exe open.
 */
export function mount(root: HTMLElement) {
  const cleanups = [mountReveals(root)];
  const now = root.querySelector<HTMLButtonElement>("[data-play-now]");
  const os = root.querySelector<HTMLButtonElement>("[data-play-os]");
  const stage = root.querySelector<HTMLElement>("[data-nf-stage]");
  if (now && os && stage) cleanups.push(mountDrive(now, os, stage));
  return () => cleanups.forEach((fn) => fn());
}

function mountDrive(btn: HTMLButtonElement, os: HTMLButtonElement, stage: HTMLElement) {
  let stop: (() => void) | null = null;
  /* Bumped on every open and close, so a slow chunk load cannot mount into a stage that was closed meanwhile */
  let token = 0;
  let tween: gsap.core.Tween | null = null;
  const label = btn.querySelector<HTMLElement>(".nf__mode-t");
  const idleText = label?.textContent ?? "";
  const setOpen = (on: boolean) => {
    btn.setAttribute("aria-expanded", String(on));
    if (label) label.textContent = on ? "Stop playing" : idleText;
  };

  const prefetch = () => void import("../game");

  const open = () => {
    const t = ++token;
    setOpen(true);
    stage.hidden = false;
    stage.textContent = "";
    ScrollTrigger.refresh();
    tween?.kill();
    tween = gsap.fromTo(
      stage,
      { clipPath: "inset(0% 0% 100% 0%)" },
      { clipPath: "inset(0% 0% 0% 0%)", duration: d(DUR.m), ease: "expoOut", onComplete: () => void gsap.set(stage, { clearProps: "clipPath" }) },
    );
    /* Centre the stage in the viewport so the whole road is on screen. Lenis still holds the old page height. */
    lenis?.resize();
    scrollToTarget(stage, { offset: -Math.max(0, (window.innerHeight - stage.offsetHeight) / 2) });
    import("../game").then(
      ({ mountGame }) => {
        if (t !== token) return;
        stop = mountGame(stage, { look: "clean", onExit: () => close() });
        stage.querySelector<HTMLElement>(".nd")?.focus({ preventScroll: true });
      },
      () => {
        if (t !== token) return;
        stage.innerHTML = `<p class="nf__fail">Night Drive could not load. Check your connection and try again.</p>`;
        if (label) label.textContent = "Try again";
      },
    );
  };

  const close = (refocus = true) => {
    token++;
    tween?.kill();
    stop?.();
    stop = null;
    stage.hidden = true;
    stage.textContent = "";
    gsap.set(stage, { clearProps: "clipPath" });
    setOpen(false);
    ScrollTrigger.refresh();
    if (refocus) btn.focus({ preventScroll: true });
  };

  /* Playing runs the game; pressing again closes it. After a failed load, pressing again retries. */
  const onNow = () => (stop ? close() : open());
  /* Two copies of the game would fight over the sound, so the 1998 flip ends this one first */
  const onOS = () => stop && close(false);

  btn.addEventListener("click", onNow);
  btn.addEventListener("pointerenter", prefetch, { once: true });
  btn.addEventListener("focus", prefetch, { once: true });
  os.addEventListener("click", onOS);

  return () => {
    btn.removeEventListener("click", onNow);
    btn.removeEventListener("pointerenter", prefetch);
    btn.removeEventListener("focus", prefetch);
    os.removeEventListener("click", onOS);
    token++;
    tween?.kill();
    stop?.();
  };
}
