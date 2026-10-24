import type { Project } from "../../content";
import { esc, mediaTag } from "../../lib/html";
import { browser, clip, crop, frame, head, phone, results, stats, storyRoot, tldrInline, zoomed } from "./kit";

/**
 * Shopstr redesign, handpicked: the system, the buying flow, the protocol rules that shaped it, the five-state rule
 * and the seller loop. The live pieces port the shipped behaviour from the redesign repo (data/hooks.ts for reviews and
 * order transitions, data/types.ts for shipping, styles for sticker pops and skeletons) in its colours.
 */

const LIVE = "shopstr-redesign.vercel.app";
const STICKERS = [
  "shape-sparkle-4pt", "shape-starburst", "shape-daisy-yellow", "shape-sun-rays", "shape-heart-circle", "shape-smiley", "shape-hand",
  "shape-sunstar-purple", "shape-sunstar-yellow", "badge-new-round", "badge-new-arch", "badge-new-speech", "badge-new-oval",
  "badge-love-heart", "badge-bff-star", "shape-daisy-pair", "shape-daisy-sm", "shape-diamond-circle", "shape-radial-disc", "shape-rainbow-arc", "shape-shooting-star",
];
const PRODUCTS = [
  { t: "Hand-thrown stoneware mug", p: 18000, s: "@ekko" },
  { t: "Refurbished 65% mechanical keyboard", p: 95000, s: "@bagelmaker" },
  { t: "Organic heavyweight cotton tee", p: 32000, s: "@carol.makes" },
  { t: "Cold-brew concentrate, 1L", p: 14000, s: "@nuno" },
];
const sats = (n: number) => n.toLocaleString("en-US");
const sticker = (base: string, name: string, cls = "") => `<img class="${cls}" src="${base}media/shopstr/stickers/${name}.svg" alt="" width="96" height="96" loading="lazy" decoding="async">`;
const ICON = {
  cart: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 7h12l-1.2 11.1a2 2 0 0 1-2 1.9H9.2a2 2 0 0 1-2-1.9L6 7Z" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M9 7a3 3 0 0 1 6 0" fill="none" stroke="currentColor" stroke-width="1.8"/></svg>`,
  chat: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 6.5A2.5 2.5 0 0 1 7.5 4h9A2.5 2.5 0 0 1 19 6.5v6a2.5 2.5 0 0 1-2.5 2.5H11l-4 4v-4H7.5A2.5 2.5 0 0 1 5 12.5v-6Z" fill="none" stroke="currentColor" stroke-width="1.8"/></svg>`,
};

function overview(base: string) {
  return `<section class="story__sec story__x" aria-labelledby="st-overview">
    ${head(
      1,
      "Overview",
      "A Bitcoin marketplace <em>you would actually use.</em>",
      "{Shopstr lets anyone buy and sell real goods for sats over Nostr: no accounts, no emails, your key is your identity. }The technology worked, and almost none of it reached the person holding the phone. {Over twelve weeks of Summer of Bitcoin, }I redesigned the buyer and seller journeys and built the frontend{ myself}.",
      "st-overview",
      tldrInline(),
    )}
    ${stats([
      ["~40", "routes built, from browsing to wallet payouts"],
      ["5", "states designed for every data surface"],
      ["0", "spinners: loading is always a skeleton"],
      ["21", "stickers that double as controls and rewards"],
    ])}
    ${frame(
      { tone: "grey", cls: "fr--hero fr--sh", crumb: `${LIVE} / Marketplace`, cap: "Scroll to pull back from the hero to the whole marketplace.", attrs: "data-zoom" },
      browser(zoomed(base, "shopstr/s-market", "The redesigned Shopstr marketplace: full-bleed hero, category tiles in the accents, a For You rail"), LIVE),
    )}
  </section>`;
}

