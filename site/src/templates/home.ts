import { FAQ, INTRO, KINDS, PLAY, PLAY_KINDS, PROJECTS, QUOTES, SITE, SKILLS, SOCIALS, STATS, WRITING, bySlug, type Project } from "../content";
import { esc, mediaInfo, mediaUrl, pad2 } from "../lib/html";

/** The portrait slot between the two lines of the name cycles through these */
export const PHOTO_COUNT = 8;

/** Work grid: every case study, then two client sites, ten in all (two rows of five) */
export const GRID = [...PROJECTS.filter((p) => p.tier === "case"), ...["kuzara-green", "atherna"].flatMap((s) => bySlug(s) ?? [])].slice(0, 10);

/** Show case: the first five case studies, in array order */
export const SHOWCASE = PROJECTS.filter((p) => p.tier === "case").slice(0, 5);

const kinds = (p: Project) => p.kinds.map((k) => KINDS[k]).join(", ");
const href = (base: string, p: Project) => `${base}work/${p.slug}/`;
const ext = `target="_blank" rel="noopener noreferrer"`;

/** A still image sized from media.json. Videos are shown by their poster here; the case pages play them. */
function still(base: string, file: string, alt: string, { small = true, eager = false, cls = "" } = {}) {
  const { w, h } = mediaInfo(file);
  return `<img${cls ? ` class="${cls}"` : ""} src="${mediaUrl(base, file, "jpg", small)}" width="${w}" height="${h}" alt="${esc(alt)}" ${eager ? 'fetchpriority="high"' : 'loading="lazy"'} decoding="async" draggable="false">`;
}

/** "[ View all ]": the bracketed mono action used across the page */
const action = (href: string, text: string, attrs = "") =>
  `<a class="label act" href="${href}" ${attrs} data-scramble-hover><span aria-hidden="true">[</span><span data-scramble-text>${esc(text)}</span><span aria-hidden="true">]</span></a>`;

/**
 * The section head every section after Work uses: what it is (left), the heading from the half column, and its
 * theme in one word (right).
 */
const head = (id: string, k: string, title: string, x: string) => `
  <header class="hh">
    <p class="label hh__k" data-reveal="scramble">${esc(k)}</p>
    <h2 class="hh__t" id="${id}"><span class="mask"><span class="mask__in" data-reveal="rise">${title}</span></span></h2>
    <p class="label hh__x" data-reveal="scramble">${esc(x)}</p>
  </header>`;

/**
 * Hero, ported from the main site: the name in two lines with a portrait slot before "Rana", the intro
 * below. Every character is a swap target (sections/swap.ts): near the pointer it turns into Instrument
 * Serif italic or Tiny5 in cobalt, then settles back.
 */
function hero(base: string) {
  const [first, last] = SITE.name.split(" ");
  const photos = Array.from(
    { length: PHOTO_COUNT },
    /* Only the first photo loads with the page (it is the likely LCP); the rest load one step ahead of their turn */
    (_, i) => `<img ${i ? "data-src" : "src"}="${base}images/photo-${i + 1}.jpg" alt="" width="600" height="600" decoding="async"${i ? "" : ' class="is-on" fetchpriority="high"'}>`,
  ).join("");
  return `
<section class="hero page-x" data-section="hero" aria-label="Introduction">
  <div class="hero__stage">
    <div class="hero__fit" data-hero-fit>
      <h1 class="hero__name" data-hero-name>
        <span class="sr-only">${esc(SITE.name)}</span>
        <span class="hero__l1" aria-hidden="true"><span class="hero__mask"><span class="hero__word" data-swap data-radius="140">${esc(first)}</span></span></span>
        <span class="hero__slot" aria-hidden="true" data-hero-slot>${photos}</span>
        <span class="hero__l2" aria-hidden="true"><span class="hero__mask"><span class="hero__word" data-swap data-radius="140">${esc(last)}</span></span></span>
      </h1>
    </div>
  </div>
  <div class="hero__foot">
    <p class="hero__intro" data-swap data-swap-rows data-radius="80">${esc(INTRO)}</p>
  </div>
</section>`;
}

