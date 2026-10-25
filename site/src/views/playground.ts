import Lenis from "lenis";
import { PLAY, PLAY_KINDS, type Play } from "../content";
import { bus } from "../core/bus";
import { DUR, d, gsap, reducedMotion, whenIdle } from "../core/motion";
import { startScroll, stopScroll } from "../core/scroll";
import { esc, mediaInfo, mediaTag, pad2 } from "../lib/html";
import { mountReveals } from "../lib/reveal";

const BASE = import.meta.env.BASE_URL;
/** The loop spans this many cycles; more copies follow only to fill the screen after the last one */
const COPIES = 2;
/** A press that travels further than this is a scroll or a drag, not a click */
const CLICK_SLOP = 8;

type Rect = { left: number; top: number; width: number; height: number };
const rectOf = (el: Element): Rect => {
  const r = el.getBoundingClientRect();
  return { left: r.left, top: r.top, width: r.width, height: r.height };
};
/** The rect an object-fit: contain media occupies inside its box */
function contain(box: Rect, ratio: number): Rect {
  let width = box.width;
  let height = width / ratio;
  if (height > box.height) {
    height = box.height;
    width = height * ratio;
  }
  return { left: box.left + (box.width - width) / 2, top: box.top + (box.height - height) / 2, width, height };
}

/**
 * The piece modal. Near full page, appended to #viewport so it sits above the header and inside the OS
 * window when the switch is flipped. It opens with a FLIP: the clicked tile's media flies into the
 * fitted media slot while the panel's clip opens out of the tile's rect; it closes the same way back.
 * Page and header are inert while open (focus stays inside), Esc, the dim layer and Close dismiss it.
 */
