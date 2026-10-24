import type { Project } from "../../content";
import { esc, mediaTag, pad2 } from "../../lib/html";
import { COMBINATIONS, PARTS, PART_COUNTS, PART_NAMES, PLAYER_COLORS, characterSvg, genomeFromSeed, type GenomePart } from "../../lib/papersseum/character";
import { browser, clip, crop, frame, head, phone, results, scroller, stats, storyRoot, tldrInline, zoomed } from "./kit";

/**
 * Papersseum, told visually. The live pieces are ports of the shipped code: the pixel characters and their motion
 * (web/lib/character), the arena replay and its key moments (web/features/replay, web/lib/arena), the cell wipe
 * (styles/motion.css) and the button (components/ui/button). Team credit sits in the outcome footer.
 */

const LIVE = "papersseum.vercel.app";
/** The baseline bots the recorded home match seats, in slot order (web/features/replay/components/board-replay.tsx) */
export const HOME_SEATS = ["house_greedy_1", "house_safe_expander_1", "house_hunter", "house_greedy_2", "house_safe_expander_2"];
const FORGE_SEED = "lucid_sovereign";
const GRID_SEEDS = Array.from({ length: 60 }, (_, i) => `bot${i}`);
const fmt = (n: number) => n.toLocaleString("en-IN");

/** The papersseum button: a fill rises from the bottom edge and the label rolls up one line, letter by letter */
export const ppButton = (label: string, cls = "", attrs = "") => {
  const chars = Array.from(label)
    .map((c, i) => `<span class="ppbtn__char" style="--i: ${i}">${c === " " ? "&nbsp;" : esc(c)}</span>`)
    .join("");
  return `<button type="button" class="ppbtn${cls ? ` ${cls}` : ""}" data-cursor="hide" ${attrs}><span class="ppbtn__roll" aria-hidden="true"><span class="ppbtn__row">${chars}</span><span class="ppbtn__row ppbtn__row--next">${chars}</span></span><span class="sr-only">${esc(label)}</span></button>`;
};

/** The brand mark: a 3x3 grid, four inked cells around an empty centre. Five cells take part, one per player. */
const logoMark = () => {
  const cells: [string, number, number][] = [["n", 1, 0], ["e", 2, 1], ["s", 1, 2], ["w", 0, 1], ["c", 1, 1]];
  return `<svg class="pplogo" viewBox="0 0 3 3" shape-rendering="crispEdges" aria-hidden="true">${cells.map(([k, x, y], i) => `<rect data-cell="${k}" x="${x}" y="${y}" width="1" height="1" style="--slot: var(--pp-slot-${i})"/>`).join("")}</svg>`;
};

const loader = () => `<div class="pploader" aria-hidden="true">${Array.from({ length: 9 }, (_, i) => `<span style="--n: ${[0, 1, 2, 7, 8, 3, 6, 5, 4][i]}"></span>`).join("")}</div>`;

function overview(base: string) {
  return `<section class="story__sec story__x" aria-labelledby="st-overview">
    ${head(
      1,
      "Overview",
      "A bot tournament students <em>actually enter.</em>",
      "{Papersseum is a season-long bot tournament at IIITDM Jabalpur. }Your Python bot plays four others for territory every 15 minutes, and Elo keeps the score. I redesigned the web app around one job{ the old site could not do}: watching your bot fight{ and understanding why it lost}.",
      "st-overview",
      tldrInline(),
    )}
    ${stats([
      ["4,438", "matches played on the live ladder, 23 Oct 2026"],
      ["51", "bots competing, each with its own face"],
      [fmt(COMBINATIONS), "pixel characters a name can seed"],
      ["165", "edge cases mapped before the build"],
    ])}
    ${frame(
      { tone: "white", cls: "fr--hero fr--pp", crumb: `${LIVE} / Home`, cap: "Scroll to pull back from the live arena to the whole home page.", attrs: "data-zoom" },
      browser(zoomed(base, "papersseum/cover", "Papersseum home: the wordmark beside a live arena where five pixel bots fight"), LIVE),
    )}
  </section>`;
}

