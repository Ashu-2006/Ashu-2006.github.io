import { SITE, SOCIALS } from "../content";
import { esc, pad2 } from "../lib/html";
import { MORPH_SHAPES, SHAPE_BOX } from "../sections/shapes";

/** Checkpoint names along the morph track, in MORPH_SHAPES order */
const TICKS = ["Diamond", "Hexagon", "Octagon", "12-gon", "16-gon", "Circle"];

export const socialItems = (cls: string) =>
  SOCIALS.map(
    (s) =>
      `<li><a class="label ${cls}" href="${s.href}" target="_blank" rel="noopener noreferrer" data-scramble-hover data-cursor-tone="cobalt" aria-label="${esc(`${s.label}, ${s.handle}`)}"><span data-scramble-text>${esc(s.label)}</span></a></li>`,
  ).join("");

/** Contact: one viewport. The address set to the full width, the mouse-scrubbed morph, then the small print. */
export const contact = (_base: string) => {
  const mail = `mailto:${SITE.email}`;
  return `
<section class="ct page-x" data-section="contact" aria-labelledby="ct-title">
  <div class="ct__top">
    <p class="label ct__eyebrow"><span class="mask"><span class="mask__in" data-reveal="rise" data-reveal-now>Contact</span></span></p>
    <p class="label ct__avail"><span class="ct__dot" aria-hidden="true"></span><span data-reveal="scramble" data-reveal-now data-delay="0.1">${esc(SITE.availability)}</span></p>
    <button class="label ct__copy" type="button" data-copy><span data-copy-label>Copy email</span></button>
  </div>
  <h1 class="ct__title" id="ct-title">
    <span class="sr-only">Contact: </span>
    <a class="ct__email" href="${mail}" data-ct-email data-cursor-tone="cobalt"><span class="mask"><span class="mask__in ct__email-in" data-reveal="rise" data-reveal-now data-delay="0.08" data-copy-source>${esc(SITE.email)}</span></span></a>
  </h1>
  <p class="label ct__note" data-reveal="scramble" data-reveal-now data-delay="0.2">Email is the fastest way to reach me.</p>
  <div class="ct__track" data-morph-track>
    <span class="ct__line" aria-hidden="true"></span>
    <ol class="ct__ticks" aria-hidden="true">${TICKS.map((t, k) => `<li class="ct__tick" style="--k:${k}" data-morph-tick><span class="label ct__tick-l"><span class="ct__tick-n">${pad2(k + 1)}</span> <span class="ct__tick-t">${t}</span></span></li>`).join("")}</ol>
    <a class="ct__morph" href="${mail}" data-morph data-cursor="media" data-cursor-label="Email me" data-cursor-tone="cobalt" aria-label="Let's talk, email ${esc(SITE.email)}">
      <svg class="ct__svg" viewBox="0 0 ${SHAPE_BOX} ${SHAPE_BOX}" aria-hidden="true"><path class="ct__shape" data-morph-shape d="${MORPH_SHAPES[0]}"/></svg>
      <span class="label ct__mlabel" aria-hidden="true">[ Let's talk ]</span>
    </a>
  </div>
  <div class="ct__bottom">
    <ul class="ct__socials" aria-label="Elsewhere">${socialItems("ct__social")}</ul>
    <p class="label ct__where">${esc(SITE.location)} <time class="ct__clock" data-clock>&nbsp;</time></p>
    <p class="label ct__copyright">&copy; ${new Date().getFullYear()} ${esc(SITE.name)}</p>
  </div>
</section>`;
};
