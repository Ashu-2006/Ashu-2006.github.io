import { SITE } from "../content";
import { DUR, d, finePointer, gsap, reducedMotion } from "../core/motion";

export const SCRAMBLE_CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";

/**
 * Copy the address on `[data-copy]` click and confirm by scrambling its `[data-copy-label]` to "Copied".
 * If the clipboard is unavailable the address in `[data-copy-source]` is selected instead.
 */
export function mountCopy(scope: HTMLElement): () => void {
  const btn = scope.querySelector<HTMLButtonElement>("[data-copy]");
  const label = scope.querySelector<HTMLElement>("[data-copy-label]");
  if (!btn || !label) return () => {};
  const idle = label.textContent || "Copy email";
  let timer = 0;
  const say = (text: string) => gsap.to(label, { duration: d(DUR.s), ease: "none", overwrite: true, scrambleText: { text, chars: SCRAMBLE_CHARS, speed: 0.8 } });

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(SITE.email);
      say("Copied");
    } catch (err) {
      console.warn("Clipboard unavailable", err);
      const sel = getSelection();
      const source = scope.querySelector("[data-copy-source]");
      if (sel && source) {
        const range = document.createRange();
        range.selectNodeContents(source);
        sel.removeAllRanges();
        sel.addRange(range);
      }
      say("Selected");
    }
    clearTimeout(timer);
    timer = window.setTimeout(() => say(idle), 2400);
  };
  btn.addEventListener("click", copy);
  return () => {
    clearTimeout(timer);
    gsap.killTweensOf(label);
    btn.removeEventListener("click", copy);
  };
}

/** Links whose `[data-scramble-text]` resolves through random glyphs on hover (fine pointer only) */
export function mountScrambleHover(root: ParentNode): () => void {
  if (!finePointer() || reducedMotion()) return () => {};
  const links = Array.from(root.querySelectorAll<HTMLElement>("[data-scramble-hover]"));
  const offs = links.map((link) => {
    const target = link.querySelector<HTMLElement>("[data-scramble-text]") ?? link;
    const text = target.textContent || "";
    const on = () => gsap.to(target, { duration: DUR.s, ease: "none", overwrite: true, scrambleText: { text, chars: SCRAMBLE_CHARS, speed: 1 } });
    link.addEventListener("pointerenter", on);
    return () => {
      link.removeEventListener("pointerenter", on);
      gsap.killTweensOf(target);
      target.textContent = text;
    };
  });
  return () => offs.forEach((fn) => fn());
}

/**
 * Sizes `box` (via the CSS variable `prop`) so `inner` spans its content width exactly. Measured at
 * 100px and scaled, refitted when the width changes or fonts load.
 */
export function fitText(box: HTMLElement, inner: HTMLElement, prop: string): () => void {
  let dead = false;
  let width = -1;
  const fit = (force = false) => {
    if (!force && box.clientWidth === width) return;
    width = box.clientWidth;
    box.style.setProperty(prop, "100px");
    const natural = inner.scrollWidth;
    if (natural > 0) box.style.setProperty(prop, `${(100 * width) / natural}px`);
  };
  fit(true);
  const refit = () => !dead && fit(true);
  document.fonts?.ready.then(refit);
  document.fonts?.addEventListener("loadingdone", refit);
  const ro = new ResizeObserver(() => fit());
  ro.observe(box);
  return () => {
    dead = true;
    ro.disconnect();
    document.fonts?.removeEventListener("loadingdone", refit);
  };
}
