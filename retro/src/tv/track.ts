/**
 * The road for Night Drive, built the Jake Gordon way: a loop of short segments, each with a curve
 * amount and a height, eased in and out so bends and crests never snap. Scenery, cassettes,
 * checkpoints and traffic hang off the segments.
 */

export const SEG = 200;
export const RUMBLE = 3;

export type Point = { world: { x: number; y: number; z: number }; camera: { x: number; y: number; z: number }; screen: { x: number; y: number; w: number; scale: number } };

export type Prop = { kind: "poplar" | "bush" | "post" | "gantry" | "start"; look: number; offset: number };
export type Pickup = { offset: number; taken: boolean };
export type Car = { z: number; offset: number; speed: number; look: number; percent: number };

export type Segment = {
  index: number;
  p1: Point;
  p2: Point;
  curve: number;
  dark: boolean;
  props: Prop[];
  cars: Car[];
  pickups: Pickup[];
  checkpoint: boolean;
  start: boolean;
  clip: number;
  fog: number;
  looped: boolean;
};

const LEN = { SHORT: 25, MEDIUM: 50, LONG: 100 };
const CURVE = { EASY: 2, MEDIUM: 4, HARD: 6 };
const HILL = { LOW: 20, MEDIUM: 40, HIGH: 60 };

const easeIn = (a: number, b: number, p: number) => a + (b - a) * p * p;
const easeInOut = (a: number, b: number, p: number) => a + (b - a) * (-Math.cos(p * Math.PI) / 2 + 0.5);

/** Seeded so every run drives the same road and the scenery never shuffles between visits */
function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const point = (z: number, y: number): Point => ({ world: { x: 0, y, z }, camera: { x: 0, y: 0, z: 0 }, screen: { x: 0, y: 0, w: 0, scale: 0 } });