/** The top of the task analysis, ranked by Nielsen severity (0 to 4) */
const PROBLEMS: [string, string, number][] = [
  ["“Checking…” can last forever", "An upload waits on a worker that may be down, with no timeout and no sign of it.", 4],
  ["No way to watch your own match", "The match page said the replay viewer wasn't built yet.", 4],
  ["Ladder errors are invisible", "A bot that crashes on 30% of turns quietly loses, and its owner never learns why.", 4],
  ["A bad version replaces a good one", "The newest passing upload goes live at once, with no way back.", 3],
  ["The cooldown punishes our faults", "A failed check on our side still costs the student 10 minutes.", 3],
];

function problem(base: string) {
  const rows = PROBLEMS.map(
    ([t, d, sev], i) => `<li class="sev"><span class="sev__n">${pad2(i + 1)}</span><span class="sev__body"><b>${esc(t)}</b><span>${esc(d)}</span></span><span class="sev__score" aria-label="Severity ${sev} of 4">${Array.from({ length: 4 }, (_, k) => `<i class="${k < sev ? "on" : ""}"></i>`).join("")}</span></li>`,
  ).join("");
  return `<section class="story__sec story__x" aria-labelledby="st-problem">
    ${head(
      2,
      "Problem",
      "The game worked. <em>Entering it did not.</em>",
      "An upload could sit on “Checking…” forever, a crashing bot lost without telling its owner, and nobody could watch their own match on the site. {I ranked ten problems like these by severity before drawing a screen.}",
      "st-problem",
    )}
    <div class="bento">
      ${frame({ tone: "white", cls: "b-half fr--pp", crumb: "Task analysis / Top five", cap: "One evaluator, no users yet: each severity is a hypothesis to test.", tag: "Sev 0 to 4" }, `<ol class="sevs">${rows}</ol>`)}
      ${frame({ tone: "white", cls: "b-half", crumb: "FigJam / Upload, every branch", cap: "The upload flow that answered problem one: every wait gets a stage and a ceiling." }, crop(base, "papersseum/fj-upload", "FigJam flow of the upload and validation journey with every branch and error", "crop--fj"))}
    </div>
  </section>`;
}

/** FigJam section tops, in px on the 1711 px wide board render (board units x 0.383) */
const BOARD = [
  { q: "Sitemap", s: "A", y: 460 },
  { q: "System architecture", s: "B", y: 1532 },
  { q: "State machines", s: "C", y: 2337 },
  { q: "First run", s: "D", y: 3390 },
  { q: "Upload, every branch", s: "E", y: 4128 },
  { q: "The improve loop", s: "F", y: 4871 },
  { q: "Screen state matrix", s: "J", y: 7132 },
  { q: "Edge cases", s: "K", y: 7709 },
  { q: "Roadmap", s: "L", y: 8453 },
];

function structure(base: string) {
  return scroller({
    n: 3,
    label: "Structure",
    title: "I mapped the whole platform <em>before drawing a screen.</em>",
    text: "One board holds the sitemap, the architecture, three state machines, six user flows and 165 edge cases{, all built before any page}.{ Its gaps became the build list.}",
    id: "st-structure",
    items: BOARD,
    src: `${base}media/papersseum/fj-board.jpg`,
    w: 1711,
    h: 9000,
    url: "figma.com / Papersseum: IA, architecture and user flows",
    crumb: "FigJam / Whole board",
  });
}

