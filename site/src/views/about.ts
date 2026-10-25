import { mountReveals } from "../lib/reveal";
import { mountScrambleHover } from "../sections/kit";
import { mountSkills } from "../sections/skills";
import type { Route } from "../templates/routes";

/** About: reveals and the Skill(s) rows, as on home */
export function mount(root: HTMLElement, _route?: Route) {
  const sk = root.querySelector<HTMLElement>(".sk");
  const cleanups = [mountReveals(root), mountSkills(root), sk ? mountScrambleHover(sk) : () => {}];
  return () => cleanups.forEach((fn) => fn());
}
