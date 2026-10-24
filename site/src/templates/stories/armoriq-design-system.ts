import type { Project } from "../../content";
import { mediaTag } from "../../lib/html";
import { browser, clip, frame, head, results, stats, storyRoot, tldrInline, zoomed } from "./kit";

/**
 * ArmorIQ's two design systems, from the design-system repo. Captures come from a fresh build of its showcase site.
 * The live pieces read the ArmorTools system's own data (tokens/src, contrast-pairs.json, components.json), loaded
 * only on this page: the lint rail's messages, the contrast rules in both themes, and the component manifest that
 * agents read.
 */

const SITE = "design-system showcase";
const START = "bg-[#191816] p-4 rounded-lg text-sm text-zinc-400 shadow-md";

function overview(base: string) {
  return `<section class="story__sec story__x" aria-labelledby="st-overview">
    ${head(
      1,
      "Overview",
      "A design system people and agents <em>can both read.</em>",
      "ArmorIQ ships two products, an enterprise console and a developer tool, so I built two design systems in one kit: tokens, components, patterns, usage rules, and a showcase that renders all of it live. {Each component says when to use it and when not to, so an AI agent building a screen picks the same parts a designer would.}",
      "st-overview",
      tldrInline(),
    )}
    ${stats([
      ["163", "components across both systems: 64 enterprise, 99 ArmorTools"],
      ["427", "tokens, from colour to motion and z-index"],
      ["20", "contrast rules that must pass in both themes"],
      ["367", "hand-built buttons the enterprise Button replaced"],
    ])}
    ${frame(
      { tone: "ink", cls: "fr--hero fr--dsk", crumb: "Showcase / ArmorTools", cap: "The ArmorTools system's front page: foundations, components and the note for AI agents. Scroll to pull back.", attrs: "data-zoom" },
      browser(zoomed(base, "armoriq-design-system/t-intro", "The ArmorTools design system showcase: introduction with cards for colour, typography, spacing, motion, components and open decisions"), SITE),
    )}
  </section>`;
}

function systems(base: string) {
  return `<section class="story__sec story__x" aria-labelledby="st-systems">
    ${head(
      2,
      "Two systems",
      "Two products, <em>two systems.</em>",
      "The developer tool is not a dark theme of the enterprise console: its users, density and tone are different, so it got its own tokens and components. {A lint rule stops ArmorTools from importing anything of the enterprise system, so the two cannot drift into one muddled middle.}",
      "st-systems",
    )}
    <div class="bento">
      ${frame({ tone: "ink", cls: "b-full fr--dsk fr--clip", crumb: "Showcase / Pick one", cap: "One launcher, two systems: the light enterprise kit, then the dark ArmorTools kit.", tag: "Video" }, clip(base, "armoriq-design-system/clip-systems", "The showcase launcher opening the light enterprise Platform system, then the dark ArmorTools system", "clip--flat"))}
      ${frame({ tone: "grey", cls: "b-half fr--dsl", crumb: "Platform / Introduction", cap: "Enterprise: light, warm neutrals, compact density." }, mediaTag(base, "armoriq-design-system/p-intro", "The enterprise ArmorIQ design system introduction in light mode"))}
      ${frame({ tone: "ink", cls: "b-half fr--dsk", crumb: "ArmorTools / Colour", cap: "ArmorTools: dark first, every swatch with its light twin." }, mediaTag(base, "armoriq-design-system/t-color", "The ArmorTools colour foundation: surface tokens with dark and light values and their contrast"))}
    </div>
  </section>`;
}

function contract() {
  return `<section class="story__sec story__x" aria-labelledby="st-contract">
    ${head(
      3,
      "Contract",
      "A contract, <em>not a reference file.</em>",
      "{A design system that only documents gets ignored on a deadline. }The ArmorTools system fails the lint check on raw hex, default spacing, arbitrary values and enterprise tokens{, and each message names the token to use instead}.",
      "st-contract",
    )}
    <div class="bento">
      ${frame(
        { tone: "ink", cls: "b-full fr--dsk fr--lint", crumb: "ESLint / The rail", cap: "Edit the class list, or fix it in one go. The messages are the rail's own.", tag: "Live" },
        `<div class="lint" data-lint>
          <label class="lint__label" for="lint-input">className</label>
          <input id="lint-input" class="lint__input" data-lint-input spellcheck="false" autocomplete="off" value="${START}" data-cursor="hide">
          <ol class="lint__list" data-lint-list aria-live="polite"></ol>
          <div class="lint__foot"><p class="lint__count" data-lint-count></p><button type="button" class="lint__fix" data-lint-fix data-cursor="hide">Fix all</button><button type="button" class="lint__reset" data-lint-reset data-cursor="hide">Reset</button></div>
        </div>`,
      )}
    </div>
  </section>`;
}

