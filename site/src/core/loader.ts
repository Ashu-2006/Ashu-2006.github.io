import { bus } from "./bus";
import { DUR, gsap, reducedMotion } from "./motion";
import { startScroll, stopScroll } from "./scroll";
import { buildScrambleTitle, counterText, pageShift } from "./transition";

/** The counter never finishes before MIN and never waits on assets past MAX (seconds) */
const MIN = 0.8;
const MAX = 1.8;
const FONT_WAIT = 800;

const wait = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/** Remembers the visit for this tab; returns false when storage is blocked */
function markSeen() {
  try {
    sessionStorage.setItem("switch:seen", "1");
    return true;
  } catch {
    return false;
  }
}

/** Images in the first viewport of the mounted page, as decode promises */
function firstViewImages() {
  const main = document.getElementById("main");
  if (!main) return [];
  return Array.from(main.querySelectorAll("img"))
    .filter((img) => {
      const r = img.getBoundingClientRect();
      return r.bottom > 0 && r.top < window.innerHeight && r.width > 0;
    })
    .map((img) => (img.complete && img.naturalWidth ? Promise.resolve() : img.decode().catch(() => undefined)));
}

const done = () => {
  document.documentElement.dataset.loaded = "1";
  bus.emit("intro:done", {});
};

/**
 * First visit: a paper page with the name scrambling in, a mono subline and a 000 to 100 counter tied
 * to fonts and first-view images, then a cobalt domed curtain sweeps over and lifts away. A repeat
 * visit in the same tab gets a 0.6s mask wipe. When the OS boots, the loader steps aside entirely.
 */
export async function runLoader(): Promise<void> {
  const html = document.documentElement;
  const overlay = document.getElementById("overlay");
  if (html.dataset.boot === "os" || !overlay) {
    markSeen();
    done();
    return;
  }

  const seen = html.dataset.seen === "1";
  markSeen();
  const root = document.createElement("div");
  root.className = "loader";
  root.setAttribute("aria-hidden", "true");
  overlay.append(root);
  html.dataset.loaded = "1";
  stopScroll();

  if (seen) {
    if (reducedMotion()) {
      root.remove();
      startScroll();
      done();
      return;
    }
    bus.emit("intro:done", {});
    await gsap.fromTo(root, { clipPath: "inset(0% 0% 0% 0%)" }, { clipPath: "inset(0% 0% 100% 0%)", duration: DUR.s, ease: "expoInOut", delay: 0.1 });
    root.remove();
    startScroll();
    return;
  }

  root.innerHTML = `
    <div class="loader__inner">
      <div class="loader__name ts"></div>
      <p class="loader__sub label"><span class="mask"><span class="mask__in">Product designer, Jabalpur</span></span></p>
    </div>
    <div class="loader__count label mask"><span class="mask__in">000</span></div>
    <div class="loader__sheet"><div class="curtain__bg"></div></div>`;
  const nameHost = root.querySelector<HTMLElement>(".loader__name")!;
  const sub = root.querySelector<HTMLElement>(".loader__sub .mask__in")!;
  const countIn = root.querySelector<HTMLElement>(".loader__count .mask__in")!;
  const sheet = root.querySelector<HTMLElement>(".loader__sheet")!;
  const t0 = performance.now();
  const elapsed = () => (performance.now() - t0) / 1000;

  /* Progress: fonts count as one task, every first-view image as one more */
  const tasks: Promise<unknown>[] = [document.fonts.ready, ...firstViewImages()];
  let settled = 0;
  tasks.forEach((p) => p.then(() => settled++));
  const real = () => settled / tasks.length;

  if (reducedMotion()) {
    await Promise.race([document.fonts.ready, wait(FONT_WAIT)]);
    buildScrambleTitle(nameHost, "Ashutosh Rana");
    countIn.textContent = "100";
    await Promise.race([Promise.all(tasks), wait(MAX * 1000)]);
    await wait(Math.max(0, 600 - elapsed() * 1000));
    await gsap.to(root, { autoAlpha: 0, duration: 0.2, ease: "none" });
    root.remove();
    startScroll();
    done();
    return;
  }

  /* The counter starts at once and chases a goal that both time and real progress cap */
  gsap.set([sub, countIn], { yPercent: 130 });
  gsap.to(countIn, { yPercent: 0, duration: DUR.m, ease: "expoOut", delay: 0.05 });
  const counted = new Promise<void>((resolve) => {
    let v = 0;
    const tick = (_t: number, dt: number) => {
      const t = elapsed();
      const finished = real() >= 1 || t >= MAX;
      const goal = Math.min(t / MIN, finished ? 1 : 0.15 + 0.75 * real());
      v += (goal - v) * (1 - Math.pow(1 - 0.16, dt / 16.67));
      if (finished && t >= MIN && v > 0.985) v = 1;
      countIn.textContent = counterText(v * 100);
      if (v >= 1) {
        gsap.ticker.remove(tick);
        resolve();
      }
    };
    gsap.ticker.add(tick);
  });

  await Promise.race([document.fonts.ready, wait(FONT_WAIT)]);
  const title = buildScrambleTitle(nameHost, "Ashutosh Rana");
  const intro = gsap.timeline();
  title.enter(intro, 0, Math.max(0.6, MIN - elapsed() - 0.1));
  intro.to(sub, { yPercent: 0, duration: DUR.m, ease: "expoOut" }, 0.25);
  await counted;

  /* Sweep: the cobalt sheet covers the paper, the paper goes, the sheet lifts off the live page */
  const shift = pageShift();
  await new Promise<void>((resolve) => {
    const tl = gsap.timeline({ onComplete: resolve });
    gsap.set(sheet, { yPercent: 100, y: 40 });
    title.exit(tl, 0.05);
    tl.to([sub, countIn], { yPercent: -130, duration: 0.7, ease: "expoInOut", stagger: 0.05 }, 0);
    tl.to(sheet, { yPercent: 0, y: 0, duration: DUR.m, ease: "expoInOut" }, 0);
    tl.call(
      () => {
        root.classList.add("is-sweep");
        shift.set(40);
      },
      [],
      DUR.m,
    );
    tl.to(sheet, { yPercent: -100, y: -40, duration: DUR.m, ease: "expoInOut" }, DUR.m);
    shift.to(tl, 0, DUR.m, DUR.m);
    tl.call(done, [], DUR.m + 0.3);
  });
  shift.clear();
  root.remove();
  startScroll();
}
