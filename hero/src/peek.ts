const FOLLOW = 0.16;
const TILT_PER_PX = 0.12;
const MAX_TILT = 7;
/** Hover this long before the preview starts cycling, then advance at the same pace */
const CYCLE_MS = 1100;

type Shot = { url: string; label: string };

const parse = (data: string): Shot[] =>
  data.split("|").map((pair) => {
    const [url, label = ""] = pair.split("::");
    return { url, label };
  });

/**
 * A preview that trails the cursor over index rows. A row with several images crossfades through them
 * while it stays hovered; hovering a project link inside the row pins the preview to that project.
 * Fine pointers only; touch gets the inline thumbnails.
 */
export function mountPeek() {
  const frame = document.querySelector<HTMLElement>("[data-peek-frame]");
  if (!frame || !window.matchMedia("(hover: hover) and (pointer: fine)").matches) return;
  const layers = [...frame.querySelectorAll("img")];
  const label = frame.querySelector<HTMLElement>("[data-peek-label]")!;
  const rows = [...document.querySelectorAll<HTMLElement>("[data-peek]")];

  let x = 0;
  let y = 0;
  let tx = 0;
  let ty = 0;
  let raf = 0;
  let active = false;
  let shots: Shot[] = [];
  let index = 0;
  let layer = 0;
  let timer = 0;
  let warmed = false;

  const warm = () => {
    if (warmed) return;
    warmed = true;
    rows.forEach((r) => parse(r.dataset.peek!).forEach((s) => (new Image().src = s.url)));
  };

  const show = (i: number) => {
    index = (i + shots.length) % shots.length;
    const shot = shots[index];
    const next = layers[layer ^ 1];
    next.src = shot.url;
    const swap = () => {
      layers[layer].removeAttribute("data-on");
      next.setAttribute("data-on", "");
      layer ^= 1;
      label.textContent = shots.length > 1 ? shot.label : "";
    };
    next.decode().then(swap, swap);
  };

  const cycle = (on: boolean) => {
    window.clearInterval(timer);
    if (on && shots.length > 1) timer = window.setInterval(() => show(index + 1), CYCLE_MS);
  };

  const loop = () => {
    const dx = tx - x;
    x += dx * FOLLOW;
    y += (ty - y) * FOLLOW;
    const tilt = Math.max(-MAX_TILT, Math.min(MAX_TILT, dx * TILT_PER_PX));
    frame.style.transform = `translate3d(${x}px, ${y}px, 0) rotate(${tilt}deg)`;
    raf = active || Math.abs(dx) > 0.5 ? requestAnimationFrame(loop) : 0;
  };

  const hide = () => {
    active = false;
    cycle(false);
    delete frame.dataset.on;
  };

  rows.forEach((row) => {
    row.addEventListener("pointerenter", (e) => {
      warm();
      if (!active) {
        x = tx = e.clientX;
        y = ty = e.clientY;
      }
      active = true;
      shots = parse(row.dataset.peek!);
      show(0);
      cycle(true);
      frame.dataset.on = "";
      raf ||= requestAnimationFrame(loop);
    });
    row.addEventListener("pointerleave", hide);
    row.addEventListener("pointermove", (e) => {
      tx = e.clientX;
      ty = e.clientY;
    });
    row.querySelectorAll<HTMLElement>("[data-peek-i]").forEach((link) => {
      link.addEventListener("pointerenter", () => {
        cycle(false);
        show(Number(link.dataset.peekI));
      });
      link.addEventListener("pointerleave", () => cycle(true));
    });
  });
  window.addEventListener("scroll", () => active && hide(), { passive: true });
}
