import { INTRO, KINDS, LEDE, PROJECTS, SITE, type Project } from "../content";
import { esc, mediaInfo, mediaTag, pad2 } from "../lib/html";

/** The first five case projects, in array order, are the pinned Selected work stack */
export const SELECTED = PROJECTS.filter((p) => p.tier === "case").slice(0, 5);

/** The portrait slot between the two lines of the name cycles through these */
export const PHOTO_COUNT = 8;

const kinds = (p: Project) => p.kinds.map((k) => KINDS[k]).join(", ");
const href = (base: string, p: Project) => `${base}work/${p.slug}/`;

/**
 * Hero, ported from the main site: the name in two lines with a portrait slot before "Rana", the intro
 * below. Every character is a swap target (sections/swap.ts): near the pointer it turns into Instrument
 * Serif italic or Tiny5 in cobalt, then settles back.
 */
function hero(base: string) {
  const [first, last] = SITE.name.split(" ");
  const photos = Array.from(
    { length: PHOTO_COUNT },
    (_, i) => `<img src="${base}images/photo-${i + 1}.jpg" alt="" width="600" height="600" decoding="async"${i ? "" : ' fetchpriority="high"'}>`,
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
    <div class="hero__side">
      <p class="label hero__avail"><span class="hero__dot" aria-hidden="true"></span><span data-hero="scramble">${esc(SITE.availability)}</span></p>
      <p class="label hero__cue"><span data-hero="scramble">Scroll for selected work (${pad2(SELECTED.length)})</span></p>
    </div>
  </div>
</section>`;
}

/** True when a cover's aspect is more than 20% off the frame's, so it is shown whole instead of cropped */
export function containFor(p: Project, frame: number) {
  const { w, h } = mediaInfo(p.shots[0].file);
  const r = w / h / frame;
  return r > 1.2 || r < 1 / 1.2;
}

/** Works media keep their poster but are played by the works stack itself, one at a time */
const stackMedia = (base: string, p: Project, eager: boolean) =>
  mediaTag(base, p.shots[0].file, p.shots[0].alt, { className: "works__img", eager }).replace("data-autoplay", "data-works-video");

const BADGE_TEXT = "OPEN CASE • OPEN CASE • OPEN CASE • ";

function badge() {
  return `
      <div class="works__badge" aria-hidden="true">
        <div class="works__badge-in">
          <svg class="works__ring" viewBox="0 0 120 120">
            <defs><path id="works-ring-path" d="M60,60 m-47,0 a47,47 0 1,1 94,0 a47,47 0 1,1 -94,0"/></defs>
            <text><textPath href="#works-ring-path" textLength="292" lengthAdjust="spacing">${BADGE_TEXT}</textPath></text>
          </svg>
          <span class="works__arrow"><svg viewBox="0 0 24 24"><path d="M7 17 17 7M8 7h9v9" fill="none" stroke="currentColor" stroke-width="1.5"/></svg></span>
        </div>
      </div>`;
}

function works(base: string) {
  const n = SELECTED.length;
  const rows = SELECTED.map(
    (p, i) => `
          <li class="works__row" data-works-row>
            <a class="works__link" href="${href(base, p)}">
              <span class="label works__num">${pad2(i + 1)}.</span>
              <span class="works__name">${esc(p.name)}</span>
              <span class="label works__kinds">${esc(kinds(p))}<span class="works__year">${esc(p.year)}</span></span>
            </a>
          </li>`,
  ).join("");

  const masks = SELECTED.map(
    (p, i) => `
        <a class="works__mask" href="${href(base, p)}" tabindex="-1" data-works-mask data-cursor="media" data-cursor-label="Open case" aria-label="${esc(p.name)}, open case">
          <span class="works__media" data-flip>${stackMedia(base, p, i === 0)}</span>
        </a>`,
  ).join("");

  const cards = SELECTED.map(
    (p, i) => `
    <li class="works__card">
      <a class="works__clink" href="${href(base, p)}" data-cursor="media" data-cursor-label="Open case">
        <span class="works__cmedia${containFor(p, 4 / 3) ? " is-contain" : ""}" data-reveal="media"><span class="works__cmedia-in" data-flip>${mediaTag(base, p.shots[0].file, p.shots[0].alt, { className: "works__img", small: true })}</span></span>
        <span class="works__ctext" data-reveal="up">
          <span class="label works__num">${pad2(i + 1)}.</span>
          <span class="works__name">${esc(p.name)}</span>
          <span class="label works__kinds">${esc(kinds(p))}<span class="works__year">${esc(p.year)}</span></span>
        </span>
      </a>
    </li>`,
  ).join("");

  return `
<section class="works" id="work" data-section="works" aria-labelledby="works-title">
  <div class="works__pin page-x" data-works-pin>
    <div class="works__left">
      <div class="works__head">
        <h2 class="works__title" id="works-title">
          <span class="mask"><span class="mask__in" data-reveal="rise">Selected</span></span>
          <span class="mask"><span class="mask__in" data-reveal="rise" data-delay="0.08"><em>work</em></span></span>
        </h2>
        <p class="works__lede" data-reveal="lines" data-delay="0.15">${esc(LEDE.work)}</p>
      </div>
      <div class="works__foot">
        <p class="label works__count" aria-hidden="true"><span class="mask works__count-mask"><span class="mask__in" data-works-count>01</span></span><span class="works__count-of">/ ${pad2(n)}</span></p>
        <ol class="works__rows">${rows}
        </ol>
      </div>
    </div>
    <div class="works__panel" data-works-panel>${masks}${badge()}
    </div>
  </div>
  <div class="works__mobile page-x">
    <h2 class="works__title works__title--m">
      <span class="mask"><span class="mask__in" data-reveal="rise">Selected</span></span>
      <span class="mask"><span class="mask__in" data-reveal="rise" data-delay="0.08"><em>work</em></span></span>
    </h2>
    <p class="works__lede" data-reveal="lines">${esc(LEDE.work)}</p>
    <ol class="works__cards">${cards}
    </ol>
  </div>
</section>`;
}

/** One strong line into the full index */
function allWork(base: string) {
  return `
<section class="all page-x" data-section="all-work" aria-label="All work">
  <a class="all__link" href="${base}work/">
    <span class="label all__label" data-reveal="scramble">The full index</span>
    <span class="all__title"><span class="mask"><span class="mask__in" data-reveal="rise">All <em>work</em><sup class="all__count">(${PROJECTS.length})</sup></span></span></span>
    <span class="all__arrow" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M5 12h14M13 6l6 6-6 6" fill="none" stroke="currentColor" stroke-width="1.25"/></svg></span>
  </a>
</section>`;
}

/** Home: hero, the pinned Selected work stack, a link row into the index. The footer is appended by routes.ts. */
export const home = (base: string) => `${hero(base)}${works(base)}${allWork(base)}`;
