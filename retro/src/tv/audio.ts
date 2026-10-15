import { sound } from "../core/sound";

/**
 * Night Drive's sounds, synthesized on the site's shared context: an engine drone that follows speed,
 * a pickup chime, a crash thud, a checkpoint fanfare and a soft disco loop. Nothing is made while
 * sound is off, and everything stops when the game pauses.
 */

const mtof = (m: number) => 440 * Math.pow(2, (m - 69) / 12);

type Voice = { stop(): void };

function engine(ctx: AudioContext, out: AudioNode) {
  const saw = ctx.createOscillator();
  saw.type = "sawtooth";
  const sub = ctx.createOscillator();
  sub.type = "square";
  const lp = ctx.createBiquadFilter();
  lp.type = "lowpass";
  lp.Q.value = 3;
  lp.frequency.value = 200;
  const g = ctx.createGain();
  g.gain.value = 0;

  const rumbleSrc = ctx.createBufferSource();
  rumbleSrc.buffer = sound.noise();
  rumbleSrc.loop = true;
  const rumbleLp = ctx.createBiquadFilter();
  rumbleLp.type = "lowpass";
  rumbleLp.frequency.value = 380;
  const rumble = ctx.createGain();
  rumble.gain.value = 0;

  saw.connect(lp);
  sub.connect(lp);
  lp.connect(g).connect(out);
  rumbleSrc.connect(rumbleLp).connect(rumble).connect(out);
  saw.start();
  sub.start();
  rumbleSrc.start();

  return {
    update(speed: number, offroad: boolean) {
      const t = ctx.currentTime;
      /* four gears: pitch climbs within each and drops back at the shift */
      const gear = Math.min(3, Math.floor(speed * 4));
      const within = speed * 4 - gear;
      const f = 34 + gear * 9 + within * 52;
      saw.frequency.setTargetAtTime(f, t, 0.06);
      sub.frequency.setTargetAtTime(f * 0.5, t, 0.06);
      lp.frequency.setTargetAtTime(180 + speed * 900, t, 0.08);
      g.gain.setTargetAtTime(0.05 + speed * 0.07, t, 0.1);
      rumble.gain.setTargetAtTime(offroad ? 0.06 + speed * 0.18 : 0, t, 0.05);
    },
    stop() {
      const t = ctx.currentTime;
      g.gain.setTargetAtTime(0, t, 0.06);
      rumble.gain.setTargetAtTime(0, t, 0.04);
      saw.stop(t + 0.4);
      sub.stop(t + 0.4);
      rumbleSrc.stop(t + 0.4);
    },
  };
}

/**
 * Octave disco bass, off-beat chord stabs and a quiet hat over ii-V-I-vi, with two lead phrases so the
 * loop runs about 18 seconds before it repeats. Volumes stay under the engine.
 */