function research(base: string) {
  return `<section class="story__sec story__x" aria-labelledby="st-research">
    ${head(
      2,
      "Research",
      "I mapped the buyer's whole trip <em>before a single screen.</em>",
      "The trip runs discover, land, explore, evaluate, decide, pay, confirm and receive{, and each stage got the question a buyer asks there}. {The seller side got its own map, because a buyer only becomes a seller if listing feels lighter than shipping a parcel.}",
      "st-research",
    )}
    <div class="bento">
      ${frame({ tone: "grey", cls: "b-full fr--sh fr--fj", crumb: "FigJam / Buyer journey", cap: "Eight stages, mapped end to end against the app that existed. Scroll to pull back to the whole board.", attrs: "data-zoom" }, zoomed(base, "shopstr/b-figjam-buyer-journey", "FigJam board of the buyer journey: discover, land, explore, evaluate, decide, pay, confirm, receive"))}
      ${frame(
        { tone: "grey", cls: "b-full fr--sh", crumb: "Audit / Where friction goes", cap: "The audit's main call: no friction where people shop, a little on purpose where spam gets in." },
        `<div class="fx">
          <div class="fx__lane fx__lane--go">${sticker(base, "shape-sparkle-4pt", "fx__stk")}<p class="label">Frictionless</p><p class="fx__words">Browse<br>Search<br>Buy</p><p class="fx__why">Where people shop. Each extra step here costs a sale.</p></div>
          <div class="fx__lane fx__lane--keep">${sticker(base, "shape-hand", "fx__stk")}<p class="label">Friction on purpose</p><p class="fx__words">Identity<br>Listing<br>Trust</p><p class="fx__why">Where spam gets in. A little effort filters out low-quality sellers and protects the trust a marketplace runs on.</p></div>
        </div>`,
      )}
    </div>
  </section>`;
}

function system(base: string) {
  const board = STICKERS.map((s) => `<button type="button" class="stk" data-cursor="hide" aria-label="${esc(s.replace(/^(shape|badge)-/, "").replace(/-/g, " "))} sticker">${sticker(base, s)}</button>`).join("");
  return `<section class="story__sec story__x" aria-labelledby="st-system">
    ${head(
      3,
      "System",
      "Loud, <em>and still legible.</em>",
      "My maintainer asked for neo-brutalism, which photographs well and uses badly. Surfaces stay true-neutral grey, there are no shadows, and six accents plus one purple carry all the colour{, so the noise lands only where it means something}.",
      "st-system",
    )}
    <div class="bento">
      ${frame(
        { tone: "grey", cls: "b-7 fr--sh", crumb: "Assets / Sticker library", cap: "Twenty-one stickers. Hover one: it pops and counter-rotates. They work as buttons, bullets and rewards.", tag: "Live" },
        `<div class="stk-board" data-stickers>${board}</div>`,
      )}
      ${frame(
        { tone: "grey", cls: "b-5 fr--sh", crumb: "Listing / Buy row", cap: "The cart is a sticker. Add something and a sparkle pops out as the reward.", tag: "Live" },
        `<div class="ctl" data-ctl>
          <div class="ctl__price"><span class="label">From wallet</span><b>12,000</b></div>
          <button type="button" class="ctl__buy" data-cursor="hide">Buy with sats</button>
          <button type="button" class="ctl__stk ctl__stk--cart" data-cart aria-label="Add to cart" data-cursor="hide">${ICON.cart}<span class="ctl__badge" aria-hidden="true">0</span></button>
          <button type="button" class="ctl__stk ctl__stk--chat" aria-label="Message the seller" data-cursor="hide">${ICON.chat}</button>
          ${sticker(base, "shape-sparkle-4pt", "ctl__spark")}
        </div>`,
      )}
      ${frame(
        { tone: "grey", cls: "b-5 fr--sh fr--swap", crumb: "Community / Heading", cap: "A sticker takes the place of a letter. Hover the heading.", tag: "Hover" },
        `<p class="swap-h">Your pe<span class="swap">${sticker(base, "shape-sunstar-purple")}</span>ple</p>`,
      )}
      ${frame({ tone: "grey", cls: "b-7 fr--sh", crumb: "Figma / Iterations", cap: "Colour, type and component rounds before the system locked." }, mediaTag(base, "shopstr/b-design-system-iterations", "Design system iterations: colour, type and component studies"))}
      ${frame({ tone: "grey", cls: "b-full fr--sh fr--strip", crumb: "Marketplace / Categories", cap: "Each category takes one of the six accents; the stickers carry the personality." }, mediaTag(base, "shopstr/s-cats", "Category tiles in green, pink, blue and orange, each with a sticker"))}
    </div>
  </section>`;
}

