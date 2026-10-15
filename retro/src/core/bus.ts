/** Typed events between the DOM sections, the 3D stage, sound and the router. */
export type Events = {
  /** A Side A row is hovered or focused; null when the pointer leaves the list */
  "track:hover": { slug: string | null };
  /** A project link was activated; the stage may play its exit before the route wipe */
  "track:open": { slug: string };
  "sound:change": { on: boolean };
  /** Fired after a route's markup is in the DOM and its view has mounted */
  "route:enter": { kind: "home" | "case" | "notfound"; slug?: string };
  /** Fired before the current view is destroyed */
  "route:leave": { kind: "home" | "case" | "notfound" };
  /** The loader finished; the hero entrance can play */
  "intro:done": Record<string, never>;
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
