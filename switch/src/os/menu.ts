import { esc } from "../lib/html";

/**
 * Win98 menu bars for OS windows. Click a menu to open it; while one is open, hovering another switches
 * to it. Arrow keys move through items and between menus, Right and Left open and close submenus,
 * Enter activates, Esc or a click outside closes. Alt plus the underlined letter opens a menu from
 * anywhere inside the window. Every item runs a real action through the window's onMenu handler.
 */

export type MenuItem = { label: string; action: string; key?: string; checked?: boolean } | { label: string; sub: MenuItem[] } | "sep";
export type Menu = { label: string; items: MenuItem[] | (() => MenuItem[]) };

const itemsOf = (m: Menu) => (typeof m.items === "function" ? m.items() : m.items);

/** The menu bar markup. The first letter of each label is its Alt access key. */
export function menubar(menus: Menu[]) {
  return `<div class="os-win__menu" role="menubar">${menus
    .map(
      (m, i) =>
        `<button class="os-menubtn" type="button" role="menuitem" aria-haspopup="menu" aria-expanded="false" data-menu="${i}" tabindex="${i === 0 ? 0 : -1}"><u>${esc(m.label[0])}</u>${esc(m.label.slice(1))}</button>`,
    )
    .join("")}</div>`;
}

function popup(items: MenuItem[]) {
  const el = document.createElement("div");
  el.className = "os-menu";
  el.setAttribute("role", "menu");
  el.innerHTML = items
    .map((it, i) => {
      if (it === "sep") return '<div class="os-menu__sep" role="separator"></div>';
      if ("sub" in it) {
        return `<button class="os-menu__item" type="button" role="menuitem" aria-haspopup="menu" aria-expanded="false" data-sub="${i}" tabindex="-1"><span class="os-menu__check"></span><span class="os-menu__label">${esc(it.label)}</span><span class="os-menu__arrow" aria-hidden="true"></span></button>`;
      }
      const role = it.checked === undefined ? "menuitem" : "menuitemradio";
      const checked = it.checked === undefined ? "" : ` aria-checked="${it.checked}"`;
      return `<button class="os-menu__item" type="button" role="${role}"${checked} data-action="${esc(it.action)}" tabindex="-1"><span class="os-menu__check" aria-hidden="true"></span><span class="os-menu__label">${esc(it.label)}</span><span class="os-menu__key">${esc(it.key ?? "")}</span></button>`;
    })
    .join("");
  return el;
}

const focusables = (menu: HTMLElement) => [...menu.querySelectorAll<HTMLElement>(":scope > .os-menu__item")];

