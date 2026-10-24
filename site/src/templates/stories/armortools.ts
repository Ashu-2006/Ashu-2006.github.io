import type { Project } from "../../content";
import { esc, mediaTag } from "../../lib/html";
import { browser, clip, frame, head, results, stats, storyRoot, tldrInline, zoomed } from "./kit";

/**
 * ArmorTools console redesign. Captures come from the console's own DEV playgrounds on fixtures (a DEV-mode build in
 * a temp folder, no backend, no real sessions). The live pieces port the session story's three views and filters
 * (pages/sessions/story), the shadow comparison that gates a policy's promotion (playground/policies/fixtures.ts),
 * and the dark and light themes of one screen.
 */

const APP = "ArmorTools console";

/* One session in the shape of the sessions story fixtures: turns, steps, cost, time, and armor decisions on tool calls */
export type Step = { kind: "model" | "tool" | "mcp"; label: string; meta: string; cost?: number; ms: number; at: number; fail?: boolean; armor?: "allowed" | "blocked" };
export type Turn = { prompt: string; reply: string; steps: Step[] };
export const SESSION: Turn[] = [
  {
    prompt: "Research how other teams rate limit webhook retries, then propose something for ours.",
    reply: "Three sub-agents looked at Stripe, GitHub and Shopify docs. All three use exponential backoff with jitter and a cap around an hour. I drafted a proposal in docs/webhooks.md.",
    steps: [
      { kind: "model", label: "Thought", meta: "claude-sonnet-4-5 · 10.4K in → 1.9K out", cost: 0.059, ms: 3000, at: 0 },
      { kind: "mcp", label: "slack.post_message", meta: "MCP", ms: 4100, at: 3.1, armor: "allowed" },
      { kind: "model", label: "Thought", meta: "claude-sonnet-4-5 · 19.4K in → 1.2K out", cost: 0.0766, ms: 5800, at: 7.4 },
      { kind: "tool", label: "Read", meta: "docs/webhooks.md", ms: 589, at: 13.3, armor: "allowed" },
      { kind: "mcp", label: "postgres.query", meta: "MCP", ms: 2900, at: 14, armor: "allowed" },
      { kind: "tool", label: "WebFetch", meta: "stripe.com/docs", ms: 312, at: 17.1, armor: "allowed" },
      { kind: "model", label: "Thought", meta: "claude-haiku-4-5 · 29.6K in → 459 out", cost: 0.0088, ms: 6600, at: 17.6 },
    ],
  },
  {
    prompt: "Write tests for the rate limiter, especially the burst case.",
    reply: "Added nine tests. The burst case exposed an off-by-one in the refill window, which I fixed.",
    steps: [
      { kind: "model", label: "Thought", meta: "claude-opus-4-1 · 24.2K in → 2.5K out", cost: 0.1101, ms: 4800, at: 26 },
      { kind: "tool", label: "Write", meta: "tests/test_rate_limit.py", ms: 406, at: 31, armor: "allowed" },
      { kind: "tool", label: "Bash", meta: "pytest · exit 1", ms: 5200, at: 31.6, fail: true, armor: "allowed" },
      { kind: "model", label: "Thought", meta: "claude-sonnet-4-5 · 12.9K in → 880 out", cost: 0.0519, ms: 6300, at: 37 },
      { kind: "tool", label: "Bash", meta: "git push --force", ms: 40, at: 43.5, armor: "blocked" },
      { kind: "tool", label: "Edit", meta: "app/rate_limit.py", ms: 377, at: 43.8, armor: "allowed" },
      { kind: "tool", label: "Bash", meta: "pytest · exit 0", ms: 4900, at: 44.4, armor: "allowed" },
    ],
  },
];

/* playground/policies/fixtures.ts: the shadow comparison for two policies over seven days */
export const SHADOW = {
  "claims-strict": { total: 212, allow: 178, hold: 30, block: 4, match: 96, diverges: false, diffs: [["send_member_email", "allow", "hold", 6], ["get_eligibility", "allow", "block", 2]] },
  "research-no-egress": { total: 140, allow: 118, hold: 20, block: 2, match: 82, diverges: true, diffs: [["fetch_url", "allow", "block", 22]] },
} as const;

const FILTERS = [["all", "All"], ["problems", "Problems"], ["armor", "Armor"], ["model", "Model"], ["tools", "Tools"], ["mcp", "MCP"]];

