import { SITE } from "../content";

const fmt = new Intl.DateTimeFormat("en-IN", { hour: "numeric", minute: "2-digit", hour12: true, timeZone: SITE.timeZone });

/** "4:07 pm" in Jabalpur */
export const localTime = () => fmt.format(new Date()).replace(/\s?(am|pm)$/i, (m) => ` ${m.trim().toLowerCase()}`);

/** Keeps every [data-clock] inside root on Jabalpur time. Returns a cleanup that stops the interval. */
export function mountClock(root: ParentNode): () => void {
  const els = Array.from(root.querySelectorAll<HTMLElement>("[data-clock]"));
  if (!els.length) return () => {};
  const tick = () => {
    const now = localTime();
    const iso = new Date().toISOString();
    els.forEach((el) => {
      if (el.textContent !== now) el.textContent = now;
      el.setAttribute("datetime", iso);
    });
  };
  tick();
  const id = window.setInterval(tick, 10000);
  return () => clearInterval(id);
}
