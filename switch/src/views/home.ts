import { mountReveals } from "../lib/reveal";
import { mountClock } from "../sections/clock";
import { mountHero } from "../sections/hero";
import { mountWorks } from "../sections/works";

/** Home: hero entrance and letter push, the pinned works stack, the All work row, the footer */
export function mount(root: HTMLElement) {
  const hero = root.querySelector<HTMLElement>(".hero");
  const cleanups = [mountHero(root), mountWorks(root), mountReveals(root), hero ? mountClock(hero) : () => {}];
  return () => cleanups.forEach((fn) => fn());
}
