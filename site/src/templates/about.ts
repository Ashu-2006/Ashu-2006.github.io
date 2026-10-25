import { ABOUT, EDUCATION, EXPERIENCE } from "../content";
import { esc, mediaTag } from "../lib/html";
import { head, skills } from "./home";

const row = (role: string, org: string, when: string) => `
      <li class="row abt-exp__row" data-reveal="up">
        <span class="abt-exp__role">${esc(role)}</span>
        <span class="label abt-exp__org">${esc(org)}</span>
        <span class="label abt-exp__when">${esc(when)}</span>
      </li>`;

/** A personal photo in a clip frame that opens as it enters */
const photo = (base: string, key: string, alt: string, cls: string, delay = 0) =>
  `<figure class="abt-how__ph ${cls}" data-reveal="media" data-delay="${delay}">${mediaTag(base, key, alt)}</figure>`;

/**
 * About, after vedantjamwal.com/about: one line on ink, how I work in two short paragraphs beside the photos and
 * the line about where I come from, experience as hairline rows, then the home page's Skill(s) section.
 */
export function about(base: string) {
  return `
<article class="about" data-section="about" aria-labelledby="about-title">
  <header class="abt-hero tone-ink page-x" data-chrome-tone="ink">
    <p class="label abt-hero__k" data-reveal="scramble" data-reveal-now>About</p>
    <p class="label abt-hero__x" data-reveal="scramble" data-reveal-now>Info</p>
    <h1 class="abt-hero__t" id="about-title" data-reveal="lines" data-reveal-now data-delay="0.15">${esc(ABOUT.hero)}</h1>
    <p class="label abt-hero__scroll" aria-hidden="true">[ Scroll down ]</p>
  </header>

  <section class="abt-how page-x" aria-labelledby="abt-how-title">${head("abt-how-title", "How I work", "How I work, <em>and build</em>", "Process")}
    <div class="abt-how__cols">
      <div class="abt-how__col" data-reveal="up"><p class="label abt-how__k">Thinking</p><p class="abt-how__p">${esc(ABOUT.thinking)}</p></div>
      <div class="abt-how__col" data-reveal="up" data-delay="0.08"><p class="label abt-how__k">Making</p><p class="abt-how__p">${esc(ABOUT.making)}</p></div>
    </div>
    <div class="abt-how__photos">
      ${photo(base, "me/portrait", "Ashutosh, portrait", "abt-how__ph--a")}
      ${photo(base, "me/riverside", "Ashutosh by the river", "abt-how__ph--b", 0.08)}
      ${photo(base, "me/working", "Ashutosh at work", "abt-how__ph--c", 0.04)}
    </div>
    <p class="abt-how__note" data-reveal="lines">${esc(ABOUT.lead)}</p>
  </section>

  <section class="abt-exp page-x" aria-labelledby="abt-exp-title">${head("abt-exp-title", "Practice", "Experi<em>ence</em>", "Career")}
    <ul class="rows abt-exp__rows">${EXPERIENCE.map((r) => row(r.title, r.org, r.when)).join("")}${row(EDUCATION.title, EDUCATION.org, EDUCATION.when)}
    </ul>
  </section>
${skills(base, false)}
</article>`;
}
