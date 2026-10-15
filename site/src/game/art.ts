/**
 * Night Drive pixel art, ported from retro/. Every sprite is drawn here from run-length rows or a small
 * procedure, pixel by pixel, so it stays crisp at 1:1 and pixelates honestly when the road scales it.
 * The 70s palette is the game's own; the night sky and the stage banners borrow the ASH/OS cobalt,
 * read from the tokens so the two never drift.
 */

export type RGB = [number, number, number];

export const PAL = {
  chocolate: "#2a1a12",
  chocolate2: "#3b271c",
  chocolate3: "#4d3426",
  bone: "#f1e2c0",
  bone2: "#e6d3ab",
  bone3: "#d6bf92",
  harvest: "#e4a62c",
  rust: "#d25f27",
  poppy: "#bf3426",
  avocado: "#5f6829",
  avocado2: "#4f5722",
  walnut: "#6b3f22",
  ink: "#140c08",
  amber: "#ffb03a",
};

/** Reads a colour token from tokens.css, falling back to its current value if the sheet is missing */
export function token(name: string, fallback: string) {
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return /^#[0-9a-f]{6}$/i.test(v) ? v : fallback;
}

export const rgb = (hex: string): RGB => {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};
export const css = (c: RGB) => `rgb(${c[0] | 0},${c[1] | 0},${c[2] | 0})`;
export const mix = (a: RGB, b: RGB, t: number): RGB => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
export const mul = (a: RGB, m: RGB): RGB => [a[0] * m[0], a[1] * m[1], a[2] * m[2]];

/** Light over a run: late afternoon, sunset, dusk, then a cobalt night. Sprites are pre-tinted at each level. */
export const LEVELS = 6;
const LIGHT: RGB[] = [
  [1, 1, 1],
  [1, 0.9, 0.8],
  [0.88, 0.72, 0.62],
  [0.6, 0.5, 0.54],
  [0.4, 0.4, 0.58],
  [0.3, 0.32, 0.56],
];
export function light(tod: number): RGB {
  const f = Math.min(LEVELS - 1, Math.max(0, tod * (LEVELS - 1)));
  const i = Math.min(LEVELS - 2, Math.floor(f));
  return mix(LIGHT[i], LIGHT[i + 1], f - i);
}

export const canvas = (w: number, h: number) => {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  return c;
};

/** "17.11H2S" -> 17 dots, 11 H, 2 S */
const rle = (s: string) => s.replace(/(\d*)(\D)/g, (_m, n: string, ch: string) => ch.repeat(n ? Number(n) : 1));

