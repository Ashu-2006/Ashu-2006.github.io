import { lenis, startScroll, stopScroll } from "./scroll";

/**
 * The header takes the ink of whichever section is under it, hides while reading downward
 * and returns on any upward scroll. The mobile menu is a full-screen sheet.
 */
export function initHeader() {
  const head = document.querySelector<HTMLElement>("[data-head]")!;
  const menu = document.querySelector<HTMLElement>("[data-menu]")!;
  const menuBtn = document.querySelector<HTMLButtonElement>("[data-menu-toggle]")!;
  let lastY = scrollY;
  let fg = "";

  const sample = () => {
    const probe = head.offsetHeight / 2;
    const sections = document.querySelectorAll<HTMLElement>("main [data-section], main [data-theme]");
    let hit: HTMLElement | null = null;
    for (const s of sections) {
      const r = s.getBoundingClientRect();
      if (r.top <= probe && r.bottom > probe) hit = s;
    }
    if (!hit) return;
    const next = getComputedStyle(hit).getPropertyValue("--fg").trim();
    if (next && next !== fg) {
      fg = next;
      head.style.setProperty("--head-fg", next);
    }
  };

  const onScroll = () => {
    const y = scrollY;
    const down = y > lastY + 2;
    const up = y < lastY - 2;
    if (down && y > 240) head.dataset.hidden = "";
    if (up || y < 80) delete head.dataset.hidden;
    lastY = y;
    sample();
  };

  window.addEventListener("scroll", onScroll, { passive: true });
  window.addEventListener("resize", sample);

  const setMenu = (open: boolean) => {
    menu.hidden = !open;
    menuBtn.setAttribute("aria-expanded", String(open));
    menuBtn.textContent = open ? "Close" : "Menu";
    document.documentElement.classList.toggle("menu-open", open);
    if (open) stopScroll();
    else startScroll();
  };
  menuBtn.addEventListener("click", () => setMenu(menu.hidden));
  menu.addEventListener("click", (e) => {
    if ((e.target as Element).closest("a")) setMenu(false);
  });
  window.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !menu.hidden) setMenu(false);
  });

  return {
    /** Re-read the ground after a route swap */
    refresh() {
      fg = "";
      delete head.dataset.hidden;
      lastY = lenis?.scroll ?? scrollY;
      sample();
    },
  };
}
