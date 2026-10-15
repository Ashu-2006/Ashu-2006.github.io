import { scrollToTarget } from "../core/scroll";
import { mountClock } from "./clock";
import { mountScrambleHover } from "./kit";
import { mountHoverMorph } from "./morph";

const mounted = new WeakSet<HTMLElement>();

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
  const cleanups = [mountScrambleHover(foot), mountClock(foot), talk ? mountHoverMorph(talk) : () => {}];
  return () => {
    mounted.delete(foot);
    toTop?.removeEventListener("click", onTop);
    cleanups.forEach((fn) => fn());
  };
}
