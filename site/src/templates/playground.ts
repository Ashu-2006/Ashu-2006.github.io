import { LEDE, PLAY, PLAY_KINDS, type Play } from "../content";
import { esc, mediaInfo, mediaTag, pad2 } from "../lib/html";

type PlayKey = keyof typeof PLAY_KINDS;

/** Every play kind in use, with its count */
export const PLAY_FILTERS = (Object.keys(PLAY_KINDS) as PlayKey[])
  .map((k) => ({ key: k, label: PLAY_KINDS[k], count: PLAY.filter((p) => p.kind === k).length }))
  .filter((f) => f.count > 0);

/**
 * The mosaic grids (bybang). Everything is measured in grid units u = column + gap, so one layout holds
 * at every width: a tile spans `c` columns, sits `t` units from the top of its cycle and is `h` units
 * tall (its media is cropped by at most a few percent to land on the quarter unit). `f` is gap / u,
 * used to turn a media ratio into a height. Desktop is 16 columns, phones 6.
 */
export const GRIDS = {
  d: { cols: 16, f: 0.36, widths: { tall: [2, 2, 3], square: [2, 3, 3, 4], wide: [3, 3, 4, 4, 5] }, air: [0.9, 2], scatter: 3 },
  p: { cols: 6, f: 0.2, widths: { tall: [2, 3], square: [3, 3, 4], wide: [3, 4, 4] }, air: [0.35, 0.8], scatter: 1.2 },
} as const;
export type GridName = keyof typeof GRIDS;
export type Tile = { s: number; c: number; t: number; h: number };

/** mulberry32: a tiny seeded PRNG so the mosaic is identical on every render and build */
function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const ratioOf = (p: Play) => {
  const { w, h } = mediaInfo(p.file);
  return w / h;
};
const quarter = (v: number) => Math.round(v * 4) / 4;

/**
 * Lays one cycle of the mosaic. Each piece takes a seeded width for its shape, then the start column
 * whose skyline is lowest after a seeded nudge, so pieces scatter instead of packing. Placing a piece
 * raises the skyline under it and one column either side, which keeps air around every tile, and
 * the cycle height is the final skyline, so copies stacked end to end never collide.
 */
export function mosaic(pieces: { play: Play; index: number }[], name: GridName) {
  const G = GRIDS[name];
  const sky = new Array<number>(G.cols).fill(0);
  let prev = -10;
  const tiles: Tile[] = pieces.map(({ play, index }) => {
    const r = rng(index * 2654435761 + G.cols);
    const ratio = ratioOf(play);
    const set = ratio < 0.85 ? G.widths.tall : ratio < 1.25 ? G.widths.square : G.widths.wide;
    const c = set[Math.floor(r() * set.length)];
    let best = 0;
    let bestScore = Infinity;
    for (let s = 0; s <= G.cols - c; s++) {
      const base = Math.max(...sky.slice(s, s + c));
      const score = base + r() * G.scatter + (Math.abs(s - prev) < 3 ? G.scatter : 0);
      if (score < bestScore) {
        bestScore = score;
        best = s;
      }
    }
    prev = best;
    const t = quarter(Math.max(...sky.slice(best, best + c)) + r() * G.air[0]);
    const h = quarter((c - G.f) / ratio + G.f);
    const air = G.air[0] + r() * (G.air[1] - G.air[0]);
    for (let k = Math.max(0, best - 1); k <= Math.min(G.cols - 1, best + c); k++) sky[k] = Math.max(sky[k], t + h + air);
    return { s: best, c, t, h };
  });
  return { tiles, height: quarter(Math.max(...sky)) };
}

const all = PLAY.map((play, index) => ({ play, index }));
const DESK = mosaic(all, "d");
const PHONE = mosaic(all, "p");

/** The CSS variables that place a tile on both grids */
export const tileVars = (d: Tile, p: Tile) =>
  `--sd:${d.s};--cd:${d.c};--td:${d.t};--hd:${d.h};--sp:${p.s};--cp:${p.c};--tp:${p.t};--hp:${p.h}`;

function tile(base: string, p: Play, i: number) {
  const media = mediaTag(base, p.file, p.title, { small: true, className: "pl__img" }).replace("data-autoplay", "data-pl-video");
  return `
        <li class="pl__tile" data-pl-tile data-i="${i}" data-kind="${p.kind}" style="${tileVars(DESK.tiles[i], PHONE.tiles[i])}">
          <button class="pl__btn" type="button" data-pl-open data-cursor="media" data-cursor-label="${esc(p.title)}" aria-haspopup="dialog" aria-label="${esc(`${p.title}, ${PLAY_KINDS[p.kind]}, ${p.year}`)}">
            <span class="pl__media">${media}</span>
          </button>
          <span class="label pl__cap" aria-hidden="true"><span>${pad2(i + 1)}</span>${esc(p.title)}</span>
        </li>`;
}

const pill = (key: string, label: string, count: number, on: boolean) =>
  `<li><button class="pl__pill" type="button" data-pl-filter="${key}" aria-pressed="${on}">${esc(label)}<span class="pl__pill-n">${pad2(count)}</span></button></li>`;

/**
 * Playground (/playground/): the bybang home. A fixed wordmark in the middle, an endless mosaic of
 * pieces scrolling past it in both directions, a small filter row, and a near full page modal per
 * piece. The template renders one cycle; views/playground.ts clones it and runs the loop.
 */
export function playground(base: string) {
  const n = PLAY.length;
  const pills = [pill("all", "All", n, true), ...PLAY_FILTERS.map((f) => pill(f.key, f.label, f.count, false))].join("");
  return `
<section class="pl" data-section="playground" aria-labelledby="pl-title" data-page-fixed>
  <div class="pl__wrap" data-pl-wrap>
    <div class="pl__content" data-pl-content data-page-shift style="--Hd:${DESK.height};--Hp:${PHONE.height}">
      <ul class="pl__cycle" data-pl-cycle style="--k:0" aria-label="Pieces">${PLAY.map((p, i) => tile(base, p, i)).join("")}
      </ul>
    </div>
  </div>
  <div class="pl__mark">
    <h1 class="pl__title" id="pl-title" data-page-shift><span class="mask"><span class="mask__in" data-reveal="rise" data-reveal-now>Play<em>ground</em></span></span></h1>
  </div>
  <div class="pl__bar">
    <ul class="pl__pills" data-page-shift role="group" aria-label="Filter by kind">${pills}</ul>
    <div class="pl__about" data-page-shift><p class="pl__lede">${esc(LEDE.play)}</p><p class="label pl__hint" aria-live="polite"><span data-pl-count>${pad2(n)}</span> pieces. It loops, keep scrolling.</p></div>
  </div>
</section>`;
}