export function buildTrack() {
  const segments: Segment[] = [];
  const lastY = () => (segments.length ? segments[segments.length - 1].p2.world.y : 0);

  const add = (curve: number, y: number) => {
    const n = segments.length;
    segments.push({
      index: n,
      p1: point(n * SEG, lastY()),
      p2: point((n + 1) * SEG, y),
      curve,
      dark: Math.floor(n / RUMBLE) % 2 === 1,
      props: [],
      cars: [],
      pickups: [],
      checkpoint: false,
      start: false,
      clip: 0,
      fog: 1,
      looped: false,
    });
  };
  const road = (enter: number, hold: number, leave: number, curve: number, height: number) => {
    const startY = lastY();
    const endY = startY + height * SEG;
    const total = enter + hold + leave;
    for (let n = 0; n < enter; n++) add(easeIn(0, curve, n / enter), easeInOut(startY, endY, n / total));
    for (let n = 0; n < hold; n++) add(curve, easeInOut(startY, endY, (enter + n) / total));
    for (let n = 0; n < leave; n++) add(easeInOut(curve, 0, n / leave), easeInOut(startY, endY, (enter + hold + n) / total));
  };
  const straight = (n = LEN.MEDIUM) => road(n, n, n, 0, 0);
  const hill = (n: number, h: number) => road(n, n, n, 0, h);
  const curve = (n: number, c: number, h = 0) => road(n, n, n, c, h);
  const rolling = (n = LEN.SHORT, h = HILL.LOW) => {
    road(n, n, n, 0, h / 2);
    road(n, n, n, 0, -h);
    road(n, n, n, CURVE.EASY, h);
    road(n, n, n, 0, 0);
    road(n, n, n, -CURVE.EASY, h / 2);
    road(n, n, n, 0, 0);
  };
  const sBends = () => {
    road(LEN.MEDIUM, LEN.MEDIUM, LEN.MEDIUM, -CURVE.EASY, 0);
    road(LEN.MEDIUM, LEN.MEDIUM, LEN.MEDIUM, CURVE.MEDIUM, HILL.MEDIUM);
    road(LEN.MEDIUM, LEN.MEDIUM, LEN.MEDIUM, CURVE.EASY, -HILL.LOW);
    road(LEN.MEDIUM, LEN.MEDIUM, LEN.MEDIUM, -CURVE.EASY, HILL.MEDIUM);
    road(LEN.MEDIUM, LEN.MEDIUM, LEN.MEDIUM, -CURVE.MEDIUM, -HILL.MEDIUM);
  };
  const bumps = () => [5, -2, -5, 8, 5, -7, 5, -2].forEach((h) => road(10, 10, 10, 0, h));

  straight(LEN.SHORT);
  rolling();
  curve(LEN.MEDIUM, CURVE.MEDIUM, HILL.LOW);
  bumps();
  curve(LEN.LONG, -CURVE.MEDIUM, HILL.MEDIUM);
  straight();
  sBends();
  curve(LEN.LONG, CURVE.HARD, -HILL.LOW);
  hill(LEN.MEDIUM, HILL.HIGH);
  curve(LEN.LONG, -CURVE.EASY, -HILL.MEDIUM);
  rolling(LEN.SHORT, HILL.MEDIUM);
  curve(LEN.MEDIUM, CURVE.EASY, HILL.LOW);
  /* close the loop: ease back down to the start height while bending gently */
  road(LEN.LONG, LEN.LONG, LEN.LONG, -CURVE.EASY, -lastY() / SEG);

  const length = segments.length * SEG;
  const rand = rng(1974);

  segments[10].start = true;
  segments[10].props.push({ kind: "start", look: 0, offset: 0 });
  const checkpoints: number[] = [];
  for (let i = 560; i < segments.length - 200; i += 560) {
    segments[i].checkpoint = true;
    segments[i].props.push({ kind: "gantry", look: 0, offset: 0 });
    checkpoints.push(i);
  }

  for (let i = 0; i < segments.length; i += 1) {
    const s = segments[i];
    if (i % 16 === 0 && !s.start && !s.checkpoint) {
      s.props.push({ kind: "post", look: 0, offset: -1.16 }, { kind: "post", look: 0, offset: 1.16 });
    }
    /* poplar avenues on some stretches, loose trees and bushes elsewhere */
    const avenue = Math.floor(i / 300) % 3 !== 1;
    if (avenue && i % 6 === 3) {
      s.props.push({ kind: "poplar", look: Math.floor(rand() * 4), offset: -(1.5 + rand() * 0.25) });
      s.props.push({ kind: "poplar", look: Math.floor(rand() * 4), offset: 1.5 + rand() * 0.25 });
    } else if (i % 5 === 0 && rand() < 0.6) {
      const side = rand() < 0.5 ? -1 : 1;
      s.props.push({ kind: rand() < 0.55 ? "poplar" : "bush", look: Math.floor(rand() * 4), offset: side * (1.5 + rand() * 3.5) });
    }
    if (i % 11 === 0 && rand() < 0.5) {
      s.props.push({ kind: "bush", look: Math.floor(rand() * 2), offset: (rand() < 0.5 ? -1 : 1) * (2.4 + rand() * 4) });
    }
  }

  /* cassettes come in short runs along one lane, sometimes weaving into the next */
  for (let i = 140; i < segments.length - 20; i += 170 + Math.floor(rand() * 60)) {
    let lane = [-0.6, 0, 0.6][Math.floor(rand() * 3)];
    const weave = rand() < 0.4;
    for (let k = 0; k < 5; k++) {
      segments[i + k * 4].pickups.push({ offset: lane, taken: false });
      if (weave && k === 2) lane = lane === 0 ? 0.6 : 0;
    }
  }

  const cars: Car[] = [];
  for (let n = 0; n < 44; n++) {
    const z = (80 + Math.floor(rand() * (segments.length - 120))) * SEG;
    const lane = [-0.62, 0, 0.62][Math.floor(rand() * 3)];
    const car: Car = { z, offset: lane + (rand() - 0.5) * 0.08, speed: 0, look: Math.floor(rand() * 10), percent: 0 };
    cars.push(car);
  }

  return { segments, length, checkpoints, cars, rand };
}

export type Track = ReturnType<typeof buildTrack>;

export const findSegment = (t: Track, z: number) => t.segments[Math.floor(z / SEG) % t.segments.length];
