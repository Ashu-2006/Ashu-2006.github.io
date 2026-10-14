import { LEDE, PROJECTS, type Project } from "../content";
import { esc, mediaInfo, mediaUrl } from "../lib/html";

export const SIDE_B = PROJECTS.filter((p) => p.tier === "more");

const chevron = (d: string) =>
  `<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" focusable="false"><path d="${d}" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>`;

/** The words in the panel beside the crate; the section script swaps them as the active sleeve changes */
export function crateInfo(p: Project) {
  return `
        <p class="crate__name">${esc(p.name)}</p>
        <p class="crate__headline">${esc(p.headline)}</p>
        <p class="crate__meta">${esc(p.org)}, ${esc(p.year)}</p>`;
}

/**
 * The crate: every other project as a sleeve standing in a wooden crate. Each sleeve is a real link and
 * only the active one is in the tab order, so the crate reads as one control and still works without script.
 */
export function crate(base: string) {
  const sleeves = SIDE_B.map((p, i) => {
    const file = p.shots[0].file;
    const { w, h } = mediaInfo(file);
    return `
          <li class="crate__item${i === 0 ? " is-active" : ""}" data-index="${i}" style="--d:${i}">
            <a class="sleeve" href="${base}work/${p.slug}/" data-slug="${p.slug}" data-cursor="${i === 0 ? "open" : "drag"}" draggable="false" tabindex="${i === 0 ? 0 : -1}">
              <img class="sleeve__art" src="${mediaUrl(base, file, "jpg", true)}" srcset="${mediaUrl(base, file, "jpg", true)} 800w, ${mediaUrl(base, file)} ${w}w" sizes="(min-width: 768px) 460px, 80vw" width="${w}" height="${h}" alt="" loading="lazy" decoding="async" draggable="false">
              <span class="sleeve__label">${esc(p.name)}</span>
              <span class="sleeve__shade"></span>
            </a>
            <span class="sleeve__back" aria-hidden="true"></span>
          </li>`;
  }).join("");

  const first = SIDE_B[0];

  return `
<section class="crate-sec" id="more" data-theme="harvest" data-section="more" aria-labelledby="more-title">
  <div class="crate-sec__head page-x">
    <h2 class="section-title" id="more-title">More work</h2>
    <p class="lede">${esc(LEDE.more)}</p>
  </div>
  <div class="crate-sec__body page-x">
    <div class="crate" data-crate data-cursor="drag">
      <div class="crate__scene">
        <div class="crate__box" aria-hidden="true">
          <i class="crate__floor"></i>
          <i class="crate__wall crate__wall--back"></i>
          <i class="crate__wall crate__wall--left"></i>
          <i class="crate__wall crate__wall--right"></i>
        </div>
        <ol class="crate__items" aria-label="More work">${sleeves}
        </ol>
        <div class="crate__box" aria-hidden="true">
          <i class="crate__wall crate__wall--front"></i>
          <i class="crate__lip"></i>
        </div>
      </div>
    </div>
    <div class="crate__panel">
      <div class="crate__info" aria-live="polite" data-crate-info>${crateInfo(first)}
      </div>
      <div class="crate__controls">
        <button class="crate__btn" type="button" aria-label="Previous record" data-crate-prev>${chevron("M14.5 5.5 8 12l6.5 6.5")}</button>
        <button class="crate__btn" type="button" aria-label="Next record" data-crate-next>${chevron("M9.5 5.5 16 12l-6.5 6.5")}</button>
        <a class="crate__open" href="${base}work/${first.slug}/" data-crate-open data-cursor="open">Open project<span class="sr-only" data-crate-open-name> ${esc(first.name)}</span></a>
      </div>
    </div>
  </div>
</section>`;
}