function music(ctx: AudioContext, out: AudioNode): Voice {
  const bus = ctx.createGain();
  bus.gain.value = 0;
  bus.gain.setTargetAtTime(0.32, ctx.currentTime, 0.4);
  const soft = ctx.createBiquadFilter();
  soft.type = "lowpass";
  soft.frequency.value = 2400;
  bus.connect(soft).connect(out);

  const chords = [
    [50, 62, 65, 69, 72],
    [43, 59, 62, 65, 69],
    [48, 60, 64, 67, 71],
    [45, 60, 64, 67, 69],
  ];
  const leadA = [69, 0, 0, 72, 0, 0, 74, 0, 72, 0, 69, 0, 0, 0, 0, 0, 71, 0, 0, 74, 0, 0, 77, 0, 76, 0, 74, 0, 0, 0, 0, 0, 72, 0, 0, 76, 0, 0, 79, 0, 76, 0, 72, 0, 0, 0, 0, 0, 69, 0, 72, 0, 76, 0, 0, 0, 74, 0, 72, 0, 0, 0, 0, 0];
  const leadB = [0, 0, 0, 0, 77, 0, 76, 0, 74, 0, 0, 0, 72, 0, 0, 0, 0, 0, 0, 0, 74, 0, 72, 0, 71, 0, 0, 0, 67, 0, 0, 0, 0, 0, 0, 0, 72, 0, 74, 0, 76, 0, 0, 0, 79, 0, 0, 0, 0, 0, 0, 0, 76, 0, 74, 0, 72, 0, 0, 0, 0, 0, 0, 0];
  const bpm = 108;
  const step = 60 / bpm / 4;
  let i = 0;
  let next = ctx.currentTime + 0.1;

  const note = (m: number, t: number, dur: number, type: OscillatorType, vol: number, cutoff = 0) => {
    const o = ctx.createOscillator();
    o.type = type;
    o.frequency.value = mtof(m);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(vol, t + 0.006);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    if (cutoff) {
      const f = ctx.createBiquadFilter();
      f.type = "lowpass";
      f.frequency.value = cutoff;
      o.connect(f).connect(g);
    } else o.connect(g);
    g.connect(bus);
    o.start(t);
    o.stop(t + dur + 0.02);
  };
  const hat = (t: number, vol: number) => {
    const src = ctx.createBufferSource();
    src.buffer = sound.noise();
    const hp = ctx.createBiquadFilter();
    hp.type = "highpass";
    hp.frequency.value = 7000;
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.03);
    src.connect(hp).connect(g).connect(bus);
    src.start(t, Math.random());
    src.stop(t + 0.05);
  };

  const id = window.setInterval(() => {
    while (next < ctx.currentTime + 0.15) {
      const bar = Math.floor(i / 16) % 4;
      const s = i % 16;
      const chord = chords[bar];
      if (s % 2 === 0) note(chord[0] + (s % 4 === 2 ? 12 : 0), next, step * 1.7, "triangle", 0.34);
      if (s === 6 || s === 14) chord.slice(1, 4).forEach((m) => note(m, next, step * 1.2, "square", 0.035, 1800));
      if (s % 4 === 2) hat(next, 0.05);
      const lead = (Math.floor(i / 64) % 2 === 0 ? leadA : leadB)[i % 64];
      if (lead) note(lead, next, step * 2.6, "square", 0.03, 2600);
      next += step;
      i++;
    }
  }, 30);

  return {
    stop() {
      clearInterval(id);
      bus.gain.setTargetAtTime(0, ctx.currentTime, 0.08);
      setTimeout(() => bus.disconnect(), 600);
    },
  };
}

function blip(notes: number[], gap: number, type: OscillatorType, vol: number, len: number) {
  const ctx = sound.ctx();
  const out = sound.out();
  if (!ctx || !out) return;
  const t0 = ctx.currentTime;
  notes.forEach((m, k) => {
    const t = t0 + k * gap;
    const o = ctx.createOscillator();
    o.type = type;
    o.frequency.value = mtof(m);
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + len);
    o.connect(g).connect(out);
    o.start(t);
    o.stop(t + len + 0.02);
  });
}

export function createGameAudio() {
  let eng: ReturnType<typeof engine> | null = null;
  let loop: Voice | null = null;

  return {
    /** Starts the engine and the loop if sound is on; safe to call every time play resumes */
    start() {
      const ctx = sound.ctx();
      const out = sound.out();
      if (!ctx || !out) return;
      eng ??= engine(ctx, out);
      loop ??= music(ctx, out);
    },
    stop() {
      eng?.stop();
      loop?.stop();
      eng = null;
      loop = null;
    },
    update(speed: number, offroad: boolean) {
      eng?.update(speed, offroad);
    },
    chime: () => blip([88, 95], 0.06, "square", 0.07, 0.12),
    checkpoint: () => blip([72, 76, 79, 84], 0.07, "square", 0.06, 0.16),
    over: () => blip([72, 67, 64, 60], 0.16, "triangle", 0.12, 0.3),
    crash() {
      const ctx = sound.ctx();
      const out = sound.out();
      const noise = sound.noise();
      if (!ctx || !out || !noise) return;
      const t = ctx.currentTime;
      const o = ctx.createOscillator();
      o.type = "sine";
      o.frequency.setValueAtTime(110, t);
      o.frequency.exponentialRampToValueAtTime(32, t + 0.25);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.5, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.35);
      o.connect(g).connect(out);
      o.start(t);
      o.stop(t + 0.4);
      const src = ctx.createBufferSource();
      src.buffer = noise;
      const lp = ctx.createBiquadFilter();
      lp.type = "lowpass";
      lp.frequency.value = 900;
      const ng = ctx.createGain();
      ng.gain.setValueAtTime(0.35, t);
      ng.gain.exponentialRampToValueAtTime(0.0001, t + 0.22);
      src.connect(lp).connect(ng).connect(out);
      src.start(t, Math.random());
      src.stop(t + 0.25);
    },
  };
}

export type GameAudio = ReturnType<typeof createGameAudio>;
