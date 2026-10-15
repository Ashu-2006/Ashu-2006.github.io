import {
  CAR_W,
  GANTRY_W,
  LEVELS,
  PAL,
  TRAFFIC_LOOKS,
  canvas,
  cassetteIcon,
  css,
  gantryFrames,
  heartIcon,
  light,
  mix,
  mul,
  playerFrames,
  rgb,
  sceneryFrames,
  token,
  trafficFrames,
  type Frames,
  type RGB,
  type Scenery,
} from "./art";
import type { GameAudio } from "./audio";
import { PixelFont } from "./font";
import { SEG, buildTrack, findSegment, type Car, type Point, type Segment, type Track } from "./track";

/**
 * Night Drive: a pseudo-3D road racer, ported from retro/ and given an end. It draws a frame 240 rows
 * tall and as wide as the window's aspect allows (240 to 432) into its own canvas; the CRT pass upscales
 * it with crisp pixels. A run has three lives and gets harder in stages: every 25 seconds a gantry
 * appears ahead, and passing under it raises the top speed and the traffic, and from stage 3 some cars
 * change lanes after blinking.
 */

export const GH = 240;
const MIN_W = 240;
const MAX_W = 432;
const MAX_H = 360;
/** Horizontal projection unit: half the original 320 wide frame, so a wider window shows more roadside, not a wider road */
const HALF = 160;

const FOV = 100;
const CAM_H = 1000;
const ROAD_W = 1000;
const DRAW = 150;
const LANES = 3;
const LANE_X = [-0.62, 0, 0.62];
const DEPTH = 1 / Math.tan(((FOV / 2) * Math.PI) / 180);
const PLAYER_Z = CAM_H * DEPTH * 1.12;
export const STEP = 1 / 60;
const MAX = SEG / STEP;
const ACCEL = MAX / 5;
const BRAKE = -MAX;
const DECEL = -MAX / 5;
const OFF_DECEL = -MAX / 2;
const OFF_LIMIT = MAX / 4;
const CENTRIFUGAL = 0.3;
/** Sprite pixels to road units, chosen so the player's car draws at exactly 1:1 */
const SCALE = PLAYER_Z / (DEPTH * HALF * ROAD_W);
const FOG = 4;
/** Scenery is drawn at 1 sprite pixel per car pixel, then scaled to real proportions: a poplar towers over a coupe */
const SIZE = { poplar: 2.4, bush: 1.5, post: 1.3 };
const NIGHT_AT = 110;
const TOP_MPH = 124;

export const LIVES = 3;
/** Seconds of ghosting after a crash */
const INVULN = 2.2;
/** Seconds between stages, counted from passing the last gantry */
export const STAGE_TIME = 25;
/** How far ahead (in segments) a new stage gantry appears: about 2.3s at stage 1 top speed */
const GANTRY_AHEAD = 140;
const CLOSE_BONUS = 50;
const CASSETTE_BONUS = 20;

/**
 * The difficulty curve. Stage 1 matches the original's traffic; each stage adds 5% top speed (capped
 * at +40% by stage 9) and 10 cars (capped at 124); from stage 3 a growing share of cars change lanes,
 * with a shorter warning blink from stage 5.
 */
export function stageRules(stage: number) {
  const s = Math.max(1, stage);
  return {
    top: Math.min(1.4, 1 + 0.05 * (s - 1)),
    cars: Math.min(124, 44 + 10 * (s - 1)),
    changers: s < 3 ? 0 : Math.min(0.5, 0.12 * (s - 2)),
    blink: s >= 5 ? 0.45 : 0.7,
  };
}

export type GameState = "title" | "playing" | "paused" | "over";

const SKY = [
  { at: 0, top: "#d25f27", mid: "#e4a62c", low: "#f1e2c0", cloud: "#f1e2c0", under: "#d6bf92" },
  { at: 0.3, top: "#bf3426", mid: "#d25f27", low: "#e4a62c", cloud: "#f2c470", under: "#cf6a34" },
  { at: 0.55, top: "#1c1640", mid: "#6e2a3c", low: "#c2502a", cloud: "#8a3a3a", under: "#4d2a3a" },
  { at: 0.78, top: "#0b0e38", mid: "#1a1f70", low: "#4d3446", cloud: "#262c66", under: "#1a1e52" },
  { at: 1, top: "#06081f", mid: "#0f1361", low: "#1d23a8", cloud: "#151b5e", under: "#0d1148" },
].map((s) => ({ at: s.at, top: rgb(s.top), mid: rgb(s.mid), low: rgb(s.low), cloud: rgb(s.cloud), under: rgb(s.under) }));

function skyAt(tod: number) {
  let i = 0;
  while (i < SKY.length - 2 && tod > SKY[i + 1].at) i++;
  const a = SKY[i];
  const b = SKY[i + 1];
  const t = Math.min(1, Math.max(0, (tod - a.at) / (b.at - a.at)));
  return { top: mix(a.top, b.top, t), mid: mix(a.mid, b.mid, t), low: mix(a.low, b.low, t), cloud: mix(a.cloud, b.cloud, t), under: mix(a.under, b.under, t) };
}

const ROADC = {
  grass: [rgb("#6b7431"), rgb(PAL.avocado)],
  road: [rgb(PAL.chocolate3), rgb("#45301f")],
  rumble: [rgb(PAL.bone), rgb(PAL.poppy)],
  lane: rgb(PAL.bone3),
};
const WARM: RGB = [1, 0.88, 0.7];
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map((v) => (v + 0.5) / 16);

const increase = (start: number, inc: number, max: number) => {
  let r = start + inc;
  while (r >= max) r -= max;
  while (r < 0) r += max;
  return r;
};
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
const interp = (a: number, b: number, p: number) => a + (b - a) * p;
const overlap = (x1: number, w1: number, x2: number, w2: number, percent = 1) => {
  const half = percent / 2;
  return !(x1 + w1 * half < x2 - w2 * half || x1 - w1 * half > x2 + w2 * half);
};
const pad = (n: number, len: number) => String(Math.max(0, Math.floor(n))).padStart(len, "0");

