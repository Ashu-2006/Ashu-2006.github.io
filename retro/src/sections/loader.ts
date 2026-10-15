import { gsap } from "gsap";
import { bus } from "../core/bus";
import { reducedMotion, startScroll, stopScroll } from "../core/scroll";
import { sound } from "../core/sound";

/** Seconds. The platter spins at least this long, and the needle drops at the latest after MAX_WAIT so the whole intro stays under 3.5s */
const MIN_SPIN = 0.35;
const MAX_WAIT = 2.2;
/** Degrees per second at full speed (45 rpm reads as spinning at a glance) */
const FULL_SPEED = 270;
const IDLE_SPEED = 24;
/** Tonearm angles around its pivot: parked off the record, and on the lead-in groove */
const ARM_REST = -5;
const ARM_PLAY = 26;

let finished = false;

function finish() {
  if (finished) return;
  finished = true;
  document.documentElement.classList.add("intro-done");
  bus.emit("intro:done", {});
}

const whenLoaded = (target: HTMLImageElement | null) =>
  new Promise<void>((resolve) => {
    if (!target || target.complete) return resolve();
    target.addEventListener("load", () => resolve(), { once: true });
    target.addEventListener("error", () => resolve(), { once: true });
  });

const whenWindowLoaded = () =>
  new Promise<void>((resolve) => {
    if (document.readyState === "complete") return resolve();
    window.addEventListener("load", () => resolve(), { once: true });
  });

const ARM = `
<svg class="loader__arm" viewBox="0 0 140 112" aria-hidden="true" focusable="false">
  <g class="loader__arm-shadow" transform="translate(4 6)">
    <g data-arm>
      <path d="M122 4 V64 Q122 71 118.6 76" />
      <rect x="111.5" y="73" width="9" height="14" rx="2" transform="rotate(18 116 80)" />
      <rect x="116.5" y="-1" width="11" height="10" rx="2.5" />
    </g>
  </g>
  <circle class="loader__base" cx="122" cy="14" r="11" />
  <g data-arm>
    <path class="loader__tube" d="M122 4 V64 Q122 71 118.6 76" />
    <path class="loader__glint" d="M121.1 18 V60" />
    <rect class="loader__weight" x="116.5" y="-1" width="11" height="10" rx="2.5" />
    <rect class="loader__shell" x="111.5" y="73" width="9" height="14" rx="2" transform="rotate(18 116 80)" />
    <circle class="loader__cap" cx="122" cy="14" r="4.2" />
  </g>
</svg>`;

/**
 * First load only: the needle drops on a spinning record. Real loading (fonts, the portrait, window load)
 * drives the platter speed. When it is ready the tonearm swings in and lands, then the three stripes cross
 * the screen and take the loader away with them. Reduced motion skips straight to the page.
 */
export function mount(host: HTMLElement) {
  if (finished) return;
  if (reducedMotion()) {
    finish();
    return;
  }

  const el = document.createElement("div");
  el.className = "loader";
  el.setAttribute("aria-hidden", "true");
  el.innerHTML = `
  <div class="loader__ground">
    <div class="loader__grain"></div>
    <div class="loader__deck">
      <div class="loader__platter">
        <div class="loader__record"><div class="loader__label"></div></div>
        <div class="loader__sheen"></div>
        <div class="loader__spindle"></div>
      </div>
      ${ARM}
    </div>
  </div>
  <div class="loader__bands"><i></i><i></i><i></i></div>`;
  host.appendChild(el);
  document.documentElement.classList.add("loader-on");
  stopScroll();

  const grain = document.querySelector<HTMLElement>(".grain");
  const grainLayer = el.querySelector<HTMLElement>(".loader__grain")!;
  if (grain?.style.backgroundImage) grainLayer.style.backgroundImage = grain.style.backgroundImage;

  const ground = el.querySelector<HTMLElement>(".loader__ground")!;
  const deck = el.querySelector<HTMLElement>(".loader__deck")!;
  const record = el.querySelector<HTMLElement>(".loader__record")!;
  const arms = el.querySelectorAll<SVGGElement>("[data-arm]");
  const shadow = el.querySelector<SVGGElement>(".loader__arm-shadow")!;
  const bands = el.querySelectorAll<HTMLElement>(".loader__bands i");

  const tasks = [document.fonts.ready, whenLoaded(document.querySelector<HTMLImageElement>(".hero__fallback")), whenWindowLoaded()];
  let loaded = 0;
  tasks.forEach((t) => t.then(() => loaded++, () => loaded++));

  gsap.set(arms, { rotation: ARM_REST, svgOrigin: "122 14" });
  gsap.set(bands, { xPercent: -101 });
  gsap.fromTo(deck, { autoAlpha: 0, scale: 0.97 }, { autoAlpha: 1, scale: 1, duration: 0.35, ease: "power2.out" });

  const t0 = performance.now();
  let angle = 0;
  let speed = 0;
  let dropping = false;

  const spin = (_time: number, deltaMs: number) => {
    const dt = Math.min(deltaMs, 50) / 1000;
    const elapsed = (performance.now() - t0) / 1000;
    const progress = loaded / tasks.length;
    const target = dropping ? FULL_SPEED : IDLE_SPEED + progress * (FULL_SPEED - IDLE_SPEED);
    speed += (target - speed) * (1 - Math.exp(-dt * 4.5));
    angle = (angle + speed * dt) % 360;
    record.style.transform = `rotate(${angle.toFixed(2)}deg)`;
    if (!dropping && ((progress >= 1 && elapsed >= MIN_SPIN) || elapsed >= MAX_WAIT)) {
      dropping = true;
      drop();
    }
  };
  gsap.ticker.add(spin);

  const drop = () => {
    const tl = gsap.timeline();
    tl.to(arms, { rotation: ARM_PLAY, svgOrigin: "122 14", duration: 0.54, ease: "power2.inOut" });
    tl.to(shadow, { attr: { transform: "translate(1.4 2)" }, duration: 0.14, ease: "power2.in" });
    tl.call(() => sound.thump());
    tl.add(leave, "+=0.1");
  };

  /* Each band covers its third at the midpoint of its run; that third of the loader is gone by the time the band moves on */
  const leave = () => {
    const run = 0.84;
    const each = 0.075;
    const tl = gsap.timeline({
      onComplete: () => {
        gsap.ticker.remove(spin);
        el.remove();
        document.documentElement.classList.remove("loader-on");
        startScroll();
      },
    });
    tl.to(bands, { xPercent: 101, duration: run, ease: "power2.inOut", stagger: each }, 0);
    tl.fromTo(bands, { skewX: -14 }, { skewX: 0, duration: run / 2, ease: "power2.out", stagger: each }, 0);
    tl.to(bands, { skewX: -14, duration: run / 2, ease: "power2.in", stagger: each, immediateRender: false }, run / 2);
    tl.set(ground, { clipPath: "inset(33.4% 0 0 0)" }, run / 2);
    tl.call(finish, [], run / 2 + 0.04);
    tl.set(ground, { clipPath: "inset(66.7% 0 0 0)" }, run / 2 + each);
    tl.set(ground, { autoAlpha: 0 }, run / 2 + each * 2);
  };
}