function createModal(hooks: { onNav: (dir: -1 | 1) => void; onOpen: () => void; onClose: () => void; tileFor: (index: number) => HTMLElement | null }) {
  const host = document.getElementById("viewport") ?? document.body;
  const el = document.createElement("div");
  el.className = "pl-m";
  el.hidden = true;
  el.innerHTML = `
  <div class="pl-m__dim" data-m-dim></div>
  <div class="pl-m__panel" role="dialog" aria-modal="true" aria-labelledby="pl-m-title" data-m-panel>
    <div class="pl-m__stage" data-m-stage>
      <div class="pl-m__media" data-m-media></div>
      <div class="pl-m__ctrl" data-m-ctrl hidden>
        <button class="label pl-m__ctl" type="button" data-m-play aria-pressed="true">Pause</button>
        <button class="label pl-m__ctl" type="button" data-m-mute aria-pressed="true">Sound off</button>
      </div>
    </div>
    <div class="pl-m__info" data-lenis-prevent>
      <div class="pl-m__top">
        <p class="label pl-m__pos" data-m-pos></p>
        <button class="label pl-m__btn pl-m__btn--close" type="button" data-m-close>Close</button>
      </div>
      <div class="pl-m__body" data-m-body></div>
      <div class="pl-m__nav">
        <button class="label pl-m__btn" type="button" data-m-prev>Previous</button>
        <button class="label pl-m__btn" type="button" data-m-next>Next</button>
      </div>
    </div>
  </div>`;
  host.append(el);
  const $ = <T extends HTMLElement>(sel: string) => el.querySelector<T>(sel)!;
  const panel = $("[data-m-panel]");
  const dim = $("[data-m-dim]");
  const stage = $("[data-m-stage]");
  const mediaBox = $("[data-m-media]");
  const ctrl = $("[data-m-ctrl]");
  const playBtn = $<HTMLButtonElement>("[data-m-play]");
  const muteBtn = $<HTMLButtonElement>("[data-m-mute]");
  const body = $("[data-m-body]");
  const pos = $("[data-m-pos]");
  const close = $<HTMLButtonElement>("[data-m-close]");
  const prev = $<HTMLButtonElement>("[data-m-prev]");
  const next = $<HTMLButtonElement>("[data-m-next]");
  const inertEls = () => [document.getElementById("main"), document.getElementById("chrome")].filter((x): x is HTMLElement => Boolean(x));

  let open = false;
  let current = -1;
  let returnTo: HTMLElement | null = null;
  let tl: gsap.core.Timeline | null = null;
  let flipEl: HTMLElement | null = null;

  const video = () => mediaBox.querySelector("video");
  const syncCtrl = () => {
    const v = video();
    ctrl.hidden = !v;
    if (!v) return;
    playBtn.textContent = v.paused ? "Play" : "Pause";
    playBtn.setAttribute("aria-pressed", String(!v.paused));
    muteBtn.textContent = v.muted ? "Sound off" : "Sound on";
    muteBtn.setAttribute("aria-pressed", String(v.muted));
  };

  const fill = (p: Play, index: number, at: number, total: number) => {
    current = index;
    mediaBox.innerHTML = mediaTag(BASE, p.file, p.title, { eager: true }).replace(" data-autoplay", "").replace(' loading="lazy"', "");
    const v = video();
    if (v) {
      v.preload = "auto";
      v.addEventListener("play", syncCtrl);
      v.addEventListener("pause", syncCtrl);
      if (!reducedMotion()) v.play().catch(() => v.pause());
    }
    syncCtrl();
    const tools = p.tools.map((t) => `<li class="label pl-m__tool">${esc(t)}</li>`).join("");
    body.innerHTML = `
      <p class="label pl-m__meta"><span class="mask"><span class="mask__in" data-m-rise>${esc(PLAY_KINDS[p.kind])}</span></span><span class="mask"><span class="mask__in" data-m-rise>${esc(p.year)}</span></span></p>
      <h2 class="pl-m__title" id="pl-m-title"><span class="mask"><span class="mask__in" data-m-rise>${esc(p.title)}</span></span></h2>
      <p class="pl-m__note"><span class="mask"><span class="mask__in" data-m-rise>${esc(p.note)}</span></span></p>
      <dl class="pl-m__dl" data-m-up>
        <dt class="label">Why</dt><dd class="pl-m__why">${esc(p.why)}</dd>
        <dt class="label">Tools</dt><dd><ul class="pl-m__tools">${tools}</ul></dd>
      </dl>`;
    pos.innerHTML = `<b>${pad2(at + 1)}</b> / ${pad2(total)}`;
    prev.disabled = next.disabled = total < 2;
  };

  const riseCopy = (t: gsap.core.Timeline, at: number) => {
    t.fromTo(body.querySelectorAll("[data-m-rise]"), { y: 0, yPercent: 130 }, { yPercent: 0, duration: d(DUR.m), ease: "expoOut", stagger: 0.05 }, at);
    t.fromTo(body.querySelectorAll("[data-m-up]"), { y: 24, autoAlpha: 0 }, { y: 0, autoAlpha: 1, duration: d(0.6), ease: "expoOut", clearProps: "transform,opacity,visibility" }, at + 0.15);
  };

  /** The fitted rect of the current media inside the stage */
  const slot = (p: Play) => {
    const { w, h } = mediaInfo(p.file);
    return contain(rectOf(mediaBox), w / h);
  };

  /** A clone of the tile's picture, flown between two rects. Returns the timeline position it ends at. */
  const flyClone = (src: string, from: Rect, to: Rect, t: gsap.core.Timeline, duration: number, ease: string) => {
    flipEl?.remove();
    const box = document.createElement("div");
    box.className = "pl-m__flip";
    const img = document.createElement("img");
    img.src = src;
    img.alt = "";
    box.append(img);
    el.append(box);
    flipEl = box;
    gsap.set(box, from);
    t.to(box, { ...to, duration, ease }, 0);
    return box;
  };
  const tileSrc = (tile: HTMLElement | null) => {
    const m = tile?.querySelector<HTMLImageElement | HTMLVideoElement>("img, video");
    if (!m) return "";
    return m instanceof HTMLImageElement ? m.currentSrc || m.src : m.poster;
  };
  /** The panel's clip as an inset that frames a viewport rect */
  const clipTo = (r: Rect) => {
    const p = panel.getBoundingClientRect();
    const top = Math.max(0, r.top - p.top);
    const left = Math.max(0, r.left - p.left);
    const bottom = Math.max(0, p.bottom - (r.top + r.height));
    const right = Math.max(0, p.right - (r.left + r.width));
    return `inset(${top}px ${right}px ${bottom}px ${left}px round 0px)`;
  };
  const visibleRect = (tile: HTMLElement | null) => {
    if (!tile) return null;
    const r = rectOf(tile);
    return r.top + r.height > 0 && r.top < innerHeight && r.width > 0 ? r : null;
  };

  const onKey = (e: KeyboardEvent) => {
    if (!open) return;
    if (e.key === "Escape") {
      e.preventDefault();
      hide();
    } else if (e.key === "ArrowRight" && !next.disabled) hooks.onNav(1);
    else if (e.key === "ArrowLeft" && !prev.disabled) hooks.onNav(-1);
    else if (e.key === "Tab") {
      const f = Array.from(panel.querySelectorAll<HTMLElement>("button:not(:disabled):not([hidden] *), video[controls]")).filter((x) => x.offsetParent !== null);
      if (!f.length) return;
      const first = f[0];
      const last = f[f.length - 1];
      if (e.shiftKey && (document.activeElement === first || !panel.contains(document.activeElement))) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && (document.activeElement === last || !panel.contains(document.activeElement))) {
        e.preventDefault();
        first.focus();
      }
    }
  };

  function show(p: Play, index: number, at: number, total: number, from: HTMLElement | null) {
    const reduced = reducedMotion();
    if (open) {
      /* Prev and next: the media wipes up, the copy rises again */
      tl?.progress(1);
      video()?.pause();
      fill(p, index, at, total);
      tl = gsap.timeline();
      tl.fromTo(mediaBox, { clipPath: "inset(100% 0% 0% 0%)" }, { clipPath: "inset(0% 0% 0% 0%)", duration: d(DUR.m), ease: "expoOut", clearProps: "clipPath" }, 0);
      tl.fromTo(mediaBox.firstElementChild, { scale: 1.1 }, { scale: 1, duration: d(DUR.l), ease: "expoOut", clearProps: "scale" }, 0);
      riseCopy(tl, 0.1);
      return;
    }
    open = true;
    returnTo = from;
    el.hidden = false;
    fill(p, index, at, total);
    inertEls().forEach((x) => (x.inert = true));
    document.addEventListener("keydown", onKey);
    hooks.onOpen();
    tl?.kill();
    tl = gsap.timeline({
      onComplete: () => {
        flipEl?.remove();
        flipEl = null;
        gsap.set(mediaBox, { clearProps: "visibility" });
      },
    });
    const fromRect = reduced ? null : visibleRect(from);
    const src = tileSrc(from);
    tl.fromTo(dim, { opacity: 0 }, { opacity: 0.4, duration: d(DUR.m), ease: "expoOut" }, 0);
    if (fromRect && src) {
      gsap.set(mediaBox, { visibility: "hidden" });
      flyClone(src, fromRect, slot(p), tl, DUR.l, "settleOut");
      tl.fromTo(panel, { clipPath: clipTo(fromRect) }, { clipPath: "inset(0px 0px 0px 0px round 0px)", duration: DUR.l, ease: "settleOut", clearProps: "clipPath" }, 0);
    } else if (!reduced) {
      tl.fromTo(panel, { clipPath: "inset(100% 0% 0% 0% round 0px)" }, { clipPath: "inset(0% 0% 0% 0% round 0px)", duration: DUR.m, ease: "expoOut", clearProps: "clipPath" }, 0);
    }
    riseCopy(tl, reduced ? 0 : 0.4);
    close.focus({ preventScroll: true });
    bus.emit("cursor:refresh", {});
  }

  function hide() {
    if (!open) return;
    open = false;
    document.removeEventListener("keydown", onKey);
    const reduced = reducedMotion();
    const tile = hooks.tileFor(current);
    const toRect = reduced ? null : visibleRect(tile);
    const src = tileSrc(tile);
    const p = PLAY[current];
    video()?.pause();
    inertEls().forEach((x) => (x.inert = false));
    tl?.kill();
    tl = gsap.timeline({
      onComplete: () => {
        el.hidden = true;
        mediaBox.innerHTML = "";
        body.innerHTML = "";
        flipEl?.remove();
        flipEl = null;
        gsap.set([panel, mediaBox], { clearProps: "clipPath,visibility" });
        hooks.onClose();
        bus.emit("cursor:refresh", {});
      },
    });
    tl.to(dim, { opacity: 0, duration: d(DUR.s), ease: "expoInOut" }, 0);
    if (toRect && src && p) {
      const from = slot(p);
      gsap.set(mediaBox, { visibility: "hidden" });
      flyClone(src, from, toRect, tl, DUR.s, "expoInOut");
      tl.to(panel, { clipPath: clipTo(toRect), duration: DUR.s, ease: "expoInOut" }, 0);
    } else {
      tl.to(panel, { clipPath: "inset(0% 0% 100% 0% round 0px)", duration: d(DUR.s), ease: "expoInOut" }, 0);
    }
    (returnTo ?? tile)?.focus({ preventScroll: true });
    returnTo = null;
  }

  const onClose = () => hide();
  const onPrev = () => hooks.onNav(-1);
  const onNext = () => hooks.onNav(1);
  const onPlay = () => {
    const v = video();
    if (!v) return;
    if (v.paused) v.play().catch(() => v.pause());
    else v.pause();
  };
  const onMute = () => {
    const v = video();
    if (!v) return;
    v.muted = !v.muted;
    syncCtrl();
  };
  const onStageClick = (e: MouseEvent) => {
    if (e.target === stage) hide();
  };
  close.addEventListener("click", onClose);
  dim.addEventListener("click", onClose);
  stage.addEventListener("click", onStageClick);
  prev.addEventListener("click", onPrev);
  next.addEventListener("click", onNext);
  playBtn.addEventListener("click", onPlay);
  muteBtn.addEventListener("click", onMute);

  return {
    show,
    hide,
    current: () => current,
    isOpen: () => open,
    destroy() {
      if (open) {
        inertEls().forEach((x) => (x.inert = false));
        hooks.onClose();
      }
      open = false;
      document.removeEventListener("keydown", onKey);
      tl?.kill();
      video()?.pause();
      el.remove();
    },
  };
}

