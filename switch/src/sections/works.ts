import { bus } from "../core/bus";
import { DUR, ScrollTrigger, d, finePointer, getPhase, gsap, reducedMotion } from "../core/motion";
import { lenis } from "../core/scroll";
import { pad2 } from "../lib/html";

/** A point at the bottom-right corner, and the full rect (101% so no hairline shows at the bottom edge) */
const HIDDEN = "polygon(100% 100%, 100% 100%, 100% 100%, 100% 100%)";
const FULL = "polygon(0% 0%, 100% 0%, 100% 101%, 0% 101%)";
/** Scroll distance per step, in viewport heights. Keeps the home inside its 7-screen budget. */
const STEP_VH = 0.5;
/** Each step is one timeline unit: the wipe takes the first 0.9, the rest is a hold */
const REVEAL = 0.9;
const ROW_DIM = 0.28;
const SNAP_IDLE_MS = 90;
const SNAP_FORWARD_AT = 0.1;
const SNAP_BACK_BELOW = 0.9;
const BADGE_LEAN = 20;

/** The pinned layout only runs on wide screens with motion allowed; CSS shows the card list otherwise */
export const PIN_QUERY = "(min-width: 1024px) and (prefers-reduced-motion: no-preference)";

const WIPE_EASE = "power2.inOut";

/**
 * Selected work (neutomni): a pinned section whose right panel is a stack of masks. Each scroll step
 * wipes the next mask open from a point at the bottom-right corner while the incoming media settles from
 * 1.1 and the outgoing one pushes to 1.2. A Lenis snap commits to the next step once a wipe is 10% done.
 */
