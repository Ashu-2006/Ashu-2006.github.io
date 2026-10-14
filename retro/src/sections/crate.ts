import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import type { Cleanup } from "../core/router";
import { finePointer, reducedMotion } from "../core/scroll";
import { sound } from "../core/sound";
import { SIDE_B, crateInfo } from "../templates/crate";

/**
 * Lengths in sleeve widths, angles in degrees. Mirrors the custom properties on .crate in crate.css.
 * The camera looks down into the crate; the active sleeve stands, the ones in front of it rest on the
 * front board, the ones behind lean back against each other so their top edges show.
 */
const GEO = {
  hf: 0.4,
  zf: 0.66,
  pivot: 0.04,
  flip: 50,
  flipStep: 1.2,
  back0: 0.075,
  back: 0.034,
  lean0: 17,
  leanStep: 0.9,
  stand: 6,
};

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/** Pose of a sleeve at distance d from the active one (d > 0 is behind it, d < 0 has been flipped forward) */
function pose(d: number) {
  if (d >= 0) {
    const a = Math.min(d, 1);
    const b = Math.max(d - 1, 0);
    return {
      z: -(a * GEO.back0 + b * GEO.back),
      rot: GEO.stand + a * (GEO.lean0 - GEO.stand) + b * GEO.leanStep,
      shade: a * 0.16 + b * 0.055,
    };
  }
  const a = Math.min(-d, 1);
  const b = Math.max(-d - 1, 0);
  /* flipped sleeves fan from one spot and rest on the front board: the newest stands steepest, on top of the pile */
  const z = a * GEO.pivot + b * 0.006;
  const rest = (Math.atan2(GEO.zf - z, GEO.hf) * 180) / Math.PI - 1.5;
  const flat = Math.min(GEO.flip + b * GEO.flipStep, rest);
  return {
    z,
    rot: GEO.stand - a * (flat + GEO.stand),
    shade: a * 0.34 + b * 0.04,
  };
}

/** No two sleeves in a real crate line up exactly */
const jitter = (i: number) => ({ x: (((i * 37) % 7) - 3) * 0.004, r: (((i * 53) % 5) - 2) * 0.22 });

