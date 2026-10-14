import { mountFilter } from "./filter";

const VIEW_KEY = "work-view";

export function mountArchive() {
  const views = document.querySelector<HTMLElement>("[data-views]")!;
  const seg = [...document.querySelectorAll<HTMLButtonElement>(".seg [data-view]")];
  const shelves = [...views.querySelectorAll<HTMLElement>("[data-shelf]")];
  const empty = views.querySelector<HTMLElement>("[data-empty]")!;

  const setView = (view: string) => {
    views.dataset.view = view;
    seg.forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.view === view)));
    try {
      localStorage.setItem(VIEW_KEY, view);
    } catch {
      /* Storage can be blocked in private windows; the toggle still works for this visit */
    }
  };
  seg.forEach((b) => b.addEventListener("click", () => setView(b.dataset.view!)));
  try {
    const saved = localStorage.getItem(VIEW_KEY);
    if (saved === "list" || saved === "grid") setView(saved);
  } catch {
    /* No stored preference available; grid stays the default */
  }

  mountFilter({
    chips: [...document.querySelectorAll<HTMLButtonElement>(".toolbar [data-filter]")],
    items: [...views.querySelectorAll<HTMLElement>("[data-kinds]")],
    after: () => {
      shelves.forEach((s) => (s.hidden = !s.querySelector("li:not([hidden])")));
      const anyGrid = shelves.some((s) => !s.hidden);
      empty.hidden = anyGrid;
    },
  });
}