/**
 * The endless mosaic. One cycle comes pre-rendered; it is cloned so the scroller holds COPIES cycles
 * plus a final screen that repeats the first, and a dedicated Lenis instance with `infinite` wraps the
 * scroll by the loop length, which makes the seam invisible in both directions. The window's Lenis is
 * stopped while this page is mounted. ScrollTrigger is never involved.
 */
function mountMosaic(root: HTMLElement): () => void {
  const section = root.querySelector<HTMLElement>(".pl");
  const wrap = root.querySelector<HTMLElement>("[data-pl-wrap]");
  const content = root.querySelector<HTMLElement>("[data-pl-content]");
  const cycle = root.querySelector<HTMLElement>("[data-pl-cycle]");
  if (!section || !wrap || !content || !cycle) return () => {};
  const reduced = reducedMotion();
  const cleanups: (() => void)[] = [];
  const anims = new Set<gsap.core.Animation>();
  const track = <T extends gsap.core.Animation>(a: T) => {
    anims.add(a);
    a.eventCallback("onComplete", () => anims.delete(a));
    return a;
  };
  let dead = false;

  /* Copies: aria-hidden clones of the cycle. Their buttons stay clickable but out of the tab order. */
  const cycles = [cycle];
  let observeCopy: ((copy: HTMLElement) => void) | null = null;
  const addCopy = () => {
    const copy = cycle.cloneNode(true) as HTMLElement;
    copy.style.setProperty("--k", String(cycles.length));
    copy.setAttribute("aria-hidden", "true");
    copy.removeAttribute("aria-label");
    copy.querySelectorAll("button").forEach((b) => (b.tabIndex = -1));
    content.append(copy);
    cycles.push(copy);
    observeCopy?.(copy);
  };
  cleanups.push(() => cycles.splice(1).forEach((c) => c.remove()));
  const tiles = () => cycles.flatMap((c) => Array.from(c.querySelectorAll<HTMLElement>("[data-pl-tile]")));

  /*
   * Loop length: COPIES cycles. Enough extra copies follow to fill one more screen (a cycle can be
   * shorter than a tall viewport), and the content is exactly one viewport taller than the loop, so the
   * last screen before the wrap is identical to the first.
   */
  let loop = 0;
  const measure = () => {
    const h = Math.max(1, cycle.offsetHeight);
    const need = COPIES + Math.ceil(wrap.clientHeight / h);
    while (cycles.length < need) addCopy();
    while (cycles.length > need) cycles.pop()?.remove();
    loop = h * COPIES;
    content.style.height = `${loop + wrap.clientHeight}px`;
  };
  measure();

  stopScroll();
  cleanups.push(() => startScroll());
  const lenis = new Lenis({ wrapper: wrap, content, eventsTarget: section, infinite: true, syncTouch: true, lerp: 0.1, autoResize: true, smoothWheel: !reduced });
  const raf = (time: number) => lenis.raf(time * 1000);
  gsap.ticker.add(raf);
  cleanups.push(() => {
    gsap.ticker.remove(raf);
    lenis.destroy();
  });
  const home = () => lenis.scrollTo(0, { immediate: true, force: true });
  home();

  const ro = new ResizeObserver(() => {
    const before = loop;
    measure();
    if (before && before !== loop) {
      lenis.resize();
      lenis.scrollTo((lenis.scroll / before) * loop, { immediate: true, force: true });
    }
  });
  ro.observe(cycle);
  ro.observe(wrap);
  cleanups.push(() => ro.disconnect());

  /* Videos play only while on screen, never under reduced motion */
  const vio = new IntersectionObserver(
    (entries) => {
      for (const e of entries) {
        const v = e.target as HTMLVideoElement;
        if (e.isIntersecting && !reduced) {
          v.preload = "auto";
          v.play().catch(() => v.pause());
        } else v.pause();
      }
    },
    { root: wrap, rootMargin: "200px 0px" },
  );
  const watch = (el: ParentNode) => el.querySelectorAll<HTMLVideoElement>("video[data-pl-video]").forEach((v) => vio.observe(v));
  watch(content);
  observeCopy = watch;
  cleanups.push(() => {
    vio.disconnect();
    content.querySelectorAll("video").forEach((v) => v.pause());
  });

  /* The drop (bybang intro): tiles on screen fall in from above with a pseudo-random stagger */
  const drop = (quick = false) => {
    section.classList.add("is-dropped");
    if (reduced) return;
    const inView = tiles().filter((t) => {
      if (t.hidden) return false;
      const r = t.getBoundingClientRect();
      return r.bottom > -40 && r.top < innerHeight + 40;
    });
    const tl = gsap.timeline();
    inView.forEach((t) => {
      const k = Number(t.dataset.i);
      const r = t.getBoundingClientRect();
      const dur = quick ? 0.6 + (k % 9) * 0.06 : 0.78 + (k % 9) * 0.105;
      const delay = ((k * 3) % 12) * (quick ? 0.035 : 0.06);
      tl.fromTo(t, { y: -(r.bottom + 130) }, { y: 0, duration: dur, ease: "expoOut", clearProps: "transform" }, delay);
    });
    track(tl);
  };

  /* Modal */
  let opener: HTMLElement | null = null;
  const modal = createModal({
    onNav: (dir) => {
      const at = (modal.current() + dir + PLAY.length) % PLAY.length;
      modal.show(PLAY[at], at, at, PLAY.length, null);
    },
    onOpen: () => lenis.stop(),
    onClose: () => lenis.start(),
    tileFor: (index) => {
      const all = tiles().filter((t) => Number(t.dataset.i) === index);
      const onScreen = all.find((t) => {
        const r = t.getBoundingClientRect();
        return r.bottom > 0 && r.top < innerHeight;
      });
      return (onScreen ?? opener ?? all[0])?.querySelector<HTMLElement>("[data-pl-open]") ?? null;
    },
  });
  cleanups.push(() => modal.destroy());

  /* Click, not drag: remember where the press started */
  let downX = 0;
  let downY = 0;
  const onDown = (e: PointerEvent) => {
    downX = e.clientX;
    downY = e.clientY;
  };
  const onClick = (e: MouseEvent) => {
    const btn = (e.target as Element | null)?.closest<HTMLElement>("[data-pl-open]");
    if (!btn) return;
    if (e.detail > 0 && Math.hypot(e.clientX - downX, e.clientY - downY) > CLICK_SLOP) return;
    const i = Number(btn.closest<HTMLElement>("[data-pl-tile]")?.dataset.i);
    if (!PLAY[i]) return;
    opener = btn;
    modal.show(PLAY[i], i, i, PLAY.length, btn);
  };
  content.addEventListener("pointerdown", onDown);
  content.addEventListener("click", onClick);
  cleanups.push(() => {
    content.removeEventListener("pointerdown", onDown);
    content.removeEventListener("click", onClick);
  });

  /* WebGL grain and edge curl on fine pointers, with the DOM as the fallback */
  cleanups.push(mountGrain(section, content, () => lenis.animatedScroll));

  /* Media on the first screen decodes before the drop (at most 1.2s), so no empty box ever falls */
  const firstScreenReady = () => {
    const media = tiles()
      .filter((t) => !t.hidden && t.getBoundingClientRect().top < innerHeight)
      .map((t) => t.querySelector<HTMLImageElement | HTMLVideoElement>("img, video"))
      .filter((m): m is HTMLImageElement | HTMLVideoElement => Boolean(m));
    const ready = media.map((m) => {
      if (m instanceof HTMLImageElement) {
        m.loading = "eager";
        return m.decode().catch(() => undefined);
      }
      const poster = new Image();
      poster.src = m.poster;
      return poster.decode().catch(() => undefined);
    });
    return Promise.race([Promise.all(ready), new Promise((r) => setTimeout(r, 1200))]);
  };

  whenIdle()
    .then(() => (reduced ? undefined : firstScreenReady()))
    .then(() => {
      if (dead) return;
      drop();
    });

  return () => {
    dead = true;
    cleanups.reverse().forEach((fn) => fn());
    anims.forEach((a) => a.kill());
    section.classList.remove("is-dropped");
  };
}

