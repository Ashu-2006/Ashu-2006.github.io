import { scrollToTarget } from "../core/scroll";
import { mountClock } from "./clock";
import { mountScrambleHover } from "./kit";

const mounted = new WeakSet<HTMLElement>();

/** The mark's morph pulls in MorphSVG, so it loads only once the footer comes within 400px of the viewport */
function lazyHoverMorph(link: HTMLElement): () => void {
  let off = () => {};
  let dead = false;
  const io = new IntersectionObserver(
    (entries) => {
      if (!entries.some((e) => e.isIntersecting)) return;
      io.disconnect();
      void import("./morph").then((m) => {
        if (!dead) off = m.mountHoverMorph(link);
      });
    },
    { rootMargin: "400px 0px" },
  );
  io.observe(link);
  return () => {
    dead = true;
    io.disconnect();
    off();
  };
}

/**
 * Wires the compact footer inside root: the small morphing mark on "Let's talk", scramble hovers, the
 * clock and Back to top. Safe to call twice for the same footer (the second call is a no-op), so the
 * router or a view may own it. Returns a cleanup that removes every listener and tween.
 */
export function mountFooter(root: ParentNode): () => void {
  const foot = root.querySelector<HTMLElement>(".foot");
  if (!foot || mounted.has(foot)) return () => {};
  mounted.add(foot);
  const toTop = foot.querySelector<HTMLElement>("[data-foot-top]");
  const talk = foot.querySelector<HTMLElement>("[data-foot-talk]");
  const onTop = () => scrollToTarget(0);
  toTop?.addEventListener("click", onTop);
  const cleanups = [mountScrambleHover(foot), mountClock(foot), talk ? lazyHoverMorph(talk) : () => {}];
  return () => {
    mounted.delete(foot);
    toTop?.removeEventListener("click", onTop);
    cleanups.forEach((fn) => fn());
  };
}
