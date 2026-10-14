import { gsap } from "gsap";
import { Draggable } from "gsap/Draggable";
import { InertiaPlugin } from "gsap/InertiaPlugin";
import { bus } from "../core/bus";
import type { Cleanup } from "../core/router";
import { reducedMotion } from "../core/scroll";
import { sound } from "../core/sound";
import { MEDIA, PLAY } from "../content";
import { mediaUrl, pad2 } from "../lib/html";
import { CHANNELS, GAME } from "../templates/den";
import { LOOK, createCrt, type Fx } from "./crt";
import { GH, GW, NightDrive } from "./game";

gsap.registerPlugin(Draggable, InertiaPlugin);

const BASE = import.meta.env.BASE_URL;
const N = CHANNELS.length;
const STEP = 360 / N;
const PIXEL16 = '16px "Press Start 2P"';
const PIXEL8 = '8px "Press Start 2P"';

const idx = (rotation: number) => (((Math.round(rotation / STEP) % N) + N) % N);

const images = new Map<string, Promise<HTMLImageElement>>();
function loadImage(src: string) {
  let p = images.get(src);
  if (!p) {
    const img = new Image();
    img.decoding = "async";
    img.src = src;
    p = img.decode().then(() => img);
    p.catch(() => images.delete(src));
    images.set(src, p);
  }
  return p;
}

/**
 * The den: a 1970s wood-cabinet TV. Channel 1 is Night Drive, the rest are playground pieces shown
 * through the CRT pass. The knob turns with detents (drag, click, arrow keys), the guide tunes directly,
 * and the set only draws while it is on screen and the tab is visible.
 */