/** The numbers that forced the data decisions: what the free plan and one worker can carry */
function facts() {
  const cards: [string, string, string][] = [
    ["5 days", "Realtime on public pages", "The free plan's 2M messages a month run out in about five days, so public pages poll every 30 s and say “updated N s ago”."],
    ["1 week", "Pre-drawing every replay", "At 137 KB a match, the free 1 GB fills in about a week, so replays are drawn on first view and kept seven days."],
    ["35 to 110", "Players per worker", "One worker plays one match at a time. Past that, rounds skip, and the product says so instead of going quiet."],
  ];
  return cards.map(([n, t, d]) => frame({ tone: "white", cls: "b-4 fr--pp fr--fact" }, `<div class="fact"><p class="fact__n">${esc(n)}</p><p class="fact__t">${esc(t)}</p><p class="fact__d">${esc(d)}</p></div>`)).join("");
}

function flows(base: string) {
  return `<section class="story__sec story__x" aria-labelledby="st-flows">
    ${head(
      4,
      "Flows",
      "Waits get a stage <em>and a ceiling.</em>",
      "An upload now moves through four named stages with a time limit, a rejected version comes back with the fix, and any earlier version can be made active again{, so uploading never destroys a working bot}.",
      "st-flows",
    )}
    <div class="bento">
      ${frame({ tone: "white", cls: "b-full fr--pp", crumb: "Me / Overview", cap: "Uploaded, in line, scan and test match, verdict. The page says when matches are paused, so a wait is never a mystery.", tag: "Fix for problem 01" }, mediaTag(base, "papersseum/me-check", "Upload check in progress: four stages from uploaded to verdict, with a notice that matches are paused"))}
      ${frame({ tone: "white", cls: "b-7 fr--pp", crumb: "Me / Versions", cap: "A rejected upload names the line and the fix. Any passing version can be made active again.", tag: "Fix for problem 04" }, mediaTag(base, "papersseum/versions", "Versions table: a rejected upload with the offending lines and fixes, and Make active buttons on older versions"))}
      ${frame({ tone: "white", cls: "b-5 fr--pp", crumb: "Welcome", cap: "A new player meets their bot before the first match, and sees what is public." }, mediaTag(base, "papersseum/welcome", "Welcome page: Meet your bot, with the character and what others will see"))}
    </div>
  </section>`;
}

function characters(base: string) {
  const g = genomeFromSeed(FORGE_SEED);
  const parts = PARTS.map(
    (p: GenomePart) => `<div class="forge__part" data-part="${p}">
        <span class="label">${p === "signature" ? "colour" : p}</span>
        <button type="button" class="forge__step" data-step="-1" aria-label="Previous ${p}" data-cursor="hide">&#8249;</button>
        <output>${PART_NAMES[p][g[p]]}</output>
        <button type="button" class="forge__step" data-step="1" aria-label="Next ${p}" data-cursor="hide">&#8250;</button>
      </div>`,
  ).join("");
  const states = ["idle", "working", "win", "dead"]
    .map((st) => `<button type="button" class="forge__state" data-state="${st}" aria-pressed="${st === "idle"}" data-cursor="hide">${st}</button>`)
    .join("");
  const grid = GRID_SEEDS.map((seed) => `<button type="button" class="g60__cell" data-seed="${seed}" title="${seed}" aria-label="Load ${seed} into the forge" data-cursor="hide">${characterSvg(genomeFromSeed(seed), { seed })}</button>`).join("");
  return `<section class="story__sec story__x" aria-labelledby="st-chars">
    ${head(
      5,
      "Characters",
      "Every bot gets a face <em>from its name.</em>",
      "{Five players share one board, so each has to be told apart at 24 pixels. }A name seeds one of 14,400 pixel characters: six heads, six eyes, five antennas, four mouths, four patterns and five colours. {A saved look overrides the seed, and each one blinks, glances, works, wins and dies on its own clock.}",
      "st-chars",
    )}
    <div class="bento">
      ${frame(
        { tone: "white", cls: "b-7 fr--pp", crumb: "Me / Bot Forge", cap: "Type a name, or step through the parts. Your pointer is what it looks at.", tag: "Live" },
        `<div class="forge" data-forge>
          <div class="forge__stage">${characterSvg(g, { label: `${FORGE_SEED}'s character`, cls: "forge__bot", seed: FORGE_SEED })}</div>
          <div class="forge__controls">
            <label class="forge__name"><span class="label">Bot name</span><input type="text" value="${FORGE_SEED}" maxlength="32" spellcheck="false" autocomplete="off" data-forge-name></label>
            <div class="forge__parts">${parts}</div>
            <div class="forge__states" role="group" aria-label="State">${states}</div>
          </div>
        </div>`,
      )}
      ${frame({ tone: "white", cls: "b-5 fr--pp", crumb: "Playground / 60 seeds", cap: "Sixty names, sixty faces. Click one to open it in the forge.", tag: "Live" }, `<div class="g60" data-grid60>${grid}</div>`)}
      ${frame({ tone: "white", cls: "b-full fr--pp fr--clip", crumb: "Me / Bot Forge", cap: "The real forge: pick parts, randomise, save. The preview updates as you go.", tag: "Video" }, clip(base, "papersseum/clip-forge", "The Bot Forge page: clicking through head, eyes, antenna, mouth and pattern options, then randomising"))}
      ${frame({ tone: "white", cls: "b-full fr--pp fr--strip", crumb: `${LIVE} / Home / The ladder`, cap: "On the live site the ladder runs past as a marquee of real bots." }, mediaTag(base, "papersseum/roster", "A row of real bots from the live ladder, each with its pixel character"))}
    </div>
  </section>`;
}