function overview(base: string) {
  return `<section class="story__sec story__x" aria-labelledby="st-overview">
    ${head(
      1,
      "Overview",
      "See what your coding agent <em>actually did.</em>",
      "{Coding agents now work for minutes at a time: they read files, run commands, call tools and spend tokens. }ArmorTools is where a developer sees all of it, and the policies that watch it. I redesigned the console surface by surface, using only the data the API already returns.",
      "st-overview",
      tldrInline(),
    )}
    ${stats([
      ["3", "views of one session run: chat, tree, timeline"],
      ["4", "questions in analytics, after cutting a tab Sessions already owned"],
      ["2", "setup steps, and home shows nothing else until an agent connects"],
      ["0", "drop shadows in the console: a repo test fails if one appears"],
    ])}
    ${frame(
      { tone: "ink", cls: "fr--hero fr--at", crumb: "Console / Home", cap: "Home opens on what needs you, then spend, sessions and agents. Scroll to pull back.", attrs: "data-zoom" },
      browser(zoomed(base, "armortools/home", "ArmorTools home in dark mode: three actions waiting for approval, sessions, tokens and spend tiles, spend by agent and the latest sessions"), APP),
    )}
  </section>`;
}

function home(base: string) {
  return `<section class="story__sec story__x" aria-labelledby="st-home">
    ${head(
      2,
      "Home",
      "Setup first. <em>Then what needs you.</em>",
      "A new account sees only the two setup steps, and the server decides when each is done{, so progress survives a reload or a second laptop}. Once an agent is connected, home opens on the actions waiting for your approval, and everything else comes after.",
      "st-home",
    )}
    <div class="bento">
      ${frame({ tone: "grey", cls: "b-7 fr--atl", crumb: "Home / Light", cap: "The same home in light. Approvals sit above the numbers." }, mediaTag(base, "armortools/home-light", "ArmorTools home in light mode with the Needs you panel at the top left"))}
      ${frame({ tone: "ink", cls: "b-5 fr--at", crumb: "Intent plans / Pending", cap: "Each pending plan shows its agent, its step and who requested it, with approve and reject in the row." }, mediaTag(base, "armortools/intent", "Intent plans: a pending queue of agent plans with their tool, step, policy, requester and approve or reject actions"))}
    </div>
  </section>`;
}

function sessions(base: string) {
  const filters = FILTERS.map(([k, l], i) => `<button type="button" data-sx-filter="${k}" aria-pressed="${i === 0}" data-cursor="hide">${l}<span data-sx-count="${k}"></span></button>`).join("");
  return `<section class="story__sec story__x" aria-labelledby="st-sessions">
    ${head(
      3,
      "Sessions",
      "One run, <em>three lenses.</em>",
      "A session reads as a conversation of turns: what you asked, what the agent did, what it said back. The same run also reads as a tree and as a timeline{, and one tap jumps to the first problem or the most expensive turn}.",
      "st-sessions",
    )}
    <div class="bento">
      ${frame(
        { tone: "ink", cls: "b-full fr--at fr--sx", crumb: "Sessions / One run", cap: "Switch the lens, filter the steps, or jump straight to what went wrong. Example data in the shape of the console's fixtures.", tag: "Live" },
        `<div class="sx" data-sx>
          <div class="sx__head">
            <div><p class="sx__meta"><b>Codex CLI</b><span class="sx__dot"></span>Active now · ashu-mbp</p><p class="sx__title">02c802d7 · Oct 10, 2:22 PM</p><p class="sx__sum" data-sx-sum></p></div>
            <div class="at-seg" role="tablist" aria-label="Lens">${["Chat", "Tree", "Timeline"].map((v, i) => `<button type="button" role="tab" data-sx-view="${v.toLowerCase()}" aria-selected="${i === 0}" data-cursor="hide">${v}</button>`).join("")}</div>
          </div>
          <div class="sx__controls">
            <div class="sx__filters" role="group" aria-label="Filter steps">${filters}</div>
            <div class="sx__jumps"><button type="button" data-sx-jump="problem" data-cursor="hide">First problem</button><button type="button" data-sx-jump="cost" data-cursor="hide">Costliest turn</button></div>
          </div>
          <div class="sx__body" data-sx-body data-lenis-prevent tabindex="0" aria-label="Session steps"></div>
        </div>`,
      )}
      ${frame({ tone: "ink", cls: "b-full fr--at fr--clip", crumb: "Prototype / The real view", cap: "The console on fixtures: chat, tree, timeline, the problem filter, then Ask opening beside the run.", tag: "Video" }, clip(base, "armortools/clip-lenses", "The ArmorTools session view switching from chat to tree to timeline, filtering to problems, and opening the Ask pane", "clip--flat"))}
      ${frame({ tone: "ink", cls: "b-half fr--at", crumb: "Sessions / Tree", cap: "Turns as rows, with the failed step marked." }, mediaTag(base, "armortools/detail-tree", "The session tree: four turns as rows with their steps, and a failed step marked in red"))}
      ${frame({ tone: "ink", cls: "b-half fr--at", crumb: "Sessions / Timeline", cap: "Each step against the clock, so the slow one is obvious." }, mediaTag(base, "armortools/detail-timeline", "The session timeline: each turn and step as a bar against time"))}
    </div>
  </section>`;
}

