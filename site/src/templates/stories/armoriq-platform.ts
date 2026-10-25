import type { Project } from "../../content";
import { esc, mediaTag } from "../../lib/html";
import { browser, clip, frame, head, results, stats, storyRoot, tldrInline, zoomed } from "./kit";

/**
 * ArmorIQ platform v2 console. Captures come from the repo's own playground screens and the standalone graph
 * prototype, all on dummy data, so no org's data reaches the page. The live pieces port the shipped behaviour: the
 * policy lens model (one EditorState, three projections), the persona lens table (roleviews/state.tsx) and the
 * hold-to-kill switch (shared/ui/AgentKillSwitch).
 */

const APP = "ArmorIQ console";

/* The policy every lens projects. Actions are the product's own: allow, hold for a person, block. */
export const TOOLS: [string, "allow" | "hold" | "block"][] = [
  ["search_claims", "allow"],
  ["read_policy_doc", "allow"],
  ["update_claim", "hold"],
  ["issue_refund", "hold"],
  ["delete_record", "block"],
];

/* roleviews/state.tsx: eight personas, each with a lens, a scope, a density and the one question it brings */
export const PERSONAS = [
  { key: "ciso", label: "CISO", lens: "security", scope: "All", density: "Executive", q: "Are we exposed, and is it getting better?" },
  { key: "analyst", label: "Security analyst", lens: "security", scope: "Mine", density: "Operational", q: "What happened, and what do I do about it?" },
  { key: "iam", label: "IAM admin", lens: "grc", scope: "All", density: "Operational", q: "Who and what can reach what?" },
  { key: "aio", label: "AI officer", lens: "grc", scope: "All", density: "Executive", q: "What AI do we run, who owns it, what is its risk class?" },
  { key: "dev", label: "Agent developer", lens: "ai", scope: "Mine", density: "Operational", q: "Why did my agent get blocked?" },
  { key: "mcp", label: "MCP deployer", lens: "ai", scope: "Mine", density: "Operational", q: "Is my server registered, scanned and trusted?" },
  { key: "grc", label: "GRC officer", lens: "grc", scope: "All", density: "Operational", q: "Can I prove the control operated?" },
  { key: "padmin", label: "Policy admin", lens: "grc", scope: "All", density: "Operational", q: "Is the right policy on the right thing?" },
] as const;

/* roleviews/state.tsx LENS_RAIL: primary above the hairline, secondary below. The lens reorders, it never removes. */
export const LENS_RAIL = {
  security: { primary: ["overview", "plans", "activity", "observability", "graph"], secondary: ["inventory", "policies", "api", "team", "settings"] },
  ai: { primary: ["inventory", "observability", "graph", "api"], secondary: ["overview", "plans", "policies", "activity", "team", "settings"] },
  grc: { primary: ["overview", "policies", "activity", "plans"], secondary: ["inventory", "graph", "observability", "api", "team", "settings"] },
} as const;

const RAIL: Record<string, [string, string]> = {
  overview: ["Overview", `<rect x="4" y="4" width="7" height="7" rx="1.5"/><rect x="13" y="4" width="7" height="7" rx="1.5"/><rect x="4" y="13" width="7" height="7" rx="1.5"/><rect x="13" y="13" width="7" height="7" rx="1.5"/>`],
  plans: ["Intent", `<rect x="5" y="4" width="14" height="17" rx="2"/><path d="M9 4h6v3H9zM9 13l2 2 4-4"/>`],
  activity: ["Activity", `<path d="M3 12h4l3-7 4 14 3-7h4"/>`],
  observability: ["Observability", `<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="3.5"/><path d="M12 12l5-5"/>`],
  graph: ["Graph", `<circle cx="6" cy="6" r="2.5"/><circle cx="18" cy="8" r="2.5"/><circle cx="10" cy="18" r="2.5"/><path d="M8 7l8 1M7 8l2 8M12 17l5-7"/>`],
  inventory: ["Inventory", `<path d="M4 8l8-4 8 4v9l-8 4-8-4z"/><path d="M4 8l8 4 8-4M12 12v9"/>`],
  policies: ["Policies", `<path d="M12 3l7 3v6c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6z"/>`],
  api: ["API", `<path d="M9 7l-5 5 5 5M15 7l5 5-5 5"/>`],
  team: ["Team", `<circle cx="9" cy="9" r="3"/><circle cx="17" cy="10" r="2.5"/><path d="M3.5 19c.8-3 3-4.5 5.5-4.5s4.7 1.5 5.5 4.5M15 15c2.5 0 4.6 1.3 5.4 4"/>`],
  settings: ["Settings", `<circle cx="12" cy="12" r="3"/><path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M5.6 18.4l2.1-2.1M16.3 7.7l2.1-2.1"/>`],
};
const icon = (paths: string) => `<svg viewBox="0 0 24 24" aria-hidden="true">${paths}</svg>`;
const ACTIONS = ["allow", "hold", "block"] as const;
const LABEL = { allow: "Allow", hold: "Hold", block: "Block" };

