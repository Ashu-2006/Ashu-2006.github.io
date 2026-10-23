import { DUR, d, gsap } from "../core/motion";
import { pad2 } from "../lib/html";

/** Voices: one quote at a time. Prev and Next wrap round; the outgoing quote fades before the next one rises. */
export function mountVoices(root: HTMLElement): () => void {
  const stage = root.querySelector<HTMLElement>("[data-vc]");
  const prev = root.querySelector<HTMLButtonElement>("[data-vc-prev]");
  const next = root.querySelector<HTMLButtonElement>("[data-vc-next]");
  const count = root.querySelector<HTMLElement>("[data-vc-n]");
  if (!stage || !prev || !next) return () => {};
  const slides = Array.from(stage.querySelectorAll<HTMLElement>("[data-vc-slide]"));
  if (slides.length < 2) return () => {};
  let at = 0;
  let busy: gsap.core.Timeline | null = null;

  const go = (step: number) => {
    busy?.progress(1);
    const from = slides[at];
    at = (at + step + slides.length) % slides.length;
    const to = slides[at];
    if (count) count.textContent = pad2(at + 1);
    busy = gsap
      .timeline({ onComplete: () => void (busy = null) })
      .to(from, { opacity: 0, duration: d(DUR.xs), ease: "power2.in" })
      .add(() => {
        from.hidden = true;
        from.classList.remove("is-on");
        to.hidden = false;
        to.classList.add("is-on");
      })
      .fromTo(to, { opacity: 0, y: 16 }, { opacity: 1, y: 0, duration: d(DUR.s), ease: "expo.out" });
  };
  const onPrev = () => go(-1);
  const onNext = () => go(1);
  prev.addEventListener("click", onPrev);
  next.addEventListener("click", onNext);
  return () => {
    busy?.kill();
    prev.removeEventListener("click", onPrev);
    next.removeEventListener("click", onNext);
  };
}
