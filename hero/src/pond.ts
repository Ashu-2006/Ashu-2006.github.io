type Point = { x: number; y: number };
type Koi = {
  head: Point;
  angle: number;
  wander: number;
  speed: number;
  base: number;
  burst: number;
  size: number;
  body: string;
  spot: string;
  spots: number[];
  phase: number;
  spine: Point[];
};
type Ring = { x: number; y: number; r: number; life: number };
type Food = { x: number; y: number; life: number };

const PALETTE = [
  { body: "#ff7a1a", spot: "#f6efe4" },
  { body: "#f3ece0", spot: "#ff5a1f" },
  { body: "#ffb400", spot: "#ff7a1a" },
  { body: "#f3ece0", spot: "#1d1d1d" },
  { body: "#ff4d2e", spot: "#f6efe4" },
  { body: "#ff9a3c", spot: "#f3ece0" },
  { body: "#ece4d6", spot: "#ff7a1a" },
];
const SEGMENTS = 11;
/** Half-width of the body at each spine point, as a share of fish length */
const PROFILE = [0.1, 0.13, 0.14, 0.135, 0.12, 0.1, 0.08, 0.06, 0.045, 0.03, 0.02];
const SCARE_RADIUS = 140;
const SCARE_SPEED = 0.6;
const FOOD_RADIUS = 280;
const TURN = 2.6;
const EDGE = 70;
const MAX_FOOD = 6;

const rand = (a: number, b: number) => a + Math.random() * (b - a);
const wrapAngle = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));

/**
 * A koi pond in the footer. Fish wander, avoid the edges and each other, scatter from a fast pointer
 * or a tap, and come for food dropped on open water. Lily pads sit above the fish so they swim under.
 * The loop only runs while the pond is on screen and the tab is visible.
 */
