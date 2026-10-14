import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { SplitText } from "gsap/SplitText";
import { navigate, type Cleanup } from "../core/router";
import { lenis, reducedMotion } from "../core/scroll";
import { arriving, clearCut, cutNext, whenRevealing, type Arrival } from "../core/transition";
import * as encore from "../sections/encore";

gsap.registerPlugin(ScrollTrigger, SplitText);

const q = <T extends Element = HTMLElement>(root: ParentNode, sel: string) => root.querySelector<T>(sel);

/** The opening spread: the title rises out of its mask letter by letter, the credits and cover follow */
function opening(page: HTMLElement, ctx: gsap.Context, how: Arrival) {
  const head = q(page, ".case__head")!;
  const back = q(head, ".case__back");
  const summary = q(page, ".case__summary");

  if (how === "cut") {
    ctx.add(() => {
      gsap.set([back, summary], { opacity: 0 });
      const tl = gsap.timeline({ delay: 0.05 });
      tl.fromTo(back, { opacity: 0, x: -10 }, { opacity: 1, x: 0, duration: 0.7, ease: "power3.out" }, 0);
      tl.fromTo(summary, { opacity: 0, y: 28 }, { opacity: 1, y: 0, duration: 1, ease: "power3.out" }, 0.15);
    });
    return;
  }

  const no = q(head, ".case__no");
  const title = q(head, ".case__title")!;
  const headline = q(head, ".case__headline")!;
  const credits = head.querySelectorAll(".credit");
  const frame = q(page, ".case__intro .case__frame");
  const media = frame?.firstElementChild ?? null;
  const caption = q(page, ".case__cover .shot__caption");

  ctx.add(() => gsap.set([back, no, title, headline, credits, frame, caption], { autoAlpha: 0 }));

  Promise.all([document.fonts.ready, whenRevealing()]).then(
    () =>
      page.isConnected &&
      ctx.add(() => {
      const chars = SplitText.create(title, { type: "lines,words,chars", mask: "lines", linesClass: "case-line" });
      const lines = SplitText.create(headline, { type: "lines", mask: "lines", linesClass: "case-line" });
      gsap.set([title, headline], { autoAlpha: 1 });

      const tl = gsap.timeline({ delay: how === "wipe" ? 0.2 : 0.1 });
      tl.fromTo(
        chars.chars,
        { yPercent: 118, rotate: 7 },
        {
          yPercent: 0,
          rotate: 0,
          duration: 1.15,
          ease: "power4.out",
          stagger: { amount: Math.min(0.42, chars.chars.length * 0.04) },
          onComplete: () => chars.revert(),
        },
        0,
      );
      tl.fromTo(no, { autoAlpha: 0, yPercent: 60 }, { autoAlpha: 1, yPercent: 0, duration: 0.8, ease: "power3.out" }, 0.1);
      tl.fromTo(back, { autoAlpha: 0, x: -10 }, { autoAlpha: 1, x: 0, duration: 0.7, ease: "power3.out" }, 0.05);
      tl.fromTo(
        lines.lines,
        { yPercent: 105 },
        { yPercent: 0, duration: 1, ease: "power4.out", stagger: 0.08, onComplete: () => lines.revert() },
        0.28,
      );
      tl.fromTo(credits, { autoAlpha: 0, y: 18 }, { autoAlpha: 1, y: 0, duration: 0.8, ease: "power3.out", stagger: 0.06 }, 0.4);
      if (frame) {
        tl.fromTo(
          frame,
          { autoAlpha: 1, clipPath: "inset(0% 100% 0% 0% round 0px 40vh 40vh 0px)" },
          { clipPath: "inset(0% 0% 0% 0% round 0px 0vh 0vh 0px)", duration: 1.35, ease: "expo.inOut", clearProps: "clipPath" },
          0.42,
        );
        if (media) tl.fromTo(media, { scale: 1.14 }, { scale: 1, duration: 1.9, ease: "power3.out", clearProps: "transform" }, 0.42);
      }
      if (caption) tl.fromTo(caption, { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.8 }, 1.2);
    }),
  );
}

/** Each shot wipes open once, in the stripes' direction, as it arrives */
function shots(page: HTMLElement) {
  page.querySelectorAll<HTMLElement>(".case__shots [data-reveal]").forEach((frame) => {
    const media = frame.firstElementChild;
    const caption = frame.parentElement?.querySelector(".shot__caption");
    gsap.set(frame, { clipPath: "inset(0% 100% 0% 0% round 0px 40vh 40vh 0px)" });
    if (caption) gsap.set(caption, { autoAlpha: 0, y: 14 });
    const tl = gsap.timeline({ paused: true });
    tl.to(frame, { clipPath: "inset(0% 0% 0% 0% round 0px 0vh 0vh 0px)", duration: 1.25, ease: "expo.inOut", clearProps: "clipPath" }, 0);
    if (media) tl.fromTo(media, { scale: 1.12 }, { scale: 1, duration: 1.7, ease: "power3.out", clearProps: "transform" }, 0);
    if (caption) tl.to(caption, { autoAlpha: 1, y: 0, duration: 0.8, ease: "power3.out" }, 0.55);
    const play = () => tl.play();
    ScrollTrigger.create({ trigger: frame, start: "top 88%", once: true, onEnter: play, onLeave: play });
  });
}

