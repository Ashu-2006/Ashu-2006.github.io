import { bus } from "../core/bus";
import { DUR, ScrollTrigger, d, finePointer, gsap, reducedMotion, whenIdle } from "../core/motion";
import { pad2 } from "../lib/html";
import { mountReveals } from "../lib/reveal";
import { mountFooter } from "../sections/footer";
import { WORK_FILTERS } from "../templates/work";

const HIDDEN = "inset(100% 0% 0% 0%)";
const FULL = "inset(0% 0% 0% 0%)";
const SCRAMBLE = "0123456789";
/** Follower lerp per 60fps frame, and the breathing room it keeps from the viewport edges */
const LERP = 0.14;
const EDGE_TOP = 88;
const EDGE_BOTTOM = 24;
const FOLLOW_QUERY = "(min-width: 1024px) and (hover: hover) and (pointer: fine)";
const KEYS = new Set<string>(["all", ...WORK_FILTERS.map((f) => f.key)]);

/**
 * The index: entry, hover and focus, the following cover frame and the kind filter. Rows rise out of
 * their cell masks in small batches as they enter the viewport, once the page transition is idle.
 */
function mountIndex(root: HTMLElement): () => void {
  const body = root.querySelector<HTMLElement>("[data-wk-body]");
  const list = root.querySelector<HTMLElement>("[data-wk-list]");
  if (!body || !list) return () => {};
  const rows = Array.from(list.querySelectorAll<HTMLElement>("[data-wk-row]"));
  const covers = rows.map((r) => r.querySelector<HTMLElement>("[data-wk-cover]")!);
  const pills = Array.from(root.querySelectorAll<HTMLButtonElement>("[data-wk-filter]"));
  const countEl = root.querySelector<HTMLElement>("[data-wk-count]");
  const showingEl = root.querySelector<HTMLElement>("[data-wk-showing]");
  /* Name first, so a row's index and meta never land before the thing they describe */
  const isName = (el: HTMLElement) => Number(el.parentElement?.classList.contains("wk__name"));
  const inners = (r: HTMLElement) => Array.from(r.querySelectorAll<HTMLElement>(".wk__in")).sort((a, b) => isName(b) - isName(a));
  const rule = (r: HTMLElement) => r.querySelector<HTMLElement>(".wk__rule");
  const mq = matchMedia(FOLLOW_QUERY);
  const reduced = reducedMotion();
  const cleanups: (() => void)[] = [];
  const anims = new Set<gsap.core.Animation>();
  const track = <T extends gsap.core.Animation>(a: T) => {
    anims.add(a);
    a.eventCallback("onComplete", () => anims.delete(a));
    return a;
  };

  let dead = false;
  let idle = false;
  let follow = mq.matches && finePointer();
  let active = -1;
  let frameOn = false;
  let z = rows.length + 2;
  let filter = "all";
  let wipe: gsap.core.Timeline | null = null;
  let filterTl: gsap.core.Timeline | null = null;
  const shown = new Set<HTMLElement>();

  const visible = () => rows.filter((r) => !r.hidden);

  /* Videos: only the active cover plays, only in follow mode, only while the list is on screen */
  let listInView = false;
  const syncVideos = () => {
    covers.forEach((c, i) => {
      const v = c.querySelector<HTMLVideoElement>("video");
      if (!v) return;
      if (follow && frameOn && !reduced && listInView && i === active) {
        v.preload = "auto";
        v.play().catch(() => v.pause());
      } else if (!v.paused) v.pause();
    });
  };

  /** Swap the frame to row i: the new cover wipes up over the old one, its media settling from 1.15 */
  const show = (i: number) => {
    if (i === active || !covers[i]) return;
    const prev = active;
    active = i;
    const cover = covers[i];
    const media = cover.firstElementChild;
    covers.forEach((c) => c.classList.toggle("is-active", c === cover));
    cover.style.zIndex = String(++z);
    if (!follow || !frameOn) return;
    wipe?.progress(1);
    if (covers[prev]) gsap.set(covers[prev], { clipPath: FULL });
    wipe = track(
      gsap
        .timeline({ onComplete: () => covers.forEach((c, k) => k !== active && gsap.set(c, { clipPath: HIDDEN })) })
        .fromTo(cover, { clipPath: HIDDEN }, { clipPath: FULL, duration: d(DUR.s), ease: "expoOut" }, 0)
        .fromTo(media, { scale: 1.15 }, { scale: 1, duration: d(DUR.m), ease: "expoOut" }, 0),
    );
    syncVideos();
  };

  /** The frame shows only while a row is hovered or focused: it wipes up on the way in, off the top on the way out */
  let snap = false;
  const openFrame = () => {
    const cover = covers[active];
    if (!cover) return;
    frameOn = true;
    snap = true;
    wipe?.progress(1);
    covers.forEach((c) => c !== cover && gsap.set(c, { clipPath: HIDDEN }));
    cover.style.zIndex = String(++z);
    wipe = track(
      gsap
        .timeline()
        .fromTo(cover, { clipPath: HIDDEN }, { clipPath: FULL, duration: d(DUR.s), ease: "expoOut" }, 0)
        .fromTo(cover.firstElementChild, { scale: 1.15 }, { scale: 1, duration: d(DUR.m), ease: "expoOut" }, 0),
    );
    syncVideos();
  };
  const closeFrame = () => {
    frameOn = false;
    wipe?.progress(1);
    syncVideos();
    const cover = covers[active];
    if (!cover) return;
    wipe = track(gsap.timeline().to(cover, { clipPath: "inset(0% 0% 100% 0%)", duration: d(DUR.s), ease: "expoInOut" }).set(cover, { clipPath: HIDDEN }));
  };
  const setHot = (row: HTMLElement | null) => {
    rows.forEach((r) => r.classList.toggle("is-hot", r === row));
    if (!follow) return;
    if (row && !frameOn) openFrame();
    else if (!row && frameOn) closeFrame();
  };

  /* Entry: rows rise from their masks in batches as they enter, the rule draws under each one */
  const riseIn = (batch: HTMLElement[], delay = 0) => {
    const fresh = batch.filter((r) => !shown.has(r) && !r.hidden);
    if (!fresh.length) return;
    fresh.forEach((r) => shown.add(r));
    const tl = gsap.timeline({ delay });
    fresh.forEach((r, k) => {
      const at = k * 0.05;
      tl.fromTo(inners(r), { y: 0, yPercent: 130 }, { yPercent: 0, duration: d(DUR.m), ease: "expoOut", stagger: 0.03 }, at);
      tl.fromTo(rule(r), { scaleX: 0 }, { scaleX: 1, duration: d(DUR.l), ease: "expoOut" }, at);
      if (!follow) {
        tl.fromTo(covers[rows.indexOf(r)], { clipPath: HIDDEN }, { clipPath: FULL, duration: d(DUR.m), ease: "expoOut", clearProps: "clipPath" }, at + 0.05);
      }
    });
    track(tl);
  };

  let queue: HTMLElement[] = [];
  let raf = 0;
  const io = new IntersectionObserver(
    (entries) => {
      for (const e of entries) {
        if (!e.isIntersecting) continue;
        io.unobserve(e.target);
        queue.push(e.target as HTMLElement);
      }
      if (!raf && queue.length) {
        raf = requestAnimationFrame(() => {
          raf = 0;
          const batch = queue.sort((a, b) => rows.indexOf(a) - rows.indexOf(b));
          queue = [];
          riseIn(batch);
        });
      }
    },
    { rootMargin: "0px 0px -6% 0px" },
  );
  const listIO = new IntersectionObserver(([e]) => {
    listInView = e.isIntersecting;
    syncVideos();
  });
  listIO.observe(list);
  cleanups.push(() => {
    io.disconnect();
    listIO.disconnect();
    cancelAnimationFrame(raf);
  });

  /* Filter: the visible rows rise out of their masks, the list re-sets, the new set rises in */
  const apply = (key: string, animate: boolean) => {
    if (!KEYS.has(key)) key = "all";
    filter = key;
    pills.forEach((p) => p.setAttribute("aria-pressed", String(p.dataset.wkFilter === key)));
    const match = (r: HTMLElement) => key === "all" || (r.dataset.kinds ?? "").split(" ").includes(key);
    const next = rows.filter(match);
    const leaving = visible();

    const url = new URL(location.href);
    if (key === "all") url.searchParams.delete("kind");
    else url.searchParams.set("kind", key);
    if (url.href !== location.href) history.replaceState(history.state, "", url);

    const n = pad2(next.length);
    if (countEl && countEl.textContent !== n) {
      if (animate && !reduced) gsap.to(countEl, { duration: d(DUR.s), ease: "none", overwrite: true, scrambleText: { text: n, chars: SCRAMBLE, speed: 0.6 } });
      else countEl.textContent = n;
    }
    if (showingEl) showingEl.textContent = String(next.length);

    const swap = () => {
      rows.forEach((r) => (r.hidden = !match(r)));
      setHot(null);
      bus.emit("cursor:refresh", {});
    };

    filterTl?.progress(1);
    if (!animate || reduced || !idle) {
      swap();
      if (idle) next.forEach((r) => shown.add(r));
      return;
    }
    const inView = (r: HTMLElement) => {
      const b = r.getBoundingClientRect();
      return b.bottom > 0 && b.top < innerHeight;
    };
    const out = leaving.filter(inView);
    const tl = gsap.timeline();
    tl.to(out.flatMap(inners), { y: 0, yPercent: -130, duration: d(DUR.xs), ease: "expoInOut", stagger: 0.012 }, 0);
    tl.to(out.map(rule), { scaleX: 0, transformOrigin: "100% 50%", duration: d(DUR.xs), ease: "expoInOut", stagger: 0.012 }, 0);
    tl.call(() => {
      swap();
      next.forEach((r) => shown.add(r));
      gsap.set(next.flatMap(inners), { y: 0, yPercent: 130 });
      gsap.set(next.map(rule), { scaleX: 0, transformOrigin: "0% 50%" });
    });
    const enter = gsap.timeline();
    next.forEach((r, k) => {
      enter.to(inners(r), { yPercent: 0, duration: d(DUR.m), ease: "expoOut", stagger: 0.03 }, Math.min(k, 10) * 0.045);
      enter.to(rule(r), { scaleX: 1, duration: d(DUR.l), ease: "expoOut" }, Math.min(k, 10) * 0.045);
    });
    tl.add(enter);
    filterTl = track(tl);
  };

  pills.forEach((p) => {
    const on = () => {
      const key = p.dataset.wkFilter ?? "all";
      if (key !== filter) apply(key, true);
    };
    p.addEventListener("click", on);
    cleanups.push(() => p.removeEventListener("click", on));
  });

  /* Hover and keyboard focus pick the active row */
  let pointerY: number | null = null;
  let focusRow: HTMLElement | null = null;
  rows.forEach((row, i) => {
    const enter = () => {
      if (!idle) return;
      show(i);
      setHot(row);
    };
    const focus = () => {
      focusRow = row;
      pointerY = null;
      show(i);
      setHot(row);
    };
    row.addEventListener("pointerenter", enter);
    row.addEventListener("focusin", focus);
    cleanups.push(() => {
      row.removeEventListener("pointerenter", enter);
      row.removeEventListener("focusin", focus);
    });
  });
  const onMove = (e: PointerEvent) => {
    pointerY = e.clientY;
    focusRow = null;
  };
  const onLeave = () => {
    pointerY = null;
    setHot(null);
  };
  const onFocusOut = (e: FocusEvent) => {
    if (!list.contains(e.relatedTarget as Node | null)) {
      focusRow = null;
      setHot(null);
    }
  };
  list.addEventListener("pointermove", onMove);
  list.addEventListener("pointerleave", onLeave);
  list.addEventListener("focusout", onFocusOut);
  cleanups.push(() => {
    list.removeEventListener("pointermove", onMove);
    list.removeEventListener("pointerleave", onLeave);
    list.removeEventListener("focusout", onFocusOut);
  });

  /*
   * The follower. The frame centres on the pointer (or the focused row), clamped to the viewport and
   * always inside the list: a filtered list shorter than the frame scales the frame down to fit it.
   */
  let y = 0;
  let lastY = -1;
  let lastH = -1;
  const tick = () => {
    if (!follow || !frameOn) return;
    const cover = covers[active];
    if (!cover) return;
    const listH = list.offsetHeight;
    if (listH !== lastH) {
      lastH = listH;
      body.style.setProperty("--wk-list-h", listH + "px");
    }
    const fh = cover.offsetHeight;
    const top = body.getBoundingClientRect().top;
    let want = y;
    if (pointerY !== null) want = pointerY - top - fh / 2;
    else if (focusRow) want = focusRow.offsetTop + focusRow.offsetHeight / 2 - fh / 2;
    const lo = Math.max(0, EDGE_TOP - top);
    const hi = Math.min(listH - fh, innerHeight - EDGE_BOTTOM - top - fh);
    want = gsap.utils.clamp(0, Math.max(0, listH - fh), gsap.utils.clamp(lo, Math.max(lo, hi), want));
    const k = reduced || snap ? 1 : 1 - Math.pow(1 - LERP, gsap.ticker.deltaRatio(60));
    snap = false;
    y += (want - y) * k;
    if (Math.abs(y - lastY) > 0.05) {
      lastY = y;
      body.style.setProperty("--wk-y", `${y.toFixed(2)}px`);
    }
  };
  gsap.ticker.add(tick);
  cleanups.push(() => gsap.ticker.remove(tick));

  const onMq = () => {
    follow = mq.matches && finePointer();
    frameOn = false;
    body.style.removeProperty("--wk-y");
    y = 0;
    lastY = -1;
    wipe?.progress(1);
    covers.forEach((c) => gsap.set(c, follow ? { clipPath: HIDDEN } : { clearProps: "clipPath" }));
    syncVideos();
  };
  mq.addEventListener("change", onMq);
  cleanups.push(() => mq.removeEventListener("change", onMq));

  /* Initial filter from ?kind=, applied before anything is shown */
  const initial = new URLSearchParams(location.search).get("kind");
  if (initial && KEYS.has(initial) && initial !== "all") apply(initial, false);

  whenIdle().then(() => {
    if (dead) return;
    idle = true;
    if (reduced) {
      rows.forEach((r) => shown.add(r));
      return;
    }
    const firstScreen = visible().filter((r) => r.getBoundingClientRect().top < innerHeight);
    riseIn(firstScreen, 0.1);
    visible().forEach((r) => !shown.has(r) && io.observe(r));
    rows.filter((r) => r.hidden).forEach((r) => io.observe(r));
  });

  return () => {
    dead = true;
    cleanups.forEach((fn) => fn());
    anims.forEach((a) => a.kill());
    wipe?.kill();
    filterTl?.kill();
    if (countEl) gsap.killTweensOf(countEl);
    covers.forEach((c) => c.querySelector("video")?.pause());
  };
}

