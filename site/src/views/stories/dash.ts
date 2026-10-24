import { DUR, ScrollTrigger, finePointer, gsap, reducedMotion } from "../../core/motion";
import { SHOTS } from "../../templates/stories/dash";
import { mountKit } from "./kit";

/**
 * Behaviour for the DASH story. Every demo is already correct as static markup: the ladder is drawn lit, the
 * chart is drawn placed, the shelf shows Glow. Scripts only add the scrub, the picking and the liquid carve.
 */
export function mount(root: HTMLElement) {
  const stops: (() => void)[] = [];
  stops.push(mountKit(root), ladder(root), liquid(root), rto(root), shelf(root));
  return () => stops.forEach((s) => s());
}

/* ------------------------------------------------------------------ ladder */

/** Seconds per mark and per step, as in the prototype: the bottle spans the same time as its row's marks */
const MARK_LIT = 0.12;
const MARK_STEP = 0.06;

function ladder(root: HTMLElement) {
  const el = root.querySelector<HTMLElement>("[data-ladder]");
  if (!el) return () => {};
  const rows = Array.from(el.querySelectorAll<HTMLButtonElement>(".lad__row"));
  const sum = el.querySelector<HTMLElement>(".lad__sum");
  const summaries: string[] = JSON.parse(el.dataset.summaries ?? "[]");

  const pick = (row: HTMLButtonElement) => {
    rows.forEach((r) => r.setAttribute("aria-pressed", String(r === row)));
    if (sum) sum.textContent = summaries[Number(row.dataset.pack)] ?? "";
  };
  const onClick = (e: Event) => {
    const row = (e.target as HTMLElement).closest<HTMLButtonElement>(".lad__row");
    if (row) pick(row);
  };
  el.addEventListener("click", onClick);

  /* One scrubbed timeline, rows overlapping slightly, so the fill reads as one run: this far, further, all the way */
  let tl: gsap.core.Timeline | null = null;
  if (!reducedMotion()) {
    tl = gsap.timeline({ scrollTrigger: { trigger: el, start: "top 80%", end: "bottom 60%", scrub: 0.6, invalidateOnRefresh: true } });
    rows.forEach((row) => {
      const marks = row.querySelectorAll<HTMLElement>(".lad__ink");
      const pips = row.querySelectorAll<HTMLElement>(".lad__pip");
      const bottle = row.querySelector<HTMLElement>(".lad__bottle");
      tl!.fromTo(marks, { scaleX: 0 }, { scaleX: 1, ease: "none", duration: MARK_LIT, stagger: MARK_STEP }, ">-0.5");
      const last = Number(row.dataset.servings) - 1;
      if (!bottle || !pips[last]) return;
      const span = MARK_STEP * Math.max(0, marks.length - 1) + MARK_LIT;
      tl!.fromTo(bottle, { x: () => pips[0].offsetLeft - pips[last].offsetLeft }, { x: 0, ease: "none", duration: span }, "<");
    });
  }

  return () => {
    el.removeEventListener("click", onClick);
    tl?.scrollTrigger?.kill();
    tl?.kill();
  };
}

/* ---------------------------------------------------------- liquid carve */

const BLOB_RATIO = 0.58;
const BLOB_MIN = 14;
const FOLLOW_TAU = 0.08;
const SQUASH_TAU = 0.09;
const SQUASH_PER_PX_PER_SEC = 0.0007;
const SQUASH_MAX = 1.28;
const SQUASH_MIN_SPEED = 8;
const BITE_FRINGE = 1.08;

let uid = 0;

/**
 * A blob follows the cursor and knocks a hole out of the button surface through an SVG mask; the shared goo filter
 * rounds the hole and grows shoulders where it meets the edge. A second copy of the label, clipped to the bite,
 * keeps the text readable inside it.
 */
function liquid(root: HTMLElement) {
  const offs = Array.from(root.querySelectorAll<HTMLButtonElement>("[data-liquid]")).map(carve);
  return () => offs.forEach((o) => o());
}

