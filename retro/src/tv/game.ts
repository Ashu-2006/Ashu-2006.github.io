import { bus } from "../core/bus";
import {
  CAR_W,
  GANTRY_W,
  LEVELS,
  PAL,
  canvas,
  cassetteIcon,
  css,
  gantryFrames,
  light,
  mix,
  mul,
  playerFrames,
  rgb,
  sceneryFrames,
  trafficFrames,
  type Frames,
  type RGB,
  type Scenery,
} from "./art";
import { createGameAudio } from "./audio";
import { SEG, buildTrack, findSegment, type Point, type Segment, type Track } from "./track";

/**
 * Night Drive: a pseudo-3D road racer in the den TV. It draws a 320x240 frame into its own canvas; the
 * CRT pass upscales it with crisp pixels. Input is only taken after the player starts it, and only
 * while the screen has focus. The sky runs from late afternoon to night over a run.
 */

export const GW = 320;
export const GH = 240;

const FOV = 100;
const CAM_H = 1000;
const ROAD_W = 1000;
const DRAW = 150;
const LANES = 3;
const DEPTH = 1 / Math.tan(((FOV / 2) * Math.PI) / 180);
const PLAYER_Z = CAM_H * DEPTH * 1.12;
const STEP = 1 / 60;
const MAX = SEG / STEP;
const ACCEL = MAX / 5;
const BRAKE = -MAX;
const DECEL = -MAX / 5;
const OFF_DECEL = -MAX / 2;
const OFF_LIMIT = MAX / 4;
const CENTRIFUGAL = 0.3;
/** Sprite pixels to road units, chosen so the player's car draws at exactly 1:1 */
const SCALE = PLAYER_Z / (DEPTH * (GW / 2) * ROAD_W);
const FOG = 4;
/** Scenery is drawn at 1 sprite pixel per car pixel, then scaled to real proportions: a poplar towers over a coupe */
const SIZE = { poplar: 2.4, bush: 1.5, post: 1.3 };
const NIGHT_AT = 125;
const START_TIME = 30;
const TOP_MPH = 124;
const BEST_KEY = "retro-night-drive-best";
const FONT8 = '8px "Press Start 2P"';
const FONT16 = '16px "Press Start 2P"';

export type GameState = "title" | "playing" | "paused" | "over";

