const PALETTE = ["#ffb400", "#ff6a00", "#ff2e7e", "#8a4dff", "#9a7bff", "#3ea63a", "#2f6df6", "#e0141c"];

const LOOKALIKES: Record<string, string> = {
  a: "@4", b: "6", c: "(", d: "6", e: "3€", g: "9", h: "#", i: "1!", l: "1|", n: ">", o: "0*",
  r: "?", s: "5$", t: "+7", u: "_", x: "%", z: "2", A: "4^", B: "8", C: "(", D: "0", E: "3",
  G: "6", I: "1|", O: "0", R: "Я", S: "5$", T: "7", Z: "2",
};

const GLYPH_CHANCE = 0.35;
const ALT_CHANCE = 0.1;
const HOLD_MS = 2000;
const RIPPLE_MS = 250;

type Word = {
  el: HTMLSpanElement;
  chars: Char[];
  alt: boolean;
  rolled: boolean;
  on: boolean;
  timer: number;
};

type Char = {
  el: HTMLSpanElement;
  char: string;
  x: number;
  y: number;
  busy: boolean;
  timer: number;
  word: Word;
};

const pick = <T>(list: readonly T[]): T => list[Math.floor(Math.random() * list.length)];
const reducedMotion = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

type Token = { core: string; alt?: string; tail: string };

function tokenize(source: string): Token[] {
  return source
    .trim()
    .split(/\s+/)
    .map((raw) => {
      const m = raw.match(/^\[([^|\]]+)\|([^\]]+)\](.*)$/);
      return m ? { core: m[1], alt: m[2], tail: m[3] } : { core: raw, tail: "" };
    });
}

function charSpan(ch: string, core: boolean) {
  const s = document.createElement("span");
  s.dataset.char = ch;
  if (core) s.dataset.core = "";
  s.textContent = ch;
  return s;
}

export class Scramble {
  private root: HTMLElement;
  private live: HTMLElement;
  private words: Word[] = [];
  private chars: Char[] = [];
  private radius: number;
  private dirty = true;

  constructor(root: HTMLElement) {
    this.root = root;
    this.radius = Number(root.dataset.radius ?? 80);
    const tokens = tokenize(root.textContent ?? "");
    const plain = tokens.map((t) => t.core + t.tail).join(" ");
    const grow = root.dataset.grow;

    root.textContent = "";
    const sr = document.createElement("span");
    sr.className = "sr-only";
    sr.textContent = plain;
    root.append(sr);

    this.live = document.createElement("span");
    this.live.setAttribute("aria-hidden", "true");

    if (grow) {
      root.classList.add("scr");
      const sizer = document.createElement("span");
      sizer.className = "scr-sizer";
      sizer.setAttribute("aria-hidden", "true");
      sizer.textContent = plain;
      this.live.className = "scr-live";
      this.live.dataset.grow = grow;
      root.append(sizer);
    }
    root.append(this.live);

    for (const t of tokens) {
      const el = document.createElement("span");
      el.dataset.w = "";
      const word: Word = { el, chars: [], alt: !!t.alt, rolled: false, on: false, timer: 0 };
      const add = (ch: string, core: boolean) => {
        const span = charSpan(ch, core);
        el.append(span);
        const c: Char = { el: span, char: ch, x: 0, y: 0, busy: false, timer: 0, word };
        word.chars.push(c);
        this.chars.push(c);
      };
      for (const ch of t.core) add(ch, !!t.alt);
      if (t.alt) {
        const alt = document.createElement("span");
        alt.dataset.alt = "";
        alt.textContent = t.alt;
        el.append(alt);
      }
      for (const ch of t.tail) add(ch, false);
      this.words.push(word);
    }

    this.layoutRows();
    new ResizeObserver(() => (this.dirty = true)).observe(root);
  }