const STEPS = ["Fulfilment", "Where to", "Your account", "One last look", "Pay"];

function buying(base: string) {
  const steps = STEPS.map((s, i) => `<button type="button" class="ck__pill" data-step="${i}" aria-pressed="${i === 0}" data-cursor="hide"><span>${i + 1}</span><b>${esc(s)}</b></button>`).join("");
  const shots = STEPS.map((s, i) => `<div class="ck__shot${i ? "" : " is-on"}" data-shot="${i}">${mediaTag(base, `shopstr/s-checkout-${i + 1}`, `Checkout step ${i + 1} of 5: ${s}`)}</div>`).join("");
  return `<section class="story__sec story__x" aria-labelledby="st-buying">
    ${head(
      4,
      "Buying",
      "Sats are the truth. <em>Currency is a label.</em>",
      "Buyers think in their own currency; the protocol and the seller think in sats. Sats stay the stored value everywhere, and a currency quote is a display layer that locks for the length of checkout{, so a price never moves under someone's thumb right before they pay}.",
      "st-buying",
    )}
    <div class="bento">
      ${frame(
        { tone: "grey", cls: "b-5 fr--sh", crumb: "Pricing / Quote", cap: "Pick a currency, then start checkout and watch the live rate drift while the quote holds.", tag: "Live" },
        `<div class="px" data-px>
          <p class="px__sats"><b>12,000</b><span>sats</span></p>
          <p class="px__fiat" aria-live="polite"><span data-px-fiat>Shown in sats</span></p>
          <div class="px__ccy" role="group" aria-label="Display currency">${["sats", "INR", "USD", "EUR"].map((c, i) => `<button type="button" data-ccy="${c}" aria-pressed="${i === 0}" data-cursor="hide">${c}</button>`).join("")}</div>
          <button type="button" class="px__go" data-px-go data-cursor="hide">Start checkout</button>
          <p class="px__note" data-px-note>Example rates, not live prices</p>
        </div>`,
      )}
      ${frame({ tone: "grey", cls: "b-7 fr--sh fr--clip", crumb: "Listing / Add to cart", cap: "The add-to-cart reward: a sparkle pops from the cart sticker.", tag: "Video" }, clip(base, "shopstr/s-clip-cart", "Pressing the cart sticker on a listing; a sparkle sticker pops out", "clip--flat"))}
      ${frame(
        { tone: "grey", cls: "b-7 fr--sh fr--ck", crumb: "Checkout / Five steps", cap: "Checkout has its own URL now, and a review step before the irreversible one. Step through it.", tag: "Live" },
        `<div class="ck" data-ck><div class="ck__pills" role="group" aria-label="Checkout steps">${steps}</div><div class="ck__stage">${shots}</div><div class="ck__nav">${["Back", "Next"].map((l) => `<button type="button" data-ck-${l.toLowerCase()} data-cursor="hide">${l}</button>`).join("")}</div></div>`,
      )}
      ${frame({ tone: "grey", cls: "b-5 fr--sh", crumb: "Listing / Buy box", cap: "The price in sats with shipping already added, the wallet balance beside it, the buy bar under the thumb." }, crop(base, "shopstr/s-buybox", "Listing buy box: title, 12,000 sats, shipping and origin cards, the community thread, Buy with sats", "crop--buybox"))}
    </div>
  </section>`;
}

