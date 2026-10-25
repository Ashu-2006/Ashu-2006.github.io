import { SITE } from "../content";
import { esc, roll } from "../lib/html";
import { socialItems } from "./contact";

/**
 * The footer on every page, on the ink surface. The inquiries line, then the "Ash-Design" wordmark set
 * edge to edge as the way into Contact (its letters swap face under the pointer, like the hero), then the small print. Behaviour in sections/footer.ts.
 */
export const footer = (base: string) => `
<footer class="foot tone-ink page-x" data-section="footer" data-chrome-tone="ink" aria-labelledby="foot-title">
  <h2 class="sr-only" id="foot-title">Contact</h2>
  <div class="foot__top">
    <p class="label foot__k" data-reveal="up">Contact</p>
    <p class="label foot__ask" data-reveal="up" data-delay="0.08">For all inquiries, write to<br><a class="foot__mail sq-mark" href="mailto:${SITE.email}">${esc(SITE.email)}</a></p>
  </div>
  <a class="foot__mark" href="${base}contact/" data-sig aria-label="Ash-Design, contact page">
    <span class="foot__mark-in"><span data-swap data-radius="170">Ash-</span><em><span data-swap data-radius="170">Design</span></em></span>
  </a>
  <div class="foot__bottom">
    <p class="label foot__name" data-reveal="up">${esc(SITE.name)}</p>
    <p class="label foot__copy" data-reveal="up" data-delay="0.06">&copy; ${new Date().getFullYear()}<br>All rights reserved</p>
    <p class="label foot__where" data-reveal="up" data-delay="0.12">${esc(SITE.location)}<br><time class="foot__clock" data-clock>&nbsp;</time></p>
    <ul class="foot__socials" aria-label="Elsewhere" data-reveal="up" data-delay="0.18">${socialItems("foot__social sq-mark", false)}</ul>
    <button class="label foot__totop" type="button" data-foot-top data-reveal="up" data-delay="0.24">[ ${roll("Back to top")} ]</button>
  </div>
</footer>`;
