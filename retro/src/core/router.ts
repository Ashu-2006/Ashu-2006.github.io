import { ScrollTrigger } from "gsap/ScrollTrigger";
import { match, render, type Route } from "../templates/routes";
import { bus } from "./bus";
import { scrollToTarget } from "./scroll";
import { cover, reveal } from "./transition";

export type Cleanup = () => void;
export type View = { mount(root: HTMLElement, route: Route): Cleanup | void };

const BASE = import.meta.env.BASE_URL;

const views: Record<Route["kind"], () => Promise<View>> = {
  home: () => import("../views/home"),
  case: () => import("../views/case"),
  notfound: () => import("../views/notfound"),
};

let current: { route: Route; cleanup?: Cleanup | void } | null = null;
let busy = false;
const hooks: ((route: Route) => void)[] = [];

const main = () => document.getElementById("main")!;
const sameRoute = (a: Route, b: Route) => a.kind === b.kind && (a.kind !== "case" || (b.kind === "case" && a.slug === b.slug));

/** Runs after every mount (header refresh, sound toggles, media observers) */
export const afterMount = (fn: (route: Route) => void) => hooks.push(fn);

async function mount(route: Route, firstLoad: boolean) {
  const root = main();
  if (!firstLoad || !root.firstElementChild) {
    const page = render(route, BASE);
    root.innerHTML = page.html;
    document.title = page.title;
    document.querySelector('meta[name="description"]')?.setAttribute("content", page.description);
  }
  const view = await views[route.kind]();
  const cleanup = view.mount(root, route);
  current = { route, cleanup };
  hooks.forEach((fn) => fn(route));
  bus.emit("route:enter", { kind: route.kind, slug: route.kind === "case" ? route.slug : undefined });
  ScrollTrigger.refresh();
}

function unmount() {
  if (!current) return;
  bus.emit("route:leave", { kind: current.route.kind });
  current.cleanup?.();
  ScrollTrigger.getAll().forEach((t) => t.kill());
  current = null;
}

export async function navigate(url: URL, opts: { push?: boolean } = {}) {
  if (busy) return;
  const route = match(url.pathname, BASE);
  if (current && sameRoute(current.route, route)) {
    if (opts.push !== false && url.href !== location.href) history.pushState({}, "", url);
    if (url.hash) scrollToTarget(url.hash);
    else scrollToTarget(0);
    return;
  }
  busy = true;
  try {
    if (route.kind === "case") bus.emit("track:open", { slug: route.slug });
    await cover();
    unmount();
    if (opts.push !== false) history.pushState({}, "", url);
    scrollToTarget(0, { immediate: true });
    await mount(route, false);
    if (url.hash) scrollToTarget(url.hash, { immediate: true });
    main().focus({ preventScroll: true });
    await reveal();
  } finally {
    busy = false;
  }
}

export async function initRouter() {
  if ("scrollRestoration" in history) history.scrollRestoration = "manual";
  const route = match(location.pathname, BASE);
  await mount(route, true);
  if (location.hash) requestAnimationFrame(() => scrollToTarget(location.hash, { immediate: true }));

  document.addEventListener("click", (e) => {
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    const a = (e.target as Element | null)?.closest("a");
    if (!a || a.target === "_blank" || a.hasAttribute("download")) return;
    const url = new URL(a.href, location.href);
    if (url.origin !== location.origin || !url.pathname.startsWith(BASE)) return;
    if (url.protocol === "mailto:") return;
    e.preventDefault();
    navigate(url);
  });

  window.addEventListener("popstate", () => navigate(new URL(location.href), { push: false }));
}