function overview(base: string) {
  return `<section class="story__sec story__x" aria-labelledby="st-overview">
    ${head(
      1,
      "Overview",
      "AI agents now act. <em>Someone has to say no.</em>",
      "{AI agents now call real tools: they issue refunds, read patient records, push code. }ArmorIQ decides what each agent may do, holds risky calls for a person and explains every decision. I designed the v2 console and wrote most of its front end{, alongside six engineers}.",
      "st-overview",
      tldrInline(),
    )}
    ${stats([
      ["5 → 1", "ways to write a policy, all opening the same draft"],
      ["8", "roles on one product: the lens reorders, it never removes"],
      ["1.5 s", "held press to stop a live agent, no modal in the way"],
      ["3", "graph states designed before the happy path: full, sparse, empty"],
    ])}
    ${frame(
      { tone: "grey", cls: "fr--hero fr--aq", crumb: "Console / Operate", cap: "The analyst's landing page: what is waiting on you first, posture second. Scroll to pull back." , attrs: "data-zoom" },
      browser(zoomed(base, "armoriq-platform/overview", "ArmorIQ console overview: three plans awaiting review, four KPI tiles, policy decisions chart and open findings"), APP),
    )}
  </section>`;
}

/* v1's seven authoring surfaces and where each one went in v2 */
const DOORS: [string, string, string][] = [
  ["Policy Studio", "form", "Became the Form lens."],
  ["Bundle Studio", "template", "Bundles became templates that open as a draft."],
  ["Canvas builder", "canvas", "Became the Canvas lens over the same draft."],
  ["Raw YAML import", "yaml", "Became the YAML lens, editable and live."],
  ["Health studio", "next", "Still its own route. Folding in next."],
  ["Finance studio", "next", "Still its own route. Folding in next."],
  ["Education studio", "next", "Still its own route. Folding in next."],
];
const INPUTS: [string, string][] = [["ai", "AI chat"], ["template", "Template"], ["form", "Form"], ["canvas", "Canvas"], ["yaml", "YAML"]];