function carve(btn: HTMLButtonElement) {
  const svg = btn.querySelector<SVGSVGElement>(".dbtn__bg")!;
  const mask = svg.querySelector<SVGMaskElement>(".dbtn__mask")!;
  const surface = svg.querySelector<SVGRectElement>(".dbtn__surface")!;
  const reveal = svg.querySelector<SVGRectElement>(".dbtn__reveal")!;
  const stroke = svg.querySelector<SVGRectElement>(".dbtn__stroke")!;
  const follow = svg.querySelector<SVGGElement>(".dbtn__follow")!;
  const squash = svg.querySelector<SVGGElement>(".dbtn__squash")!;
  const blob = svg.querySelector<SVGCircleElement>("circle")!;
  const label = btn.querySelector<HTMLElement>(".dbtn__label--carve")!;

  const id = `dash-bite-${++uid}`;
  mask.id = id;
  surface.setAttribute("mask", `url(#${id})`);

  let blobR = 0;
  const size = () => {
    const w = btn.offsetWidth;
    const h = btn.offsetHeight;
    const rx = Math.min(w, h) / 2;
    [surface, reveal].forEach((r) => (r.setAttribute("rx", String(rx)), r.setAttribute("ry", String(rx))));
    stroke.setAttribute("width", String(Math.max(0, w - 2)));
    stroke.setAttribute("height", String(Math.max(0, h - 2)));
    stroke.setAttribute("rx", String(Math.max(0, rx - 1)));
    stroke.setAttribute("ry", String(Math.max(0, rx - 1)));
    blobR = Math.max(BLOB_MIN, (h * BLOB_RATIO) / 2);
  };
  size();
  const ro = new ResizeObserver(size);
  ro.observe(btn);

  const st = { x: 0, y: 0, tx: 0, ty: 0, squash: 1, angle: 0 };
  let running = false;
  const tick = (_t: number, deltaMs: number) => {
    const dt = Math.min(0.05, deltaMs / 1000) || 0.016;
    const k = 1 - Math.exp(-dt / FOLLOW_TAU);
    const dx = (st.tx - st.x) * k;
    const dy = (st.ty - st.y) * k;
    st.x += dx;
    st.y += dy;
    const speed = Math.hypot(dx, dy) / dt;
    const want = Math.min(SQUASH_MAX, 1 + speed * SQUASH_PER_PX_PER_SEC);
    st.squash += (want - st.squash) * (1 - Math.exp(-dt / SQUASH_TAU));
    if (speed > SQUASH_MIN_SPEED) st.angle = (Math.atan2(dy, dx) * 180) / Math.PI;
    follow.style.transform = `translate(${st.x}px, ${st.y}px)`;
    squash.style.transform = `rotate(${st.angle}deg) scale(${st.squash}, ${1 / st.squash})`;
    const r = blob.r.baseVal.value * BITE_FRINGE;
    label.style.clipPath = `circle(${r}px at calc(50% + ${st.x}px) calc(50% + ${st.y}px))`;
  };
  const start = () => {
    if (running) return;
    running = true;
    gsap.ticker.add(tick);
  };
  const stop = () => {
    if (!running) return;
    running = false;
    gsap.ticker.remove(tick);
  };
  const centre = (e: PointerEvent) => {
    const r = btn.getBoundingClientRect();
    return { dx: e.clientX - (r.left + r.width / 2), dy: e.clientY - (r.top + r.height / 2) };
  };
  const open = (at: { dx: number; dy: number } | null) => {
    st.tx = st.x = at?.dx ?? 0;
    st.ty = st.y = at?.dy ?? 0;
    st.squash = 1;
    follow.style.transform = `translate(${st.x}px, ${st.y}px)`;
    start();
    gsap.to(blob, { attr: { r: blobR }, duration: 0.55, ease: "power3.out", overwrite: true });
  };
  const close = () => {
    if (!running) return;
    gsap.to(blob, { attr: { r: 0 }, duration: 0.4, ease: "power2.inOut", overwrite: true, onComplete: stop });
  };

  const live = () => finePointer() && !reducedMotion();
  const onEnter = (e: PointerEvent) => {
    if (live() && e.pointerType !== "touch") open(centre(e));
  };
  const onMove = (e: PointerEvent) => {
    if (!running) return;
    const o = centre(e);
    st.tx = o.dx;
    st.ty = o.dy;
  };
  const onFocus = () => {
    if (!reducedMotion() && btn.matches(":focus-visible")) open(null);
  };
  btn.addEventListener("pointerenter", onEnter);
  btn.addEventListener("pointermove", onMove);
  btn.addEventListener("pointerleave", close);
  btn.addEventListener("focus", onFocus);
  btn.addEventListener("blur", close);

  return () => {
    ro.disconnect();
    stop();
    gsap.killTweensOf(blob);
    btn.removeEventListener("pointerenter", onEnter);
    btn.removeEventListener("pointermove", onMove);
    btn.removeEventListener("pointerleave", close);
    btn.removeEventListener("focus", onFocus);
    btn.removeEventListener("blur", close);
  };
}

/* ------------------------------------------------------------- rto chart */

/** The band opens along the axis, then the packs drop into it and the proposal lands just outside */
function rto(root: HTMLElement) {
  const el = root.querySelector<HTMLElement>("[data-rto]");
  if (!el || reducedMotion()) return () => {};
  const band = el.querySelector(".rto__band");
  const dots = el.querySelectorAll(".rto__dot");
  const tl = gsap.timeline({ paused: true });
  tl.fromTo(band, { scaleX: 0 }, { scaleX: 1, duration: DUR.m, ease: "expoOut" })
    .fromTo(dots, { y: -40, autoAlpha: 0 }, { y: 0, autoAlpha: 1, duration: DUR.s, ease: "back.out(2)", stagger: 0.12 }, "-=0.5");
  const st = ScrollTrigger.create({ trigger: el, start: "top 75%", once: true, onEnter: () => tl.play() });
  return () => {
    st.kill();
    tl.kill();
  };
}

/* ------------------------------------------------------------------ shelf */

function shelf(root: HTMLElement) {
  const el = root.querySelector<HTMLElement>("[data-shelf]");
  if (!el) return () => {};
  const picks = Array.from(el.querySelectorAll<HTMLButtonElement>(".shelf__pick"));
  const field = (f: string) => el.querySelector<HTMLElement>(`[data-f="${f}"]`);
  const onClick = (e: Event) => {
    const pick = (e.target as HTMLElement).closest<HTMLButtonElement>(".shelf__pick");
    const shot = SHOTS.find((s) => s.key === pick?.dataset.shot);
    if (!pick || !shot) return;
    el.dataset.theme = shot.key;
    picks.forEach((p) => p.setAttribute("aria-pressed", String(p === pick)));
    field("name")!.textContent = shot.name;
    field("flavour")!.textContent = shot.flavour;
    field("contrast")!.textContent = `${shot.contrast}:1, AA`;
  };
  el.addEventListener("click", onClick);
  return () => el.removeEventListener("click", onClick);
}
