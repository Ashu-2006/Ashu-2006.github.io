import { observeVideos } from "../core/ambient";
import { ABOUT, KINDS, PLAY, PLAY_KINDS, PROJECTS, SITE, SOCIALS, type Play, type Project } from "../content";
import { esc, mediaTag } from "../lib/html";
import { icon, type IconName } from "./icons";
import type { Menu, MenuItem } from "./menu";
import { blip } from "./sound";
import { read, write } from "./store";
import { closeWindow, isPhone, openWindow, retarget, type Win, type WinSpec } from "./wm";

/**
 * What each desktop icon opens. Every window is a WinSpec built from content, so the words and media
 * match the modern site exactly. Rule: no dead clicks. Every visible control does something real.
 * Anything that changes the route goes through openPage, which flips back to 2026 first.
 */

const BASE = import.meta.env.BASE_URL;

export const CASES = PROJECTS.filter((p) => p.tier === "case");
export const docName = (p: Project) => `${p.name}.doc`;

let openPage: (path: string) => void = () => {};
/** The OS entry provides the flip-then-route action used by menus and "Open in browser" buttons */
export const setPageOpener = (fn: (path: string) => void) => void (openPage = fn);

const button = (label: string, attrs = "", cls = "") =>
  `<button class="os-btn os-btn--text${cls ? ` ${cls}` : ""}" type="button" ${attrs}>${label}</button>`;

/** A button that flips back to 2026 and routes to `path` (relative to base); wired by the OS entry */
const pageButton = (label: string, path: string, cls = "") => button(label, `data-open-page="${esc(path)}"`, cls);

const paras = (list: string[] | undefined) => (list ?? []).map((t) => `<p>${esc(t)}</p>`).join("");

/** Menu actions every window understands */
function common(action: string, w: Win) {
  if (action === "close") void closeWindow(w);
  else if (action === "help") openWindow(welcomeWindow());
  else if (action.startsWith("page:")) openPage(action.slice(5));
}

const HELP: Menu = { label: "Help", items: [{ label: "How to use ASH/OS", action: "help" }] };

/* WordPad reading preferences, shared by every document window and kept between visits */

const FONTS = [
  { id: "serif", label: "Instrument Serif", css: "var(--f-serif)" },
  { id: "sans", label: "Instrument Sans", css: "var(--f-sans)" },
  { id: "mono", label: "JetBrains Mono", css: "var(--f-mono)" },
  { id: "pixel", label: "Tiny5", css: "var(--f-pixel)" },
] as const;
const SIZES = [10, 12, 14, 16, 18, 20] as const;
const DEFAULT_SIZE = 18;

let docFont: string = FONTS.some((f) => f.id === read("switch:doc-font")) ? read("switch:doc-font")! : "serif";
let docSize: number = SIZES.includes(Number(read("switch:doc-size")) as (typeof SIZES)[number]) ? Number(read("switch:doc-size")) : DEFAULT_SIZE;

function applyDocPrefs() {
  const root = document.documentElement.style;
  root.setProperty("--os-doc-font", FONTS.find((f) => f.id === docFont)!.css);
  root.setProperty("--os-doc-size", `${docSize}px`);
  document.querySelectorAll<HTMLSelectElement>("select[data-doc-font]").forEach((s) => (s.value = docFont));
  document.querySelectorAll<HTMLSelectElement>("select[data-doc-size]").forEach((s) => (s.value = String(docSize)));
}

function setDocFont(id: string) {
  if (!FONTS.some((f) => f.id === id)) return;
  docFont = id;
  write("switch:doc-font", id);
  applyDocPrefs();
}

function setDocSize(n: number) {
  docSize = n;
  write("switch:doc-size", String(n));
  applyDocPrefs();
}