function gameplay(base: string) {
  const legend = HOME_SEATS.map((n, i) => `<li><i style="background: ${PLAYER_COLORS[i]}"></i>${esc(n.replace(/^house_/, ""))}</li>`).join("");
  return `<section class="story__sec story__x" aria-labelledby="st-game">
    ${head(
      6,
      "Gameplay",
      "Watch your bot fight, <em>and see why it lost.</em>",
      "{Diagnosis comes before motivation. }The viewer marks every knockout, big capture and lead change on the timeline, and a click jumps to two seconds before it{, so a loss explains itself}.",
      "st-game",
    )}
    <div class="bento">
      ${frame(
        { tone: "white", cls: "b-full fr--pp fr--arena", crumb: "Match / Replay", cap: "A real recorded match. ✕ knockout, ■ capture, ▲ lead change. Click a mark.", tag: "Live" },
        `<div class="arena" data-arena data-src="${base}media/papersseum/home-replay.dat" data-seats='${esc(JSON.stringify(HOME_SEATS))}'>
          <div class="arena__board">
            <img class="arena__still" src="${base}media/papersseum/board-light.svg" width="120" height="120" alt="A Papersseum board mid-match: five players' territories in a circular arena">
            <canvas class="arena__canvas" width="120" height="120" hidden role="img" aria-label="A recorded Papersseum match replaying: five players' territories in an arena"></canvas>
            <div class="arena__riders" aria-hidden="true"></div>
          </div>
          <div class="arena__side">
            <div class="arena__hud" aria-hidden="true"><div class="arena__leader"><span class="arena__face"></span><span><span class="label">Leading</span><b class="arena__lead">Loading the match</b></span></div><div class="arena__stack"></div></div>
            <ul class="arena__legend">${legend}</ul>
            <div class="arena__controls">
              ${ppButton("Pause", "ppbtn--ink ppbtn--sm", 'data-play aria-pressed="true"')}
              <div class="arena__speed" role="group" aria-label="Speed">${[1, 2, 4].map((x) => `<button type="button" data-speed="${x}" aria-pressed="${x === 1}" data-cursor="hide">${x}&#215;</button>`).join("")}</div>
              <span class="arena__clock label">0:00 / 3:00</span>
            </div>
          </div>
          <div class="arena__timeline">
            <input class="arena__scrub" type="range" min="0" max="1799" value="0" step="1" aria-label="Match time" data-cursor="hide">
            <div class="arena__marks"></div>
          </div>
        </div>`,
      )}
      ${frame({ tone: "ink", cls: "b-5 fr--render fr--clip", crumb: "Engine / Render", cap: "The engine's own render of a full match, six times faster.", tag: "Video" }, clip(base, "papersseum/clip-match", "A full Papersseum match rendered by the engine: five colours carving up a circular arena"))}
      ${frame({ tone: "white", cls: "b-7 fr--pp", crumb: "Match 4630 / Result", cap: "Each match keeps its table: coverage, deaths, Elo before and after." }, mediaTag(base, "papersseum/result", "Match result table with placement, coverage, deaths and Elo change for five bots"))}
    </div>
  </section>`;
}

