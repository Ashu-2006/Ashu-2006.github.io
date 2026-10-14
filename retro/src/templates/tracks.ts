import { LEDE, PROJECTS } from "../content";
import { esc, mediaUrl } from "../lib/html";

export const SIDE_A = PROJECTS.filter((p) => p.tier === "case");

/**
 * Side A: the case studies as a tracklist, numbered A1, A2... as on a record label.
 * The stage parks the 3D sleeve in [data-anchor="player"] and swaps its art per hovered row; the img inside is the no-WebGL fallback.
 */
export function tracks(base: string) {
  const rows = SIDE_A.map(
    (p, i) => `
      <li class="track">
        <a class="track__link" href="${base}work/${p.slug}/" data-slug="${p.slug}" data-cursor="play">
          <span class="track__no">A${i + 1}</span>
          <span class="track__body">
            <span class="track__title">${esc(p.name)}</span>
            <span class="track__meta">${esc(p.org)}, ${esc(p.year)}</span>
            <span class="track__more"><span class="track__more-in">
              <span class="track__headline">${esc(p.headline)}</span>
              <span class="track__status">${esc(p.evidence)}</span>
            </span></span>
          </span>
          <img class="track__thumb" src="${mediaUrl(base, p.shots[0].file, "jpg", true)}" alt="" loading="lazy" decoding="async">
        </a>
      </li>`,
  ).join("");

  const first = SIDE_A[0];
  return `
<section class="side-a" id="work" data-theme="chocolate" data-section="work" aria-labelledby="work-title">
  <div class="side-a__stripes" aria-hidden="true"><i></i><i></i><i></i></div>
  <div class="side-a__head page-x">
    <h2 class="section-title" id="work-title">Selected work</h2>
    <p class="lede">${esc(LEDE.work)}</p>
  </div>
  <div class="side-a__body page-x">
    <ol class="tracks">${rows}
    </ol>
    <div class="side-a__player" aria-hidden="true">
      <div class="side-a__anchor" data-anchor="player">${first ? `<img class="side-a__fallback" src="${mediaUrl(base, first.shots[0].file, "jpg", true)}" alt="" decoding="async">` : ""}</div>
    </div>
  </div>
</section>`;
}