/** Zoom steps through the size list: +1 bigger, -1 smaller, 0 back to the default */
function zoomDoc(dir: 1 | -1 | 0) {
  if (dir === 0) return setDocSize(DEFAULT_SIZE);
  const i = SIZES.indexOf(docSize as (typeof SIZES)[number]);
  setDocSize(SIZES[Math.max(0, Math.min(SIZES.length - 1, i + dir))]);
}

const figure = (shot: Project["shots"][number], lead = false) =>
  `<figure class="os-case__fig${lead ? " os-case__fig--lead" : ""}">${mediaTag(BASE, shot.file, shot.alt)}${shot.caption ? `<figcaption>${esc(shot.caption)}</figcaption>` : ""}</figure>`;

const neighbour = (p: Project, step: 1 | -1) => PROJECTS[(PROJECTS.indexOf(p) + step + PROJECTS.length) % PROJECTS.length];

const docMenus = (p: Project): Menu[] => [
  {
    label: "File",
    items: [
      { label: "Open full case", action: `page:work/${p.slug}/` },
      { label: `Previous: ${neighbour(p, -1).name}`, action: "prev" },
      { label: `Next: ${neighbour(p, 1).name}`, action: "next" },
      "sep",
      { label: "Close", action: "close", key: "Esc" },
    ],
  },
  {
    label: "View",
    items: (): MenuItem[] => [
      { label: "Zoom in", action: "zoom-in", key: "Ctrl +" },
      { label: "Zoom out", action: "zoom-out", key: "Ctrl -" },
      { label: "Reset zoom", action: "zoom-reset", key: "Ctrl 0" },
      "sep",
      { label: "Reading font", sub: FONTS.map((f) => ({ label: f.label, action: `font:${f.id}`, checked: f.id === docFont })) },
    ],
  },
  { label: "Help", items: [{ label: "How to use ASH/OS", action: "help" }, { label: "About WordPad", action: "about-wordpad" }] },
];

function docAction(action: string, p: Project, w: Win) {
  if (action === "prev" || action === "next") retarget(w, docWindow(neighbour(p, action === "next" ? 1 : -1)));
  else if (action === "zoom-in") zoomDoc(1);
  else if (action === "zoom-out") zoomDoc(-1);
  else if (action === "zoom-reset") zoomDoc(0);
  else if (action.startsWith("font:")) setDocFont(action.slice(5));
  else if (action === "about-wordpad")
    openWindow(
      alertWindow(
        "wordpad",
        "About WordPad",
        "WordPad shows each project as one long case study. Change the reading font and size from the toolbar or the View menu, and step through projects with Previous and Next.",
        "doc",
      ),
    );
  else common(action, w);
}

/**
 * A project as a WordPad document: the whole case study, typeset for reading in the window. Headline,
 * facts, problem, work, the decision, result, links and every shot with its caption, in content order.
 * The toolbar changes the reading font and size (saved for every document) and steps between projects.
 */