function ask(base: string) {
  return `<section class="story__sec story__x" aria-labelledby="st-ask">
    ${head(
      4,
      "Ask",
      "Ask the run, <em>beside the run.</em>",
      "Ask is one button that opens a resizable pane next to the session, so the answer and the evidence sit side by side. {Four layouts were built; the inline one shipped first and came back as too much on the page.}",
      "st-ask",
    )}
    <div class="bento">
      ${frame({ tone: "ink", cls: "b-full fr--at", crumb: "Sessions / Ask", cap: "The run stays readable on the left while the answer builds on the right. In progress." }, mediaTag(base, "armortools/detail-ask", "A session with the Ask pane open on the right, suggested questions and an answer beside the run"))}
    </div>
  </section>`;
}

function chat(base: string) {
  return `<section class="story__sec story__x" aria-labelledby="st-chat">
    ${head(
      5,
      "Chat",
      "The model picks the widget. <em>The API supplies the numbers.</em>",
      "In AI chat, the model chooses which widget answers the question and writes the sentence around it, but every number in the widget comes from an endpoint the console already calls. {A model can misremember a total. A widget fed by the API cannot.}",
      "st-chat",
    )}
    <div class="bento">
      ${frame({ tone: "ink", cls: "b-7 fr--at fr--clip", crumb: "AI chat / An answer", cap: "The sentence streams, then the table builds from the usage endpoint.", tag: "Video" }, clip(base, "armortools/clip-chat", "AI chat answering how many tokens were used in four days: a streamed sentence, then a table of tokens by agent", "clip--flat"))}
      ${frame(
        { tone: "ink", cls: "b-5 fr--at fr--roles", crumb: "Chat / Who does what" },
        `<ol class="at-roles">
          <li><b>The model</b><span>Picks the widget and the scope, then narrates.</span></li>
          <li><b>The page</b><span>Fetches the data from existing endpoints and renders it.</span></li>
          <li><b>Never</b><span>A number on screen that came from model output.</span></li>
        </ol>`,
      )}
      ${frame({ tone: "ink", cls: "b-full fr--at", crumb: "AI chat / The finished answer", cap: "One sentence, a table of tokens by agent, and a note on what caching saved. In progress." }, mediaTag(base, "armortools/chat", "The finished chat answer: 2.65M tokens in four days, a table of tokens and share by agent, and a note that cache reads saved money"))}
    </div>
  </section>`;
}

function analytics(base: string) {
  return `<section class="story__sec story__x" aria-labelledby="st-analytics">
    ${head(
      6,
      "Analytics",
      "Four questions, <em>not a wall of charts.</em>",
      "Each analytics view opens on a question: how your agents are doing, where the money goes, how efficient the usage is, whether the agents are fast. {The activity tab went, because Sessions already owns per-session detail and one job should live in one place.}",
      "st-analytics",
    )}
    <div class="bento">
      ${frame({ tone: "ink", cls: "b-full fr--at fr--clip", crumb: "Analytics / Four views", cap: "Overview, spend, tokens, performance, each headed by the question it answers.", tag: "Video" }, clip(base, "armortools/clip-analytics", "Analytics cycling through its four views, each headed by a question: how your agents are doing, where the money goes, how efficient the usage is, are the agents fast", "clip--flat"))}
      ${frame({ tone: "grey", cls: "b-full fr--atl", crumb: "Analytics / Light", cap: "Spend leads with the number, then what changed and why, then the trend." }, mediaTag(base, "armortools/analytics-light", "Analytics overview in light mode: 566.94 dollars estimated spend with notes on what changed, a spend-over-time chart and spend by coding agent"))}
    </div>
  </section>`;
}