function data(base: string) {
  return `<section class="story__sec story__x" aria-labelledby="st-data">
    ${head(
      7,
      "Data design",
      "Tables stay calm. <em>The win gets the noise.</em>",
      "Leaderboard rows and match lists are read every day, so they stay quiet and fast. {The podium, the rank numerals and the winning moment get the expressive budget. A bot without a rating shows “Not rated yet”, never a fake number.}",
      "st-data",
    )}
    <div class="bento">
      ${facts()}
      ${frame({ tone: "white", cls: "b-7 fr--pp", crumb: "Leaderboard / Podium", cap: "Top three on a podium, ranked by Elo minus twice its uncertainty." }, mediaTag(base, "papersseum/podium", "Leaderboard podium: first, second and third place bots with their characters and ratings"))}
      ${frame({ tone: "white", cls: "b-5 fr--pp", crumb: "Leaderboard / Rows", cap: "Rating, Elo, uncertainty and games, in tabular numbers." }, crop(base, "papersseum/lbtable", "Leaderboard rows: rank, bot character and name, rating, Elo, uncertainty, games, version", "crop--table"))}
      ${frame({ tone: "white", cls: "b-5 fr--pp", crumb: "Bot / Elo", cap: "A hundred matches of Elo in one line, low and high marked." }, mediaTag(base, "papersseum/elo", "Line chart of a bot's Elo over its last 100 matches"))}
      ${frame({ tone: "ink", cls: "b-7 fr--night", crumb: "Matches / Rows, dark", cap: "Each match as a row: five faces, a winner and a coverage bar per slot." }, mediaTag(base, "papersseum/matchrows-dark", "Dark theme match list: each row shows the winner, five bot characters and coloured coverage bars"))}
    </div>
  </section>`;
}

function brand(base: string) {
  return `<section class="story__sec story__x" aria-labelledby="st-brand">
    ${head(
      8,
      "Brand and motion",
      "The board <em>is the brand.</em>",
      "The logo is a 3x3 grid, and everything grows from it: the loader, the page transition, the pixel bots and the hairline grid. {Motion runs on four durations and three curves, and reduced motion is a second design with its own tests.}",
      "st-brand",
    )}
    <div class="bento">
      ${frame({ tone: "white", cls: "b-full fr--pp fr--clip", crumb: `${LIVE} / Home / Arrival`, cap: "The wordmark rises letter by letter, then the arena fades in and starts playing.", tag: "Video" }, clip(base, "papersseum/clip-intro", "The home page arriving: the Papersseum wordmark rises letter by letter and the live arena fades in", "clip--flat"))}
      ${frame(
        { tone: "white", cls: "b-7 fr--pp", crumb: "Route / Cell wipe", cap: "Each of nine cells opens from its own centre. Press the button.", tag: "Live" },
        `<div class="wipe" data-wipe>
          <div class="wipe__page wipe__page--a">${mediaTag(base, "papersseum/wipe-a", "The Papersseum leaderboard page")}</div>
          <div class="wipe__page wipe__page--b">${mediaTag(base, "papersseum/wipe-b", "The Papersseum matches page")}</div>
          <div class="wipe__go">${ppButton("Go to Matches", "ppbtn--ink", "data-wipe-go")}</div>
        </div>`,
      )}
      ${frame(
        { tone: "white", cls: "b-5 fr--pp", crumb: "Brand / Mark, loader, buttons", cap: "Hover the mark and the buttons. The fill rises, the label rolls.", tag: "Hover" },
        `<div class="brandlab"><div class="brandlab__marks">${logoMark()}${loader()}</div><div class="brandlab__btns">${ppButton("Sign in with Google", "ppbtn--ink")}${ppButton("Read the rules", "ppbtn--ghost")}</div></div>`,
      )}
    </div>
  </section>`;
}