export function docWindow(p: Project): WinSpec {
  const [cover, ...rest] = p.shots;
  const mid = Math.ceil(rest.length / 2);
  const kinds = p.kinds.map((k) => KINDS[k]).join(", ");
  const decision = p.decision
    ? `<section class="os-case__sec"><h3 class="os-case__h">A decision: <em>${esc(p.decision.title)}</em></h3>
      <dl class="os-case__decision"><div><dt>Context</dt><dd>${esc(p.decision.context)}</dd></div><div><dt>Choice</dt><dd>${esc(p.decision.choice)}</dd></div><div><dt>Cost</dt><dd>${esc(p.decision.cost)}</dd></div></dl></section>`
    : "";
  const links = p.links?.length
    ? `<section class="os-case__sec"><h3 class="os-case__h">Links</h3><ul class="os-case__links">${p.links
        .map((l) => `<li><a class="os-link" href="${esc(l.href)}" target="_blank" rel="noopener">${esc(l.label)}</a></li>`)
        .join("")}</ul></section>`
    : "";
  const fontOptions = FONTS.map((f) => `<option value="${f.id}"${f.id === docFont ? " selected" : ""}>${esc(f.label)}</option>`).join("");
  const sizeOptions = SIZES.map((s) => `<option value="${s}"${s === docSize ? " selected" : ""}>${s}</option>`).join("");
  const body = `<div class="os-doc">
  <div class="os-doc__tools">
    <label class="os-doc__ctl"><span class="os-sr">Reading font</span><select class="os-select" data-doc-font>${fontOptions}</select></label>
    <label class="os-doc__ctl"><span class="os-sr">Text size</span><select class="os-select os-select--size" data-doc-size>${sizeOptions}</select></label>
    <span class="os-doc__sep" aria-hidden="true"></span>
    ${button("Previous", `data-doc-step="-1" title="${esc(neighbour(p, -1).name)}"`, "os-btn--sm os-btn--prev")}
    ${button("Next", `data-doc-step="1" title="${esc(neighbour(p, 1).name)}"`, "os-btn--sm os-btn--next")}
    <span class="os-doc__spacer"></span>${pageButton("Open full case", `work/${p.slug}/`, "os-btn--sm")}
  </div>
  <div class="os-doc__desk os-field" data-scroll tabindex="-1">
    <article class="os-doc__page os-case" aria-label="${esc(p.name)} case study">
      <p class="os-case__kicker">${esc(p.org)} . ${esc(p.year)} . ${esc(kinds)}</p>
      <h2 class="os-case__title">${esc(p.name)}</h2>
      <p class="os-case__headline">${esc(p.headline)}</p>
      <dl class="os-case__facts">
        <div><dt>Year</dt><dd>${esc(p.year)}</dd></div>
        <div><dt>Org</dt><dd>${esc(p.org)}</dd></div>
        <div><dt>Status</dt><dd>${esc(p.evidence)}</dd></div>
        <div><dt>Role</dt><dd>${esc(p.role.join(", "))}</dd></div>
        <div><dt>Kind</dt><dd>${esc(kinds)}</dd></div>
      </dl>
      <p class="os-case__lead">${esc(p.summary)}</p>
      ${cover ? figure(cover, true) : ""}
      ${p.problem?.length ? `<section class="os-case__sec"><h3 class="os-case__h">The problem</h3>${paras(p.problem)}</section>` : ""}
      <section class="os-case__sec"><h3 class="os-case__h">The work</h3>${paras(p.work)}</section>
      ${rest.slice(0, mid).map((s) => figure(s)).join("")}
      ${decision}
      ${rest.slice(mid).map((s) => figure(s)).join("")}
      <section class="os-case__sec"><h3 class="os-case__h">Result</h3>${paras(p.result)}</section>
      ${links}
      <div class="os-case__end">
        <p class="os-case__endnote">Next: <strong>${esc(neighbour(p, 1).name)}</strong></p>
        <p class="os-case__endbtns">${button("Next case", 'data-doc-step="1"', "os-btn--default")}${pageButton("Open full case", `work/${p.slug}/`)}</p>
      </div>
    </article>
  </div>
  <div class="os-status" aria-hidden="true"><span data-pages>Page 1</span><span>${esc(kinds)}</span><span>${esc(p.evidence)}</span></div>
</div>`;
  return {
    id: `doc:${p.slug}`,
    title: `${docName(p)} - WordPad`,
    icon: "doc",
    kind: "doc",
    w: 1040,
    h: 900,
    large: true,
    body,
    menus: docMenus(p),
    onMenu: (a, _el, w) => docAction(a, p, w),
    mount(el, w) {
      applyDocPrefs();
      const desk = el.querySelector<HTMLElement>("[data-scroll]")!;
      const status = el.querySelector<HTMLElement>("[data-pages]")!;
      const onScroll = () => {
        const total = Math.max(1, Math.ceil(desk.scrollHeight / Math.max(1, desk.clientHeight)));
        const at = Math.min(total, Math.floor(desk.scrollTop / Math.max(1, desk.clientHeight)) + 1);
        status.textContent = `Page ${at} of ${total}`;
      };
      const onChange = (e: Event) => {
        const t = e.target as HTMLSelectElement;
        if (t.matches("[data-doc-font]")) setDocFont(t.value);
        else if (t.matches("[data-doc-size]")) setDocSize(Number(t.value));
        onScroll();
      };
      const onClick = (e: MouseEvent) => {
        const step = (e.target as Element).closest<HTMLElement>("[data-doc-step]");
        if (step) docAction(step.dataset.docStep === "1" ? "next" : "prev", p, w);
      };
      const onKey = (e: KeyboardEvent) => {
        if (!(e.ctrlKey || e.metaKey) || e.altKey) return;
        const dir = e.key === "+" || e.key === "=" ? 1 : e.key === "-" ? -1 : e.key === "0" ? 0 : null;
        if (dir === null) return;
        e.preventDefault();
        zoomDoc(dir);
        onScroll();
      };
      desk.addEventListener("scroll", onScroll, { passive: true });
      el.addEventListener("change", onChange);
      el.addEventListener("click", onClick);
      el.addEventListener("keydown", onKey);
      requestAnimationFrame(onScroll);
      const stop = observeVideos(el);
      return () => {
        desk.removeEventListener("scroll", onScroll);
        el.removeEventListener("change", onChange);
        el.removeEventListener("click", onClick);
        el.removeEventListener("keydown", onKey);
        stop();
      };
    },
  };
}

