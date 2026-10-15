import { INTRO, SITE } from "../content";
import { esc, mediaUrl } from "../lib/html";

/**
 * The album sleeve. The 3D sleeve and record are drawn by the stage into [data-anchor="hero"]; the img is the no-WebGL fallback.
 * The three racing stripes are drawn by sections/hero.ts from the measured layout, so their curve always lands in the right gutter.
 */
export function hero(base: string) {
  return `
<section class="hero" data-theme="bone" data-section="hero" aria-label="Introduction">
  <svg class="hero__stripes" aria-hidden="true" focusable="false"><path class="hero__stripe hero__stripe--poppy"/><path class="hero__stripe hero__stripe--rust"/><path class="hero__stripe hero__stripe--harvest"/></svg>
  <div class="hero__inner page-x">
    <h1 class="hero__name display" aria-label="${esc(SITE.name)}">
      <span class="hero__line" data-hero-line aria-hidden="true">Ashutosh</span>
      <span class="hero__line hero__line--last" data-hero-line aria-hidden="true">Rana</span>
    </h1>
    <div class="hero__sleeve" data-anchor="hero">
      <img class="hero__fallback" src="${mediaUrl(base, "me/portrait", "jpg", true)}" width="800" height="1000" alt="Ashutosh Rana standing in front of a stage curtain" fetchpriority="high">
    </div>
    <p class="hero__intro" data-hero-fade>${esc(INTRO)}</p>
    <div class="hero__meta" data-hero-fade>
      <p class="hero__clock">${esc(SITE.location.split(",")[0])}, <time data-clock>--:--</time></p>
      <p class="hero__avail"><span class="hero__dot" aria-hidden="true"></span>${esc(SITE.availability)}</p>
    </div>
  </div>
</section>`;
}