export type Input = { left: boolean; right: boolean; up: boolean; down: boolean };
type Particle = { x: number; y: number; vx: number; vy: number; life: number; color: string };
type Gantry = { index: number; stage: number; passed: boolean };

export type EngineOpts = {
  reduced: boolean;
  audio: GameAudio;
  onState(s: GameState): void;
  /** Called for things worth announcing to assistive tech: stages, crashes */
  onNews?(text: string): void;
};

export class NightDrive {
  readonly canvas = canvas(320, GH);
  /** Live input: the host merges keyboard and touch pad into this */
  readonly input: Input = { left: false, right: false, up: false, down: false };
  state: GameState = "title";
  /** True on touch devices: the HUD drops the keyboard hints */
  touch = false;
  /** DEV and tests only: the attract mode's lane keeping drives during play */
  autopilot = false;

  private w = 320;
  /** Frame height: 240, or more on portrait screens, where the extra rows are sky above the scene */
  private h = GH;
  private ctx = this.canvas.getContext("2d")!;
  private font = new PixelFont();
  private track: Track = buildTrack();
  private player: Frames = playerFrames();
  private traffic: Frames = trafficFrames();
  private scenery: Scenery = sceneryFrames();
  private startGantry = gantryFrames(null);
  private stageGantry: { stage: number; frames: HTMLCanvasElement[] } | null = null;
  private tape = cassetteIcon();
  private hearts = [heartIcon(true), heartIcon(false)];
  private cobalt = token("--cobalt", "#2c33f5");
  private audio: GameAudio;

  private cars: Car[] = [];
  private position = 0;
  private speed = 0;
  private playerX = 0;
  private offroad = false;
  private elapsed = 0;
  private tod = 0.12;
  private score = 0;
  private tapes = 0;
  private lives = LIVES;
  private invuln = 0;
  private stage = 1;
  private stageStart = 0;
  private gantry: Gantry | null = null;
  private overAt = 0;
  private lastIndex = 0;
  private skyOffset = 0;
  private hillOffset = 0;
  private treeOffset = 0;
  private clock = 0;
  private acc = 0;
  private shake = 0;
  private flashT = 0;
  private message: { text: string; sub: string; at: number; color: string } | null = null;
  private popups: { text: string; x: number; y: number; t: number }[] = [];
  private particles: Particle[] = [];
  private stars: { x: number; y: number; b: number }[] = [];
  private bg = { tod: -1, sky: canvas(MAX_W, 150), far: canvas(640, 80), near: canvas(640, 132), clouds: canvas(640, 70), sun: canvas(48, 48) };

  constructor(private opts: EngineOpts) {
    this.audio = opts.audio;
    this.ctx.imageSmoothingEnabled = false;
    /* the title screen opens on clear road a little past the start line */
    this.position = 70 * SEG;
    const r = this.track.rand;
    for (let i = 0; i < 60; i++) this.stars.push({ x: Math.floor(r() * 640), y: Math.floor(r() * 96), b: r() });
    this.resetTraffic();
    void this.font.load();
  }

  /** Frame width for a screen of this aspect (width over height) */
  static sizeFor(aspect: number) {
    const w = clamp(Math.round((GH * aspect) / 2) * 2, MIN_W, MAX_W);
    /* portrait windows (phones) get extra sky above the usual 240 rows instead of black bars */
    const h = clamp(Math.round(w / aspect / 2) * 2, GH, MAX_H);
    return { w, h };
  }

  /** Matches the frame to the window's aspect so the picture fills it */
  resize(aspect: number) {
    const { w, h } = NightDrive.sizeFor(aspect);
    if (w === this.w && h === this.h) return;
    this.w = w;
    this.h = h;
    this.canvas.width = w;
    this.canvas.height = h;
    this.ctx.imageSmoothingEnabled = false;
  }

  /** True when the game animates on its own and needs a steady frame loop */
  get animating() {
    return this.state === "playing" || (this.state === "over" && (this.speed > 0 || this.clock - this.overAt < 1.5)) || (this.state === "title" && !this.opts.reduced) || this.flashT > 0;
  }

  get flash() {
    return this.opts.reduced ? 0 : clamp(this.flashT / 0.22, 0, 1);
  }

  /** Read-only view of the run for the host UI and tests */
  get run() {
    return { score: Math.floor(this.score), stage: this.stage, lives: this.lives, tapes: this.tapes, elapsed: this.elapsed, speed: this.speed / MAX, cars: this.cars.length, overFor: this.state === "over" ? this.clock - this.overAt : 0, invulnerable: this.invuln > 0 };
  }

  private setState(s: GameState) {
    if (this.state === s) return;
    this.state = s;
    this.opts.onState(s);
  }

  start() {
    this.position = 0;
    this.speed = 0;
    this.playerX = 0;
    this.elapsed = 0;
    this.tod = 0;
    this.score = 0;
    this.tapes = 0;
    this.lives = LIVES;
    this.invuln = 0;
    this.stage = 1;
    this.stageStart = 0;
    this.removeGantry();
    this.lastIndex = 0;
    this.shake = 0;
    this.flashT = 0;
    this.message = { text: "Stage 1", sub: "Three lives. Go far.", at: this.clock, color: PAL.bone };
    this.popups = [];
    this.particles = [];
    this.track.segments.forEach((s) => s.pickups.forEach((p) => (p.taken = false)));
    this.resetTraffic();
    this.clearInput();
    this.acc = 0;
    this.setState("playing");
    this.audio.start();
  }

  pause() {
    if (this.state !== "playing") return;
    this.clearInput();
    this.audio.stop();
    this.setState("paused");
  }

  resume() {
    if (this.state !== "paused") return;
    this.acc = 0;
    this.setState("playing");
    this.audio.start();
  }

  /** Back to the attract loop behind the title screen */
  toTitle() {
    this.clearInput();
    this.audio.stop();
    this.removeGantry();
    this.message = null;
    this.popups = [];
    this.tod = 0.12;
    this.stage = 1;
    this.resetTraffic();
    this.setState("title");
  }

