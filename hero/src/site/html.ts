/** Render context. Templates run inside vite.config at build time, so nothing here may touch the DOM. */
export type Ctx = { base: string };

const ENTITIES: Record<string, string> = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };

export const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ENTITIES[c]);

/** Resolve a site path against the deploy base. Hashes, data URIs and absolute URLs pass through. */
export const href = (ctx: Ctx, path: string) => (/^(#|[a-z]+:)/i.test(path) ? path : ctx.base + path);

export const media = (ctx: Ctx, src: string) => (src.startsWith("data:") ? src : `${ctx.base}media/${src}`);

export const list = <T>(items: readonly T[], fn: (item: T, i: number) => string) => items.map(fn).join("");

export const pad = (n: number) => String(n).padStart(2, "0");

export const isExternal = (url: string) => /^https?:/.test(url);

export const extAttrs = (url: string) => (isExternal(url) ? ' target="_blank" rel="noopener noreferrer"' : "");
