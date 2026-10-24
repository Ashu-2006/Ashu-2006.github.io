import type { Project } from "../../content";
import { esc, mediaTag } from "../../lib/html";
import { clip, frame, head, phone, results, stats, storyRoot, tldrInline } from "./kit";

/**
 * Navu Kavacha: a shared handover record for restaurant wet waste in Bengaluru. Captures come from the presenter
 * build (each phone screen alone) and the first-commit prototype for the before. The live pieces port the shipped
 * rules from shared/domain/policy.ts (pay by bin size, the 10-minute wait fee) and the app's own strings in
 * English, Kannada and Tamil (shared/i18n/strings).
 */

/* design-strategy-plan.md, section 1: who carries what in the chain of custody */
export const CHAIN: [string, string, string, string][] = [
  ["Restaurant", "Legal liability. Fines double on a second offence and the trade licence can go after the fourth.", "Proof they complied, at the least staff time.", "Evidence that holds if the waste is remixed downstream."],
  ["Collector", "The work and the risk: sharps, spoiled food, heat, stigma.", "Predictable pay, safety, being believed.", "A legal identity and a work history. About 25,000 ID cards for an estimated 4,23,000 pickers in Karnataka."],
  ["Vendor", "Routes, vehicles, empanelment. About 90% of vendors were delisted in August 2025.", "To stay empanelled and keep a margin.", "A way to prove clean handovers to restaurants and the corporation."],
  ["Processor", "Receiving and weighing.", "Clean input.", "Someone accountable upstream when input arrives mixed."],
  ["City", "Enforcement under the 2026 waste rules.", "Quantities traced to registered processors.", "One record linking generator, collector and processor."],
];

/* design-strategy-plan.md, section 2: the persona spectrum, easy end against the hard end */
const SPECTRUM: [string, string, string][] = [
  ["Phone", "Own Android, data, camera", "A shared family phone, or a basic one"],
  ["Reading", "Reads English", "Reads digits and colours, not words"],
  ["Language", "Kannada", "Kannada, Tamil, Telugu or Bengali, spoken more than read"],
  ["Hands", "Free", "Gloved, wet, holding a bin"],
  ["Light and noise", "Indoors", "Direct sun, traffic, monsoon"],
];

const shot = (base: string, file: string, alt: string) => phone(mediaTag(base, `navu-kavacha/${file}`, alt));

function overview(base: string) {
  return `<section class="story__sec story__x" aria-labelledby="st-overview">
    ${head(
      1,
      "Overview",
      "Two touches, <em>one shared record.</em>",
      "{Restaurant wet waste in Bengaluru changes hands every morning with nothing written down. }Navu Kavacha turns each hand-off into a record the kitchen and the collector both hold. I reframed the brief, designed both apps and built a presenter that plays twelve flows{ on three phones at once}.",
      "st-overview",
      tldrInline(),
    )}
    ${stats([
      ["2", "touches on the collector's phone for a clean handover"],
      ["3", "phones per handover: collector, kitchen, WhatsApp"],
      ["57", "steps across twelve flows, exceptions included"],
      ["0", "star ratings on a person"],
    ])}
    ${frame(
      { tone: "grey", cls: "fr--hero fr--nk fr--clip", crumb: "Presenter / The handover", cap: "Lakshmi's phone in Kannada, Priya's restaurant app, and the WhatsApp her helper gets. Six steps, one record.", tag: "Video" },
      clip(base, "navu-kavacha/clip-handover", "The presenter playing the handover: the collector's day, the route, scanning the bin, the check with clean preselected, then the receipt landing on the restaurant phone and in WhatsApp", "clip--flat"),
    )}
  </section>`;
}