  private end() {
    this.clearInput();
    this.audio.stop();
    this.audio.over();
    this.score = Math.floor(this.score);
    this.overAt = this.clock;
    this.message = null;
    this.setState("over");
  }

  clearInput() {
    this.input.left = this.input.right = this.input.up = this.input.down = false;
  }

  /** DEV only: brings the next stage gantry up close, for testing the curve without driving 25s */
  skipStage() {
    if (this.state !== "playing") return;
    this.removeGantry();
    this.placeGantry(findSegment(this.track, this.position + PLAYER_Z).index + 24);
  }

  /** Advances the simulation in fixed steps, then draws one frame */
  frame(dt: number) {
    this.clock += dt;
    if (this.flashT > 0) this.flashT -= dt;
    if (this.state === "playing" || this.state === "over" || (this.state === "title" && !this.opts.reduced)) {
      this.acc = Math.min(this.acc + dt, 0.25);
      while (this.acc >= STEP) {
        this.acc -= STEP;
        /* above the original top speed a step would cover more than one segment; halve it so no car is skipped */
        const sub = this.speed > MAX * 0.98 ? 2 : 1;
        for (let k = 0; k < sub; k++) this.step(STEP / sub);
      }
    }
    if (this.state === "playing") this.audio.update(this.speed / MAX, this.offroad && this.speed > 0);
    this.render();
  }

  /* ---------- traffic ---------- */

  private resetTraffic() {
    for (const s of this.track.segments) s.cars.length = 0;
    this.cars = [];
    const rules = stageRules(this.stage);
    const n = this.track.segments.length;
    const rand = Math.random;
    for (let i = 0; i < rules.cars; i++) this.addCar((80 + Math.floor(rand() * (n - 120))) * SEG, rules.changers);
  }

  private addCar(z: number, changers: number) {
    const lane = Math.floor(Math.random() * 3);
    const laneSpeed = [0.34, 0.44, 0.3][lane];
    const offset = LANE_X[lane] + (Math.random() - 0.5) * 0.08;
    const car: Car = {
      z,
      offset,
      speed: MAX * (laneSpeed + (Math.random() - 0.5) * 0.06),
      look: Math.floor(Math.random() * TRAFFIC_LOOKS),
      percent: 0,
      changer: Math.random() < changers,
      target: offset,
      blink: 0,
      dir: 0,
      cool: 1 + Math.random() * 3,
      ahead: true,
    };
    this.cars.push(car);
    findSegment(this.track, z).cars.push(car);
  }

  /** Raises the traffic to a stage's rules. New cars appear out of sight, beyond the draw distance. */
  private applyStage() {
    const rules = stageRules(this.stage);
    const n = this.track.segments.length;
    const here = findSegment(this.track, this.position).index;
    while (this.cars.length < rules.cars) {
      const seg = (here + DRAW + 10 + Math.floor(Math.random() * (n - DRAW - 40))) % n;
      this.addCar(seg * SEG + Math.random() * SEG, rules.changers);
    }
    for (const car of this.cars) if (!car.changer && Math.random() < rules.changers) car.changer = true;
  }

  private updateCars(dt: number) {
    const t = this.track;
    const pz = this.position + PLAYER_Z;
    const rules = stageRules(this.stage);
    const playing = this.state === "playing";
    for (const car of this.cars) {
      const old = findSegment(t, car.z);
      car.z = increase(car.z, dt * car.speed, t.length);
      car.percent = (car.z % SEG) / SEG;
      const now = findSegment(t, car.z);
      if (old !== now) {
        old.cars.splice(old.cars.indexOf(car), 1);
        now.cars.push(car);
      }

      let rel = (car.z - pz) % t.length;
      if (rel < 0) rel += t.length;
      if (rel > t.length / 2) rel -= t.length;

      /* lane changers pick a moment while 10 to 45 segments ahead, blink, then slide one lane over */
      if (car.changer && playing) {
        if (car.cool > 0) car.cool -= dt;
        if (car.dir === 0 && car.cool <= 0 && rel > 10 * SEG && rel < 45 * SEG && Math.random() < dt * 0.9) {
          const lane = LANE_X.reduce((a, b, i) => (Math.abs(b - car.offset) < Math.abs(LANE_X[a] - car.offset) ? i : a), 0);
          const dir = lane === 0 ? 1 : lane === 2 ? -1 : Math.random() < 0.5 ? -1 : 1;
          car.dir = dir;
          car.target = LANE_X[lane + dir] + (Math.random() - 0.5) * 0.06;
          car.blink = rules.blink;
        }
        if (car.dir !== 0) {
          if (car.blink > 0) car.blink -= dt;
          else {
            car.offset += car.dir * 1.1 * dt;
            if ((car.dir > 0 && car.offset >= car.target) || (car.dir < 0 && car.offset <= car.target)) {
              car.offset = car.target;
              car.dir = 0;
              car.cool = 3 + Math.random() * 3;
            }
          }
        }
      }

      /* close pass: the player just went by, near enough to feel it, without touching */
      const ahead = rel > 0;
      if (playing && car.ahead && !ahead && rel > -3 * SEG && this.invuln <= 0) {
        const gap = Math.abs(car.offset - this.playerX);
        if (gap < 0.6 && this.speed > car.speed) {
          this.score += CLOSE_BONUS;
          this.audio.close();
          this.popups.push({ text: `Close +${CLOSE_BONUS}`, x: this.w / 2, y: GH - 48, t: 0 });
        }
      }
      car.ahead = ahead;
    }
  }

  /* ---------- stages ---------- */

  private placeGantry(index: number) {
    const segs = this.track.segments;
    let i = index % segs.length;
    while (segs[i].start) i = (i + 3) % segs.length;
    const next = this.stage + 1;
    if (this.stageGantry?.stage !== next) this.stageGantry = { stage: next, frames: gantryFrames(this.font.bake(`STAGE ${next}`, PAL.bone, 2)) };
    segs[i].props.push({ kind: "gantry", look: 0, offset: 0, stage: next });
    this.gantry = { index: i, stage: next, passed: false };
  }

