import { ABOUT, CAPABILITIES, EDUCATION, EXPERIENCE, FACTS, PRINCIPLES, SITE } from "../content";
import { esc, mediaTag, pad2 } from "../lib/html";

/** The human voice inside the headline: one word set in Instrument Serif italic */
const EM_WORD = "build";

const title = () => esc(ABOUT.title).replace(new RegExp(`\\b${EM_WORD}\\b`), `<em>${EM_WORD}</em>`);

const row = (org: string, role: string, when: string) => `<li class="about__row" data-reveal="up">
      <span class="about__org">${esc(org)}</span>
      <span class="about__role">${esc(role)}</span>
      <span class="label about__when">${esc(when)}</span>
    </li>`;

/**
 * About: a short bio beside a portrait, how I work (three principles driving the rolling polygon,
 * pinned while they step through), experience, capabilities and three facts.
 */
export function about(base: string) {
  return `
<article class="about" data-section="about" aria-labelledby="about-title">
  <header class="about__intro page-x">
    <p class="label about__kicker" data-reveal="scramble" data-reveal-now>About</p>
    <h1 class="about__title" id="about-title" data-reveal="lines" data-reveal-now data-delay="0.1">${title()}</h1>
  </header>

  <section class="about__bio page-x" aria-label="Bio">
    <figure class="about__portrait">
      <div class="about__frame plx" data-reveal="media" data-reveal-now data-delay="0.2" data-parallax><div class="plx__in">${mediaTag(base, "me/portrait", `Portrait of ${SITE.name}`, { eager: true })}</div></div>
      <figcaption class="label about__cap">${esc(SITE.name)}, ${esc(SITE.location)}</figcaption>
    </figure>
    <div class="about__text">
      <p class="about__lead" data-reveal="lines">${esc(ABOUT.lead)}</p>
      <div class="about__body">${ABOUT.body.map((p) => `<p data-reveal="up">${esc(p)}</p>`).join("")}</div>
    </div>
  </section>

  <section class="about__how" aria-labelledby="about-how">
    <div class="about__stage page-x">
      <div class="about__how-head">
        <h2 class="label about__how-title" id="about-how" data-reveal="scramble">How I work</h2>
        <p class="label about__sides" aria-hidden="true">Sides <span class="about__sides-n">04</span></p>
      </div>
      <ol class="about__principles">${PRINCIPLES.map(
        (p, i) => `
        <li class="about__principle${i === 0 ? " is-active" : ""}">
          <span class="label about__pn">${pad2(i + 1)}</span>
          <h3 class="about__ptitle">${esc(p.title)}</h3>
          <p class="about__pbody">${esc(p.body)}</p>
        </li>`,
      ).join("")}
      </ol>
      <div class="about__canvas" aria-hidden="true"><canvas class="about__poly"></canvas></div>
    </div>
  </section>

  <section class="about__cv page-x" aria-label="Experience and capabilities">
    <div class="about__exp">
      <h2 class="label about__h" data-reveal="scramble">Experience</h2>
      <ul class="about__rows">${EXPERIENCE.map((r) => row(r.org, r.title, r.when)).join("")}</ul>
      <h2 class="label about__h about__h--edu" data-reveal="scramble">Education</h2>
      <ul class="about__rows">${row(EDUCATION.org, EDUCATION.title, EDUCATION.when)}</ul>
    </div>
    <div class="about__caps">
      <h2 class="label about__h" data-reveal="scramble">Capabilities</h2>
      <div class="about__caplists">
        <div><p class="label about__capk">Design</p><ul class="about__caplist">${CAPABILITIES.design.map((c) => `<li>${esc(c)}</li>`).join("")}</ul></div>
        <div><p class="label about__capk">Build</p><ul class="about__caplist">${CAPABILITIES.build.map((c) => `<li>${esc(c)}</li>`).join("")}</ul></div>
      </div>
    </div>
  </section>

  <section class="about__facts page-x" aria-label="Facts">
    <dl class="about__factlist">${FACTS.map(
      (f) => `<div class="about__fact" data-reveal="up"><dt class="about__num">${esc(f.value)}</dt><dd class="about__flabel">${esc(f.label)}</dd></div>`,
    ).join("")}</dl>
  </section>
</article>`;
}
