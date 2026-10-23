import type { Project } from "../../content";
import { esc, mediaTag, pad2 } from "../../lib/html";
import { browser, clip, crop, frame, head, mockup, phone, qa, results, scroller, stats, storyRoot, tldrInline, zoomed } from "./kit";

/**
 * DASH, told visually. Rules this page follows (and the case-study skill documents):
 * every capture sits inside a padded frame, cropped or zoomed to the part being discussed; components are lifted
 * out of their screens and shown alone, live where possible; bento text lives inside the frame or outside the whole
 * bento, never under each tile; prose is written once in full with TL;DR cuts in braces.
 */

const RITUAL = 30;

/** Glow list prices from the prototype's catalogue. Per-shot figures are derived from these, never typed in. */
const PACKS = [
  { name: "Trial pack", servings: 6, price: 780 },
  { name: "Starter pack", servings: 12, price: 1395 },
  { name: "Recommended pack", servings: 30, price: 3213 },
] as const;
/** The live PDP preselects the middle pack */
const DEFAULT_PACK = 1;

/** Ink on each base colour, from the prototype's token file */
export const SHOTS = [
  { key: "glow", name: "Dash of Glow", job: "Skin", flavour: "Peach passion fruit", contrast: "6.79", h: 565 },
  { key: "volume", name: "Dash of Volume", job: "Hair", flavour: "Pineapple coconut", contrast: "7.50", h: 533 },
  { key: "burn", name: "Dash of Burn", job: "Weight", flavour: "Lemon ginger", contrast: "7.09", h: 544 },
] as const;

const rupees = (n: number) => `₹${n.toLocaleString("en-IN")}`;
const perShot = (i: number) => Math.round(PACKS[i].price / PACKS[i].servings);
const saving = () => Math.round((1 - PACKS[2].price / PACKS[2].servings / (PACKS[0].price / PACKS[0].servings)) * 100);

/** The liquid-carve button. Label is drawn twice: the second copy is clipped to the bite each frame. */
export const liquidButton = (label: string, cls = "") =>
  `<button type="button" class="dbtn${cls ? ` ${cls}` : ""}" data-liquid data-cursor="hide">
      <svg class="dbtn__bg" aria-hidden="true" focusable="false">
        <defs><mask class="dbtn__mask" x="-0.25" y="-0.25" width="1.5" height="1.5">
          <rect width="100%" height="100%" fill="#fff"/>
          <g class="dbtn__follow"><g class="dbtn__squash"><circle cx="50%" cy="50%" r="0" fill="#000"/></g></g>
        </mask></defs>
        <g filter="url(#dash-goo)"><rect class="dbtn__reveal" width="100%" height="100%" rx="28" ry="28"/></g>
        <g filter="url(#dash-goo)"><rect class="dbtn__surface" width="100%" height="100%" rx="28" ry="28"/></g>
        <rect class="dbtn__stroke" x="1" y="1" width="0" height="0" rx="27" ry="27"/>
      </svg>
      <span class="dbtn__label">${esc(label)}</span>
      <span class="dbtn__label dbtn__label--carve" aria-hidden="true">${esc(label)}</span>
    </button>`;

/** One shared goo filter: blur, then a hard alpha threshold, so the bite grows round shoulders */
const gooDefs = `<svg class="dash-defs" width="0" height="0" aria-hidden="true" focusable="false"><defs>
    <filter id="dash-goo" x="-25%" y="-25%" width="150%" height="150%" color-interpolation-filters="sRGB">
      <feGaussianBlur in="SourceGraphic" stdDeviation="6" result="blur"/>
      <feColorMatrix in="blur" mode="matrix" values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 19 -9"/>
    </filter></defs></svg>`;

/* --------------------------------------------------------------- sections */

function overview(base: string) {
  return `<section class="story__sec story__x" aria-labelledby="st-overview">
    ${head(
      1,
      "Overview",
      "Strangers from an ad, <em>buying a shot they have never tried.</em>",
      "{DASH sells 60ml wellness shots. }Most buyers {come from an Instagram ad and }have never heard of DASH. {I rebuilt the store around that moment. }The page answers each doubt in order, shows what results really cost, and gets them to checkout{ without a single invented number}.",
      "st-overview",
      tldrInline(),
    )}
    ${stats([
      [rupees(perShot(2)), `a shot on the 30 pack, shown next to ${rupees(perShot(0))} on the trial`],
      ["6 of 30", "days the trial covers, said on the page"],
      ["82%", "lighter images, 5.9 MB down to 1.1 MB"],
      ["5 pages", "from home to checkout, all clickable"],
    ])}
    ${frame(
      { tone: "glow", crumb: "drinkdash.in / Home", cap: "Scroll to zoom out from the first thing a buyer sees.", cls: "fr--hero", attrs: "data-zoom" },
      browser(zoomed(base, "dash/cover", "The DASH home page: take a shot, it's time to dash, beside the Glow box"), "drinkdash.in"),
    )}
  </section>`;
}

