import { gsap } from "gsap";
import { Draggable } from "gsap/Draggable";
import { InertiaPlugin } from "gsap/InertiaPlugin";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import type { Cleanup } from "../core/router";
import { finePointer, reducedMotion } from "../core/scroll";
import { sound } from "../core/sound";

gsap.registerPlugin(Draggable, InertiaPlugin);

const NUDGE = 16;
const NUDGE_BIG = 48;
const KEYS: Record<string, [number, number]> = {
  ArrowLeft: [-1, 0],
  ArrowRight: [1, 0],
  ArrowUp: [0, -1],
  ArrowDown: [0, 1],
};

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/**
 * The prints on the liner notes: a loose stack of photos you can push around the table.
 * They are dealt in once when the stack scrolls into view, then the fact stickers slap on.
 */
export function mount(root: HTMLElement): Cleanup {
  const box = root.querySelector<HTMLElement>("[data-prints]");
  if (!box) return () => {};
  const prints = [...box.querySelectorAll<HTMLElement>("[data-print]")];
  const stickers = [...box.querySelectorAll<HTMLElement>(".sticker")];
  const still = reducedMotion();
  const offs: (() => void)[] = [];
  const listen = <K extends keyof HTMLElementEventMap>(el: HTMLElement, type: K, fn: (e: HTMLElementEventMap[K]) => void) => {
    el.addEventListener(type, fn);
    offs.push(() => el.removeEventListener(type, fn));
  };

  /* The resting tilt lives in notes.css (--tilt) so the prerendered page already looks dealt; GSAP takes it over from here */
  const tilt = prints.map((p) => Number(gsap.getProperty(p, "rotation")) || 0);
  gsap.set(prints, { x: 0, y: 0, rotation: (i: number) => tilt[i] });

  let intro: gsap.core.Timeline | null = null;

  /** Pressing during the deal ends it: the rest of the stack lands, the held print stays in hand */
  const endIntro = (held?: HTMLElement) => {
    if (!intro) return;
    deal?.kill();
    intro.kill();
    intro = null;
    prints.forEach((p, i) => {
      if (p === held) gsap.to(p, { rotation: tilt[i], duration: 0.4, ease: "power3.out" });
      else gsap.to(p, { x: 0, y: 0, rotation: tilt[i], duration: 0.5, ease: "power3.out", overwrite: true });
    });
    gsap.to(stickers, { scale: 1, autoAlpha: 1, duration: 0.2, overwrite: true });
  };

  const lift = (p: HTMLElement, up: boolean) => {
    p.classList.toggle("is-lifted", up);
    gsap.to(p, { scale: up ? 1.04 : 1, duration: still ? 0 : up ? 0.25 : 0.5, ease: up ? "power3.out" : "power4.out", overwrite: "auto" });
  };

  /** Where an unfinished keyboard nudge is heading, per print */
  const goals = new Map<HTMLElement, { x: number; y: number }>();

  const drags = prints.map((p) => {
    const [drag] = Draggable.create(p, {
      type: finePointer() ? "x,y" : "x",
      bounds: box,
      inertia: !still,
      edgeResistance: 0.7,
      zIndexBoost: true,
      onPress() {
        goals.delete(p);
        endIntro(p);
        lift(p, true);
        sound.tick(0.5);
      },
      onRelease() {
        lift(p, false);
        sound.tick(0.35);
      },
    });
    return drag;
  });

  prints.forEach((p, i) => {
    listen(p, "focus", () => {
      p.style.zIndex = String(++Draggable.zIndex);
    });
    listen(p, "keydown", (e) => {
      const dir = KEYS[e.key];
      if (!dir || e.altKey || e.metaKey || e.ctrlKey) return;
      e.preventDefault();
      endIntro();
      const step = e.shiftKey ? NUDGE_BIG : NUDGE;
      /* Held keys repeat faster than the nudge eases, so aim from where the last nudge is going */
      const now = { x: Number(gsap.getProperty(p, "x")), y: Number(gsap.getProperty(p, "y")) };
      const from = goals.get(p) ?? now;
      const a = box.getBoundingClientRect();
      const b = p.getBoundingClientRect();
      const ox = from.x - now.x;
      const oy = from.y - now.y;
      const dx = clamp(dir[0] * step, a.left - b.left - ox, a.right - b.right - ox);
      const dy = clamp(dir[1] * step, a.top - b.top - oy, a.bottom - b.bottom - oy);
      if (!dx && !dy) return;
      const to = { x: from.x + dx, y: from.y + dy };
      goals.set(p, to);
      gsap.to(p, {
        ...to,
        duration: still ? 0 : 0.2,
        ease: "power3.out",
        overwrite: "auto",
        onComplete: () => {
          goals.delete(p);
          drags[i].update();
        },
      });
    });
  });

  let deal: ScrollTrigger | null = null;
  let live = true;
  if (!still) {
    const vw = innerWidth;
    intro = gsap
      .timeline({ paused: true, defaults: { ease: "power4.out" } })
      .fromTo(
        prints,
        {
          x: (_: number, p: HTMLElement) => -(p.getBoundingClientRect().right + vw * 0.08),
          y: (i: number) => 60 + i * 24,
          rotation: (i: number) => tilt[i] - 16 + i * 3,
        },
        { x: 0, y: 0, rotation: (i: number) => tilt[i], duration: 0.82, stagger: 0.1, immediateRender: true },
      )
      .fromTo(
        stickers,
        { scale: 1.32, autoAlpha: 0 },
        { scale: 1, autoAlpha: 1, duration: 0.3, ease: "back.out(2.2)", stagger: 0.07, immediateRender: true },
        0.84,
      );
    /* Never deal blank paper: wait for the photos, but not for long */
    const imgs = [...box.querySelectorAll<HTMLImageElement>(".print img")];
    deal = ScrollTrigger.create({
      trigger: box,
      start: "top 72%",
      once: true,
      onEnter: () => {
        const decoded = Promise.all(
          imgs.map((img) => {
            img.loading = "eager";
            return img.decode().catch(() => undefined);
          }),
        );
        Promise.race([decoded, new Promise((done) => setTimeout(done, 700))]).then(() => {
          if (live) intro?.play();
        });
      },
    });
  }

  return () => {
    live = false;
    offs.forEach((off) => off());
    deal?.kill();
    intro?.kill();
    drags.forEach((d) => d.kill());
    gsap.killTweensOf([...prints, ...stickers]);
  };
}
