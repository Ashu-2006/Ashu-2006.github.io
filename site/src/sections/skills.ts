/**
 * Skill(s): each row's Images / Description pair is a two-tab tablist (WAI-ARIA tabs pattern): click or arrow keys
 * switch, the inactive tab leaves the tab order, the inactive panel is hidden.
 */
export function mountSkills(root: HTMLElement): () => void {
  const offs = Array.from(root.querySelectorAll<HTMLElement>("[data-skill]")).map((row) => {
    const tabs = Array.from(row.querySelectorAll<HTMLButtonElement>('[role="tab"]'));
    const select = (on: HTMLButtonElement, focus = false) => {
      tabs.forEach((t) => {
        const active = t === on;
        t.setAttribute("aria-selected", String(active));
        t.tabIndex = active ? 0 : -1;
        const panel = row.querySelector<HTMLElement>(`#${t.getAttribute("aria-controls")}`);
        if (panel) panel.hidden = !active;
      });
      row.classList.toggle("is-text", on === tabs[1]);
      if (focus) on.focus();
    };
    const onClick = (e: Event) => {
      const t = (e.target as HTMLElement).closest<HTMLButtonElement>('[role="tab"]');
      if (t) select(t);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
      const i = tabs.indexOf(document.activeElement as HTMLButtonElement);
      if (i < 0) return;
      e.preventDefault();
      select(tabs[(i + (e.key === "ArrowRight" ? 1 : tabs.length - 1)) % tabs.length], true);
    };
    row.addEventListener("click", onClick);
    row.addEventListener("keydown", onKey);
    return () => {
      row.removeEventListener("click", onClick);
      row.removeEventListener("keydown", onKey);
    };
  });
  return () => offs.forEach((fn) => fn());
}