function contrast(base: string) {
  return `<section class="story__sec story__x" aria-labelledby="st-contrast">
    ${head(
      4,
      "Contrast",
      "Contrast is a test, <em>not a review.</em>",
      "Twenty rules list the colour pairs that must stay readable, and every one is checked in both themes{, with translucent colours composited over their background before measuring}. Text needs 4.5 to 1; icons and borders need 3.",
      "st-contrast",
    )}
    <div class="bento">
      ${frame(
        { tone: "ink", cls: "b-full fr--dsk fr--cx", crumb: "Tokens / Contrast pairs", cap: "Pick a rule and a theme. Each cell is measured from the token values.", tag: "Live" },
        `<div class="cx" data-cx>
          <div class="cx__bar"><div class="ds-seg" role="group" aria-label="Theme">${["dark", "light"].map((t, i) => `<button type="button" data-cx-theme="${t}" aria-pressed="${i === 0}" data-cursor="hide">${t === "dark" ? "Dark" : "Light"}</button>`).join("")}</div><select class="cx__rule" data-cx-rule aria-label="Contrast rule" data-cursor="hide"></select></div>
          <div class="cx__grid" data-cx-grid></div>
          <p class="cx__sum" data-cx-sum></p>
        </div>`,
      )}
      ${frame({ tone: "grey", cls: "b-half fr--dsl", crumb: "Platform / Colour", cap: "The enterprise palette, each token with its dark value and its job." }, mediaTag(base, "armoriq-design-system/p-color", "The enterprise colour foundation: surfaces, borders and text with light and dark values"))}
      ${frame({ tone: "ink", cls: "b-half fr--dsk", crumb: "ArmorTools / Type", cap: "Geist for reading, Geist Mono for machine data, each size a named role." }, mediaTag(base, "armoriq-design-system/t-type", "The ArmorTools typography foundation: Geist and Geist Mono families and the named type roles"))}
    </div>
  </section>`;
}

function agents(base: string) {
  return `<section class="story__sec story__x" aria-labelledby="st-agents">
    ${head(
      5,
      "Agents",
      "Readable by people <em>and by agents.</em>",
      "Each component entry carries what it is for, when to use it, when not to, and an example. An AI agent asked to build a screen reads the same entries a designer does{, and a skill installs the whole kit into any repo}.",
      "st-agents",
    )}
    <div class="bento">
      ${frame(
        { tone: "ink", cls: "b-7 fr--dsk fr--ask", crumb: "components.json / Ask the system", cap: "Describe what you need. The answers come from the manifest an agent reads.", tag: "Live" },
        `<div class="ask" data-ask>
          <input class="ask__input" data-ask-input value="a button that shows progress" placeholder="Describe what you need" aria-label="Describe the component you need" autocomplete="off" data-cursor="hide">
          <div class="ask__chips">${["a button that shows progress", "pick one of a few options", "the status of a run", "copy an API key"].map((q) => `<button type="button" data-ask-q="${q}" data-cursor="hide">${q}</button>`).join("")}</div>
          <ol class="ask__list" data-ask-list aria-live="polite"></ol>
        </div>`,
      )}
      ${frame({ tone: "grey", cls: "b-5 fr--dsl", crumb: "Platform / Using the skill", cap: "Files an agent reads, and the prompt that starts it." }, mediaTag(base, "armoriq-design-system/p-skill", "Using the skill: the files an agent reads, tokens, components and references, and an example prompt"))}
    </div>
  </section>`;
}