/** Wires a window's menu bar. Returns the cleanup. */
export function wireMenubar(win: HTMLElement, menus: Menu[], run: (action: string) => void) {
  const bar = win.querySelector<HTMLElement>(".os-win__menu");
  if (!bar) return () => {};
  const buttons = [...bar.querySelectorAll<HTMLButtonElement>("[data-menu]")];
  let open = -1;
  let stack: HTMLElement[] = [];

  const closeFrom = (depth: number) => {
    while (stack.length > depth) {
      const m = stack.pop()!;
      m.remove();
    }
    if (depth === 0) {
      buttons.forEach((b) => {
        b.setAttribute("aria-expanded", "false");
        b.classList.remove("is-open");
      });
      open = -1;
    } else {
      stack[depth - 1].querySelectorAll("[data-sub]").forEach((s) => s.setAttribute("aria-expanded", "false"));
    }
  };

  const showMenu = (i: number, focusFirst: boolean) => {
    closeFrom(0);
    const b = buttons[i];
    const items = itemsOf(menus[i]);
    const m = popup(items);
    win.append(m);
    const wr = win.getBoundingClientRect();
    const br = b.getBoundingClientRect();
    m.style.left = `${br.left - wr.left}px`;
    m.style.top = `${br.bottom - wr.top}px`;
    stack = [m];
    open = i;
    b.setAttribute("aria-expanded", "true");
    b.classList.add("is-open");
    wireLevel(m, items, 0);
    if (focusFirst) focusables(m)[0]?.focus({ preventScroll: true });
  };

  const showSub = (trigger: HTMLElement, items: MenuItem[], depth: number, focusFirst: boolean) => {
    closeFrom(depth + 1);
    const m = popup(items);
    win.append(m);
    const wr = win.getBoundingClientRect();
    const tr = trigger.getBoundingClientRect();
    m.style.left = `${tr.right - wr.left - 3}px`;
    m.style.top = `${tr.top - wr.top - 3}px`;
    stack.push(m);
    trigger.setAttribute("aria-expanded", "true");
    wireLevel(m, items, depth + 1);
    if (focusFirst) focusables(m)[0]?.focus({ preventScroll: true });
  };

  const wireLevel = (m: HTMLElement, items: MenuItem[], depth: number) => {
    m.addEventListener("click", (e) => {
      const t = (e.target as Element).closest<HTMLElement>(".os-menu__item");
      if (!t) return;
      if (t.dataset.sub) {
        const it = items[Number(t.dataset.sub)];
        if (it !== "sep" && "sub" in it) showSub(t, it.sub, depth, e.detail === 0);
        return;
      }
      const action = t.dataset.action!;
      closeFrom(0);
      buttons[0]?.focus({ preventScroll: true });
      run(action);
    });
    m.addEventListener("pointerover", (e) => {
      const t = (e.target as Element).closest<HTMLElement>(".os-menu__item");
      if (!t) return;
      t.focus({ preventScroll: true });
      if (t.dataset.sub) {
        const it = items[Number(t.dataset.sub)];
        if (it !== "sep" && "sub" in it && t.getAttribute("aria-expanded") !== "true") showSub(t, it.sub, depth, false);
      } else closeFrom(depth + 1);
    });
    m.addEventListener("keydown", (e) => {
      const list = focusables(m);
      const i = list.indexOf(document.activeElement as HTMLElement);
      const t = list[i];
      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault();
        list[(i + (e.key === "ArrowDown" ? 1 : -1) + list.length) % list.length]?.focus({ preventScroll: true });
      } else if (e.key === "Home" || e.key === "End") {
        e.preventDefault();
        list[e.key === "Home" ? 0 : list.length - 1]?.focus({ preventScroll: true });
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        if (t?.dataset.sub) {
          const it = items[Number(t.dataset.sub)];
          if (it !== "sep" && "sub" in it) showSub(t, it.sub, depth, true);
        } else showMenu((open + 1) % buttons.length, true);
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        if (depth > 0) {
          const trigger = stack[depth - 1].querySelector<HTMLElement>('[aria-expanded="true"]');
          closeFrom(depth);
          trigger?.focus({ preventScroll: true });
        } else showMenu((open - 1 + buttons.length) % buttons.length, true);
      } else if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        const back = open;
        closeFrom(0);
        buttons[back]?.focus({ preventScroll: true });
      } else if (e.key === "Tab") closeFrom(0);
    });
  };

  const onBarClick = (e: MouseEvent) => {
    const b = (e.target as Element).closest<HTMLElement>("[data-menu]");
    if (!b) return;
    const i = Number(b.dataset.menu);
    if (open === i) closeFrom(0);
    else showMenu(i, e.detail === 0);
  };
  const onBarOver = (e: PointerEvent) => {
    const b = (e.target as Element).closest<HTMLElement>("[data-menu]");
    if (!b || open < 0) return;
    const i = Number(b.dataset.menu);
    if (i !== open) showMenu(i, false);
  };
  const onBarKey = (e: KeyboardEvent) => {
    const i = buttons.indexOf(document.activeElement as HTMLButtonElement);
    if (i < 0) return;
    if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
      e.preventDefault();
      const n = (i + (e.key === "ArrowRight" ? 1 : -1) + buttons.length) % buttons.length;
      buttons.forEach((b, j) => (b.tabIndex = j === n ? 0 : -1));
      buttons[n].focus({ preventScroll: true });
      if (open >= 0) showMenu(n, false);
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      showMenu(i, true);
    } else if (e.key === "Escape" && open >= 0) {
      e.preventDefault();
      e.stopPropagation();
      closeFrom(0);
    }
  };
  /* Alt + the underlined letter opens that menu while focus is anywhere in the window */
  const onWinKey = (e: KeyboardEvent) => {
    if (!e.altKey || e.ctrlKey || e.metaKey || e.key.length !== 1) return;
    const i = menus.findIndex((m) => m.label[0].toLowerCase() === e.key.toLowerCase());
    if (i < 0) return;
    e.preventDefault();
    buttons[i].focus({ preventScroll: true });
    showMenu(i, true);
  };
  const onDocDown = (e: PointerEvent) => {
    if (open < 0) return;
    const t = e.target as Element;
    if (stack.some((m) => m.contains(t)) || bar.contains(t)) return;
    closeFrom(0);
  };

  bar.addEventListener("click", onBarClick);
  bar.addEventListener("pointerover", onBarOver);
  bar.addEventListener("keydown", onBarKey);
  win.addEventListener("keydown", onWinKey);
  document.addEventListener("pointerdown", onDocDown, true);
  return () => {
    closeFrom(0);
    bar.removeEventListener("click", onBarClick);
    bar.removeEventListener("pointerover", onBarOver);
    bar.removeEventListener("keydown", onBarKey);
    win.removeEventListener("keydown", onWinKey);
    document.removeEventListener("pointerdown", onDocDown, true);
  };
}
