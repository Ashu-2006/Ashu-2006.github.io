import { mountReveals } from "../lib/reveal";
import { mountClock } from "../sections/clock";
import { fitText, mountCopy, mountScrambleHover } from "../sections/kit";
import { mountMorph } from "../sections/morph";

/** Contact: the address fitted to the width, copy, the scrubbed morph, socials and clock */
export function mount(root: HTMLElement) {
  const page = root.querySelector<HTMLElement>(".ct");
  if (!page) return mountReveals(root);
  const email = page.querySelector<HTMLElement>("[data-ct-email]");
  const inner = page.querySelector<HTMLElement>(".ct__email-in");
  const cleanups = [
    email && inner ? fitText(email, inner, "--ct-fs") : () => {},
    mountReveals(root),
    mountMorph(page, "ct__trail"),
    mountCopy(page),
    mountScrambleHover(page),
    mountClock(page),
  ];
  return () => cleanups.forEach((fn) => fn());
}