function parts(base: string) {
  return `<section class="story__sec story__x" aria-labelledby="st-parts">
    ${head(
      6,
      "Components",
      "Parts you can <em>change on the page.</em>",
      "Each ArmorTools component page opens on a playground: change a prop and see it, in either theme, next to the import line and the tokens it uses{, so nobody screenshots a component to describe it}.",
      "st-parts",
    )}
    <div class="bento">
      ${frame({ tone: "ink", cls: "b-7 fr--dsk fr--clip", crumb: "ArmorTools / Button", cap: "Variants and sizes on the real Button: primary, secondary, ghost, danger.", tag: "Video" }, clip(base, "armoriq-design-system/clip-playground", "The Button playground switching variants and sizes on a New policy button", "clip--flat"))}
      ${frame({ tone: "ink", cls: "b-5 fr--dsk fr--clip", crumb: "ArmorTools / StatusBadge", cap: "Six tones and three styles, from the same tokens.", tag: "Video" }, clip(base, "armoriq-design-system/clip-badge", "The StatusBadge playground cycling through neutral, success, danger, warning, info and flag tones, then soft and solid styles", "clip--flat"))}
      ${frame({ tone: "grey", cls: "b-half fr--dsl", crumb: "Platform / Button", cap: "The enterprise Button: one primitive in place of 367 hand-built ones." }, mediaTag(base, "armoriq-design-system/p-button", "The enterprise Button page with its live example, props and usage notes"))}
      ${frame({ tone: "ink", cls: "b-half fr--dsk", crumb: "ArmorTools / Button", cap: "The ArmorTools Button: its own tokens, its own playground." }, mediaTag(base, "armoriq-design-system/t-button", "The ArmorTools Button page with its playground and variant controls"))}
      ${frame({ tone: "ink", cls: "b-full fr--dsk", crumb: "ArmorTools / Components", cap: "The index: each part shown live, with its status and what it is for." }, mediaTag(base, "armoriq-design-system/t-components", "The ArmorTools components index: actions, inputs and display parts rendered live with their status"))}
    </div>
  </section>`;
}

function patterns(base: string) {
  return `<section class="story__sec story__x" aria-labelledby="st-patterns">
    ${head(
      7,
      "Patterns",
      "Screens built from <em>nothing but the system.</em>",
      "Patterns put the parts together into real screens: a run's detail, a policy list, the states of a page. {If a screen needs something the system lacks, the gap gets a token or a component, not a one-off.}",
      "st-patterns",
    )}
    <div class="bento">
      ${frame({ tone: "ink", cls: "b-half fr--dsk", crumb: "Pattern / Run detail", cap: "A run read step by step, assembled from system parts." }, mediaTag(base, "armoriq-design-system/t-run-detail", "The run detail pattern: a run's steps with durations, model calls and a side panel"))}
      ${frame({ tone: "ink", cls: "b-half fr--dsk", crumb: "Pattern / Policies", cap: "Suggestions on top, the policy list underneath." }, mediaTag(base, "armoriq-design-system/t-policies", "The policies pattern: suggested detections above a list of policies"))}
      ${frame({ tone: "grey", cls: "b-full fr--dsl", crumb: "Platform / Page states", cap: "One PageState for empty, loading, error and no access, with one action." }, mediaTag(base, "armoriq-design-system/p-states", "The page states pattern: a no API keys yet empty state with a create key action"))}
    </div>
  </section>`;
}

function outcome() {
  return `<section class="story__sec story__x" aria-labelledby="st-outcome">
    ${head(
      8,
      "Outcome",
      "Adopted part by part, <em>with a map for the rest.</em>",
      "The developer console is moving onto ArmorTools a part at a time: tokens, icons, utilities and the sidebar are built, and none has merged yet. The rest of the move starts from an audit that mapped every colour and arbitrary value in the console{ to the system}.",
      "st-outcome",
    )}
    ${results(
      [
        { n: "4 of ~9", title: "Console parts moved onto the system", kind: "Built, in review", text: "Tokens, icons, utilities and the sidebar{; the header, search, chat input, auth and setup are next}.", bars: [] },
        { n: "11 of 81", title: "Console colours that already match a token", kind: "Audit of the console", text: "Another 61 are near misses and 9 have no token yet{, so each gets mapped or becomes a token}.", bars: [] },
        { n: "217", title: "Arbitrary values left to replace", kind: "Audit of the console", text: "Each becomes a token or a component{ as its part moves over}.", bars: [] },
      ],
      "Designed and built by me, for ArmorIQ's two products.",
    )}
  </section>`;
}

/** Story entry point, picked up by templates/case.ts through import.meta.glob */
export function story(base: string, _p: Project) {
  return storyRoot("armoriq-design-system", [overview(base), systems(base), contract(), contrast(base), agents(base), parts(base), patterns(base), outcome()].join(""));
}
