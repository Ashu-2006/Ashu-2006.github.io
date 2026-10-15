import { gsap } from "gsap";
import { DrawSVGPlugin } from "gsap/DrawSVGPlugin";
import { SplitText } from "gsap/SplitText";
import { bus } from "../core/bus";
import type { Cleanup } from "../core/router";
import { finePointer, reducedMotion } from "../core/scroll";

gsap.registerPlugin(SplitText, DrawSVGPlugin);

/** Each letter of the name keeps a fixed advance and swaps weight and softness near the cursor, so nothing reflows */
type Glyph = { el: HTMLElement; mask: HTMLElement; x: number; y: number; cur: number; drawn: number };

const BASE_WGHT = 800;
const NEAR_WGHT = 290;

/** The loader adds this once its exit has played, so a later visit to home runs the entrance straight away */
const introDone = () =>
  document.documentElement.classList.contains("intro-done")
    ? Promise.resolve()
    : new Promise<void>((resolve) => {
        const off = bus.on("intro:done", () => {
          off();
          resolve();
        });
      });

export function mount(root: HTMLElement): Cleanup {
  const hero = root.querySelector<HTMLElement>(".hero");
  if (!hero) return () => {};
  const inner = hero.querySelector<HTMLElement>(".hero__inner")!;
  const name = hero.querySelector<HTMLElement>(".hero__name")!;
  const lines = [...hero.querySelectorAll<HTMLElement>("[data-hero-line]")];
  const intro = hero.querySelector<HTMLElement>(".hero__intro")!;
  const fades = [...hero.querySelectorAll<HTMLElement>("[data-hero-fade]")];
  const fallback = hero.querySelector<HTMLElement>(".hero__fallback");
  const svg = hero.querySelector<SVGSVGElement>(".hero__stripes")!;
  const paths = [...svg.querySelectorAll<SVGPathElement>("path")];

  const reduce = reducedMotion();
  const ctx = gsap.context(() => {}, hero);
  let dead = false;
  let glyphs: Glyph[] = [];

  /* ---------- stripes: in from the left edge, under "Rana", then down the right gutter to the fold ---------- */
  const px = (prop: string) => parseFloat(getComputedStyle(hero).getPropertyValue(prop)) || 0;
  const drawStripes = () => {
    const W = hero.clientWidth;
    const H = hero.clientHeight;
    const s = px("--stripe");
    const g = px("--stripe-gap");
    const band = px("--band");
    const space = px("--band-space");
    const gutter = parseFloat(getComputedStyle(inner).paddingRight) || 0;
    const top = inner.offsetTop + intro.offsetTop - space - band;
    const left = W - gutter / 2 - band / 2;
    const rIn = s * 1.2;
    svg.setAttribute("viewBox", `0 0 ${W} ${H}`);
    paths.forEach((p, i) => {
      const r = rIn + (2 - i) * (s + g);
      const y = top + s / 2 + i * (s + g);
      const x = left + band - s / 2 - i * (s + g);
      p.setAttribute("d", `M -4 ${y.toFixed(1)} H ${(x - r).toFixed(1)} A ${r.toFixed(1)} ${r.toFixed(1)} 0 0 1 ${x.toFixed(1)} ${(y + r).toFixed(1)} V ${H + 4}`);
    });
  };
  drawStripes();

  /* ---------- hidden until the needle lands ---------- */
  if (!reduce) {
    gsap.set(lines, { autoAlpha: 0 });
    gsap.set(svg, { autoAlpha: 0 });
    gsap.set(fades, { autoAlpha: 0, y: 16 });
    if (fallback) gsap.set(fallback, { opacity: 0, scale: 0.94 });
  }

  const measure = () => {
    for (const gl of glyphs) {
      const r = gl.mask.getBoundingClientRect();
      gl.x = r.left + r.width / 2;
      gl.y = r.top + scrollY + r.height / 2;
    }
  };

  const split = document.fonts.ready.then(() => {
    if (dead) return null;
    let made: SplitText | null = null;
    ctx.add(() => {
      made = SplitText.create(lines, { type: "chars", mask: "chars", charsClass: "hero__char", tag: "span", aria: "none" });
    });
    const st = made as SplitText | null;
    if (!st) return null;
    const fs = parseFloat(getComputedStyle(name).fontSize);
    const chars = st.chars as HTMLElement[];
    const widths = chars.map((c) => c.getBoundingClientRect().width);
    chars.forEach((c, i) => (c.style.width = `${(widths[i] / fs).toFixed(4)}em`));
    glyphs = chars.map((el) => ({ el, mask: el.parentElement as HTMLElement, x: 0, y: 0, cur: 0, drawn: 0 }));
    if (!reduce) {
      gsap.set(chars, { yPercent: 118 });
      gsap.set(lines, { autoAlpha: 1 });
    }
    drawStripes();
    measure();
    return chars;
  });

  /* ---------- entrance: one timeline, the name rises, the stripes run, the words settle ---------- */
  const entrance = (chars: HTMLElement[], delay: number) => {
    if (reduce) return;
    ctx.add(() => {
      const tl = gsap.timeline({ delay });
      tl.to(chars, { yPercent: 0, duration: 1.05, ease: "back.out(1.6)", stagger: 0.042 }, 0);
      tl.set(svg, { autoAlpha: 1 }, 0.12);
      tl.fromTo(
        paths,
        { drawSVG: "0% 0%" },
        { drawSVG: "0% 100%", duration: 1.7, ease: "power3.inOut", stagger: 0.09, onComplete: () => gsap.set(paths, { clearProps: "strokeDasharray,strokeDashoffset" }) },
        0.12,
      );
      if (fallback) tl.to(fallback, { opacity: 1, scale: 1, duration: 1.1, ease: "expo.out" }, 0.1);
      tl.to(fades, { autoAlpha: 1, y: 0, duration: 0.9, ease: "power3.out", stagger: 0.1 }, 0.55);
    });
  };

  const firstVisit = !document.documentElement.classList.contains("intro-done");
  Promise.all([split, introDone()]).then(([chars]) => {
    if (dead || !chars) return;
    entrance(chars, firstVisit ? 0 : 0.3);
  });

  /* ---------- the name as an instrument: letters thin out and sharpen under the cursor ---------- */
  let pointer = { x: -9999, y: -9999, on: false };
  let running = false;
  let inView = true;

  const write = (gl: Glyph) => {
    if (Math.abs(gl.cur - gl.drawn) < 0.004) return;
    gl.drawn = gl.cur;
    if (gl.cur < 0.004) {
      gl.el.style.fontVariationSettings = "";
      return;
    }
    const soft = 100 - gl.cur * 100;
    const wght = BASE_WGHT - gl.cur * (BASE_WGHT - NEAR_WGHT);
    gl.el.style.fontVariationSettings = `"SOFT" ${soft.toFixed(1)}, "WONK" 1, "wght" ${wght.toFixed(0)}`;
  };

  const tick = () => {
    const fs = parseFloat(getComputedStyle(name).fontSize);
    const reach = fs * 1.05;
    const py = pointer.y + scrollY;
    let moving = false;
    for (const gl of glyphs) {
      let target = 0;
      if (pointer.on && inView) {
        const d = Math.hypot(pointer.x - gl.x, (py - gl.y) * 1.3);
        const t = Math.max(0, 1 - d / reach);
        target = t * t * (3 - 2 * t);
      }
      gl.cur += (target - gl.cur) * 0.14;
      if (Math.abs(target - gl.cur) < 0.003) gl.cur = target;
      else moving = true;
      write(gl);
    }
    if (!moving) stop();
  };
  const start = () => {
    if (running || !glyphs.length) return;
    running = true;
    gsap.ticker.add(tick);
  };
  const stop = () => {
    if (!running) return;
    running = false;
    gsap.ticker.remove(tick);
  };

  const onMove = (e: PointerEvent) => {
    if (e.pointerType !== "mouse") return;
    pointer = { x: e.clientX, y: e.clientY, on: true };
    if (inView) start();
  };
  const onOut = (e: PointerEvent) => {
    if (e.relatedTarget) return;
    pointer.on = false;
    start();
  };

  const fine = finePointer();
  if (fine) {
    window.addEventListener("pointermove", onMove, { passive: true });
    document.addEventListener("pointerout", onOut);
  }

  const io = new IntersectionObserver(([entry]) => {
    inView = entry.isIntersecting;
    if (!inView) start();
  });
  io.observe(name);

  const ro = new ResizeObserver(() => {
    drawStripes();
    measure();
  });
  ro.observe(hero);
  const onScrollEnd = () => measure();
  window.addEventListener("load", onScrollEnd);

  return () => {
    dead = true;
    stop();
    io.disconnect();
    ro.disconnect();
    window.removeEventListener("load", onScrollEnd);
    if (fine) {
      window.removeEventListener("pointermove", onMove);
      document.removeEventListener("pointerout", onOut);
    }
    ctx.revert();
  };
}