export function mountPond(host: HTMLElement) {
  const canvas = host.querySelector("canvas")!;
  const ctx = canvas.getContext("2d")!;
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const pace = reduced ? 0.45 : 1;

  let W = 0;
  let H = 0;
  let dpr = 1;
  let raf = 0;
  let last = 0;
  let visible = false;
  let water: CanvasGradient | null = null;
  const pointer = { x: 0, y: 0, vx: 0, vy: 0, on: false, t: 0 };
  const rings: Ring[] = [];
  const food: Food[] = [];
  let pads: { x: number; y: number; r: number; rot: number }[] = [];
  let fish: Koi[] = [];

  const makeFish = (i: number): Koi => {
    const size = rand(64, 104) * Math.min(1, Math.max(0.7, W / 1100));
    const head = { x: rand(EDGE, W - EDGE), y: rand(EDGE, H - EDGE) };
    const angle = rand(-Math.PI, Math.PI);
    const seg = size / (SEGMENTS - 1);
    const spine = Array.from({ length: SEGMENTS }, (_, s) => ({ x: head.x - Math.cos(angle) * seg * s, y: head.y - Math.sin(angle) * seg * s }));
    const colors = PALETTE[i % PALETTE.length];
    return {
      head,
      angle,
      wander: 0,
      speed: 0,
      base: rand(28, 46),
      burst: 0,
      size,
      ...colors,
      spots: [rand(1, 3), rand(3, 6), rand(5, 8)].map(Math.round),
      phase: rand(0, Math.PI * 2),
      spine,
    };
  };

  const resize = () => {
    const rect = host.getBoundingClientRect();
    dpr = Math.min(2, window.devicePixelRatio || 1);
    W = rect.width;
    H = rect.height;
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    water = ctx.createRadialGradient(W * 0.5, H * 0.35, 0, W * 0.5, H * 0.5, Math.max(W, H) * 0.75);
    water.addColorStop(0, "#14292a");
    water.addColorStop(0.6, "#0e1c1d");
    water.addColorStop(1, "#091212");
    const r = Math.min(W, H) * 0.11;
    pads = [
      { x: W * 0.12, y: H * 0.22, r: r * 1.1, rot: 0.6 },
      { x: W * 0.2, y: H * 0.32, r: r * 0.6, rot: 2.2 },
      { x: W * 0.86, y: H * 0.72, r: r * 1.25, rot: 4.1 },
      { x: W * 0.74, y: H * 0.86, r: r * 0.7, rot: 1.2 },
      { x: W * 0.55, y: H * 0.12, r: r * 0.55, rot: 5.2 },
    ];
    if (!fish.length) fish = Array.from({ length: W < 600 ? 5 : 7 }, (_, i) => makeFish(i));
    fish.forEach((f) => {
      f.head.x = Math.min(Math.max(f.head.x, EDGE), W - EDGE);
      f.head.y = Math.min(Math.max(f.head.y, EDGE), H - EDGE);
    });
  };

  const steer = (f: Koi, dt: number) => {
    f.wander += rand(-1, 1) * 1.8 * dt;
    f.wander *= 0.98;
    let target = f.angle + f.wander * 0.6;

    /* Edges: turn back toward the middle, harder the closer the wall */
    const { x, y } = f.head;
    const near = Math.min(x, W - x, y, H - y);
    if (near < EDGE * 1.6) {
      const home = Math.atan2(H / 2 - y, W / 2 - x);
      const w = 1 - near / (EDGE * 1.6);
      target = f.angle + wrapAngle(home - f.angle) * (0.4 + w);
    }

    /* Food: the nearest pellet within reach wins over wandering */
    let best: Food | null = null;
    let bestD = FOOD_RADIUS;
    for (const p of food) {
      const d = Math.hypot(p.x - x, p.y - y);
      if (d < bestD) (best = p), (bestD = d);
    }
    if (best) {
      target = Math.atan2(best.y - y, best.x - x);
      if (bestD < f.size * 0.25) {
        food.splice(food.indexOf(best), 1);
        rings.push({ x: best.x, y: best.y, r: 4, life: 0.6 });
      }
    }

    /* Pointer: a fast or pressing pointer nearby sends fish the other way */
    if (pointer.on) {
      const d = Math.hypot(pointer.x - x, pointer.y - y);
      const fast = Math.hypot(pointer.vx, pointer.vy) > SCARE_SPEED;
      if (d < SCARE_RADIUS && (fast || d < f.size * 0.45)) {
        target = Math.atan2(y - pointer.y, x - pointer.x);
        f.burst = Math.max(f.burst, 2.4 * (1 - d / SCARE_RADIUS) + 0.6);
      }
    }

    /* Personal space */
    for (const o of fish) {
      if (o === f) continue;
      const d = Math.hypot(o.head.x - x, o.head.y - y);
      if (d < f.size * 0.6) target += wrapAngle(Math.atan2(y - o.head.y, x - o.head.x) - target) * 0.3;
    }

    const turn = TURN * (1 + f.burst) * dt;
    f.angle += Math.max(-turn, Math.min(turn, wrapAngle(target - f.angle)));
    f.burst = Math.max(0, f.burst - dt * 1.4);
    const goal = f.base * (1 + f.burst * 2.2) * (best ? 1.5 : 1) * pace;
    f.speed += (goal - f.speed) * Math.min(1, dt * 3);
    f.head.x += Math.cos(f.angle) * f.speed * dt;
    f.head.y += Math.sin(f.angle) * f.speed * dt;
    f.phase += dt * (3 + f.speed * 0.09);

    /* Spine trails the head at a fixed segment length */
    const seg = f.size / (SEGMENTS - 1);
    f.spine[0] = { ...f.head };
    for (let s = 1; s < SEGMENTS; s++) {
      const a = f.spine[s - 1];
      const b = f.spine[s];
      const ang = Math.atan2(b.y - a.y, b.x - a.x);
      f.spine[s] = { x: a.x + Math.cos(ang) * seg, y: a.y + Math.sin(ang) * seg };
    }
  };

  /** Spine plus a travelling sideways wave, strongest at the tail */
  const bodyPoints = (f: Koi) =>
    f.spine.map((p, s) => {
      const next = f.spine[Math.min(s + 1, SEGMENTS - 1)];
      const prev = f.spine[Math.max(s - 1, 0)];
      const ang = Math.atan2(prev.y - next.y, prev.x - next.x);
      const wag = Math.sin(f.phase - s * 0.55) * f.size * 0.05 * (s / SEGMENTS);
      return { x: p.x - Math.sin(ang) * wag, y: p.y + Math.cos(ang) * wag, ang };
    });

  const drawFish = (f: Koi, shadow: boolean) => {
    const pts = bodyPoints(f);
    const off = shadow ? { x: 7, y: 10 } : { x: 0, y: 0 };
    const left: Point[] = [];
    const right: Point[] = [];
    pts.forEach((p, s) => {
      const w = PROFILE[s] * f.size;
      left.push({ x: p.x - Math.sin(p.ang) * w + off.x, y: p.y + Math.cos(p.ang) * w + off.y });
      right.push({ x: p.x + Math.sin(p.ang) * w + off.x, y: p.y - Math.cos(p.ang) * w + off.y });
    });
    const fill = shadow ? "rgba(0,0,0,0.28)" : f.body;

    /* Pectoral fins */
    const fin = pts[2];
    for (const side of [-1, 1]) {
      ctx.save();
      ctx.translate(fin.x + off.x, fin.y + off.y);
      ctx.rotate(fin.ang + side * (2.3 + Math.sin(f.phase * 1.3) * 0.25));
      ctx.beginPath();
      ctx.ellipse(f.size * 0.12, 0, f.size * 0.13, f.size * 0.05, 0, 0, Math.PI * 2);
      ctx.fillStyle = shadow ? fill : "rgba(246,239,228,0.55)";
      ctx.fill();
      ctx.restore();
    }

    /* Tail fan */
    const tail = pts[SEGMENTS - 1];
    const tailAng = tail.ang + Math.PI + Math.sin(f.phase - 6) * 0.35;
    ctx.beginPath();
    ctx.moveTo(tail.x + off.x, tail.y + off.y);
    for (const spread of [-0.55, 0.55]) {
      ctx.quadraticCurveTo(
        tail.x + Math.cos(tailAng + spread * 0.5) * f.size * 0.16 + off.x,
        tail.y + Math.sin(tailAng + spread * 0.5) * f.size * 0.16 + off.y,
        tail.x + Math.cos(tailAng + spread) * f.size * 0.22 + off.x,
        tail.y + Math.sin(tailAng + spread) * f.size * 0.22 + off.y,
      );
      ctx.lineTo(tail.x + off.x, tail.y + off.y);
    }
    ctx.fillStyle = shadow ? fill : f.body;
    ctx.globalAlpha = shadow ? 1 : 0.8;
    ctx.fill();
    ctx.globalAlpha = 1;

    /* Body */
    ctx.beginPath();
    ctx.moveTo(left[0].x, left[0].y);
    for (let s = 1; s < SEGMENTS; s++) ctx.lineTo(left[s].x, left[s].y);
    for (let s = SEGMENTS - 1; s >= 0; s--) ctx.lineTo(right[s].x, right[s].y);
    const nose = { x: pts[0].x + Math.cos(pts[0].ang) * f.size * 0.08 + off.x, y: pts[0].y + Math.sin(pts[0].ang) * f.size * 0.08 + off.y };
    ctx.quadraticCurveTo(nose.x, nose.y, left[0].x, left[0].y);
    ctx.fillStyle = fill;
    ctx.fill();
    if (shadow) return;

    /* Markings and eyes */
    ctx.fillStyle = f.spot;
    f.spots.forEach((s, k) => {
      const p = pts[s];
      ctx.beginPath();
      ctx.ellipse(p.x, p.y, PROFILE[s] * f.size * (0.9 - k * 0.15), PROFILE[s] * f.size * 0.6, p.ang, 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.fillStyle = "#111";
    for (const side of [-1, 1]) {
      const p = pts[0];
      ctx.beginPath();
      ctx.arc(p.x + Math.cos(p.ang) * f.size * 0.04 - Math.sin(p.ang) * side * f.size * 0.06, p.y + Math.sin(p.ang) * f.size * 0.04 + Math.cos(p.ang) * side * f.size * 0.06, Math.max(1.4, f.size * 0.014), 0, Math.PI * 2);
      ctx.fill();
    }
  };

  const drawPad = (p: (typeof pads)[number]) => {
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(p.rot);
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.arc(0, 0, p.r, 0.25, Math.PI * 2 - 0.05);
    ctx.closePath();
    ctx.fillStyle = "rgba(0,0,0,0.25)";
    ctx.translate(5, 8);
    ctx.fill();
    ctx.translate(-5, -8);
    ctx.fillStyle = "#24442f";
    ctx.fill();
    ctx.strokeStyle = "rgba(160,200,150,0.18)";
    ctx.lineWidth = 1;
    for (let k = 0; k < 6; k++) {
      ctx.beginPath();
      ctx.moveTo(0, 0);
      const a = 0.6 + k * 0.95;
      ctx.lineTo(Math.cos(a) * p.r * 0.85, Math.sin(a) * p.r * 0.85);
      ctx.stroke();
    }
    ctx.restore();
  };

  const frame = (t: number) => {
    raf = 0;
    const dt = Math.min(0.05, (t - last) / 1000 || 0.016);
    last = t;
    pointer.vx *= 0.85;
    pointer.vy *= 0.85;

    ctx.fillStyle = water!;
    ctx.fillRect(0, 0, W, H);

    /* Slow light on the water */
    const g = t / 6000;
    for (let k = 0; k < 3; k++) {
      const cx = W * (0.3 + 0.4 * Math.sin(g + k * 2.1));
      const cy = H * (0.4 + 0.3 * Math.cos(g * 0.8 + k));
      const glow = ctx.createRadialGradient(cx, cy, 0, cx, cy, Math.max(W, H) * 0.25);
      glow.addColorStop(0, "rgba(120,190,180,0.05)");
      glow.addColorStop(1, "rgba(120,190,180,0)");
      ctx.fillStyle = glow;
      ctx.fillRect(0, 0, W, H);
    }

    fish.forEach((f) => steer(f, dt));
    fish.forEach((f) => drawFish(f, true));
    fish.forEach((f) => drawFish(f, false));

    ctx.fillStyle = "#e9d7a8";
    for (let k = food.length - 1; k >= 0; k--) {
      const p = food[k];
      p.life -= dt / 14;
      if (p.life <= 0) {
        food.splice(k, 1);
        continue;
      }
      ctx.globalAlpha = Math.min(1, p.life * 4);
      ctx.beginPath();
      ctx.arc(p.x, p.y + Math.sin(t / 400 + k) * 0.8, 3, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    pads.forEach(drawPad);

    for (let k = rings.length - 1; k >= 0; k--) {
      const r = rings[k];
      r.life -= dt;
      r.r += dt * 70;
      if (r.life <= 0) {
        rings.splice(k, 1);
        continue;
      }
      ctx.strokeStyle = `rgba(220,240,235,${r.life * 0.45})`;
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.arc(r.x, r.y, r.r, 0, Math.PI * 2);
      ctx.stroke();
    }

    if (visible && !document.hidden) raf = requestAnimationFrame(frame);
  };

  const start = () => {
    if (!raf && visible && !document.hidden) {
      last = performance.now();
      raf = requestAnimationFrame(frame);
    }
  };

  const local = (e: PointerEvent) => {
    const rect = canvas.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

  canvas.addEventListener("pointermove", (e) => {
    const p = local(e);
    const now = performance.now();
    const dt = Math.max(1, now - pointer.t);
    pointer.vx = (p.x - pointer.x) / dt;
    pointer.vy = (p.y - pointer.y) / dt;
    Object.assign(pointer, p, { on: true, t: now });
  });
  canvas.addEventListener("pointerleave", () => (pointer.on = false));
  canvas.addEventListener("pointerdown", (e) => {
    const p = local(e);
    Object.assign(pointer, p, { on: true, t: performance.now() });
    rings.push({ ...p, r: 6, life: 1 }, { ...p, r: 2, life: 0.7 });
    const touched = fish.some((f) => Math.hypot(f.head.x - p.x, f.head.y - p.y) < f.size * 0.6);
    if (touched) {
      fish.forEach((f) => {
        const d = Math.hypot(f.head.x - p.x, f.head.y - p.y);
        if (d < SCARE_RADIUS * 1.4) {
          f.angle = Math.atan2(f.head.y - p.y, f.head.x - p.x);
          f.burst = 3;
        }
      });
    } else {
      food.push({ ...p, life: 1 });
      if (food.length > MAX_FOOD) food.shift();
    }
    start();
  });

  new IntersectionObserver(([e]) => {
    visible = e.isIntersecting;
    start();
  }).observe(host);
  document.addEventListener("visibilitychange", start);
  new ResizeObserver(() => {
    resize();
    if (!raf) frame(performance.now());
  }).observe(host);
}