const SKY = [
  { at: 0, top: "#d25f27", mid: "#e4a62c", low: "#f1e2c0", cloud: "#f1e2c0", under: "#d6bf92" },
  { at: 0.3, top: "#bf3426", mid: "#d25f27", low: "#e4a62c", cloud: "#f2c470", under: "#cf6a34" },
  { at: 0.55, top: "#2a1a12", mid: "#6e2a1c", low: "#c2502a", cloud: "#8a3a22", under: "#4d2a22" },
  { at: 0.78, top: "#10162a", mid: "#1f2238", low: "#4d3426", cloud: "#2a2c42", under: "#1c2034" },
  { at: 1, top: "#0b1020", mid: "#151b33", low: "#262c48", cloud: "#1f2540", under: "#161b30" },
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

type Input = { left: boolean; right: boolean; up: boolean; down: boolean };
type Particle = { x: number; y: number; vx: number; vy: number; life: number; color: string };

const KEYS: Record<string, keyof Input> = {
  ArrowLeft: "left",
  ArrowRight: "right",
  ArrowUp: "up",
  ArrowDown: "down",
  a: "left",
  A: "left",
  d: "right",
  D: "right",
  w: "up",
  W: "up",
  s: "down",
  S: "down",
};

export class NightDrive {
  readonly canvas = canvas(GW, GH);
  state: GameState = "title";
  private ctx = this.canvas.getContext("2d")!;
  private track: Track = buildTrack();
  private player: Frames = playerFrames();
  private traffic: Frames = trafficFrames();
  private scenery: Scenery = sceneryFrames();
  private gantry = gantryFrames("Checkpoint");
  private startGantry = gantryFrames(null);
  private tape = cassetteIcon();
  private audio = createGameAudio();

  private position = 0;
  private speed = 0;
  private playerX = 0;
  private input: Input = { left: false, right: false, up: false, down: false };
  private touches = new Map<number, number>();
  private touchMode = false;
  private captured = false;
  private offroad = false;
  private timeLeft = START_TIME;
  private elapsed = 0;
  private tod = 0.12;
  private score = 0;
  private tapes = 0;
  private best = 0;
  private newBest = false;
  private checks = 0;
  private lastIndex = 0;
  private skyOffset = 0;
  private hillOffset = 0;
  private treeOffset = 0;
  private clock = 0;
  private acc = 0;
  private shake = 0;
  private message: { text: string; sub: string; at: number } | null = null;
  private popups: { text: string; x: number; y: number; t: number }[] = [];
  private particles: Particle[] = [];
  private stars: { x: number; y: number; b: number }[] = [];
  private bg = { tod: -1, sky: canvas(GW, 150), far: canvas(640, 80), near: canvas(640, 132), clouds: canvas(640, 70), sun: canvas(48, 48) };
  private offSound: () => void;

  constructor(
    private opts: { reduced: boolean; coarse: boolean; onState: (s: GameState) => void },
  ) {
    this.ctx.imageSmoothingEnabled = false;
    this.touchMode = opts.coarse;
    /* the title screen opens on clear road a little past the start line */
    this.position = 70 * SEG;
    try {
      this.best = Number(localStorage.getItem(BEST_KEY)) || 0;
    } catch {
      this.best = 0;
    }
    const r = this.track.rand;
    for (let i = 0; i < 60; i++) this.stars.push({ x: Math.floor(r() * 640), y: Math.floor(r() * 96), b: r() });
    const laneSpeed = [0.34, 0.44, 0.3];
    for (const car of this.track.cars) {
      car.speed = MAX * laneSpeed[car.offset < -0.3 ? 0 : car.offset > 0.3 ? 2 : 1];
      findSegment(this.track, car.z).cars.push(car);
    }
    this.offSound = bus.on("sound:change", ({ on }) => {
      if (on && this.state === "playing") this.audio.start();
      if (!on) this.audio.stop();
    });
    /* the banner lettering needs the pixel font; redraw once it has loaded */
    document.fonts?.load(FONT16).then(() => {
      this.gantry = gantryFrames("Checkpoint");
    });
  }

  /** True when the game animates on its own and needs a steady frame loop */
  get animating() {
    return this.state === "playing" || !this.opts.reduced;
  }

  private setState(s: GameState) {
    this.state = s;
    this.opts.onState(s);
  }

  start() {
    this.position = 0;
    this.speed = 0;
    this.playerX = 0;
    this.timeLeft = START_TIME;
    this.elapsed = 0;
    this.tod = 0;
    this.score = 0;
    this.tapes = 0;
    this.checks = 0;
    this.newBest = false;
    this.lastIndex = 0;
    this.message = null;
    this.popups = [];
    this.particles = [];
    this.track.segments.forEach((s) => s.pickups.forEach((p) => (p.taken = false)));
    this.clearInput();
    this.captured = true;
    this.acc = 0;
    this.setState("playing");
    this.audio.start();
  }

  pause() {
    if (this.state !== "playing") return;
    this.clearInput();
    this.captured = false;
    this.audio.stop();
    this.setState("paused");
  }

  resume() {
    if (this.state !== "paused") return;
    this.captured = true;
    this.acc = 0;
    this.setState("playing");
    this.audio.start();
  }

  private end() {
    this.clearInput();
    this.captured = false;
    this.audio.stop();
    this.audio.over();
    this.score = Math.floor(this.score);
    if (this.score > this.best) {
      this.best = this.score;
      this.newBest = true;
      try {
        localStorage.setItem(BEST_KEY, String(this.best));
      } catch {
        /* storage blocked: the best score lasts for this visit only */
      }
    }
    this.setState("over");
  }

  private clearInput() {
    this.input.left = this.input.right = this.input.up = this.input.down = false;
    this.touches.clear();
  }

  /** Wires keyboard, pointer and touch on the TV screen. Keys are only taken while a run is live. */
  attach(el: HTMLElement) {
    let lastPointer = "mouse";
    const activate = (how: string) => {
      this.touchMode = how === "touch" || (how === "key" ? false : this.touchMode);
      el.focus({ preventScroll: true });
      if (this.state === "paused") this.resume();
      else if (this.state !== "playing") this.start();
    };
    const syncTouch = () => {
      let l = false;
      let r = false;
      this.touches.forEach((side) => (side < 0 ? (l = true) : (r = true)));
      this.input.left = l && !r;
      this.input.right = r && !l;
      this.input.down = l && r;
      this.input.up = !(l && r);
    };
    const side = (e: PointerEvent) => {
      const b = el.getBoundingClientRect();
      return e.clientX < b.left + b.width / 2 ? -1 : 1;
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (this.state === "playing" && this.captured) {
        if (e.key === "Escape") return this.pause();
        const dir = KEYS[e.key];
        if (dir) {
          this.input[dir] = true;
          e.preventDefault();
        } else if (e.key === " ") {
          this.input.down = true;
          e.preventDefault();
        }
        return;
      }
      if (e.key === "Enter") {
        e.preventDefault();
        activate("key");
      }
    };
    const onKeyUp = (e: KeyboardEvent) => {
      const dir = KEYS[e.key];
      if (dir) this.input[dir] = false;
      if (e.key === " ") this.input.down = false;
    };
    const onPointerDown = (e: PointerEvent) => {
      lastPointer = e.pointerType;
      if (this.state !== "playing" || e.pointerType === "mouse") return;
      this.touchMode = true;
      this.touches.set(e.pointerId, side(e));
      syncTouch();
    };
    const onPointerMove = (e: PointerEvent) => {
      if (!this.touches.has(e.pointerId)) return;
      this.touches.set(e.pointerId, side(e));
      syncTouch();
    };
    const onPointerUp = (e: PointerEvent) => {
      if (!this.touches.delete(e.pointerId)) return;
      syncTouch();
      if (!this.touches.size) this.input.up = this.state === "playing";
    };
    const onClick = () => {
      if (this.state !== "playing") activate(lastPointer);
    };
    const onBlur = () => this.pause();

    el.addEventListener("keydown", onKeyDown);
    el.addEventListener("keyup", onKeyUp);
    el.addEventListener("pointerdown", onPointerDown);
    el.addEventListener("pointermove", onPointerMove);
    el.addEventListener("pointerup", onPointerUp);
    el.addEventListener("pointercancel", onPointerUp);
    el.addEventListener("click", onClick);
    el.addEventListener("blur", onBlur);
    return () => {
      el.removeEventListener("keydown", onKeyDown);
      el.removeEventListener("keyup", onKeyUp);
      el.removeEventListener("pointerdown", onPointerDown);
      el.removeEventListener("pointermove", onPointerMove);
      el.removeEventListener("pointerup", onPointerUp);
      el.removeEventListener("pointercancel", onPointerUp);
      el.removeEventListener("click", onClick);
      el.removeEventListener("blur", onBlur);
    };
  }

  /** Advances the simulation in fixed steps, then draws one frame */
  frame(dt: number) {
    this.clock += dt;
    if (this.state === "playing" || this.state === "over" || (this.state === "title" && !this.opts.reduced)) {
      this.acc = Math.min(this.acc + dt, 0.25);
      while (this.acc >= STEP) {
        this.acc -= STEP;
        this.step(STEP);
      }
    }
    if (this.state === "playing") this.audio.update(this.speed / MAX, this.offroad && this.speed > 0);
    this.render();
  }

  private step(dt: number) {
    const t = this.track;
    const playerSeg = findSegment(t, this.position + PLAYER_Z);
    const playerW = (CAR_W - 4) * SCALE;
    const pct = this.speed / MAX;
    const dx = dt * 2 * pct;
    const playing = this.state === "playing";

    this.updateCars(dt);
    this.position = increase(this.position, dt * this.speed, t.length);

    if (playing && this.touchMode && !this.touches.size) this.input.up = true;

    if (this.state === "title") {
      this.speed += (MAX * 0.42 - this.speed) * dt * 2;
      this.tod = 0.12;
      this.autoSteer(playerSeg, dt);
    } else if (this.state === "over") {
      this.speed = Math.max(0, this.speed + DECEL * 1.6 * dt);
      this.playerX -= dx * pct * playerSeg.curve * CENTRIFUGAL;
    } else {
      if (this.input.left) this.playerX -= dx;
      else if (this.input.right) this.playerX += dx;
      this.playerX -= dx * pct * playerSeg.curve * CENTRIFUGAL;
      if (this.input.up && !this.input.down) this.speed += ACCEL * dt;
      else if (this.input.down) this.speed += BRAKE * dt;
      else this.speed += DECEL * dt;
    }

    this.offroad = this.playerX < -1 || this.playerX > 1;
    if (playing && this.offroad) {
      if (this.speed > OFF_LIMIT) this.speed += OFF_DECEL * dt;
      for (const prop of playerSeg.props) {
        const hits = this.propHits(prop.kind, prop.look, prop.offset);
        if (hits.some(([x, w]) => overlap(this.playerX, playerW, x, w))) {
          this.crash(MAX / 5);
          this.position = increase(playerSeg.p1.world.z, -PLAYER_Z, t.length);
          break;
        }
      }
      if (this.speed > OFF_LIMIT * 0.5 && !this.opts.reduced) this.dust();
    }
    if (playing) {
      for (const car of playerSeg.cars) {
        if (this.speed > car.speed && overlap(this.playerX, playerW, car.offset, playerW, 0.8)) {
          this.crash(car.speed * (car.speed / this.speed));
          this.position = increase(car.z, -PLAYER_Z, t.length);
          break;
        }
      }
      for (const p of playerSeg.pickups) {
        if (!p.taken && overlap(this.playerX, playerW, p.offset, 16 * SCALE * 1.5)) {
          p.taken = true;
          this.tapes++;
          this.score += 250;
          this.audio.chime();
          this.popups.push({ text: "+250", x: GW / 2, y: GH - 44, t: 0 });
        }
      }
    }

    this.playerX = clamp(this.playerX, -2.2, 2.2);
    this.speed = clamp(this.speed, 0, MAX);

    const moved = (dt * this.speed) / SEG;
    this.skyOffset = increase(this.skyOffset, 0.001 * playerSeg.curve * moved, 1);
    this.hillOffset = increase(this.hillOffset, 0.002 * playerSeg.curve * moved, 1);
    this.treeOffset = increase(this.treeOffset, 0.003 * playerSeg.curve * moved, 1);

    if (playing) {
      this.score += moved;
      this.elapsed += dt;
      this.timeLeft -= dt;
      this.tod = Math.min(1, this.elapsed / NIGHT_AT);
      this.passGates(playerSeg.index);
      if (this.timeLeft <= 0) {
        this.timeLeft = 0;
        this.end();
      }
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
    const lanes = [-0.62, 0, 0.62];
    let target = lanes.reduce((a, b) => (Math.abs(b - this.playerX) < Math.abs(a - this.playerX) ? b : a));
    const n = this.track.segments.length;
    for (let k = 1; k < 30; k++) {
      const ahead = this.track.segments[(seg.index + k) % n];
      if (ahead.cars.some((c) => Math.abs(c.offset - target) < 0.45)) {
        const free = lanes.filter((l) => !this.track.segments.slice(seg.index + 1, seg.index + 30).some((s) => s.cars.some((c) => Math.abs(c.offset - l) < 0.45)));
        if (free.length) target = free.reduce((a, b) => (Math.abs(b - this.playerX) < Math.abs(a - this.playerX) ? b : a));
        break;
      }
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

  private crash(to: number) {
    this.speed = to;
    this.shake = this.opts.reduced ? 0 : 0.28;
    this.audio.crash();
  }

  private dust() {
    if (this.particles.length > 40) return;
    const night = this.tod > 0.6;
    for (const side of [-1, 1]) {
      this.particles.push({
        x: GW / 2 + side * 26 + (Math.random() - 0.5) * 6,
        y: GH - 18,
        vx: side * (20 + Math.random() * 40),
        vy: -40 - Math.random() * 50,
        life: 0.35 + Math.random() * 0.2,
        color: Math.random() < 0.5 ? (night ? "#3a3020" : "#8a6a3a") : night ? "#2c3016" : "#6b7431",
      });
    }
  }

  private passGates(index: number) {
    const segs = this.track.segments;
    const n = segs.length;
    let i = this.lastIndex;
    let guard = 0;
    while (i !== index && guard++ < 200) {
      i = (i + 1) % n;
      if (i === 0) segs.forEach((s) => s.pickups.forEach((p) => (p.taken = false)));
      if (segs[i].checkpoint || (segs[i].start && this.elapsed > 5)) {
        const bonus = Math.max(8, 15 - this.checks);
        this.checks++;
        this.timeLeft += bonus;
        this.message = { text: "Checkpoint", sub: `+${bonus} seconds`, at: this.clock };
        this.audio.checkpoint();
      }
    }
  }

  private updateCars(dt: number) {
    const t = this.track;
    for (const car of t.cars) {
      const old = findSegment(t, car.z);
      car.z = increase(car.z, dt * car.speed, t.length);
      car.percent = (car.z % SEG) / SEG;
      const now = findSegment(t, car.z);
      if (old !== now) {
        old.cars.splice(old.cars.indexOf(car), 1);
        now.cars.push(car);
      }
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
    const camY = playerY + CAM_H * (1 - 0.06 * pct);
    const level = Math.round(this.tod * (LEVELS - 1));

    this.buildBackground();
    const sky = skyAt(this.tod);
    /* the hills hide the true horizon, so distance fades toward their haze rather than the pale sky */
    const fogC = mix(sky.low, mix(mul(rgb(PAL.chocolate3), light(this.tod)), sky.low, 0.5), 0.55);
    const shakeY = this.shake > 0 ? Math.round((Math.random() - 0.5) * 4) : this.offroad && pct > 0.3 && this.state === "playing" && !this.opts.reduced ? Math.round(Math.random()) : 0;
    g.setTransform(1, 0, 0, 1, 0, shakeY);
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

    for (let i = DRAW - 1; i > 0; i--) {
      const seg = t.segments[(baseSeg.index + i) % n];
      if (seg.p1.camera.z <= DEPTH) continue;
      for (const car of seg.cars) {
        const scale = interp(seg.p1.screen.scale, seg.p2.screen.scale, car.percent);
        const sx = interp(seg.p1.screen.x, seg.p2.screen.x, car.percent) + (scale * car.offset * ROAD_W * GW) / 2;
        const sy = interp(seg.p1.screen.y, seg.p2.screen.y, car.percent);
        this.sprite(this.traffic[level][car.look], scale, sx, sy, -0.5, -1, seg.clip);
      }
      for (const prop of seg.props) {
        const scale = seg.p1.screen.scale;
        const sx = seg.p1.screen.x + (scale * prop.offset * ROAD_W * GW) / 2;
        if (prop.kind === "gantry" || prop.kind === "start") {
          this.sprite((prop.kind === "start" ? this.startGantry : this.gantry)[level], scale, sx, seg.p1.screen.y, -0.5, -1, seg.clip);
          continue;
        }
        const img = prop.kind === "post" ? this.scenery.post[level] : prop.kind === "poplar" ? this.scenery.poplar[level][prop.look] : this.scenery.bush[level][prop.look % 2];
        this.sprite(img, scale * SIZE[prop.kind], sx, seg.p1.screen.y, prop.offset < 0 ? -1 : 0, -1, seg.clip);
      }
      for (const p of seg.pickups) {
        if (p.taken) continue;
        const scale = seg.p1.screen.scale;
        const sx = seg.p1.screen.x + (scale * p.offset * ROAD_W * GW) / 2;
        const bob = this.opts.reduced ? 0 : Math.sin(this.clock * 5 + seg.index) * 0.25;
        this.sprite(this.scenery.cassette[level], scale, sx, seg.p1.screen.y, -0.5, -1.5 + bob, seg.clip);
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
    p.screen.x = GW / 2 + (p.screen.scale * p.camera.x * GW) / 2;
    p.screen.y = GH / 2 - (p.screen.scale * p.camera.y * GH) / 2;
    p.screen.w = (p.screen.scale * ROAD_W * GW) / 2;
  }

  /** One segment, rasterised row by row so every edge lands on a whole pixel */
  private drawSegment(seg: Segment, L: RGB, fogC: RGB, head: number, maxy: number) {
    const g = this.ctx;
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
    for (let y = top; y < bottom; y++) {
      const k = (y - p2.y) / (p1.y - p2.y);
      const cx = p2.x + (p1.x - p2.x) * k;
      const w = p2.w + (p1.w - p2.w) * k;
      const r = w / 6;
      const l = Math.max(1, w / 32);
      const left = Math.round(cx - w);
      const right = Math.round(cx + w);
      g.fillStyle = grass;
      g.fillRect(0, y, GW, 1);
      g.fillStyle = rumble;
      g.fillRect(Math.round(cx - w - r), y, left - Math.round(cx - w - r), 1);
      g.fillRect(right, y, Math.round(cx + w + r) - right, 1);
      g.fillStyle = road;
      g.fillRect(left, y, right - left, 1);
      if (check) {
        const cell = (right - left) / 12;
        const row = Math.floor(k * 2);
        g.fillStyle = lit(rgb(PAL.bone), 1);
        for (let c = 0; c < 12; c++) if ((c + row) % 2 === 0) g.fillRect(Math.round(left + c * cell), y, Math.round(left + (c + 1) * cell) - Math.round(left + c * cell), 1);
      } else if (!seg.dark) {
        g.fillStyle = lane;
        const lw = (2 * w) / LANES;
        for (let i = 1; i < LANES; i++) g.fillRect(Math.round(cx - w + lw * i - l / 2), y, Math.round(l), 1);
      }
    }
  }

  private sprite(img: HTMLCanvasElement, scale: number, x: number, y: number, offX: number, offY: number, clipY: number) {
    const k = scale * (GW / 2) * SCALE * ROAD_W;
    const dw = img.width * k;
    const dh = img.height * k;
    if (dw < 1 || dh < 1) return;
    const dx = x + dw * offX;
    const dy = y + dh * offY;
    if (dx > GW || dx + dw < 0) return;
    const clipH = clipY ? Math.max(0, dy + dh - clipY) : 0;
    if (clipH >= dh) return;
    const sh = img.height - (img.height * clipH) / dh;
    this.ctx.drawImage(img, 0, 0, img.width, sh, Math.round(dx), Math.round(dy), Math.max(1, Math.round(dw)), Math.max(1, Math.round(dh - clipH)));
  }

  private drawPlayer(level: number, cameraY: number) {
    const g = this.ctx;
    const pct = this.speed / MAX;
    const steer = this.input.left ? -1 : this.input.right ? 1 : 0;
    const lean = pct > 0.02 ? steer * (pct > 0.45 ? 2 : 1) : 0;
    const brake = (this.input.down && this.state === "playing") || (this.state === "over" && this.speed > 0);
    const img = this.player[level][lean + 2 + (brake ? 5 : 0)];
    const roadY = GH / 2 - ((DEPTH / PLAYER_Z) * cameraY * GH) / 2;
    const bounce = !this.opts.reduced && pct > 0.05 && Math.random() < pct * 0.5 ? -1 : 0;
    const x = Math.round(GW / 2 - img.width / 2);
    const y = Math.round(roadY - img.height + bounce);
    g.fillStyle = "rgba(20,12,8,0.42)";
    g.fillRect(x + 4, Math.round(roadY) - 3, img.width - 8, 3);
    g.fillRect(x + 7, Math.round(roadY), img.width - 14, 1);
    g.drawImage(img, x, y);
  }

  private buildBackground() {
    const b = this.bg;
    if (Math.abs(b.tod - this.tod) < 1 / 96) return;
    b.tod = this.tod;
    const s = skyAt(this.tod);
    const L = light(this.tod);

    const sky = b.sky.getContext("2d")!;
    const img = sky.createImageData(GW, b.sky.height);
    const bands = 18;
    const colorAt = (t: number) => (t < 0.52 ? mix(s.top, s.mid, t / 0.52) : mix(s.mid, s.low, (t - 0.52) / 0.48));
    for (let y = 0; y < b.sky.height; y++) {
      const tt = Math.min(1, y / 132) * bands;
      const base = Math.floor(tt);
      const frac = tt - base;
      const c0 = colorAt(base / bands);
      const c1 = colorAt(Math.min(bands, base + 1) / bands);
      for (let x = 0; x < GW; x++) {
        const c = frac > BAYER[(y % 4) * 4 + (x % 4)] ? c1 : c0;
        const i = (y * GW + x) * 4;
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
    const dy = clamp(Math.round(playerY * 0.0009), -14, 14);
    g.drawImage(b.sky, 0, 0);
    g.fillStyle = css(skyAt(this.tod).low);
    g.fillRect(0, b.sky.height, GW, GH - b.sky.height);

    const stars = clamp((this.tod - 0.6) / 0.3, 0, 1);
    if (stars > 0) {
      for (let i = 0; i < this.stars.length; i++) {
        const s = this.stars[i];
        if (s.b > stars) continue;
        if (!this.opts.reduced && Math.sin(this.clock * 2.3 + i * 1.7) > 0.92) continue;
        const sx = Math.floor((s.x - this.skyOffset * 640 + 640) % 640);
        if (sx >= GW) continue;
        g.fillStyle = s.b < 0.3 ? PAL.bone : PAL.bone3;
        g.fillRect(sx, s.y, 1, 1);
      }
    }
    if (this.tod > 0.72) {
      const mx = Math.round((((80 - this.skyOffset * 320) % 640) + 640) % 640);
      if (mx < GW + 10) {
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
      const sx = Math.round(((230 - this.skyOffset * 640) % 640 + 640) % 640);
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

  /* ---------- text ---------- */

  private text(str: string, x: number, y: number, color: string, opts: { big?: boolean; align?: CanvasTextAlign; shadow?: boolean } = {}) {
    const g = this.ctx;
    g.font = opts.big ? FONT16 : FONT8;
    g.textAlign = opts.align ?? "left";
    g.textBaseline = "alphabetic";
    if (opts.shadow !== false) {
      g.fillStyle = PAL.chocolate;
      g.fillText(str, x + 1, y + 1);
    }
    g.fillStyle = color;
    g.fillText(str, x, y);
  }

  private panel(y: number, h: number) {
    const g = this.ctx;
    g.fillStyle = "rgba(42,26,18,0.8)";
    g.fillRect(0, y, GW, h);
    [PAL.harvest, PAL.rust, PAL.poppy].forEach((c, i) => {
      g.fillStyle = c;
      g.fillRect(0, y + i * 2, GW, 2);
      g.fillRect(0, y + h - (i + 1) * 2, GW, 2);
    });
  }

  private drawHud() {
    const blink = this.opts.reduced || this.clock % 1.1 < 0.7;
    if (this.state === "title") {
      this.panel(66, 108);
      const title = "Night Drive";
      [PAL.poppy, PAL.rust, PAL.harvest].forEach((c, i) => this.text(title, GW / 2 + 3 - i, 104 + 3 - i, c, { big: true, align: "center", shadow: false }));
      this.text(title, GW / 2, 104, PAL.bone, { big: true, align: "center", shadow: false });
      if (blink) this.text("Press Enter or tap to start", GW / 2, 130, PAL.bone, { align: "center" });
      this.text(this.touchMode ? "Hold left or right to steer" : "Arrows or WASD to drive", GW / 2, 148, PAL.bone3, { align: "center" });
      if (this.best > 0) this.text(`Best ${pad(this.best, 6)}`, GW / 2, 164, PAL.harvest, { align: "center" });
      return;
    }

    this.text("Score", 12, 20, PAL.harvest);
    this.text(pad(this.score, 6), 12, 32, PAL.bone);
    this.ctx.drawImage(this.tape, 12, 38);
    this.text(String(this.tapes), 32, 47, PAL.bone);
    this.text("Time", GW / 2, 20, PAL.harvest, { align: "center" });
    const low = this.timeLeft < 10 && this.state === "playing";
    if (!low || blink) this.text(String(Math.ceil(this.timeLeft)), GW / 2, 40, low ? PAL.poppy : PAL.bone, { big: true, align: "center" });
    const mph = Math.round((this.speed / MAX) * TOP_MPH);
    this.text(`${mph} mph`, 12, GH - 10, PAL.bone);
    if (this.state === "playing" && !this.touchMode) this.text("Esc to stop", GW - 12, GH - 10, PAL.bone3, { align: "right" });

    if (this.message) {
      if (this.clock - this.message.at > 1.8) this.message = null;
      else if (this.state === "playing") {
        this.text(this.message.text, GW / 2, 84, PAL.bone, { big: true, align: "center" });
        this.text(this.message.sub, GW / 2, 100, PAL.harvest, { align: "center" });
      }
    }
    for (const p of this.popups) this.text(p.text, p.x, Math.round(p.y), PAL.harvest, { align: "center" });

    if (this.state === "paused") {
      this.panel(78, 84);
      this.text("Paused", GW / 2, 116, PAL.bone, { big: true, align: "center" });
      if (blink) this.text("Press Enter or tap to resume", GW / 2, 140, PAL.bone, { align: "center" });
    } else if (this.state === "over") {
      this.panel(62, 116);
      this.text("Time up", GW / 2, 98, PAL.bone, { big: true, align: "center" });
      this.text(`Score ${pad(this.score, 6)}`, GW / 2, 120, PAL.bone, { align: "center" });
      this.text(this.newBest ? "New best" : `Best ${pad(this.best, 6)}`, GW / 2, 136, PAL.harvest, { align: "center" });
      if (blink) this.text("Press Enter or tap to drive again", GW / 2, 160, PAL.bone, { align: "center" });
    }
  }

  destroy() {
    this.audio.stop();
    this.offSound();
  }
}
