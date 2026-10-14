import { PROJECTS, type Project, type Shot } from "../content";
import { esc, mediaInfo, mediaTag, mediaUrl, pad2 } from "../lib/html";
import { SIDE_A } from "./tracks";

/** Play order: Side A then the crate, wrapping round, so the last page always leads somewhere */
const ORDER = [...SIDE_A, ...PROJECTS.filter((p) => p.tier !== "case")];

export const nextOf = (slug: string) => ORDER[(ORDER.findIndex((p) => p.slug === slug) + 1) % ORDER.length];

const trackNo = (p: Project) => pad2(ORDER.findIndex((x) => x.slug === p.slug) + 1);

const ratio = (file: string) => {
  const { w, h } = mediaInfo(file);
  return w / h;
};

const paras = (items?: string[]) => (items ?? []).map((t) => `<p>${esc(t)}</p>`).join("");

/**
 * The opening spread: number, title, headline, credits. The Next band renders the same spread for the
 * following record with the same classes, so the two line up to the pixel and the route can cut across.
 */
function opening(base: string, p: Project, band: boolean) {
  const t = (tag: string) => (band ? "span" : tag);
  const credits = [
    ["Role", p.role.join(", ")],
    ["For", p.org],
    ["Year", p.year],
    ["Status", p.evidence],
  ]
    .map(([k, v]) => `<${t("div")} class="credit"><${t("dt")} class="credit__k">${k}</${t("dt")}><${t("dd")} class="credit__v">${esc(v)}</${t("dd")}></${t("div")}>`)
    .join("");
  const lead = band
    ? `<span class="case__back case__next-label"><svg class="case__back-icon" viewBox="0 0 20 20" aria-hidden="true" focusable="false"><path d="M7 4.5v11l8.5-5.5z"/></svg><span>Next</span></span>`
    : `<a class="case__back" href="${base}#work"><svg class="case__back-icon" viewBox="0 0 20 20" aria-hidden="true" focusable="false"><path d="M12.5 4.5 7 10l5.5 5.5"/></svg><span>All work</span></a>`;
  return `
    <${t("header")} class="case__head page-x">
      ${lead}
      <${t("div")} class="case__titling${p.name.length > 7 ? " case__titling--long" : ""}">
        <span class="case__no" aria-hidden="true">${trackNo(p)}</span>
        <${t("h1")} class="case__title display">${esc(p.name)}</${t("h1")}>
      </${t("div")}>
      <${t("div")} class="case__sub">
        <${t("p")} class="case__headline">${esc(p.headline)}</${t("p")}>
        <${t("dl")} class="case__credits">${credits}</${t("dl")}>
      </${t("div")}>
    </${t("header")}>`;
}

/** The cover sits full width when it is landscape; an upright cover takes seven columns and the lead stands beside it */
const introMod = (p: Project) => (ratio(p.shots[0].file) < 1.15 ? "tall" : "land");

/** A caption whose first sentence is a short name ("Calls.") gets that name as a run-in head */
function caption(text?: string) {
  if (!text) return "";
  const m = text.match(/^([^.]+\.)\s+(.+)$/);
  const body = m && m[1].split(" ").length <= 3 ? `<b>${esc(m[1])}</b> ${esc(m[2])}` : esc(text);
  return `<figcaption class="shot__caption">${body}</figcaption>`;
}

type Fit = "full" | "wide" | "mid" | "port" | "long";

const fit = (s: Shot): Fit => {
  const r = ratio(s.file);
  return r >= 1.9 ? "full" : r >= 1.25 ? "wide" : r >= 0.85 ? "mid" : r >= 0.6 ? "port" : "long";
};

const figure = (base: string, s: Shot, mod: string) => `
    <figure class="shot shot--${mod}">
      <div class="shot__frame" data-reveal>${mediaTag(base, s.file, s.alt, { className: "shot__media" })}</div>
      ${caption(s.caption)}
    </figure>`;

/**
 * The shots are laid by their proportions, never as a uniform grid: landscapes swing left, right, then
 * run full width; two upright shots in a row share a spread; a long page scroll keeps its caption beside it.
 */