const INGREDIENTS = [
  { name: "Glutathione", role: "Antioxidant support", dose: "500", unit: "mg", art: true },
  { name: "Vitamin C", role: "Collagen support", dose: "40", unit: "mg", art: false },
  { name: "Zinc", role: "Acne support", dose: "10", unit: "mg", art: false },
];

function problem(base: string) {
  const cards = SHOTS.map(
    (s, i) => `<img class="fan__card" src="${base}media/dash/iso-pcard-${s.key}.jpg" width="640" height="1112" alt="${esc(s.name)} product card" loading="lazy" decoding="async" style="--i: ${i}">`,
  ).join("");
  const ingr = INGREDIENTS.map(
    (g, i) => `<article class="ing" style="--i: ${i}" tabindex="0">
        <span class="ing__n label">${pad2(i + 1)}</span>
        ${g.art ? `<img class="ing__art" src="${base}media/dash/ing-glutathione.webp" width="420" height="275" alt="" loading="lazy" decoding="async">` : `<span class="ing__big" aria-hidden="true">${g.dose}<small>${g.unit}</small></span>`}
        <span class="ing__role label">${esc(g.role)}</span>
        <span class="ing__name">${esc(g.name)}</span>
        <span class="ing__dose"><span class="label">Dose</span>${g.dose} ${g.unit}</span>
      </article>`,
  ).join("");
  return `<section class="story__sec story__x" aria-labelledby="st-problem">
    ${head(
      2,
      "Problem",
      "Three shots, no clear pick, <em>and a buyer who trusts nothing.</em>",
      "They cannot tell which shot is theirs{, have no idea whether 500mg is a lot,} and read every number as marketing{, because most wellness pages never say where a number came from}.",
      "st-problem",
    )}
    <div class="bento bento--problem">
      ${frame({ tone: "cream", cls: "b-a", intro: qa("Which one is mine?", "One colour and one job per shot.", 1), tag: "Hover" }, `<div class="fan">${cards}</div>`)}
      ${frame({ tone: "soft", cls: "b-b", intro: qa("Does 500mg mean anything?", "Each active shows its dose and its role.", 2), tag: "Live" }, `<div class="ings">${ingr}</div>`)}
      ${frame({ tone: "ink", cls: "b-c", intro: qa("Is any of this real?", "Seven published papers, listed by name.", 3) }, crop(base, "dash/iso-research", "Seven research papers listed behind the formula", "crop--research"))}
    </div>
  </section>`;
}

