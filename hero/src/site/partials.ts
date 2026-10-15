import MEDIA from "../content/media.json";
import { EXPERIENCE, NAV, SITE, SOCIALS } from "../content/site";
import { KINDS, bySlug, type Project, type Shot } from "../content/projects";
import { esc, extAttrs, href, list, pad, type Ctx } from "./html";

type Asset = { w: number; h: number; video?: boolean; schematic?: boolean };
const ASSETS = MEDIA as Record<string, Asset>;

export function asset(file: string): Asset {
  const a = ASSETS[file];
  if (!a) throw new Error(`media.json has no entry for "${file}". Run the media script.`);
  return a;
}

export const LOGO = `<svg viewBox="0 0 256 256" fill="none" aria-hidden="true"><path d="M58 176c10-44 30-96 52-96 18 0 6 58-8 92m8-92c26-6 44 10 40 40-3 26-20 54-44 56m44-60c18 34 40 52 70 44" stroke="currentColor" stroke-width="15" stroke-linecap="round" stroke-linejoin="round"/></svg>`;

export function header(ctx: Ctx, current = "", extra = "") {
  const links = list(NAV, (n) => {
    const on = current && n.path.startsWith(current);
    return `<a href="${href(ctx, n.path)}"${on ? ' aria-current="page"' : ""}>${n.label}</a>`;
  });
  return `<header class="page-grid site-header${extra}" data-header>
  <a class="logo" href="${ctx.base}" aria-label="${SITE.name}, home">${LOGO}</a>
  <nav class="site-nav" aria-label="Site">${links}</nav>
</header>`;
}

export const src = (ctx: Ctx, file: string, sm = false) => `${ctx.base}media/${file}${sm ? "-sm" : ""}.jpg`;

type FigOpts = { sizes?: string; eager?: boolean; caption?: string; index?: number; cls?: string; vt?: string; autoplay?: boolean };

/** Image, looping video or schematic, with intrinsic size reserved so nothing shifts as it loads. */
export function media(ctx: Ctx, file: string, alt: string, o: FigOpts = {}) {
  const a = asset(file);
  const dims = `width="${a.w}" height="${a.h}"`;
  const load = o.eager ? 'fetchpriority="high"' : 'loading="lazy"';
  const srcset = a.w > 800 ? ` srcset="${src(ctx, file, true)} 800w, ${src(ctx, file)} ${a.w}w" sizes="${o.sizes ?? "100vw"}"` : "";
  if (a.video) {
    const auto = o.autoplay === false ? "" : " data-autoplay";
    return `<video class="media" ${dims} muted loop playsinline preload="${o.eager ? "auto" : "none"}" poster="${src(ctx, file, !o.eager)}"${auto} aria-label="${esc(alt)}"><source src="${ctx.base}media/${file}.mp4" type="video/mp4"></video>`;
  }
  return `<img class="media" src="${src(ctx, file)}"${srcset} ${dims} alt="${esc(alt)}" ${load} decoding="async">`;
}

export function figure(ctx: Ctx, shot: Shot, o: FigOpts = {}) {
  const a = asset(shot.file);
  const cap = o.caption ?? shot.caption;
  const n = o.index !== undefined ? `<span class="fig-n">Fig. ${pad(o.index)}</span>` : "";
  const cut = cap ? cap.indexOf(". ") : -1;
  const lead = cap && cut > 0 ? cap.slice(0, cut + 1) : (cap ?? "");
  const tail = cap && cut > 0 ? cap.slice(cut + 2) : "";
  const body = cap ? `<figcaption>${n}<strong>${esc(lead)}</strong> ${esc(tail)}</figcaption>` : "";
  const vt = o.vt ? ` style="view-transition-name:${o.vt}"` : "";
  const tag = a.schematic ? `<span class="fig-tag">Schematic</span>` : "";
  return `<figure class="fig ${o.cls ?? ""}"${a.schematic ? " data-schematic" : ""} data-fade><div class="fig-frame" style="aspect-ratio:${a.w}/${a.h}"${vt}>${media(ctx, shot.file, shot.alt, o)}${tag}</div>${body}</figure>`;
}