function reframe(base: string) {
  const parties = CHAIN.map(([p], i) => `<li><button type="button" data-party="${i}" aria-pressed="${i === 1}" data-cursor="hide">${esc(p)}</button></li>`).join("");
  return `<section class="story__sec story__x" aria-labelledby="st-reframe">
    ${head(
      2,
      "Reframe",
      "The problem was trust, <em>not scheduling.</em>",
      "The brief said pickups were unpredictable. Desk research said something sharper: the waste passes through five hands with no shared record, so when a bin arrives mixed, everyone can blame the one before. {The restaurant carries the legal risk and the collector carries the work, and neither can prove anything.}",
      "st-reframe",
    )}
    <div class="bento">
      ${frame(
        { tone: "grey", cls: "b-full fr--nk fr--chain", crumb: "Research / Chain of custody", cap: "Pick a party: what it carries, what it wants, and what it is missing. All five lack the same thing.", tag: "Live" },
        `<div class="chain" data-chain>
          <ol class="chain__row">${parties}</ol>
          <dl class="chain__card" aria-live="polite">
            <div><dt>Carries</dt><dd data-chain-carries>${esc(CHAIN[1][1])}</dd></div>
            <div><dt>Wants</dt><dd data-chain-wants>${esc(CHAIN[1][2])}</dd></div>
            <div class="chain__lacks"><dt>Lacks</dt><dd data-chain-lacks>${esc(CHAIN[1][3])}</dd></div>
          </dl>
        </div>`,
      )}
      ${frame({ tone: "grey", cls: "b-half fr--nk fr--v0", crumb: "First concept / Restaurant home", cap: "The first concept sold predictable slots and showed the collector with a ★4.9." }, mediaTag(base, "navu-kavacha/v0-home", "The first prototype's restaurant home: Ravi is your collector today, rated 4.9 stars"))}
      ${frame(
        { tone: "ink", cls: "b-half fr--nkink fr--thesis", crumb: "Strategy / The reframe" },
        `<blockquote class="thesis"><p>The handover is the product.</p><footer>One record, two signatures. Dignity comes from the collector owning that record, not from a score.</footer></blockquote>`,
      )}
    </div>
  </section>`;
}

function users(base: string) {
  const rows = SPECTRUM.map(([a, e, h]) => `<tr><th scope="row">${esc(a)}</th><td>${esc(e)}</td><td>${esc(h)}</td></tr>`).join("");
  return `<section class="story__sec story__x" aria-labelledby="st-users">
    ${head(
      3,
      "Users",
      "Designed for <em>the hard end.</em>",
      "Most waste workers are women, some read digits but not words, and many share or borrow a phone. I designed for that end of the spectrum{, because if it works for Lakshmamma, it works for everyone}. Every persona here is an inference from desk research, and each carries the question that would prove it wrong.",
      "st-users",
    )}
    <div class="bento">
      ${frame(
        { tone: "grey", cls: "b-full fr--nk fr--spec", crumb: "Personas / A spectrum, not a hero" },
        `<table class="spec-t"><thead><tr><th scope="col"><span class="sr-only">Axis</span></th><th scope="col">Easy end</th><th scope="col">Design for this end</th></tr></thead><tbody>${rows}</tbody></table>
        <p class="spec-t__q"><b>Falsifying question.</b> On a two-hour ride-along, how many times does she read text, and how many times does she only look?</p>`,
      )}
      ${frame({ tone: "grey", cls: "b-4 fr--nk fr--ph", crumb: "Onboarding / Language", cap: "Voice first: each language says its own name aloud." }, shot(base, "c-language", "Collector onboarding in Kannada: pick a language, Kannada, Tamil or English, each with a listen button"))}
      ${frame({ tone: "grey", cls: "b-4 fr--nk fr--ph", crumb: "Team phone", cap: "One shared phone for a crew: tap your face, not a password." }, shot(base, "c-team", "The team phone asking who is working today, with two collectors to pick from"))}
      ${frame({ tone: "grey", cls: "b-4 fr--nk fr--ph", crumb: "Collector / Today", cap: "Numbers, colours and one big button carry the morning." }, shot(base, "c-home", "The collector's home in Kannada: stops and pay for today, the next stop at 9:00 AM with wet and dry bins, and a start route button"))}
    </div>
  </section>`;
}

