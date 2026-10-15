import { finePointer, getPhase, reducedMotion } from "../core/motion";

/** How long a swapped character holds its alternate face before settling back */
const HOLD_MS = 2000;
/** A press sends a ripple: characters further from the pointer swap later, up to this delay */
const RIPPLE_MS = 250;
/** Share of swaps that land on the pixel face; the rest are serif italic */
const PIXEL_CHANCE = 0.3;

type Face = "serif" | "pixel";
type Char = { el: HTMLSpanElement; x: number; y: number; busy: boolean; timer: number; face: Face | null };

/**
 * Face swap (ported from the main site's scramble, restyled for Switch): characters within `data-radius`
 * of the pointer turn into Instrument Serif italic or Tiny5, in cobalt, hold for 2s and settle back to
 * Instrument Sans ink. Every character is an inline-block whose width is locked while swapped, so a line
 * never reflows or jitters. With `data-swap-rows` the text is also grouped into one nowrap row per visual
 * line (used for the line-by-line entrance).
 */
export class Swap {
  readonly root: HTMLElement;
  readonly chars: Char[] = [];
  private words: HTMLSpanElement[] = [];
  private live: HTMLSpanElement;
  private radius: number;
  private rows: boolean;
  private dirty = true;
  private lastWidth = -1;

  constructor(root: HTMLElement) {
    this.root = root;
    this.radius = Number(root.dataset.radius ?? 80);
    this.rows = root.hasAttribute("data-swap-rows");
    const text = (root.textContent ?? "").trim().replace(/\s+/g, " ");
    root.textContent = "";
    const sr = document.createElement("span");
    sr.className = "sr-only";
    sr.textContent = text;
    this.live = document.createElement("span");
    this.live.className = "sw";
    this.live.setAttribute("aria-hidden", "true");
    root.append(sr, this.live);

    for (const token of text.split(" ")) {
      const word = document.createElement("span");
      word.className = "sw__w";
      for (const ch of Array.from(token)) {
        const el = document.createElement("span");
        el.className = "sw__c";
        el.textContent = ch;
        word.append(el);
        this.chars.push({ el, x: 0, y: 0, busy: false, timer: 0, face: null });
      }
      this.words.push(word);
    }
    this.layout();
  }

  /** Rows of the intro, for the entrance. Empty when the text is not row-grouped. */
  get rowEls() {
    return Array.from(this.live.querySelectorAll<HTMLElement>(".sw__row"));
  }

  /** Re-groups words into one nowrap row per visual line. Cheap; call on width change or font load. */
  layout(force = false) {
    const width = this.root.clientWidth;
    if (!force && width === this.lastWidth) return;
    this.lastWidth = width;
    this.live.replaceChildren(...this.joined(this.words));
    if (this.rows) {
      const groups: HTMLSpanElement[][] = [];
      let top = NaN;
      for (const w of this.words) {
        const y = Math.round(w.offsetTop);
        if (y !== top) {
          top = y;
          groups.push([]);
        }
        groups[groups.length - 1].push(w);
      }
      this.live.replaceChildren(
        ...groups.map((g) => {
          const row = document.createElement("span");
          row.className = "sw__row";
          row.append(...this.joined(g));
          return row;
        }),
      );
    }
    this.dirty = true;
  }

  private joined(els: HTMLElement[]) {
    const out: Node[] = [];
    els.forEach((el, i) => {
      if (i) out.push(document.createTextNode(" "));
      out.push(el);
    });
    return out;
  }

  markDirty() {
    this.dirty = true;
  }

  private measure(box: DOMRect) {
    for (const c of this.chars) {
      const r = c.el.getBoundingClientRect();
      c.x = r.left + r.width / 2 - box.left;
      c.y = r.top + r.height / 2 - box.top;
    }
    this.dirty = false;
  }

  /** Mostly serif italic, some pixel, never three pixel characters in a row */
  private pickFace(i: number): Face {
    const a = this.chars[i - 1]?.face;
    const b = this.chars[i - 2]?.face;
    if (a === "pixel" && b === "pixel") return "serif";
    return Math.random() < PIXEL_CHANCE ? "pixel" : "serif";
  }

  private hit(i: number) {
    const c = this.chars[i];
    window.clearTimeout(c.timer);
    if (!c.face) c.el.style.width = `${c.el.getBoundingClientRect().width}px`;
    c.face = this.pickFace(i);
    c.el.dataset.face = c.face;
    c.busy = true;
    c.timer = window.setTimeout(() => this.revert(c), HOLD_MS);
  }

  private revert(c: Char) {
    window.clearTimeout(c.timer);
    c.face = null;
    c.busy = false;
    delete c.el.dataset.face;
    c.el.style.width = "";
  }

  /** Swaps every idle character within the radius of (px, py), staggered by distance when rippling */
  update(px: number, py: number, ripple: number) {
    const box = this.root.getBoundingClientRect();
    const R = this.radius;
    if (px < box.left - R || px > box.right + R || py < box.top - R || py > box.bottom + R) return;
    if (this.dirty) this.measure(box);
    const x = px - box.left;
    const y = py - box.top;
    this.chars.forEach((c, i) => {
      if (c.busy) return;
      const d = Math.hypot(c.x - x, c.y - y) / R;
      if (d >= 1) return;
      const delay = d * ripple;
      if (delay <= 0) return this.hit(i);
      c.busy = true;
      c.timer = window.setTimeout(() => this.hit(i), delay);
    });
  }

  destroy() {
    this.chars.forEach((c) => this.revert(c));
  }
}

/**
 * Wires every [data-swap] in scope to one pointer listener. Fine pointers swap on move; a press (or a
 * tap on touch) sends a ripple outward. Nothing swaps while a page transition is running.
 */
export function mountSwaps(scope: ParentNode): { swaps: Swap[]; stop: () => void } {
  const swaps = Array.from(scope.querySelectorAll<HTMLElement>("[data-swap]")).map((el) => new Swap(el));
  let raf = 0;
  let px = 0;
  let py = 0;
  let ripple = 0;
  const flush = () => {
    raf = 0;
    if (getPhase() === "idle") swaps.forEach((s) => s.update(px, py, ripple));
    ripple = 0;
  };
  const queue = (x: number, y: number, r = 0) => {
    px = x;
    py = y;
    ripple = Math.max(ripple, r);
    if (!raf) raf = requestAnimationFrame(flush);
  };
  const fine = finePointer();
  const onMove = (e: PointerEvent) => queue(e.clientX, e.clientY);
  const onDown = (e: PointerEvent) => queue(e.clientX, e.clientY, reducedMotion() ? 0 : RIPPLE_MS);
  if (fine) window.addEventListener("pointermove", onMove, { passive: true });
  window.addEventListener("pointerdown", onDown, { passive: true });
  const ro = new ResizeObserver(() => swaps.forEach((s) => s.layout()));
  swaps.forEach((s) => ro.observe(s.root));

  return {
    swaps,
    stop: () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerdown", onDown);
      swaps.forEach((s) => s.destroy());
    },
  };
}
