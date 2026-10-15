import { DUR, ScrollTrigger, d, gsap, reducedMotion, whenIdle } from "../core/motion";
import { lenis } from "../core/scroll";
import { mountReveals } from "../lib/reveal";
import type { Route } from "../templates/routes";

/** How far the page drives itself on arrival, as a share of the viewport. The title finishes shrinking here too. */
const INTRO = 0.45;

/**
 * Resolves when the page is really visible and scrollable: no transition or first-load loader running
 * (both hold the phase) and Lenis released. Stops waiting on Lenis after 3s.
 */
function arrived(isDead: () => boolean) {
  return whenIdle().then(
    () =>
      new Promise<void>((resolve) => {
        const start = performance.now();
        const check = () => {
          if (!lenis?.isStopped || isDead() || performance.now() - start > 3000) {
            gsap.ticker.remove(check);
            resolve();
          }
        };
        gsap.ticker.add(check);
        check();
      }),
  );
}

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

/**
 * Blocks wheel and touch scrolling for the length of the self-driven scroll only. The keyboard is never
 * locked. Returns the unlock.
 */
function lockInput() {
  const block = (e: Event) => {
    e.preventDefault();
    e.stopPropagation();
  };
  const opts = { capture: true, passive: false } as const;
  window.addEventListener("wheel", block, opts);
  window.addEventListener("touchmove", block, opts);
  return () => {
    window.removeEventListener("wheel", block, opts);
    window.removeEventListener("touchmove", block, opts);
  };
}

const setScroll = (y: number) => {
  if (lenis) lenis.scrollTo(y, { immediate: true, force: true });
  else window.scrollTo(0, y);
};

/**
 * Case page behaviour: the hero recedes and dims over the first viewport, the sticky title shrinks
 * from display size into a compact one-line label (each word FLIPs between the two layouts) and masks out
 * before the sheet reaches it, and on arrival the page scrolls itself far enough to land the title and the
 * facts band with no input.
 */