  private removeGantry() {
    if (!this.gantry) return;
    const seg = this.track.segments[this.gantry.index];
    seg.props = seg.props.filter((p) => p.kind !== "gantry");
    this.gantry = null;
  }

  private passGates(index: number) {
    const segs = this.track.segments;
    const n = segs.length;
    let i = this.lastIndex;
    let guard = 0;
    while (i !== index && guard++ < 200) {
      i = (i + 1) % n;
      if (i === 0) segs.forEach((s) => s.pickups.forEach((p) => (p.taken = false)));
      if (this.gantry && !this.gantry.passed && i === this.gantry.index) {
        this.gantry.passed = true;
        this.stage = this.gantry.stage;
        this.stageStart = this.elapsed;
        this.applyStage();
        const sub = this.stage === 3 ? "Watch for blinkers" : this.stage === 2 ? "Faster, busier" : "Faster still";
        this.message = { text: `Stage ${this.stage}`, sub, at: this.clock, color: PAL.bone };
        this.audio.stage();
        this.opts.onNews?.(`Stage ${this.stage}. ${sub}.`);
      }
    }
    /* the banner comes down once it is well behind */
    if (this.gantry?.passed && (index - this.gantry.index + n) % n > 12) this.removeGantry();
  }

  /* ---------- simulation ---------- */

  private step(dt: number) {
    const t = this.track;
    const playerSeg = findSegment(t, this.position + PLAYER_Z);
    const playerW = (CAR_W - 4) * SCALE;
    const pct = this.speed / MAX;
    const dx = dt * 2 * Math.min(1.2, pct);
    const playing = this.state === "playing";
    const top = MAX * stageRules(this.stage).top;

    this.updateCars(dt);
    this.position = increase(this.position, dt * this.speed, t.length);

    if (this.state === "title") {
      this.speed += (MAX * 0.42 - this.speed) * dt * 2;
      this.tod = 0.12;
      this.autoSteer(playerSeg, dt);
    } else if (this.state === "over") {
      this.speed = Math.max(0, this.speed + DECEL * 1.6 * dt);
      this.playerX -= dx * pct * playerSeg.curve * CENTRIFUGAL;
    } else {
      if (this.autopilot) this.autoSteer(playerSeg, dt);
      if (this.input.left && !this.input.right) this.playerX -= dx;
      else if (this.input.right && !this.input.left) this.playerX += dx;
      this.playerX -= dx * pct * playerSeg.curve * CENTRIFUGAL;
      if (this.input.up && !this.input.down) this.speed += ACCEL * dt;
      else if (this.input.down) this.speed += BRAKE * dt;
      else this.speed += DECEL * dt;
    }

    this.offroad = this.playerX < -1 || this.playerX > 1;
    if (this.invuln > 0) this.invuln -= dt;
    if (playing && this.offroad) {
      if (this.speed > OFF_LIMIT) this.speed += OFF_DECEL * dt;
      if (this.invuln <= 0)
        for (const prop of playerSeg.props) {
          const hits = this.propHits(prop.kind, prop.look, prop.offset);
          if (hits.some(([x, w]) => overlap(this.playerX, playerW, x, w))) {
            this.crash(MAX / 5, increase(playerSeg.p1.world.z, -PLAYER_Z, t.length));
            /* back onto the shoulder, so the next frame is not inside the tree */
            this.playerX = clamp(this.playerX, -0.92, 0.92);
            break;
          }
        }
      if (this.speed > OFF_LIMIT * 0.5 && !this.opts.reduced) this.dust();
    }
    if (playing && this.invuln <= 0) {
      for (const car of playerSeg.cars) {
        if (this.speed > car.speed && overlap(this.playerX, playerW, car.offset, playerW, 0.8)) {
          this.crash(car.speed * (car.speed / Math.max(this.speed, 1)), increase(car.z, -PLAYER_Z, t.length));
          break;
        }
      }
    }
    if (this.state === "playing") {
      for (const p of playerSeg.pickups) {
        if (!p.taken && overlap(this.playerX, playerW, p.offset, 16 * SCALE * 1.5)) {
          p.taken = true;
          this.tapes++;
          this.score += CASSETTE_BONUS;
          this.audio.chime();
          this.popups.push({ text: `+${CASSETTE_BONUS}`, x: this.w / 2, y: GH - 44, t: 0 });
        }
      }
    }

    this.playerX = clamp(this.playerX, -2.2, 2.2);
    this.speed = clamp(this.speed, 0, this.state === "playing" ? top : Math.max(top, this.speed));

    const moved = (dt * this.speed) / SEG;
    this.skyOffset = increase(this.skyOffset, 0.001 * playerSeg.curve * moved, 1);
    this.hillOffset = increase(this.hillOffset, 0.002 * playerSeg.curve * moved, 1);
    this.treeOffset = increase(this.treeOffset, 0.003 * playerSeg.curve * moved, 1);

    if (this.state === "playing") {
      this.score += moved;
      this.elapsed += dt;
      this.tod = Math.min(1, this.elapsed / NIGHT_AT);
      if (!this.gantry && this.elapsed - this.stageStart >= STAGE_TIME) this.placeGantry(playerSeg.index + GANTRY_AHEAD);
      this.passGates(playerSeg.index);
    }
    this.lastIndex = playerSeg.index;

    for (const p of this.particles) {
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += 260 * dt;
      p.life -= dt;
    }
    this.particles = this.particles.filter((p) => p.life > 0);
    for (const p of this.popups) {
      p.t += dt;
      p.y -= 22 * dt;
    }
    this.popups = this.popups.filter((p) => p.t < 0.9);
    if (this.shake > 0) this.shake -= dt;
  }

