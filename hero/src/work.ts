/** Scatter poses at a 16:9 viewport: centre as viewport fractions, width as a fraction of vw, rotation in deg. */
const SCATTER = [
  { x: 0.297, y: 0.098, w: 0.105, r: -3 },
  { x: 0.181, y: 0.407, w: 0.099, r: 4 },
  { x: 0.225, y: 0.449, w: 0.086, r: -6 },
  { x: 0.207, y: 0.701, w: 0.114, r: 3 },
  { x: 0.65, y: 0.23, w: 0.098, r: 4 },
  { x: 0.838, y: 0.114, w: 0.107, r: -4 },
  { x: 0.845, y: 0.397, w: 0.092, r: -5 },
  { x: 0.741, y: 0.491, w: 0.115, r: 5 },
  { x: 0.696, y: 0.743, w: 0.106, r: 4 },
] as const;

const COVER_SCALE = 0.42;
const MIN_SATELLITE_PX = 84;
const DRIFT = 0.35;
const HOLD_VH = 0.35;
const ZOOM_VH = 1.4;
const TAIL_VH = 0.25;
const LAG = 0.12;

const clamp01 = (n: number) => Math.min(1, Math.max(0, n));
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const inOutCubic = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);

export function mountWork(section: HTMLElement) {
  const track = section.querySelector<HTMLElement>(".work-track")!;
  const stage = section.querySelector<HTMLElement>(".work-stage")!;
  const cards = [...section.querySelectorAll<HTMLElement>("[data-card]")];
  const metas = [...section.querySelectorAll<HTMLElement>("[data-meta]")];
  const rail = [...section.querySelectorAll<HTMLButtonElement>("[data-goto]")];
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");

  let vw = 0;
  let vh = 0;
  let W = 0;
  let hold = 0;
  let zoom = 0;
  let strip = 0;
  let top = 0;
  let active = -1;
  let raf = 0;

  const setActive = (project: number) => {
    if (project === active) return;
    active = project;
    metas.forEach((m) => m.toggleAttribute("data-on", Number(m.dataset.meta) === project));
    rail.forEach((b) => (Number(b.dataset.goto) === project ? b.setAttribute("aria-current", "true") : b.removeAttribute("aria-current")));
  };

  const measure = () => {
    vw = stage.clientWidth;
    vh = stage.clientHeight;
    W = Math.min(vw, (vh * 4) / 3);
    hold = vh * HOLD_VH;
    zoom = vh * ZOOM_VH;
    strip = (cards.length - 1) * W;
    track.style.height = `${vh + hold + zoom + strip + vh * TAIL_VH}px`;
    section.style.setProperty("--card-w", `${W}px`);
    top = track.getBoundingClientRect().top + window.scrollY;
  };

  const render = () => {
    raf = 0;
    const y = window.scrollY - top;
    const drift = clamp01(y / (hold + zoom));
    const z = clamp01((y - hold) / zoom);
    const pan = clamp01((y - hold - zoom) / strip) * strip;

    cards.forEach((card, i) => {
      let x0 = 0;
      let y0 = 0;
      let s0 = COVER_SCALE;
      let r0 = 0;
      let t = inOutCubic(z);
      const p = SCATTER[i - 1];
      if (p) {
        x0 = (p.x - 0.5) * vw;
        y0 = (p.y - 0.5) * vh * (1 + DRIFT * drift);
        s0 = Math.max(p.w * vw, MIN_SATELLITE_PX) / W;
        r0 = p.r;
        t = inOutCubic(clamp01((z - LAG) / (1 - LAG)));
      }
      const x = lerp(x0, i * W, t) - pan;
      const cy = lerp(y0, 0, t);
      const s = lerp(s0, 1, t);
      const r = lerp(r0, 0, t);
      card.style.transform = `translate3d(${x}px, ${cy}px, 0) rotate(${r}deg) scale(${s})`;
    });

    const index = z < 1 ? 0 : Math.min(cards.length - 1, Math.round(pan / W));
    setActive(Number(cards[index].dataset.project));
    section.toggleAttribute("data-zoomed", z >= 1);
  };

  const queue = () => {
    if (!raf) raf = requestAnimationFrame(render);
  };

  const enable = () => {
    if (reduced.matches || cards.length < 2) {
      section.removeAttribute("data-mode");
      track.style.height = "";
      cards.forEach((c) => (c.style.transform = ""));
      return;
    }
    section.dataset.mode = "pinned";
    measure();
    render();
  };

  rail.forEach((b) =>
    b.addEventListener("click", () => {
      const project = Number(b.dataset.goto);
      const first = cards.findIndex((c) => Number(c.dataset.project) === project);
      if (section.dataset.mode !== "pinned") return cards[first]?.scrollIntoView({ block: "center" });
      window.scrollTo({ top: top + hold + zoom + first * W, behavior: "smooth" });
    }),
  );

  window.addEventListener("scroll", () => section.dataset.mode === "pinned" && queue(), { passive: true });
  new ResizeObserver(() => section.dataset.mode === "pinned" && (measure(), queue())).observe(stage);
  reduced.addEventListener("change", enable);
  setActive(0);
  enable();
}
