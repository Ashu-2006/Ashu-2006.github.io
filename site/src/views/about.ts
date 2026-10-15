import { ScrollTrigger } from "../core/motion";
import { pad2 } from "../lib/html";
import { mountReveals } from "../lib/reveal";
import { rollingPolygon } from "../sections/polygon";
import type { Route } from "../templates/routes";

/**
 * About page behaviour: reveals, and the How I work stage. The stage is sticky (CSS) inside a taller
 * section; one ScrollTrigger maps the section's progress to the polygon and to the active principle.
 */
export function mount(root: HTMLElement, _route?: Route) {
  const stopReveals = mountReveals(root);
  const section = root.querySelector<HTMLElement>(".about__how");
  const canvas = root.querySelector<HTMLCanvasElement>(".about__poly");
  if (!section || !canvas) return stopReveals;

  const items = Array.from(section.querySelectorAll<HTMLElement>(".about__principle"));
  const sidesEl = section.querySelector<HTMLElement>(".about__sides-n");
  let shownSides = "";
  const poly = rollingPolygon(canvas, ({ sides, circle }) => {
    const text = circle > 0.98 ? "∞" : pad2(Math.round(sides));
    if (sidesEl && text !== shownSides) sidesEl.textContent = shownSides = text;
  });

  let active = 0;
  const setActive = (i: number) => {
    if (i === active) return;
    active = i;
    items.forEach((el, j) => el.classList.toggle("is-active", j === i));
  };

  const st = ScrollTrigger.create({
    trigger: section,
    start: "top top",
    end: "bottom bottom",
    onUpdate: (self) => {
      poly.setTarget(self.progress);
      setActive(Math.min(items.length - 1, Math.floor(self.progress * items.length)));
    },
    onRefresh: (self) => poly.setTarget(self.progress),
  });

  return () => {
    stopReveals();
    st.kill();
    poly.destroy();
  };
}
