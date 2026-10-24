import type { Project } from "../../content";
import { mediaTag } from "../../lib/html";
import { browser, clip, frame, head, results, stats, storyRoot, tldrInline, zoomed } from "./kit";

/**
 * ArmorIQ's social content tool. Captures come from a production build of the repo copied into a temp folder. The
 * live pieces port the tool's own algorithms on four photos from its background library: the computed duotone
 * halftone (backgrounds/duotone.ts), the auto-scrim that solves opacity only (canvas/autoScrim.ts, lib/contrast.ts),
 * headline auto-fit, and the eight formats with their safe areas.
 */

const APP = "social-content-tool.vercel.app";
/* formats/index.ts: the eight platform formats, their safe areas (top, right, bottom, left) and the banner's avatar */
export type Format = { name: string; w: number; h: number; note: string; safe: [number, number, number, number]; avatar?: [number, number, number, number] };
export const FORMATS: Format[] = [
  { name: "Instagram Square", w: 1080, h: 1080, note: "The default, with the most templates.", safe: [40, 40, 40, 40] },
  { name: "Instagram Portrait", w: 1080, h: 1350, note: "Claims the most feed space.", safe: [40, 34, 40, 34] },
  { name: "Story / Reel / TikTok", w: 1080, h: 1920, note: "Platform buttons cover the top 250 px and the bottom 340 px.", safe: [250, 65, 340, 65] },
  { name: "X Post", w: 1200, h: 675, note: "", safe: [32, 32, 32, 32] },
  { name: "X Header", w: 1500, h: 500, note: "", safe: [40, 40, 40, 40] },
  { name: "LinkedIn Post", w: 1200, h: 1200, note: "", safe: [40, 40, 40, 40] },
  { name: "LinkedIn Banner", w: 1584, h: 396, note: "The avatar covers the bottom-left corner.", safe: [40, 40, 40, 160], avatar: [0, 198, 554, 198] },
  { name: "Link Preview", w: 1200, h: 630, note: "", safe: [40, 40, 40, 40] },
];

function overview(base: string) {
  return `<section class="story__sec story__x" aria-labelledby="st-overview">
    ${head(
      1,
      "Overview",
      "On brand in <em>under two minutes.</em>",
      "Every ArmorIQ social graphic used to be a hand-made PNG. I designed and built the generator: pick a size and a template, click the headline and type, export. {Anyone on the team can now make an event post without opening a design tool.}",
      "st-overview",
      tldrInline(),
    )}
    ${stats([
      ["3", "moves for the common case: template, type, export"],
      ["13", "sizes: eight platform formats and five from the template set"],
      ["32", "templates grouped by event, all on brand"],
      ["33", "photos, each with its own computed brand treatment"],
    ])}
    ${frame(
      { tone: "ink", cls: "fr--hero fr--sct", crumb: "Editor / Agentic AI Summit", cap: "A template open in the editor: the photo in the brand's halftone, copy fields on the right. Scroll to pull back.", attrs: "data-zoom" },
      browser(zoomed(base, "social-content-tool/editor", "The editor with an Agentic AI Summit template: a halftone photo of the Berkeley campanile, a blue headline, and copy fields on the right"), APP),
    )}
  </section>`;
}

function start(base: string) {
  return `<section class="story__sec story__x" aria-labelledby="st-start">
    ${head(
      2,
      "Start",
      "Start from a finished post, <em>not a blank canvas.</em>",
      "The first screen shows templates grouped by event and sized for the platform you picked, so the first thing you see is something you could post. {A short intro covers the three ideas once, then gets out of the way.}",
      "st-start",
    )}
    <div class="bento">
      ${frame({ tone: "ink", cls: "b-full fr--sct fr--clip", crumb: "Intro / Four screens", cap: "On brand, your words, every size, start. Then never again.", tag: "Video" }, clip(base, "social-content-tool/clip-intro", "The four-screen intro: templates fanned out, then your own words, every size, and the start screen", "clip--flat"))}
      ${frame({ tone: "ink", cls: "b-7 fr--sct", crumb: "Templates / Instagram", cap: "Grouped by event: Oktane, Hack Driven, Product Updates, Armor Claude." }, mediaTag(base, "social-content-tool/templates", "The templates screen for Instagram square: event filters and a grid of halftone posters"))}
      ${frame({ tone: "ink", cls: "b-5 fr--sct", crumb: "Templates / Story", cap: "Switch the size and every template answers in it." }, mediaTag(base, "social-content-tool/templates-story", "The templates screen switched to the story size, with tall posters"))}
    </div>
  </section>`;
}