const VERT = `attribute vec2 aPos;
void main() { gl_Position = vec4(aPos, 0.0, 1.0); }`;

/*
 * Fragment: screen-space edge curl while scrolling fast, then a pixel-scale noise tear in a ring around
 * the pointer on the hovered tile. Technique after bybang.co, itself crediting codrops "shader-on-scroll"
 * by jankohlbach (MIT). 2D simplex noise by Ashima Arts / Stefan Gustavson (MIT).
 */
const FRAG = `precision mediump float;
uniform sampler2D uTex;
uniform vec4 uBox;
uniform vec4 uImg;
uniform vec2 uTexSize;
uniform vec2 uView;
uniform float uDpr;
uniform vec2 uPointer;
uniform float uHover;
uniform float uCurl;

vec3 permute(vec3 x) { return mod(((x * 34.0) + 1.0) * x, 289.0); }
float snoise(vec2 v) {
  const vec4 C = vec4(0.211324865405187, 0.366025403784439, -0.577350269189626, 0.024390243902439);
  vec2 i = floor(v + dot(v, C.yy));
  vec2 x0 = v - i + dot(i, C.xx);
  vec2 i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
  vec4 x12 = x0.xyxy + C.xxzz;
  x12.xy -= i1;
  i = mod(i, 289.0);
  vec3 p = permute(permute(i.y + vec3(0.0, i1.y, 1.0)) + i.x + vec3(0.0, i1.x, 1.0));
  vec3 m = max(0.5 - vec3(dot(x0, x0), dot(x12.xy, x12.xy), dot(x12.zw, x12.zw)), 0.0);
  m = m * m;
  m = m * m;
  vec3 x = 2.0 * fract(p * C.www) - 1.0;
  vec3 h = abs(x) - 0.5;
  vec3 ox = floor(x + 0.5);
  vec3 a0 = x - ox;
  m *= 1.79284291400159 - 0.85373472095314 * (a0 * a0 + h * h);
  vec3 g;
  g.x = a0.x * x0.x + h.x * x0.y;
  g.yz = a0.yz * x12.xz + h.yz * x12.yw;
  return 130.0 * dot(m, g);
}

void main() {
  vec2 px = vec2(gl_FragCoord.x, uView.y * uDpr - gl_FragCoord.y) / uDpr;
  float cy = px.y / uView.y * 2.0 - 1.0;
  float edge = 1.0 - sqrt(max(0.0, 1.0 - cy * cy));
  px.x = (0.5 + (px.x / uView.x - 0.5) * (1.0 - edge * uCurl)) * uView.x;

  vec2 local = (px - uBox.xy) / uBox.zw;
  float aspect = uBox.z / uBox.w;
  vec2 d = local - uPointer;
  float circle = clamp(1.0 - length(d * vec2(1.0, 1.0 / aspect)) * 15.0, 0.0, 1.0);
  float focus = smoothstep(14.0, 48.0, length(d * uBox.zw));
  float disp = circle * snoise(gl_FragCoord.xy) * 0.01 * uHover * focus;
  local += vec2(1.0, -1.0) * disp;
  if (local.x < 0.0 || local.x > 1.0 || local.y < 0.0 || local.y > 1.0) discard;

  vec2 p2 = uBox.xy + local * uBox.zw;
  vec2 m = (p2 - uImg.xy) / uImg.zw;
  float a = uImg.z / uImg.w;
  float b = uTexSize.x / uTexSize.y;
  vec2 uv = m;
  if (b > a) uv.x = (m.x - 0.5) * (a / b) + 0.5;
  else uv.y = (m.y - 0.5) * (b / a) + 0.5;

  vec2 edgePx = min(local, 1.0 - local) * uBox.zw;
  float alpha = smoothstep(0.0, 0.75, min(edgePx.x, edgePx.y));
  vec4 c = texture2D(uTex, uv);
  gl_FragColor = vec4(c.rgb * alpha, alpha);
}`;

