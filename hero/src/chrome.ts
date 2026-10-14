const reduced = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const finePointer = () => window.matchMedia("(hover: hover) and (pointer: fine)").matches;
const TOAST_MS = 2200;
const HEADER_SLACK = 8;

/** Behaviour every page shares.  */
export function mountChrome() {
  fadeIn();
  autoplay();
  hoverVideos();
  clock();
  copy();
  headroom();
  document.querySelectorAll("[data-year]").forEach((el) => (el.textContent = String(new Date().getFullYear())));
}

function fadeIn() {
  const io = new IntersectionObserver(
    (entries) =>
      entries.forEach((e) => {
        if (!e.isIntersecting) return;
        (e.target as HTMLElement).dataset.in = "";
        io.unobserve(e.target);
      }),
    { rootMargin: "0px 0px -8% 0px" },
  );
  document.querySelectorAll("[data-fade]").forEach((el) => io.observe(el));
}

/** Loops only play while on screen. With reduced motion they stay on their poster and get controls instead. */
function autoplay() {
  const videos = [...document.querySelectorAll<HTMLVideoElement>("video[data-autoplay]")];
  if (reduced()) {
    videos.forEach((v) => (v.controls = true));
    return;
  }
  const io = new IntersectionObserver(
    (entries) =>
      entries.forEach((e) => {
        const v = e.target as HTMLVideoElement;
        if (e.isIntersecting && !document.documentElement.hasAttribute("data-motion-off")) {
          v.preload = "auto";
          v.play().catch(() => (v.controls = true));
        } else v.pause();
      }),
    { threshold: 0.2 },
  );
  videos.forEach((v) => io.observe(v));
}

function hoverVideos() {
  if (!finePointer() || reduced()) return;
  document.querySelectorAll<HTMLVideoElement>("video[data-hover]").forEach((v) => {
    const host = v.closest("a") ?? v.parentElement!;
    host.addEventListener("pointerenter", () => {
      v.play().then(() => (v.dataset.playing = "")).catch(() => {});
    });
    host.addEventListener("pointerleave", () => {
      v.pause();
      delete v.dataset.playing;
    });
  });
}

function clock() {
  const el = document.querySelector<HTMLElement>("[data-clock]");
  if (!el) return;
  const fmt = new Intl.DateTimeFormat("en-GB", { timeZone: el.dataset.tz, hour: "2-digit", minute: "2-digit", hour12: false });
  const tick = () => (el.textContent = `${fmt.format(new Date())} IST`);
  tick();
  window.setInterval(tick, 15_000);
}

export function toast(message: string) {
  const el = document.querySelector<HTMLElement>("[data-toast]");
  if (!el) return;
  el.textContent = message;
  el.dataset.on = "";
  window.clearTimeout(Number(el.dataset.timer));
  el.dataset.timer = String(window.setTimeout(() => delete el.dataset.on, TOAST_MS));
}

function copy() {
  document.querySelectorAll<HTMLButtonElement>("[data-copy]").forEach((btn) => {
    const label = btn.querySelector<HTMLElement>("[data-copy-label]");
    const idle = label?.textContent ?? "";
    btn.addEventListener("click", async () => {
      const text = btn.dataset.copy!;
      try {
        await navigator.clipboard.writeText(text);
        toast(`Copied ${text}`);
        if (label) {
          label.textContent = "Copied";
          window.setTimeout(() => (label.textContent = idle), TOAST_MS);
        }
      } catch {
        window.location.href = `mailto:${text}`;
      }
    });
  });
}

/** Subpage header tucks away on scroll down and returns on any scroll up. */
function headroom() {
  const header = document.querySelector<HTMLElement>(".site-header-sub");
  if (!header) return;
  let last = window.scrollY;
  let raf = 0;
  const update = () => {
    raf = 0;
    const y = window.scrollY;
    if (Math.abs(y - last) < HEADER_SLACK) return;
    header.toggleAttribute("data-hidden", y > last && y > header.offsetHeight * 2 && !header.contains(document.activeElement));
    header.toggleAttribute("data-stuck", y > 4);
    last = y;
  };
  window.addEventListener("scroll", () => (raf ||= requestAnimationFrame(update)), { passive: true });
}
