import { ABOUT, CAPABILITIES, EDUCATION, EXPERIENCE, FACTS, PRINCIPLES, bySlug } from "../content";
import { esc, mediaInfo, mediaUrl } from "../lib/html";

/** The prints, back to front. A fact sticker is stuck to three of them, so it travels with its print. */
const PRINTS = [
  { file: "me/night", alt: "Ashutosh at night", fact: -1 },
  { file: "me/working", alt: "Ashutosh working at a laptop", fact: 2 },
  { file: "me/riverside", alt: "Ashutosh by a river", fact: 1 },
  { file: "me/portrait", alt: "Ashutosh in front of a stage curtain", fact: 0 },
];

/** A hyphenated word such as "400-row" never splits across lines */
const keepHyphens = (text: string) => esc(text).replace(/(\S+-\S+)/g, '<span class="rule__keep">$1</span>');

/** Festival billing: the first act headlines, the next two are second line, the rest share the third */
const bill = (items: readonly string[]) =>
  items.map((c, i) => `<li class="bill__act bill__act--${i === 0 ? "head" : i < 3 ? "second" : "third"}">${esc(c)}</li>`).join("");

/** About, as liner notes: prints with fact stickers, the bio, three rules, the tour dates and the line-up. */
export function notes(base: string) {
  const prints = PRINTS.map((p, i) => {
    const { w, h } = mediaInfo(p.file);
    const f = p.fact >= 0 ? FACTS[p.fact] : null;
    const sticker = f
      ? `
          <p class="sticker sticker--${p.fact === 1 ? "poppy" : "harvest"}${f.value.length > 4 ? " sticker--wide" : ""}"><span class="sticker__value">${esc(f.value)}</span> <span class="sticker__label">${esc(f.label)}</span></p>`
      : "";
    return `
        <figure class="print print--${i}" data-print data-cursor="drag" tabindex="0" aria-describedby="prints-hint">
          <img src="${mediaUrl(base, p.file, "jpg", true)}" width="${w}" height="${h}" alt="${esc(p.alt)}" loading="lazy" decoding="async" draggable="false">${sticker}
        </figure>`;
  }).join("");

  const rules = PRINCIPLES.map(
    (r) => `
      <li class="rule">
        <h3 class="rule__title">${esc(r.title)}</h3>
        <p class="rule__body">${keepHyphens(r.body)}</p>
      </li>`,
  ).join("");

  const dates = [...EXPERIENCE, { ...EDUCATION, projects: [] as string[], current: false }]
    .map(
      (r) => `
      <li class="date">
        <p class="date__when">${esc(r.when)}</p>
        <h4 class="date__org">${esc(r.org)}</h4>
        <div class="date__detail">
          <p class="date__title">${esc(r.title)}</p>
          <p class="date__note">${esc(r.note)}</p>${
            r.projects.length
              ? `
          <ul class="date__work" aria-label="Projects at ${esc(r.org)}">${r.projects
                .map((slug) => `<li><a href="${base}work/${slug}/">${esc(bySlug(slug).name)}</a></li>`)
                .join("")}</ul>`
              : ""
          }
        </div>
      </li>`,
    )
    .join("");

  return `
<section class="notes" id="about" data-theme="bone" data-section="about" aria-labelledby="about-title">
  <div class="notes__head page-x">
    <h2 class="section-title notes__title" id="about-title">${esc(ABOUT.title)}</h2>
  </div>
  <div class="notes__intro page-x">
    <div class="prints" data-prints>${prints}
      <p class="sr-only" id="prints-hint">Drag a print to move it, or use the arrow keys while it has focus.</p>
    </div>
    <div class="notes__copy">
      <p class="notes__lead">${esc(ABOUT.lead)}</p>
      ${ABOUT.body.map((p) => `<p>${esc(p)}</p>`).join("\n      ")}
    </div>
  </div>

  <ul class="rules page-x" aria-label="How I work">${rules}
  </ul>

  <div class="tour page-x">
    <h3 class="tour__title">Experience</h3>
    <ol class="tour__dates">${dates}
    </ol>
  </div>

  <div class="bill page-x">
    <div class="bill__poster">
      <h3 class="bill__title">What I do</h3>
      <h4 class="bill__stage">Design</h4>
      <ul class="bill__acts">${bill(CAPABILITIES.design)}</ul>
      <h4 class="bill__stage bill__stage--build">Build</h4>
      <ul class="bill__acts bill__acts--build">${bill(CAPABILITIES.build)}</ul>
    </div>
  </div>
</section>`;
}