type Row = { id: string; icon: IconName; cells: string[] };

/** Explorer details view. Column headers sort; a click on a row opens it. */
function listView(cols: string[], grid: string, rows: Row[], label: string) {
  const head = `<div class="os-list__head">${cols.map((c, i) => `<button class="os-btn os-list__col" type="button" data-sort="${i}" title="Sort by ${esc(c.toLowerCase())}">${esc(c)}</button>`).join("")}</div>`;
  const items = rows
    .map(
      (r) =>
        `<li><button class="os-list__row" type="button" data-row="${esc(r.id)}">${r.cells
          .map((c, i) => `<span class="os-list__cell">${i === 0 ? icon(r.icon, 16) : ""}<span class="os-list__text">${esc(c)}</span></span>`)
          .join("")}</button></li>`,
    )
    .join("");
  return `<div class="os-list os-field" style="--os-grid:${grid}" data-scroll>${head}<ul class="os-list__rows" aria-label="${esc(label)}">${items}</ul></div>`;
}

/** Any [data-row] opens on click (mouse, tap or Enter); any [data-sort] header sorts its list */
function wireRows(el: HTMLElement, onOpen: (id: string, from: HTMLElement) => void) {
  const dir = new Map<HTMLElement, number>();
  const onClick = (e: MouseEvent) => {
    const t = e.target as Element;
    const sort = t.closest<HTMLElement>("[data-sort]");
    if (sort) {
      const list = sort.closest(".os-list")!.querySelector<HTMLElement>(".os-list__rows")!;
      const col = Number(sort.dataset.sort);
      const d = -(dir.get(sort) ?? -1);
      dir.clear();
      dir.set(sort, d);
      sort.parentElement!.querySelectorAll("[data-sort]").forEach((b) => b.removeAttribute("data-dir"));
      sort.dataset.dir = d > 0 ? "up" : "down";
      const text = (li: Element) => li.querySelectorAll(".os-list__text")[col]?.textContent ?? "";
      const lis = [...list.children].sort((a, b) => text(a).localeCompare(text(b), undefined, { numeric: true }) * d);
      list.append(...lis);
      return;
    }
    const row = t.closest<HTMLElement>("[data-row]");
    if (!row || !el.contains(row)) return;
    el.querySelectorAll("[data-row].is-sel").forEach((r) => r.classList.remove("is-sel"));
    row.classList.add("is-sel");
    onOpen(row.dataset.row!, row);
  };
  el.addEventListener("click", onClick);
  return () => el.removeEventListener("click", onClick);
}

