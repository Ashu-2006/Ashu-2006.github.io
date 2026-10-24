import BGS from "../../lib/sct-backgrounds.json";
import { FORMATS } from "../../templates/stories/social-content-tool";
import { mountKit } from "./kit";

/**
 * Social content tool behaviour, ported from the tool's source: the duotone halftone (backgrounds/duotone.ts:
 * Rec. 709 luma, a two-colour ramp, a clustered-dot threshold), the auto-scrim (lib/contrast.ts: worst-case WCAG
 * contrast over a 12 x 12 sample grid, binary search on opacity only), headline auto-fit, and the formats with their
 * safe areas (formats/index.ts).
 */
export function mount(root: HTMLElement) {
  const base = (root.querySelector<HTMLImageElement>("img[src*='media/']")?.getAttribute("src") ?? "/media/").split("media/")[0];
  const stops = [mountKit(root), duotone(root, base), legibility(root, base), formats(root, base)];
  return () => stops.forEach((s) => s());
}

type Params = { shadow: string; highlight: string; dotSize: number; dotStrength: number; gamma: number };
type Bg = { id: string; label: string; params: Params; w: number; h: number };
const LIB = BGS as Bg[];
const on = (el: EventTarget, type: string, fn: (e: Event) => void) => {
  el.addEventListener(type, fn);
  return () => el.removeEventListener(type, fn);
};
const all = (fns: (() => void)[]) => () => fns.forEach((f) => f());
const hex = (h: string) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)] as const;
const luma = (r: number, g: number, b: number) => (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
const images = new Map<string, Promise<HTMLImageElement>>();
const load = (src: string) => {
  if (!images.has(src))
    images.set(
      src,
      new Promise((res, rej) => {
        const im = new Image();
        im.decoding = "async";
        im.onload = () => res(im);
        im.onerror = rej;
        im.src = src;
      }),
    );
  return images.get(src)!;
};

/* backgrounds/duotone.ts, line for line: cover-fit, luma ^ (1 / gamma), clustered-dot keep test, ramp or paper */
function renderDuotone(ctx: CanvasRenderingContext2D, img: HTMLImageElement, w: number, h: number, p: Params) {
  const scale = Math.max(w / img.naturalWidth, h / img.naturalHeight);
  const dw = img.naturalWidth * scale;
  const dh = img.naturalHeight * scale;
  ctx.drawImage(img, (w - dw) / 2, (h - dh) / 2, dw, dh);
  const image = ctx.getImageData(0, 0, w, h);
  const d = image.data;
  const [sr, sg, sb] = hex(p.shadow);
  const [hr, hg, hb] = hex(p.highlight);
  const inv = 1 / Math.max(0.01, p.gamma);
  const maxR = (p.dotSize * Math.SQRT2) / 2;
  for (let y = 0; y < h; y += 1) {
    for (let x = 0; x < w; x += 1) {
      const i = (y * w + x) * 4;
      const tone = luma(d[i], d[i + 1], d[i + 2]) ** inv;
      let keep = true;
      if (p.dotSize > 1 && p.dotStrength > 0) {
        const cx = (x % p.dotSize) - (p.dotSize - 1) / 2;
        const cy = (y % p.dotSize) - (p.dotSize - 1) / 2;
        keep = Math.sqrt(cx * cx + cy * cy) / maxR <= (1 - tone) * p.dotStrength;
      }
      const k = keep ? Math.min(1, Math.max(0, tone)) : 1;
      d[i] = Math.round(sr + (hr - sr) * k);
      d[i + 1] = Math.round(sg + (hg - sg) * k);
      d[i + 2] = Math.round(sb + (hb - sb) * k);
      d[i + 3] = 255;
    }
  }
  ctx.putImageData(image, 0, 0);
}

function duotone(root: HTMLElement, base: string) {
  const el = root.querySelector<HTMLElement>("[data-duo]");
  if (!el) return () => {};
  const canvas = el.querySelector<HTMLCanvasElement>("[data-duo-canvas]")!;
  const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
  const photos = el.querySelector<HTMLElement>("[data-duo-photos]")!;
  const ramps = el.querySelector<HTMLElement>("[data-duo-ramps]")!;
  const dot = el.querySelector<HTMLInputElement>("[data-duo-dot]")!;
  const gamma = el.querySelector<HTMLInputElement>("[data-duo-gamma]")!;
  photos.innerHTML = LIB.map((b, i) => `<button type="button" data-duo-photo="${i}" aria-pressed="${i === 0}" aria-label="${b.label}" data-cursor="hide"><img src="${base}media/social-content-tool/bg/${b.id}.jpg" alt="" loading="lazy"></button>`).join("");
  ramps.innerHTML = LIB.map((b, i) => `<button type="button" data-duo-ramp="${i}" aria-pressed="${i === 0}" aria-label="Ramp from ${b.params.shadow} to ${b.params.highlight}" style="--a:${b.params.shadow};--b:${b.params.highlight}" data-cursor="hide"></button>`).join("");
  let photo = 0;
  const p: Params = { ...LIB[0].params };
  let raf = 0;
  const sync = () => {
    dot.value = String(p.dotSize);
    gamma.value = String(p.gamma);
    el.querySelector("[data-duo-dot-v]")!.textContent = `${p.dotSize} px`;
    el.querySelector("[data-duo-gamma-v]")!.textContent = p.gamma.toFixed(2);
  };
  const draw = () => {
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(async () => {
      const img = await load(`${base}media/social-content-tool/bg/${LIB[photo].id}.jpg`);
      renderDuotone(ctx, img, canvas.width, canvas.height, p);
      el.dataset.rendered = String(Number(el.dataset.rendered ?? 0) + 1);
    });
  };
  sync();
  const io = new IntersectionObserver((es) => es.some((e) => e.isIntersecting) && (draw(), io.disconnect()), { rootMargin: "300px" });
  io.observe(canvas);
  return all([
    () => {
      io.disconnect();
      cancelAnimationFrame(raf);
    },
    on(el, "click", (e) => {
      const t = e.target as HTMLElement;
      const ph = t.closest<HTMLElement>("[data-duo-photo]");
      if (ph) {
        photo = Number(ph.dataset.duoPhoto);
        Object.assign(p, LIB[photo].params);
        photos.querySelectorAll("[data-duo-photo]").forEach((b) => b.setAttribute("aria-pressed", String(b === ph)));
        ramps.querySelectorAll("[data-duo-ramp]").forEach((b, i) => b.setAttribute("aria-pressed", String(i === photo)));
        sync();
        draw();
      }
      const r = t.closest<HTMLElement>("[data-duo-ramp]");
      if (r) {
        const src = LIB[Number(r.dataset.duoRamp)].params;
        p.shadow = src.shadow;
        p.highlight = src.highlight;
        ramps.querySelectorAll("[data-duo-ramp]").forEach((b) => b.setAttribute("aria-pressed", String(b === r)));
        draw();
      }
    }),
    on(dot, "input", () => {
      p.dotSize = Number(dot.value);
      sync();
      draw();
    }),
    on(gamma, "input", () => {
      p.gamma = Number(gamma.value);
      sync();
      draw();
    }),
  ]);
}

/* lib/contrast.ts: relative luminance, ratio, and the opacity search over sampled background colours */
type RGB = [number, number, number];
const lum = ([r, g, b]: RGB) => {
  const f = (v: number) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
};
const ratio = (a: RGB, b: RGB) => {
  const [x, y] = [lum(a), lum(b)].sort((m, n) => n - m);
  return (x + 0.05) / (y + 0.05);
};
const blend = (bg: RGB, top: RGB, a: number): RGB => [0, 1, 2].map((i) => bg[i] * (1 - a) + top[i] * a) as RGB;
function solveScrimOpacity(text: RGB, samples: { c: RGB; covered: boolean }[], scrim: RGB, target: number) {
  const worstAt = (a: number) => samples.reduce((m, s) => Math.min(m, ratio(text, s.covered ? blend(s.c, scrim, a) : s.c)), Infinity);
  if (worstAt(0) >= target) return { alpha: 0, worst: worstAt(0) };
  if (worstAt(1) < target) return { alpha: 1, worst: worstAt(1) };
  let lo = 0;
  let hi = 1;
  for (let i = 0; i < 24; i += 1) {
    const mid = (lo + hi) / 2;
    if (worstAt(mid) >= target) hi = mid;
    else lo = mid;
  }
  return { alpha: hi, worst: worstAt(hi) };
}

const SAMPLE_GRID = 12;
const SCRIM_TOP = 0.42;
function legibility(root: HTMLElement, base: string) {
  const el = root.querySelector<HTMLElement>("[data-leg]");
  if (!el) return () => {};
  const board = el.querySelector<HTMLElement>("[data-leg-board]")!;
  const bg = el.querySelector<HTMLCanvasElement>("[data-leg-bg]")!;
  const bctx = bg.getContext("2d", { willReadFrequently: true })!;
  const scrim = el.querySelector<HTMLElement>("[data-leg-scrim]")!;
  const box = el.querySelector<HTMLElement>("[data-leg-text]")!;
  const h = el.querySelector<HTMLElement>("[data-leg-h]")!;
  const grip = el.querySelector<HTMLButtonElement>("[data-leg-grip]")!;
  const auto = el.querySelector<HTMLInputElement>("[data-leg-auto]")!;
  const sample = document.createElement("canvas");
  sample.width = sample.height = SAMPLE_GRID;
  const sctx = sample.getContext("2d", { willReadFrequently: true })!;
  let y = 0.62;
  let ready = false;

  const fit = () => {
    let lo = 18;
    let hi = 56;
    for (let i = 0; i < 10; i += 1) {
      const mid = (lo + hi) / 2;
      h.style.fontSize = `${mid}px`;
      if (h.scrollHeight <= box.clientHeight && h.scrollWidth <= h.clientWidth + 1) lo = mid;
      else hi = mid;
    }
    h.style.fontSize = `${Math.floor(lo)}px`;
  };
  const solve = () => {
    if (!ready) return;
    const bw = board.clientWidth;
    const bh = board.clientHeight;
    box.style.top = `${y * 100}%`;
    const r = box.getBoundingClientRect();
    const b = board.getBoundingClientRect();
    const sx = bg.width / bw;
    const sy = bg.height / bh;
    const rx = (r.left - b.left) * sx;
    const ry = (r.top - b.top) * sy;
    sctx.drawImage(bg, rx, ry, r.width * sx, r.height * sy, 0, 0, SAMPLE_GRID, SAMPLE_GRID);
    const d = sctx.getImageData(0, 0, SAMPLE_GRID, SAMPLE_GRID).data;
    const samples: { c: RGB; covered: boolean }[] = [];
    for (let i = 0; i < SAMPLE_GRID * SAMPLE_GRID; i += 1) {
      const row = Math.floor(i / SAMPLE_GRID);
      const py = (r.top - b.top + ((row + 0.5) / SAMPLE_GRID) * r.height) / bh;
      samples.push({ c: [d[i * 4], d[i * 4 + 1], d[i * 4 + 2]], covered: py >= SCRIM_TOP });
    }
    const large = parseFloat(getComputedStyle(h).fontSize) >= 24;
    const target = large ? 3 : 4.5;
    const res = auto.checked ? solveScrimOpacity([255, 255, 255], samples, [13, 13, 13], target) : { alpha: 0, worst: samples.reduce((m, s) => Math.min(m, ratio([255, 255, 255], s.c)), Infinity) };
    scrim.style.opacity = String(res.alpha);
    const pass = res.worst >= target - 0.005;
    el.classList.toggle("is-fail", !pass);
    el.querySelector("[data-leg-ratio]")!.textContent = `${res.worst.toFixed(2)}:1`;
    (el.querySelector("[data-leg-bar]") as HTMLElement).style.width = `${res.alpha * 100}%`;
    el.querySelector("[data-leg-pct]")!.textContent = `${Math.round(res.alpha * 100)}% · target ${target}:1 for ${large ? "large" : "body"} text`;
    const outside = samples.some((s) => !s.covered);
    el.querySelector("[data-leg-note]")!.textContent = !auto.checked
      ? pass
        ? "Passing without a scrim here."
        : "Without the solver, this headline fails on this photo."
      : outside && !pass
        ? "Part of the headline sits outside the scrim. The solver will not move the scrim; the template should move the text."
        : "The scrim stays where the template put it; only its opacity changed.";
  };
  const render = async () => {
    const img = await load(`${base}media/social-content-tool/bg/${LIB[0].id}.jpg`);
    renderDuotone(bctx, img, bg.width, bg.height, LIB[0].params);
    ready = true;
    fit();
    solve();
  };
  const io = new IntersectionObserver((es) => es.some((e) => e.isIntersecting) && (render(), io.disconnect()), { rootMargin: "300px" });
  io.observe(board);
  scrim.style.top = `${SCRIM_TOP * 100}%`;
  box.style.top = `${y * 100}%`;

  let drag: { y0: number; start: number } | null = null;
  const move = (e: PointerEvent) => {
    if (!drag) return;
    const dy = (e.clientY - drag.y0) / board.clientHeight;
    y = Math.min(0.78, Math.max(0.04, drag.start + dy));
    solve();
  };
  return all([
    () => io.disconnect(),
    on(grip, "pointerdown", (e) => {
      const pe = e as PointerEvent;
      grip.setPointerCapture(pe.pointerId);
      drag = { y0: pe.clientY, start: y };
    }),
    on(grip, "pointermove", (e) => move(e as PointerEvent)),
    on(grip, "pointerup", () => (drag = null)),
    on(grip, "keydown", (e) => {
      const k = (e as KeyboardEvent).key;
      if (k !== "ArrowUp" && k !== "ArrowDown") return;
      e.preventDefault();
      y = Math.min(0.78, Math.max(0.04, y + (k === "ArrowUp" ? -0.04 : 0.04)));
      solve();
    }),
    on(h, "input", () => {
      fit();
      solve();
    }),
    on(auto, "change", solve),
  ]);
}

/* formats/index.ts: aspect, safe-area insets and the banner's avatar exclusion, drawn over a treated photo */
function formats(root: HTMLElement, base: string) {
  const el = root.querySelector<HTMLElement>("[data-fmt-root]");
  if (!el) return () => {};
  const board = el.querySelector<HTMLElement>("[data-fmt-board]")!;
  const canvas = el.querySelector<HTMLCanvasElement>("[data-fmt-canvas]")!;
  const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
  const safe = el.querySelector<HTMLElement>("[data-fmt-safe]")!;
  const note = el.querySelector<HTMLElement>("[data-fmt-note]")!;
  let i = 2;
  let seen = false;
  const draw = async () => {
    const f = FORMATS[i];
    const maxW = 460;
    const maxH = 420;
    const k = Math.min(maxW / f.w, maxH / f.h);
    const w = Math.round(f.w * k);
    const hh = Math.round(f.h * k);
    board.style.width = `${w}px`;
    board.style.height = `${hh}px`;
    canvas.width = w;
    canvas.height = hh;
    const [t, r, b, l] = f.safe;
    const pct = (v: number, of: number) => `${(v / of) * 100}%`;
    safe.innerHTML =
      `<i class="fmt__band" style="left:0;right:0;top:0;height:${pct(t, f.h)}"></i><i class="fmt__band" style="left:0;right:0;bottom:0;height:${pct(b, f.h)}"></i>` +
      `<i class="fmt__band" style="top:${pct(t, f.h)};bottom:${pct(b, f.h)};left:0;width:${pct(l, f.w)}"></i><i class="fmt__band" style="top:${pct(t, f.h)};bottom:${pct(b, f.h)};right:0;width:${pct(r, f.w)}"></i>` +
      (f.avatar ? `<i class="fmt__avatar" style="left:${pct(f.avatar[0], f.w)};top:${pct(f.avatar[1], f.h)};width:${pct(f.avatar[2], f.w)};height:${pct(f.avatar[3], f.h)}"><span>Avatar</span></i>` : "");
    note.textContent = `${f.name}, ${f.w} × ${f.h}. ${f.note || `Safe area ${t} px from the edges.`}`;
    if (!seen) return;
    const img = await load(`${base}media/social-content-tool/bg/${LIB[2].id}.jpg`);
    renderDuotone(ctx, img, w, hh, LIB[2].params);
  };
  draw();
  const io = new IntersectionObserver((es) => {
    if (es.some((e) => e.isIntersecting)) {
      seen = true;
      draw();
      io.disconnect();
    }
  }, { rootMargin: "300px" });
  io.observe(board);
  return all([
    () => io.disconnect(),
    on(el, "click", (e) => {
      const b = (e.target as HTMLElement).closest<HTMLElement>("[data-fmt]");
      if (!b) return;
      i = Number(b.dataset.fmt);
      el.querySelectorAll("[data-fmt]").forEach((x) => x.setAttribute("aria-pressed", String(x === b)));
      draw();
    }),
  ]);
}