function mountPinned(section: HTMLElement): () => void {
  const pin = section.querySelector<HTMLElement>("[data-works-pin]")!;
  const panel = section.querySelector<HTMLElement>("[data-works-panel]")!;
  const masks = Array.from(section.querySelectorAll<HTMLElement>("[data-works-mask]"));
  const medias = masks.map((m) => m.querySelector<HTMLElement>(".works__img")!);
  const rows = Array.from(section.querySelectorAll<HTMLElement>("[data-works-row]"));
  const count = section.querySelector<HTMLElement>("[data-works-count]");
  const videos = masks.map((m) => m.querySelector<HTMLVideoElement>("video"));
  const steps = masks.length - 1;
  const cleanups: (() => void)[] = [];
  if (!masks.length) return () => {};

  /* Covers whose aspect is more than 20% off the panel's are shown whole on paper rather than cropped */
  const fitCovers = () => {
    const frame = panel.clientWidth / Math.max(1, panel.clientHeight);
    masks.forEach((m, i) => {
      const media = medias[i];
      const w = Number(media.getAttribute("width")) || 16;
      const h = Number(media.getAttribute("height")) || 10;
      const r = w / h / frame;
      m.classList.toggle("is-contain", r > 1.2 || r < 1 / 1.2);
    });
  };
  fitCovers();
  const coverRo = new ResizeObserver(fitCovers);
  coverRo.observe(panel);
  cleanups.push(() => coverRo.disconnect());

  gsap.set(masks, { clipPath: HIDDEN, zIndex: (i: number) => i + 1 });
  gsap.set(medias, { scale: 1.1 });
  gsap.set(rows, { opacity: ROW_DIM });
  gsap.set(rows[0], { opacity: 1 });

  /* The first mask wipes open while the section scrolls into place, so the pin spends no scroll on it */
  const enter = gsap.timeline({
    scrollTrigger: { trigger: section, start: "top 75%", end: "top top", scrub: true },
  });
  enter.to(masks[0], { clipPath: FULL, ease: "expoInOut", duration: 1 }, 0).to(medias[0], { scale: 1, ease: "none", duration: 1 }, 0);

  const tl = gsap.timeline({ defaults: { ease: "none" } });
  for (let i = 1; i <= steps; i++) {
    const at = i - 1;
    tl.to(masks[i], { clipPath: FULL, duration: REVEAL, ease: WIPE_EASE }, at)
      .to(medias[i], { scale: 1, duration: REVEAL }, at)
      .to(medias[i - 1], { scale: 1.2, duration: REVEAL }, at)
      .to(rows[i - 1], { opacity: ROW_DIM, duration: 0.28 }, at)
      .to(rows[i], { opacity: 1, duration: 0.28 }, at);
  }
  tl.to({}, { duration: 1 - REVEAL }, steps - (1 - REVEAL));

  let active = -1;
  let inView = false;
  const setActive = (i: number) => {
    if (i === active) return;
    const prev = active;
    active = i;
    if (count) {
      count.textContent = pad2(i + 1);
      if (prev >= 0) gsap.fromTo(count, { yPercent: i > prev ? 110 : -110 }, { yPercent: 0, duration: d(DUR.s), ease: "expoOut" });
    }
    rows.forEach((r, k) => r.classList.toggle("is-active", k === i));
    syncVideos();
  };
  const syncVideos = () => {
    videos.forEach((v, k) => {
      if (!v) return;
      if (inView && k === active) {
        v.preload = "auto";
        v.play().catch(() => v.pause());
      } else if (!v.paused) v.pause();
    });
  };

  const stepPx = () => innerHeight * STEP_VH;
  const st = ScrollTrigger.create({
    trigger: section,
    start: "top top",
    end: () => `+=${steps * stepPx()}`,
    pin,
    pinSpacing: true,
    anticipatePin: 1,
    scrub: true,
    animation: tl,
    invalidateOnRefresh: true,
    onUpdate: (self) => setActive(Math.min(steps, Math.floor(self.progress * steps + 1 - REVEAL / 2))),
  });
  const viewSt = ScrollTrigger.create({
    trigger: section,
    start: "top bottom",
    end: "bottom top",
    onToggle: (self) => {
      inView = self.isActive;
      syncVideos();
    },
  });
  setActive(0);

  /* Snap: after 90ms without input, commit to a step. Forward once a wipe is 10% in, back only under 90%. */
  let timer = 0;
  let touching = false;
  let snapping = false;
  const snap = () => {
    const l = lenis;
    if (!l || touching || snapping || l.isStopped || getPhase() !== "idle") return;
    const y = l.targetScroll;
    if (y <= st.start + 1 || y >= st.end - 1) return;
    const raw = ((y - st.start) / (st.end - st.start)) * steps;
    const i = Math.floor(raw);
    const f = raw - i;
    if (f >= REVEAL) return;
    const r = f / REVEAL;
    const forward = l.direction >= 0;
    const to = forward ? (r >= SNAP_FORWARD_AT ? i + 1 : i) : r < SNAP_BACK_BELOW ? i : i + 1;
    const target = st.start + (to / steps) * (st.end - st.start);
    if (Math.abs(target - y) < 2) return;
    snapping = true;
    l.scrollTo(target, { lerp: 0.1, onComplete: () => void (snapping = false) });
    window.setTimeout(() => (snapping = false), 2400);
  };
  const arm = () => {
    clearTimeout(timer);
    if (snapping) return;
    timer = window.setTimeout(snap, SNAP_IDLE_MS);
  };
  const onTouchStart = () => {
    touching = true;
    clearTimeout(timer);
  };
  const onTouchEnd = () => {
    touching = false;
    arm();
  };
  const onWheel = () => {
    snapping = false;
    arm();
  };
  window.addEventListener("wheel", onWheel, { passive: true });
  window.addEventListener("touchstart", onTouchStart, { passive: true });
  window.addEventListener("touchend", onTouchEnd, { passive: true });
  const onKey = (e: KeyboardEvent) => {
    if (["ArrowDown", "ArrowUp", "PageDown", "PageUp", " ", "Space"].includes(e.key)) arm();
  };
  window.addEventListener("keyup", onKey);
  cleanups.push(() => {
    clearTimeout(timer);
    window.removeEventListener("wheel", onWheel);
    window.removeEventListener("touchstart", onTouchStart);
    window.removeEventListener("touchend", onTouchEnd);
    window.removeEventListener("keyup", onKey);
  });

  /* Keyboard: focusing a row brings its image up */
  rows.forEach((row, i) => {
    const onFocus = () => {
      if (!lenis || !st.isActive) return;
      lenis.scrollTo(st.start + (i / steps) * (st.end - st.start), { lerp: 0.1 });
    };
    row.addEventListener("focusin", onFocus);
    cleanups.push(() => row.removeEventListener("focusin", onFocus));
  });

  /* Badge: a ring of text turning slowly, leaning toward the pointer */
  const badge = panel.querySelector<HTMLElement>(".works__badge-in");
  const ring = panel.querySelector<SVGElement>(".works__ring");
  if (badge && ring) {
    const spin = gsap.to(ring, { rotation: 360, duration: 15, ease: "none", repeat: -1, transformOrigin: "50% 50%" });
    cleanups.push(() => spin.kill());
    if (finePointer()) {
      const qx = gsap.quickTo(badge, "x", { duration: DUR.s, ease: "expoOut" });
      const qy = gsap.quickTo(badge, "y", { duration: DUR.s, ease: "expoOut" });
      const onMove = (e: PointerEvent) => {
        const r = panel.getBoundingClientRect();
        const b = badge.parentElement!.getBoundingClientRect();
        const dx = e.clientX - (b.left + b.width / 2);
        const dy = e.clientY - (b.top + b.height / 2);
        const reach = Math.max(r.width, r.height) / 2;
        qx(gsap.utils.clamp(-1, 1, dx / reach) * BADGE_LEAN);
        qy(gsap.utils.clamp(-1, 1, dy / reach) * BADGE_LEAN);
      };
      const onLeave = () => {
        qx(0);
        qy(0);
      };
      panel.addEventListener("pointermove", onMove);
      panel.addEventListener("pointerleave", onLeave);
      cleanups.push(() => {
        panel.removeEventListener("pointermove", onMove);
        panel.removeEventListener("pointerleave", onLeave);
      });
    }
  }

  return () => {
    cleanups.forEach((fn) => fn());
    st.kill();
    viewSt.kill();
    enter.scrollTrigger?.kill();
    enter.kill();
    tl.kill();
    videos.forEach((v) => v?.pause());
    gsap.set([...masks, ...medias, ...rows], { clearProps: "all" });
    if (count) gsap.set(count, { clearProps: "transform" });
  };
}

/** Selected work. The pin runs only on wide screens with motion allowed and is rebuilt across that boundary. */
export function mountWorks(root: HTMLElement): () => void {
  const section = root.querySelector<HTMLElement>(".works");
  if (!section) return () => {};
  const mm = gsap.matchMedia();
  mm.add(PIN_QUERY, () => {
    const stop = mountPinned(section);
    return () => stop();
  });
  const offMode = bus.on("mode:change", ({ mode }) => mode === "modern" && ScrollTrigger.refresh());
  if (reducedMotion()) section.classList.add("is-static");
  return () => {
    offMode();
    /* kill, not revert: revert keeps the media query listener alive and leaks one per home visit */
    mm.kill();
  };
}