/** The address row: a read-only path you can select, and the real page it maps to */
const addressBar = (path: string, page: string) => {
  const id = `os-addr-${page.replace(/\W/g, "")}`;
  return `<div class="os-addr"><label class="os-addr__label" for="${id}">Address</label><input class="os-field os-addr__field" id="${id}" type="text" readonly value="${esc(path)}">${pageButton("Open in browser", page, "os-btn--sm")}</div>`;
};

/** The Work folder: every project, as large cover icons by default or as a sortable details list */
export function workWindow(): WinSpec {
  const thumbs = PROJECTS.map((p) => {
    const cover = p.shots[0];
    return `<li><button class="os-thumb os-thumb--work" type="button" data-row="${esc(p.slug)}"><span class="os-thumb__img">${cover ? mediaTag(BASE, cover.file, cover.alt, { small: true }) : icon("doc", 32)}</span><span class="os-thumb__label">${esc(docName(p))}</span><span class="os-thumb__meta">${esc(p.year)} . ${esc(p.evidence)}</span></button></li>`;
  }).join("");
  const rows: Row[] = PROJECTS.map((p) => ({ id: p.slug, icon: "doc", cells: [docName(p), KINDS[p.kinds[0]], p.year, p.evidence] }));
  let setView: (v: string) => void = () => {};
  let view = "icons";
  return {
    id: "work",
    title: "Work",
    icon: "work",
    kind: "explorer",
    w: 840,
    h: 620,
    menus: [
      { label: "File", items: [{ label: "Open in browser", action: "page:work/" }, "sep", { label: "Close", action: "close", key: "Esc" }] },
      {
        label: "View",
        items: () => [
          { label: "Large icons", action: "view:icons", checked: view === "icons" },
          { label: "Details", action: "view:list", checked: view === "list" },
        ],
      },
      HELP,
    ],
    onMenu: (a, _el, w) => (a.startsWith("view:") ? setView(a.slice(5)) : common(a, w)),
    body: `${addressBar("C:\\ASH\\Work", "work/")}
<div class="os-viewbar"><span class="os-viewbar__hint">Click a project to read the case study.</span><span class="os-viewbar__group" role="group" aria-label="View"><button class="os-btn os-btn--text os-btn--sm" type="button" data-view="icons" aria-pressed="true">Large icons</button><button class="os-btn os-btn--text os-btn--sm" type="button" data-view="list" aria-pressed="false">Details</button></span></div>
<div class="os-work" data-mode="icons">
  <div class="os-thumbs os-field" data-scroll><ul class="os-thumbs__grid os-thumbs__grid--work" aria-label="Projects">${thumbs}</ul></div>
  ${listView(["Name", "Kind", "Year", "Status"], "minmax(0, 2.4fr) minmax(0, 1fr) minmax(0, 0.55fr) minmax(0, 1fr)", rows, "Projects")}
</div>
<div class="os-status" aria-hidden="true"><span>${PROJECTS.length} object(s)</span><span>${CASES.length} case studies</span></div>`,
    mount(el) {
      const work = el.querySelector<HTMLElement>(".os-work")!;
      const views = [...el.querySelectorAll<HTMLElement>("[data-view]")];
      setView = (v) => {
        view = v;
        work.dataset.mode = v;
        views.forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.view === v)));
      };
      const onView = (e: MouseEvent) => {
        const b = (e.target as Element).closest<HTMLElement>("[data-view]");
        if (b) setView(b.dataset.view!);
      };
      el.addEventListener("click", onView);
      const off = wireRows(el, (slug, from) => {
        const p = PROJECTS.find((x) => x.slug === slug);
        if (p) openWindow(docWindow(p), from);
      });
      return () => {
        el.removeEventListener("click", onView);
        off();
      };
    },
  };
}

