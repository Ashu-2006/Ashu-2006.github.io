import { read, write } from "../os/store";

/**
 * Night Drive scores. The game only talks to the `Leaderboard` interface: `LocalLeaderboard` keeps the
 * top 10 in localStorage, `RemoteLeaderboard` talks to a small JSON API and falls back to local storage
 * when the network fails. Names are cleaned on the way in and on the way out, and always rendered as
 * text by the UI.
 *
 * API (set VITE_LEADERBOARD_URL to its base):
 *   GET  {base}/scores?limit=10      returns Entry[]
 *   POST {base}/scores {name, score} returns { rank }
 */

export type Entry = { name: string; score: number; at: string };

export interface Leaderboard {
  top(limit: number): Promise<Entry[]>;
  submit(name: string, score: number): Promise<{ rank: number | null }>;
  readonly shared: boolean;
}

export const NAME_MIN = 3;
export const NAME_MAX = 12;
const KEEP = 10;
const STORE = "nightdrive:scores";
const NAME_KEY = "nightdrive:name";

/** Drops every character outside letters, digits, space and underscore, collapses spaces, caps the length */
export function cleanName(raw: string) {
  return raw
    .replace(/[^A-Za-z0-9 _]/g, "")
    .replace(/\s+/g, " ")
    .slice(0, NAME_MAX);
}

/** A name is valid once cleaned and trimmed it is 3 to 12 characters */
export function validName(raw: string) {
  const n = cleanName(raw).trim();
  return n.length >= NAME_MIN && n.length <= NAME_MAX && n === raw.trim();
}

export const savedName = () => cleanName(read(NAME_KEY) ?? "").trim();
export const saveName = (name: string) => write(NAME_KEY, cleanName(name).trim());

const isEntry = (v: unknown): v is Entry => {
  if (!v || typeof v !== "object") return false;
  const e = v as Record<string, unknown>;
  return typeof e.name === "string" && typeof e.score === "number" && Number.isFinite(e.score) && typeof e.at === "string";
};

/** Cleans a list from storage or the network: valid shapes only, clean names, best first */
function sanitize(list: unknown): Entry[] {
  if (!Array.isArray(list)) return [];
  return list
    .filter(isEntry)
    .map((e) => ({ name: cleanName(e.name).trim(), score: Math.max(0, Math.floor(e.score)), at: e.at.slice(0, 32) }))
    .filter((e) => e.name.length >= NAME_MIN)
    .sort((a, b) => b.score - a.score);
}

export class LocalLeaderboard implements Leaderboard {
  readonly shared = false;

  private load(): Entry[] {
    const raw = read(STORE);
    if (!raw) return [];
    try {
      return sanitize(JSON.parse(raw));
    } catch (err) {
      console.warn("Night Drive: stored scores were unreadable and have been reset", err);
      return [];
    }
  }

  async top(limit: number) {
    return this.load().slice(0, limit);
  }

  async submit(name: string, score: number) {
    const clean = cleanName(name).trim();
    if (clean.length < NAME_MIN) return { rank: null };
    const entry: Entry = { name: clean, score: Math.max(0, Math.floor(score)), at: new Date().toISOString() };
    const list = this.load();
    /* ties keep the earlier run ahead, so a new entry goes after every equal score */
    let at = list.findIndex((e) => e.score < entry.score);
    if (at < 0) at = list.length;
    list.splice(at, 0, entry);
    const kept = list.slice(0, KEEP);
    write(STORE, JSON.stringify(kept));
    return { rank: at < KEEP ? at + 1 : null };
  }
}

const TIMEOUT = 8000;
const OFFLINE = "Offline, saved on this computer";

/** A refusal from the server (400 bad name or score, 429 rate limit), as opposed to no answer at all */
class Refused extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

/**
 * The shared board. When the server cannot be reached, or refuses a run, the run is saved on this
 * computer instead and `note` says why, in words the player can read.
 */
export class RemoteLeaderboard implements Leaderboard {
  readonly shared = true;
  private local = new LocalLeaderboard();
  private why: string | null = null;
  private base: string;

  constructor(base: string) {
    this.base = base.replace(/\/+$/, "");
  }

  /** Null when the last call reached the shared board, else a short sentence for the UI */
  get note() {
    return this.why;
  }

  private async call(path: string, init?: RequestInit): Promise<unknown> {
    const ctl = new AbortController();
    const timer = window.setTimeout(() => ctl.abort(), TIMEOUT);
    try {
      const res = await fetch(`${this.base}${path}`, { ...init, signal: ctl.signal, headers: { "Content-Type": "application/json" } });
      if (res.status >= 400 && res.status < 500) {
        const body: unknown = await res.json().catch(() => null);
        const msg = body && typeof body === "object" ? (body as Record<string, unknown>).error : null;
        throw new Refused(res.status, typeof msg === "string" ? msg.slice(0, 120) : `Refused (${res.status})`);
      }
      if (!res.ok) throw new Error(`Leaderboard answered ${res.status}`);
      return await res.json();
    } finally {
      window.clearTimeout(timer);
    }
  }

  async top(limit: number) {
    try {
      const list = sanitize(await this.call(`/scores?limit=${Math.max(1, Math.min(50, Math.floor(limit)))}`));
      this.why = null;
      return list.slice(0, limit);
    } catch (err) {
      console.warn("Night Drive: leaderboard unreachable, showing this computer's scores", err);
      this.why = OFFLINE;
      return this.local.top(limit);
    }
  }

  async submit(name: string, score: number) {
    const clean = cleanName(name).trim();
    try {
      const body = await this.call("/scores", { method: "POST", body: JSON.stringify({ name: clean, score: Math.max(0, Math.floor(score)) }) });
      const rank = body && typeof body === "object" ? (body as Record<string, unknown>).rank : null;
      this.why = null;
      return { rank: typeof rank === "number" && Number.isFinite(rank) && rank >= 1 ? Math.floor(rank) : null };
    } catch (err) {
      console.warn("Night Drive: score not sent, saved on this computer", err);
      if (err instanceof Refused) {
        const reason = err.status === 429 ? "Too many submissions, try again in a minute" : err.message.replace(/\.$/, "");
        this.why = `${reason}. Saved on this computer.`;
      } else this.why = OFFLINE;
      await this.local.submit(clean, score);
      return { rank: null };
    }
  }
}


/** The shared board when VITE_LEADERBOARD_URL is set, otherwise this computer's */
export function createLeaderboard(): Leaderboard {
  const url: unknown = import.meta.env.VITE_LEADERBOARD_URL;
  return typeof url === "string" && /^https?:\/\//.test(url) ? new RemoteLeaderboard(url) : new LocalLeaderboard();
}