/** Work [16]: ten covers in a five-column grid, bottom-aligned so each keeps its own shape */
function work(base: string) {
  const cards = GRID.map(
    (p, i) => `
      <li class="hw__card" data-reveal="up" data-delay="${((i % 5) * 0.05).toFixed(2)}">
        <a class="hw__link" href="${href(base, p)}" data-cursor="media" data-cursor-label="Open case">
          <span class="hw__media" data-flip>${still(base, p.shots[0].file, p.shots[0].alt)}</span>
          <span class="hw__cap"><span class="label hw__name">${esc(p.name)}</span><span class="label hw__year">${esc(p.year)}</span><span class="label hw__kinds">${esc(kinds(p))}</span></span>
        </a>
      </li>`,
  ).join("");
  return `
<section class="hw page-x" id="work" data-section="work" aria-labelledby="hw-title">
  <header class="hw__head">
    <h2 class="hh__t hw__title" id="hw-title"><span class="mask"><span class="mask__in" data-reveal="rise">Selected <em>work</em></span></span><sup class="label hw__count">[${pad2(GRID.length)}]</sup></h2>
    ${action(`${base}work/`, `View all ${PROJECTS.length}`)}
  </header>
  <ol class="hw__grid">${cards}
  </ol>
</section>`;
}

/** Skill(s): four indexed rows, each with an image strip or, on the toggle, a description */
function skills(base: string) {
  const rows = SKILLS.map((s, i) => {
    const id = `sk-${i + 1}`;
    const imgs = s.projects
      .map((entry) => {
        const [slug, n] = entry.split(":");
        const p = bySlug(slug);
        const shot = p?.shots[Number(n)] ?? p?.shots[0];
        return shot ? `<span class="sk__img">${still(base, shot.file, shot.alt)}</span>` : "";
      })
      .join("");
    return `
    <li class="sk__row" data-skill>
      <div class="sk__info">
        <p class="label sk__n">[${pad2(i + 1)}]</p>
        <h3 class="label sk__name">${esc(s.name)}</h3>
        <div class="sk__foot">
          <p class="label sk__sub">${esc(s.sub)}</p>
          <div class="label sk__tabs" role="tablist" aria-label="${esc(s.name)}">
            <button class="sk__tab" type="button" role="tab" id="${id}-t1" aria-controls="${id}-p1" aria-selected="true">Images</button>
            <span aria-hidden="true">/</span>
            <button class="sk__tab" type="button" role="tab" id="${id}-t2" aria-controls="${id}-p2" aria-selected="false" tabindex="-1">Description</button>
          </div>
        </div>
      </div>
      <div class="sk__pane">
        <div class="sk__imgs" role="tabpanel" id="${id}-p1" aria-labelledby="${id}-t1">${imgs}</div>
        <p class="sk__body" role="tabpanel" id="${id}-p2" aria-labelledby="${id}-t2" hidden>${esc(s.body)}</p>
      </div>
    </li>`;
  }).join("");
  return `
<section class="sk page-x" data-section="skills" aria-labelledby="sk-title">
  <header class="hw__head">
    <h2 class="hh__t" id="sk-title"><span class="mask"><span class="mask__in" data-reveal="rise">Skill<em>(s)</em></span></span></h2>
    ${action(`${base}about/`, "About me")}
  </header>
  <ol class="sk__rows">${rows}
  </ol>
</section>`;
}

/** The words in [brackets] are set in the serif italic accent */
const STATEMENT = "I'm a [product designer who writes the frontend] for teams building with AI. I read the codebase before I open Figma, design every state the demo skips and ship the system, not just the screen.";

/** What I do: one statement that fills in word by word as it scrolls past (sections/approach.ts) */
function approach() {
  let accent = false;
  const words = STATEMENT.split(" ")
    .map((raw) => {
      const opens = raw.startsWith("[");
      const closes = raw.includes("]");
      if (opens) accent = true;
      const w = raw.replace(/[[\]]/g, "");
      const html = accent ? `<em class="ap__w">${esc(w)}</em>` : `<span class="ap__w">${esc(w)}</span>`;
      if (closes) accent = false;
      return html;
    })
    .join(" ");
  return `
<section class="ap page-x" data-section="approach" aria-labelledby="ap-title">
  <div class="ap__labels">
    <p class="label" data-reveal="scramble">What I do</p>
    <p class="label" data-reveal="scramble">The approach</p>
  </div>
  <h2 class="sr-only" id="ap-title">What I do</h2>
  <p class="ap__text" data-ap-text>${words}</p>
</section>`;
}