function engine(base: string) {
  return `<section class="story__sec story__x" aria-labelledby="st-engine">
    ${head(
      3,
      "Brand engine",
      "The brand look is <em>computed, not exported.</em>",
      "The posters use a duotone halftone that Figma builds from stacked blend modes, which a canvas cannot reproduce. So the tool computes it per pixel: brightness into a two-colour ramp, then a print-style dot grid{, which works on any photo the team uploads later}.",
      "st-engine",
    )}
    <div class="bento">
      ${frame(
        { tone: "ink", cls: "b-full fr--sct fr--duo", crumb: "backgrounds/duotone.ts / Treatment", cap: "Pick a photo, then push the dots and the contrast. Each pixel is computed in your browser.", tag: "Live" },
        `<div class="duo" data-duo>
          <canvas class="duo__canvas" data-duo-canvas width="560" height="560" role="img" aria-label="The selected photo rendered in the duotone halftone treatment"></canvas>
          <div class="duo__side">
            <p class="sct-label">Photo</p>
            <div class="duo__photos" data-duo-photos role="group" aria-label="Photo"></div>
            <p class="sct-label">Ramp</p>
            <div class="duo__ramps" data-duo-ramps role="group" aria-label="Colour ramp"></div>
            <label class="sct-range"><span>Dot size <b data-duo-dot-v></b></span><input type="range" min="1" max="10" step="1" data-duo-dot data-cursor="hide"></label>
            <label class="sct-range"><span>Contrast <b data-duo-gamma-v></b></span><input type="range" min="0.5" max="1.6" step="0.05" data-duo-gamma data-cursor="hide"></label>
            <p class="duo__math">tone = luma(r, g, b) ^ (1 / contrast), then the dot test decides ramp colour or paper.</p>
          </div>
        </div>`,
      )}
      ${frame({ tone: "ink", cls: "b-7 fr--sct fr--clip", crumb: "Editor / Reroll and shuffle", cap: "Reroll swaps the photo and its treatment; shuffle swaps the template. Copy stays.", tag: "Video" }, clip(base, "social-content-tool/clip-reroll", "Rerolling the background five times, then shuffling the template three times, on an Agentic AI Summit post", "clip--flat"))}
      ${frame({ tone: "ink", cls: "b-5 fr--sct", crumb: "Editor / Oktane", cap: "The same engine on a dark photo: ink shadows, orange highlights." }, mediaTag(base, "social-content-tool/editor-oktane", "The editor with an Oktane dinner template on a dark orange halftone photo"))}
    </div>
  </section>`;
}

function legibility() {
  return `<section class="story__sec story__x" aria-labelledby="st-legibility">
    ${head(
      4,
      "Legibility",
      "Readable text is <em>automatic.</em>",
      "Before each render the tool samples the photo under every text block and raises the scrim's opacity until the worst spot passes 4.5 to 1. It never moves or resizes the scrim{, because where a scrim sits is a design decision and legibility is the solver's}. Overtype a headline and it shrinks to fit its box.",
      "st-legibility",
    )}
    <div class="bento">
      ${frame(
        { tone: "ink", cls: "b-full fr--sct fr--leg", crumb: "canvas/autoScrim.ts / Solve", cap: "Drag the headline across the photo and watch the scrim. Then type more words.", tag: "Live" },
        `<div class="leg" data-leg>
          <div class="leg__board" data-leg-board>
            <canvas class="leg__bg" data-leg-bg width="540" height="540" aria-hidden="true"></canvas>
            <div class="leg__scrim" data-leg-scrim></div>
            <div class="leg__text" data-leg-text><button type="button" class="leg__grip" data-leg-grip aria-label="Move the headline: drag, or use the arrow keys" data-cursor="hide"><i></i><i></i><i></i></button><p class="leg__h" data-leg-h contenteditable="true" spellcheck="false" aria-label="Headline, editable">Join us at Oktane for dinner</p></div>
          </div>
          <div class="leg__side">
            <p class="sct-label">Worst-case contrast</p>
            <p class="leg__ratio" data-leg-ratio>4.5:1</p>
            <p class="sct-label">Scrim opacity</p>
            <div class="leg__bar"><i data-leg-bar></i></div>
            <p class="leg__pct" data-leg-pct></p>
            <label class="leg__auto"><input type="checkbox" data-leg-auto checked> Auto-scrim</label>
            <p class="leg__note" data-leg-note></p>
          </div>
        </div>`,
      )}
    </div>
  </section>`;
}