/** Welcome.txt: how the desktop works, opened on the first visit */
export function welcomeWindow(): WinSpec {
  const lines = [
    "Welcome to ASH/OS 98. Same work, slower machine.",
    "1. Click any icon to open it. Each .doc is a full case study, scroll to read it.",
    isPhone() ? "2. Windows open full screen. The X in the corner closes them." : "2. Drag a title bar to move a window. The square button maximises it.",
    "3. Press Back to 2026 on the taskbar, or in Start, to go back.",
  ];
  return {
    id: "welcome",
    title: "Welcome.txt - Notepad",
    icon: "txt",
    kind: "notepad",
    w: 480,
    h: 260,
    menus: [{ label: "File", items: [{ label: "Close", action: "close", key: "Esc" }] }],
    onMenu: (a, _el, w) => common(a, w),
    body: `<div class="os-note os-field" tabindex="0" aria-label="Welcome.txt" data-scroll>${paras(lines)}<span class="os-note__caret" aria-hidden="true"></span></div>`,
    place: "corner",
  };
}

/** NightDrive.exe: the game fills the window body. Loaded on demand; closing the window ends it. */
export function gameWindow(): WinSpec {
  return {
    id: "game",
    title: "NightDrive.exe",
    icon: "car",
    kind: "game",
    w: 800,
    h: 560,
    body: `<div class="os-game" data-game></div>`,
    mount(el, w) {
      const host = el.querySelector<HTMLElement>("[data-game]")!;
      let stop: (() => void) | null = null;
      let gone = false;
      import("../game").then(
        ({ mountGame }) => {
          if (!gone) stop = mountGame(host, { onExit: () => void closeWindow(w) });
        },
        () => {
          host.textContent = "NightDrive.exe could not start. Close this window and try again.";
        },
      );
      return () => {
        gone = true;
        stop?.();
      };
    },
  };
}

/** About.txt in Notepad, word wrap on */
export function aboutWindow(): WinSpec {
  return {
    id: "about",
    title: "About.txt - Notepad",
    icon: "txt",
    kind: "notepad",
    w: 540,
    h: 460,
    menus: [{ label: "File", items: [{ label: "Open in browser", action: "page:about/" }, "sep", { label: "Close", action: "close", key: "Esc" }] }, HELP],
    onMenu: (a, _el, w) => common(a, w),
    body: `<div class="os-note os-field" tabindex="0" aria-label="About.txt" data-scroll>${paras([ABOUT.title, ABOUT.lead, ...ABOUT.body])}<span class="os-note__caret" aria-hidden="true"></span></div><div class="os-win__foot">${pageButton("Open in browser", "about/", "os-btn--sm")}</div>`,
  };
}

/** Contact.exe: a small question dialog with the email, Copy and OK */
export function contactWindow(): WinSpec {
  const socials = SOCIALS.map(
    (s) => `<li><a class="os-link" href="${esc(s.href)}" target="_blank" rel="noopener">${esc(s.label)}<span class="os-link__handle">${esc(s.handle)}</span></a></li>`,
  ).join("");
  return {
    id: "contact",
    title: "Contact.exe",
    icon: "exe",
    kind: "dialog",
    dialog: true,
    w: 400,
    body: `<div class="os-dialog">
  <div class="os-dialog__row">${icon("ask", 32)}<div class="os-dialog__text"><p>Send a message to Ashutosh?</p><p class="os-dialog__sub">I read everything and reply within two days.</p></div></div>
  <label class="os-dialog__field"><span class="os-sr">Email</span><input class="os-field os-input" type="text" readonly value="${esc(SITE.email)}" data-email></label>
  <div class="os-dialog__actions"><a class="os-btn os-btn--text os-btn--default" href="mailto:${esc(SITE.email)}" data-native>OK</a>${button("Copy", "data-copy")}${pageButton("Open in browser", "contact/")}</div>
  <ul class="os-dialog__socials" aria-label="Elsewhere">${socials}</ul>
</div>`,
    mount(el) {
      const copy = el.querySelector<HTMLButtonElement>("[data-copy]")!;
      const field = el.querySelector<HTMLInputElement>("[data-email]")!;
      let timer = 0;
      const done = (label: string) => {
        copy.textContent = label;
        clearTimeout(timer);
        timer = window.setTimeout(() => (copy.textContent = "Copy"), 1600);
      };
      const onCopy = () => {
        field.select();
        if (!navigator.clipboard) {
          done("Press Ctrl+C");
          return;
        }
        navigator.clipboard.writeText(SITE.email).then(
          () => done("Copied"),
          () => done("Press Ctrl+C"),
        );
      };
      copy.addEventListener("click", onCopy);
      return () => {
        copy.removeEventListener("click", onCopy);
        clearTimeout(timer);
      };
    },
  };
}