function handover(base: string) {
  return `<section class="story__sec story__x" aria-labelledby="st-handover">
    ${head(
      4,
      "Handover",
      "Two touches. <em>No reading needed.</em>",
      "Scan the sticker on the bin and the check opens with clean already chosen, so a clean handover is the second touch. {Icons, colours and numbers carry the meaning, and the screen's colours match the physical bins. }The kitchen gets its receipt the same second.",
      "st-handover",
    )}
    <div class="bento">
      ${frame(
        { tone: "grey", cls: "b-full fr--nk fr--ho", crumb: "One handover, three phones", cap: "Switch the language, then hand over the bin. Mark it mixed to see the photo step and the flag.", tag: "Live" },
        `<div class="ho" data-ho>
          <div class="ho__bar">
            <div class="nk-seg" role="group" aria-label="Collector language">${[["en", "English"], ["kn", "ಕನ್ನಡ"], ["ta", "தமிழ்"]].map(([k, l], i) => `<button type="button" data-lang="${k}" aria-pressed="${i === 1}" data-cursor="hide">${l}</button>`).join("")}</div>
            <p class="ho__touches"><b data-ho-touches>0</b> touches</p>
            <button type="button" class="ho__reset" data-ho-reset data-cursor="hide">Start over</button>
          </div>
          <div class="ho__stage">
            <div class="ho__phone ho__phone--c"><p class="ho__who">Lakshmi's phone</p><div class="ho__screen" data-ho-screen lang="kn"></div></div>
            <div class="ho__phone ho__phone--r"><p class="ho__who">Dosa Corner, Priya</p><div class="ho__screen ho__screen--r" data-ho-receipt></div></div>
            <div class="ho__phone ho__phone--w"><p class="ho__who">Manjunath on WhatsApp</p><div class="ho__screen ho__screen--w" data-ho-wa></div></div>
          </div>
        </div>`,
      )}
      ${frame({ tone: "grey", cls: "b-4 fr--nk fr--ph", crumb: "Collector / Route", cap: "Times, stream colours and one open stop. Nothing to read twice." }, shot(base, "c-route", "The route in Kannada: eight stops in slot order with times and wet and dry colour chips, the next one open"))}
      ${frame({ tone: "grey", cls: "b-4 fr--nk fr--ph", crumb: "Collector / Scan", cap: "Scanning the sticker is arrival, identity and stream in one touch." }, shot(base, "c-scan", "The scan screen: a viewfinder for the bin sticker, the expected bin below, and a no-sticker fallback"))}
      ${frame({ tone: "grey", cls: "b-4 fr--nk fr--ph", crumb: "Kitchen / Receipt", cap: "Priya sees time, bin, an estimated weight, and the word clean." }, shot(base, "r-receipt", "The restaurant's pickup receipt: today 9:03 AM, medium bin, about 14 kg estimated, collected and clean"))}
    </div>
  </section>`;
}