function gallery(base: string, shots: Shot[]) {
  const rows: string[] = [];
  const upright = (f: Fit) => f === "mid" || f === "port" || f === "long";
  let beat = 0;
  for (let i = 0; i < shots.length; i++) {
    const a = shots[i];
    const b = shots[i + 1];
    const fa = fit(a);
    if (b && upright(fa) && upright(fit(b))) {
      rows.push(`<div class="shots__pair">${figure(base, a, "half")}${figure(base, b, "half")}</div>`);
      i++;
      continue;
    }
    if (fa === "full") {
      rows.push(figure(base, a, "full"));
      continue;
    }
    const step = beat++ % 3;
    if (fa === "wide") rows.push(figure(base, a, step === 0 ? "wide-l" : step === 1 ? "wide-r" : "full"));
    else rows.push(figure(base, a, `${fa}-${step === 1 ? "r" : "l"}`));
  }
  return rows.join("");
}

function block(id: string, title: string, body: string) {
  if (!body) return "";
  return `
  <section class="case__block page-x" aria-labelledby="case-${id}">
    <h2 class="case__label" id="case-${id}">${title}</h2>
    <div class="case__text">${body}</div>
  </section>`;
}

/** One case study, laid out as the record's insert: title and credits, the cover, then the story, the shots and the next track. */
export function caseStudy(base: string, p: Project) {
  const next = nextOf(p.slug);
  const [cover, ...shots] = p.shots;
  const nextCover = next.shots[0];
  const nc = mediaInfo(nextCover.file);

  const decision = p.decision
    ? `
  <section class="case__decision" data-theme="chocolate" aria-labelledby="case-decision">
    <div class="case__decision-inner page-x">
      <h2 class="case__label" id="case-decision">Key decision</h2>
      <h3 class="case__decision-title">${esc(p.decision.title)}</h3>
      <dl class="case__decision-grid">
        <div class="case__decision-item"><dt>Context</dt><dd>${esc(p.decision.context)}</dd></div>
        <div class="case__decision-item"><dt>Choice</dt><dd>${esc(p.decision.choice)}</dd></div>
        <div class="case__decision-item"><dt>Cost</dt><dd>${esc(p.decision.cost)}</dd></div>
      </dl>
    </div>
  </section>`
    : "";

  const links = p.links?.length
    ? `<ul class="case__links">${p.links
        .map(
          (l) =>
            `<li><a href="${l.href}" target="_blank" rel="noopener noreferrer">${esc(l.label)}<span class="sr-only">, opens in a new tab</span></a></li>`,
        )
        .join("")}</ul>`
    : "";

  return `
<article class="case" data-theme="bone" data-section="case" data-slug="${p.slug}">
  ${opening(base, p, false)}

  <div class="case__intro case__intro--${introMod(p)} page-x">
    <figure class="case__cover">
      <div class="case__frame">${mediaTag(base, cover.file, cover.alt, { className: "case__cover-media", eager: true })}</div>
      ${caption(cover.caption)}
    </figure>
    <p class="case__summary">${esc(p.summary)}</p>
  </div>

  ${block("problem", "Problem", paras(p.problem))}
  ${block("work", "Work", paras(p.work))}
  ${decision}
  ${block("result", "Result", paras(p.result) + links)}
  ${shots.length ? `<section class="case__shots page-x" aria-label="Screens">${gallery(base, shots)}\n  </section>` : ""}

  <nav class="case__next" aria-label="Next project">
    <div class="case__leadout page-x" aria-hidden="true"><i></i><i></i><i></i></div>
    <a class="case__next-link" href="${base}work/${next.slug}/" data-slug="${next.slug}" data-cursor="play" data-next>
      ${opening(base, next, true)}
      <span class="case__intro case__intro--${introMod(next)} page-x">
        <span class="case__cover"><span class="case__frame"><img class="case__cover-media" src="${mediaUrl(base, nextCover.file)}" width="${nc.w}" height="${nc.h}" alt="" loading="lazy" decoding="async"></span></span>
      </span>
    </a>
  </nav>
</article>`;
}