function problem(base: string) {
  const doors = DOORS.map(([d, to, note], i) => `<li><button type="button" class="doors__v1" data-door="${to}" data-note="${esc(note)}" data-cursor="hide" style="--i:${i}">${esc(d)}</button></li>`).join("");
  const ins = INPUTS.map(([k, l]) => `<li class="doors__in" data-in="${k}">${l}</li>`).join("");
  return `<section class="story__sec story__x" aria-labelledby="st-problem">
    ${head(
      2,
      "Problem",
      "Seven doors <em>to one policy.</em>",
      "The first console grew a new screen for every new need, until there were seven ways to write a policy. {Each saved drafts differently, and }Deploy meant two opposite things depending on which screen you pressed it on.",
      "st-problem",
    )}
    <div class="bento">
      ${frame(
        { tone: "grey", cls: "b-full fr--aq fr--doors", crumb: "IA / Before and after", cap: "Point at a v1 door to see where it went. Three vertical studios are still separate; they fold in next.", tag: "Live" },
        `<div class="doors" data-doors>
          <div class="doors__col"><p class="aq-eyebrow">v1 · seven places</p><ol class="doors__list">${doors}</ol></div>
          <div class="doors__col doors__col--v2"><p class="aq-eyebrow">v2 · one draft</p>
            <ol class="doors__ins">${ins}</ol>
            <ol class="doors__life"><li class="doors__draft">Draft</li><li>Review</li><li class="doors__split"><span>Save draft</span><span>Activate</span></li></ol>
            <p class="doors__note" data-doors-note aria-live="polite">All five ways in land on the same draft and the same review.</p>
          </div>
        </div>`,
      )}
      ${frame({ tone: "grey", cls: "b-7 fr--aq", crumb: "v1 / Policy builder", cap: "One of the seven: a section list inside the sidebar, a form, and a YAML panel whose Refresh wiped hand edits." }, mediaTag(base, "armoriq-platform/v1-builder", "The v1 policy builder: a long app sidebar, a nested list of nine policy sections, a metadata form and a live YAML panel"))}
      ${frame(
        { tone: "grey", cls: "b-5 fr--aq fr--cut", crumb: "v1 / One word, two outcomes" },
        `<ol class="cut cut--stack">
          <li><b>Apply, on a template.</b><span>Switched off the policies already active, then turned the template on.</span></li>
          <li><b>Deploy, in the studio.</b><span>Imported at whatever status the draft had, so it could quietly not enforce.</span></li>
          <li><b>In v2.</b><span>Save draft never enforces. Activate always does, after you confirm you read it.</span></li>
        </ol>`,
      )}
    </div>
  </section>`;
}

function studio() {
  const rows = TOOLS.map(
    ([t, a]) => `<div class="lf__row" data-tool="${t}"><code>${t}</code><div class="aq-seg" role="group" aria-label="${t}">${ACTIONS.map((x) => `<button type="button" data-act="${x}" aria-pressed="${x === a}" data-cursor="hide">${LABEL[x]}</button>`).join("")}</div></div>`,
  ).join("");
  return `<section class="story__sec story__x" aria-labelledby="st-studio">
    ${head(
      3,
      "Policy studio",
      "One draft, <em>every lens.</em>",
      "Form, YAML and canvas are three views of the same draft, so they cannot disagree. {Type in the YAML and the form changes as you type: there is no sync banner, because there is no second copy to fall out of sync. }Nothing enforces until you activate it{, and activating asks you to confirm you read the policy}.",
      "st-studio",
    )}
    <div class="bento">
      ${frame(
        { tone: "grey", cls: "b-full fr--aq fr--lens", crumb: "Policies / Studio", cap: "Change an action in any lens, then switch lenses. Save draft never enforces; Activate always does.", tag: "Live" },
        `<div class="lens" data-lens>
          <div class="lens__bar">
            <div class="lens__name"><code>claims-triage-guardrails</code><span class="aq-chip" data-lens-status>Draft</span></div>
            <div class="aq-seg aq-seg--lens" role="tablist" aria-label="Lens">${["Form", "YAML", "Canvas"].map((l, i) => `<button type="button" role="tab" data-lens-to="${l.toLowerCase()}" aria-selected="${i === 0}" data-cursor="hide">${l}</button>`).join("")}</div>
          </div>
          <div class="lens__body">
            <div class="lens__view lens__view--form is-on" data-view="form">
              <p class="aq-eyebrow">Target · agent <code>claims-triage-bot</code></p>
              <div class="lf">${rows}</div>
              <div class="lf__row lf__row--default"><span>Any other tool</span><span class="aq-chip aq-chip--bad">Block</span></div>
            </div>
            <div class="lens__view lens__view--yaml" data-view="yaml">
              <textarea class="lens__yaml" data-yaml spellcheck="false" aria-label="Policy YAML" data-cursor="hide"></textarea>
              <p class="lens__hint" data-yaml-hint>Edit an action to allow, hold or block. The form follows as you type.</p>
            </div>
            <div class="lens__view lens__view--canvas" data-view="canvas"><svg class="lens__svg" data-canvas viewBox="0 0 640 300" role="img" aria-label="Policy canvas: the agent on the left, each tool on the right, edges coloured by action"></svg><p class="lens__hint">Click a tool to cycle its action.</p></div>
          </div>
          <div class="lens__foot">
            <button type="button" class="aq-btn aq-btn--ghost" data-save data-cursor="hide">Save draft</button>
            <label class="lens__ack"><input type="checkbox" data-ack> I have read this policy</label>
            <button type="button" class="aq-btn aq-btn--accent" data-activate disabled data-cursor="hide">Activate</button>
          </div>
        </div>`,
      )}
    </div>
  </section>`;
}

