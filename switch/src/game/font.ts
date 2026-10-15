import { canvas } from "./art";

/**
 * Tiny5 on the game canvas. Canvas text is always antialiased, so each glyph is drawn once at the font's
 * native 8px grid, its alpha thresholded to hard pixels (Skia spills a little coverage into the
 * neighbouring pixels, and two spills meeting between strokes look like ink, so only near opaque
 * pixels count), tinted, and cached. Text is then blitted glyph
 * by glyph, at 1x for the HUD and 2x for headlines, so it stays as crisp as the sprites.
 */

const SIZE = 8;
const FACE = `${SIZE}px Tiny5`;
const ASCENT = 7;
const HEIGHT = 10;

type Glyph = { img: HTMLCanvasElement; adv: number };

export type TextOpts = { scale?: number; align?: "left" | "center" | "right"; shadow?: string | null };

export class PixelFont {
  private cache = new Map<string, Map<string, Glyph>>();
  private scratch = canvas(16, HEIGHT);
  private ready = false;

  /** Resolves once Tiny5 has loaded; glyphs cached before then (in the fallback face) are thrown away */
  async load() {
    try {
      await document.fonts.load(FACE);
    } catch (err) {
      console.warn("Night Drive: Tiny5 did not load, using the fallback face", err);
    }
    this.ready = true;
    this.cache.clear();
  }

  get loaded() {
    return this.ready;
  }

  private glyph(ch: string, color: string): Glyph {
    let set = this.cache.get(color);
    if (!set) {
      set = new Map();
      this.cache.set(color, set);
    }
    const hit = set.get(ch);
    if (hit) return hit;
    const g = this.scratch.getContext("2d", { willReadFrequently: true })!;
    g.clearRect(0, 0, this.scratch.width, HEIGHT);
    g.font = FACE;
    g.textBaseline = "alphabetic";
    g.fillStyle = "#fff";
    const adv = Math.max(1, Math.round(g.measureText(ch).width));
    g.fillText(ch, 0, ASCENT);
    const w = Math.max(1, Math.min(this.scratch.width, adv + 1));
    const src = g.getImageData(0, 0, w, HEIGHT);
    const img = canvas(w, HEIGHT);
    const out = img.getContext("2d")!;
    const data = out.createImageData(w, HEIGHT);
    const [r, gg, b] = [1, 3, 5].map((i) => parseInt(color.slice(i, i + 2), 16));
    for (let i = 0; i < src.data.length; i += 4) {
      if (src.data[i + 3] < 200) continue;
      data.data[i] = r;
      data.data[i + 1] = gg;
      data.data[i + 2] = b;
      data.data[i + 3] = 255;
    }
    out.putImageData(data, 0, 0);
    const glyph = { img, adv };
    set.set(ch, glyph);
    return glyph;
  }

  /** Width in game pixels at scale 1 */
  measure(str: string) {
    let w = 0;
    for (const ch of str) w += this.glyph(ch, "#ffffff").adv;
    return w;
  }

  /** Draws `str` with its baseline at y. Colours are #rrggbb. */
  draw(g: CanvasRenderingContext2D, str: string, x: number, y: number, color: string, opts: TextOpts = {}) {
    const k = opts.scale ?? 1;
    const w = this.measure(str) * k;
    let cx = Math.round(opts.align === "center" ? x - w / 2 : opts.align === "right" ? x - w : x);
    const top = Math.round(y - ASCENT * k);
    const shadow = opts.shadow === undefined ? "#2a1a12" : opts.shadow;
    for (const ch of str) {
      if (shadow) {
        const s = this.glyph(ch, shadow);
        /* big text drops its shadow straight down, so the one pixel gaps between letters stay open */
        g.drawImage(s.img, cx + (k > 1 ? 0 : 1), top + k, s.img.width * k, HEIGHT * k);
      }
      const gl = this.glyph(ch, color);
      g.drawImage(gl.img, cx, top, gl.img.width * k, HEIGHT * k);
      cx += gl.adv * k;
    }
  }

  /** Renders a label into its own canvas, for baking into sprites such as the stage banners */
  bake(str: string, color: string, scale = 2) {
    const c = canvas(Math.max(1, this.measure(str) * scale + scale), HEIGHT * scale);
    const g = c.getContext("2d")!;
    g.imageSmoothingEnabled = false;
    this.draw(g, str, 0, ASCENT * scale, color, { scale, shadow: null });
    return c;
  }
}
