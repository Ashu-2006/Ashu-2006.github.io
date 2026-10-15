import { SITE } from "../content";
import { esc } from "../lib/html";
import { MORPH_SHAPES, SHAPE_BOX } from "../sections/shapes";
import { socialItems } from "./contact";

/** The compact footer band on every page except Contact. Behaviour lives in sections/footer.ts. */
export const footer = (base: string) => `
<footer class="foot page-x" data-section="footer" aria-labelledby="foot-title">
  <h2 class="sr-only" id="foot-title">Contact</h2>
  <div class="foot__main">
    <a class="foot__talk" href="${base}contact/" data-foot-talk>
      <svg class="foot__mark" viewBox="0 0 ${SHAPE_BOX} ${SHAPE_BOX}" aria-hidden="true"><path data-morph-shape d="${MORPH_SHAPES[0]}"/></svg>
      <span class="foot__talk-t">Let's <em>talk</em></span>
      <svg class="foot__arrow" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6" fill="none" stroke="currentColor" stroke-width="1.5"/></svg>
    </a>
    <a class="label foot__email" href="mailto:${SITE.email}" data-scramble-hover data-cursor-tone="cobalt"><span data-scramble-text>${esc(SITE.email)}</span></a>
  </div>
  <div class="foot__bottom">
    <ul class="foot__socials" aria-label="Elsewhere">${socialItems("foot__social")}</ul>
    <p class="label foot__where">${esc(SITE.location)} <time class="foot__clock" data-clock>&nbsp;</time></p>
    <p class="label foot__copyright">&copy; ${new Date().getFullYear()} ${esc(SITE.name)}</p>
    <button class="label foot__totop" type="button" data-foot-top data-cursor-tone="cobalt">Back to top</button>
  </div>
</footer>`;