function personas(base: string) {
  const chips = PERSONAS.map((p, i) => `<button type="button" data-persona="${p.key}" aria-pressed="${i === 1}" data-cursor="hide">${p.label}</button>`).join("");
  const rail = Object.entries(RAIL)
    .map(([k, [l, d]]) => `<li data-rail="${k}">${icon(d)}<span>${l}</span>${k === "plans" ? `<b class="rail__badge">7</b>` : ""}</li>`)
    .join("");
  return `<section class="story__sec story__x" aria-labelledby="st-personas">
    ${head(
      4,
      "Roles",
      "Eight roles, <em>one product.</em>",
      "Our CTO asked for three separate views for nine personas. I split the ask: different people need different starting points, not different products. {A lens decides what comes first on the rail and the landing page, scope narrows every list to mine or all, and density switches between executive and operational. }The lens reorders. It never removes.",
      "st-personas",
    )}
    <div class="bento">
      ${frame(
        { tone: "grey", cls: "b-full fr--aq fr--persona", crumb: "Shell / Persona lens", cap: "Pick a role. The rail reorders around its question; nothing it may see ever disappears.", tag: "Live" },
        `<div class="plens" data-pl>
          <ol class="plens__rail" data-pl-rail aria-label="Navigation rail">${rail}</ol>
          <div class="plens__main">
            <div class="plens__chips" role="group" aria-label="Role">${chips}</div>
            <p class="plens__q" data-pl-q aria-live="polite">What happened, and what do I do about it?</p>
            <dl class="plens__meta"><div><dt>Lens</dt><dd data-pl-lens>Security</dd></div><div><dt>Scope</dt><dd data-pl-scope>Mine</dd></div><div><dt>Density</dt><dd data-pl-density>Operational</dd></div><div><dt>Lands on</dt><dd data-pl-land>Overview</dd></div></dl>
          </div>
        </div>`,
      )}
      ${frame({ tone: "grey", cls: "b-full fr--aq fr--clip", crumb: "Prototype / Role switch", cap: "The prototype on dummy data: each role lands on its own first page, built from the same objects.", tag: "Video" }, clip(base, "armoriq-platform/clip-persona", "Switching roles in the prototype: Operate for the analyst, Security posture for the CISO, Agents for the developer, Govern for GRC", "clip--flat"))}
    </div>
  </section>`;
}

