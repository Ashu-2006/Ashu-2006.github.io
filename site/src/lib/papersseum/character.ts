/**
 * Papersseum's pixel bot characters, ported from web/lib/character (genome.ts, parts.ts, compose.ts) without
 * changes to the art or the seeding, so a bot drawn here matches the one on papersseum.vercel.app. A genome picks one
 * of 6 heads, 6 eyes, 5 antennas, 4 mouths, 4 patterns and 5 signature colours: 14,400 bots from a name.
 */

export type BotGenome = { head: number; eyes: number; antenna: number; mouth: number; pattern: number; signature: number };
export type GenomePart = keyof BotGenome;
export type Cell = { x: number; y: number; part: "body" | "eye" | "antenna" | "mouth" | "accent" };
export type CharacterState = "idle" | "working" | "win" | "dead" | "still";

export const PART_COUNTS: Record<GenomePart, number> = { head: 6, eyes: 6, antenna: 5, mouth: 4, pattern: 4, signature: 5 };
export const PART_NAMES: Record<GenomePart, readonly string[]> = {
  head: ["square", "round", "tall", "wide", "notched", "dome"],
  eyes: ["dots", "visor", "cyclops", "wide", "sleepy", "chevron"],
  antenna: ["none", "stalk", "twin", "dish", "spike"],
  mouth: ["none", "line", "grille", "grin"],
  pattern: ["solid", "stripe", "checker", "plus"],
  signature: ["red", "blue", "green", "yellow", "purple"],
};
export const PARTS: readonly GenomePart[] = ["head", "eyes", "antenna", "mouth", "pattern", "signature"];
export const COMBINATIONS = PARTS.reduce((n, p) => n * PART_COUNTS[p], 1);

/** Slot colours, identical to PLAYER_COLORS in papersseum/render.py */
export const PLAYER_COLORS = ["#ff4d5e", "#4d9dff", "#35e07f", "#ffd23f", "#b36bff"] as const;

function fnv1a(seed: string) {
  let h = 0x811c9dc5;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}