function exceptions(base: string) {
  return `<section class="story__sec story__x" aria-labelledby="st-exceptions">
    ${head(
      5,
      "Exceptions",
      "Exceptions are <em>main flows.</em>",
      "A mixed bin gets a photo and a flag, never a penalty: the collector is paid either way. The kitchen sees the photo and can dispute the mark{, and a person who speaks the collector's language decides}. A locked gate costs the kitchen its pickup, not the collector her time.",
      "st-exceptions",
    )}
    <div class="bento">
      ${frame({ tone: "grey", cls: "b-8 fr--nk fr--clip", crumb: "Presenter / Mixed waste and a dispute", cap: "A flag with a photo, a kitchen that disagrees, and a person who decides.", tag: "Video" }, clip(base, "navu-kavacha/clip-mixed", "The mixed waste flow: the collector marks mixed and takes a photo, the flag reaches Paratha Plaza, the owner disputes it and the outcome reaches both", "clip--flat"))}
      ${frame({ tone: "grey", cls: "b-4 fr--nk fr--ph", crumb: "Kitchen / The flag", cap: "The photo, the reason, and 24 hours to accept or say it is wrong." }, shot(base, "r-flag", "The restaurant receipt with a mixed waste flag, the collector's photo, and Accept or This is wrong buttons"))}
      ${frame(
        { tone: "grey", cls: "b-8 fr--nk fr--wait", crumb: "Collector / Bin not ready", cap: "Start the wait. One second here is one minute there; at ten, the fee is hers.", tag: "Live" },
        `<div class="wt" data-wait>
          <div class="wt__card">
            <p class="wt__stop"><b>Meghana Biryani</b><span>9:20 AM</span></p>
            <div class="wt__ring" style="--p:0"><b data-wait-min>0</b><span>min</span></div>
            <p class="wt__fee" data-wait-fee>The ₹20 wait fee is due after 10 minutes.</p>
            <div class="wt__acts">
              <button type="button" class="nk-btn nk-btn--c" data-wait-go data-cursor="hide">Start waiting</button>
              <button type="button" class="nk-btn nk-btn--ghost" data-wait-miss data-cursor="hide" disabled>Mark missed</button>
            </div>
          </div>
          <div class="wt__out" data-wait-out aria-live="polite"></div>
        </div>`,
      )}
      ${frame({ tone: "grey", cls: "b-4 fr--nk fr--clip", crumb: "Presenter / Bin not ready", cap: "The real timer at eleven minutes: the fee is already in her pay.", tag: "Video" }, clip(base, "navu-kavacha/clip-wait", "The bin not ready flow: arriving at Meghana Biryani, the wait timer passing ten minutes with the fee earned, then the day's pay", "clip--flat"))}
    </div>
  </section>`;
}

function recognition(base: string) {
  return `<section class="story__sec story__x" aria-labelledby="st-recognition">
    ${head(
      6,
      "Recognition",
      "Recognition, <em>not rating.</em>",
      "The first concept rated collectors out of five and gave kitchens a dignity score of 4.6 with no formula behind it. I removed both. {Being on time is computed from the timestamp, and problems are factual flags anyone can dispute. }Thanks are optional, positive only, and heard in the collector's own language.",
      "st-recognition",
    )}
    <div class="bento">
      ${frame({ tone: "grey", cls: "b-4 fr--nk fr--v0", crumb: "First concept", cap: "A dignity score of 4.6, with no formula and no way for a collector to answer it.", tag: "Removed" }, mediaTag(base, "navu-kavacha/v0-dignity", "The first prototype's dignity summary: a weekly score of 4.6 built from collector reviews"))}
      ${frame({ tone: "grey", cls: "b-4 fr--nk fr--ph", crumb: "Kitchen / Say thanks", cap: "Preset phrases, translated, played to her as voice. Never a number." }, shot(base, "r-thanks", "Thank Lakshmi: optional preset phrases like thank you for coming on time, sent in her language"))}
      ${frame(
        { tone: "grey", cls: "b-4 fr--nk fr--cut", crumb: "What replaced ratings" },
        `<ol class="nk-cut">
          <li><b>On time</b><span>Computed from the timestamp. Nobody's opinion.</span></li>
          <li><b>Problems</b><span>Factual flags: late beyond the window, spillage, behaviour. Each can be disputed.</span></li>
          <li><b>Thanks</b><span>Optional and positive only.</span></li>
          <li><b>Kitchens</b><span>A share of clean handovers and an open-flags count, never an average.</span></li>
        </ol>`,
      )}
    </div>
  </section>`;
}

