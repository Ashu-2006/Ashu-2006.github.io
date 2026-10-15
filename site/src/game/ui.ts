import { NAME_MAX, type Entry } from "./leaderboard";

/**
 * Night Drive's screens as static markup: an ASH/OS 98 dialog per state over the tube, and the touch
 * pad. Nothing here interpolates player data; names and scores are written later with textContent.
 */

let uid = 0;

const ARROW = (dir: "left" | "right" | "up") => {
  const d = { left: "M3 8h2V7h2V5h2V3h2v13H9v-2H7v-2H5v-1H3z", right: "M13 8h-2V7H9V5H7V3H5v13h2v-2h2v-2h2v-1h2z", up: "M8 3h2v2h2v2h2v2h2v2H11v6H7v-6H2V9h2V7h2V5h2z" }[dir];
  return `<svg viewBox="0 0 18 19" width="36" height="38" aria-hidden="true" shape-rendering="crispEdges"><path d="${d}" fill="currentColor"/></svg>`;
};

const PAUSE = `<svg viewBox="0 0 12 12" width="24" height="24" aria-hidden="true" shape-rendering="crispEdges"><path d="M2 2h3v8H2zM7 2h3v8H7z" fill="currentColor"/></svg>`;

const bar = (id: string, title: string) => `<div class="nd-dlg__bar"><span class="nd-dlg__title" id="${id}">${title}</span></div>`;

export function gameMarkup(touch: boolean, canExit: boolean) {
  const n = ++uid;
  const id = (s: string) => `nd${n}-${s}`;
  const keys = touch ? "Hold the arrows to steer, Gas to speed up." : "Arrows or WASD to drive. P or Space pauses. Enter starts.";
  const sound = `<label class="nd-check"><input type="checkbox" data-sound /><span>Sound</span></label>`;
  return `
<div class="nd__screen" data-screen>
  <canvas class="nd__crt" aria-hidden="true"></canvas>
  <div class="nd__layer">
    <section class="nd-dlg nd-dlg--title" data-panel="title" aria-labelledby="${id("t")}" hidden>
      ${bar(id("t"), "New game")}
      <div class="nd-dlg__body">
        <h2 class="nd-logo"><span>Night Drive</span></h2>
        <p class="nd-lede">Three lives. Every stage the road gets faster and busier.</p>
        <form class="nd-form" data-form novalidate>
          <label class="nd-label" for="${id("name")}">Your name</label>
          <input class="nd-field" id="${id("name")}" name="name" type="text" maxlength="${NAME_MAX}" autocomplete="nickname" autocapitalize="off" spellcheck="false" aria-describedby="${id("hint")}" data-name />
          <p class="nd-hint" id="${id("hint")}" data-name-msg>3 to 12 letters, numbers, spaces or _</p>
          <div class="nd-row">
            <button class="nd-btn nd-btn--default" type="submit">Start</button>
            <button class="nd-btn" type="button" data-act="board">Leaderboard</button>
            ${canExit ? `<button class="nd-btn" type="button" data-act="exit">Exit</button>` : ""}
          </div>
        </form>
        <div class="nd-foot"><p class="nd-keys">${keys}</p>${sound}</div>
      </div>
    </section>

    <section class="nd-dlg nd-dlg--small" data-panel="paused" aria-labelledby="${id("p")}" hidden>
      ${bar(id("p"), "Paused")}
      <div class="nd-dlg__body">
        <p class="nd-big">Paused</p>
        <p class="nd-keys">${touch ? "Tap Resume to drive on." : "P, Space or Enter resumes."}</p>
        <div class="nd-row">
          <button class="nd-btn nd-btn--default" type="button" data-act="resume">Resume</button>
          <button class="nd-btn" type="button" data-act="quit">Quit to title</button>
        </div>
        <div class="nd-foot">${sound}</div>
      </div>
    </section>

    <section class="nd-dlg" data-panel="over" aria-labelledby="${id("o")}" hidden>
      ${bar(id("o"), "Game over")}
      <div class="nd-dlg__body">
        <p class="nd-big">Game over</p>
        <dl class="nd-stats">
          <div><dt>Score</dt><dd data-v="score">000000</dd></div>
          <div><dt>Stage</dt><dd data-v="stage">1</dd></div>
          <div><dt>Driver</dt><dd data-v="name"></dd></div>
        </dl>
        <p class="nd-rank" data-v="rank" aria-live="polite"></p>
        <p class="nd-note" data-v="note" hidden></p>
        <div class="nd-row">
          <button class="nd-btn nd-btn--default" type="button" data-act="again">Play again</button>
          <button class="nd-btn" type="button" data-act="board">Leaderboard</button>
          <button class="nd-btn" type="button" data-act="rename">Change name</button>
        </div>
      </div>
    </section>

    <section class="nd-dlg nd-dlg--board" data-panel="board" aria-labelledby="${id("b")}" hidden>
      ${bar(id("b"), "Leaderboard")}
      <div class="nd-dlg__body">
        <p class="nd-scope" data-scope></p>
        <div class="nd-list">
          <table class="nd-table">
            <thead><tr><th scope="col" class="nd-c-rank">#</th><th scope="col">Name</th><th scope="col" class="nd-c-score">Score</th><th scope="col" class="nd-c-date">Date</th></tr></thead>
            <tbody data-rows></tbody>
          </table>
        </div>
        <p class="nd-note" data-board-note hidden></p>
        <div class="nd-row">
          <button class="nd-btn nd-btn--default" type="button" data-act="back">Back</button>
          <button class="nd-btn" type="button" data-act="again">Play</button>
        </div>
      </div>
    </section>
  </div>
</div>
<div class="nd__pad" data-pad ${touch ? "" : "hidden"}>
  <button class="nd-pad" type="button" tabindex="-1" data-key="left" aria-label="Steer left">${ARROW("left")}</button>
  <button class="nd-pad" type="button" tabindex="-1" data-key="right" aria-label="Steer right">${ARROW("right")}</button>
  <button class="nd-pad nd-pad--pause" type="button" tabindex="-1" data-act="pause" aria-label="Pause">${PAUSE}</button>
  <button class="nd-pad nd-pad--gas" type="button" tabindex="-1" data-key="up" aria-label="Gas">${ARROW("up")}<span>Gas</span></button>
</div>
<p class="sr-only" aria-live="polite" data-live></p>`;
}

