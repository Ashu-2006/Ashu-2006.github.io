import DATA from "../../lib/ds/data.json";
import { mountKit } from "./kit";

/**
 * Design-system behaviour, all read from the ArmorTools system's own data (tokens/src, contrast-pairs.json,
 * components.json): the ESLint rail's messages with the nearest token as the fix, WCAG contrast for every pair a
 * rule names in either theme, and a search over the component manifest an agent reads.
 */
export function mount(root: HTMLElement) {
  const stops = [mountKit(root), lint(root), contrast(root), ask(root)];
  return () => stops.forEach((s) => s());
}

type Theme = "dark" | "light";
type Comp = { name: string; category: string; status: string; summary: string; use: string[]; avoid: string[]; example: string };
const D = DATA as unknown as {
  themes: Record<Theme, Record<string, string>>;
  rules: { label: string; min: number; fg: string[]; bg: string[] }[];
  spacing: number[];
  radius: Record<string, number>;
  type: Record<string, number>;
  components: Comp[];
};
const on = (el: EventTarget, type: string, fn: (e: Event) => void) => {
  el.addEventListener(type, fn);
  return () => el.removeEventListener(type, fn);
};
const all = (fns: (() => void)[]) => () => fns.forEach((f) => f());
const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/* Colour maths: parse hex or rgba, composite alpha over a background, WCAG relative luminance and contrast */
type RGBA = [number, number, number, number];
const parse = (c: string): RGBA => {
  if (c.startsWith("#")) {
    const h = c.length === 4 ? c.replace(/^#(.)(.)(.)$/, "#$1$1$2$2$3$3") : c;
    return [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16), 1];
  }
  const m = c.match(/[\d.]+/g)!.map(Number);
  return [m[0], m[1], m[2], m[3] ?? 1];
};
const over = (fg: RGBA, bg: RGBA): RGBA => [0, 1, 2].map((i) => fg[i] * fg[3] + bg[i] * (1 - fg[3])).concat(1) as RGBA;
const lum = ([r, g, b]: RGBA) => {
  const f = (v: number) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
};
const ratio = (fg: string, bg: string) => {
  const b = parse(bg);
  const f = over(parse(fg), b[3] < 1 ? over(b, [0, 0, 0, 1]) : b);
  const [l1, l2] = [lum(f), lum(b)].sort((x, y) => y - x);
  return (l1 + 0.05) / (l2 + 0.05);
};
const dist = (a: string, b: string) => {
  const x = parse(a);
  const y = parse(b);
  return (x[0] - y[0]) ** 2 + (x[1] - y[1]) ** 2 + (x[2] - y[2]) ** 2;
};