/** Paints character rows with a palette. Keys listed in `glow` are lamps: they keep their colour at night. */
function paint(rows: string[], pal: Record<string, string>, level: number, glow = "") {
  const h = rows.length;
  const w = Math.max(...rows.map((r) => r.length));
  const c = canvas(w, h);
  const ctx = c.getContext("2d")!;
  const img = ctx.createImageData(w, h);
  const tint = LIGHT[level];
  const cache = new Map<string, RGB>();
  for (let y = 0; y < h; y++) {
    const row = rows[y];
    for (let x = 0; x < row.length; x++) {
      const ch = row[x];
      const hex = pal[ch];
      if (!hex) continue;
      let col = cache.get(ch);
      if (!col) {
        col = glow.includes(ch) ? rgb(hex) : mul(rgb(hex), tint);
        cache.set(ch, col);
      }
      const i = (y * w + x) * 4;
      img.data[i] = col[0];
      img.data[i + 1] = col[1];
      img.data[i + 2] = col[2];
      img.data[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  return c;
}

/* ---------- cars, seen from behind (left halves, mirrored) ---------- */

const COUPE_TOP = [
  "17.11H2S2H",
  "16.b11B2S2B",
  "15.bB2G2g11G",
  "14.bB2G2g12G",
  "13.bB2G2g13G",
  "12.bB2G2g14G",
  "11.bB19G",
  "10.bB20G",
  "9.b18B2S2B",
  "3.25H2S2H",
  "2.b25B2S2B",
  ".b26B2S2B",
  "b27B2s2B",
  "d31b",
];

const SEDAN_TOP = [
  "9.23H",
  "8.b23B",
  "8.bB2G2g18G",
  "8.bBG2g19G",
  "8.bB2g20G",
  "8.bB22G",
  "8.bB22G",
  "8.b23B",
  "4.b27B",
  "3.29H",
  "2.b29B",
  ".b30B",
  "b31B",
  "d31b",
];

const CAR_LOW = [
  "Bc13Cc16B",
  "Bc4Tc3Tc4Tc16B",
  "Bc4Tc3Tc4Tc9B7c",
  "Bc4tc3tc4tc9Bc2Pp3P",
  "bc13Cc9bcPpPPpP",
  "d24bc6P",
  "c31W",
  "c31C",
  "d31c",
  ".6d2X23d",
  "2.Kk6KkK20D",
  "2.Kk6KkK20.",
  "2.10K20.",
  "3.8K21.",
];

export const CAR_W = 68;
export const CAR_H = 28;

/** Full 68-wide rows for a car leaning `lean` px (negative steers left: the cabin leads, the right flank shows). */
function carRows(top: string[], lean: number, stripes: boolean) {
  const half = [...top, ...CAR_LOW].map(rle).map((r) => (stripes ? r : r.replace(/S/g, "B").replace(/s/g, "b")));
  return half.map((left, y) => {
    const right = [...left].reverse().join("").replace(/g/g, "G");
    const full = left + right;
    const shift = y <= 8 ? lean : y <= 13 ? Math.trunc(lean / 2) : 0;
    const cells = Array.from({ length: CAR_W }, () => ".");
    for (let x = 0; x < full.length; x++) if (full[x] !== ".") cells[x + 2 + shift] = full[x];
    if (lean !== 0 && y >= 9 && y <= 22) {
      let edge = -1;
      if (lean > 0) edge = cells.findIndex((c) => c !== ".");
      else for (let i = CAR_W - 1; i >= 0 && edge < 0; i--) if (cells[i] !== ".") edge = i;
      for (let k = 1; k <= Math.abs(lean); k++) {
        const at = lean < 0 ? edge + k : edge - k;
        if (at >= 0 && at < CAR_W) cells[at] = "d";
      }
    }
    return cells.join("");
  });
}

type Body = { H: string; B: string; b: string; d: string };

const BODIES: Record<string, Body> = {
  rust: { H: "#ea8a4c", B: PAL.rust, b: "#a8481c", d: "#7a3414" },
  harvest: { H: "#f2c260", B: PAL.harvest, b: "#b9831f", d: "#7f5913" },
  avocado: { H: "#86913f", B: "#6b7431", b: PAL.avocado2, d: "#363c17" },
  bone: { H: PAL.bone, B: PAL.bone2, b: PAL.bone3, d: "#a8926a" },
  walnut: { H: "#8c5631", B: PAL.walnut, b: PAL.chocolate3, d: PAL.chocolate2 },
  poppy: { H: "#d9563c", B: PAL.poppy, b: "#93261a", d: "#651a11" },
};

function carPal(body: Body, brake: boolean): Record<string, string> {
  return {
    ...body,
    S: PAL.bone,
    s: PAL.bone3,
    G: "#1c120c",
    g: "#5e4534",
    W: PAL.bone,
    C: "#b9a584",
    c: "#6a5443",
    T: brake ? "#ff7a45" : PAL.poppy,
    t: brake ? "#ef4a2c" : "#8e2418",
    P: PAL.harvest,
    p: PAL.chocolate,
    K: PAL.ink,
    k: PAL.chocolate2,
    X: PAL.chocolate3,
    D: "#0f0905",
  };
}

export type Frames = HTMLCanvasElement[][];

/** The player's rust coupe with bone racing stripes: [level][lean index 0..4 + 5 * brake] */
export function playerFrames(): Frames {
  const out: Frames = [];
  for (let level = 0; level < LEVELS; level++) {
    const row: HTMLCanvasElement[] = [];
    for (const brake of [false, true])
      for (const lean of [-2, -1, 0, 1, 2]) row.push(paint(carRows(COUPE_TOP, lean, true), carPal(BODIES.rust, brake), level, level > 1 || brake ? "Tt" : ""));
    out.push(row);
  }
  return out;
}

/** Slower traffic: two body shapes in five colours: [level][look] */
export const TRAFFIC_LOOKS = 10;
export function trafficFrames(): Frames {
  const colours = [BODIES.harvest, BODIES.avocado, BODIES.bone, BODIES.walnut, BODIES.poppy];
  const out: Frames = [];
  for (let level = 0; level < LEVELS; level++) {
    const row: HTMLCanvasElement[] = [];
    for (const top of [SEDAN_TOP, COUPE_TOP])
      for (const body of colours) row.push(paint(carRows(top, 0, false), carPal(body, false), level, level > 1 ? "Tt" : ""));
    out.push(row);
  }
  return out;
}

/* ---------- roadside ---------- */

const hash = (x: number, y: number, s: number) => {
  const n = Math.sin(x * 127.1 + y * 311.7 + s * 74.7) * 43758.5453;
  return n - Math.floor(n);
};

const LEAF = { L: "#8a9440", M: PAL.avocado, N: PAL.avocado2, O: "#343a17", w: PAL.walnut, x: PAL.chocolate3 };

/** A Lombardy poplar: a tall flame of leaves, lit from the left, ragged at the edge */
function poplarRows(seed: number) {
  const w = 18 + (seed % 3) * 2;
  const canopy = 50 + (seed % 4) * 4;
  const trunk = 7;
  const cx = w / 2;
  const rows: string[] = [];
  for (let y = 0; y < canopy + trunk; y++) {
    let row = "";
    for (let x = 0; x < w; x++) {
      const dx = x + 0.5 - cx;
      if (y >= canopy - 2) {
        row += Math.abs(dx) < 1.2 ? (dx < 0 ? "w" : "x") : ".";
        continue;
      }
      const t = y / canopy;
      const half = (w / 2 - 0.5) * Math.pow(Math.sin(Math.PI * Math.min(1, Math.pow(t, 0.72) * 1.02)), 0.9) + Math.sin(y * 0.9 + seed) * 0.45;
      if (Math.abs(dx) > half || (Math.abs(dx) > half - 1.2 && hash(x, y, seed) < 0.45)) {
        row += ".";
        continue;
      }
      const s = dx / Math.max(half, 1) + (hash(x >> 1, y >> 1, seed) - 0.5) * 1.1 + Math.sin(y * 0.55 + seed) * 0.2;
      row += s < -0.5 ? "L" : s < 0.12 ? "M" : s < 0.62 ? "N" : "O";
    }
    rows.push(row);
  }
  return rows;
}

function bushRows(seed: number) {
  const w = 22 + (seed % 2) * 6;
  const h = 11 + (seed % 2) * 2;
  const rows: string[] = [];
  for (let y = 0; y < h; y++) {
    let row = "";
    for (let x = 0; x < w; x++) {
      const nx = (x + 0.5 - w / 2) / (w / 2);
      const ny = (y + 0.5 - h) / h;
      const d = nx * nx + ny * ny * 1.05 + (hash(x >> 1, y, seed) - 0.5) * 0.25;
      if (d > 1) {
        row += ".";
        continue;
      }
      const s = nx * 0.8 - ny * 0.4 + (hash(x, y >> 1, seed + 3) - 0.5) * 0.9;
      row += s < -0.45 ? "L" : s < 0.2 ? "M" : s < 0.65 ? "N" : "O";
    }
    rows.push(row);
  }
  return rows;
}

const POST = [".cc.", "cccc", "WRRb", "WRRb", "WWWb", ...Array.from({ length: 11 }, () => "WWWb"), "bbbx"];
const POST_PAL = { c: PAL.chocolate, W: PAL.bone, b: PAL.bone3, R: PAL.harvest, x: PAL.chocolate3 };

const CASSETTE = [".14K.", "K14bK", "Kb12HbK", "Kb12RbK", "Kb12PbK", "K2bKoK4bKoK2bK", "K2b3K4b3K2bK", "K14bK", "K3b8K3bK", ".14K."].map(rle);
const CASSETTE_PAL = { K: PAL.chocolate, b: PAL.bone, H: PAL.harvest, R: PAL.rust, P: PAL.poppy, o: PAL.chocolate3 };

export type Scenery = { poplar: Frames; bush: Frames; post: HTMLCanvasElement[]; cassette: HTMLCanvasElement[] };

export function sceneryFrames(): Scenery {
  const poplars = [0, 1, 2, 3].map(poplarRows);
  const bushes = [0, 1].map(bushRows);
  const s: Scenery = { poplar: [], bush: [], post: [], cassette: [] };
  for (let level = 0; level < LEVELS; level++) {
    s.poplar.push(poplars.map((r) => paint(r, LEAF, level)));
    s.bush.push(bushes.map((r) => paint(r, LEAF, level)));
    s.post.push(paint(POST, POST_PAL, level, level > 2 ? "R" : ""));
    s.cassette.push(paint(CASSETTE, CASSETTE_PAL, Math.min(level, 3)));
  }
  return s;
}

/* ---------- gantries over the road ---------- */

export const GANTRY_W = 312;
export const GANTRY_H = 92;

/**
 * Two poles and a banner edged in the harvest, rust and poppy stripe. The start banner is a chequer;
 * stage banners are cobalt with a pre-rendered pixel label, which stays lit at night.
 */
export function gantryFrames(label: HTMLCanvasElement | null): HTMLCanvasElement[] {
  const frames: HTMLCanvasElement[] = [];
  const banner = label ? token("--cobalt-deep", "#161bb0") : PAL.chocolate;
  for (let level = 0; level < LEVELS; level++) {
    const c = canvas(GANTRY_W, GANTRY_H);
    const g = c.getContext("2d")!;
    const t = LIGHT[level];
    const f = (hex: string) => css(mul(rgb(hex), t));
    g.fillStyle = f(PAL.walnut);
    g.fillRect(2, 0, 6, GANTRY_H);
    g.fillRect(GANTRY_W - 8, 0, 6, GANTRY_H);
    g.fillStyle = f(PAL.chocolate3);
    g.fillRect(6, 0, 2, GANTRY_H);
    g.fillRect(GANTRY_W - 4, 0, 2, GANTRY_H);
    g.fillStyle = label ? css(mix(rgb(banner), mul(rgb(banner), t), 0.5)) : f(banner);
    g.fillRect(0, 2, GANTRY_W, 38);
    const bands = [PAL.harvest, PAL.rust, PAL.poppy];
    bands.forEach((b, i) => {
      g.fillStyle = f(b);
      g.fillRect(2, 4 + i * 2, GANTRY_W - 4, 2);
      g.fillRect(2, 32 + (2 - i) * 2, GANTRY_W - 4, 2);
    });
    if (label) {
      g.imageSmoothingEnabled = false;
      g.drawImage(label, Math.round(GANTRY_W / 2 - label.width / 2), Math.round(21 - label.height / 2));
    } else {
      for (let x = 2; x < GANTRY_W - 2; x += 8)
        for (let y = 0; y < 2; y++) {
          g.fillStyle = f(((x / 8) | 0) % 2 === y ? PAL.bone : PAL.chocolate);
          g.fillRect(x, 13 + y * 8, 8, 8);
        }
    }
    frames.push(c);
  }
  return frames;
}

/** A 7x6 pixel heart for the lives counter; `full` false draws the empty outline */
export function heartIcon(full: boolean) {
  const rows = full
    ? [".PP.PP.", "PHHPPPP", "PHPPPPP", ".PPPPP.", "..PPP..", "...P..."]
    : [".KK.KK.", "K..K..K", "K.....K", ".K...K.", "..K.K..", "...K..."];
  return paint(rows, { P: PAL.poppy, H: "#f08a6c", K: PAL.bone3 }, 0);
}

/** The small cassette for the HUD counter */
export const cassetteIcon = () => paint(CASSETTE, CASSETTE_PAL, 0);
