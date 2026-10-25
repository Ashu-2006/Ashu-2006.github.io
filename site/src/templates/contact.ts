import { SOCIALS } from "../content";
import { esc } from "../lib/html";
import { footer } from "./footer";
import { contact as inquiry, strip } from "./home";

/** scramble: false leaves the hover to the caller's stylesheet (the footer's square marker) */
export const socialItems = (cls: string, scramble = true) =>
  SOCIALS.map(
    (s) =>
      `<li><a class="label ${cls}" href="${s.href}" target="_blank" rel="noopener noreferrer"${scramble ? " data-scramble-hover" : ""} data-cursor-tone="cobalt" aria-label="${esc(`${s.label}, ${s.handle}`)}"><span data-scramble-text>${esc(s.label)}</span></a></li>`,
  ).join("");

/**
 * Contact (/contact/), after vedantjamwal.com/contact and built from the home page's own closing sections: the
 * inquiry form, the playground strip, then the footer.
 */
export const contact = (base: string) => `
<h1 class="sr-only">Contact</h1>${inquiry()}${strip(base)}${footer(base)}`;