/* The rail. Messages are copied from armortools/eslint.config.js; fixes pick the nearest token by value. */
const MSG = {
  arbColor: "Arbitrary color. Use an at-* semantic color.",
  spacing: "Tailwind default spacing or sizing scale. Use the pixel-keyed at-* scale (p-at-16, gap-at-8, size-at-icon-md, h-at-control-md).",
  radius: "Tailwind default radius. Use rounded-at-* (control, card, chip, badge, pill).",
  text: "Tailwind default text size. Use a text-at-* role (caption, small, body, heading).",
  palette: "Tailwind palette color (switched off in theme.css). Use an at-* semantic color.",
  effects: "Tailwind default motion, shadow or z-index. Use duration-at-*, ease-at-*, animate-at-*, shadow-at-* or z-at-*.",
  arbLength: "Arbitrary length. Use an at-* spacing, size or layout token.",
  enterprise: "Enterprise token prefix. Use at-* tokens only.",
};
const ZINC: Record<string, string> = { "50": "#fafafa", "100": "#f4f4f5", "200": "#e4e4e7", "300": "#d4d4d8", "400": "#a1a1aa", "500": "#71717a", "600": "#52525b", "700": "#3f3f46", "800": "#27272a", "900": "#18181b", "950": "#09090b" };
const HUE: Record<string, string> = { red: "danger", rose: "danger", green: "success", emerald: "success", amber: "warning", yellow: "warning", blue: "info", sky: "info", orange: "accent", violet: "flag", purple: "flag" };
const TW_RADIUS: Record<string, number> = { "": 4, xs: 2, sm: 4, md: 6, lg: 8, xl: 12, "2xl": 16, "3xl": 24, full: 9999 };
const TW_TEXT: Record<string, number> = { xs: 12, sm: 14, base: 16, lg: 18, xl: 20, "2xl": 24, "3xl": 30, "4xl": 36 };
const AQ: Record<string, string> = { ink: "fg-default", "ink-soft": "fg-secondary", "ink-muted": "fg-muted", surface: "surface-card", bg: "surface-canvas", border: "border-default", accent: "fg-accent" };
const nearestNum = (xs: number[], v: number) => xs.reduce((a, b) => (Math.abs(b - v) < Math.abs(a - v) ? b : a));
const nearestKey = (rec: Record<string, number>, v: number, keys: string[]) => keys.reduce((a, b) => (Math.abs(rec[b] - v) < Math.abs(rec[a] - v) ? b : a));
const family = (prefix: string) => (prefix === "bg" ? "surface-" : prefix === "border" || prefix === "ring" ? "border-" : "fg-");
const nearestColour = (prefix: string, hex: string) => {
  const keys = Object.keys(D.themes.dark).filter((k) => k.startsWith(family(prefix)) && !/hover|on-|inverse|scrim/.test(k));
  return keys.reduce((a, b) => (dist(D.themes.dark[b], hex) < dist(D.themes.dark[a], hex) ? b : a));
};