type GLTex = { tex: WebGLTexture; w: number; h: number; used: number };

/**
 * The bybang signature, on fine pointers wider than 980px with motion allowed: one fixed WebGL1 canvas
 * redraws the tiles on screen (scissored to each tile) so they bow inward at the top and bottom of the
 * viewport with scroll speed, and tear into pixel noise in a ring around the pointer on hover. A tile's
 * DOM media is hidden only once its texture is up; if WebGL is missing or the context is lost, every
 * tile simply shows its DOM media again. It draws only while something moves.
 */
function mountGrain(section: HTMLElement, content: HTMLElement, scrollPos: () => number): () => void {
  if (reducedMotion() || !matchMedia("(hover: hover) and (pointer: fine) and (min-width: 981px)").matches) return () => {};
  const canvas = document.createElement("canvas");
  canvas.className = "pl__gl";
  canvas.setAttribute("aria-hidden", "true");
  const gl = canvas.getContext("webgl", { alpha: true, antialias: false, premultipliedAlpha: true, powerPreference: "low-power" });
  if (!gl) return () => {};
  const shader = (type: number, src: string) => {
    const sh = gl.createShader(type)!;
    gl.shaderSource(sh, src);
    gl.compileShader(sh);
    if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(sh) ?? "shader");
    return sh;
  };
  let prog: WebGLProgram;
  try {
    prog = gl.createProgram()!;
    gl.attachShader(prog, shader(gl.VERTEX_SHADER, VERT));
    gl.attachShader(prog, shader(gl.FRAGMENT_SHADER, FRAG));
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(prog) ?? "link");
  } catch (err) {
    console.warn("Playground WebGL unavailable, using plain media", err);
    return () => {};
  }
  section.querySelector(".pl__wrap")?.after(canvas);
  gl.useProgram(prog);
  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]), gl.STATIC_DRAW);
  const aPos = gl.getAttribLocation(prog, "aPos");
  gl.enableVertexAttribArray(aPos);
  gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);
  const U = (name: string) => gl.getUniformLocation(prog, name);
  const u = { box: U("uBox"), img: U("uImg"), tex: U("uTexSize"), view: U("uView"), dpr: U("uDpr"), pointer: U("uPointer"), hover: U("uHover"), curl: U("uCurl") };
  gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
  gl.enable(gl.BLEND);
  gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);

  let lost = false;
  let dirty = true;
  let dpr = 1;
  let vw = 0;
  let vh = 0;
  const size = () => {
    dpr = Math.min(2, devicePixelRatio || 1);
    vw = innerWidth;
    vh = innerHeight;
    canvas.width = Math.round(vw * dpr);
    canvas.height = Math.round(vh * dpr);
    dirty = true;
  };
  size();
  addEventListener("resize", size);

  /* Textures: images are shared by source across the copies, videos are per element and re-uploaded */
  const textures = new Map<string | HTMLVideoElement, GLTex>();
  let frame = 0;
  const upload = (src: TexImageSource, t: GLTex | undefined, w: number, h: number): GLTex => {
    const tex = t?.tex ?? gl.createTexture()!;
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, src);
    return { tex, w, h, used: frame };
  };
  const textureFor = (media: HTMLImageElement | HTMLVideoElement): GLTex | null => {
    if (media instanceof HTMLImageElement) {
      if (!media.complete || !media.naturalWidth) return null;
      const key = media.currentSrc || media.src;
      let t = textures.get(key);
      if (!t) {
        t = upload(media, undefined, media.naturalWidth, media.naturalHeight);
        textures.set(key, t);
      }
      t.used = frame;
      return t;
    }
    if (media.readyState < 2 || !media.videoWidth) return null;
    let t = textures.get(media);
    if (!t || (!media.paused && frame % 2 === 0)) {
      t = upload(media, t, media.videoWidth, media.videoHeight);
      textures.set(media, t);
    }
    t.used = frame;
    return t;
  };
  const prune = () => {
    if (textures.size <= 24) return;
    for (const [key, t] of textures) {
      if (frame - t.used > 120) {
        gl.deleteTexture(t.tex);
        textures.delete(key);
      }
    }
  };

  /* Hover and pointer, eased the bybang way: 600ms in and out, pointer at about 16% per frame */
  const hoverEase = gsap.parseEase("power2.inOut");
  type Hover = { p: number; target: number; px: number; py: number };
  const hover = new Map<HTMLElement, Hover>();
  let pointerTile: HTMLElement | null = null;
  let mx = 0;
  let my = 0;
  const onMove = (e: PointerEvent) => {
    mx = e.clientX;
    my = e.clientY;
    const tile = (e.target as Element | null)?.closest<HTMLElement>("[data-pl-tile]") ?? null;
    if (tile !== pointerTile) {
      if (pointerTile) hover.get(pointerTile)!.target = 0;
      pointerTile = tile;
      if (tile) {
        const h = hover.get(tile) ?? { p: 0, target: 1, px: 0.5, py: 0.5 };
        h.target = 1;
        hover.set(tile, h);
      }
    }
    dirty = true;
  };
  const onLeave = () => {
    if (pointerTile) hover.get(pointerTile)!.target = 0;
    pointerTile = null;
  };
  content.addEventListener("pointermove", onMove);
  content.addEventListener("pointerleave", onLeave);

  /* Scroll speed: fast attack (25ms), slow release (175ms) */
  let lastScroll = scrollPos();
  let speed = 0;
  let lastSig = "";
  let tail = 0;
  const marked = new Set<HTMLElement>();

  const render = (_time: number, deltaMs: number) => {
    if (lost) return;
    const dt = Math.min(64, deltaMs || 16.7);
    frame++;
    const pos = scrollPos();
    const v = Math.abs(pos - lastScroll) / (dt / 1000);
    lastScroll = pos;
    const target = Math.min(v / 800, 1);
    const tau = target > speed ? 25 : 175;
    speed += (target - speed) * (1 - Math.exp(-dt / tau));
    if (speed < 0.0005) speed = 0;

    let animating = speed > 0;
    const k = 1 - Math.pow(0.84, dt / 16.67);
    for (const [tile, h] of hover) {
      const step = dt / 600;
      h.p = h.target > h.p ? Math.min(1, h.p + step) : Math.max(0, h.p - step);
      let tx = 0.5;
      let ty = 0.5;
      if (tile === pointerTile) {
        const r = tile.getBoundingClientRect();
        tx = (mx - r.left) / r.width;
        ty = (my - r.top) / r.height;
      }
      h.px += (tx - h.px) * k;
      h.py += (ty - h.py) * k;
      if (h.p > 0) animating = true;
      if (h.p === 0 && h.target === 0) hover.delete(tile);
    }

    const visible: { tile: HTMLElement; box: DOMRect; media: HTMLImageElement | HTMLVideoElement }[] = [];
    let sig = "";
    let playing = false;
    for (const tile of content.querySelectorAll<HTMLElement>("[data-pl-tile]:not([hidden])")) {
      const box = tile.querySelector<HTMLElement>(".pl__media")?.getBoundingClientRect();
      if (!box || box.bottom < 0 || box.top > vh || box.width < 1) continue;
      const media = tile.querySelector<HTMLImageElement | HTMLVideoElement>("img, video");
      if (!media) continue;
      visible.push({ tile, box, media });
      sig += `${box.left | 0},${box.top | 0},${box.width | 0};`;
      if (media instanceof HTMLVideoElement && !media.paused) playing = true;
    }
    if (sig !== lastSig || animating || playing || dirty) tail = 30;
    lastSig = sig;
    if (tail <= 0) return;
    tail--;
    dirty = false;

    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.disable(gl.SCISSOR_TEST);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.enable(gl.SCISSOR_TEST);
    gl.uniform2f(u.view, vw, vh);
    gl.uniform1f(u.dpr, dpr);
    gl.uniform1f(u.curl, 0.0486 * speed);

    for (const { tile, box, media } of visible) {
      const t = textureFor(media);
      if (!t) continue;
      if (!marked.has(tile)) {
        marked.add(tile);
        tile.dataset.gl = "";
      }
      const img = media.getBoundingClientRect();
      const h = hover.get(tile);
      gl.bindTexture(gl.TEXTURE_2D, t.tex);
      gl.uniform4f(u.box, box.left, box.top, box.width, box.height);
      gl.uniform4f(u.img, img.left, img.top, img.width, img.height);
      gl.uniform2f(u.tex, t.w, t.h);
      gl.uniform2f(u.pointer, h?.px ?? 0.5, h?.py ?? 0.5);
      gl.uniform1f(u.hover, h ? hoverEase(h.p) : 0);
      const x = Math.floor(box.left * dpr);
      const y = Math.floor((vh - box.bottom) * dpr);
      gl.scissor(Math.max(0, x), Math.max(0, y), Math.ceil(box.width * dpr) + 1, Math.ceil(box.height * dpr) + 1);
      gl.drawArrays(gl.TRIANGLES, 0, 6);
    }
    if (frame % 60 === 0) prune();
  };
  gsap.ticker.add(render);

  const unmark = () => {
    marked.forEach((t) => delete t.dataset.gl);
    marked.clear();
  };
  const onLost = (e: Event) => {
    e.preventDefault();
    lost = true;
    unmark();
    canvas.remove();
  };
  canvas.addEventListener("webglcontextlost", onLost);

  return () => {
    gsap.ticker.remove(render);
    removeEventListener("resize", size);
    content.removeEventListener("pointermove", onMove);
    content.removeEventListener("pointerleave", onLeave);
    canvas.removeEventListener("webglcontextlost", onLost);
    unmark();
    if (!lost) {
      textures.forEach((t) => gl.deleteTexture(t.tex));
      gl.getExtension("WEBGL_lose_context")?.loseContext();
    }
    canvas.remove();
  };
}

/** Playground: the wordmark reveal and the endless mosaic. No footer: the board has no bottom. */
export function mount(root: HTMLElement) {
  const cleanups = [mountReveals(root), mountMosaic(root)];
  return () => cleanups.forEach((fn) => fn());
}