/** One playground piece in a viewer window, with Previous and Next through the folder */
function viewerWindow(p: Play): WinSpec {
  const i = PLAY.indexOf(p);
  const prev = PLAY[(i - 1 + PLAY.length) % PLAY.length];
  const next = PLAY[(i + 1) % PLAY.length];
  return {
    id: "viewer",
    title: `${p.title} - Viewer`,
    icon: "fig",
    kind: "viewer",
    w: 600,
    h: 600,
    body: `<div class="os-viewer">
  <figure class="os-viewer__media os-field">${mediaTag(BASE, p.file, p.title)}</figure>
  <div class="os-viewer__text"><h2 class="os-viewer__title">${esc(p.title)}</h2><p>${esc(p.note)}</p><p class="os-viewer__why">${esc(p.why)}</p></div>
  <div class="os-viewer__nav">${button("Previous", `data-play-step="-1" title="${esc(prev.title)}"`, "os-btn--sm os-btn--prev")}<span class="os-viewer__count">${i + 1} of ${PLAY.length}</span>${button("Next", `data-play-step="1" title="${esc(next.title)}"`, "os-btn--sm os-btn--next")}</div>
  <div class="os-status" aria-hidden="true"><span>${esc(PLAY_KINDS[p.kind])}</span><span>${esc(p.year)}</span><span>${esc(p.tools.join(", "))}</span></div>
</div>`,
    mount(el, w) {
      const onClick = (e: MouseEvent) => {
        const b = (e.target as Element).closest<HTMLElement>("[data-play-step]");
        if (b) retarget(w, viewerWindow(b.dataset.playStep === "1" ? next : prev));
      };
      el.addEventListener("click", onClick);
      const stop = observeVideos(el);
      return () => {
        el.removeEventListener("click", onClick);
        stop();
      };
    },
  };
}

/** The Playground folder in large icon view: thumbnails instead of icons */
export function playWindow(): WinSpec {
  const items = PLAY.map(
    (p, i) =>
      `<li><button class="os-thumb" type="button" data-row="${i}"><span class="os-thumb__img">${mediaTag(BASE, p.file, p.title, { small: true })}</span><span class="os-thumb__label">${esc(p.title)}</span></button></li>`,
  ).join("");
  return {
    id: "play",
    title: "Playground",
    icon: "play",
    kind: "explorer",
    w: 720,
    h: 520,
    menus: [{ label: "File", items: [{ label: "Open in browser", action: "page:playground/" }, "sep", { label: "Close", action: "close", key: "Esc" }] }, HELP],
    onMenu: (a, _el, w) => common(a, w),
    body: `${addressBar("C:\\ASH\\Playground", "playground/")}<div class="os-thumbs os-field" data-scroll><ul class="os-thumbs__grid" aria-label="Playground">${items}</ul></div><div class="os-status" aria-hidden="true"><span>${PLAY.length} object(s)</span><span>Click a piece to view it</span></div>`,
    mount: (el) =>
      wireRows(el, (id, from) => {
        const p = PLAY[Number(id)];
        if (!p) return;
        const spec = viewerWindow(p);
        const open = openWindow(spec, from);
        if (open && open.spec.title !== spec.title) retarget(open, spec);
      }),
  };
}