function policies(base: string) {
  const tabs = Object.keys(SHADOW).map((k, i) => `<button type="button" role="tab" data-pol="${k}" aria-selected="${i === 0}" data-cursor="hide">${esc(k)}</button>`).join("");
  return `<section class="story__sec story__x" aria-labelledby="st-policies">
    ${head(
      7,
      "Policies",
      "New policies watch <em>before they block.</em>",
      "A new policy starts in shadow: it sees every call and records what it would have done, without stopping anything. Promotion waits for enough evidence{, and a policy that disagrees with what is live gets a review first}.",
      "st-policies",
    )}
    <div class="bento">
      ${frame(
        { tone: "ink", cls: "b-7 fr--at fr--pol", crumb: "Policies / Shadow", cap: "Pick a policy in shadow and try to promote it.", tag: "Live" },
        `<div class="pol" data-pol-root>
          <div class="at-seg" role="tablist" aria-label="Policy">${tabs}</div>
          <div class="pol__card" data-pol-card></div>
        </div>`,
      )}
      ${frame({ tone: "ink", cls: "b-5 fr--at", crumb: "Policies / Suggestions", cap: "Suggested detections lead the list: what fired, what is ready, what disagrees. In progress." }, mediaTag(base, "armortools/policies", "The policies list with suggested detections above it, then each policy's decision, status, target and recent fires"))}
    </div>
  </section>`;
}

function briefing(base: string) {
  return `<section class="story__sec story__x" aria-labelledby="st-briefing">
    ${head(
      8,
      "Briefing",
      "A morning brief, <em>not another dashboard.</em>",
      "The daily briefing leads with one sentence about the last 24 hours, then four numbers against the day before, then what ran, in plain prose{, at eight in the morning in your own time zone}.",
      "st-briefing",
    )}
    <div class="bento">
      ${frame({ tone: "ink", cls: "b-full fr--at", crumb: "Briefing / Tuesday", cap: "Your agents ran 61 times with a 92% success rate. Then the detail, if you want it. In progress." }, mediaTag(base, "armortools/briefing", "The daily briefing: a headline about 61 runs at a 92% success rate, four numbers with day-on-day changes, and a written summary of what ran"))}
    </div>
  </section>`;
}

function craft(base: string) {
  return `<section class="story__sec story__x" aria-labelledby="st-craft">
    ${head(
      9,
      "Craft",
      "Dark by default. <em>Light as a peer.</em>",
      "The console ships in both themes, from the same tokens, with no shadows anywhere{: the repo fails its own tests if one sneaks in}.",
      "st-craft",
    )}
    <div class="bento">
      ${frame(
        { tone: "ink", cls: "b-8 fr--at fr--wipe", crumb: "Sessions / Both themes", cap: "Drag across the list to swap dark for light.", tag: "Live" },
        `<div class="tw" data-tw style="--x:50%">
          ${mediaTag(base, "armortools/list", "The sessions list in dark mode: a KPI strip and a table of sessions")}
          <div class="tw__top">${mediaTag(base, "armortools/list-light", "The same sessions list in light mode")}</div>
          <input class="tw__range" type="range" min="0" max="100" value="50" aria-label="Reveal the light theme" data-tw-range data-cursor="hide">
          <span class="tw__handle" aria-hidden="true"></span>
        </div>`,
      )}
      ${frame({ tone: "ink", cls: "b-4 fr--at", crumb: "Exploration / Mascot", cap: "A mascot builder for empty and loading states. Still a test, not a default." }, mediaTag(base, "armortools/mascot", "A 3D orange mascot with the ArmorIQ mark on its belly, from the mascot builder"))}
    </div>
  </section>`;
}

function outcome() {
  return `<section class="story__sec story__x" aria-labelledby="st-outcome">
    ${head(
      10,
      "Outcome",
      "Merged, <em>and still moving.</em>",
      "Home, Sessions, Analytics and Chat merged in October 2026. Ask, chat widgets, Policies and the Daily Briefing are in progress{, on the same rule: design with the data the API already returns}.",
      "st-outcome",
    )}
    ${results(
      [
        { n: "3", title: "Lenses on one session", kind: "Shipped", text: "Chat, tree and timeline read the same run{, with filters for problems, armor, model, tools and MCP}.", bars: [] },
        { n: "4", title: "Questions in analytics", kind: "Shipped", text: "Overview, spend, tokens and performance{, after cutting a tab that duplicated Sessions}.", bars: [] },
        { n: "2", title: "Setup steps before anything else", kind: "Shipped", text: "Completion comes from the server{, so it holds across reloads and devices}.", bars: [] },
      ],
      "With the ArmorIQ engineering team. I led the console's design and built the redesigned surfaces in the front end.",
    )}
  </section>`;
}

/** Story entry point, picked up by templates/case.ts through import.meta.glob */
export function story(base: string, _p: Project) {
  return storyRoot("armortools", [overview(base), home(base), sessions(base), ask(base), chat(base), analytics(base), policies(base), briefing(base), craft(base), outcome()].join(""));
}
