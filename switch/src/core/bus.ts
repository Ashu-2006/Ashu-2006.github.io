import type { RouteKind } from "../templates/routes";

export type Mode = "modern" | "os";
export type Phase = "idle" | "covering" | "revealing";

/** Typed events between chrome, pages, the transition layer and the OS layer. */
export type Events = {
  /** Fired after a route's markup is in the DOM and its view has mounted */
  "route:enter": { kind: RouteKind; slug?: string };
  /** Fired before the current view is destroyed */
  "route:leave": { kind: RouteKind; slug?: string };
  /** Page transition state. Hover effects and scroll reveals wait for "idle". */
  "transition:phase": { phase: Phase };
  /** The first-load intro finished; hero entrances can play */
  "intro:done": Record<string, never>;
  /** The retro switch flipped. Fired once the mode change has started. */
  "mode:change": { mode: Mode };
  /** Ask the cursor to re-resolve its target under a stationary pointer (after DOM swaps) */
  "cursor:refresh": Record<string, never>;
};

type Handler<K extends keyof Events> = (payload: Events[K]) => void;

const handlers = new Map<keyof Events, Set<Handler<never>>>();

export const bus = {
  on<K extends keyof Events>(type: K, fn: Handler<K>) {
    if (!handlers.has(type)) handlers.set(type, new Set());
    handlers.get(type)!.add(fn as Handler<never>);
    return () => bus.off(type, fn);
  },
  off<K extends keyof Events>(type: K, fn: Handler<K>) {
    handlers.get(type)?.delete(fn as Handler<never>);
  },
  emit<K extends keyof Events>(type: K, payload: Events[K]) {
    handlers.get(type)?.forEach((fn) => (fn as Handler<K>)(payload));
  },
};
