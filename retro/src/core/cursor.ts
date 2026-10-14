import { gsap } from "gsap";
import { finePointer, reducedMotion } from "./scroll";

/**
 * A small ink dot that follows the pointer, and a disc that appears only over things you can act on.
 * Elements opt in with data-cursor: "play" (a spinning record: opens a project), "open", "drag", "hide".
 * Touch and coarse pointers never see it.
 */
export function initCursor() {
  const el = document.querySelector<HTMLElement>("[data-cursor-el]");
  if (!el || !finePointer()) return;
  document.documentElement.classList.add("has-cursor");

  const pos = { x: innerWidth / 2, y: innerHeight / 2 };
  const xTo = gsap.quickTo(el, "x", { duration: reducedMotion() ? 0 : 0.35, ease: "power3.out" });
  const yTo = gsap.quickTo(el, "y", { duration: reducedMotion() ? 0 : 0.35, ease: "power3.out" });

  let state = "";
  const setState = (next: string) => {
    if (next === state) return;
    state = next;
    el.dataset.state = next;
  };

  window.addEventListener(
    "pointermove",
    (e) => {
      if (e.pointerType !== "mouse") return;
      pos.x = e.clientX;
      pos.y = e.clientY;
      xTo(pos.x);
      yTo(pos.y);
      el.classList.add("is-active");
      const target = (e.target as Element | null)?.closest<HTMLElement>("[data-cursor], a, button, [role='slider'], [role='switch']");
      if (!target) return setState("");
      setState(target.dataset.cursor ?? "link");
    },
    { passive: true },
  );
  document.addEventListener("pointerleave", () => el.classList.remove("is-active"));
  window.addEventListener("pointerdown", () => el.classList.add("is-down"));
  window.addEventListener("pointerup", () => el.classList.remove("is-down"));

  /* The stage reports when the pointer is over the record, which has no DOM element of its own */
  window.addEventListener("cursor:state", ((e: CustomEvent<string>) => setState(e.detail)) as EventListener);
}
