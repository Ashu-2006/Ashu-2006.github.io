import { ScrollTrigger, gsap, reducedMotion } from "../core/motion";

/**
 * The middle of the home page, all scroll-linked:
 * - What I do: the statement's words fill from faint to full as it scrolls through the viewport.
 * - Credits: the ink panel opens from a framed card to its full half, and the halftone collage drifts up.
 * - The advantage: each number counts up once, when its row enters.
 * Reduced motion shows everything at rest.
 */
export function mountApproach(root: HTMLElement): () => void {
  if (reducedMotion()) return () => {};
  const tweens: gsap.core.Animation[] = [];
  const triggers: ScrollTrigger[] = [];

  const text = root.querySelector<HTMLElement>("[data-ap-text]");
  const words = text ? Array.from(text.querySelectorAll<HTMLElement>(".ap__w")) : [];
  if (text && words.length) {
    tweens.push(
      gsap.fromTo(
        words,
        { opacity: 0.16 },
        { opacity: 1, ease: "none", stagger: 0.1, scrollTrigger: { trigger: text, start: "top 78%", end: "bottom 42%", scrub: true } },
      ),
    );
  }

  const ink = root.querySelector<HTMLElement>("[data-cr-ink]");
  if (ink) {
    tweens.push(
      gsap.fromTo(
        ink,
        { clipPath: "inset(14% 10% 14% 10%)" },
        { clipPath: "inset(0% 0% 0% 0%)", ease: "none", scrollTrigger: { trigger: ink, start: "top 90%", end: "top 20%", scrub: true } },
      ),
    );
  }
  const grid = root.querySelector<HTMLElement>("[data-cr-grid]");
  if (grid) {
    const tiles = Array.from(grid.querySelectorAll<HTMLElement>(".cr__tile"));
    tweens.push(
      gsap.fromTo(
        tiles,
        { yPercent: (i: number) => 18 + (i % 3) * 10 },
        { yPercent: (i: number) => -8 - (i % 3) * 6, ease: "none", scrollTrigger: { trigger: grid, start: "top bottom", end: "bottom top", scrub: true } },
      ),
    );
  }

  root.querySelectorAll<HTMLElement>("[data-count]").forEach((el) => {
    const to = Number(el.dataset.count);
    const n = { v: 0 };
    el.textContent = "0";
    triggers.push(
      ScrollTrigger.create({
        trigger: el,
        start: "top 88%",
        once: true,
        onEnter: () => tweens.push(gsap.to(n, { v: to, duration: 1.2, ease: "expo.out", onUpdate: () => (el.textContent = String(Math.round(n.v))) })),
      }),
    );
  });

  return () => {
    tweens.forEach((t) => {
      t.scrollTrigger?.kill();
      t.kill();
    });
    triggers.forEach((t) => t.kill());
    words.forEach((w) => gsap.set(w, { clearProps: "opacity" }));
  };
}