/** "2026-10-15T09:12:00Z" or D1's "2026-10-15 09:12:00" as "15 Oct 26"; anything unreadable as an empty string */
export function shortDate(at: string) {
  const t = Date.parse(/^\d{4}-\d{2}-\d{2} \d/.test(at) ? `${at.replace(" ", "T")}Z` : at);
  if (!Number.isFinite(t)) return "";
  return new Date(t).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "2-digit" });
}

export const pad6 = (n: number) => String(Math.max(0, Math.floor(n))).padStart(6, "0");

/** Fills the leaderboard table with text nodes only. `me` marks the row to highlight. */
export function fillRows(tbody: HTMLElement, list: Entry[], me: { name: string; score: number } | null) {
  tbody.replaceChildren();
  let marked = false;
  list.forEach((e, i) => {
    const tr = document.createElement("tr");
    const isMe = !marked && !!me && e.score === me.score && e.name.toLowerCase() === me.name.toLowerCase();
    if (isMe) {
      marked = true;
      tr.className = "is-me";
      tr.setAttribute("aria-current", "true");
    }
    const cells: [string, string][] = [
      [String(i + 1), "nd-c-rank"],
      [e.name, ""],
      [pad6(e.score), "nd-c-score"],
      [shortDate(e.at), "nd-c-date"],
    ];
    for (const [text, cls] of cells) {
      const td = document.createElement("td");
      if (cls) td.className = cls;
      td.textContent = text;
      tr.append(td);
    }
    tbody.append(tr);
  });
  return marked;
}

/** A single full-width message row in the table: loading and empty states */
export function messageRow(tbody: HTMLElement, text: string) {
  const tr = document.createElement("tr");
  const td = document.createElement("td");
  td.colSpan = 4;
  td.className = "nd-empty";
  td.textContent = text;
  tr.append(td);
  tbody.replaceChildren(tr);
}
