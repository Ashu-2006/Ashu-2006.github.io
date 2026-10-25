import { mountReveals } from "../lib/reveal";
import { mountClosing } from "../sections/closer";
import { mountFooter } from "../sections/footer";
import { mountScrambleHover } from "../sections/kit";
import { mountTicker } from "../sections/ticker";

/** Contact: the home page's inquiry form and playground strip, then the footer */
export function mount(root: HTMLElement) {
  const form = root.querySelector<HTMLElement>(".iq");
  const tk = root.querySelector<HTMLElement>(".tk");
  const cleanups = [
    mountReveals(root),
    form ? mountClosing(form) : () => {},
    mountTicker(root),
    tk ? mountScrambleHover(tk) : () => {},
    mountFooter(root),
  ];
  return () => cleanups.forEach((fn) => fn());
}