/** A small message box */
export function alertWindow(id: string, title: string, message: string, ic: IconName = "error"): WinSpec {
  return {
    id: `alert:${id}`,
    title,
    icon: ic,
    kind: "dialog",
    dialog: true,
    w: 400,
    body: `<div class="os-dialog"><div class="os-dialog__row">${icon(ic, 32)}<div class="os-dialog__text"><p>${esc(message)}</p></div></div><div class="os-dialog__actions">${button("OK", "data-ok", "os-btn--default")}</div></div>`,
    mount(el, w) {
      blip();
      const ok = el.querySelector<HTMLElement>("[data-ok]")!;
      const onOk = () => void closeWindow(w);
      ok.addEventListener("click", onOk);
      requestAnimationFrame(() => ok.focus({ preventScroll: true }));
      return () => ok.removeEventListener("click", onOk);
    },
  };
}

const TRASH = [
  { id: "fig", name: "happy-path mockup.fig", from: "C:\\ASH\\Old habits", when: "2024", icon: "fig" as IconName, msg: "This file assumes every request succeeds and every name fits. I design with real data now, so it stays deleted." },
  { id: "txt", name: "lorem ipsum.txt", from: "C:\\ASH\\First drafts", when: "2023", icon: "txt" as IconName, msg: "Placeholder copy. Every screen I ship starts from the real words instead." },
];

/** The Recycle Bin, with two files I am not getting back */
export function binWindow(): WinSpec {
  const rows: Row[] = TRASH.map((t) => ({ id: t.id, icon: t.icon, cells: [t.name, t.from, t.when] }));
  return {
    id: "bin",
    title: "Recycle Bin",
    icon: "bin",
    kind: "explorer",
    w: 580,
    h: 320,
    menus: [
      { label: "File", items: [{ label: "Empty Recycle Bin", action: "empty" }, "sep", { label: "Close", action: "close", key: "Esc" }] },
      HELP,
    ],
    onMenu: (a, _el, w) =>
      a === "empty" ? void openWindow(alertWindow("empty", "Recycle Bin", "I keep these two as reminders, so the bin stays full.", "bin")) : common(a, w),
    body: `${listView(["Name", "Original location", "Deleted"], "minmax(0, 1.5fr) minmax(0, 1.4fr) minmax(0, 0.6fr)", rows, "Deleted files")}<div class="os-status" aria-hidden="true"><span>${TRASH.length} object(s)</span><span>Click a file to see why</span></div>`,
    mount: (el) =>
      wireRows(el, (id, from) => {
        const t = TRASH.find((x) => x.id === id);
        if (t) openWindow(alertWindow(t.id, t.name, t.msg), from);
      }),
  };
}

/** Closing the site window asks first, because it is the whole website */
export function closeSiteWindow(onSwitch: () => void): WinSpec {
  return {
    id: "alert:close-site",
    title: "ashutosh-rana.html",
    icon: "ask",
    kind: "dialog",
    dialog: true,
    w: 400,
    body: `<div class="os-dialog"><div class="os-dialog__row">${icon("ask", 32)}<div class="os-dialog__text"><p>This window is the whole website. Switch it back to 2026 instead?</p></div></div><div class="os-dialog__actions">${button("Switch back", "data-yes", "os-btn--default")}${button("Cancel", "data-no")}</div></div>`,
    mount(el, w) {
      blip();
      const yes = el.querySelector<HTMLElement>("[data-yes]")!;
      const no = el.querySelector<HTMLElement>("[data-no]")!;
      const close = () => void closeWindow(w);
      const onYes = () => onSwitch();
      yes.addEventListener("click", onYes);
      no.addEventListener("click", close);
      requestAnimationFrame(() => yes.focus({ preventScroll: true }));
      return () => {
        yes.removeEventListener("click", onYes);
        no.removeEventListener("click", close);
      };
    },
  };
}