export const kindsLabel = (p: Project) => p.kinds.map((k) => KINDS[k]).join(", ");

/** Preview images for a row, as "url::label" pairs. One project still cycles, through its own shots. */
function peekData(ctx: Ctx, projects: Project[]) {
  const shots = projects.length > 1 ? projects.map((p) => ({ file: p.shots[0].file, label: p.name })) : projects[0].shots.slice(0, 4).map((s) => ({ file: s.file, label: projects[0].name }));
  return shots.map((s) => `${src(ctx, s.file, true)}::${esc(s.label)}`).join("|");
}

/** Numbered project rows with a cursor-following preview on fine pointers and inline thumbs elsewhere. */
export function indexList(ctx: Ctx, projects: Project[]) {
  const rows = list(projects, (p, i) => {
    const cover = p.shots[0].file;
    return `<li data-kinds="${p.kinds.join(" ")}" data-tier="${p.tier}"><a class="index-row" href="${href(ctx, `work/${p.slug}/`)}" data-peek="${src(ctx, cover, true)}::${esc(p.name)}">
  <span class="index-n">${pad(i + 1)}</span>
  <img class="index-thumb" src="${src(ctx, cover, true)}" alt="" loading="lazy" decoding="async">
  <span class="index-name">${esc(p.name)}</span>
  <span class="index-head">${esc(p.headline)}</span>
  <span class="index-kind">${esc(kindsLabel(p))}</span>
  <span class="index-year">${p.year}</span>
</a></li>`;
  });
  return `<ol class="index" data-peek-list>${rows}</ol>`;
}

/** Same row design as the project index. Rows are not links themselves; the projects inside them are. */
export function experienceList(ctx: Ctx) {
  const rows = list(EXPERIENCE, (r, i) => {
    const projects = r.projects.map(bySlug);
    const links = list(projects, (p, j) => `<a href="${href(ctx, `work/${p.slug}/`)}" data-peek-i="${j}">${esc(p.name)}</a>`);
    return `<li class="index-row xp-row" data-peek="${peekData(ctx, projects)}">
  <span class="index-n">${pad(i + 1)}</span>
  <img class="index-thumb" src="${src(ctx, projects[0].shots[0].file, true)}" alt="" loading="lazy" decoding="async">
  <span class="index-name">${esc(r.org)}</span>
  <span class="index-head"><strong>${esc(r.title)}.</strong> ${esc(r.note)}</span>
  <span class="index-kind xp-projects">${links}</span>
  <span class="index-year">${r.current ? `<span class="dot" aria-hidden="true"></span>` : ""}${esc(r.when)}</span>
</li>`;
  });
  return `<ol class="index index-xp" data-peek-list>${rows}</ol>`;
}

export const PEEK = `<div class="peek" data-peek-frame aria-hidden="true"><img alt="" decoding="async"><img alt="" decoding="async"><span class="peek-label" data-peek-label></span></div>`;