/** The decision band's one moment: its title lines rise and the three rules draw across */
function decision(page: HTMLElement) {
  const band = q(page, ".case__decision");
  if (!band) return;
  const title = q(band, ".case__decision-title")!;
  const items = band.querySelectorAll(".case__decision-item");
  const copy = band.querySelectorAll(".case__decision-item > *");
  gsap.set(title, { autoAlpha: 0 });
  gsap.set(items, { "--rule": 0 });
  gsap.set(copy, { autoAlpha: 0, y: 18 });
  let played = false;
  const play = () => {
    if (played) return;
    played = true;
    const split = SplitText.create(title, { type: "lines", mask: "lines", linesClass: "case-line" });
    gsap.set(title, { autoAlpha: 1 });
    const tl = gsap.timeline();
    tl.fromTo(split.lines, { yPercent: 105 }, { yPercent: 0, duration: 1, ease: "power4.out", stagger: 0.09, onComplete: () => split.revert() }, 0);
    tl.to(items, { "--rule": 1, duration: 1.1, ease: "expo.inOut", stagger: 0.1 }, 0.15);
    tl.to(copy, { autoAlpha: 1, y: 0, duration: 0.9, ease: "power3.out", stagger: 0.05 }, 0.45);
  };
  ScrollTrigger.create({ trigger: band, start: "top 70%", once: true, onEnter: play, onLeave: play });
}

/** The lead-out stripes draw in from the left as the end of the record arrives, the same three as the route wipe */
function leadOut(page: HTMLElement) {
  const bars = page.querySelectorAll(".case__leadout i");
  if (!bars.length) return;
  gsap.set(bars, { scaleX: 0 });
  const tween = gsap.to(bars, { scaleX: 1, duration: 1.1, ease: "expo.out", stagger: 0.07, paused: true });
  const play = () => tween.play();
  ScrollTrigger.create({ trigger: q(page, ".case__leadout"), start: "top 92%", once: true, onEnter: play, onLeave: play });
}

/**
 * Next is the following record already starting. A plain click glides the band up until its spread
 * sits exactly where the next page's opening will be, then the route cuts across with no wipe.
 */
function nextBand(page: HTMLElement): Cleanup {
  const link = q<HTMLAnchorElement>(page, "[data-next]");
  if (!link) return () => {};
  let gliding = false;

  const onClick = (e: MouseEvent) => {
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    if (reducedMotion() || !lenis) return;
    e.preventDefault();
    if (gliding) return;
    gliding = true;
    const url = new URL(link.href, location.href);
    const label = q(link, ".case__next-label");
    const img = q<HTMLImageElement>(link, ".case__cover-media");
    link.classList.add("is-gliding");
    const distance = Math.abs(link.getBoundingClientRect().top);
    const duration = gsap.utils.clamp(0.55, 1.25, 0.45 + distance / 1600);
    if (label) gsap.to(label, { opacity: 0, duration: 0.35, delay: Math.max(0, duration - 0.4) });
    const decoded = img ? img.decode().catch(() => undefined) : Promise.resolve();
    const glided = new Promise<void>((resolve) =>
      lenis!.scrollTo(link, {
        duration,
        easing: (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2),
        lock: true,
        force: true,
        onComplete: () => resolve(),
      }),
    );
    Promise.all([glided, decoded])
      .then(() => {
        cutNext();
        return navigate(url);
      })
      .finally(() => {
        clearCut();
        gliding = false;
      });
  };

  link.addEventListener("click", onClick);
  return () => link.removeEventListener("click", onClick);
}

/** Case study behaviour: the opening plays as the stripes leave, the shots wipe in once each, Next glides into the following record */
export function mount(root: HTMLElement): Cleanup {
  const cleanups: Cleanup[] = [encore.mount(root)];
  const page = q(root, ".case");
  if (page) {
    const how = arriving();
    const ctx = gsap.context(() => {});
    if (!reducedMotion()) {
      opening(page, ctx, how);
      ctx.add(() => {
        shots(page);
        decision(page);
        leadOut(page);
      });
    }
    cleanups.push(() => ctx.revert(), nextBand(page));
  }
  return () => cleanups.forEach((fn) => fn());
}
