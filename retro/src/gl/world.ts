import * as THREE from "three";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { gsap } from "gsap";
import { bus } from "../core/bus";
import { sound } from "../core/sound";
import { whenRevealing } from "../core/transition";
import { PROJECTS } from "../content";
import { mediaUrl } from "../lib/html";
import { SIDE_A } from "../templates/tracks";
import { centreCrop, loadSquare, noiseTexture, type Crop } from "./art";
import { createInput } from "./input";
import { RECORD_R, createRecord } from "./record";
import { createShadows } from "./shadow";
import { createSleeve } from "./sleeve";
import { Spring } from "./spring";

export type Early = { intro: boolean; kind: "home" | "case" | "notfound" | null };

type Box = { cx: number; cy: number; s: number; right: number };
type Anchor = "hero" | "player";

const BASE = import.meta.env.BASE_URL;
/** 33 1/3 rpm in radians per second */
const RPM = ((100 / 3) / 60) * Math.PI * 2;
/** The record pokes out past the anchor's right edge by this share of its diameter */
const OUT_SHARE = 0.45;
/** How far behind the sleeve the page plane for the shadows sits, in sleeve widths */
const PAPER_Z = 0.6;
/** The portrait is 4:5; this square holds the face, as on the hero's fallback image */
const portraitCrop: Crop = (w, h) => [0, h * 0.06, w];

const AXIS_Z = new THREE.Vector3(0, 0, 1);
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