function protocol(base: string) {
  const dims = ["value", "quality", "delivery", "communication"];
  const dimRows = dims
    .map((d) => `<div class="rv__dim" data-dim="${d}"><span class="label">${d}</span><div role="group" aria-label="${d}">${["skip", "yes", "no"].map((v) => `<button type="button" data-v="${v}" aria-pressed="${v === "yes"}" data-cursor="hide">${v === "skip" ? "Not rated" : v === "yes" ? "Good" : "Bad"}</button>`).join("")}</div></div>`)
    .join("");
  const statuses = ["pending", "confirmed", "shipped", "delivered"];
  const ship = [
    ["N/A", "No shipping concept: a digital good or a service."],
    ["Free", "The seller ships, at no charge."],
    ["Pickup", "Pickup only. Shipping is impossible."],
    ["Free/Pickup", "The buyer chooses: free shipping or pickup."],
    ["Added Cost", "The seller ships and charges for it."],
  ];
  return `<section class="story__sec story__x" aria-labelledby="st-protocol">
    ${head(
      5,
      "Protocol",
      "The protocol is <em>a design material.</em>",
      "Ratings are computed from raw review scores and never stored as an average, order actions depend on whether you bought or sold, and checkout's options come straight from the listing's shipping type{, because a flow that ignores the protocol does not survive the port}.",
      "st-protocol",
    )}
    <div class="bento">
      ${frame(
        { tone: "grey", cls: "b-half fr--sh", crumb: "Reviews / Weighted score", cap: "The thumb is half the score; the other half splits across whichever dimensions were rated.", tag: "Live" },
        `<div class="rv" data-rv>
          <div class="rv__thumb"><span>Would deal again?</span><div role="group" aria-label="Would deal again">${["yes", "no"].map((v) => `<button type="button" data-thumb="${v}" aria-pressed="${v === "yes"}" data-cursor="hide">${v === "yes" ? "Yes" : "No"}</button>`).join("")}</div></div>
          <div class="rv__dims">${dimRows}</div>
          <div class="rv__out"><b data-rv-score>5.0</b><span class="rv__stars" data-rv-stars aria-hidden="true"></span><span class="label" data-rv-math>Thumb 50% + 4 × 12.5%</span></div>
        </div>`,
      )}
      ${frame(
        { tone: "grey", cls: "b-half fr--sh", crumb: "Orders / Who moves what", cap: "The seller confirms, ships and delivers. The buyer can only cancel, and only before it ships.", tag: "Live" },
        `<div class="od" data-od>
          <div class="od__role" role="group" aria-label="Your role">${["sold", "bought"].map((r, i) => `<button type="button" data-role="${r}" aria-pressed="${i === 0}" data-cursor="hide">I ${r} this</button>`).join("")}</div>
          <ol class="od__track">${statuses.map((s, i) => `<li data-status="${s}" class="${i === 0 ? "is-now" : ""}"><i></i><span>${s}</span></li>`).join("")}<li data-status="cancelled" class="od__cancel"><i></i><span>cancelled</span></li></ol>
          <div class="od__act"><button type="button" class="od__btn" data-od-act data-cursor="hide">Confirm order</button><button type="button" class="od__reset label" data-od-reset data-cursor="hide">Reset</button></div>
          <p class="od__note" data-od-note>As the seller, you move the order forward.</p>
        </div>`,
      )}
      ${frame(
        { tone: "grey", cls: "b-half fr--sh", crumb: "Checkout / Fulfilment", cap: "The listing's shipping type decides the options. Only Added Cost ever charges.", tag: "Live" },
        `<div class="sp" data-sp>
          <div class="sp__types" role="group" aria-label="Shipping type">${ship.map(([t], i) => `<button type="button" data-ship="${esc(t)}" aria-pressed="${i === 4}" data-cursor="hide">${esc(t)}</button>`).join("")}</div>
          <p class="sp__desc" data-sp-desc>${esc(ship[4][1])}</p>
          <ul class="sp__opts" data-sp-opts></ul>
          <p class="sp__total"><span class="label">Total</span><b data-sp-total>13,500</b><span>sats</span></p>
        </div>`,
      )}
      ${frame({ tone: "grey", cls: "b-half fr--sh", crumb: "Communities / Moderation", cap: "Communities follow Nostr's own approval model: posts wait for a moderator, and the queue comes first." }, crop(base, "shopstr/s-community", "Communities: Your people heading, a Needs your review queue, then new posts with approval chips", "crop--community"))}
    </div>
  </section>`;
}

