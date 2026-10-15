import { gsap, reducedMotion } from "../core/motion";

/** Progress at which the polygon reaches 12 sides, and the range over which it then becomes a circle */
const POLY_END = 0.62;
const CIRCLE_FROM = 0.58;
const LERP = 0.2;
const SETTLE = 0.0005;

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const smooth = (t: number) => t * t * (3 - 2 * t);

export type PolygonState = { sides: number; circle: number };

type Pt = [number, number];

/**
 * Vertices of a polygon with a fractional side count. Between N and N+1 sides, a regular N-gon gets a
 * midpoint inserted on its bottom edge and every vertex lerps toward the regular (N+1)-gon, so the
 * count rises continuously. Angles are measured so a side lies flat at the bottom at rotation 0.
 */
function vertices(nf: number, R: number): Pt[] {
  const N = Math.floor(nf);
  const f = nf - N;
  const reg = (n: number, i: number): Pt => {
    const ang = Math.PI / 2 + Math.PI / n + (i * 2 * Math.PI) / n;
    return [Math.cos(ang) * R, Math.sin(ang) * R];
  };
  if (f < 1e-4) return Array.from({ length: N }, (_, i) => reg(N, i));
  const from: Pt[] = Array.from({ length: N }, (_, i) => reg(N, i));
  const a = from[N - 1];
  const b = from[0];
  from.push([(a[0] + b[0]) / 2, (a[1] + b[1]) / 2]);
  return from.map((p, i) => {
    const q = reg(N + 1, i);
    return [lerp(p[0], q[0], f), lerp(p[1], q[1], f)];
  });
}

/**
 * The rolling polygon (neutomni's process canvas). A polygon rolls without slipping along a road of
 * inverted catenary arches, the one road on which a regular polygon's axle stays level: the road under
 * the axle is y = a cosh(x / a) for apothem a, and the wheel's rotation inside an arch is
 * atan(sinh(x / a)). With progress the side count rises from 4 to 12, then the wheel rounds into a
 * circle while the arches flatten into a line. Progress is lerped toward its target at 0.2 a frame and
 * the ticker stops once it settles.
 */
export function rollingPolygon(canvas: HTMLCanvasElement, onState?: (s: PolygonState) => void) {
  const ctx = canvas.getContext("2d");
  let W = 0;
  let H = 0;
  let current = 0;
  let target = 0;
  let ticking = false;
  const style = getComputedStyle(canvas);
  const ink = style.getPropertyValue("--ink").trim() || "black";
  const faint = style.getPropertyValue("--faint").trim() || "gray";
  const accent = style.getPropertyValue("--cobalt").trim() || "blue";

  const resize = () => {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const r = canvas.getBoundingClientRect();
    W = r.width;
    H = r.height;
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    ctx?.setTransform(dpr, 0, 0, dpr, 0, 0);
    draw(current);
  };

  function draw(p: number) {
    if (!ctx || !W || !H) return;
    const nf = 4 + 8 * smooth(clamp01(p / POLY_END));
    const circ = smooth(clamp01((p - CIRCLE_FROM) / (1 - CIRCLE_FROM)));
    const R = Math.min(W * 0.13, H * 0.22);
    const a = R * Math.cos(Math.PI / nf);
    const L = a * Math.asinh(Math.tan(Math.PI / nf));
    const axleY = H * 0.5;
    const margin = R * 1.25;
    const X0 = margin;
    const X = lerp(X0, W - margin, p);
    const wrap = (x: number) => {
      const t = (x - X0 + L) % (2 * L);
      return (t < 0 ? t + 2 * L : t) - L;
    };

    const k = Math.floor((X - X0 + L) / (2 * L));
    const local = X - X0 - k * 2 * L;
    const rollPoly = (k * 2 * Math.PI) / nf + Math.atan(Math.sinh(local / a));
    const theta = lerp(rollPoly, (X - X0) / R, circ);

    ctx.clearRect(0, 0, W, H);
    ctx.lineJoin = "round";
    ctx.lineCap = "round";

    /* Axle path */
    ctx.setLineDash([5, 10]);
    ctx.lineWidth = 1;
    ctx.strokeStyle = faint;
    ctx.beginPath();
    ctx.moveTo(0, axleY);
    ctx.lineTo(W, axleY);
    ctx.stroke();
    ctx.setLineDash([]);

    /* Road */
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = ink;
    ctx.beginPath();
    for (let x = 0; x <= W; x += 2) {
      const xl = wrap(x);
      const depth = lerp(a * Math.cosh(xl / a), R, circ);
      if (x === 0) ctx.moveTo(x, axleY + depth);
      else ctx.lineTo(x, axleY + depth);
    }
    ctx.stroke();

    /* Wheel: sampled along each edge so it can round off into the circle */
    const vs = vertices(nf, R);
    const cos = Math.cos(theta);
    const sin = Math.sin(theta);
    const put = (px: number, py: number): Pt => {
      const len = Math.hypot(px, py) || 1;
      const rx = lerp(px, (px / len) * R, circ);
      const ry = lerp(py, (py / len) * R, circ);
      return [X + rx * cos - ry * sin, axleY + rx * sin + ry * cos];
    };
    ctx.beginPath();
    const steps = 12;
    vs.forEach((v, i) => {
      const w = vs[(i + 1) % vs.length];
      for (let s = 0; s < steps; s++) {
        const t = s / steps;
        const [x, y] = put(lerp(v[0], w[0], t), lerp(v[1], w[1], t));
        if (i === 0 && s === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
    });
    ctx.closePath();
    ctx.stroke();

    /* Spoke to the first vertex, so the roll reads, and the hub */
    const [sx, sy] = put(vs[0][0], vs[0][1]);
    ctx.beginPath();
    ctx.moveTo(X, axleY);
    ctx.lineTo(sx, sy);
    ctx.stroke();
    ctx.fillStyle = ink;
    ctx.beginPath();
    ctx.arc(X, axleY, 3, 0, Math.PI * 2);
    ctx.fill();

    /* Contact point: always directly under the axle when rolling without slipping */
    const contact = lerp(a * Math.cosh(wrap(X) / a), R, circ);
    ctx.fillStyle = accent;
    ctx.beginPath();
    ctx.arc(X, axleY + contact, 4, 0, Math.PI * 2);
    ctx.fill();

    onState?.({ sides: nf, circle: circ });
  }

  const tick = () => {
    const delta = target - current;
    if (Math.abs(delta) < SETTLE) {
      current = target;
      draw(current);
      gsap.ticker.remove(tick);
      ticking = false;
      return;
    }
    current += delta * LERP;
    draw(current);
  };

  const ro = new ResizeObserver(resize);
  ro.observe(canvas);
  resize();

  return {
    /** Sets the scroll progress (0 to 1) the drawing eases toward */
    setTarget(p: number) {
      target = clamp01(p);
      if (reducedMotion()) {
        current = target;
        draw(current);
        return;
      }
      if (!ticking) {
        ticking = true;
        gsap.ticker.add(tick);
      }
    },
    destroy() {
      ro.disconnect();
      gsap.ticker.remove(tick);
      ticking = false;
    },
  };
}
