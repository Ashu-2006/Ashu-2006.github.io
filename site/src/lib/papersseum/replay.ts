/**
 * Papersseum's recorded-match format ("PSRP" v1, written by web/scripts/make_replay.py), ported from
 * web/features/replay/replay-format.ts and web/lib/arena/events.ts. A header holds frame 0's cells and heads; each
 * later frame stores the heads and only the cells that changed, so a 3-minute, 5-player match is about 70 KB gzipped.
 */
import { PLAYER_COLORS } from "./character";

export const OUTSIDE = 0xfe;
const NONE = 15;
const TRAIL_ALPHA = 0.45;
const FIXED = 12;
export const DECISIONS_PER_SECOND = 10;

export type Replay = {
  height: number;
  width: number;
  frames: number;
  players: number;
  initial: Uint8Array;
  heads: Uint8Array;
  diffStart: Uint32Array;
  diffIndex: Uint16Array;
  diffValue: Uint8Array;
};

export function decodeReplay(bytes: Uint8Array): Replay {
  if (String.fromCharCode(...bytes.subarray(0, 4)) !== "PSRP" || bytes[4] !== 1) throw new Error("not a Papersseum replay");
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const height = view.getUint16(5, true);
  const width = view.getUint16(7, true);
  const frames = view.getUint16(9, true);
  const players = bytes[11];
  const cells = height * width;
  const headBytes = players * 2;
  const initial = bytes.slice(FIXED, FIXED + cells);
  const heads = new Uint8Array(frames * headBytes);
  heads.set(bytes.subarray(FIXED + cells, FIXED + cells + headBytes), 0);
  const diffStart = new Uint32Array(frames + 1);
  const index: number[] = [];
  const value: number[] = [];
  let off = FIXED + cells + headBytes;
  for (let f = 1; f < frames; f++) {
    heads.set(bytes.subarray(off, off + headBytes), f * headBytes);
    off += headBytes;
    const n = view.getUint16(off, true);
    off += 2;
    diffStart[f] = index.length;
    for (let k = 0; k < n; k++, off += 3) {
      index.push(view.getUint16(off, true));
      value.push(bytes[off + 2]);
    }
    diffStart[f + 1] = index.length;
  }
  return { height, width, frames, players, initial, heads, diffStart, diffIndex: Uint16Array.from(index), diffValue: Uint8Array.from(value) };
}

export function applyFrame(cells: Uint8Array, r: Replay, frame: number) {
  for (let k = r.diffStart[frame]; k < r.diffStart[frame + 1]; k++) cells[r.diffIndex[k]] = r.diffValue[k];
}

export function headsAt(r: Replay, frame: number): ([number, number] | null)[] {
  const out: ([number, number] | null)[] = [];
  for (let p = 0; p < r.players; p++) {
    const at = (frame * r.players + p) * 2;
    out.push(r.heads[at] === 255 && r.heads[at + 1] === 255 ? null : [r.heads[at], r.heads[at + 1]]);
  }
  return out;
}

/** Frame index as match time: 835 -> "1:23" */
export function clock(frame: number) {
  const s = Math.floor(frame / DECISIONS_PER_SECOND);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

const rgb = (hex: string) => {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255] as [number, number, number];
};

/** RGBA for every possible cell byte: ground, a player's land, or a player's trail at 45% over ground */
export function colorTable(ground: string) {
  const g = rgb(ground);
  const players = PLAYER_COLORS.map(rgb);
  const table = new Uint8ClampedArray(256 * 4);
  for (let v = 0; v < 256; v++) {
    let c: [number, number, number] | null = g;
    const owner = v & 15;
    const trail = v >> 4;
    if (v === OUTSIDE) c = null;
    else if (owner !== NONE && owner < players.length) c = players[owner];
    else if (trail !== NONE && trail < players.length) c = [0, 1, 2].map((i) => Math.round(g[i] + (players[trail][i] - g[i]) * TRAIL_ALPHA)) as [number, number, number];
    if (c) table.set([...c, 255], v * 4);
  }
  return table;
}

export function paint(out: Uint8ClampedArray, cells: Uint8Array, table: Uint8ClampedArray) {
  for (let i = 0; i < cells.length; i++) {
    const t = cells[i] * 4;
    out[i * 4] = table[t];
    out[i * 4 + 1] = table[t + 1];
    out[i * 4 + 2] = table[t + 2];
    out[i * 4 + 3] = table[t + 3];
  }
}

export function coverage(cells: Uint8Array, players: number) {
  const owned = new Array<number>(players).fill(0);
  let playable = 0;
  for (const v of cells) {
    if (v === OUTSIDE) continue;
    playable++;
    if ((v & 15) < players) owned[v & 15]++;
  }
  return owned.map((n) => (playable ? n / playable : 0));
}

export type ArenaEvent = { frame: number; kind: "death" | "capture" | "lead"; slot: number; cells?: number };
const CAPTURE_MIN_CELLS = 20;
const LEAD_MARGIN_CELLS = 10;
const KEY_CAPTURE_SHARE = 0.04;

/**
 * Key moments from the recording alone: a head leaving the board is a knockout, a jump of 20+ owned cells is a
 * capture, the most territory changing hands by 10+ cells is a lead change. Only captures of 4% of the arena or more
 * make the timeline, so routine land-grabs don't bury the knockouts.
 */
export function keyMoments(r: Replay): ArenaEvent[] {
  const out: ArenaEvent[] = [];
  const owned = new Int32Array(r.players);
  const cells = r.initial.slice();
  let playable = 0;
  for (const v of cells) {
    if (v === OUTSIDE) continue;
    playable++;
    if ((v & 15) < r.players) owned[v & 15]++;
  }
  let prev = headsAt(r, 0);
  let leader = -1;
  for (let f = 1; f < r.frames; f++) {
    const before = owned.slice();
    for (let k = r.diffStart[f]; k < r.diffStart[f + 1]; k++) {
      const i = r.diffIndex[k];
      const was = cells[i];
      const now = r.diffValue[k];
      if (was !== OUTSIDE && (was & 15) < r.players) owned[was & 15]--;
      if (now !== OUTSIDE && (now & 15) < r.players) owned[now & 15]++;
      cells[i] = now;
    }
    const heads = headsAt(r, f);
    for (let p = 0; p < r.players; p++) {
      if (prev[p] && !heads[p]) out.push({ frame: f, kind: "death", slot: p });
      const gained = owned[p] - before[p];
      if (gained >= CAPTURE_MIN_CELLS) out.push({ frame: f, kind: "capture", slot: p, cells: gained });
    }
    let top = 0;
    for (let p = 1; p < r.players; p++) if (owned[p] > owned[top]) top = p;
    const ahead = leader < 0 ? owned[top] - Math.max(0, ...Array.from(owned).filter((_, p) => p !== top)) : owned[top] - owned[leader];
    if (top !== leader && ahead >= LEAD_MARGIN_CELLS) {
      leader = top;
      out.push({ frame: f, kind: "lead", slot: top });
    }
    prev = heads;
  }
  const big = Math.max(CAPTURE_MIN_CELLS, Math.round(playable * KEY_CAPTURE_SHARE));
  return out.filter((e) => e.kind !== "capture" || (e.cells ?? 0) >= big);
}
