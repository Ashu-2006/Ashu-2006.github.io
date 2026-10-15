import { MEDIA } from "../content";

const ENTITIES: Record<string, string> = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };

export const esc = (value: string) => value.replace(/[&<>"']/g, (c) => ENTITIES[c]);

/** Media lives under hero/public/media and is served at <base>media/ */
export const mediaUrl = (base: string, file: string, ext: "jpg" | "mp4" = "jpg", small = false) =>
  `${base}media/${file}${small ? "-sm" : ""}.${ext}`;

export const mediaInfo = (file: string) => MEDIA[file] ?? { w: 1600, h: 1000 };

export const hasVideo = (file: string) => Boolean(MEDIA[file]?.video);

/**
 * An image, or a muted looping video with its poster, sized from media.json so nothing shifts on load.
 * Videos carry data-autoplay and are started and paused by the viewport observer, never by the browser.
 */
export function mediaTag(base: string, file: string, alt: string, opts: { small?: boolean; className?: string; eager?: boolean } = {}) {
  const { w, h } = mediaInfo(file);
  const cls = opts.className ? ` class="${opts.className}"` : "";
  const poster = mediaUrl(base, file, "jpg", opts.small);
  if (hasVideo(file)) {
    return `<video${cls} width="${w}" height="${h}" poster="${poster}" muted loop playsinline preload="none" data-autoplay aria-label="${esc(alt)}"><source src="${mediaUrl(base, file, "mp4")}" type="video/mp4"></video>`;
  }
  return `<img${cls} src="${poster}" width="${w}" height="${h}" alt="${esc(alt)}" ${opts.eager ? 'fetchpriority="high"' : 'loading="lazy"'} decoding="async">`;
}

export const pad2 = (n: number) => String(n).padStart(2, "0");
