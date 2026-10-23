import { ScrollTrigger, gsap, reducedMotion } from "../core/motion";
import { pad2 } from "../lib/html";

/**
 * Show case: the section pins. First the window grows from a framed card to full bleed while "Show" and "Case"
 * part to either side and the caption arrives; then each further screen of scroll steps to the next case study
 * (media crossfades, caption and index follow, the window links to that case). Desktop only: below 1024px or with
 * reduced motion the stylesheet shows the plain list instead and this does nothing.
 */
export function mountShowcase(root: HTMLElement): () => void {
  const section = root.querySelector<HTMLElement>(".sc");
  const pin = section?.querySelector<HTMLElement>("[data-sc-pin]");
  const frame = section?.querySelector<HTMLAnchorElement>("[data-sc-frame]");
  if (!section || !pin || !frame || reducedMotion() || !matchMedia("(min-width: 1024px)").matches) return () => {};
  const slides = Array.from(section.querySelectorAll<HTMLElement>("[data-sc-slide]"));
  const items = Array.from(section.querySelectorAll<HTMLElement>("[data-sc-i]"));
  const q = <T extends HTMLElement>(sel: string) => section.querySelector<T>(sel);
  const [left, right, cap, index, shade] = [q("[data-sc-l]"), q("[data-sc-r]"), q("[data-sc-cap]"), q("[data-sc-index]"), q(".sc__shade")];
  const capN = q("[data-sc-n]");
  const capName = q("[data-sc-name]");
  const capKind = q("[data-sc-kind]");
  const capYear = q("[data-sc-year]");
  const n = slides.length;

  let active = 0;
  const setActive = (i: number) => {
    if (i === active) return;
    active = i;
    slides.forEach((s, k) => s.classList.toggle("is-on", k === i));
    items.forEach((s, k) => s.classList.toggle("is-on", k === i));
    const d = slides[i].dataset;
    frame.href = d.href ?? frame.href;
    frame.setAttribute("aria-label", `Open case: ${d.name ?? ""}`);
    if (capN) capN.textContent = pad2(i + 1);
    if (capName) capName.textContent = d.name ?? "";
    if (capKind) capKind.textContent = d.kind ?? "";
    if (capYear) capYear.textContent = d.year ?? "";
  };

  /* One unit to grow, then one unit held per case study */
  const units = 1 + n;
  const tl = gsap.timeline({ defaults: { ease: "none" } });
  tl.fromTo(frame, { clipPath: "inset(30% 35% 30% 35% round 12px)" }, { clipPath: "inset(0% 0% 0% 0% round 0px)", duration: 1 }, 0);
  /* The words travel with the window's edges (35vw each side), so they never sit over the image */
  if (left) tl.fromTo(left, { x: 0 }, { x: () => -innerWidth * 0.4, opacity: 0, duration: 1 }, 0);
  if (right) tl.fromTo(right, { x: 0 }, { x: () => innerWidth * 0.4, opacity: 0, duration: 1 }, 0);
  if (shade) tl.fromTo(shade, { opacity: 0 }, { opacity: 1, duration: 0.6 }, 0.4);
  if (cap) tl.fromTo(cap, { opacity: 0, y: 24 }, { opacity: 1, y: 0, duration: 0.35 }, 0.65);
  if (index) tl.fromTo(index, { opacity: 0 }, { opacity: 1, duration: 0.35 }, 0.65);
  tl.to({}, { duration: n });

  const st = ScrollTrigger.create({
    trigger: section,
    start: "top top",
    end: () => `+=${units * innerHeight * 0.75}`,
    pin,
    pinSpacing: true,
    scrub: true,
    animation: tl,
    invalidateOnRefresh: true,
    onUpdate: (self) => {
      setActive(Math.min(n - 1, Math.max(0, Math.floor(self.progress * units - 1))));
      /* Once the window has all but filled the screen, the chrome reads it as media (light type on a scrim) */
      if (self.progress * units > 0.85) pin.dataset.chromeTone = "media";
      else delete pin.dataset.chromeTone;
    },
  });

  return () => {
    delete pin.dataset.chromeTone;
    st.kill();
    tl.kill();
    gsap.set([frame, left, right, shade, cap, index].filter(Boolean), { clearProps: "all" });
  };
}