function kill(base: string) {
  const durs = [["60", "1 min"], ["300", "5 min"], ["1800", "30 min"], ["3600", "1 hour"], ["inf", "Until lifted"]];
  return `<section class="story__sec story__x" aria-labelledby="st-kill">
    ${head(
      5,
      "Kill switch",
      "Stopping an agent <em>takes a held breath.</em>",
      "A kill blocks every tool call an agent makes, so it must never fire by accident and never wait behind a modal. Hold the button for a second and a half; let go early and nothing happens. {Until lifted takes 1.75 times longer to hold, so the friction grows with the consequence.}",
      "st-kill",
    )}
    <div class="bento">
      ${frame(
        { tone: "ink", cls: "b-full fr--aqink fr--kill", crumb: "Agents / Header", cap: "Open the kill switch and hold. Release early, or switch windows, and the hold cancels.", tag: "Live" },
        `<div class="ks" data-ks>
          <div class="ks__card">
            <div class="ks__top">
              <span class="ks__ico">${icon(`<rect x="5" y="8" width="14" height="10" rx="3"/><path d="M12 8V5M9 13h.01M15 13h.01"/>`)}</span>
              <div class="ks__id"><p><code>claims-triage-bot</code><span class="aq-chip aq-chip--good" data-ks-chip>Verified</span></p><p class="ks__sub">a91f30c2 · v2.4.1 · MCP · Operations</p></div>
              <button type="button" class="ks__trigger" data-ks-open aria-expanded="true" data-cursor="hide">${icon(`<path d="M13 3L5 13h6l-1 8 8-10h-6z"/>`)}Kill switch</button>
            </div>
            <div class="ks__banner" data-ks-banner hidden><p><b>Agent killed</b><span data-ks-left></span></p><p class="ks__why">Every tool call from this agent is blocked at verification.</p><button type="button" class="aq-btn aq-btn--ghost" data-ks-lift data-cursor="hide">Lift kill</button></div>
            <div class="ks__pop" data-ks-pop>
              <p class="aq-eyebrow">Duration</p>
              <div class="aq-seg aq-seg--dur" role="group" aria-label="Duration">${durs.map(([k, l]) => `<button type="button" data-dur="${k}" aria-pressed="${k === "300"}" data-cursor="hide">${l}</button>`).join("")}</div>
              <button type="button" class="ks__hold" data-ks-hold data-cursor="hide"><i data-ks-fill aria-hidden="true"></i><span data-ks-label>Hold to kill for 5 min</span></button>
              <p class="ks__note">Release early to cancel. Until lifted takes a longer hold.</p>
            </div>
          </div>
        </div>`,
      )}
      ${frame({ tone: "grey", cls: "b-7 fr--aq fr--clip", crumb: "Prototype / Hold to kill", cap: "The real control: a short hold that cancels, then a full one. The banner and the registry row both turn.", tag: "Video" }, clip(base, "armoriq-platform/clip-kill", "Opening the kill switch, releasing a hold early, then holding through to kill: the agent banner and the registry row change to Killed", "clip--flat"))}
      ${frame({ tone: "grey", cls: "b-5 fr--aq", crumb: "Concepts / Intent presets", cap: "One of five concepts tried side by side: name the intent, not a number of minutes." }, mediaTag(base, "armoriq-platform/kill-intent", "Kill switch concept with three intent presets: Pause for 1 minute, Triage for 30 minutes, Contain until lifted, and a Hold to triage button"))}
    </div>
  </section>`;
}

function setup(base: string) {
  return `<section class="story__sec story__x" aria-labelledby="st-setup">
    ${head(
      6,
      "Setup",
      "See the agent <em>before it exists.</em>",
      "Adding an agent is a short wizard with a preview on the right that fills in as you answer. {The card and its buttons stay still while the steps change, so moving forward reads as movement and not as a new page.}",
      "st-setup",
    )}
    <div class="bento">
      ${frame({ tone: "grey", cls: "b-full fr--aq fr--clip", crumb: "Agents / Add agent", cap: "Pick how the agent is reached, name it, and watch the preview card take the name.", tag: "Video" }, clip(base, "armoriq-platform/clip-wizard", "The Add Agent wizard: choosing Connect by URL, typing the agent name, the preview rail updating, then the Connect step", "clip--flat"))}
      ${frame(
        { tone: "grey", cls: "b-full fr--aq fr--cut", crumb: "Wizards / What I removed" },
        `<ol class="cut">
          <li><b>A moving button.</b><span>Continue jumped with each step's height. It sits still now.</span></li>
          <li><b>A whole step.</b><span>Adding an MCP server had a Scan step. The scan runs in the background instead.</span></li>
          <li><b>A second shell.</b><span>Agents and MCP servers had two different wizards. They share one now.</span></li>
        </ol>`,
      )}
    </div>
  </section>`;
}