function ladder(base: string) {
  const rows = PACKS.map((pk, i) => {
    const short = Math.max(0, RITUAL - pk.servings);
    const pips = Array.from({ length: RITUAL }, (_, d) => `<span class="lad__pip" style="grid-column: ${d + 1}">${d < pk.servings - 1 ? '<span class="lad__ink"></span>' : ""}</span>`).join("");
    return `<li><button type="button" class="lad__row${short ? "" : " lad__row--covers"}" data-cursor="hide" aria-pressed="${i === DEFAULT_PACK}" data-pack="${i}" data-servings="${pk.servings}">
        <span class="lad__id"><span class="label">${esc(pk.name)}</span><span class="lad__count"><b>${pk.servings}</b> shots</span></span>
        <span class="lad__track" aria-hidden="true">${pips}<img class="lad__bottle" src="${base}media/dash/bottle-glow.webp" alt="" width="560" height="565" loading="lazy" decoding="async" style="grid-column: ${pk.servings}"></span>
        <span class="lad__verdict">${short ? `${short} days short` : `Covers all ${RITUAL}`}</span>
        <span class="lad__unit"><b>${rupees(perShot(i))}</b><span>a shot</span></span>
      </button></li>`;
  }).join("");
  const sum = (i: number) => `${PACKS[i].name}: ${rupees(PACKS[i].price)}, ${PACKS[i].servings} of ${RITUAL} days, ${rupees(perShot(i))} a shot`;
  const spec = [
    ["Anchor", `Price per shot, not per box. The 30 pack is ${saving()}% cheaper a shot.`],
    ["One baseline", "Three bars on one 30-day scale, so the eye compares lengths."],
    ["Default", "The middle pack is preselected. One step up is the full routine."],
  ];
  return `<section class="story__sec story__x" aria-labelledby="st-ladder">
    ${head(
      3,
      "Pricing",
      "I put every pack <em>on the same 30 days.</em>",
      "The brand{’s own fine print} says results take 30 days, and the trial has 6 shots. Most stores hide that gap. I drew it{ on one shared scale}, so the 30 pack sells itself{ at ₹107 a shot instead of ₹130}.",
      "st-ladder",
    )}
    <div class="bento">
      ${frame(
        { tone: "white", cls: "b-full", crumb: "Home / The maths", cap: "Try it. Pick a pack.", tag: "Live" },
        `<div class="lad" data-ladder data-summaries='${esc(JSON.stringify(PACKS.map((_, i) => sum(i))))}'>
          <p class="label lad__scale" aria-hidden="true"><span class="lad__ends"><span>Day 1</span><span>Day ${RITUAL}</span></span></p>
          <ol class="lad__rows">${rows}</ol>
          <p class="lad__sum" role="status" aria-live="polite">${esc(sum(DEFAULT_PACK))}</p>
        </div>`,
      )}
      ${frame({ tone: "pale", cls: "b-half fr--clip", crumb: "Product / Buy box", cap: "The same maths in the buy box, then the cart.", tag: "Video" }, clip(base, "dash/clip-buy", "Picking the trial, then the 30 pack, hovering Add to cart and the drawer sliding in"))}
      ${frame(
        { tone: "grey", cls: "b-half fr--spec" },
        `<div class="spec"><p class="spec__title">Why the 30 pack <em>wins</em></p><div class="spec__vs"><p><span class="label">Trial, a shot</span><b>${rupees(perShot(0))}</b></p><p><span class="label">30 pack, a shot</span><b>${rupees(perShot(2))}</b></p></div><dl>${spec.map(([k, v]) => `<div><dt class="label">${esc(k)}</dt><dd>${esc(v)}</dd></div>`).join("")}</dl></div>`,
      )}
    </div>
  </section>`;
}

function business() {
  /* Price axis from Rs 0 to Rs 1,600. Every 6 pack lands inside the Rs 500 to 1,000 band. */
  const MAX = 1600;
  const at = (rs: number) => `${((rs / MAX) * 100).toFixed(2)}%`;
  const dots = [
    { rs: 770, label: "Volume, 6 shots", cls: "volume" },
    { rs: 775, label: "Burn, 6 shots", cls: "burn" },
    { rs: 780, label: "Glow, 6 shots", cls: "glow" },
    { rs: 499, label: "Proposed trio", cls: "trio" },
  ];
  const ticks = [0, 500, 1000, 1500].map((t) => `<span class="rto__tick" style="left: ${at(t)}">${rupees(t)}</span>`).join("");
  return `<section class="story__sec story__x" aria-labelledby="st-business">
    ${head(
      4,
      "Business",
      "Every 6 pack sat where <em>28% of orders come back.</em>",
      "In Indian e-commerce{, cash on delivery is the norm and} failed deliveries cost more than lost clicks. {So I went past the page. }I proposed a ₹499 trial{ with two of each shot}, priced under that band{, and it answers which one is mine on the way}.",
      "st-business",
    )}
    <div class="bento">
      ${frame(
        { tone: "grey", cls: "b-wide", crumb: "Pricing / Return to origin", cap: "Return-to-origin by order value: Shipway benchmark. Cash on delivery about 26%, prepaid under 2%." },
        `<div class="rto" data-rto><div class="rto__plot" role="img" aria-label="Price axis from 0 to 1,600 rupees. The 500 to 1,000 rupee band, where about 28% of orders return to origin, holds all three 6 packs at 770 to 780 rupees. The proposed 499 rupee trio sits just below it.">
          <div class="rto__band" style="left: ${at(500)}; width: ${at(500)}"><span class="rto__pct">28%</span><span class="label">return to origin</span></div>
          ${dots.map((d, i) => `<span class="rto__dot rto__dot--${d.cls}" style="left: ${at(d.rs)}; --i: ${i}"><span class="label">${esc(d.label)}<b>${rupees(d.rs)}</b></span></span>`).join("")}
          <div class="rto__axis" aria-hidden="true">${ticks}</div>
        </div></div>`,
      )}
      ${frame(
        { tone: "cream", cls: "b-narrow", crumb: "Home / Lineup", tag: "Proposal" },
        `<div class="trio">
          <p class="trio__kicker label">Not sure which one? Start here</p>
          <p class="trio__name">The Trial Trio</p>
          <p class="trio__detail">Two of each shot, six servings.</p>
          <div class="trio__row"><p class="trio__price">₹499</p>${liquidButton("Add the trio", "dbtn--ink")}</div>
        </div>`,
      )}
    </div>
  </section>`;
}