function states(base: string) {
  const tabs = ["Loading", "Empty", "No results", "Not found", "Populated"]
    .map((t, i) => `<button type="button" data-state="${i}" aria-pressed="${i === 4}" data-cursor="hide">${t}</button>`)
    .join("");
  const cards = PRODUCTS.map(
    (p, i) => `<article class="pc"><div class="pc__img">${mediaTag(base, `shopstr/s-prod-${i}`, p.t)}</div><p class="pc__t">${esc(p.t)}</p><p class="pc__p"><b>${sats(p.p)}</b> sats</p><p class="pc__s label">${esc(p.s)}</p></article>`,
  ).join("");
  const skel = PRODUCTS.map(() => `<div class="pc pc--skel" aria-hidden="true"><div class="pc__img"></div><p class="pc__t"></p><p class="pc__p"></p><p class="pc__s"></p></div>`).join("");
  return `<section class="story__sec story__x" aria-labelledby="st-states">
    ${head(
      6,
      "States",
      "Five states, <em>zero spinners.</em>",
      "Every data surface ships loading, empty, no results, not found and populated{, and loading is a skeleton with the real card's exact geometry, so nothing jumps when data lands}.",
      "st-states",
    )}
    <div class="bento">
      ${frame(
        { tone: "grey", cls: "b-full fr--sh", crumb: "Marketplace / For you", cap: "Switch the state. The skeleton holds every card's size, so the grid never reflows.", tag: "Live" },
        `<div class="st5" data-st5 data-state="4">
          <div class="st5__tabs" role="group" aria-label="State">${tabs}</div>
          <div class="st5__stage">
            <div class="st5__view st5__view--loading">${skel}</div>
            <div class="st5__view st5__view--empty"><div class="st5__msg">${sticker(base, "badge-new-speech")}<p class="st5__h">Nothing here yet</p><p>Follow a few sellers and their new listings land here.</p><span class="st5__cta">Browse the market</span></div></div>
            <div class="st5__view st5__view--noresults"><div class="st5__msg">${sticker(base, "shape-hand")}<p class="st5__h">No matches for “zine risograph blue”</p><p>Try fewer words, or one of these.</p><span class="st5__chips"><i>zines</i><i>risograph</i><i>art &amp; print</i></span></div></div>
            <div class="st5__view st5__view--notfound"><div class="st5__msg">${sticker(base, "shape-shooting-star")}<p class="st5__h">This listing is gone</p><p>The seller removed it. Here is what they sell now.</p><span class="st5__cta">See the shop</span></div></div>
            <div class="st5__view st5__view--populated">${cards}</div>
          </div>
        </div>`,
      )}
      ${frame({ tone: "grey", cls: "b-7 fr--sh", crumb: "Dev / Every state on one page", cap: "Skeletons and designed empties, collected on one screen so none is forgotten." }, mediaTag(base, "shopstr/b-loading-empty-states", "Every skeleton and empty state in the app collected on one screen"))}
      ${frame({ tone: "grey", cls: "b-5 fr--sh fr--clip", crumb: "Boot / Stocking the shelves", cap: "First load is a moment, not a spinner: stickers pop around the mark.", tag: "Video" }, clip(base, "shopstr/s-clip-boot", "The Shopstr boot screen: the mark with stickers popping around it and the line Stocking the shelves", "clip--flat"))}
    </div>
  </section>`;
}