export async function createWorld(canvas: HTMLCanvasElement, early: Early) {
  const marks: Record<string, number> = { start: performance.now() };
  const html = document.documentElement;
  const motionQuery = matchMedia("(prefers-reduced-motion: reduce)");
  const still = () => motionQuery.matches;
  /** Hands the main thread back for a frame between heavy steps, so the loader keeps animating */
  const pause = () => new Promise<void>((resolve) => requestAnimationFrame(() => setTimeout(resolve, 0)));

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: "high-performance" });
  renderer.setClearColor(0x000000, 0);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  /* Neutral keeps in-gamut colours as they are and only rolls off the vinyl highlights; the paper surfaces skip it */
  renderer.toneMapping = THREE.NeutralToneMapping;
  const anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());

  /* A software rasteriser cannot hold a frame rate here; the still sleeve image is the better page. ?gl forces it for QA */
  const gl = renderer.getContext();
  const debugInfo = gl.getExtension("WEBGL_debug_renderer_info");
  const gpu = String(gl.getParameter(debugInfo ? debugInfo.UNMASKED_RENDERER_WEBGL : gl.RENDERER));
  if (/swiftshader|llvmpipe|softpipe|software|basic render/i.test(gpu) && !new URLSearchParams(location.search).has("gl")) {
    renderer.dispose();
    renderer.forceContextLoss();
    canvas.style.opacity = "0";
    console.info(`stage: software renderer (${gpu}), keeping the still sleeve`);
    return;
  }

  let failed = false;
  renderer.debug.onShaderError = () => {
    failed = true;
    html.classList.remove("has-stage");
    hide();
    console.error("stage: shader failed to compile, keeping the fallback image");
  };

  await pause();
  const scene = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer);
  const room = new RoomEnvironment();
  scene.environment = pmrem.fromScene(room, 0.04).texture;
  scene.environmentRotation.y = Math.PI * 0.2;
  scene.environmentIntensity = 0.85;
  room.dispose();
  pmrem.dispose();

  /* High, grazing and a little left: the groove spoke lands on the half of the record that is out of the sleeve */
  const key = new THREE.DirectionalLight(0xfff4e6, 5);
  const keyHome = new THREE.Vector3(-0.4, 2.4, 1.2);
  key.position.copy(keyHome);
  scene.add(key);

  const camera = new THREE.PerspectiveCamera(30, 1, 1, 10000);
  marks.env = performance.now();
  await pause();

  const noise = noiseTexture();
  const sleeve = createSleeve(noise);
  await pause();
  const record = await createRecord(anisotropy, pause);
  const shadows = createShadows();
  const rig = new THREE.Group();
  rig.add(record.slide, sleeve.group);
  const paper = new THREE.Group();
  paper.add(shadows.group);
  scene.add(paper, rig);
  marks.objects = performance.now();

  /* ---------- art ---------- */

  const portrait = await loadSquare(mediaUrl(BASE, "me/portrait", "jpg"), 1600, portraitCrop, anisotropy);
  sleeve.show("portrait", portrait, 1);
  marks.portrait = performance.now();

  /* Upload one texture per frame and compile in parallel where the driver allows, instead of all at the first render */
  for (const tex of [noise, portrait, ...record.textures]) {
    await pause();
    renderer.initTexture(tex);
  }
  await pause();
  if (renderer.extensions.has("KHR_parallel_shader_compile")) await renderer.compileAsync(scene, camera);
  else renderer.compile(scene, camera);
  marks.compiled = performance.now();

  const covers = new Map<string, Promise<THREE.Texture>>();
  const cover = (slug: string) => {
    let pending = covers.get(slug);
    if (!pending) {
      const project = PROJECTS.find((p) => p.slug === slug);
      if (!project) return Promise.reject(new Error(`no project ${slug}`));
      pending = loadSquare(mediaUrl(BASE, project.shots[0].file, "jpg"), 1024, centreCrop, anisotropy).then((tex) => {
        renderer.initTexture(tex);
        return tex;
      });
      pending.catch(() => covers.delete(slug));
      covers.set(slug, pending);
    }
    return pending;
  };

  let wanted: string | null = null;
  bus.on("track:hover", ({ slug }) => {
    wanted = slug;
    if (!slug) return sleeve.show("portrait", portrait, 1, still());
    cover(slug)
      .then((tex) => {
        if (wanted === slug) sleeve.show(slug, tex, 0.12, still());
      })
      .catch(() => {
        /* a missing cover keeps whatever art is on the sleeve */
      });
  });

  const preload = () => {
    const queue = SIDE_A.map((p) => p.slug);
    const next = (): void => {
      const slug = queue.shift();
      if (slug) cover(slug).then(next, next);
    };
    next();
  };

  /* ---------- layout ---------- */

  let W = 0;
  let H = 0;
  function resize() {
    W = Math.max(1, canvas.clientWidth);
    H = Math.max(1, canvas.clientHeight);
    renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    renderer.setSize(W, H, false);
  }
  resize();
  window.addEventListener("resize", resize);

  let heroEl: HTMLElement | null = null;
  let playerEl: HTMLElement | null = null;
  let sideEl: HTMLElement | null = null;
  const near = new Set<Element>();
  const watcher = new IntersectionObserver(
    (entries) => {
      entries.forEach((e) => (e.isIntersecting ? near.add(e.target) : near.delete(e.target)));
      wake();
    },
    { rootMargin: "60% 0px 60% 0px" },
  );

  function bindAnchors() {
    watcher.disconnect();
    near.clear();
    heroEl = document.querySelector<HTMLElement>('[data-anchor="hero"]');
    playerEl = document.querySelector<HTMLElement>('[data-anchor="player"]');
    sideEl = playerEl?.closest<HTMLElement>("section") ?? null;
    [heroEl, sideEl].forEach((el) => el && watcher.observe(el));
  }

  /** The sleeve square inside an anchor: as tall as the anchor, from its left edge */
  function measure(el: HTMLElement | null, origin: DOMRect): Box | null {
    if (!el) return null;
    const r = el.getBoundingClientRect();
    if (r.width < 8 || r.height < 8) return null;
    const s = Math.min(r.width, r.height);
    return { cx: r.left - origin.left + s / 2, cy: r.top - origin.top + r.height / 2, s, right: r.right - origin.left };
  }

  let active: Anchor = "hero";
  /** The player takes the sleeve once Side A rises past the middle of the screen, with some hysteresis */
  function choose(origin: DOMRect): { anchor: Anchor; box: Box | null } {
    const player = measure(playerEl, origin);
    if (player && sideEl) {
      const top = sideEl.getBoundingClientRect().top - origin.top;
      if (top < H * (active === "player" ? 0.72 : 0.58)) return { anchor: "player", box: player };
    }
    const hero = measure(heroEl, origin);
    if (hero) return { anchor: "hero", box: hero };
    return player ? { anchor: "player", box: player } : { anchor: active, box: null };
  }

  /* The flight between anchors: progress is a spring, the start point scrolls with the page */
  const flight = new Spring(1, 46, 0.74);
  let from: (Box & { scroll: number }) | null = null;
  let shown: Box | null = null;
  let heading = 0;

  /* ---------- motion state ---------- */

  const fx = { drop: 1, out: 0, spin: 0, push: 0, boost: 0 };
  const tiltX = new Spring(0, 90, 0.62);
  const tiltY = new Spring(0, 90, 0.62);
  let angle = 0;
  let omega = 0;
  let dragVel = 0;
  let outX = 0.5 - 0.05 * RECORD_R * 2;
  let voice: { update(v: number): void; stop(): void } | null = null;

  const timer = new THREE.Timer();
  timer.connect(document);

  const raycaster = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  const hitList = [sleeve.front, ...record.hit];
  const centre = new THREE.Vector3();
  let origin = canvas.getBoundingClientRect();
  let drawn = false;
  let kind: Early["kind"] = early.kind ?? (document.querySelector('[data-anchor="hero"]') ? "home" : "case");

  const input = createInput({
    hit(x, y) {
      if (!drawn || kind !== "home" || fx.out < 0.6) return false;
      ndc.set(((x - origin.left) / W) * 2 - 1, -((y - origin.top) / H) * 2 + 1);
      raycaster.setFromCamera(ndc, camera);
      const first = raycaster.intersectObjects(hitList, false)[0];
      return Boolean(first && first.object !== sleeve.front);
    },
    centre() {
      record.spin.getWorldPosition(centre).project(camera);
      return { x: origin.left + ((centre.x + 1) / 2) * W, y: origin.top + ((1 - centre.y) / 2) * H };
    },
  });

  /* ---------- frame ---------- */

  function clear() {
    if (!drawn) return;
    renderer.clear();
    drawn = false;
  }

  function frame() {
    timer.update();
    const dt = Math.min(timer.getDelta(), 0.05);
    if (failed) return;

    origin = canvas.getBoundingClientRect();
    if (Math.round(origin.width) !== W || Math.round(origin.height) !== H) resize();

    const pick = choose(origin);
    const target = pick.box;
    if (!target) return clear();

    if (pick.anchor !== active) {
      if (shown && !still()) {
        from = { ...shown, scroll: scrollY };
        heading = Math.sign(target.cx - shown.cx) || 1;
        flight.snap(0);
        flight.target = 1;
      }
      active = pick.anchor;
      input.watchTouch((active === "player" ? playerEl : heroEl)?.closest<HTMLElement>("section") ?? null);
    }

    flight.step(dt);
    let box = target;
    let arc = 0;
    if (from) {
      const t = flight.value;
      const start = { ...from, cy: from.cy - (scrollY - from.scroll) };
      box = {
        cx: lerp(start.cx, target.cx, t),
        cy: lerp(start.cy, target.cy, t),
        s: lerp(start.s, target.s, t),
        right: lerp(start.right, target.right, t),
      };
      arc = Math.sin(Math.PI * clamp(t, 0, 1));
      if (flight.settled) from = null;
    }
    shown = box;
    const s = Math.max(40, box.s);

    /* tilt toward the cursor, held still while scratching */
    const pointer = input.state;
    if (!pointer.scratching) {
      const on = pointer.mouse && !still();
      tiltY.target = on ? clamp((pointer.x - box.cx) / (W * 0.5), -1, 1) * 0.1 : 0;
      tiltX.target = on ? clamp((pointer.y - box.cy) / (H * 0.5), -1, 1) * 0.085 : 0;
    }
    tiltX.step(dt);
    tiltY.step(dt);
    /* the light swings a little with the cursor, so the spoke sweeps across the grooves */
    key.position.copy(keyHome).applyAxisAngle(AXIS_Z, -tiltY.value * 2.2);

    /* the platter: 33 1/3 unless a hand is on it */
    if (pointer.scratching) {
      if (!voice) voice = sound.scratch();
      const d = input.take();
      dragVel += (d / Math.max(dt, 1e-3) - dragVel) * 0.45;
      omega = dragVel;
      angle += d;
      voice.update(dragVel / RPM);
    } else {
      if (voice) {
        voice.stop();
        voice = null;
      }
      dragVel = 0;
      const cruise = (still() ? 0 : RPM * fx.spin) + RPM * 5 * fx.boost;
      omega += (cruise - omega) * (1 - Math.exp(-dt / 0.08));
      angle += omega * dt;
    }

    outX = (box.right - box.cx) / s - (1 - OUT_SHARE * 2) * RECORD_R;

    const lift = fx.push * 0.24 + arc * 0.3;
    const drop = fx.drop * 0.07 * s;
    const x = box.cx - W / 2;
    const y = H / 2 - box.cy;

    const D = s * 3.2;
    camera.fov = THREE.MathUtils.radToDeg(2 * Math.atan(H / D));
    camera.aspect = W / H;
    camera.near = Math.max(1, D - s * 3);
    camera.far = D + s * 3;
    camera.position.set(x, y, D);
    camera.setViewOffset(W * 2, H * 2, W - box.cx, H - box.cy, W, H);

    rig.scale.setScalar(s);
    rig.position.set(x, y - drop, lift * s);
    rig.rotation.set(tiltX.value + fx.drop * 0.2, tiltY.value + arc * 0.3 * heading, fx.drop * -0.075 - arc * 0.05 * heading);
    record.slide.position.x = outX * fx.out;
    record.spin.rotation.z = -angle;

    /* The shadows sit well behind the rig so a tilted or flying record never dips under them; scaled back to size */
    const depth = (D + PAPER_Z * s) / D;
    paper.scale.setScalar(s * depth);
    paper.position.set(x, y - drop * depth, -PAPER_Z * s);
    paper.rotation.z = rig.rotation.z;
    shadows.update(lift + Math.abs(tiltX.value) * 0.3 + Math.abs(tiltY.value) * 0.3 + fx.drop * 0.08, outX * fx.out, 1);

    const reach = box.cx + (outX + RECORD_R + 0.15) * s;
    const onScreen = reach > 0 && box.cx - 0.7 * s < W && box.cy + 0.75 * s > 0 && box.cy - 0.7 * s < H;
    if (!onScreen) return clear();

    renderer.render(scene, camera);
    drawn = true;
    if (!html.classList.contains("has-stage")) {
      marks.firstFrame = performance.now();
      firstPaint();
    }
  }

  let firstPainted = false;
  function firstPaint() {
    html.classList.add("has-stage");
    if (firstPainted) return;
    firstPainted = true;
    const idle = (fn: () => void) => ("requestIdleCallback" in window ? requestIdleCallback(fn, { timeout: 3000 }) : setTimeout(fn, 800));
    idle(preload);
  }

  /* ---------- lifecycle ---------- */

  let attached = false;
  const tick = () => frame();
  function wake() {
    const wanted = kind === "home" && !failed && !lost && (near.size > 0 || from !== null);
    if (wanted && !attached) {
      timer.reset();
      gsap.ticker.add(tick);
      attached = true;
    } else if (!wanted && attached) {
      gsap.ticker.remove(tick);
      attached = false;
      clear();
    }
  }
  function show() {
    canvas.style.opacity = "1";
    wake();
  }
  function hide() {
    canvas.style.opacity = "0";
    input.release();
    if (attached) gsap.ticker.remove(tick);
    attached = false;
    clear();
  }

  let lost = false;
  canvas.addEventListener("webglcontextlost", (e) => {
    e.preventDefault();
    lost = true;
    html.classList.remove("has-stage");
    hide();
  });
  canvas.addEventListener("webglcontextrestored", () => {
    lost = false;
    drawn = false;
    if (kind === "home") show();
  });

  let entrance: gsap.core.Timeline | null = null;
  /** The sleeve settles, then the record slides out with a little overshoot and the platter spins up */
  function enter(full: boolean) {
    entrance?.kill();
    gsap.killTweensOf(fx);
    if (still()) {
      Object.assign(fx, { drop: 0, out: 1, spin: 0, push: 0, boost: 0 });
      return;
    }
    Object.assign(fx, { drop: full ? 1 : 0.5, out: 0, spin: 0, push: 0, boost: 0 });
    entrance = gsap
      .timeline()
      .to(fx, { drop: 0, duration: full ? 1.15 : 0.75, ease: "expo.out" }, 0)
      .to(fx, { out: 1, duration: full ? 1.05 : 0.75, ease: "back.out(1.6)" }, full ? 0.55 : 0.3)
      .to(fx, { spin: 1, duration: full ? 1.6 : 1, ease: "power2.inOut" }, full ? 0.8 : 0.45);
  }

  let introPlayed = false;
  const playIntro = () => {
    if (introPlayed) return;
    introPlayed = true;
    if (kind === "home") enter(true);
  };
  if (early.intro || html.classList.contains("intro-done")) playIntro();
  else {
    bus.on("intro:done", playIntro);
    /* If no loader ever reports in, do not leave the record stuck inside the sleeve */
    setTimeout(playIntro, document.querySelector(".loader, [data-loader]") ? 9000 : 600);
  }

  bus.on("route:enter", ({ kind: next }) => {
    kind = next;
    if (next !== "home") return hide();
    bindAnchors();
    from = null;
    shown = null;
    flight.snap(1);
    if (introPlayed) {
      if (!still()) Object.assign(fx, { drop: 0.5, out: 0, spin: 0, push: 0, boost: 0 });
      whenRevealing().then(() => kind === "home" && enter(false));
    }
    show();
  });
  bus.on("route:leave", () => input.release());
  bus.on("track:open", () => {
    if (kind !== "home" || still()) return;
    entrance?.kill();
    gsap.to(fx, { boost: 1, duration: 0.35, ease: "power2.in", overwrite: "auto" });
    gsap.to(fx, { push: 1, duration: 0.42, ease: "power3.out", overwrite: "auto" });
  });

  motionQuery.addEventListener("change", () => {
    if (still()) Object.assign(fx, { drop: 0, out: 1, push: 0, boost: 0 });
  });

  bindAnchors();
  if (kind === "home") show();
  else hide();

  if (import.meta.env.DEV) {
    (window as unknown as { __stage: object }).__stage = {
      state: () => ({ active, kind, attached, drawn, fx: { drop: fx.drop, out: fx.out, spin: fx.spin, push: fx.push }, box: shown, near: near.size, marks, angle, omega, scratching: input.state.scratching, hover: input.state.hover }),
      uniforms: sleeve.uniforms,
      three: { scene, key, record, renderer },
      /** Renders now and returns the frame as a data URL, for side-by-side tuning in dev */
      snap() {
        renderer.render(scene, camera);
        return canvas.toDataURL("image/png");
      },
      /** Renders and reads one canvas pixel at viewport coordinates, as an sRGB hex */
      sample(px: number, py: number) {
        renderer.render(scene, camera);
        const gl = renderer.getContext();
        const ratio = renderer.getPixelRatio();
        const out = new Uint8Array(4);
        gl.readPixels(Math.round(px * ratio), Math.round((H - py) * ratio), 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, out);
        const a = out[3] / 255 || 1;
        return "#" + [0, 1, 2].map((i) => Math.round(out[i] / a).toString(16).padStart(2, "0")).join("") + ` a${out[3]}`;
      },
    };
  }
}