/** Credits: an ink panel with the sign-off lines beside a halftone collage of the work, one piece in colour */
function credits(base: string) {
  const pool = PLAY.slice(0, 8);
  const center = PROJECTS[0];
  const tiles = pool
    .map((p, i) => (i === 4 ? `<span class="cr__tile cr__tile--hero">${still(base, center.shots[0].file, "")}</span>` : "") + `<span class="cr__tile">${still(base, p.file, "")}</span>`)
    .join("");
  return `
<section class="cr" data-section="credits" aria-label="Credits">
  <div class="cr__ink tone-ink" data-chrome-tone="ink" data-cr-ink>
    <p class="cr__lines">
      <span>Ash<span class="cr__bar" aria-hidden="true"></span>Product design</span>
      <span>${new Date().getFullYear()}</span>
      <span>Design and frontend</span>
      <span>${esc(SITE.location)}</span>
    </p>
    <div class="cr__foot">
      <p class="label cr__tag">Good design survives real data</p>
      ${action(`${base}about/`, "About me")}
    </div>
  </div>
  <div class="cr__grid tone-ink" data-chrome-tone="ink" aria-hidden="true" data-cr-grid>${tiles}</div>
</section>`;
}

/** The advantage: three numbers, each a hairline row */
function advantage() {
  const rows = STATS.map(
    (s, i) => `
    <li class="row adv__row" data-reveal="up">
      <span class="label row__n">[${pad2(i + 1)}]</span>
      <span class="adv__v"><span data-count="${s.value}">${s.value}</span>${esc(s.suffix)}</span>
      <span class="label adv__l">${esc(s.label)}</span>
    </li>`,
  ).join("");
  return `
<section class="adv page-x" data-section="advantage" aria-labelledby="adv-title">${head("adv-title", "The advantage", "Shipping shapes the <em>work</em>", "Execution")}
  <ol class="rows">${rows}
  </ol>
</section>`;
}

/** Show case: a window that grows to full bleed, then steps through five case studies (sections/showcase.ts) */
function showcase(base: string) {
  const slides = SHOWCASE.map(
    (p, i) =>
      `<span class="sc__slide${i ? "" : " is-on"}" data-sc-slide data-href="${href(base, p)}" data-name="${esc(p.name)}" data-kind="${esc(kinds(p))}" data-year="${esc(p.year)}">${still(base, p.shots[0].file, p.shots[0].alt, { small: false })}</span>`,
  ).join("");
  const index = SHOWCASE.map((p, i) => `<li class="sc__i${i ? "" : " is-on"}" data-sc-i>${esc(p.name)}</li>`).join("");
  const first = SHOWCASE[0];
  const list = SHOWCASE.map(
    (p, i) => `
      <li class="sc__card" data-reveal="up">
        <a class="sc__clink" href="${href(base, p)}" data-cursor="media" data-cursor-label="Open case">
          <span class="sc__cmedia">${still(base, p.shots[0].file, p.shots[0].alt)}</span>
          <span class="sc__ccap"><span class="label">${pad2(i + 1)}</span><span class="sc__cname">${esc(p.name)}</span><span class="label">${esc(kinds(p))}, ${esc(p.year)}</span></span>
        </a>
      </li>`,
  ).join("");
  return `
<section class="sc" data-section="showcase" aria-labelledby="sc-title">
  <h2 class="sr-only" id="sc-title">Show case</h2>
  <div class="sc__pin" data-sc-pin>
    <a class="sc__frame" href="${href(base, first)}" data-sc-frame data-chrome-skip data-cursor="media" data-cursor-label="Open case" aria-label="Open case: ${esc(first.name)}">${slides}<span class="sc__shade" aria-hidden="true"></span></a>
    <p class="sc__word sc__word--l" aria-hidden="true" data-sc-l>Show</p>
    <p class="sc__word sc__word--r" aria-hidden="true" data-sc-r><em>case</em></p>
    <div class="sc__cap" data-sc-cap aria-live="polite">
      <span class="label sc__n" data-sc-n>01</span>
      <span class="sc__name" data-sc-name>${esc(first.name)}</span>
      <span class="sc__kind" data-sc-kind>${esc(kinds(first))}</span>
      <span class="label sc__year" data-sc-year>${esc(first.year)}</span>
    </div>
    <ol class="sc__index" aria-hidden="true" data-sc-index>${index}</ol>
  </div>
  <div class="sc__mobile page-x">
    <p class="label sc__mk">Show case</p>
    <ol class="sc__list">${list}
    </ol>
  </div>
</section>`;
}

