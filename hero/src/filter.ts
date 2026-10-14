type Filter = {
  chips: HTMLButtonElement[];
  items: HTMLElement[];
  /** Runs after visibility changes, inside the view transition when there is one */
  after?: (filter: string, visible: number) => void;
};

const PARAM = "f";

/** Facet chips over items carrying data-kinds. The active facet lives in ?f= so a filtered view can be linked. */
export function mountFilter({ chips, items, after }: Filter) {
  const known = new Set(chips.map((c) => c.dataset.filter!));

  const apply = (filter: string) => {
    let visible = 0;
    chips.forEach((c) => c.setAttribute("aria-pressed", String(c.dataset.filter === filter)));
    items.forEach((item) => {
      const show = filter === "all" || item.dataset.kinds!.split(" ").includes(filter);
      item.hidden = !show;
      if (show) {
        item.dataset.in = "";
        visible++;
      }
    });
    after?.(filter, visible);
    const url = new URL(window.location.href);
    if (filter === "all") url.searchParams.delete(PARAM);
    else url.searchParams.set(PARAM, filter);
    history.replaceState(null, "", url);
  };

  const set = (filter: string) => {
    const vt = (document as Document & { startViewTransition?: (cb: () => void) => unknown }).startViewTransition;
    if (vt && !window.matchMedia("(prefers-reduced-motion: reduce)").matches) vt.call(document, () => apply(filter));
    else apply(filter);
  };

  document.addEventListener("click", (e) => {
    const btn = (e.target as Element).closest<HTMLButtonElement>("button[data-filter]");
    if (btn) set(btn.dataset.filter!);
  });

  const initial = new URL(window.location.href).searchParams.get(PARAM);
  if (initial && known.has(initial)) apply(initial);
}