  /** Attract mode: keep to a lane and change lanes around slower cars */
  private autoSteer(seg: Segment, dt: number) {
    let target = LANE_X.reduce((a, b) => (Math.abs(b - this.playerX) < Math.abs(a - this.playerX) ? b : a));
    const n = this.track.segments.length;
    const busy = (lane: number) => {
      for (let k = 1; k < 30; k++) if (this.track.segments[(seg.index + k) % n].cars.some((c) => Math.abs(c.offset - lane) < 0.45)) return true;
      return false;
    };
    if (busy(target)) {
      const free = LANE_X.filter((l) => !busy(l));
      if (free.length) target = free.reduce((a, b) => (Math.abs(b - this.playerX) < Math.abs(a - this.playerX) ? b : a));
    }
    this.playerX += (target - this.playerX) * Math.min(1, dt * 2.4);
    this.input.left = target < this.playerX - 0.08;
    this.input.right = target > this.playerX + 0.08;
  }

  private propHits(kind: string, look: number, offset: number): [number, number][] {
    if (kind === "gantry" || kind === "start") {
      const half = (GANTRY_W / 2 - 5) * SCALE;
      return [
        [-half, 8 * SCALE],
        [half, 8 * SCALE],
      ];
    }
    const img = kind === "post" ? this.scenery.post[0] : kind === "poplar" ? this.scenery.poplar[0][look] : this.scenery.bush[0][look % 2];
    /* sprites hang outward from their offset, so the centre sits half a width further out; trees only collide at the trunk */
    const k = SIZE[kind as keyof typeof SIZE] ?? 1;
    const center = offset + Math.sign(offset) * ((img.width * k) / 2) * SCALE;
    return [[center, (kind === "poplar" ? 6 : img.width) * k * SCALE]];
  }

  /** A crash costs a life, knocks the speed down, shakes the screen and leaves the car ghosting for a moment */
  private crash(to: number, z: number) {
    this.speed = to;
    this.position = z;
    this.lives = Math.max(0, this.lives - 1);
    this.invuln = INVULN;
    this.shake = this.opts.reduced ? 0 : 0.4;
    this.flashT = this.opts.reduced ? 0 : 0.22;
    this.audio.crash();
    if (this.lives <= 0) {
      this.opts.onNews?.("Crashed. No lives left. Game over.");
      this.end();
      return;
    }
    const sub = this.lives === 1 ? "Last life" : `${this.lives} lives left`;
    this.message = { text: "Crash", sub, at: this.clock, color: PAL.harvest };
    this.opts.onNews?.(`Crashed. ${sub}.`);
  }

  private dust() {
    if (this.particles.length > 40) return;
    const night = this.tod > 0.6;
    for (const side of [-1, 1]) {
      this.particles.push({
        x: this.w / 2 + side * 26 + (Math.random() - 0.5) * 6,
        y: GH - 18,
        vx: side * (20 + Math.random() * 40),
        vy: -40 - Math.random() * 50,
        life: 0.35 + Math.random() * 0.2,
        color: Math.random() < 0.5 ? (night ? "#3a3020" : "#8a6a3a") : night ? "#2c3016" : "#6b7431",
      });
    }
  }

  /* ---------- drawing ---------- */

  private render() {
    const g = this.ctx;
    const t = this.track;
    const baseSeg = findSegment(t, this.position);
    const basePercent = (this.position % SEG) / SEG;
    const playerSeg = findSegment(t, this.position + PLAYER_Z);
    const playerPercent = ((this.position + PLAYER_Z) % SEG) / SEG;
    const playerY = interp(playerSeg.p1.world.y, playerSeg.p2.world.y, playerPercent);
    const pct = this.speed / MAX;
    const camY = playerY + CAM_H * (1 - 0.06 * Math.min(1, pct));
    const level = Math.round(this.tod * (LEVELS - 1));

    this.buildBackground();
    const sky = skyAt(this.tod);
    /* the hills hide the true horizon, so distance fades toward their haze rather than the pale sky */
    const fogC = mix(sky.low, mix(mul(rgb(PAL.chocolate3), light(this.tod)), sky.low, 0.5), 0.55);
    let sx = 0;
    let sy = 0;
    if (this.shake > 0) {
      const k = this.shake / 0.4;
      sx = Math.round((Math.random() - 0.5) * 6 * k);
      sy = Math.round((Math.random() - 0.5) * 6 * k);
    } else if (this.offroad && pct > 0.3 && this.state === "playing" && !this.opts.reduced) sy = Math.round(Math.random());
    const oy = this.h - GH;
    if (oy > 0) {
      g.setTransform(1, 0, 0, 1, 0, 0);
      g.fillStyle = css(sky.top);
      g.fillRect(0, 0, this.w, oy + 4);
    }
    g.setTransform(1, 0, 0, 1, sx, sy + oy);
    this.drawBackground(playerY);

    const L = light(this.tod);
    const night = clamp((this.tod - 0.5) / 0.5, 0, 1);
    let maxy = GH;
    let x = 0;
    let dx = -(baseSeg.curve * basePercent);
    const n = t.segments.length;

    for (let i = 0; i < DRAW; i++) {
      const seg = t.segments[(baseSeg.index + i) % n];
      seg.looped = seg.index < baseSeg.index;
      seg.fog = 1 / Math.pow(Math.E, Math.pow(i / DRAW, 2) * FOG);
      seg.clip = maxy;
      const camZ = this.position - (seg.looped ? t.length : 0);
      this.project(seg.p1, this.playerX * ROAD_W - x, camY, camZ);
      this.project(seg.p2, this.playerX * ROAD_W - x - dx, camY, camZ);
      x += dx;
      dx += seg.curve;
      if (seg.p1.camera.z <= DEPTH || seg.p2.screen.y >= seg.p1.screen.y || seg.p2.screen.y >= maxy) continue;
      const head = night * clamp(1 - i / 34, 0, 1);
      this.drawSegment(seg, L, fogC, head, maxy);
      maxy = seg.p2.screen.y;
    }

    const blinkOn = this.opts.reduced || Math.floor(this.clock * 6) % 2 === 0;
    for (let i = DRAW - 1; i > 0; i--) {
      const seg = t.segments[(baseSeg.index + i) % n];
      if (seg.p1.camera.z <= DEPTH) continue;
      for (const car of seg.cars) {
        const scale = interp(seg.p1.screen.scale, seg.p2.screen.scale, car.percent);
        const cx = interp(seg.p1.screen.x, seg.p2.screen.x, car.percent) + scale * car.offset * ROAD_W * HALF;
        const cy = interp(seg.p1.screen.y, seg.p2.screen.y, car.percent);
        const box = this.sprite(this.traffic[level][car.look], scale, cx, cy, -0.5, -1, seg.clip);
        /* the indicator: the tail lamp on the side the car is about to move to */
        if (box && car.dir !== 0 && blinkOn) {
          const bw = Math.max(1, Math.round(box.w * 0.09));
          const bh = Math.max(1, Math.round(box.h * 0.11));
          const bx = Math.round(box.x + (car.dir < 0 ? box.w * 0.08 : box.w * 0.92 - bw));
          const by = Math.round(box.y + box.h * 0.52);
          if (by + bh <= seg.clip) {
            g.fillStyle = PAL.amber;
            g.fillRect(bx, by, bw, bh);
          }
        }
      }
      for (const prop of seg.props) {
        const scale = seg.p1.screen.scale;
        const px = seg.p1.screen.x + scale * prop.offset * ROAD_W * HALF;
        if (prop.kind === "gantry" || prop.kind === "start") {
          const frames = prop.kind === "start" ? this.startGantry : (this.stageGantry?.frames ?? this.startGantry);
          this.sprite(frames[level], scale, px, seg.p1.screen.y, -0.5, -1, seg.clip);
          continue;
        }
        const img = prop.kind === "post" ? this.scenery.post[level] : prop.kind === "poplar" ? this.scenery.poplar[level][prop.look] : this.scenery.bush[level][prop.look % 2];
        this.sprite(img, scale * SIZE[prop.kind], px, seg.p1.screen.y, prop.offset < 0 ? -1 : 0, -1, seg.clip);
      }
      for (const p of seg.pickups) {
        if (p.taken) continue;
        const scale = seg.p1.screen.scale;
        const px = seg.p1.screen.x + scale * p.offset * ROAD_W * HALF;
        const bob = this.opts.reduced ? 0 : Math.sin(this.clock * 5 + seg.index) * 0.25;
        this.sprite(this.scenery.cassette[level], scale, px, seg.p1.screen.y, -0.5, -1.5 + bob, seg.clip);
      }
      if (seg === playerSeg) this.drawPlayer(level, interp(playerSeg.p1.camera.y, playerSeg.p2.camera.y, playerPercent));
    }

    for (const p of this.particles) {
      g.fillStyle = p.color;
      g.fillRect(Math.round(p.x), Math.round(p.y), 2, 2);
    }
    g.setTransform(1, 0, 0, 1, 0, 0);
    this.drawHud();
  }

