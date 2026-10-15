import { LEDE, PLAY } from "../content";
import { esc, pad2 } from "../lib/html";

export const GAME = {
  title: "Night Drive",
  note: "A road game in the TV. Steer a '70s coupe through the evening and pick up cassettes before the clock runs out.",
};

/** Channel 1 is the game, the rest are playground pieces in content order */
export const CHANNELS = [{ kind: "game" as const, title: GAME.title }, ...PLAY.map((p) => ({ kind: "play" as const, title: p.title }))];

const facts = (rows: [string, string][]) =>
  `<dl class="den__facts">${rows.map(([k, v]) => `<div><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>`).join("")}</dl>`;

/** What is on now. Every channel is rendered and stacked in one cell, so the block is as tall as the longest and never jumps. */
function now() {
  const game = `
      <div class="den__item" data-item="0" data-on>
        <div class="den__lead">
          <h3 class="den__title">${esc(GAME.title)}</h3>
          <p class="den__note">${esc(GAME.note)}</p>
        </div>
        <div class="den__more">${facts([
          ["Keys", "Arrows or WASD to drive, Esc to stop"],
          ["Touch", "Hold either side of the screen to steer"],
        ])}</div>
      </div>`;
  const pieces = PLAY.map(
    (p, i) => `
      <div class="den__item" data-item="${i + 1}">
        <div class="den__lead">
          <h3 class="den__title">${esc(p.title)}</h3>
          <p class="den__note">${esc(p.note)}</p>
        </div>
        <div class="den__more">
          <p class="den__why">${esc(p.why)}</p>${facts([
            ["Tools", p.tools.join(", ")],
            ["Year", p.year],
          ])}
        </div>
      </div>`,
  ).join("");
  return game + pieces;
}

/** The den TV. The guide beside it is the accessible way to change channel and the text record of every piece. */
export function den(_base: string) {
  const guide = CHANNELS.map(
    (c, i) => `
        <li><button class="guide__item" type="button" data-channel="${i}" aria-pressed="${i === 0}"><span class="guide__no">${pad2(i + 1)}</span><span class="guide__title">${esc(c.title)}</span></button></li>`,
  ).join("");

  return `
<section class="den" id="playground" data-theme="avocado" data-section="playground" aria-labelledby="play-title">
  <div class="den__head page-x">
    <h2 class="section-title" id="play-title">Playground</h2>
    <p class="lede den__lede">${esc(LEDE.play)}</p>
  </div>
  <div class="den__body page-x">
    <div class="tv" data-tv>
      <div class="tv__cabinet">
        <div class="tv__bezel">
          <div class="tv__screen" data-screen data-cursor="play">
            <canvas class="tv__crt" data-crt role="img" aria-label="${esc(GAME.title)}" tabindex="-1"></canvas>
            <span class="tv__glass" aria-hidden="true"></span>
          </div>
        </div>
        <div class="tv__panel">
          <div class="tv__control">
            <div class="tv__dial" style="--n: ${CHANNELS.length}">
              <div class="knob" data-knob-channel data-cursor="drag" role="slider" tabindex="0" aria-label="Channel" aria-valuemin="1" aria-valuemax="${CHANNELS.length}" aria-valuenow="1" aria-valuetext="Channel 1, ${esc(GAME.title)}"><span class="knob__grip"></span></div>
            </div>
            <span class="tv__legend" aria-hidden="true">Channel</span>
          </div>
          <div class="tv__control tv__control--sound">
            <div class="tv__dial tv__dial--sound">
              <button class="knob knob--small" type="button" role="switch" aria-checked="false" aria-label="Sound" data-sound-toggle><span class="knob__grip"></span></button>
            </div>
            <span class="tv__legend" aria-hidden="true">Sound</span>
          </div>
          <div class="tv__grille" aria-hidden="true"></div>
        </div>
      </div>
      <div class="tv__legs" aria-hidden="true"><i></i><i></i><i></i><i></i></div>
    </div>
    <div class="den__now" data-now>${now()}
    </div>
    <ol class="guide" aria-label="Channels">${guide}
    </ol>
  </div>
</section>`;
}