function mobile(base: string) {
  return `<section class="story__sec story__x" aria-labelledby="st-mobile">
    ${head(
      9,
      "Mobile",
      "Checked at 320, 375 <em>and 768 pixels.</em>",
      "I audited 23 routes at three phone widths and fixed what broke{: a podium wider than the phone, tables that scrolled sideways, a menu that let the page scroll behind it}.",
      "st-mobile",
    )}
    <div class="bento bento--mobile">
      ${frame({ tone: "grey", cls: "m-a", crumb: "Leaderboard / Phone", tag: "375 px" }, phone(mediaTag(base, "papersseum/m-leaderboard", "Leaderboard on a phone: the podium fits the width, then the table")))}
      ${frame({ tone: "white", cls: "m-b fr--pp", crumb: "Home / Phone", cap: "The arena keeps its place in the first screen." }, phone(mediaTag(base, "papersseum/m-home", "Papersseum home on a phone: wordmark, pitch, sign in, and the arena"), "ph--bottom"))}
      ${frame({ tone: "ink", cls: "m-c fr--night", crumb: "Bot / Phone", cap: "A bot's page leads with its face and its numbers." }, phone(mediaTag(base, "papersseum/m-bot", "A bot profile on a phone: character, rank, rating, Elo and games"), "ph--top"))}
    </div>
  </section>`;
}

function outcome() {
  return `<section class="story__sec story__x" aria-labelledby="st-outcome">
    ${head(10, "Outcome", "Students write bots. <em>Everyone watches them fight.</em>", "", "st-outcome")}
    ${results(
      [
        {
          n: "4,438",
          title: "Matches played on the live ladder",
          kind: "Live site, 23 Oct 2026",
          text: "Fifty-one bots are competing, and every match can be watched and explained on the site{, which the old site could not do}.",
          bars: [],
        },
        {
          n: fmt(COMBINATIONS),
          title: "Characters from one name",
          kind: "Derived: 6 × 6 × 5 × 4 × 4 × 5",
          text: "Thirty hand-drawn parts multiply into a face for every bot{, readable at 24 pixels}.",
          bars: PARTS.map((p) => [p === "signature" ? "colours" : `${p}${p.endsWith("s") ? "" : "s"}`, PART_COUNTS[p], String(PART_COUNTS[p])] as [string, number, string]),
        },
        {
          n: "8 of 9",
          title: "Phone problems fixed",
          kind: "Mobile audit, 23 routes",
          text: "No shipped page scrolls sideways any more{; the one left is a dev-only playground that never ships}.",
          bars: [["P0 found", 3, "3"], ["P0 fixed", 2, "2"], ["P1 found", 6, "6"], ["P1 fixed", 6, "6"]],
        },
      ],
      "Team: Dhairya Pandya built the engine; Arunit Chakraborty built the in-browser engine and the Learn course. I led the redesign, the design system, the characters and the specs.",
    )}
  </section>`;
}

/** Story entry point, picked up by templates/case.ts through import.meta.glob */
export function story(base: string, _p: Project) {
  return storyRoot("papersseum", [overview(base), problem(base), structure(base), flows(base), characters(base), gameplay(base), data(base), brand(base), mobile(base), outcome()].join(""));
}
