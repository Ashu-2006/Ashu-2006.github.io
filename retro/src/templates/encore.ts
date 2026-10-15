import { SITE, SOCIALS } from "../content";
import { esc } from "../lib/html";

/** The address breaks after the @ when the column is narrow; a <wbr> keeps the copied and spoken text continuous */
function emailLines(email: string) {
  const at = email.indexOf("@") + 1;
  return `<span class="encore__email-line">${esc(email.slice(0, at))}</span><wbr><span class="encore__email-line">${esc(email.slice(at))}</span>`;
}

/** Contact and footer. Rendered at the end of every route. */
export function encore(_base: string) {
  const socials = SOCIALS.map(
    (s) =>
      `<li><a class="encore__social" href="${s.href}" target="_blank" rel="noopener noreferrer"><span class="encore__net">${esc(s.label)}</span><span class="encore__handle">${esc(s.handle)}</span><span class="sr-only">, opens in a new tab</span></a></li>`,
  ).join("");

  return `
<footer class="encore" id="contact" data-theme="poppy" data-section="contact" aria-labelledby="contact-title">
  <div class="encore__inner page-x">
    <h2 class="encore__avail" id="contact-title">${esc(SITE.availability)}</h2>
    <div class="encore__mail" data-email-box>
      <a class="encore__email" href="mailto:${SITE.email}" aria-label="${esc(SITE.email)}" data-cursor="open" data-email>${emailLines(SITE.email)}</a>
    </div>
    <button class="encore__copy" type="button" data-copy="${esc(SITE.email)}">
      <span class="encore__copy-roll" data-copy-roll><span class="encore__copy-size" aria-hidden="true">Copy email</span><span class="encore__copy-label">Copy email</span></span>
    </button>
    <ul class="encore__socials">${socials}</ul>
    <div class="encore__base">
      <p>${esc(SITE.location)}, <time data-clock>--:--</time></p>
      <p>&copy; ${new Date().getFullYear()} ${esc(SITE.name)}</p>
    </div>
  </div>
</footer>`;
}