/** Questions: eight hiring objections as native disclosure rows */
function questions() {
  const rows = FAQ.map(
    (f, i) => `
    <li class="row faq__row" data-reveal="up">
      <details class="faq__d">
        <summary class="faq__q">
          <span class="label row__n">[${pad2(i + 1)}]</span>
          <span class="label faq__t">${esc(f.q)}</span>
          <span class="label faq__tag">${esc(f.tag)}</span>
          <span class="faq__ic" aria-hidden="true"></span>
        </summary>
        <div class="faq__a"><p>${esc(f.a)}</p></div>
      </details>
    </li>`,
  ).join("");
  return `
<section class="faq page-x" data-section="questions" aria-labelledby="faq-title">${head("faq-title", "Frequently asked questions", "Answers before the <em>call</em>", "Clarity")}
  <ol class="rows">${rows}
  </ol>
</section>`;
}

/** Writing: the posts as rows, each opening on LinkedIn */
function writing() {
  const rows = WRITING.map((p, i) => {
    const inner = `
          <span class="label row__n">[${pad2(i + 1)}]</span>
          <span class="wr__main"><span class="wr__title">${esc(p.title)}</span><span class="wr__note">${esc(p.note)}</span></span>
          <span class="label wr__meta">${p.href ? `${esc(p.where)}<br>${esc(p.date)}` : "In draft"}</span>`;
    return `
    <li class="row wr__row${p.href ? "" : " is-draft"}" data-reveal="up">${
      p.href ? `<a class="wr__link" href="${p.href}" ${ext} data-cursor="media" data-cursor-label="Read">${inner}</a>` : `<div class="wr__link">${inner}</div>`
    }</li>`;
  }).join("");
  const li = SOCIALS.find((s) => s.label === "LinkedIn");
  return `
<section class="wr page-x" data-section="writing" aria-labelledby="wr-title">${head("wr-title", "Writing", "Notes from <em>the work</em>", "Thinking")}
  <ol class="rows">${rows}
  </ol>
  ${li ? `<div class="wr__more">${action(li.href, "More on LinkedIn", ext)}</div>` : ""}
</section>`;
}

/** Voices: one quote at a time on ink, stepped with Prev and Next (sections/voices.ts) */
function voices() {
  const initials = (n: string) =>
    n
      .split(" ")
      .map((w) => w[0])
      .join("")
      .slice(0, 2);
  const slides = QUOTES.map(
    (q, i) => `
      <figure class="vc__slide${i ? "" : " is-on"}" data-vc-slide${i ? " hidden" : ""}>
        <blockquote class="vc__q"><p>"${esc(q.text)}"</p></blockquote>
        <figcaption class="vc__who"><span class="vc__face" aria-hidden="true">${esc(initials(q.name))}</span><span class="label vc__name">${esc(q.name)}</span><span class="label vc__role">${esc(q.role)}</span></figcaption>
      </figure>`,
  ).join("");
  return `
<section class="vc tone-ink page-x" data-section="voices" data-chrome-tone="ink" aria-labelledby="vc-title">
  <div class="vc__labels"><p class="label" data-reveal="scramble">Trust</p><p class="label" data-reveal="scramble">Testimonial</p></div>
  <h2 class="vc__title" id="vc-title"><span class="mask"><span class="mask__in" data-reveal="rise">Words from the <em>teams</em></span></span></h2>
  <div class="vc__stage" data-vc>${slides}
  </div>
  <div class="label vc__nav">
    <button class="vc__btn" type="button" data-vc-prev>[ Prev ]</button>
    <span class="vc__count"><span data-vc-n>01</span> / ${pad2(QUOTES.length)}</span>
    <button class="vc__btn" type="button" data-vc-next>[ Next ]</button>
  </div>
</section>`;
}

