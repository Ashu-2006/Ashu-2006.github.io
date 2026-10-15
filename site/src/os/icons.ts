/**
 * ASH/OS 98 pixel art. Every icon is a 16x16 character map drawn as merged SVG rects with crispEdges,
 * shown at 32px on the desktop (2x pixels) and 16px in title bars, rows and the taskbar.
 * Colours are classes mapped to OS tokens in os.css, so no hex lives here:
 *   k ink, w face highlight, g face, d face shadow, b cobalt, n deep cobalt, p paper, . transparent
 */

type PixelMap = readonly string[];

const FOLDER_BODY = [
  "kwggggggggggggdk",
  "kwggggggggggggdk",
  "kwggggggggggggdk",
  "kwggggggggggggdk",
  "kwggggggggggggdk",
  "kwggggggggggggdk",
  "kddddddddddddddk",
  "kkkkkkkkkkkkkkkk",
] as const;

const MAPS = {
  folder: [
    "................",
    "................",
    "................",
    ".kkkkk..........",
    "kwwwwwk.........",
    "kwgggggkkkkkkkk.",
    "kwwwwwwwwwwwwwwk",
    ...FOLDER_BODY,
    "................",
  ],
  work: [
    "................",
    "....kkkkkkkk....",
    "....kppppppkk...",
    ".kkkkkpbbbbpk...",
    "kwwwwwkppppppk..",
    "kwgggggkkkkkkkk.",
    "kwwwwwwwwwwwwwwk",
    ...FOLDER_BODY,
    "................",
  ],
  play: [
    "................",
    "................",
    "................",
    ".kkkkk..........",
    "kwwwwwk.........",
    "kwgggggkkkkkkkk.",
    "kwwwwwwwwwwwwwwk",
    "kwggggggggggggdk",
    "kwggggggggggbgdk",
    "kwgggggggggbbbdk",
    "kwggggggggbbnbbk",
    "kwgggggggggbbbdk",
    "kwggggggggggbgdk",
    "kddddddddddddddk",
    "kkkkkkkkkkkkkkkk",
    "................",
  ],
  doc: [
    "..kkkkkkkkk.....",
    "..kpppppppkk....",
    "..kpppppppkwk...",
    "..kpppppppkwwk..",
    "..kpppppppkkkk..",
    "..kppppppppppk..",
    "..kpbbbbbbbbpk..",
    "..kppppppppppk..",
    "..kpkkkkkkkkpk..",
    "..kppppppppppk..",
    "..kpkkkkkkpppk..",
    "..kppppppppppk..",
    "..kpkkkkkkkkpk..",
    "..kppppppppppk..",
    "..kkkkkkkkkkkk..",
    "................",
  ],
  txt: [
    "..kkkkkkkkk.....",
    "..kpppppppkk....",
    "..kpppppppkwk...",
    "..kpppppppkwwk..",
    "..kpppppppkkkk..",
    "..kppppppppppk..",
    "..kpddddddddpk..",
    "..kppppppppppk..",
    "..kpdddddddppk..",
    "..kppppppppppk..",
    "..kpddddddddpk..",
    "..kppppppppppk..",
    "..kpddddddpppk..",
    "..kppppppppppk..",
    "..kkkkkkkkkkkk..",
    "................",
  ],
  fig: [
    "..kkkkkkkkk.....",
    "..kpppppppkk....",
    "..kpppppppkwk...",
    "..kpppppppkwwk..",
    "..kpppppppkkkk..",
    "..kppppppppppk..",
    "..kppbbpnnpppk..",
    "..kppbbpnnpppk..",
    "..kppppppppppk..",
    "..kppddpbbpppk..",
    "..kppddpbbpppk..",
    "..kppppppppppk..",
    "..kppppppppppk..",
    "..kppppppppppk..",
    "..kkkkkkkkkkkk..",
    "................",
  ],
  exe: [
    "................",
    "................",
    "................",
    "kkkkkkkkkkkkkkkk",
    "kkppppppppppppkk",
    "kpkppppppppppkpk",
    "kppkppppppppkppk",
    "kpppkppppppkpppk",
    "kppppkppppkppppk",
    "kpppppbbbbpppppk",
    "kppppppbbppppppk",
    "kppppppppppppppk",
    "kppppppppppppppk",
    "kkkkkkkkkkkkkkkk",
    "................",
    "................",
  ],
  bin: [
    "................",
    ".....ppw.pw.....",
    "..kkkkkkkkkkkk..",
    "..kwwwwwwwwwwk..",
    "..kkkkkkkkkkkk..",
    "...kgwgwgwgwk...",
    "...kwgwgwgwgk...",
    "...kgwgwgwgwk...",
    "...kwgwgwgwgk...",
    "...kgwgwgwgwk...",
    "...kwgwgwgwgk...",
    "....kgwgwgwk....",
    "....kwgwgwgk....",
    "....kgwgwgwk....",
    "....kkkkkkkk....",
    "................",
  ],
  site: [
    "................",
    ".kkkkkkkkkkkkkk.",
    ".kwwwwwwwwwwwwk.",
    ".kwkkkkkkkkkkgk.",
    ".kwkbbbbbbbbkgk.",
    ".kwkbppppppbkgk.",
    ".kwkbpkkkkpbkgk.",
    ".kwkbppppppbkgk.",
    ".kwkbbbbbbbbkgk.",
    ".kwkkkkkkkkkkgk.",
    ".kwgggggggggbgk.",
    ".kkkkkkkkkkkkkk.",
    "......kggk......",
    "....kkkkkkkk....",
    "....kwgggggk....",
    "....kkkkkkkk....",
  ],
  logo: [
    "................",
    "................",
    "................",
    "....kkkkkkkk....",
    "..kkppppppppkk..",
    ".kpppppppbbbppk.",
    ".kppppppbbbbbpk.",
    "kpppppppbbbbbppk",
    ".kppppppbbbbbpk.",
    ".kpppppppbbbppk.",
    "..kkppppppppkk..",
    "....kkkkkkkk....",
    "................",
    "................",
    "................",
    "................",
  ],
  car: [
    "................",
    "................",
    "................",
    "................",
    ".....kkkkkk.....",
    "....kbppkppbk...",
    "...kbbppkppbbk..",
    ".kkbbbbbbbbbbbkk",
    "kbbbbbbbbbbbbbwk",
    "kbbbbbbbbbbbbbbk",
    "knnkkknnnnkkknnk",
    ".kkkgkkkkkkgkkk.",
    "...kkk....kkk...",
    "................",
    "................",
    "................",
  ],
  ask: [
    "................",
    "....kkkkkk......",
    "..kkppppppkk....",
    ".kppppbbppppk...",
    ".kpppbppbpppk...",
    "kpppppppbppppk..",
    "kppppppbpppppk..",
    "kppppppbpppppk..",
    "kppppppppppppk..",
    ".kppppppbppppk..",
    "..kkppppppkk....",
    "....kpkkkk......",
    "...kpk..........",
    "..kk............",
    "................",
    "................",
  ],
  error: [
    "................",
    "....kkkkkk......",
    "..kknnnnnnkk....",
    ".knnnnnnnnnnk...",
    ".knnpnnnnpnnk...",
    "knnnppnnppnnnk..",
    "knnnnppppnnnnk..",
    "knnnnnppnnnnnk..",
    "knnnnppppnnnnk..",
    ".knnppnnppnnk...",
    ".knpnnnnnnpnk...",
    "..kknnnnnnkk....",
    "....kkkkkk......",
    "................",
    "................",
    "................",
  ],
  speaker: [
    "................",
    "................",
    "................",
    "......kk........",
    ".....kgk...k....",
    "....kggk....k...",
    ".kkkkggk..k..k..",
    ".kwwwggk...k.k..",
    ".kwwwggk...k.k..",
    ".kkkkggk..k..k..",
    "....kggk....k...",
    ".....kgk...k....",
    "......kk........",
    "................",
    "................",
    "................",
  ],
  mute: [
    "................",
    "................",
    "................",
    "......kk........",
    ".....kgk........",
    "....kggk........",
    ".kkkkggk.k...k..",
    ".kwwwggk..k.k...",
    ".kwwwggk...k....",
    ".kkkkggk..k.k...",
    "....kggk.k...k..",
    ".....kgk........",
    "......kk........",
    "................",
    "................",
    "................",
  ],
} satisfies Record<string, PixelMap>;