function formats(base: string) {
  const list = FORMATS.map((f, i) => `<button type="button" data-fmt="${i}" aria-pressed="${i === 2}" data-cursor="hide"><b>${f.name}</b><span>${f.w} × ${f.h}</span></button>`).join("");
  return `<section class="story__sec story__x" aria-labelledby="st-formats">
    ${head(
      5,
      "Formats",
      "Eight sizes, <em>each with its blind spots.</em>",
      "A story loses its top 250 and bottom 340 pixels to the platform's own buttons, and a LinkedIn banner loses its bottom-left corner to the avatar. The editor marks those areas as an overlay that never exports{, so nobody finds out after posting}.",
      "st-formats",
    )}
    <div class="bento">
      ${frame(
        { tone: "ink", cls: "b-8 fr--sct fr--fmt", crumb: "formats / Safe areas", cap: "Pick a format. Hatched areas are covered on the platform.", tag: "Live" },
        `<div class="fmt" data-fmt-root>
          <div class="fmt__list" role="group" aria-label="Format">${list}</div>
          <div class="fmt__stage"><div class="fmt__board" data-fmt-board><canvas data-fmt-canvas aria-hidden="true"></canvas><p class="fmt__h">We're here at Oktane</p><div data-fmt-safe></div></div><p class="fmt__note" data-fmt-note></p></div>
        </div>`,
      )}
      ${frame({ tone: "ink", cls: "b-4 fr--sct", crumb: "Editor / Make other sizes", cap: "One new design per size, same words and photo. The original stays." }, mediaTag(base, "social-content-tool/make-sizes", "The Make other sizes dialog listing portrait, story, LinkedIn, X and link preview sizes with checkboxes"))}
      ${frame({ tone: "ink", cls: "b-7 fr--sct fr--clip", crumb: "Editor / Two more sizes", cap: "Tick story and LinkedIn, create, and two new designs land in the library.", tag: "Video" }, clip(base, "social-content-tool/clip-sizes", "Opening Make other sizes, ticking Story and LinkedIn Post, then creating two designs", "clip--flat"))}
      ${frame({ tone: "ink", cls: "b-5 fr--sct", crumb: "Editor / Export", cap: "One PNG at 1x or 2x; safe areas never print." }, mediaTag(base, "social-content-tool/export", "The export menu with scale options"))}
      ${frame({ tone: "ink", cls: "b-half fr--sct", crumb: "Editor / Story size", cap: "The same design opened at the story size." }, mediaTag(base, "social-content-tool/editor-story", "The editor showing a design at the tall story size"))}
      ${frame({ tone: "ink", cls: "b-half fr--sct", crumb: "Settings", cap: "Default export scale, snapping, the safe area, and storage used." }, mediaTag(base, "social-content-tool/settings", "The settings dialog: export scale, snapping, safe area, start screen and storage"))}
    </div>
  </section>`;
}

function editing(base: string) {
  return `<section class="story__sec story__x" aria-labelledby="st-editing">
    ${head(
      6,
      "Editing",
      "One mode, <em>and nothing you can break.</em>",
      "Everything on the artboard can be edited, and undo is the safety net. Templates arrive with only the background locked, so a stray drag on the photo draws a selection box instead of moving it. {An earlier version split the editor into two modes; the redesign folded them into one and let lock do the protecting.}",
      "st-editing",
    )}
    <div class="bento">
      ${frame({ tone: "ink", cls: "b-7 fr--sct", crumb: "Editor / A tip, once", cap: "Tips appear at the moment they apply and retire when you do the thing." }, mediaTag(base, "social-content-tool/editor-tip", "The editor with a just-in-time tip: double-click any text on the canvas to change it"))}
      ${frame({ tone: "ink", cls: "b-5 fr--sct", crumb: "Help / Shortcuts", cap: "All the shortcuts on one sheet, behind the question mark." }, mediaTag(base, "social-content-tool/help", "The keyboard shortcut sheet"))}
    </div>
  </section>`;
}

function library(base: string) {
  return `<section class="story__sec story__x" aria-labelledby="st-library">
    ${head(
      7,
      "Library",
      "Always saved, <em>never asked.</em>",
      "Each change is written to the browser within a second. A new design is a draft that survives a reload, and saving it to the library files it with your designs{, after which the library copy autosaves too}.",
      "st-library",
    )}
    <div class="bento">
      ${frame({ tone: "ink", cls: "b-7 fr--sct", crumb: "Home", cap: "Continue where you left off, or start from a size." }, mediaTag(base, "social-content-tool/home", "The home screen: continue a draft, start from a size, recent templates"))}
      ${frame({ tone: "ink", cls: "b-5 fr--sct", crumb: "Your designs / Empty", cap: "An empty library points at templates, not at a blank page." }, mediaTag(base, "social-content-tool/library-empty", "The empty library: designs you make appear here, with a browse templates button"))}
    </div>
  </section>`;
}

function outcome() {
  return `<section class="story__sec story__x" aria-labelledby="st-outcome">
    ${head(
      8,
      "Outcome",
      "A tool the team <em>can post with.</em>",
      "The tool is live for the team and redeploys from main on every merge. {Templates are data files, so a new event's posts need a JSON file and no code.}",
      "st-outcome",
    )}
    ${results(
      [
        { n: "4.5:1", title: "Worst-case contrast, every render", kind: "Built into the renderer", text: "Body text passes over any photo{; large text needs 3 to 1}.", bars: [] },
        { n: "1 s", title: "To autosave a change", kind: "Built", text: "Drafts survive a reload{; the status reads Draft, Saving, Saved or Not saved with a retry}.", bars: [] },
        { n: "50", title: "Steps of undo", kind: "Built", text: "Undo is the safety net{, so the editor never needs a separate locked mode}.", bars: [] },
      ],
      "Designed and built by me for the ArmorIQ team.",
    )}
  </section>`;
}

/** Story entry point, picked up by templates/case.ts through import.meta.glob */
export function story(base: string, _p: Project) {
  return storyRoot("social-content-tool", [overview(base), start(base), engine(base), legibility(), formats(base), editing(base), library(base), outcome()].join(""));
}