export function mount(root: HTMLElement, _route?: Route) {
  const stopReveals = mountReveals(root);
  const page = root.querySelector<HTMLElement>(".case");
  if (!page) return stopReveals;

  const title = page.querySelector<HTMLElement>(".case__title")!;
  const probe = page.querySelector<HTMLElement>(".case__probe")!;
  const caption = page.querySelector<HTMLElement>(".case__caption")!;
  const media = page.querySelector<HTMLElement>(".case__hero-media")!;
  const dim = page.querySelector<HTMLElement>(".case__hero-dim")!;
  const wordsIn = Array.from(page.querySelectorAll<HTMLElement>(".case__word-in"));

  let dead = false;
  let unlock: (() => void) | null = null;
  const anims: gsap.core.Animation[] = [];
  const triggers: ScrollTrigger[] = [];

  /* Hero recedes: 120% media scales to fit the viewport exactly while a dim layer rises to 20% */
  const heroTl = gsap.timeline({ paused: true });
  if (!reducedMotion()) heroTl.fromTo(media, { scale: 1 }, { scale: 0.8333, ease: "none" }, 0);
  heroTl.fromTo(dim, { opacity: 0 }, { opacity: 0.2, ease: "none" }, 0);
  anims.push(heroTl);
  triggers.push(ScrollTrigger.create({ start: 0, end: () => innerHeight, scrub: true, animation: heroTl }));

  /*
   * Once the sheet covers the hero completely, the hero is hidden and its video paused: it stops painting,
   * and the header's media check no longer sees a cover behind the paper.
   */
  const hero = page.querySelector<HTMLElement>(".case__hero")!;
  const heroVideo = hero.querySelector("video");
  const setCovered = (covered: boolean) => {
    hero.style.visibility = covered ? "hidden" : "";
    if (!heroVideo) return;
    if (covered) heroVideo.pause();
    else if (!reducedMotion()) heroVideo.play().catch(() => undefined);
  };
  triggers.push(
    ScrollTrigger.create({
      start: () => innerHeight,
      end: () => innerHeight + 1,
      onEnter: () => setCovered(true),
      onLeaveBack: () => setCovered(false),
    }),
  );

  /*
   * Title: every word is measured in the display layout and again at the compact size (one line), in the
   * same frame, then scroll progress interpolates each word's translate and scale between the two. Only
   * transforms change, so the shrink never re-lays-out the page and never counts as a layout shift.
   * The compact position follows the header: while the header bar is shown the label sits under its row,
   * and it slides up into the freed space when the header hides.
   */
  const bar = document.querySelector<HTMLElement>(".chrome__bar");
  const mark = bar?.querySelector<HTMLElement>(".chrome__mark") ?? null;
  const m = { big: 0, small: 0, top0: 0, top1: 0, under: 0 };
  const words = Array.from(title.querySelectorAll<HTMLElement>(".case__word"));
  let flip: { dx: number; dy: number }[] = [];
  let progress = 0;
  let shown = -1;
  const barShown = () => (bar ? 1 + Number(gsap.getProperty(bar, "yPercent")) / 100 : 0);
  const apply = (p: number) => {
    progress = p;
    shown = barShown();
    const top = lerp(m.top1, Math.max(m.top1, m.under), shown);
    const scale = lerp(1, m.small / m.big, p);
    words.forEach((w, i) => {
      const f = flip[i];
      w.style.transform = p ? `translate(${f.dx * p}px, ${f.dy * p}px) scale(${scale})` : "";
    });
    title.style.transform = `translate3d(0, ${lerp(m.top0, top, p)}px, 0)`;
  };
  const measure = () => {
    title.style.transform = "";
    words.forEach((w) => (w.style.transform = ""));
    const cs = getComputedStyle(probe);
    m.big = parseFloat(getComputedStyle(title).fontSize);
    m.small = parseFloat(cs.fontSize);
    const at = () => words.map((w) => ({ x: w.offsetLeft, y: w.offsetTop }));
    const big = at();
    title.style.fontSize = `${m.small}px`;
    const small = at();
    title.style.fontSize = "";
    flip = big.map((b, i) => ({ dx: small[i].x - b.x, dy: small[i].y - b.y }));
    m.top1 = parseFloat(cs.top);
    const gap = parseFloat(cs.paddingBottom);
    m.top0 = caption.offsetTop - caption.offsetHeight - gap - title.offsetHeight;
    /* Framed covers end just above the resting title, whatever its line count */
    hero.style.setProperty("--case-title-top", `${m.top0}px`);
    m.under = bar && mark ? mark.getBoundingClientRect().bottom - bar.getBoundingClientRect().top + gap * 0.75 : 0;
  };
  const followHeader = () => {
    if (progress > 0 && barShown() !== shown) apply(progress);
  };
  gsap.ticker.add(followHeader);
  triggers.push(
    ScrollTrigger.create({
      start: 0,
      end: () => innerHeight * INTRO,
      onRefreshInit: measure,
      onRefresh: (self) => apply(self.progress),
      onUpdate: (self) => apply(self.progress),
    }),
  );
  measure();
  apply(0);

  /* Before the rising sheet reaches the compact title, its words exit up into their masks; they come back on the way up */
  let out = false;
  const setOut = (next: boolean) => {
    if (next === out) return;
    out = next;
    anims.push(
      gsap.to(wordsIn, {
        y: 0,
        yPercent: next ? -130 : 0,
        duration: d(DUR.s),
        ease: next ? "expoInOut" : "expoOut",
        stagger: 0.03,
        overwrite: true,
      }),
    );
  };
  const exitY = () => {
    const gap = parseFloat(getComputedStyle(probe).paddingBottom);
    return innerHeight - (Math.max(m.top1, m.under) + m.small * 1.1 + gap * 2);
  };
  triggers.push(
    ScrollTrigger.create({
      start: exitY,
      end: () => exitY() + 1,
      onEnter: () => setOut(true),
      onLeaveBack: () => setOut(false),
    }),
  );

  /* Arrival: words rise out of their masks, then the page drives itself to the landed composition */
  arrived(() => dead).then(() => {
    if (dead) return;
    if (!reducedMotion()) {
      anims.push(gsap.fromTo(wordsIn, { y: 0, yPercent: 130 }, { y: 0, yPercent: 0, duration: d(DUR.m), ease: "expoOut", stagger: 0.08 }));
    }
    if (reducedMotion() || window.scrollY > 4) return;
    const proxy = { y: window.scrollY };
    anims.push(
      gsap.to(proxy, {
        y: () => innerHeight * INTRO,
        duration: DUR.l,
        delay: DUR.m + 0.08 * (wordsIn.length - 1),
        ease: "expoOut",
        onStart() {
          /* The reader scrolled during the title rise: they are driving, so the page does not */
          if (window.scrollY > 4) {
            this.kill();
            return;
          }
          proxy.y = window.scrollY;
          unlock = lockInput();
        },
        onUpdate: () => setScroll(proxy.y),
        onComplete: () => {
          unlock?.();
          unlock = null;
        },
      }),
    );
  });

  return () => {
    dead = true;
    unlock?.();
    gsap.ticker.remove(followHeader);
    stopReveals();
    anims.forEach((a) => a.kill());
    triggers.forEach((t) => t.kill());
  };
}
