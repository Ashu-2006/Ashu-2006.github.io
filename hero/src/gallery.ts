/** Scroll distance per frame, as a share of the viewport height. Four frames pin for about three screens. */
const STEP_VH = 0.7;
const DRAG_COMMIT_PX = 60;
const DRAG_START_PX = 6;

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));

/**
 * The home work row, after alimdesigner.com: frames sit in a line, one selected in the centre and the rest
 * receding in perspective. Vertical scroll steps between frames while the stage is pinned; arrows, drag,
 * the keyboard and clicking a side frame all step too. Reduced motion drops the pin and keeps the controls.
 */
export function mountGallery(section: HTMLElement) {
  const track = section.querySelector<HTMLElement>(".gallery-track")!;
  const stage = section.querySelector<HTMLElement>("[data-stage]")!;
  const row = section.querySelector<HTMLElement>("[data-row]")!;
  const frames = [...section.querySelectorAll<HTMLElement>("[data-frame]")];
  const count = section.querySelector<HTMLElement>("[data-count]")!;
  const cursor = section.querySelector<HTMLElement>("[data-cursor]")!;
  const help = section.querySelector<HTMLElement>("#gallery-help")!;
  const helpBtn = section.querySelector<HTMLButtonElement>("[data-help]")!;
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
  const n = frames.length;

  let active = -1;
  let pinned = false;
  let top = 0;
  let step = 0;
  let inView = false;

  const render = () => {
    frames.forEach((f, i) => {
      const o = i - active;
      f.style.setProperty("--o", String(o));
      f.style.setProperty("--a", String(Math.abs(o)));
      f.toggleAttribute("data-active", o === 0);
      f.querySelector<HTMLAnchorElement>(".frame-cta")!.tabIndex = o === 0 ? 0 : -1;
      const v = f.querySelector<HTMLVideoElement>("video");
      if (!v) return;
      if (o === 0 && inView && !reduced.matches) {
        v.preload = "auto";
        v.play().catch(() => {});
      } else v.pause();
    });
    count.textContent = String(active + 1);
    cursor.removeAttribute("data-move");
    void cursor.offsetWidth;
    cursor.setAttribute("data-move", "");
  };

  const setActive = (i: number) => {
    i = clamp(i, 0, n - 1);
    if (i === active) return;
    active = i;
    render();
  };

  const measure = () => {
    const vh = stage.clientHeight;
    step = vh * STEP_VH;
    track.style.height = pinned ? `${vh + step * (n - 1)}px` : "";
    top = track.getBoundingClientRect().top + window.scrollY;
  };

  const fromScroll = () => {
    if (!pinned) return;
    setActive(Math.round(clamp((window.scrollY - top) / step, 0, n - 1)));
  };

  const go = (i: number) => {
    i = clamp(i, 0, n - 1);
    if (!pinned) return setActive(i);
    window.scrollTo({ top: top + i * step + 1, behavior: reduced.matches ? "auto" : "smooth" });
  };

  /* Dock */
  section.querySelectorAll<HTMLButtonElement>("[data-step]").forEach((b) => b.addEventListener("click", () => go(active + Number(b.dataset.step))));

  const toggleHelp = (open = help.hidden) => {
    help.hidden = !open;
    helpBtn.setAttribute("aria-expanded", String(open));
    if (open) help.querySelector<HTMLElement>("[data-help-close]")!.focus();
  };
  helpBtn.addEventListener("click", () => toggleHelp());
  help.querySelector("[data-help-close]")!.addEventListener("click", () => (toggleHelp(false), helpBtn.focus()));

  /* Drag to slide. Capture starts only after real movement, so a plain tap still reaches the link */
  let startX = 0;
  let dx = 0;
  let dragging = false;
  let pointer = -1;
  let suppressClick = false;

  stage.addEventListener("pointerdown", (e) => {
    if ((e.target as Element).closest(".dock, .gallery-help") || e.button !== 0) return;
    pointer = e.pointerId;
    startX = e.clientX;
    dx = 0;
    dragging = false;
  });
  stage.addEventListener("pointermove", (e) => {
    if (e.pointerId !== pointer) return;
    dx = e.clientX - startX;
    if (!dragging && Math.abs(dx) > DRAG_START_PX) {
      dragging = true;
      stage.setPointerCapture(e.pointerId);
      stage.dataset.dragging = "";
    }
    if (dragging) row.style.setProperty("--drag", `${dx}px`);
  });
  const end = (e: PointerEvent) => {
    if (e.pointerId !== pointer) return;
    pointer = -1;
    if (!dragging) return;
    dragging = false;
    suppressClick = true;
    delete stage.dataset.dragging;
    row.style.setProperty("--drag", "0px");
    if (Math.abs(dx) > DRAG_COMMIT_PX) go(active - Math.sign(dx));
    window.setTimeout(() => (suppressClick = false), 0);
  };
  stage.addEventListener("dragstart", (e) => e.preventDefault());
  stage.addEventListener("pointerup", end);
  stage.addEventListener("pointercancel", end);

  /* A side frame steps to itself; only the centre frame navigates */
  frames.forEach((f, i) =>
    f.querySelector("a.frame-box")!.addEventListener("click", (e) => {
      if (suppressClick || i !== active) {
        e.preventDefault();
        if (!suppressClick) go(i);
      }
    }),
  );

  document.addEventListener("keydown", (e) => {
    if (!inView || e.altKey || e.metaKey || e.ctrlKey) return;
    if ((e.target as Element).closest("input, textarea, select, dialog")) return;
    if (e.key === "ArrowRight") (e.preventDefault(), go(active + 1));
    else if (e.key === "ArrowLeft") (e.preventDefault(), go(active - 1));
    else if (e.key === "Escape" && !help.hidden) toggleHelp(false);
  });

  new IntersectionObserver(
    ([entry]) => {
      inView = entry.isIntersecting;
      render();
    },
    { threshold: 0.5 },
  ).observe(stage);

  const enable = () => {
    pinned = !reduced.matches;
    section.dataset.mode = pinned ? "pinned" : "static";
    measure();
    fromScroll();
  };

  let raf = 0;
  window.addEventListener("scroll", () => (raf ||= requestAnimationFrame(() => ((raf = 0), fromScroll()))), { passive: true });
  new ResizeObserver(() => (measure(), fromScroll())).observe(stage);
  reduced.addEventListener("change", enable);
  setActive(0);
  enable();
}