/** Four flagship projects as frames in a row, after alimdesigner.com: one selected, the rest receding. */
export function gallery(ctx: Ctx, slugs: string[]) {
  const projects = slugs.map(bySlug);
  const frames = list(projects, (p, i) => {
    const cover = p.shots[0].file;
    const a = asset(cover);
    const visual = a.video
      ? `<video class="frame-media" muted loop playsinline preload="${i === 0 ? "auto" : "none"}" poster="${src(ctx, cover)}" data-frame-video aria-hidden="true"><source src="${ctx.base}media/${cover}.mp4" type="video/mp4"></video>`
      : `<img class="frame-media" src="${src(ctx, cover)}" srcset="${src(ctx, cover, true)} 800w, ${src(ctx, cover)} ${a.w}w" sizes="(min-width: 48rem) 64vw, 86vw" alt="" ${i === 0 ? "" : 'loading="lazy"'} decoding="async">`;
    return `<li class="frame" data-frame="${i}">
  <p class="frame-label">${esc(p.org)} <span>/</span> ${esc(p.name)}</p>
  <a class="frame-box" href="${href(ctx, `work/${p.slug}/`)}" aria-label="${esc(p.name)} case study">${visual}<span class="frame-handles" aria-hidden="true"><i></i><i></i><i></i><i></i></span></a>
  <div class="frame-foot">
    <a class="frame-cta" href="${href(ctx, `work/${p.slug}/`)}" tabindex="-1">Read the case study <span aria-hidden="true">&nearr;</span></a>
    <span class="frame-meta">${esc(p.headline)}</span>
  </div>
</li>`;
  });
  return `<section class="gallery" id="work" aria-labelledby="gallery-title" data-gallery>
  <div class="gallery-track">
    <div class="gallery-stage" data-stage>
      <p class="gallery-crumb" id="gallery-title"><span>${SITE.name}</span> / Works</p>
      <ol class="gallery-row" data-row>${frames}</ol>
      <div class="gallery-cursor" aria-hidden="true" data-cursor>
        <svg viewBox="0 0 16 20" width="18" height="22"><path d="M1 1l14 9.5-6.2 1.3L5.6 18.5z" fill="currentColor" stroke="#fff" stroke-width="1.2" stroke-linejoin="round"/></svg>
        <span>Ashutosh</span>
      </div>
      <nav class="dock" aria-label="Selected work">
        <a class="dock-tab" href="${href(ctx, "work/")}" aria-current="true">Works</a>
        <a class="dock-tab" href="${href(ctx, "about/")}">About</a>
        <a class="dock-tab" href="#contact">Contact</a>
        <span class="dock-sep" aria-hidden="true"></span>
        <button type="button" class="dock-btn" data-step="-1" aria-label="Previous project"><svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true"><path d="M10 3L5 8l5 5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg></button>
        <span class="dock-count" aria-live="polite"><span data-count>1</span> / ${projects.length}</span>
        <button type="button" class="dock-btn" data-step="1" aria-label="Next project"><svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true"><path d="M6 3l5 5-5 5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg></button>
        <span class="dock-sep" aria-hidden="true"></span>
        <button type="button" class="dock-btn" data-help aria-expanded="false" aria-controls="gallery-help" aria-label="How this works">?</button>
      </nav>
      <div class="gallery-help" id="gallery-help" role="dialog" aria-label="How this works" hidden>
        <p class="gallery-help-title">How this works</p>
        <p><strong>Scroll</strong> or use the arrows below to walk from frame to frame.</p>
        <p><strong>Drag</strong> left or right to slide along the row.</p>
        <p><strong>Click</strong> a side frame to bring it to the centre. Click the centre frame to open it.</p>
        <button type="button" class="btn btn-dark" data-help-close>Got it</button>
      </div>
    </div>
  </div>
</section>`;
}

export function footer(_ctx: Ctx) {
  const socials = list(SOCIALS, (s) => `<a href="${s.href}"${extAttrs(s.href)}>${s.label}</a>`);
  return `<footer class="site-footer" id="contact">
  <div class="page-grid footer-lead">
    <h2 class="footer-title">Got a product that<br>is hard to explain?</h2>
    <div class="footer-actions">
      <a class="btn btn-light" href="mailto:${SITE.email}">Write to me</a>
      <button class="btn btn-ghost" type="button" data-copy="${SITE.email}"><span data-copy-label>Copy email</span></button>
    </div>
  </div>
  <div class="pond" data-pond>
    <canvas aria-hidden="true"></canvas>
    <p class="pond-hint">Touch the water. Tap to feed them, move fast to scare them.</p>
  </div>
  <div class="page-grid footer-base">
    <span>&copy; <span data-year>2026</span> ${SITE.name}</span>
    <span class="footer-socials">${socials}</span>
    <a href="#top" class="footer-top">Back to top &uarr;</a>
  </div>
</footer>
<p class="toast" role="status" aria-live="polite" data-toast></p>`;
}
