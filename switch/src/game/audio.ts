import { soundOn } from "../os/sound";

/**
 * Night Drive's sounds, ported from retro/ and synthesised on the game's own AudioContext: an engine
 * drone that follows speed, a pickup chime, a crash thud, a stage fanfare, a close pass whoosh and a
 * soft disco loop. The context is only created from a user gesture (`unlock`), nothing plays while the
 * OS speaker is muted, and `destroy` closes the context.
 */

const mtof = (m: number) => 440 * Math.pow(2, (m - 69) / 12);

type Voice = { stop(): void };
type Engine = Voice & { update(speed: number, offroad: boolean): void };

type Rig = { ctx: AudioContext; out: GainNode; noise: AudioBuffer };

function engine({ ctx, out, noise }: Rig): Engine {
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
  rumbleSrc.buffer = noise;
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
    update(speed, offroad) {
      const t = ctx.currentTime;
      const s = Math.min(1.3, speed);
      /* four gears: pitch climbs within each and drops back at the shift */
      const gear = Math.min(3, Math.floor(s * 4));
      const within = s * 4 - gear;
      const f = 34 + gear * 9 + within * 52;
      saw.frequency.setTargetAtTime(f, t, 0.06);
      sub.frequency.setTargetAtTime(f * 0.5, t, 0.06);
      lp.frequency.setTargetAtTime(180 + s * 900, t, 0.08);
      g.gain.setTargetAtTime(0.05 + Math.min(1, s) * 0.07, t, 0.1);
      rumble.gain.setTargetAtTime(offroad ? 0.06 + s * 0.18 : 0, t, 0.05);
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
function music({ ctx, out, noise }: Rig): Voice {
  const bus = ctx.createGain();
  bus.gain.value = 0;
  bus.gain.setTargetAtTime(0.3, ctx.currentTime, 0.4);
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
    src.buffer = noise;
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
      window.setTimeout(() => bus.disconnect(), 600);
    },
  };
}

export function createGameAudio() {
  let rig: Rig | null = null;
  let eng: Engine | null = null;
  let loop: Voice | null = null;

  /** The rig only exists after unlock and only answers while the OS speaker is on */
  const live = () => {
    if (!rig || !soundOn()) return null;
    if (rig.ctx.state === "suspended") void rig.ctx.resume();
    return rig;
  };

  const blip = (notes: number[], gap: number, type: OscillatorType, vol: number, len: number) => {
    const r = live();
    if (!r) return;
    const t0 = r.ctx.currentTime;
    notes.forEach((m, k) => {
      const t = t0 + k * gap;
      const o = r.ctx.createOscillator();
      o.type = type;
      o.frequency.value = mtof(m);
      const g = r.ctx.createGain();
      g.gain.setValueAtTime(vol, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + len);
      o.connect(g).connect(r.out);
      o.start(t);
      o.stop(t + len + 0.02);
    });
  };

  return {
    /** Call from a user gesture (Start, Resume): creates the context the first time */
    unlock() {
      if (rig || !soundOn()) return;
      const Ctor = window.AudioContext;
      if (!Ctor) return;
      const ctx = new Ctor();
      const out = ctx.createGain();
      out.gain.value = 0.8;
      out.connect(ctx.destination);
      const noise = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
      const n = noise.getChannelData(0);
      for (let i = 0; i < n.length; i++) n[i] = Math.random() * 2 - 1;
      rig = { ctx, out, noise };
    },
    /** Starts the engine and the loop if sound is on; safe to call every frame of play */
    start() {
      const r = live();
      if (!r) return;
      eng ??= engine(r);
      loop ??= music(r);
    },
    stop() {
      eng?.stop();
      loop?.stop();
      eng = null;
      loop = null;
    },
    get running() {
      return !!eng;
    },
    update(speed: number, offroad: boolean) {
      eng?.update(speed, offroad);
    },
    chime: () => blip([88, 95], 0.06, "square", 0.07, 0.12),
    stage: () => blip([72, 76, 79, 84], 0.07, "square", 0.06, 0.16),
    close: () => blip([84, 91], 0.04, "triangle", 0.06, 0.08),
    over: () => blip([72, 67, 64, 60], 0.16, "triangle", 0.12, 0.3),
    crash() {
      const r = live();
      if (!r) return;
      const { ctx, out, noise } = r;
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
    /** Stops everything and closes the context */
    destroy() {
      this.stop();
      const r = rig;
      rig = null;
      if (r) void r.ctx.close().catch((err: unknown) => console.warn("Night Drive: audio context did not close", err));
    },
  };
}

export type GameAudio = ReturnType<typeof createGameAudio>;
