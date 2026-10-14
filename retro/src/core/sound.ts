import { bus } from "./bus";

/**
 * Every sound on the site is synthesized here with WebAudio; there are no audio files.
 * Sound is off by default, the switch is remembered across visits, nothing plays before the first
 * gesture, and every interaction reads the same in silence. Other modules (the game, the record) build on ctx() and out().
 */

const KEY = "retro-sound";
let context: AudioContext | null = null;
let master: GainNode | null = null;
let noise: AudioBuffer | null = null;
let crackle: AudioBuffer | null = null;
let crackleSrc: AudioBufferSourceNode | null = null;
let enabled = false;

try {
  enabled = localStorage.getItem(KEY) === "1";
} catch {
  enabled = false;
}

/** Audio stays silent until the visitor has interacted with the page at least once */
const activated = () => navigator.userActivation?.hasBeenActive ?? true;

/** Resume can reject when the browser still holds autoplay; the next gesture retries through unlock */
const resume = (ctx: AudioContext | null) => ctx?.resume().catch(() => undefined);

let lastHover = 0;

function ensure() {
  if (context) return context;
  const Ctor = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return null;
  context = new Ctor();
  master = context.createGain();
  master.gain.value = 0;
  master.connect(context.destination);

  noise = context.createBuffer(1, context.sampleRate * 2, context.sampleRate);
  const n = noise.getChannelData(0);
  for (let i = 0; i < n.length; i++) n[i] = Math.random() * 2 - 1;

  /* Sparse pops with a little rumble underneath: the surface noise of a played record */
  crackle = context.createBuffer(1, context.sampleRate * 4, context.sampleRate);
  const c = crackle.getChannelData(0);
  let rumble = 0;
  for (let i = 0; i < c.length; i++) {
    rumble = rumble * 0.995 + (Math.random() * 2 - 1) * 0.005;
    const pop = Math.random() < 0.0009 ? (Math.random() * 2 - 1) * (0.4 + Math.random() * 0.6) : 0;
    c[i] = rumble * 0.6 + pop;
  }
  return context;
}

function fadeMaster(to: number, seconds = 0.5) {
  if (!context || !master) return;
  const t = context.currentTime;
  master.gain.cancelScheduledValues(t);
  master.gain.setValueAtTime(master.gain.value, t);
  master.gain.linearRampToValueAtTime(to, t + seconds);
}

function startCrackle() {
  if (!context || !master || !crackle || crackleSrc) return;
  const src = context.createBufferSource();
  src.buffer = crackle;
  src.loop = true;
  const lp = context.createBiquadFilter();
  lp.type = "lowpass";
  lp.frequency.value = 5200;
  const g = context.createGain();
  g.gain.value = 0.05;
  src.connect(lp).connect(g).connect(master);
  src.start();
  crackleSrc = src;
}

function stopCrackle() {
  crackleSrc?.stop();
  crackleSrc = null;
}

function syncToggles() {
  document.querySelectorAll<HTMLElement>("[data-sound-toggle]").forEach((el) => el.setAttribute("aria-checked", String(enabled)));
}

export const sound = {
  get on() {
    return enabled;
  },
  ctx: () => (enabled && activated() ? ensure() : null),
  out: () => master,
  noise: () => noise,

  set(on: boolean) {
    enabled = on;
    try {
      localStorage.setItem(KEY, on ? "1" : "0");
    } catch {
      /* storage blocked: the switch still works for this page view */
    }
    if (on) {
      resume(ensure());
      fadeMaster(0.9, 0.5);
      startCrackle();
    } else {
      fadeMaster(0, 0.25);
      setTimeout(() => !enabled && stopCrackle(), 300);
    }
    syncToggles();
    bus.emit("sound:change", { on });
  },
  toggle() {
    sound.set(!enabled);
  },

  /** Wires every [data-sound-toggle] in the document, now and after route changes */
  bind(root: ParentNode = document) {
    syncToggles();
    root.querySelectorAll<HTMLElement>("[data-sound-toggle]").forEach((el) => {
      if (el.dataset.soundBound) return;
      el.dataset.soundBound = "1";
      el.addEventListener("click", () => sound.toggle());
    });
  },

  /** The tick for hover feedback, at most one every 150ms so sweeping a list never chatters */
  hover(pitch = 1) {
    const now = performance.now();
    if (now - lastHover < 150) return;
    lastHover = now;
    sound.tick(pitch);
  },

  /** Short dry tick: a detent, a flip, a knob click */
  tick(pitch = 1) {
    const ctx = sound.ctx();
    if (!ctx || !master || !noise) return;
    const t = ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = noise;
    const bp = ctx.createBiquadFilter();
    bp.type = "bandpass";
    bp.frequency.value = 2600 * pitch;
    bp.Q.value = 6;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.32, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.045);
    src.connect(bp).connect(g).connect(master);
    src.start(t, Math.random());
    src.stop(t + 0.06);
  },

  /** The needle landing: a low thud and a click */
  thump() {
    const ctx = sound.ctx();
    if (!ctx || !master || !noise) return;
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    osc.type = "sine";
    osc.frequency.setValueAtTime(90, t);
    osc.frequency.exponentialRampToValueAtTime(38, t + 0.18);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.5, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.3);
    osc.connect(g).connect(master);
    osc.start(t);
    osc.stop(t + 0.32);
    sound.tick(0.6);
  },

  /** TV static for a channel change */
  static(ms = 160) {
    const ctx = sound.ctx();
    if (!ctx || !master || !noise) return;
    const t = ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = noise;
    const hp = ctx.createBiquadFilter();
    hp.type = "highpass";
    hp.frequency.value = 900;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(0.22, t + 0.01);
    g.gain.setValueAtTime(0.22, t + ms / 1000);
    g.gain.exponentialRampToValueAtTime(0.0001, t + ms / 1000 + 0.08);
    src.connect(hp).connect(g).connect(master);
    src.start(t, Math.random());
    src.stop(t + ms / 1000 + 0.1);
  },

  /**
   * A continuous scratch voice. Call update() with the platter's speed relative to normal play
   * (1 = 33 1/3 rpm, negative = backwards) and stop() on release.
   */
  scratch() {
    const ctx = sound.ctx();
    if (!ctx || !master || !noise) return { update: (_v: number) => {}, stop: () => {} };
    const src = ctx.createBufferSource();
    src.buffer = noise;
    src.loop = true;
    const bp = ctx.createBiquadFilter();
    bp.type = "bandpass";
    bp.Q.value = 3.5;
    bp.frequency.value = 400;
    const g = ctx.createGain();
    g.gain.value = 0;
    src.connect(bp).connect(g).connect(master);
    src.start();
    return {
      update(v: number) {
        const s = Math.min(Math.abs(v), 6);
        const t = ctx.currentTime;
        bp.frequency.setTargetAtTime(250 + s * 520 + (v < 0 ? 180 : 0), t, 0.02);
        g.gain.setTargetAtTime(Math.min(0.55, s * 0.16), t, 0.02);
      },
      stop() {
        const t = ctx.currentTime;
        g.gain.setTargetAtTime(0, t, 0.04);
        src.stop(t + 0.3);
      },
    };
  },
};

/* Browsers only allow audio after a gesture; resume on the first one if the switch was left on */
const unlock = () => {
  if (enabled) {
    resume(ensure());
    fadeMaster(0.9, 0.6);
    startCrackle();
  }
  window.removeEventListener("pointerdown", unlock);
  window.removeEventListener("keydown", unlock);
};
window.addEventListener("pointerdown", unlock);
window.addEventListener("keydown", unlock);
