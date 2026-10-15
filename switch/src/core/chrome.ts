import { initClock } from "./ambient";
import { bus } from "./bus";
import { DUR, d, getPhase, gsap, reducedMotion } from "./motion";
import { currentRoute } from "./router";
import { startScroll, stopScroll } from "./scroll";

const MOBILE = "(max-width: 767px)";

/**
 * Wires the header: live clock, scramble on nav hover, active route underline, hide on scroll down
 * past 30% of a viewport and return on scroll up, and the mobile full-screen menu.
 */
export function initChrome(el: HTMLElement) {
  const html = document.documentElement;
  const bar = el.querySelector<HTMLElement>("[data-chrome-bar]");
  const menu = el.querySelector<HTMLElement>("[data-chrome-menu]");
  const btn = el.querySelector<HTMLButtonElement>("[data-menu-btn]");
  const btnLabel = el.querySelector<HTMLElement>("[data-menu-label]");
  if (!bar || !menu || !btn || !btnLabel) return { refresh() {} };

  initClock();

  /* Scramble on keyboard focus only: on a pointer, the cursor takeover is the one hover effect */
  el.querySelectorAll<HTMLElement>(".chrome__link").forEach((link) => {
    const txt = link.querySelector<HTMLElement>(".chrome__txt");
    if (!txt) return;
    const text = txt.dataset.text || txt.textContent || "";
    let tween: gsap.core.Tween | null = null;
    link.addEventListener("focus", () => {
      if (reducedMotion() || getPhase() !== "idle" || !link.matches(":focus-visible")) return;
      tween?.kill();
      txt.style.width = `${txt.getBoundingClientRect().width}px`;
      tween = gsap.to(txt, {
        duration: DUR.s,
        ease: "none",
        scrambleText: { text, chars: "lowerCase", revealDelay: 0.1, speed: 0.6 },
        onComplete: () => txt.style.removeProperty("width"),
      });
    });
  });

  /*
   * Tone: over page media (case covers, full-bleed images) the difference blend turns the nav into
   * mid-grey and mixes it with the capture's own UI, so the bar switches to paper text on a soft ink
   * scrim. Geometric rather than hit-testing, because covers sit under dim and scrim layers: any
   * visible media in #main that crosses the bar's resting line across a quarter of the width counts.
   */
  const row = bar.querySelector<HTMLElement>(".chrome__row");
  const MEDIA = "img, video, canvas, [data-chrome-tone='media']";
  const setTone = () => {
    if (!row) return;
    /* The resting line, ignoring the hide transform, so the tone is right before the bar slides back */
    const y = row.offsetTop + row.offsetHeight / 2;
    const minW = window.innerWidth * 0.25;
    const main = document.getElementById("main");
    let media = false;
    for (const n of Array.from(main?.querySelectorAll<HTMLElement>(MEDIA) ?? [])) {
      const r = n.getBoundingClientRect();
      if (r.top > y || r.bottom < y || r.width < minW) continue;
      const cs = getComputedStyle(n);
      if (cs.visibility === "hidden" || Number(cs.opacity) === 0 || !n.checkVisibility({ opacityProperty: true })) continue;
      media = true;
      break;
    }
    if (media) html.dataset.chromeTone = "media";
    else delete html.dataset.chromeTone;
  };
  window.addEventListener("resize", setTone, { passive: true });
  bus.on("transition:phase", ({ phase }) => phase === "idle" && requestAnimationFrame(setTone));

  /* Hide on scroll */
  let hidden = false;
  let lastY = window.scrollY;
  let menuOpen = false;
  const setHidden = (next: boolean) => {
    if (next === hidden) return;
    hidden = next;
    gsap.to(bar, { yPercent: next ? -100 : 0, duration: d(DUR.s), ease: "expoOut", overwrite: true });
  };
  let queued = false;
  const onScroll = () => {
    if (queued) return;
    queued = true;
    requestAnimationFrame(() => {
      queued = false;
      const y = window.scrollY;
      const delta = y - lastY;
      setTone();
      if (menuOpen || getPhase() !== "idle") {
        lastY = y;
        return;
      }
      if (y < window.innerHeight * 0.3) setHidden(false);
      else if (delta > 6) setHidden(true);
      else if (delta < -6) setHidden(false);
      if (Math.abs(delta) > 6 || y < window.innerHeight * 0.3) lastY = y;
    });
  };
  window.addEventListener("scroll", onScroll, { passive: true });
  el.addEventListener("focusin", () => setHidden(false));

  /* Mobile menu */
  const mlinks = Array.from(menu.querySelectorAll<HTMLElement>(".chrome__mlink .mask__in"));
  const mfoot = Array.from(menu.querySelectorAll<HTMLElement>(".chrome__mfoot .mask__in"));
  let menuTl: gsap.core.Timeline | null = null;

  const swapLabel = (text: string) => {
    if (reducedMotion()) {
      btnLabel.textContent = text;
      return;
    }
    gsap
      .timeline()
      .to(btnLabel, { yPercent: -130, duration: DUR.xs, ease: "expoInOut" })
      .call(() => void (btnLabel.textContent = text))
      .fromTo(btnLabel, { yPercent: 130 }, { yPercent: 0, duration: DUR.xs, ease: "expoOut" });
  };

  const onKey = (e: KeyboardEvent) => {
    if (e.key === "Escape") {
      closeMenu();
      btn.focus({ preventScroll: true });
      return;
    }
    if (e.key !== "Tab") return;
    /* The menu, its button and the switch are not adjacent in the DOM, so Tab is driven explicitly through them */
    const focusables = [btn, ...Array.from(menu.querySelectorAll<HTMLElement>("a")), ...Array.from(bar.querySelectorAll<HTMLElement>(".chrome__switch button"))];
    e.preventDefault();
    const at = focusables.indexOf(document.activeElement as HTMLElement);
    const step = e.shiftKey ? -1 : 1;
    const next = at === -1 ? (e.shiftKey ? focusables.length - 1 : 0) : (at + step + focusables.length) % focusables.length;
    focusables[next].focus();
  };

  function openMenu() {
    if (menuOpen) return;
    menuOpen = true;
    setHidden(false);
    html.dataset.menu = "open";
    menu!.hidden = false;
    btn!.setAttribute("aria-expanded", "true");
    swapLabel("Close");
    stopScroll();
    document.addEventListener("keydown", onKey);
    menuTl?.kill();
    menuTl = gsap.timeline();
    menuTl.fromTo(menu, { clipPath: "inset(0% 0% 100% 0%)" }, { clipPath: "inset(0% 0% 0% 0%)", duration: d(DUR.s), ease: "expoInOut" }, 0);
    menuTl.fromTo(mlinks, { yPercent: 130 }, { yPercent: 0, duration: d(DUR.m), ease: "expoOut", stagger: 0.05 }, d(0.2));
    menuTl.fromTo(mfoot, { yPercent: 130 }, { yPercent: 0, duration: d(DUR.m), ease: "expoOut", stagger: 0.05 }, d(0.35));
    menu!.querySelector<HTMLElement>("a")?.focus({ preventScroll: true });
    bus.emit("cursor:refresh", {});
  }

  function closeMenu(immediate = false) {
    if (!menuOpen) return;
    menuOpen = false;
    btn!.setAttribute("aria-expanded", "false");
    swapLabel("Menu");
    document.removeEventListener("keydown", onKey);
    const done = () => {
      menu!.hidden = true;
      delete html.dataset.menu;
      gsap.set(menu, { clearProps: "clipPath" });
      startScroll();
      bus.emit("cursor:refresh", {});
    };
    menuTl?.kill();
    if (immediate || reducedMotion()) {
      menuTl = null;
      done();
      return;
    }
    if (menu!.contains(document.activeElement)) btn!.focus({ preventScroll: true });
    menuTl = gsap.timeline({ onComplete: done });
    menuTl.to(mlinks.concat(mfoot), { yPercent: -130, duration: DUR.xs, ease: "expoInOut", stagger: 0.02 }, 0);
    menuTl.to(menu, { clipPath: "inset(0% 0% 100% 0%)", duration: DUR.s, ease: "expoInOut" }, 0.1);
  }

  btn.addEventListener("click", () => (menuOpen ? closeMenu() : openMenu()));
  menu.addEventListener("click", (e) => {
    if (!(e.target instanceof Element) || !e.target.closest("a")) return;
    /* A route change keeps the panel up until the curtain covers it; the current route closes it now */
    requestAnimationFrame(() => {
      if (getPhase() === "idle") closeMenu();
    });
  });
  bus.on("route:leave", () => closeMenu(true));
  const mq = matchMedia(MOBILE);
  mq.addEventListener("change", () => {
    if (!mq.matches) closeMenu(true);
  });

  /* Active route */
  const setActive = () => {
    const route = currentRoute();
    const active = route?.kind === "case" ? "work" : route && route.kind !== "notfound" ? route.kind : "";
    el.querySelectorAll<HTMLElement>("[data-nav]").forEach((a) => {
      const on = a.dataset.nav === active;
      a.classList.toggle("is-active", on);
      if (on && route?.kind !== "case") a.setAttribute("aria-current", "page");
      else a.removeAttribute("aria-current");
    });
  };

  return {
    /** Called after every mount: marks the active route and brings the bar back */
    refresh() {
      setActive();
      requestAnimationFrame(setTone);
      lastY = window.scrollY;
      hidden = true;
      setHidden(false);
    },
  };
}
