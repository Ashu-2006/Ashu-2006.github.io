import { gsap } from "gsap";
import { SplitText } from "gsap/SplitText";
import type { Cleanup } from "../core/router";
import { reducedMotion } from "../core/scroll";
import { arriving, whenRevealing } from "../core/transition";
import * as encore from "../sections/encore";

gsap.registerPlugin(SplitText);

/** The words rise, then jump once in place like a needle skipping a groove, and the record plays on */
function skip(section: HTMLElement, ctx: gsap.Context) {
  const title = section.querySelector<HTMLElement>(".nf__title");
  const rest = section.querySelectorAll(".nf .lede, .nf__home");
  if (!title) return;
  ctx.add(() => gsap.set([title, rest], { autoAlpha: 0 }));

  Promise.all([document.fonts.ready, whenRevealing()]).then(() => {
    if (!section.isConnected) return;
    ctx.add(() => {
      const split = SplitText.create(title, { type: "lines,words", mask: "lines", linesClass: "case-line" });
      gsap.set(title, { autoAlpha: 1 });
      const jolt = (i: number) => {
        const s = i % 2 ? 1 : -1;
        return [
          { x: `${0.06 * s}em`, y: "-0.08em", rotate: 2.2 * s, duration: 0.05 },
          { x: `${-0.04 * s}em`, y: "0.045em", rotate: -1.4 * s, duration: 0.06 },
          { x: `${0.03 * s}em`, y: "-0.025em", rotate: 0.7 * s, duration: 0.05 },
          { x: 0, y: 0, rotate: 0, duration: 0.08 },
        ];
      };
      const tl = gsap.timeline({ delay: arriving() === "wipe" ? 0.2 : 0.1 });
      tl.fromTo(split.words, { yPercent: 110 }, { yPercent: 0, duration: 1.05, ease: "power4.out", stagger: 0.09 }, 0);
      tl.fromTo(rest, { autoAlpha: 0, y: 16 }, { autoAlpha: 1, y: 0, duration: 0.8, ease: "power3.out", stagger: 0.08 }, 0.45);
      split.words.forEach((word, i) => tl.to(word, { keyframes: jolt(i), ease: "none" }, 1.45 + i * 0.03));
      tl.add(() => split.revert());
    });
  });
}

export function mount(root: HTMLElement): Cleanup {
  const cleanups: Cleanup[] = [encore.mount(root)];
  const section = root.querySelector<HTMLElement>(".nf");
  if (section && !reducedMotion()) {
    const ctx = gsap.context(() => {});
    skip(section, ctx);
    cleanups.push(() => ctx.revert());
  }
  return () => cleanups.forEach((fn) => fn());
}