function mulberry32(a: number) {
  let s = a >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function genomeFromSeed(seed: string): BotGenome {
  const rng = mulberry32(fnv1a(seed));
  const draw = (count: number) => Math.floor(rng() * count);
  return {
    head: draw(PART_COUNTS.head),
    eyes: draw(PART_COUNTS.eyes),
    antenna: draw(PART_COUNTS.antenna),
    mouth: draw(PART_COUNTS.mouth),
    pattern: draw(PART_COUNTS.pattern),
    signature: draw(PART_COUNTS.signature),
  };
}

/* --------------------------------------------------------------- the art */

type Point = readonly [x: number, y: number];
type HeadPart = { cells: readonly Point[]; eyeY: number; mouthY: number; bandY: number };
type PatternPart = (x: number, y: number, head: HeadPart) => boolean;

const GRID = 12;
const HALF = GRID / 2;
const HEAD_TOP = 3;

/** Half a part, drawn as rows of "#" and "."; compose mirrors it across the centre line */
function art(rows: readonly string[], top: number): Point[] {
  const cells: Point[] = [];
  rows.forEach((row, dy) => {
    for (let x = 0; x < HALF; x++) if (row[x] === "#") cells.push([x, top + dy]);
  });
  return cells;
}
const head = (rows: readonly string[], eyeY: number, mouthY: number, bandY: number): HeadPart => ({ cells: art(rows, HEAD_TOP), eyeY, mouthY, bandY });

const HEADS: readonly HeadPart[] = [
  head([".#####", ".#####", ".#####", "######", "######", ".#####", ".#####", ".#####", "...###"], 5, 8, 10),
  head(["...###", "..####", ".#####", "######", "######", "######", ".#####", "..####", "...###"], 5, 8, 10),
  head(["...###", "..####", "..####", "..####", "..####", "..####", "..####", "..####", "...###"], 5, 8, 10),
  head([".#####", "######", "######", "######", "######", "######", ".#####", "..##..", "..##.."], 4, 7, 9),
  head([".#####", "######", "######", "######", "..####", ".#####", ".#####", ".#####", "......"], 5, 8, 10),
  head(["...###", "..####", ".#####", "######", "######", "######", "######", "######", "######"], 6, 9, 11),
];
const EYES: readonly (readonly Point[])[] = [
  art(["...#.."], 0),
  art(["...###"], 0),
  art([".....#", ".....#"], 0),
  art(["...##.", "...##."], 0),
  art(["......", "...##."], 0),
  art(["...#.#", "....#."], 0),
];
const ANTENNAS: readonly (readonly Point[])[] = [
  [],
  art(["....##", ".....#", ".....#"], 0),
  art(["..#...", "..#...", "...#.."], 0),
  art(["......", "..####", ".....#"], 0),
  art([".....#", "....##", "...###"], 0),
];
const MOUTHS: readonly (readonly Point[])[] = [[], art(["....##"], 0), art(["...#.#", "...#.#"], 0), art(["...#..", "....##"], 0)];
const CENTRE = HALF - 1;
const PATTERNS: readonly PatternPart[] = [
  (x, y) => x === CENTRE && y === HEAD_TOP,
  (_x, y, h) => y === h.bandY,
  (x, y, h) => y < h.eyeY && ((x >> 1) + y - HEAD_TOP) % 2 === 0,
  (x, y, h) => (x === CENTRE && y < h.eyeY) || y === h.bandY,
];

function mirror(points: readonly Point[], dy: number, part: Cell["part"]): Cell[] {
  return points.flatMap(([x, y]) => [
    { x, y: y + dy, part },
    { x: GRID - 1 - x, y: y + dy, part },
  ]);
}

export function compose(g: BotGenome): Cell[] {
  const h = HEADS[g.head];
  const pattern = PATTERNS[g.pattern];
  const base: Cell[] = [];
  for (const [x, y] of h.cells) {
    const part = pattern(x, y, h) ? "accent" : "body";
    base.push({ x, y, part }, { x: GRID - 1 - x, y, part });
  }
  return [...base, ...mirror(ANTENNAS[g.antenna], 0, "antenna"), ...mirror(MOUTHS[g.mouth], h.mouthY, "mouth"), ...mirror(EYES[g.eyes], h.eyeY, "eye")];
}

const rect = (c: Cell) => `<rect x="${c.x}" y="${c.y}" width="1" height="1" class="bot__${c.part}" data-i="${c.y * GRID + c.x}"/>`;

/**
 * The character as an SVG string, in the source's layer order (base, antenna, mouth, gaze > lids > eyes) so the
 * ported motion can move the same groups. Accent cells take the signature colour unless an accent is given.
 */
export function characterSvg(g: BotGenome, o: { size?: number; state?: CharacterState; label?: string; accent?: string; cls?: string; seed?: string } = {}) {
  const cells = compose(g);
  const of = (...parts: Cell["part"][]) => cells.filter((c) => parts.includes(c.part)).map(rect).join("");
  const accent = o.accent ?? PLAYER_COLORS[g.signature];
  const size = o.size ? ` width="${o.size}" height="${o.size}"` : "";
  const a11y = o.label ? `role="img" aria-label="${o.label.replace(/"/g, "&quot;")}"` : `aria-hidden="true"`;
  return `<svg class="bot${o.cls ? ` ${o.cls}` : ""}" viewBox="0 0 12 12"${size} shape-rendering="crispEdges" ${a11y} data-state="${o.state ?? "idle"}"${o.seed ? ` data-seed="${o.seed.replace(/"/g, "")}"` : ""} style="--bot-accent: ${accent}"><g data-layer="figure"><g data-layer="base">${of("body", "accent")}</g><g data-layer="antenna">${of("antenna")}</g><g data-layer="mouth">${of("mouth")}</g><g data-layer="gaze"><g data-layer="lids">${of("eye")}</g></g></g></svg>`;
}
