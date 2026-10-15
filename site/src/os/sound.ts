/**
 * The switch click, synthesised with WebAudio so there is no file to load: two short filtered noise
 * ticks (the slide and the latch) over a tiny falling thump. The tray speaker mutes it.
 */

import { read, write } from "./store";

const KEY = "switch:sound";
let ctx: AudioContext | null = null;
let noise: AudioBuffer | null = null;
let muted = read(KEY) === "off";

export const soundOn = () => !muted;

/** Mutes or unmutes every OS sound. Persists when storage is available; always applies to this page view. */
export function setSound(on: boolean) {
  muted = !on;
  write(KEY, on ? "on" : "off");
}

function audio() {
  if (!ctx) {
    const Ctor = window.AudioContext;
    if (!Ctor) return null;
    ctx = new Ctor();
    const len = Math.floor(ctx.sampleRate * 0.04);
    noise = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = noise.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3);
  }
  if (ctx.state === "suspended") void ctx.resume();
  return ctx;
}

function tick(ac: AudioContext, at: number, freq: number, gain: number) {
  if (!noise) return;
  const src = ac.createBufferSource();
  src.buffer = noise;
  const bp = ac.createBiquadFilter();
  bp.type = "bandpass";
  bp.frequency.value = freq;
  bp.Q.value = 1.4;
  const g = ac.createGain();
  g.gain.setValueAtTime(gain, at);
  g.gain.exponentialRampToValueAtTime(0.0001, at + 0.035);
  src.connect(bp).connect(g).connect(ac.destination);
  src.start(at);
  src.stop(at + 0.04);
}

/** Plays the toggle click. `up` is a touch brighter (flipping to 1998) than flipping back. */
export function click(up: boolean) {
  if (muted) return;
  const ac = audio();
  if (!ac) return;
  const t = ac.currentTime + 0.005;
  tick(ac, t, up ? 2600 : 2100, 0.22);
  tick(ac, t + 0.055, up ? 3400 : 2800, 0.3);

  const osc = ac.createOscillator();
  osc.type = "sine";
  osc.frequency.setValueAtTime(up ? 170 : 140, t + 0.05);
  osc.frequency.exponentialRampToValueAtTime(55, t + 0.11);
  const g = ac.createGain();
  g.gain.setValueAtTime(0.18, t + 0.05);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.12);
  osc.connect(g).connect(ac.destination);
  osc.start(t + 0.05);
  osc.stop(t + 0.13);
}

/** A soft single blip for the Start menu and dialogs */
export function blip() {
  if (muted) return;
  const ac = audio();
  if (!ac) return;
  tick(ac, ac.currentTime + 0.005, 1800, 0.12);
}