/** Section tops on the 1440px product page capture, as page offsets in px. Measured from the running prototype. */
const IA = [
  { q: "What is it, and what does it cost?", s: "Buy box", y: 0 },
  { q: "What is inside?", s: "Formula", y: 1230 },
  { q: "Is it for me?", s: "Two reasons", y: 2341 },
  { q: "Which pack?", s: "The maths", y: 3031 },
  { q: "How does it work?", s: "How it works", y: 3870 },
  { q: "Can I trust it?", s: "Research", y: 5865 },
  { q: "Do people like it?", s: "Reviews", y: 7001 },
];

function structure(base: string) {
  return scroller({
    n: 5,
    label: "Structure",
    title: "The page follows the buyer’s doubts, <em>in the order they have them.</em>",
    text: "Sections follow the next question a stranger asks{, instead of leading with brand story}.{ The buy box stays one tap away the whole time.}",
    id: "st-ia",
    items: IA,
    src: `${base}media/dash/pdp-full.jpg`,
    w: 1440,
    h: 10506,
    url: "drinkdash.in/products/dash-of-glow",
    crumb: "Product / Dash of Glow",
  });
}

const SWATCHES: Record<string, [string, string][]> = {
  glow: [["Base", "#FF836B"], ["Pale", "#FFBFB2"], ["Soft", "#FFE9E4"]],
  volume: [["Base", "#94BD43"], ["Pale", "#C4DBA4"], ["Soft", "#EAF2E0"]],
  burn: [["Base", "#E59C06"], ["Pale", "#EFCA99"], ["Soft", "#F9ECDC"]],
};

function colour(base: string) {
  const bottles = SHOTS.map(
    (s, i) => `<button type="button" class="shelf__pick" data-cursor="hide" aria-pressed="${i === 0}" data-shot="${s.key}" style="--i: ${i}">
        <img class="shelf__bottle" src="${base}media/dash/bottle-${s.key}.webp" alt="" width="560" height="${s.h}" loading="lazy" decoding="async">
        <span class="shelf__mark" aria-hidden="true"></span>
        <span class="shelf__name">${esc(s.name)}<span>${esc(s.job)}</span></span>
      </button>`,
  ).join("");
  const s = SHOTS[0];
  const swatches = SHOTS.map(
    (x) => `<li class="sw sw--${x.key}"><p class="label sw__name">${esc(x.name)}</p>${SWATCHES[x.key].map(([n, hex], i) => `<span class="sw__chip sw__chip--${i}"><span class="label">${n}</span><span class="label">${hex}</span></span>`).join("")}</li>`,
  ).join("");
  return `<section class="story__sec shelf" data-shelf data-theme="glow" aria-labelledby="st-colour">
    <div class="story__x">
      ${head(
        6,
        "Brand system",
        "One colour per shot. <em>The ad’s colour is the page you land on.</em>",
        "Coral for skin, olive for hair, amber for weight. Dark text passes contrast on every ground{, because each ramp is computed, not picked}.{ A new product is one colour and one data entry.}",
        "st-colour",
      )}
      <div class="shelf__in">
        <div class="shelf__row" role="group" aria-label="Pick a shot">${bottles}</div>
        <dl class="shelf__spec" aria-live="polite">
          <div><dt class="label">Shot</dt><dd data-f="name">${esc(s.name)}</dd></div>
          <div><dt class="label">Flavour</dt><dd data-f="flavour">${esc(s.flavour)}</dd></div>
          <div><dt class="label">Ink on base</dt><dd data-f="contrast">${s.contrast}:1, AA</dd></div>
        </dl>
      </div>
      <ul class="sws" aria-label="Colour ramps">${swatches}</ul>
    </div>
  </section>`;
}

