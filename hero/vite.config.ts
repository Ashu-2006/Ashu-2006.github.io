import { defineConfig, type Plugin } from "vite";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { allPages, homeGallery, homeSections } from "./src/site/pages";
import { footer, header } from "./src/site/partials";

const root = dirname(fileURLToPath(import.meta.url));
const base = process.env.BASE_PATH || "/";
const ctx = { base };

/** Generated output. Gitignored, and wiped before every write so a removed project leaves nothing behind. */
const GENERATED = ["work", "about", "playground", "404.html"];

/**
 * Renders every content page from src/content into real HTML files before Vite resolves its inputs,
 * so each page is static, has its own URL on GitHub Pages and needs no client-side router.
 * Editing content restarts the dev server because the config imports it.
 */
function pages(): Plugin {
  const out = allPages(ctx);
  for (const path of GENERATED) rmSync(resolve(root, path), { recursive: true, force: true });
  for (const [path, html] of Object.entries(out)) {
    const file = resolve(root, path);
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, html);
  }
  const input = Object.fromEntries([["index", resolve(root, "index.html")], ...Object.keys(out).map((p) => [p.replace(/\/?index\.html$|\.html$/, "") || p, resolve(root, p)])]);

  return {
    name: "portfolio-pages",
    config: () => ({ build: { rollupOptions: { input } } }),
    transformIndexHtml: (html) =>
      html
        .replace("<!--@header-->", header(ctx))
        .replace("<!--@gallery-->", homeGallery(ctx))
        .replace("<!--@home-->", homeSections(ctx))
        .replace("<!--@footer-->", footer(ctx)),
  };
}

export default defineConfig({
  base,
  plugins: [pages()],
  /* The generated pages are wiped and rewritten on every config restart; watching them races the delete and crashes the server */
  server: { watch: { ignored: GENERATED.map((path) => `**/hero/${path}/**`).concat("**/hero/404.html") } },
});