export function mount(root: HTMLElement): Cleanup {
  const crate = root.querySelector<HTMLElement>("[data-crate]");
  const info = root.querySelector<HTMLElement>("[data-crate-info]");
  const open = root.querySelector<HTMLAnchorElement>("[data-crate-open]");
  const openName = root.querySelector<HTMLElement>("[data-crate-open-name]");
  const prev = root.querySelector<HTMLButtonElement>("[data-crate-prev]");
  const next = root.querySelector<HTMLButtonElement>("[data-crate-next]");
  if (!crate || !info || !open || !prev || !next) return () => {};

  const items = Array.from(crate.querySelectorAll<HTMLElement>(".crate__item"));
  const links = items.map((li) => li.querySelector<HTMLAnchorElement>(".sleeve")!);
  const shades = items.map((li) => li.querySelector<HTMLElement>(".sleeve__shade")!);
  const N = items.length;
  if (!N) return () => {};

  const reduced = reducedMotion();
  const state = { p: 0 };
  const hover = items.map(() => ({ v: 0 }));
  let S = items[0].offsetWidth || 400;
  let active = 0;
  let goal = 0;
  let lastTick = 0;
  let tween: gsap.core.Tween | null = null;
  let infoTimer = 0;
  let intro = false;
  let hoverIdx = -1;

  const render = () => {
    for (let i = 0; i < N; i++) {
      const d = i - state.p;
      const { z, rot, shade } = pose(d);
      const lift = hover[i].v * S * 0.045;
      const j = jitter(i);
      items[i].style.transform = `translate3d(${(j.x * S).toFixed(2)}px, ${(-lift).toFixed(2)}px, ${(z * S).toFixed(2)}px) rotateX(${rot.toFixed(3)}deg) rotateZ(${j.r}deg)`;
      shades[i].style.opacity = String(clamp(shade - hover[i].v * 0.12, 0, 0.62));
    }
    const k = clamp(Math.round(state.p), 0, N - 1);
    if (k !== lastTick) {
      lastTick = k;
      sound.tick(0.86 + (k / Math.max(N - 1, 1)) * 0.32);
    }
    if (k !== active && !intro) setActive(k);
  };

  /** Roving tab stop, cursor hint and the panel follow the sleeve that is standing */
  function setActive(k: number) {
    active = k;
    items.forEach((li, i) => li.classList.toggle("is-active", i === k));
    links.forEach((a, i) => {
      a.tabIndex = i === k ? 0 : -1;
      a.dataset.cursor = i === k ? "open" : "drag";
    });
    window.clearTimeout(infoTimer);
    infoTimer = window.setTimeout(() => showInfo(k), 90);
    if (hoverIdx >= 0) setHover(hoverIdx);
  }

  let shown = 0;
  function showInfo(k: number) {
    if (k === shown) return;
    shown = k;
    const p = SIDE_B[k];
    info!.innerHTML = crateInfo(p);
    open!.href = links[k].href;
    if (openName) openName.textContent = ` ${p.name}`;
    const lines = info!.children;
    if (reduced) gsap.fromTo(lines, { opacity: 0 }, { opacity: 1, duration: 0.15 });
    else gsap.fromTo(lines, { yPercent: 28, opacity: 0 }, { yPercent: 0, opacity: 1, duration: 0.55, stagger: 0.045, ease: "power3.out" });
  }

  /** Flips to sleeve i. Past either end it wraps: every sleeve riffles back, or forward, in one pass. */
  function go(target: number, opts: { focus?: boolean } = {}) {
    let to = target;
    intro = false;
    if (to > N - 1) to = 0;
    if (to < 0) to = N - 1;
    goal = to;
    tween?.kill();
    const dist = Math.abs(to - state.p);
    if (reduced) {
      state.p = to;
      render();
      gsap.fromTo(links[to], { opacity: 0.25 }, { opacity: 1, duration: 0.15 });
    } else {
      tween = gsap.to(state, {
        p: to,
        duration: clamp(0.5 + dist * 0.09, 0.5, 1.15),
        ease: dist > 1.5 ? "power3.inOut" : "power3.out",
        onUpdate: render,
      });
    }
    if (opts.focus) links[to].focus({ preventScroll: true });
  }

  /* ---- drag and swipe: horizontal only, so the page still scrolls vertically under a finger ---- */
  let drag: { id: number; x0: number; y0: number; p0: number; on: boolean; samples: { x: number; t: number }[] } | null = null;
  let suppressClick = false;
  const STEP = () => Math.max(64, S * 0.27);

  const onDown = (e: PointerEvent) => {
    if (e.button !== 0) return;
    suppressClick = false;
    drag = { id: e.pointerId, x0: e.clientX, y0: e.clientY, p0: state.p, on: false, samples: [{ x: e.clientX, t: e.timeStamp }] };
  };
  const onMove = (e: PointerEvent) => {
    if (!drag || e.pointerId !== drag.id) return;
    const dx = e.clientX - drag.x0;
    const dy = e.clientY - drag.y0;
    if (!drag.on) {
      if (Math.abs(dx) > 8 && Math.abs(dx) > Math.abs(dy)) {
        drag.on = true;
        drag.x0 = e.clientX;
        drag.p0 = state.p;
        tween?.kill();
        crate.classList.add("is-dragging");
        crate.setPointerCapture(e.pointerId);
      } else if (Math.abs(dy) > 10) {
        drag = null;
      }
      return;
    }
    const raw = drag.p0 - (e.clientX - drag.x0) / STEP();
    const over = raw < 0 ? raw : raw > N - 1 ? raw - (N - 1) : 0;
    state.p = over ? clamp(raw - over + over * 0.35, -0.6, N - 0.4) : raw;
    drag.samples.push({ x: e.clientX, t: e.timeStamp });
    if (drag.samples.length > 6) drag.samples.shift();
    render();
  };
  const onUp = (e: PointerEvent) => {
    if (!drag || e.pointerId !== drag.id) return;
    const d = drag;
    drag = null;
    if (!d.on) return;
    suppressClick = true;
    crate.classList.remove("is-dragging");
    if (crate.hasPointerCapture(e.pointerId)) crate.releasePointerCapture(e.pointerId);
    if (state.p < -0.3) return go(N - 1);
    if (state.p > N - 1 + 0.3) return go(0);
    const first = d.samples[0];
    const last = d.samples[d.samples.length - 1];
    const dt = Math.max(last.t - first.t, 1);
    const v = e.type === "pointercancel" || e.timeStamp - last.t > 90 ? 0 : (last.x - first.x) / dt;
    const throwP = clamp((-v * 190) / STEP(), -4, 4);
    go(clamp(Math.round(state.p + throwP), 0, N - 1));
  };

  /** A tap on a sleeve that is not standing flips to it; a tap on the standing one follows its link */
  const onClick = (e: MouseEvent) => {
    if (suppressClick) {
      suppressClick = false;
      e.preventDefault();
      e.stopPropagation();
      return;
    }
    const li = (e.target as Element | null)?.closest<HTMLElement>(".crate__item");
    if (!li) return;
    const i = Number(li.dataset.index);
    if (i !== active) {
      e.preventDefault();
      go(i);
    }
  };

  const onKey = (e: KeyboardEvent) => {
    const map: Record<string, number> = { ArrowRight: goal + 1, ArrowLeft: goal - 1, Home: 0, End: N - 1 };
    if (!(e.key in map) || e.altKey || e.metaKey || e.ctrlKey) return;
    e.preventDefault();
    go(map[e.key], { focus: true });
  };

  /** The sleeve under the mouse rises a little, the way a finger lifts one to look; the standing one only half as much */
  function setHover(idx: number) {
    hoverIdx = idx;
    hover.forEach((h, i) => {
      const to = i !== idx ? 0 : i === active ? 0.55 : 1;
      if (h.v === to) return;
      if (reduced) {
        h.v = to;
        render();
      } else gsap.to(h, { v: to, duration: 0.35, ease: "power3.out", overwrite: true, onUpdate: render });
    });
  }
  const onOver = (e: PointerEvent) => {
    if (e.pointerType !== "mouse" || drag?.on) return;
    const li = (e.target as Element | null)?.closest<HTMLElement>(".crate__item");
    setHover(li ? Number(li.dataset.index) : -1);
  };
  const onLeave = () => setHover(-1);
  const onDragStart = (e: Event) => e.preventDefault();

  const onPrev = () => go(goal - 1);
  const onNext = () => go(goal + 1);

  crate.addEventListener("pointerdown", onDown);
  crate.addEventListener("pointermove", onMove);
  crate.addEventListener("pointerup", onUp);
  crate.addEventListener("pointercancel", onUp);
  crate.addEventListener("click", onClick);
  crate.addEventListener("keydown", onKey);
  crate.addEventListener("dragstart", onDragStart);
  if (finePointer()) {
    crate.addEventListener("pointerover", onOver);
    crate.addEventListener("pointerleave", onLeave);
  }
  prev.addEventListener("click", onPrev);
  next.addEventListener("click", onNext);

  const ro = new ResizeObserver(() => {
    S = items[0].offsetWidth || S;
    render();
  });
  ro.observe(crate);

  /* The entrance: the crate arrives dug through to the back, and riffles home to the first sleeve.
     It plays whichever way the crate is first reached, so a visitor arriving from below never finds it mid-dig. */
  let st: ScrollTrigger | null = null;
  if (!reduced) {
    intro = true;
    state.p = N - 1;
    lastTick = N - 1;
    render();
    const riffle = () => {
      st?.kill();
      st = null;
      if (!intro) return;
      tween = gsap.to(state, {
        p: 0,
        duration: 1.5,
        ease: "power3.inOut",
        delay: 0.1,
        onUpdate: render,
        onComplete: () => {
          intro = false;
        },
      });
    };
    st = ScrollTrigger.create({ trigger: crate, start: "top 78%", end: "bottom 10%", onEnter: riffle, onEnterBack: riffle });
  } else render();

  return () => {
    tween?.kill();
    st?.kill();
    ro.disconnect();
    window.clearTimeout(infoTimer);
    gsap.killTweensOf(hover);
    gsap.killTweensOf(info.children);
    crate.removeEventListener("pointerdown", onDown);
    crate.removeEventListener("pointermove", onMove);
    crate.removeEventListener("pointerup", onUp);
    crate.removeEventListener("pointercancel", onUp);
    crate.removeEventListener("click", onClick);
    crate.removeEventListener("keydown", onKey);
    crate.removeEventListener("dragstart", onDragStart);
    crate.removeEventListener("pointerover", onOver);
    crate.removeEventListener("pointerleave", onLeave);
    prev.removeEventListener("click", onPrev);
    next.removeEventListener("click", onNext);
  };
}
