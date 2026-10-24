import { SITE } from "../content";
import { esc } from "../lib/html";
import { socialItems } from "./contact";

/**
 * The footer on every page except Contact, on the ink surface. The inquiries line, then "Let's talk" set edge to
 * edge as the way into Contact (its letters swap face under the pointer, like the hero), then the small print. Behaviour in sections/footer.ts.
 */
export const footer = (base: string) => `
<footer class="foot tone-ink page-x" data-section="footer" data-chrome-tone="ink" aria-labelledby="foot-title">
  <h2 class="sr-only" id="foot-title">Contact</h2>
  <div class="foot__top">
    <p class="label foot__k">Contact</p>
    <p class="label foot__ask">For all inquiries, write to<br><a class="foot__mail" href="mailto:${SITE.email}" data-scramble-hover><span data-scramble-text>${esc(SITE.email)}</span></a></p>
  </div>
  <a class="foot__mark" href="${base}contact/" data-sig aria-label="Let's talk, contact page">
    <span class="foot__mark-in"><span data-swap data-radius="170">Let's</span><em><span data-swap data-radius="170">talk</span></em></span>
  </a>
  <div class="foot__bottom">
    <p class="label foot__name">${esc(SITE.name)}</p>
    <p class="label foot__copy">&copy; ${new Date().getFullYear()}<br>All rights reserved</p>
    <p class="label foot__where">${esc(SITE.location)}<br><time class="foot__clock" data-clock>&nbsp;</time></p>
    <ul class="foot__socials" aria-label="Elsewhere">${socialItems("foot__social")}</ul>
    <button class="label foot__totop" type="button" data-foot-top>[ Back to top ]</button>
  </div>
</footer>`;