function peek(base: string) {
  return `<section class="story__sec story__x" aria-labelledby="st-peek">
    ${head(
      7,
      "Detail",
      "A peek answers <em>one question.</em>",
      "Clicking a row opens a side peek, not a new page, and each peek leads with the one thing you came for: is this agent connected, is this server safe. {Editing or deleting means committing, so that opens the full page.}",
      "st-peek",
    )}
    <div class="bento">
      ${frame({ tone: "grey", cls: "b-half fr--aq", crumb: "Agents / Peek", cap: "Never connected: the verdict comes first, the numbers after." }, mediaTag(base, "armoriq-platform/agent-peek", "Agent side peek: a Never connected warning with a Resend enrolment action, then decisions and open vulnerabilities"))}
      ${frame({ tone: "grey", cls: "b-half fr--aq", crumb: "MCP servers / Peek", cap: "Two critical findings lead, with the one action that clears them." }, mediaTag(base, "armoriq-platform/mcp-peek", "MCP server side peek: two critical findings with Review findings, rescan, open vulnerabilities, calls, a severity bar and the top findings"))}
      ${frame({ tone: "grey", cls: "b-full fr--aq", crumb: "Certificates / Fleet", cap: "Lists open on what needs you: two rotations failed, two inside the alert window, one with no owner." }, mediaTag(base, "armoriq-platform/certificates", "Certificates page: three summary cards for failed rotations, alert windows and missing owners above a fleet table of MCP server certificates"))}
    </div>
  </section>`;
}

function graph(base: string) {
  return `<section class="story__sec story__x" aria-labelledby="st-graph">
    ${head(
      8,
      "Graph",
      "A map for questions <em>a table cannot ask.</em>",
      "The graph shows every agent, server, tool and policy in an org and what governs what. I designed the sparse and empty states before the full one{, because most orgs start with one agent and no topology at all}.",
      "st-graph",
    )}
    <div class="bento">
      ${frame({ tone: "grey", cls: "b-full fr--aq fr--clip", crumb: "Graph / Estates", cap: "Full, sparse, empty, back to full, then Live: the same canvas at every size of org.", tag: "Video" }, clip(base, "armoriq-platform/clip-graph", "The AIQ Graph switching between a full estate, a sparse one and an empty one, then into Live mode", "clip--flat"))}
      ${frame({ tone: "grey", cls: "b-half fr--aq", crumb: "Graph / Sparse", cap: "Three nodes still read as a map, not a broken chart." }, mediaTag(base, "armoriq-platform/graph-sparse", "The graph with a sparse estate: one agent, one server and one policy"))}
      ${frame({ tone: "grey", cls: "b-half fr--aq", crumb: "Graph / Empty", cap: "Empty says what will appear and offers the first step." }, mediaTag(base, "armoriq-platform/graph-empty", "The graph's empty state: No topology yet, with actions to run discovery or connect a source"))}
    </div>
  </section>`;
}

function outcome() {
  return `<section class="story__sec story__x" aria-labelledby="st-outcome">
    ${head(
      9,
      "Outcome",
      "A new console <em>on the same backend.</em>",
      "The v2 console replaces the old front end and keeps the backend as it is{, so customers keep their agents, policies and history when it ships}.",
      "st-outcome",
    )}
    ${results(
      [
        { n: "5 → 1", title: "Ways into one draft", kind: "IA, in the product", text: "AI chat, templates, form, canvas and YAML all open the same draft{, with one review before anything enforces}.", bars: [] },
        { n: "8", title: "Roles, one product", kind: "Prototype, in research", text: "The persona lens is being tested against a control with no lens at all{, and ships only if it wins}.", bars: [] },
        { n: "30", title: "Accessibility commits in one day", kind: "Counted in git: 17 fixes, 4 features", text: "Keyboard paths through tables, tabs and search{, plus landmarks and a skip link on every page}.", bars: [] },
      ],
      "Team of seven. I led design and wrote most of the front end; the backend and the rest of the app are the team's.",
    )}
  </section>`;
}

/** Story entry point, picked up by templates/case.ts through import.meta.glob */
export function story(base: string, _p: Project) {
  return storyRoot("armoriq-platform", [overview(base), problem(base), studio(), personas(base), kill(base), setup(base), peek(base), graph(base), outcome()].join(""));
}
