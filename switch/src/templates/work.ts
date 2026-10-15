import { KINDS, LEDE, PROJECTS, type Project } from "../content";
import { esc, hasVideo, mediaInfo, mediaUrl, pad2 } from "../lib/html";

type KindKey = keyof typeof KINDS;

/** Every kind that at least one project uses, in KINDS order, with its count */
export const WORK_FILTERS = (Object.keys(KINDS) as KindKey[])
  .map((k) => ({ key: k, label: KINDS[k], count: PROJECTS.filter((p) => p.kinds.includes(k)).length }))
  .filter((f) => f.count > 0);

/**
 * The preview frame is 4:5. Media more than 20% off that shape gets a frame in its own proportion instead,
 * so the whole image shows and copy baked into a capture is never cut mid-word.
 */
const FRAME = 4 / 5;

const kinds = (p: Project) => p.kinds.map((k) => KINDS[k]).join(", ");

/**
 * A project's cover for the index. One element serves two layouts: on desktop it is the following frame
 * in the lane between the names and the meta (only the active one is unclipped), on touch it is the row's
 * thumbnail. No cover shows until a row is hovered or focused. Videos keep their poster and are played
 * by the view, one at a time, never by ambient.ts.
 */
function cover(base: string, p: Project, i: number) {
  const shot = p.shots[0];
  const { w, h, schematic } = mediaInfo(shot.file);
  const small = mediaUrl(base, shot.file, "jpg", true);
  const full = mediaUrl(base, shot.file);
  const media = hasVideo(shot.file)
    ? `<video class="wk__img" width="${w}" height="${h}" poster="${small}" muted loop playsinline preload="none" data-wk-video><source src="${mediaUrl(base, shot.file, "mp4")}" type="video/mp4"></video>`
    : `<img class="wk__img" src="${small}" srcset="${small} 800w, ${full} 2000w" sizes="(min-width: 1024px) 33vw, 96px" width="${w}" height="${h}" alt="" loading="${i < 2 ? "eager" : "lazy"}" decoding="async">`;
  const tag = schematic ? `<span class="label wk__schem">Schematic</span>` : "";
  const fit = Math.abs(FRAME - w / h) / (w / h) > 0.2;
  const shape = fit ? ` wk__cover--fit" style="--wk-ar:${(w / h).toFixed(4)}` : "";
  return `<span class="wk__cover${shape}" data-wk-cover data-flip aria-hidden="true"><span class="wk__cover-in">${media}</span>${tag}</span>`;
}

function row(base: string, p: Project, i: number) {
  return `
      <li class="wk__row" data-wk-row data-kinds="${p.kinds.join(" ")}">
        <a class="wk__link" href="${base}work/${p.slug}/" data-cursor="media" data-cursor-label="Open case">
          <span class="wk__cell wk__num" aria-hidden="true"><span class="wk__in label">(${pad2(i + 1)})</span></span>
          <span class="wk__cell wk__name"><span class="wk__in"><span class="wk__name-t">${esc(p.name)}</span><span class="label wk__tag">${esc(p.evidence)}</span></span></span>
          <span class="wk__cell wk__meta"><span class="wk__in"><span class="wk__meta-l"><span class="label wk__org">${esc(p.org)}</span><span class="label wk__year">${esc(p.year)}</span></span><span class="label wk__kinds">${esc(kinds(p))}</span></span></span>
          <span class="wk__rule" aria-hidden="true"></span>
          ${cover(base, p, i)}
        </a>
      </li>`;
}

const pill = (key: string, label: string, count: number, on: boolean) =>
  `<li><button class="wk__pill" type="button" data-wk-filter="${key}" aria-pressed="${on}"><span class="wk__pill-t">${esc(label)}</span><span class="label wk__pill-n">${pad2(count)}</span></button></li>`;

/**
 * Work index (/work/): every project as a row on the 12-column grid. Rows dim to .3 around the hovered
 * one (bybang) while a single 4:5 cover rides the lane beside them, following the pointer. Kind filters
 * re-set the list through its masks and mirror into ?kind=. Behaviour lives in views/work.ts.
 */
export function workIndex(base: string) {
  const n = PROJECTS.length;
  const pills = [pill("all", "All", n, true), ...WORK_FILTERS.map((f) => pill(f.key, f.label, f.count, false))].join("");
  return `
<section class="wk page-x" data-section="work" aria-labelledby="wk-title">
  <header class="wk__head">
    <div class="wk__tw">
      <h1 class="wk__title" id="wk-title"><span class="mask"><span class="mask__in" data-reveal="rise" data-reveal-now>All <em>work</em></span></span></h1>
      <p class="label wk__count" aria-hidden="true"><span class="mask"><span class="mask__in" data-reveal="rise" data-reveal-now data-delay="0.1">(<span data-wk-count>${pad2(n)}</span>)</span></span></p>
    </div>
    <p class="wk__lede" data-reveal="lines" data-reveal-now data-delay="0.15">${esc(LEDE.work)}</p>
  </header>
  <div class="wk__bar" data-reveal="up" data-reveal-now data-delay="0.25">
    <p class="label wk__bar-l" id="wk-filter-l">Filter</p>
    <ul class="wk__pills" role="group" aria-labelledby="wk-filter-l">${pills}</ul>
    <p class="label wk__showing" aria-live="polite"><span data-wk-showing>${n}</span> of ${n}</p>
  </div>
  <div class="wk__body" data-wk-body>
    <ol class="wk__list" data-wk-list>${PROJECTS.map((p, i) => row(base, p, i)).join("")}
    </ol>
  </div>
</section>`;
}