  private project(p: Point, camX: number, camY: number, camZ: number) {
    p.camera.x = p.world.x - camX;
    p.camera.y = p.world.y - camY;
    p.camera.z = p.world.z - camZ;
    p.screen.scale = DEPTH / p.camera.z;
    p.screen.x = this.w / 2 + p.screen.scale * p.camera.x * HALF;
    p.screen.y = GH / 2 - (p.screen.scale * p.camera.y * GH) / 2;
    p.screen.w = p.screen.scale * ROAD_W * HALF;
  }

  /** One segment, rasterised row by row so every edge lands on a whole pixel */
  private drawSegment(seg: Segment, L: RGB, fogC: RGB, head: number, maxy: number) {
    const g = this.ctx;
    const W = this.w;
    const d = seg.dark ? 1 : 0;
    const fog = 1 - seg.fog;
    const lit = (c: RGB, k: number) => css(mix(mix(mul(c, L), mul(c, WARM), head * k), fogC, fog));
    const grass = lit(ROADC.grass[d], 0.45);
    const road = lit(ROADC.road[d], 1);
    const rumble = lit(ROADC.rumble[d], 1);
    const lane = lit(ROADC.lane, 1);
    const segs = this.track.segments;
    const check = seg.start || segs[(seg.index + segs.length - 1) % segs.length].start;
    const p1 = seg.p1.screen;
    const p2 = seg.p2.screen;
    const top = Math.max(0, Math.ceil(p2.y));
    const bottom = Math.min(GH, Math.ceil(Math.min(p1.y, maxy)));
    const bone = check ? lit(rgb(PAL.bone), 1) : "";
    for (let y = top; y < bottom; y++) {
      const k = (y - p2.y) / (p1.y - p2.y);
      const cx = p2.x + (p1.x - p2.x) * k;
      const w = p2.w + (p1.w - p2.w) * k;
      const r = w / 6;
      const l = Math.max(1, w / 32);
      const left = Math.round(cx - w);
      const right = Math.round(cx + w);
      g.fillStyle = grass;
      g.fillRect(0, y, W, 1);
      g.fillStyle = rumble;
      g.fillRect(Math.round(cx - w - r), y, left - Math.round(cx - w - r), 1);
      g.fillRect(right, y, Math.round(cx + w + r) - right, 1);
      g.fillStyle = road;
      g.fillRect(left, y, right - left, 1);
      if (check) {
        const cell = (right - left) / 12;
        const row = Math.floor(k * 2);
        g.fillStyle = bone;
        for (let c = 0; c < 12; c++) if ((c + row) % 2 === 0) g.fillRect(Math.round(left + c * cell), y, Math.round(left + (c + 1) * cell) - Math.round(left + c * cell), 1);
      } else if (!seg.dark) {
        g.fillStyle = lane;
        const lw = (2 * w) / LANES;
        for (let i = 1; i < LANES; i++) g.fillRect(Math.round(cx - w + lw * i - l / 2), y, Math.round(l), 1);
      }
    }
  }