  /** Lock each visual line into a nowrap row so glyph swaps never reflow the paragraph. */
  layoutRows() {
    if (this.root.classList.contains("scr")) {
      this.live.replaceChildren(...this.joined(this.words.map((w) => w.el)));
      this.dirty = true;
      return;
    }
    this.live.replaceChildren(...this.joined(this.words.map((w) => w.el)));
    const rows: HTMLSpanElement[][] = [];
    let top = NaN;
    for (const w of this.words) {
      const y = Math.round(w.el.getBoundingClientRect().top);
      if (y !== top) {
        top = y;
        rows.push([]);
      }
      rows[rows.length - 1].push(w.el);
    }
    this.live.replaceChildren(
      ...rows.map((row) => {
        const r = document.createElement("span");
        r.className = "row";
        r.append(...this.joined(row));
        return r;
      }),
    );
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

  private paint(c: Char) {
    const glyphs = LOOKALIKES[c.char];
    c.el.style.color = pick(PALETTE);
    if (glyphs && !reducedMotion() && Math.random() < GLYPH_CHANCE) c.el.textContent = pick([...glyphs]);
  }

  private revert(c: Char) {
    window.clearTimeout(c.timer);
    c.el.textContent = c.char;
    c.el.style.color = "";
    c.busy = false;
    const w = c.word;
    if (!w.on && !w.chars.some((x) => x.busy)) w.rolled = false;
    this.dirty = true;
  }

  private hit(c: Char) {
    window.clearTimeout(c.timer);
    c.busy = true;
    this.paint(c);
    this.dirty = true;
    c.timer = window.setTimeout(() => this.revert(c), HOLD_MS);
  }

  private showAlt(w: Word) {
    for (const c of w.chars) this.revert(c);
    w.on = true;
    w.rolled = true;
    for (const c of w.chars) c.busy = true;
    w.el.dataset.altOn = "";
    this.dirty = true;
    w.timer = window.setTimeout(() => this.hideAlt(w), HOLD_MS);
  }

  private hideAlt(w: Word) {
    window.clearTimeout(w.timer);
    delete w.el.dataset.altOn;
    w.on = false;
    w.rolled = false;
    for (const c of w.chars) c.busy = false;
    this.dirty = true;
  }

  private later(c: Char, delay: number, run: () => void) {
    if (delay <= 0) return run();
    window.clearTimeout(c.timer);
    c.busy = true;
    c.timer = window.setTimeout(run, delay);
  }

  update(px: number, py: number, ripple: number) {
    const box = this.root.getBoundingClientRect();
    const R = this.radius;
    if (px < box.left - R || px > box.right + R || py < box.top - R || py > box.bottom + R) return;
    if (this.dirty) this.measure(box);
    const x = px - box.left;
    const y = py - box.top;

    for (const c of this.chars) {
      const d = Math.hypot(c.x - x, c.y - y) / R;
      if (d >= 1 || c.busy) continue;
      const w = c.word;
      if (w.alt && !w.rolled) {
        w.rolled = true;
        if (Math.random() < ALT_CHANCE) {
          this.later(c, d * ripple, () => this.showAlt(w));
          continue;
        }
      }
      this.later(c, d * ripple, () => this.hit(c));
    }
  }
}

export function mountScrambles(scope: ParentNode = document) {
  const instances = [...scope.querySelectorAll<HTMLElement>("[data-scramble]")].map((el) => new Scramble(el));

  let raf = 0;
  let px = 0;
  let py = 0;
  let ripple = 0;
  const flush = () => {
    raf = 0;
    for (const s of instances) s.update(px, py, ripple);
    ripple = 0;
  };
  const queue = (x: number, y: number, r = 0) => {
    px = x;
    py = y;
    ripple = Math.max(ripple, r);
    if (!raf) raf = requestAnimationFrame(flush);
  };

  document.addEventListener("pointermove", (e) => queue(e.clientX, e.clientY), { passive: true });
  document.addEventListener("pointerdown", (e) => queue(e.clientX, e.clientY, RIPPLE_MS), { passive: true });
  document.addEventListener(
    "touchmove",
    (e) => {
      const t = e.touches[0];
      if (t) queue(t.clientX, t.clientY);
    },
    { passive: true },
  );

  let resizeRaf = 0;
  const relayout = () => {
    cancelAnimationFrame(resizeRaf);
    resizeRaf = requestAnimationFrame(() => instances.forEach((s) => s.layoutRows()));
  };
  window.addEventListener("resize", relayout);
  document.fonts?.ready.then(relayout);

  return instances;
}
