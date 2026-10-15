import { SITE } from "../content";
import { reducedMotion } from "./motion";

/** Film grain: one 256px noise tile drawn once, moved in six steps. Never an animated SVG filter. */
export function initGrain() {
  const el = document.querySelector<HTMLElement>(".grain");
  if (!el) return;
  const size = 256;
  const c = document.createElement("canvas");
  c.width = c.height = size;
  const ctx = c.getContext("2d")!;
  const img = ctx.createImageData(size, size);
  for (let i = 0; i < img.data.length; i += 4) {
    const v = Math.random() * 255;
    img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
    img.data[i + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  el.style.backgroundImage = `url(${c.toDataURL("image/png")})`;
}

/** Every [data-clock] shows the time in Jabalpur */
export function initClock() {
  const fmt = new Intl.DateTimeFormat("en-IN", { hour: "numeric", minute: "2-digit", hour12: true, timeZone: SITE.timeZone });
  const tick = () => {
    const now = fmt.format(new Date()).replace(/\s?(am|pm)$/i, (m) => ` ${m.trim().toLowerCase()}`);
    document.querySelectorAll<HTMLElement>("[data-clock]").forEach((el) => {
      if (el.textContent !== now) el.textContent = now;
      el.setAttribute("datetime", new Date().toISOString());
    });
  };
  tick();
  setInterval(tick, 15000);
  return tick;
}

/** Videos play only while on screen, and not at all under reduced motion (the poster stays) */
export function observeVideos(root: ParentNode) {
  const videos = root.querySelectorAll<HTMLVideoElement>("video[data-autoplay]");
  if (!videos.length) return () => {};
  if (reducedMotion()) {
    videos.forEach((v) => (v.controls = true));
    return () => {};
  }
  const io = new IntersectionObserver(
    (entries) => {
      for (const e of entries) {
        const v = e.target as HTMLVideoElement;
        if (e.isIntersecting) {
          v.preload = "auto";
          v.play().catch(() => {});
        } else v.pause();
      }
    },
    { rootMargin: "200px 0px" },
  );
  videos.forEach((v) => io.observe(v));
  return () => io.disconnect();
}