function passbook(base: string) {
  return `<section class="story__sec story__x" aria-labelledby="st-passbook">
    ${head(
      7,
      "Passbook",
      "A work history <em>she owns.</em>",
      "Each handover lands in a passbook the collector keeps: days worked, stops, kilos, pay. She can share a verified extract for an ID card, a welfare scheme or a loan{, and an inspector can check a kitchen's month by scanning one code}.",
      "st-passbook",
    )}
    <div class="bento">
      ${frame({ tone: "grey", cls: "b-4 fr--nk fr--ph", crumb: "Collector / Passbook", cap: "Her record, under her name, from her first day." }, shot(base, "c-passbook", "Lakshmamma's work passbook: her ID number, the month's days worked, stops and kilos"))}
      ${frame({ tone: "ink", cls: "b-4 fr--nkink fr--ph", crumb: "Collector / Extract", cap: "She picks what to share and who sees it." }, shot(base, "c-extract", "Sharing a verified extract of the passbook: choose the purpose and what to include"))}
      ${frame({ tone: "grey", cls: "b-4 fr--nk fr--ph", crumb: "Inspector / Verify", cap: "The inspector scans and sees the record match." }, shot(base, "i-verify", "The inspector's verify view: record verified, matching the kitchen's copy, with its licence details and month totals"))}
    </div>
  </section>`;
}

function kitchen(base: string) {
  return `<section class="story__sec story__x" aria-labelledby="st-kitchen">
    ${head(
      8,
      "Kitchen",
      "Owners get receipts. <em>Helpers get pings.</em>",
      "The owner is rarely at the back door at nine, so the restaurant side stays calm: a receipt after each pickup, a WhatsApp for the helper, and a month record ready for an inspector. {Setting up a new kitchen takes six short steps, from licence numbers to a colour-coded bin kit.}",
      "st-kitchen",
    )}
    <div class="bento">
      ${frame({ tone: "grey", cls: "b-4 fr--nk fr--ph", crumb: "Setup / Your waste", cap: "Streams in the colours of the bins they arrive in." }, shot(base, "r-streams", "Kitchen setup: pick the waste your kitchen makes, wet in green, dry in blue, sanitary in red, special care in purple"))}
      ${frame({ tone: "grey", cls: "b-4 fr--nk fr--ph", crumb: "Helper / WhatsApp", cap: "No app to install for the person at the back door." }, shot(base, "w-whatsapp", "WhatsApp messages from Navu Kavacha to the kitchen helper in Kannada, one per pickup"))}
      ${frame({ tone: "grey", cls: "b-4 fr--nk fr--ph", crumb: "Owner / The month", cap: "28 of 30 days, the kilos, and every flag with how it ended." }, shot(base, "r-month", "The restaurant's September record: 28 of 30 days collected, missed and flagged days, and kilos weighed at the processor"))}
    </div>
  </section>`;
}

function outcome() {
  return `<section class="story__sec story__x" aria-labelledby="st-outcome">
    ${head(
      9,
      "Outcome",
      "Built to be proven wrong, <em>cheaply.</em>",
      "Nothing here has met a real collector yet. The next step is a two-hour ride-along and five kitchen interviews, each aimed at the assumption that would sink the idea{: if owners say nobody ever asks for proof, the restaurant side shrinks to almost nothing}.",
      "st-outcome",
    )}
    ${results(
      [
        { n: "12", title: "Flows in the presenter", kind: "Built, 57 steps verified", text: "The handover, disputes, waits, hazards, a substitute collector, the passbook and inspection{ all play on the phones that take part}.", bars: [] },
        { n: "3", title: "Languages on the collector side", kind: "Kannada and Tamil drafted, in review", text: "Key lines on the collector side can be heard aloud{, and the machine-drafted translations are listed for a native reviewer}.", bars: [] },
        { n: "0", title: "Ratings of people", kind: "Design rule", text: "Facts, flags and optional thanks replace stars{, so no average can quietly push anyone out of work}.", bars: [] },
      ],
      "Semester project at IIIT Jabalpur, 2026. Strategy, design and the front end are mine.",
    )}
  </section>`;
}

/** Story entry point, picked up by templates/case.ts through import.meta.glob */
export function story(base: string, _p: Project) {
  return storyRoot("navu-kavacha", [overview(base), reframe(base), users(base), handover(base), exceptions(base), recognition(base), passbook(base), kitchen(base), outcome()].join(""));
}