/**
 * Grid or List. Grid is the default; List is kept in ?view=list, and a ?kind= filter link opens in List since
 * only the list filters. Switching swaps the two in place and refreshes anything measured.
 */
function mountViews(root: HTMLElement): () => void {
  const section = root.querySelector<HTMLElement>(".wk");
  const btns = Array.from(root.querySelectorAll<HTMLButtonElement>("[data-wk-view]"));
  if (!section || !btns.length) return () => {};
  const set = (view: string, push: boolean) => {
    section.dataset.view = view;
    btns.forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.wkView === view)));
    if (push) {
      const url = new URL(location.href);
      if (view === "list") url.searchParams.set("view", "list");
      else {
        url.searchParams.delete("view");
        url.searchParams.delete("kind");
      }
      if (url.href !== location.href) history.replaceState(history.state, "", url);
    }
    ScrollTrigger.refresh();
    bus.emit("cursor:refresh", {});
  };
  const q = new URLSearchParams(location.search);
  if (q.get("view") === "list" || q.has("kind")) set("list", false);
  const onClick = (e: Event) => {
    const view = (e.currentTarget as HTMLElement).dataset.wkView ?? "grid";
    if (view !== section.dataset.view) set(view, true);
  };
  btns.forEach((b) => b.addEventListener("click", onClick));
  return () => btns.forEach((b) => b.removeEventListener("click", onClick));
}

/** Work index: reveals, the view switch, the list behaviour and the footer */
export function mount(root: HTMLElement) {
  const cleanups = [mountViews(root), mountReveals(root), mountIndex(root), mountFooter(root)];
  return () => cleanups.forEach((fn) => fn());
}