  /** Draws a road sprite and returns where it landed (for the indicator), or null when off screen */
  private sprite(img: HTMLCanvasElement, scale: number, x: number, y: number, offX: number, offY: number, clipY: number) {
    const k = scale * HALF * SCALE * ROAD_W;
    const dw = img.width * k;
    const dh = img.height * k;
    if (dw < 1 || dh < 1) return null;
    const dx = x + dw * offX;
    const dy = y + dh * offY;
    if (dx > this.w || dx + dw < 0) return null;
    const clipH = clipY ? Math.max(0, dy + dh - clipY) : 0;
    if (clipH >= dh) return null;
    const sh = img.height - (img.height * clipH) / dh;
    this.ctx.drawImage(img, 0, 0, img.width, sh, Math.round(dx), Math.round(dy), Math.max(1, Math.round(dw)), Math.max(1, Math.round(dh - clipH)));
    return { x: dx, y: dy, w: dw, h: dh };
  }

  private drawPlayer(level: number, cameraY: number) {
    const g = this.ctx;
    const pct = this.speed / MAX;
    const steer = this.input.left && !this.input.right ? -1 : this.input.right && !this.input.left ? 1 : 0;
    const lean = pct > 0.02 ? steer * (pct > 0.45 ? 2 : 1) : 0;
    const brake = (this.input.down && this.state === "playing") || (this.state === "over" && this.speed > 0);
    const img = this.player[level][lean + 2 + (brake ? 5 : 0)];
    const roadY = GH / 2 - ((DEPTH / PLAYER_Z) * cameraY * GH) / 2;
    const bounce = !this.opts.reduced && pct > 0.05 && Math.random() < pct * 0.5 ? -1 : 0;
    const x = Math.round(this.w / 2 - img.width / 2);
    const y = Math.round(roadY - img.height + bounce);
    g.fillStyle = "rgba(20,12,8,0.42)";
    g.fillRect(x + 4, Math.round(roadY) - 3, img.width - 8, 3);
    g.fillRect(x + 7, Math.round(roadY), img.width - 14, 1);
    /* ghosting after a crash: a blink, or a steady half tone when motion is reduced */
    if (this.invuln > 0 && this.state === "playing") {
      if (this.opts.reduced) {
        g.globalAlpha = 0.5;
        g.drawImage(img, x, y);
        g.globalAlpha = 1;
      } else if (Math.floor(this.invuln * 10) % 2 === 0) g.drawImage(img, x, y);
      return;
    }
    g.drawImage(img, x, y);
  }

  private buildBackground() {
    const b = this.bg;
    if (Math.abs(b.tod - this.tod) < 1 / 96) return;
    b.tod = this.tod;
    const s = skyAt(this.tod);
    const L = light(this.tod);

    const sky = b.sky.getContext("2d")!;
    const SW = b.sky.width;
    const img = sky.createImageData(SW, b.sky.height);
    const bands = 18;
    const colorAt = (t: number) => (t < 0.52 ? mix(s.top, s.mid, t / 0.52) : mix(s.mid, s.low, (t - 0.52) / 0.48));
    for (let y = 0; y < b.sky.height; y++) {
      const tt = Math.min(1, y / 132) * bands;
      const base = Math.floor(tt);
      const frac = tt - base;
      const c0 = colorAt(base / bands);
      const c1 = colorAt(Math.min(bands, base + 1) / bands);
      for (let x = 0; x < SW; x++) {
        const c = frac > BAYER[(y % 4) * 4 + (x % 4)] ? c1 : c0;
        const i = (y * SW + x) * 4;
        img.data[i] = c[0];
        img.data[i + 1] = c[1];
        img.data[i + 2] = c[2];
        img.data[i + 3] = 255;
      }
    }
    sky.putImageData(img, 0, 0);

    const sun = b.sun.getContext("2d")!;
    sun.clearRect(0, 0, 48, 48);
    const sunC = this.tod < 0.25 ? mix(rgb(PAL.bone), rgb(PAL.harvest), this.tod / 0.25) : mix(rgb(PAL.harvest), rgb(PAL.rust), Math.min(1, (this.tod - 0.25) / 0.25));
    const halo = mix(sunC, s.mid, 0.45);
    for (let y = -23; y <= 23; y++)
      for (let x = -23; x <= 23; x++) {
        const d = Math.sqrt(x * x + y * y);
        if (d <= 17) sun.fillStyle = css(sunC);
        else if (d <= 21 && Math.abs(x + y) % 2 === 0) sun.fillStyle = css(halo);
        else continue;
        sun.fillRect(24 + x, 24 + y, 1, 1);
      }

    const clouds = b.clouds.getContext("2d")!;
    clouds.clearRect(0, 0, 640, b.clouds.height);
    const pill = (x: number, y: number, w: number, h: number, c: string) => {
      clouds.fillStyle = c;
      for (let r = 0; r < h; r++) {
        const inset = r === 0 || r === h - 1 ? 3 : r === 1 || r === h - 2 ? 1 : 0;
        clouds.fillRect(x + inset, y + r, w - inset * 2, 1);
        clouds.fillRect(x + inset - 640, y + r, w - inset * 2, 1);
      }
    };
    [
      [40, 18, 96],
      [210, 40, 70],
      [330, 10, 120],
      [500, 30, 84],
      [590, 52, 60],
    ].forEach(([x, y, w]) => {
      pill(x + 10, y, w * 0.55, 5, css(s.cloud));
      pill(x, y + 4, w, 6, css(mix(s.cloud, s.under, 0.5)));
      pill(x + 18, y + 9, w * 0.7, 4, css(s.under));
    });

    const far = b.far.getContext("2d")!;
    far.clearRect(0, 0, 640, 80);
    far.fillStyle = css(mix(mul(rgb(PAL.chocolate3), L), s.low, 0.5));
    for (let x = 0; x < 640; x++) {
      const a = (x / 640) * Math.PI * 2;
      const h = 36 - (11 * Math.sin(a * 2 + 1) + 6 * Math.sin(a * 5 + 0.3) + 3 * Math.sin(a * 11));
      far.fillRect(x, Math.round(h), 1, 80);
    }

    const near = b.near.getContext("2d")!;
    near.clearRect(0, 0, 640, b.near.height);
    near.fillStyle = css(mix(mul(rgb(PAL.avocado2), L), s.low, 0.12));
    const r = (x: number) => Math.sin(x * 12.9898) * 43758.5453 - Math.floor(Math.sin(x * 12.9898) * 43758.5453);
    const ridge = (x: number) => {
      const a = (x / 640) * Math.PI * 2;
      return Math.round(24 - (7 * Math.sin(a * 3 + 2) + 4 * Math.sin(a * 7 + 1)));
    };
    for (let x = 0; x < 640; x++) near.fillRect(x, ridge(x), 1, b.near.height);
    for (let x = 6; x < 634; x += 9 + Math.floor(r(x) * 22)) {
      const h = 8 + Math.floor(r(x + 1) * 12);
      const base = ridge(x);
      for (let k = 0; k < h; k++) {
        const half = Math.max(0, Math.round(Math.sin((k / h) * Math.PI * 0.9) * 2.6));
        near.fillRect(x - half, base - h + k, half * 2 + 1, 1);
      }
    }
  }