export type IconName = keyof typeof MAPS;

/** Title bar button glyphs, 9x9 so the three buttons share one baseline */
const GLYPHS = {
  min: [".........", ".........", ".........", ".........", ".........", ".........", ".kkkkkk..", ".kkkkkk..", "........."],
  max: ["kkkkkkkkk", "kkkkkkkkk", "k.......k", "k.......k", "k.......k", "k.......k", "k.......k", "k.......k", "kkkkkkkkk"],
  restore: ["..kkkkkk.", "..kkkkkk.", "..k....k.", "kkkkkk.k.", "kkkkkk.k.", "k....kkk.", "k....k...", "k....k...", "kkkkkk..."],
  close: [".........", "kk....kk.", ".kk..kk..", "..kkkk...", "...kk....", "..kkkk...", ".kk..kk..", "kk....kk.", "........."],
} satisfies Record<string, PixelMap>;

export type GlyphName = keyof typeof GLYPHS;

/** Merges each row's runs of one colour into a single rect, so a 16x16 icon is a few dozen nodes */
function rects(map: PixelMap, mono = false, skip = ".") {
  let out = "";
  map.forEach((row, y) => {
    let x = 0;
    while (x < row.length) {
      const c = row[x];
      let end = x + 1;
      while (end < row.length && row[end] === c) end++;
      if (c !== "." && !skip.includes(c)) out += `<rect x="${x}" y="${y}" width="${end - x}" height="1"${mono ? "" : ` class="px-${c}"`}/>`;
      x = end;
    }
  });
  return out;
}

const cache = new Map<string, string>();

/** An icon as inline SVG. `size` is the CSS pixel size: 16 or 32 (any multiple of 16 stays crisp). */
export function icon(name: IconName, size = 32, cls = "os-ico") {
  const key = `${name}:${size}:${cls}`;
  let svg = cache.get(key);
  if (!svg) {
    svg = `<svg class="${cls}" width="${size}" height="${size}" viewBox="0 0 16 16" shape-rendering="crispEdges" aria-hidden="true" focusable="false">${rects(MAPS[name])}</svg>`;
    cache.set(key, svg);
  }
  return svg;
}

/** The same icon as a CSS mask, used for the dithered selection tint on desktop icons */
export function iconMask(name: IconName) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" shape-rendering="crispEdges">${rects(MAPS[name], true)}</svg>`;
  return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
}

/** The big faint wallpaper mark: the switch logo in one colour at any pixel scale */
export function logoMark(scale: number) {
  const s = 16 * scale;
  return `<svg class="os-desk__mark" width="${s}" height="${s}" viewBox="0 0 16 16" shape-rendering="crispEdges" aria-hidden="true" focusable="false">${rects(MAPS.logo, true, ".p")}</svg>`;
}

/** A title bar button glyph */
export function glyph(name: GlyphName) {
  return `<svg class="os-glyph" width="9" height="9" viewBox="0 0 9 9" shape-rendering="crispEdges" aria-hidden="true" focusable="false">${rects(GLYPHS[name], true)}</svg>`;
}