type Problem = { cls: string; msg: string; fix?: string };
function check(cls: string): Problem | null {
  let m: RegExpMatchArray | null;
  if ((m = cls.match(/^(bg|text|border|ring)-\[(#[0-9a-f]{3,8})\]$/i))) return { cls, msg: MSG.arbColor, fix: `${m[1]}-at-${nearestColour(m[1], m[2])}` };
  if ((m = cls.match(/^(\w+(?:-[xy])?)-\[(\d+)px\]$/))) return { cls, msg: MSG.arbLength, fix: `${m[1]}-at-${nearestNum(D.spacing, Number(m[2]))}` };
  if ((m = cls.match(/^(p|px|py|pt|pb|pl|pr|m|mx|my|mt|mb|ml|mr|gap|gap-x|gap-y|w|h|size)-(\d+(?:\.5)?)$/))) return { cls, msg: MSG.spacing, fix: `${m[1]}-at-${nearestNum(D.spacing, Number(m[2]) * 4)}` };
  if ((m = cls.match(/^rounded(?:-(xs|sm|md|lg|xl|2xl|3xl|full))?$/))) {
    const roles = ["badge", "chip", "control", "card", "bezel", "modal", "pill"];
    return { cls, msg: MSG.radius, fix: `rounded-at-${nearestKey(D.radius, TW_RADIUS[m[1] ?? ""], roles)}` };
  }
  if ((m = cls.match(/^text-(xs|sm|base|lg|xl|2xl|3xl|4xl)$/))) {
    const roles = ["small", "body", "subheading", "heading", "title", "title-lg", "display", "display-lg"];
    return { cls, msg: MSG.text, fix: `text-at-${nearestKey(D.type, TW_TEXT[m[1]], roles)}` };
  }
  if ((m = cls.match(/^(text|bg|border)-(zinc|gray|slate|neutral|stone)-(\d{2,3})$/))) return { cls, msg: MSG.palette, fix: `${m[1]}-at-${nearestColour(m[1], ZINC[m[3]] ?? "#71717a")}` };
  if ((m = cls.match(/^(text|bg|border)-(red|rose|green|emerald|amber|yellow|blue|sky|orange|violet|purple)-\d{2,3}$/))) {
    const role = HUE[m[2]];
    return { cls, msg: MSG.palette, fix: m[1] === "bg" ? `bg-at-surface-${role}-soft` : m[1] === "border" ? `border-at-border-${role}` : `text-at-fg-${role}` };
  }
  if ((m = cls.match(/^shadow(?:-(sm|md|lg|xl|2xl))?$/))) return { cls, msg: MSG.effects, fix: "shadow-at-raised" };
  if (/^(duration|ease|z)-\w+$/.test(cls) && !cls.includes("-at-")) return { cls, msg: MSG.effects };
  if ((m = cls.match(/^(bg|text|border)-aq-([a-z-]+)$/))) return { cls, msg: MSG.enterprise, fix: AQ[m[2]] ? `${m[1]}-at-${AQ[m[2]]}` : undefined };
  return null;
}

function lint(root: HTMLElement) {
  const el = root.querySelector<HTMLElement>("[data-lint]");
  if (!el) return () => {};
  const input = el.querySelector<HTMLInputElement>("[data-lint-input]")!;
  const list = el.querySelector<HTMLElement>("[data-lint-list]")!;
  const count = el.querySelector<HTMLElement>("[data-lint-count]")!;
  const start = input.value;
  const run = () => {
    const probs = input.value.split(/\s+/).filter(Boolean).map(check).filter((p): p is Problem => !!p);
    list.innerHTML = probs
      .map((p) => `<li><code class="lint__bad">${esc(p.cls)}</code><span>${esc(p.msg)}</span>${p.fix ? `<code class="lint__good">${esc(p.fix)}</code>` : ""}</li>`)
      .join("");
    count.textContent = probs.length ? `${probs.length} problem${probs.length === 1 ? "" : "s"}` : "0 problems. This line passes the rail.";
    el.classList.toggle("is-clean", probs.length === 0);
    return probs;
  };
  run();
  return all([
    on(input, "input", run),
    on(el, "click", (e) => {
      const t = e.target as HTMLElement;
      if (t.closest("[data-lint-fix]")) {
        input.value = input.value
          .split(/\s+/)
          .filter(Boolean)
          .map((c) => check(c)?.fix ?? c)
          .join(" ");
        run();
      }
      if (t.closest("[data-lint-reset]")) {
        input.value = start;
        run();
      }
    }),
  ]);
}

function contrast(root: HTMLElement) {
  const el = root.querySelector<HTMLElement>("[data-cx]");
  if (!el) return () => {};
  const select = el.querySelector<HTMLSelectElement>("[data-cx-rule]")!;
  const grid = el.querySelector<HTMLElement>("[data-cx-grid]")!;
  const sum = el.querySelector<HTMLElement>("[data-cx-sum]")!;
  select.innerHTML = D.rules.map((r, i) => `<option value="${i}">${esc(r.label)} · ${r.min}:1</option>`).join("");
  let theme: Theme = "dark";
  const draw = () => {
    const r = D.rules[Number(select.value)];
    const c = D.themes[theme];
    const fg = r.fg.filter((k) => c[k]);
    const bg = r.bg.filter((k) => c[k]);
    let pass = 0;
    grid.style.setProperty("--cols", String(bg.length));
    grid.innerHTML =
      `<span></span>${bg.map((b) => `<span class="cx__h">${esc(b)}</span>`).join("")}` +
      fg
        .map(
          (f) =>
            `<span class="cx__h cx__h--row">${esc(f)}</span>` +
            bg
              .map((b) => {
                const x = ratio(c[f], c[b]);
                const ok = x >= r.min;
                if (ok) pass += 1;
                return `<span class="cx__cell${ok ? "" : " is-fail"}" style="background:${c[b]};color:${c[f]}"><b>Aa</b><i>${x.toFixed(1)}</i></span>`;
              })
              .join(""),
        )
        .join("");
    sum.textContent = `${pass} of ${fg.length * bg.length} pairs pass ${r.min}:1 in the ${theme} theme.`;
  };
  draw();
  return all([
    on(select, "change", draw),
    on(el, "click", (e) => {
      const b = (e.target as HTMLElement).closest<HTMLElement>("[data-cx-theme]");
      if (!b) return;
      theme = b.dataset.cxTheme as Theme;
      el.querySelectorAll("[data-cx-theme]").forEach((x) => x.setAttribute("aria-pressed", String(x === b)));
      draw();
    }),
  ]);
}

/* A plain word match over the manifest, with a few synonyms, so a described need lands on the right part */
const SYN: Record<string, string[]> = { progress: ["busy", "loading", "spinner", "pending"], status: ["badge", "state", "tone"], options: ["segmented", "radio", "select", "choice"], choose: ["select", "radio", "segmented"], copy: ["copy", "clipboard"], key: ["api", "key", "secret"], run: ["run", "status"] };
const STOP = new Set(["a", "an", "the", "of", "to", "that", "for", "and", "or", "one", "few", "with", "in", "on", "my", "i", "need"]);
const words = (s: string) => s.toLowerCase().match(/[a-z]+/g)?.map((w) => w.replace(/(ing|es|s)$/, "")) ?? [];
const INDEX = D.components.map((c) => ({ c, name: c.name.toLowerCase(), bag: new Set(words(`${c.name} ${c.category} ${c.summary} ${c.use.join(" ")}`)) }));

function ask(root: HTMLElement) {
  const el = root.querySelector<HTMLElement>("[data-ask]");
  if (!el) return () => {};
  const input = el.querySelector<HTMLInputElement>("[data-ask-input]")!;
  const list = el.querySelector<HTMLElement>("[data-ask-list]")!;
  const run = () => {
    const q = input.value.trim();
    if (!q) {
      list.innerHTML = `<li class="ask__empty">${D.components.length} components. Describe a need, or pick one above.</li>`;
      return;
    }
    const raw = q.toLowerCase().match(/[a-z]+/g) ?? [];
    const terms = raw.filter((w) => !STOP.has(w)).flatMap((w) => [w.replace(/(ing|es|s)$/, ""), ...(SYN[w] ?? []).map((s) => s.replace(/(ing|es|s)$/, ""))]);
    const scored = INDEX.map(({ c, name, bag }) => ({ c, s: terms.reduce((t, w) => t + (bag.has(w) ? 1 : 0) + (name.includes(w) ? 2 : 0), 0) }))
      .filter((x) => x.s > 0)
      .sort((a, b) => b.s - a.s)
      .slice(0, 3);
    list.innerHTML = scored.length
      ? scored
          .map(
            ({ c }) => `<li class="ask__card"><p class="ask__top"><code>${esc(c.name)}</code><span>${esc(c.category)}</span>${c.status ? `<em>${esc(c.status)}</em>` : ""}</p>
          <p class="ask__sum">${esc(c.summary)}</p>
          ${c.use.length ? `<p class="ask__k">Use when</p><ul>${c.use.slice(0, 2).map((u) => `<li>${esc(u)}</li>`).join("")}</ul>` : ""}
          ${c.avoid.length ? `<p class="ask__k">Not for</p><ul>${c.avoid.slice(0, 2).map((u) => `<li>${esc(u)}</li>`).join("")}</ul>` : ""}
          ${c.example ? `<pre class="ask__ex">${esc(c.example)}</pre>` : ""}</li>`,
          )
          .join("")
      : `<li class="ask__empty">Nothing in the manifest matches. A gap like this becomes a new component or token, not a one-off.</li>`;
  };
  run();
  return all([
    on(input, "input", run),
    on(el, "click", (e) => {
      const b = (e.target as HTMLElement).closest<HTMLElement>("[data-ask-q]");
      if (!b) return;
      input.value = b.dataset.askQ!;
      run();
    }),
  ]);
}
