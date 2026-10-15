import type { Cleanup } from "../core/router";
import * as crate from "../sections/crate";
import * as encore from "../sections/encore";
import * as hero from "../sections/hero";
import * as notes from "../sections/notes";
import * as tracks from "../sections/tracks";
import * as den from "../tv/den";

export function mount(root: HTMLElement): Cleanup {
  const cleanups = [hero, tracks, crate, den, notes, encore].map((section) => section.mount(root));
  return () => cleanups.forEach((fn) => fn());
}