  private drawBackground(playerY: number) {
    const g = this.ctx;
    const b = this.bg;
    const W = this.w;
    /* keep the sky composition centred on wide frames */
    const cx = Math.round((W - 320) / 2);
    const dy = clamp(Math.round(playerY * 0.0009), -14, 14);
    g.drawImage(b.sky, 0, 0);
    g.fillStyle = css(skyAt(this.tod).low);
    g.fillRect(0, b.sky.height, W, GH - b.sky.height);

    const stars = clamp((this.tod - 0.6) / 0.3, 0, 1);
    if (stars > 0) {
      for (let i = 0; i < this.stars.length; i++) {
        const s = this.stars[i];
        if (s.b > stars) continue;
        if (!this.opts.reduced && Math.sin(this.clock * 2.3 + i * 1.7) > 0.92) continue;
        const sx = Math.floor((s.x - this.skyOffset * 640 + 640) % 640);
        if (sx >= W) continue;
        g.fillStyle = s.b < 0.3 ? PAL.bone : PAL.bone3;
        g.fillRect(sx, s.y, 1, 1);
        /* portrait frames have extra sky above: carry the stars up into it */
        if (this.h > GH) g.fillRect((sx + 157) % W, s.y - 96, 1, 1);
      }
    }
    if (this.tod > 0.72) {
      const mx = Math.round((((80 + cx - this.skyOffset * 320) % 640) + 640) % 640);
      if (mx < W + 10) {
        for (let y = -5; y <= 5; y++) {
          const half = Math.floor(Math.sqrt(30 - y * y));
          g.fillStyle = PAL.bone;
          g.fillRect(mx - half, 34 + y, half * 2 + 1, 1);
        }
        g.fillStyle = PAL.bone3;
        g.fillRect(mx - 2, 32, 2, 2);
        g.fillRect(mx + 1, 36, 3, 2);
        g.fillRect(mx - 3, 37, 1, 1);
      }
    }
    if (this.tod < 0.56) {
      const sx = Math.round((((230 + cx - this.skyOffset * 640) % 640) + 640) % 640);
      const sy = Math.round(40 + (this.tod / 0.5) * 100);
      g.drawImage(b.sun, sx - 24, sy - 24);
    }
    const co = Math.round(this.skyOffset * 640 * 1.5) % 640;
    g.drawImage(b.clouds, -co, 4);
    g.drawImage(b.clouds, 640 - co, 4);
    const fo = Math.round(this.hillOffset * 640) % 640;
    g.drawImage(b.far, -fo, 52 + dy);
    g.drawImage(b.far, 640 - fo, 52 + dy);
    const no = Math.round(this.treeOffset * 640) % 640;
    g.drawImage(b.near, -no, 84 + dy);
    g.drawImage(b.near, 640 - no, 84 + dy);
  }

  /* ---------- HUD ---------- */

  private drawHud() {
    if (this.state === "title" || !this.font.loaded) return;
    const g = this.ctx;
    const f = this.font;
    const W = this.w;
    const oy = this.h - GH;

    f.draw(g, "Score", 10, 14, PAL.harvest);
    f.draw(g, pad(this.score, 6), 10, 30, PAL.bone, { scale: 2 });
    g.drawImage(this.tape, 10, 36);
    f.draw(g, `x${this.tapes}`, 28, 44, PAL.bone);

    f.draw(g, `Stage ${this.stage}`, W / 2, 14, PAL.bone, { align: "center" });
    /* progress to the next gantry: a cobalt bar that fills over 25 seconds, then waits under the banner */
    const bw = 44;
    const bx = Math.round(W / 2 - bw / 2);
    const p = this.gantry ? 1 : clamp((this.elapsed - this.stageStart) / STAGE_TIME, 0, 1);
    g.fillStyle = PAL.chocolate;
    g.fillRect(bx - 1, 18, bw + 2, 4);
    g.fillStyle = this.cobalt;
    if (!this.gantry || this.opts.reduced || Math.floor(this.clock * 4) % 2 === 0) g.fillRect(bx, 19, Math.round(bw * p), 2);

    for (let i = 0; i < LIVES; i++) {
      const icon = this.hearts[i < this.lives ? 0 : 1];
      g.drawImage(icon, W - 10 - (LIVES - i) * 10, 8);
    }

    const mph = Math.round((this.speed / MAX) * TOP_MPH);
    f.draw(g, `${mph} mph`, 14, this.h - 12, PAL.bone);
    if (this.state === "playing" && !this.touch) f.draw(g, "P to pause", W - 14, this.h - 12, PAL.bone3, { align: "right" });

    if (this.message) {
      const age = this.clock - this.message.at;
      if (age > 2) this.message = null;
      else if (this.state === "playing") {
        f.draw(g, this.message.text.toUpperCase(), W / 2, oy + 86, this.message.color, { scale: 3, align: "center" });
        f.draw(g, this.message.sub, W / 2, oy + 102, PAL.bone, { align: "center" });
      }
    }
    for (const pop of this.popups) f.draw(g, pop.text, pop.x, Math.round(pop.y) + oy, PAL.harvest, { align: "center" });
  }
}