function loop(base: string) {
  return `<section class="story__sec story__x" aria-labelledby="st-loop">
    ${head(
      7,
      "Selling",
      "Buying is half <em>a marketplace.</em>",
      "The seller side got the same care{, so sats keep circulating}: a sell dashboard, a short listing flow, and a wallet that sets up, sends, receives, claims, withdraws and pays out.",
      "st-loop",
    )}
    <div class="bento">
      ${frame({ tone: "grey", cls: "b-full fr--sh", crumb: "Sell / Listings and wallet", cap: "Your listings with the newest sale on top; the wallet holds it as a claim until you take it." }, mediaTag(base, "shopstr/b-circular-economy", "The seller's listings on a desktop with a new sale banner, beside the wallet on a phone with the sale ready to claim"))}
      ${frame({ tone: "grey", cls: "b-half fr--sh", crumb: "Sell / New listing", cap: "Listing is one screen: photo, title, a price in sats, a category, publish. A preview shows what buyers will see." }, crop(base, "shopstr/s-sell", "New listing form: photo, title, price in sats, category and condition chips, Publish listing, with a buyer preview card", "crop--sell"))}
      ${frame({ tone: "grey", cls: "b-half fr--sh", crumb: "Wallet / Balance", cap: "A sale arrives as a claim, and every movement says where it went." }, crop(base, "shopstr/s-wallet", "Wallet: new sale ready to claim, spendable balance 182,400 sats, receive and send, activity list", "crop--wallet"))}
    </div>
  </section>`;
}

function mobile(base: string) {
  return `<section class="story__sec story__x" aria-labelledby="st-mobile">
    ${head(
      8,
      "Mobile",
      "Designed for the phone <em>first.</em>",
      "Most shopping happens on a phone, so the pill buy bar, the bottom nav and the category tiles were designed at 390 pixels{ and widened after}.",
      "st-mobile",
    )}
    <div class="bento bento--mobile">
      ${frame({ tone: "grey", cls: "m-a fr--sh", crumb: "Marketplace / Phone", tag: "Video" }, phone(mediaTag(base, "shopstr/s-clip-mscroll", "Scrolling the marketplace on a phone: hero, category tiles, the For You rail")))}
      ${frame({ tone: "grey", cls: "m-b fr--sh", crumb: "Listing / Buy bar", cap: "The buy bar is a pill in thumb reach." }, phone(mediaTag(base, "shopstr/s-m-listing", "A listing on a phone with the pill buy bar: Buy with sats, cart and chat stickers"), "ph--bottom"))}
      ${frame({ tone: "ink", cls: "m-c", crumb: "Wallet / Phone", cap: "Claim a sale, then send or receive." }, phone(mediaTag(base, "shopstr/s-m-wallet", "The wallet on a phone: a sale ready to claim, the balance, activity"), "ph--top"))}
    </div>
  </section>`;
}

function outcome(base: string) {
  return `<section class="story__sec story__x" aria-labelledby="st-outcome">
    ${head(
      9,
      "Handoff",
      "The port is a hook swap, <em>not a redesign.</em>",
      "All data reaches the screens through one hook layer, money is already integer sats and identity is already an npub{, so connecting the live Nostr backend means replacing what is inside the hooks}.",
      "st-outcome",
    )}
    <div class="bento">
      ${frame({ tone: "grey", cls: "b-full fr--sh", crumb: "Docs / Handoff plan", cap: "The hook layer is the seam: screens on one side, mock data today and Nostr tomorrow on the other." }, mediaTag(base, "shopstr/b-handoff-plan", "Handoff plan: screens read hooks, hooks read mock data today and the live Nostr backend later"))}
    </div>
    ${results(
      [
        { n: "~40", title: "Routes, both sides of the market", kind: "Built, Next.js and TypeScript", text: "Browse, search, product, cart, checkout, orders, reviews, messages, communities, selling and the wallet{ all run on mock data today}.", bars: [] },
        { n: "28", title: "Hooks in one file, the whole backend contract", kind: "Counted in data/hooks.ts", text: "Each one is mapped to the Nostr event kind it reads in production{, in a wiring table the maintainer works from}.", bars: [] },
        { n: "1", title: "Seam for the backend port", kind: "Architecture", text: "No component touches a fetch or a relay{; the maintainer swaps hook bodies, not screens}.", bars: [] },
      ],
      "Status: built and documented, not yet merged upstream. The maintainer is porting it; I stay on for design questions.",
    )}
  </section>`;
}

/** Story entry point, picked up by templates/case.ts through import.meta.glob */
export function story(base: string, _p: Project) {
  return storyRoot("shopstr", [overview(base), research(base), system(base), buying(base), protocol(base), states(base), loop(base), mobile(base), outcome(base)].join(""));
}
