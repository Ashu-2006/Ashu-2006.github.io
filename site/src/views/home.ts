import { mountReveals } from "../lib/reveal";
import { mountApproach } from "../sections/approach";
import { mountClosing } from "../sections/closer";
import { mountHero } from "../sections/hero";
import { mountScrambleHover } from "../sections/kit";
import { mountShowcase } from "../sections/showcase";
import { mountSkills } from "../sections/skills";
import { mountTicker } from "../sections/ticker";
import { mountVoices } from "../sections/voices";

/** Home (HOME-REBUILD.md): hero, work, skills, the scroll-linked middle, the pinned show case, voices, contact, the strip, the footer */
export function mount(root: HTMLElement) {
  const contact = root.querySelector<HTMLElement>(".iq");
  const cleanups = [
    mountHero(root),
    mountShowcase(root),
    mountReveals(root),
    mountApproach(root),
    mountSkills(root),
    mountVoices(root),
    mountTicker(root),
    contact ? mountClosing(contact) : () => {},
    ...Array.from(root.querySelectorAll<HTMLElement>(".hw, .sk, .cr, .wr, .tk"), (el) => mountScrambleHover(el)),
  ];
  return () => cleanups.forEach((fn) => fn());
}