export function mount(root: HTMLElement): Cleanup {
  const den = root.querySelector<HTMLElement>(".den");
  const tv = den?.querySelector<HTMLElement>("[data-tv]");
  const screen = den?.querySelector<HTMLElement>("[data-screen]");
  const out = den?.querySelector<HTMLCanvasElement>("[data-crt]");
  const knob = den?.querySelector<HTMLElement>("[data-knob-channel]");
  const grip = knob?.querySelector<HTMLElement>(".knob__grip");
  if (!den || !tv || !screen || !out || !knob || !grip) return () => {};

  const rm = reducedMotion();
  const items = [...den.querySelectorAll<HTMLElement>("[data-item]")];
  const guide = [...den.querySelectorAll<HTMLButtonElement>("[data-channel]")];
  const announce = document.querySelector<HTMLElement>("[data-announce]");
  const offs: (() => void)[] = [];
  const listen = (el: EventTarget, type: string, fn: EventListener) => {
    el.addEventListener(type, fn);
    offs.push(() => el.removeEventListener(type, fn));
  };

  const crt = createCrt(out);
  const fx: Fx = { time: 0, snow: 0, roll: 0, beamW: 0, beamH: 0, flash: 0, osd: 0 };
  let channel = 0;
  let shown = 0;
  let rot = 0;
  let visible = false;
  let powered = false;
  let raf = 0;
  let last = 0;
  let token = 0;
  let loading = false;
  let noSignal = false;
  let kind: "game" | "image" | "video" | "none" = "game";
  let video: HTMLVideoElement | null = null;
  let commitTimer = 0;
  let osdTimer = 0;
  let lastTick = 0;
  let msg = "";

  /* ---------- the picture ---------- */

  const game = new NightDrive({
    reduced: rm,
    coarse: matchMedia("(pointer: coarse)").matches,
    onState: () => {
      syncScreen();
      invalidate();
    },
  });
  offs.push(game.attach(out));

  const showGame = () => {
    kind = "game";
    loading = false;
    noSignal = false;
    crt.picture(game.canvas, GW, GH, "game");
  };

  const resumeVideo = () =>
    video?.play().catch(() => {
      /* a refused resume leaves the last frame up; the next visibility change tries again */
    });

  const stopVideo = () => {
    if (!video) return;
    video.onloadeddata = null;
    video.onerror = null;
    video.pause();
    video.removeAttribute("src");
    video.load();
  };

  const showPiece = (i: number) => {
    const piece = PLAY[i - 1];
    const mine = ++token;
    kind = "none";
    loading = true;
    noSignal = false;
    crt.picture(null, 1, 1, "image");
    const still = () =>
      loadImage(mediaUrl(BASE, piece.file, "jpg"))
        .then((img) => {
          if (mine !== token) return;
          kind = "image";
          loading = false;
          crt.picture(img, img.naturalWidth, img.naturalHeight, "image");
          invalidate();
        })
        .catch(() => {
          if (mine !== token) return;
          loading = false;
          noSignal = true;
          drawOsd();
          invalidate();
        });
    if (MEDIA[piece.file]?.video && !rm) {
      video ??= Object.assign(document.createElement("video"), { muted: true, loop: true, playsInline: true, preload: "auto" });
      const v = video;
      v.onloadeddata = () => {
        if (mine !== token) return;
        kind = "video";
        loading = false;
        crt.picture(v, v.videoWidth, v.videoHeight, "video");
        invalidate();
      };
      /* a video that will not load or play falls back to its poster frame; an abort means a newer channel took over */
      const fail = () => {
        if (mine === token) still();
      };
      v.onerror = fail;
      v.src = mediaUrl(BASE, piece.file, "mp4");
      if (visible) v.play().catch((err: DOMException) => err.name !== "AbortError" && fail());
    } else {
      stopVideo();
      still();
    }
  };

  /* ---------- on-screen display ---------- */

  const osd = document.createElement("canvas");
  osd.width = GW;
  osd.height = GH;
  const o = osd.getContext("2d")!;
  const osdText = (text: string, x: number, y: number, font: string, align: CanvasTextAlign) => {
    o.font = font;
    o.textAlign = align;
    o.textBaseline = "alphabetic";
    o.fillStyle = "#2a1a12";
    o.fillText(text, x + 2, y + 2);
    o.fillStyle = "#f1e2c0";
    o.fillText(text, x, y);
  };
  function drawOsd() {
    o.clearRect(0, 0, GW, GH);
    osdText(`CH ${pad2(shown + 1)}`, GW - 18, 36, PIXEL16, "right");
    if (msg) osdText(msg, 18, GH - 18, PIXEL8, "left");
    if (noSignal && shown === channel) osdText("No signal", GW / 2, GH / 2 + 8, PIXEL16, "center");
    crt.osd(osd);
  }
  const showOsd = () => {
    drawOsd();
    gsap.killTweensOf(fx, "osd");
    clearTimeout(osdTimer);
    fx.osd = 1;
    if (rm)
      osdTimer = window.setTimeout(() => {
        fx.osd = 0;
        msg = "";
        invalidate();
      }, 1600);
    else gsap.to(fx, { osd: 0, duration: 0.45, delay: 1.5, ease: "power1.in", onComplete: () => void (msg = "") });
    invalidate();
  };
  /* a still frame drawn before the pixel font arrived would keep the fallback serif, so redraw once it lands */
  document.fonts?.load(PIXEL16).then(() => {
    drawOsd();
    invalidate();
  });

  /* ---------- frame loop: only while on screen and the tab is visible ---------- */

  const needsLoop = () => !rm || gsap.isTweening(fx) || kind === "video" || (channel === 0 && game.animating);

  function frame(now: number) {
    raf = 0;
    const dt = last ? Math.min(0.1, (now - last) / 1000) : 1 / 60;
    last = now;
    if (!rm) fx.time += dt;
    if (kind === "game") {
      game.frame(dt);
      crt.refresh();
    } else if (kind === "video" && video && video.readyState >= 2) crt.refresh();
    const snow = Math.max(fx.snow, loading && powered ? 0.55 : 0, noSignal ? 0.5 : 0);
    crt.render(channel === 0 ? LOOK.game : LOOK.play, { ...fx, snow, osd: Math.max(fx.osd, noSignal ? 1 : 0) });
    if (visible && !document.hidden && needsLoop()) raf = requestAnimationFrame(frame);
    else last = 0;
  }
  function invalidate() {
    if (!raf && visible && !document.hidden) raf = requestAnimationFrame(frame);
  }

  /* ---------- channels ---------- */

  const setAria = (i: number) => {
    knob.setAttribute("aria-valuenow", String(i + 1));
    knob.setAttribute("aria-valuetext", `Channel ${i + 1}, ${CHANNELS[i].title}`);
  };

  const syncScreen = () => {
    const isGame = channel === 0;
    const playing = isGame && game.state === "playing";
    out.tabIndex = isGame ? 0 : -1;
    out.setAttribute("role", isGame ? "application" : "img");
    if (isGame) out.setAttribute("aria-roledescription", "game");
    else out.removeAttribute("aria-roledescription");
    const piece = PLAY[channel - 1];
    out.setAttribute("aria-label", isGame ? (playing ? `${GAME.title}. Esc to stop.` : `${GAME.title}. Press Enter to play.`) : `${piece.title}. ${piece.note}`);
    if (isGame) screen.dataset.cursor = playing ? "hide" : "play";
    else delete screen.dataset.cursor;
    screen.classList.toggle("is-playing", playing);
    screen.dataset.game = isGame ? game.state : "";
    /* the cursor only re-reads its target on pointer move, so tell it when the game takes or gives back the pointer */
    if (screen.matches(":hover")) window.dispatchEvent(new CustomEvent("cursor:state", { detail: screen.dataset.cursor ?? "" }));
  };

  const showCaption = (i: number) => {
    items.forEach((el) => el.toggleAttribute("data-on", Number(el.dataset.item) === i));
    guide.forEach((b) => b.setAttribute("aria-pressed", String(Number(b.dataset.channel) === i)));
    const el = items[i];
    if (!el || rm) return;
    const parts = el.querySelectorAll<HTMLElement>(".den__lead > *, .den__more > *");
    gsap.killTweensOf(parts);
    gsap.fromTo(parts, { opacity: 0, y: 14 }, { opacity: 1, y: 0, duration: 0.55, stagger: 0.05, ease: "power3.out", clearProps: "opacity,transform" });
  };

  const transition = () => {
    sound.static(150);
    gsap.killTweensOf(fx, "snow,roll");
    if (rm) {
      fx.snow = 0;
      fx.roll = 0;
      return;
    }
    fx.snow = 0.9;
    gsap.to(fx, { snow: 0, duration: 0.16, ease: "steps(3)" });
    gsap.fromTo(fx, { roll: 0.42 }, { roll: 0, duration: 0.5, delay: 0.08, ease: "power3.out" });
  };

  function tune(i: number, from: "knob" | "key" | "click" | "guide") {
    clearTimeout(commitTimer);
    shown = i;
    setAria(i);
    if (i === channel) {
      gsap.to(fx, { snow: 0, duration: rm ? 0 : 0.15, overwrite: "auto" });
      drawOsd();
      invalidate();
      return;
    }
    if (channel === 0) game.pause();
    channel = i;
    token++;
    if (i === 0) {
      stopVideo();
      showGame();
    } else showPiece(i);
    syncScreen();
    showCaption(i);
    if (powered) {
      transition();
      showOsd();
    }
    if (from === "guide" && announce) announce.textContent = `Channel ${i + 1}, ${CHANNELS[i].title}`;
    invalidate();
  }

  const detent = (i: number) => {
    const now = performance.now();
    if (now - lastTick > 28) sound.tick(0.7 + (i % 5) * 0.06);
    lastTick = now;
  };

  /** While the knob is between stations the set shows snow and the number it is passing */
  const scrub = (rotation: number) => {
    const i = idx(rotation);
    if (i === shown) return;
    shown = i;
    detent(i);
    setAria(i);
    if (!rm) fx.snow = 0.85;
    if (powered) showOsd();
    invalidate();
  };

  let drag: Draggable | null = null;
  const turnGrip = () => {
    gsap.to(grip, { rotation: rot, duration: rm ? 0 : 0.26, ease: "back.out(2.6)", overwrite: true, onComplete: () => void drag?.update() });
  };

  const stepBy = (d: number, from: "key" | "click") => {
    if (!d) return;
    rot += d * STEP;
    turnGrip();
    const i = idx(rot);
    detent(i);
    if (from === "key") {
      scrub(rot);
      commitTimer = window.setTimeout(() => tune(i, "key"), 200);
    } else tune(i, "click");
  };

  const settle = () => {
    const now = Number(gsap.getProperty(grip, "rotation"));
    rot = Math.round(now / STEP) * STEP;
    if (Math.abs(now - rot) > 0.01) turnGrip();
    tune(idx(rot), "knob");
  };

  [drag] = Draggable.create(grip, {
    type: "rotation",
    trigger: knob,
    inertia: !rm,
    minimumMovement: 3,
    snap: (v: number) => Math.round(v / STEP) * STEP,
    onPress: () => {
      gsap.killTweensOf(grip);
      clearTimeout(commitTimer);
    },
    onDrag: () => drag && scrub(drag.rotation),
    onThrowUpdate: () => drag && scrub(drag.rotation),
    onDragEnd: () => {
      gsap.delayedCall(0.05, () => {
        if (drag && !drag.isThrowing) settle();
      });
    },
    onThrowComplete: () => settle(),
    onClick: () => stepBy(1, "click"),
  });

  listen(knob, "keydown", ((e: KeyboardEvent) => {
    const k = e.key;
    let d = 0;
    if (k === "ArrowUp" || k === "ArrowRight") d = 1;
    else if (k === "ArrowDown" || k === "ArrowLeft") d = -1;
    else if (k === "PageUp") d = 5;
    else if (k === "PageDown") d = -5;
    else if (k === "Home") d = -shown;
    else if (k === "End") d = N - 1 - shown;
    else return;
    e.preventDefault();
    stepBy(d, "key");
  }) as EventListener);

  guide.forEach((b) =>
    listen(b, "click", () => {
      const target = Number(b.dataset.channel);
      let d = target - idx(rot);
      if (d > N / 2) d -= N;
      if (d < -N / 2) d += N;
      rot += d * STEP;
      turnGrip();
      tune(target, "guide");
    }),
  );

  /* ---------- power, visibility, size ---------- */

  const powerOn = () => {
    powered = true;
    tv.dataset.power = "on";
    if (rm) {
      fx.beamW = fx.beamH = 1;
      showOsd();
      return;
    }
    sound.static(90);
    gsap
      .timeline()
      .set(fx, { beamW: 0.002, beamH: 0.003, flash: 0.7 })
      .to(fx, { beamW: 1, duration: 0.22, ease: "power2.out" })
      .to(fx, { beamH: 1, duration: 0.6, ease: "expo.out" })
      .to(fx, { flash: 0, duration: 1, ease: "power2.out" }, "<")
      .add(showOsd, "-=0.35");
    invalidate();
  };

  /* several entries can queue while the page is busy; only the latest one describes where the set is now */
  const io = new IntersectionObserver(
    (entries) => {
      const e = entries[entries.length - 1];
      visible = e.isIntersecting;
      if (visible) {
        if (!powered && e.intersectionRatio >= 0.3) powerOn();
        if (kind === "video") resumeVideo();
        invalidate();
      } else video?.pause();
      if (e.intersectionRatio < 0.5) game.pause();
    },
    { threshold: [0, 0.3, 0.5] },
  );
  io.observe(tv);

  const ro = new ResizeObserver((entries) => {
    const box = entries[entries.length - 1].contentRect;
    crt.resize(box.width, box.height);
    if (raf) return;
    if (visible) invalidate();
  });
  ro.observe(screen);

  listen(document, "visibilitychange", () => {
    if (document.hidden) {
      game.pause();
      video?.pause();
    } else if (visible) {
      if (kind === "video") resumeVideo();
      invalidate();
    }
  });

  offs.push(
    bus.on("sound:change", ({ on }) => {
      if (!powered || !visible) return;
      msg = on ? "Sound on" : "Sound off";
      showOsd();
    }),
  );

  showGame();
  syncScreen();

  return () => {
    cancelAnimationFrame(raf);
    clearTimeout(commitTimer);
    clearTimeout(osdTimer);
    io.disconnect();
    ro.disconnect();
    offs.forEach((fn) => fn());
    drag?.kill();
    gsap.killTweensOf(fx);
    gsap.killTweensOf(grip);
    stopVideo();
    game.destroy();
    crt.destroy();
  };
}