const TOPICS = ["Product design", "Design system", "Frontend build", "Full-time role", "Something else"];

/** Contact: the ask on ink. The form writes an email in the visitor's mail app (sections/closer.ts). */
function contact() {
  const field = (label: string, input: string, wide = false) =>
    `<label class="iq__f${wide ? " iq__f--wide" : ""}"><span class="label iq__l">${label}</span>${input}</label>`;
  return `
<section class="iq tone-ink page-x" data-section="contact" data-chrome-tone="ink" aria-labelledby="iq-title">${head("iq-title", "Contact", "Say <em>hello</em>", "Inquiry")}
  <div class="iq__body">
    <div class="iq__side">
      <p class="label iq__avail"><span class="hero__dot" aria-hidden="true"></span>${esc(SITE.availability)}</p>
      <p class="label iq__direct">Or write to<br><a href="mailto:${SITE.email}" data-copy-source data-scramble-hover><span data-scramble-text>${esc(SITE.email)}</span></a></p>
    </div>
    <div class="iq__main">
      <p class="iq__lede" data-reveal="lines">Every good product starts as a conversation. Tell me what you're building and where it's stuck.</p>
      <form class="iq__form" data-inquiry data-reveal="up">
        ${field("Name", `<input class="iq__in" name="name" type="text" autocomplete="name" placeholder="Jane Smith">`)}
        ${field("Company", `<input class="iq__in" name="company" type="text" autocomplete="organization" placeholder="Acme AI">`)}
        ${field(
          "Topic",
          `<select class="iq__in iq__select" name="topic"><option value="">Select topic</option>${TOPICS.map((t) => `<option>${esc(t)}</option>`).join("")}</select>`,
          true,
        )}
        ${field("Your message", `<textarea class="iq__in iq__area" name="message" rows="3" placeholder="What you're building, and where it's stuck"></textarea>`, true)}
        <div class="iq__actions">
          <button class="label act iq__send" type="submit">[ Send ]</button>
          ${action(SITE.booking, "Book a call", ext)}
          <button class="label act" type="button" data-copy><span aria-hidden="true">[</span><span data-copy-label>Copy email</span><span aria-hidden="true">]</span></button>
        </div>
        <p class="label iq__fine">Opens your mail app with this filled in. Nothing is sent from the page.</p>
      </form>
    </div>
  </div>
</section>`;
}

/** The last look at the work: the playground on the curved ticker (sections/ticker.ts), on ink */
function strip(base: string) {
  const tiles = (copy: boolean) =>
    PLAY.map(
      (p) => `
      <li class="tk__item">
        <a class="tk__tile" href="${base}playground/"${copy ? ' tabindex="-1"' : ""} data-cursor="media" data-cursor-label="Playground">
          <span class="tk__media">${still(base, p.file, p.title)}</span>
          <span class="tk__cap"><span class="label tk__name">${esc(p.title)}</span><span class="label tk__kind">${esc(PLAY_KINDS[p.kind])}</span></span>
        </a>
      </li>`,
    ).join("");
  return `
<section class="tk tone-ink" data-section="playground" data-chrome-tone="ink" aria-labelledby="tk-title">
  <header class="tk__top page-x">
    <h2 class="label tk__label" id="tk-title">Playground <span class="tk__count">[${PLAY.length}]</span></h2>
    ${action(`${base}playground/`, "Open playground")}
  </header>
  <div class="tk__stage">
    <div class="tk__rail" data-tk-rail>
      <ul class="tk__track">${tiles(false)}
      </ul>
      <ul class="tk__track" aria-hidden="true">${tiles(true)}
      </ul>
    </div>
  </div>
</section>`;
}

/**
 * Home, modelled on vedantjamwal.com (HOME-REBUILD.md): our hero, then Work, Skill(s), What I do and the
 * credits, The advantage, Show case, Questions, Writing, then the ink run of Voices, Contact and the Playground
 * strip into the footer (appended by routes.ts).
 */
export const home = (base: string) =>
  [hero(base), work(base), skills(base), approach(), credits(base), advantage(), showcase(base), questions(), writing(), voices(), contact(), strip(base)].join("");
