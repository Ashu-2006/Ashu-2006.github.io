import { scrollToTarget } from "../core/scroll";
import { mountClosing } from "./closer";

const mounted = new WeakSet<HTMLElement>();

/**
 * Wires the footer inside root: the wordmark (fitted, face swap), scramble links, the clock and Back to top, via
 * sections/closer.ts. Safe to call twice for the same footer (the second call is a no-op), so the router or a view
 * may own it. Returns a cleanup that removes every listener and tween.
 */
export function mountFooter(root: ParentNode): () => void {
  const foot = root.querySelector<HTMLElement>(".foot");
  if (!foot || mounted.has(foot)) return () => {};
  mounted.add(foot);
  const toTop = foot.querySelector<HTMLElement>("[data-foot-top]");
  const onTop = () => scrollToTarget(0);
  toTop?.addEventListener("click", onTop);
  const stop = mountClosing(foot);
  return () => {
    mounted.delete(foot);
    toTop?.removeEventListener("click", onTop);
    stop();
  };
}
