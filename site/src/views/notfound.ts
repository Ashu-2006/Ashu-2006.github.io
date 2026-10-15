import { mountReveals } from "../lib/reveal";

/** 404: the line rises in, the footer still works */
export function mount(root: HTMLElement) {
  const cleanups = [mountReveals(root)];
  return () => cleanups.forEach((fn) => fn());
}
