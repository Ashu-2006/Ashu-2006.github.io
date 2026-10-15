import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { bus } from "../core/bus";
import type { Cleanup } from "../core/router";
import { reducedMotion } from "../core/scroll";
import { sound } from "../core/sound";

/**
 * Side A. Hovering or focusing a row tells the stage which sleeve to show and ticks like a stylus finding the track;
 * leaving the list clears it. The rows are pressed in once, top to bottom, the first time the list comes into view.
 */
export function mount(root: HTMLElement): Cleanup {
  const section = root.querySelector<HTMLElement>(".side-a");
  if (!section) return () => {};
  const list = section.querySelector<HTMLElement>(".tracks")!;
  const rows = [...section.querySelectorAll<HTMLElement>(".track")];
  const links = [...section.querySelectorAll<HTMLAnchorElement>(".track__link")];
  const fallback = section.querySelector<HTMLImageElement>(".side-a__fallback");
  const ctx = gsap.context(() => {}, section);

  let current: string | null = null;
  const select = (link: HTMLAnchorElement | null) => {
    const slug = link?.dataset.slug ?? null;
    if (slug === current) return;
    current = slug;
    bus.emit("track:hover", { slug });
    if (!link) return;
    sound.tick(0.9 + links.indexOf(link) * 0.05);
    const thumb = link.querySelector<HTMLImageElement>(".track__thumb");
    if (fallback && thumb && !document.documentElement.classList.contains("has-stage")) fallback.src = thumb.src;
  };

  const onEnter = (e: Event) => select(e.currentTarget as HTMLAnchorElement);
  const onLeave = () => select(null);
  const onFocusOut = (e: FocusEvent) => {
    if (!list.contains(e.relatedTarget as Node | null)) select(null);
  };
  links.forEach((a) => {
    a.addEventListener("pointerenter", onEnter);
    a.addEventListener("focus", onEnter);
  });
  list.addEventListener("pointerleave", onLeave);
  list.addEventListener("focusout", onFocusOut);

  if (!reducedMotion()) {
    ctx.add(() => {
      gsap.set(rows, { autoAlpha: 0, y: 34 });
      let played = false;
      const press = () => {
        if (played) return;
        played = true;
        gsap.to(rows, { autoAlpha: 1, y: 0, duration: 0.42, ease: "power3.out", stagger: 0.038, clearProps: "transform,opacity,visibility" });
      };
      ScrollTrigger.create({ trigger: list, start: "top 88%", once: true, onEnter: press, onLeave: press });
    });
  }

  return () => {
    links.forEach((a) => {
      a.removeEventListener("pointerenter", onEnter);
      a.removeEventListener("focus", onEnter);
    });
    list.removeEventListener("pointerleave", onLeave);
    list.removeEventListener("focusout", onFocusOut);
    if (current) bus.emit("track:hover", { slug: null });
    ctx.revert();
  };
}