function interaction(base: string) {
  return `<section class="story__sec story__x" aria-labelledby="st-motion">
    ${head(
      7,
      "Interaction",
      "Fourteen tokens, <em>one motion system.</em>",
      "Durations and curves come from one token file{, so nothing on the site moves on its own timing}. Reduced motion stops the movement and keeps the content{, because content is never decoration}.",
      "st-motion",
    )}
    <div class="bento">
      ${frame(
        { tone: "glow", cls: "b-5", crumb: "Button / Liquid carve", cap: "A goo filter bites the button and chases the cursor.", tag: "Hover it" },
        `<div class="btnlab">${liquidButton("Add to cart", "dbtn--ink dbtn--lg")}${liquidButton("See the formula", "dbtn--ghost dbtn--lg")}</div>`,
      )}
      ${frame({ tone: "ink", cls: "b-7 fr--clip", crumb: "Loader / Ink flood", cap: "Plays once. Skipped under reduced motion.", tag: "Video" }, clip(base, "dash/clip-loader", "The ink-flood loader resolving into the DASH home page"))}
      ${frame({ tone: "cream", cls: "b-8 fr--clip", crumb: "Home / How it works", cap: "Step cards comb apart under the cursor.", tag: "Video" }, clip(base, "dash/clip-hiw", "Four step cards fanning apart as the cursor passes over them", "clip--flat"))}
      ${frame({ tone: "cream", cls: "b-4 fr--drawer", crumb: "Cart / Drawer", cap: "Focus trapped, Escape closes, focus returns." }, crop(base, "dash/iso-drawer", "The cart drawer with one Recommended pack, totals and checkout", "crop--drawer"))}
    </div>
  </section>`;
}

function mobile(base: string) {
  return `<section class="story__sec story__x" aria-labelledby="st-mobile">
    ${head(
      8,
      "Mobile",
      "Built for the thumb <em>that tapped the ad.</em>",
      "{Most of this traffic lands on a phone. }Pack, price and the buy button stay one tap away all the way down{, in a bar that appears only once the buy box scrolls out of view}.",
      "st-mobile",
    )}
    <div class="bento bento--mobile">
      ${frame({ tone: "grey", cls: "m-a", crumb: "Product / Mobile", tag: "Video" }, phone(mediaTag(base, "dash/mobile", "Scrolling the product page on a phone, picking the 30 pack and adding it from the sticky bar")))}
      ${frame({ tone: "pale", cls: "m-b", crumb: "Product / Sticky bar", cap: "The bar arrives when the buy box leaves." }, phone(mediaTag(base, "dash/clip-sticky", "The sticky buy bar sliding in at the bottom of the phone, then the cart"), "ph--bottom"))}
      ${frame({ tone: "ink", cls: "m-c", crumb: "Checkout / Contact", cap: "Three steps, UPI first, pincode checked." }, phone(mediaTag(base, "dash/m-checkout", "Checkout on a phone: order summary and the contact step"), "ph--top"))}
    </div>
  </section>`;
}

function outcome() {
  return `<section class="story__sec story__x" aria-labelledby="st-outcome">
    ${head(9, "Outcome", "A store built to sell <em>the pack that works.</em>", "", "st-outcome")}
    ${results(
      [
        {
          n: rupees(perShot(2)),
          title: "A shot on the 30 pack",
          kind: "Derived from list prices",
          text: "The page shows {the per-shot price on }every pack{, so the 30 pack is the visible best value}.",
          bars: PACKS.map((p, i) => [p.servings + " pack", perShot(i), rupees(perShot(i))]),
        },
        {
          n: "82%",
          title: "Lighter images",
          kind: "Measured",
          text: "Twenty-one images went from 5.9 MB to 1.1 MB{, so a buyer on mobile data sees the product sooner}.",
          bars: [["Before", 5.87, "5.9 MB"], ["After", 1.07, "1.1 MB"]],
        },
        {
          n: "28%",
          title: "Return band the trio avoids",
          kind: "Shipway benchmark",
          text: "Every 6 pack sat in the band where 28% of orders come back{. The ₹499 trio sits under it}.",
          bars: [["₹500 to 1,000", 28, "28%"], ["Prepaid", 2, "under 2%"]],
        },
      ],
      "Next, with live traffic: ladder on against ladder off, measured on 30-pack share.",
    )}
  </section>`;
}

/** Story entry point, picked up by templates/case.ts through import.meta.glob */
export function story(base: string, _p: Project) {
  return storyRoot(
    "dash",
    [
      overview(base),
      mockup(base, "dash/mock-phone", "A phone showing the DASH product page beside a bottle of Dash of Glow", "{Shot on a real counter: }the product page as a buyer holds it."),
      problem(base),
      ladder(base),
      business(),
      structure(base),
      colour(base),
      interaction(base),
      mobile(base),
      mockup(base, "dash/mock-laptop", "A laptop on a desk showing the DASH home page", "{The same system on a laptop: }one colour field per shot, one maths for every pack."),
      outcome(),
    ].join(""),
    gooDefs,
  );
}
