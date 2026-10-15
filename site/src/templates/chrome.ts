import { SITE } from "../content";
import { switchControl } from "./switch";

type NavItem = { id: "home" | "work" | "playground" | "about" | "contact"; label: string; href: (base: string) => string };

/** Desktop nav. Every item is its own route, reached through the curtain. */
const NAV: NavItem[] = [
  { id: "work", label: "Work", href: (base) => `${base}work/` },
  { id: "playground", label: "Playground", href: (base) => `${base}playground/` },
  { id: "about", label: "About", href: (base) => `${base}about/` },
  { id: "contact", label: "Contact", href: (base) => `${base}contact/` },
];

/** The mobile menu adds the index itself */
const MENU: NavItem[] = [{ id: "home", label: "Index", href: (base) => base }, ...NAV];

/**
 * The fixed header. The bar is one difference-blended layer (white text that inverts over imagery);
 * rows marked data-page-shift drift with the page under the curtain. The mobile menu is a full-screen
 * cobalt panel below the bar, so the wordmark, the close button and the switch stay on top of it.
 */
export const chrome = (base: string) => `
<a class="chrome__skip label" href="#main" data-native>Skip to content</a>
<div class="chrome__bar" data-chrome-bar>
  <div class="chrome__row page-x" data-page-shift>
    <a class="chrome__mark" href="${base}" aria-label="${SITE.name}, index">${SITE.name}</a>
    <nav class="chrome__nav" aria-label="Primary">
      <ul class="chrome__list">${NAV.map(
        (n, i) =>
          `<li><a class="chrome__link" href="${n.href(base)}" data-nav="${n.id}"><span class="chrome__txt" data-text="${n.label}">${n.label}</span></a>${i < NAV.length - 1 ? '<span class="chrome__comma" aria-hidden="true">,</span>' : ""}</li>`,
      ).join("")}</ul>
    </nav>
    <p class="chrome__time label"><span class="chrome__city">Jabalpur</span> <time data-clock>00:00 am</time></p>
    <div class="chrome__end">
      <button class="chrome__menu-btn label" type="button" aria-expanded="false" aria-controls="chrome-menu" data-menu-btn><span class="mask"><span class="mask__in" data-menu-label>Menu</span></span></button>
      <div class="chrome__switch">${switchControl()}</div>
    </div>
  </div>
</div>
<div class="chrome__menu" id="chrome-menu" data-chrome-menu data-cursor-tone="cobalt" hidden>
  <nav class="chrome__mnav page-x" aria-label="Menu">
    <ul>${MENU.map(
      (n, i) =>
        `<li><a class="chrome__mlink" href="${n.href(base)}" data-nav="${n.id}"><span class="chrome__mnum label mask"><span class="mask__in">0${i + 1}</span></span><span class="mask"><span class="mask__in">${n.label}</span></span></a></li>`,
    ).join("")}</ul>
  </nav>
  <div class="chrome__mfoot page-x label">
    <span class="mask"><span class="mask__in">${SITE.location}</span></span>
    <span class="mask"><span class="mask__in"><time data-clock>00:00 am</time></span></span>
  </div>
</div>`;
