import { esc } from "./html";

/**
 * TL;DR prose. Copy is written once, in full, with the parts a skimmer can drop wrapped in braces:
 * "The brand{'s own fine print} says results take 30 days." Kept runs become data-skim="keep" and darken in
 * TL;DR mode; braced runs become data-skim="dim" and are struck through. Write so the kept text reads as
 * a complete sentence on its own.
 */
export function skim(text: string) {
  return text
    .split(/(\{[^}]*\})/)
    .filter(Boolean)
    .map((part) =>
      part.startsWith("{") ? `<span data-skim="dim">${esc(part.slice(1, -1))}</span>` : `<span data-skim="keep">${esc(part)}</span>`,
    )
    .join("");
}

/** The toggle. Pressed state, label and the html[data-tldr] flag are kept in sync by lib/tldr.ts */
export const tldrButton = (cls = "") =>
  `<button type="button" class="tldr${cls ? ` ${cls}` : ""}" data-tldr-toggle aria-pressed="false" aria-label="Turn on TL;DR mode"><span class="tldr__label">TL;DR</span><span class="tldr__x" aria-hidden="true">&#215;</span></button>`;
