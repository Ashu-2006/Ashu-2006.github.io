import { DUR, ScrollTrigger, gsap, reducedMotion } from "../../core/motion";
import { mountTldr } from "../../lib/tldr";

/**
 * Behaviour shared by every case story: the pinned page scroller, scroll zoom, outcome bars and TL;DR. A story view
 * calls mountKit(root) and adds its own live components. Static markup is always the correct end state; scripts
 * only add motion and picking.
 */
export function mountKit(root: HTMLElement) {
  const stops = [scroller(root), zoom(root), bars(root), mountTldr(root)];
  return () => stops.forEach((s) => s());
}

/**
 * Desktop: the section is tall and its content pinned; scroll progress moves the capture inside the window and lights
 * the item that part of the page answers. Below 1024px the window scrolls natively and the list follows it.
 */
function scroller(root: HTMLElement) {
  const el = root.querySelector<HTMLElement>("[data-ia]");
  if (!el) return () => {};
  const win = el.querySelector<HTMLElement>(".ia__window")!;
  const img = el.querySelector<HTMLImageElement>(".ia__page")!;
  const items = Array.from(el.querySelectorAll<HTMLElement>(".ia__item"));
  const ys = items.map((i) => Number(i.dataset.y));
  const captureW = Number(el.dataset.captureW) || 1440;

  const light = (top: number) => {
    const scale = win.clientWidth / captureW;
    const probe = top + win.clientHeight * 0.3;
    let on = 0;
    ys.forEach((y, i) => {
      if (y * scale <= probe) on = i;
    });
    items.forEach((it, i) => it.classList.toggle("is-on", i === on));
  };

  const onNative = () => light(win.scrollTop);
  win.addEventListener("scroll", onNative, { passive: true });

  const mm = gsap.matchMedia();
  mm.add("(min-width: 1024px)", () => {
    win.scrollTop = 0;
    const travel = () => {
      const scale = win.clientWidth / captureW;
      return Math.min(img.offsetHeight - win.clientHeight, ys[ys.length - 1] * scale + win.clientHeight * 0.1);
    };
    const t = ScrollTrigger.create({
      trigger: el,
      start: "top top",
      end: "bottom bottom",
      invalidateOnRefresh: true,
      onUpdate: (self) => {
        const y = self.progress * Math.max(0, travel());
        img.style.transform = `translate3d(0, ${-y}px, 0)`;
        light(y);
      },
    });
    return () => {
      t.kill();
      img.style.transform = "";
    };
  });

  return () => {
    win.removeEventListener("scroll", onNative);
    mm.revert();
  };
}

/** A [data-zoom] frame starts zoomed into its subject and pulls back to the whole capture as it scrolls in */
function zoom(root: HTMLElement) {
  const tweens = Array.from(root.querySelectorAll<HTMLElement>("[data-zoom] .zoom > img")).map((img) =>
    gsap.fromTo(
      img,
      { scale: reducedMotion() ? 1 : 1.9 },
      { scale: 1, ease: "none", scrollTrigger: { trigger: img.closest("[data-zoom]"), start: "top 90%", end: "center 55%", scrub: 0.4 } },
    ),
  );
  return () => tweens.forEach((t) => (t.scrollTrigger?.kill(), t.kill()));
}

/** Outcome bars grow from zero when their row arrives; static markup already draws them full */
function bars(root: HTMLElement) {
  if (reducedMotion()) return () => {};
  const tweens = Array.from(root.querySelectorAll<HTMLElement>(".res__row")).map((row) =>
    gsap.fromTo(
      row.querySelectorAll(".res__fill"),
      { scaleX: 0 },
      { scaleX: 1, duration: DUR.l, ease: "expoOut", stagger: 0.12, scrollTrigger: { trigger: row, start: "top 75%", once: true } },
    ),
  );
  return () => tweens.forEach((t) => (t.scrollTrigger?.kill(), t.kill()));
}
