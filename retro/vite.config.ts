import { defineConfig, createServer, type Plugin, type ResolvedConfig } from "vite";
import { cpSync, createReadStream, existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { dirname, extname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(fileURLToPath(import.meta.url));
const heroMedia = resolve(root, "../hero/public/media");
const base = process.env.BASE_PATH || "/retro/";

const TYPES: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".mp4": "video/mp4",
  ".svg": "image/svg+xml",
};

/** Serves hero/public/media at <base>media/ in dev and copies it into the build, so the media lives in one place. */
function heroMediaPlugin(): Plugin {
  let config: ResolvedConfig;
  return {
    name: "hero-media",
    configResolved: (c) => void (config = c),
    configureServer(server) {
      const prefix = `${base}media/`;
      server.middlewares.use((req, res, next) => {
        const url = decodeURIComponent((req.url || "").split("?")[0]);
        if (!url.startsWith(prefix)) return next();
        const file = join(heroMedia, url.slice(prefix.length));
        if (!file.startsWith(heroMedia) || !existsSync(file) || !statSync(file).isFile()) return next();
        const size = statSync(file).size;
        const type = TYPES[extname(file).toLowerCase()] || "application/octet-stream";
        const range = req.headers.range;
        if (range) {
          const [startRaw, endRaw] = range.replace("bytes=", "").split("-");
          const start = Number(startRaw);
          const end = endRaw ? Number(endRaw) : size - 1;
          res.writeHead(206, {
            "Content-Range": `bytes ${start}-${end}/${size}`,
            "Accept-Ranges": "bytes",
            "Content-Length": end - start + 1,
            "Content-Type": type,
          });
          createReadStream(file, { start, end }).pipe(res);
          return;
        }
        res.writeHead(200, { "Content-Length": size, "Content-Type": type, "Accept-Ranges": "bytes" });
        createReadStream(file).pipe(res);
      });
    },
    closeBundle() {
      if (config.command !== "build") return;
      cpSync(heroMedia, resolve(config.build.outDir, "media"), { recursive: true });
    },
  };
}

/** Writes one static HTML file per route with its markup already rendered, then the client takes over. */
function prerenderPlugin(): Plugin {
  let config: ResolvedConfig;
  return {
    name: "prerender",
    apply: "build",
    configResolved: (c) => void (config = c),
    async closeBundle() {
      const outDir = config.build.outDir;
      const shell = readFileSync(resolve(outDir, "index.html"), "utf8");
      const server = await createServer({ root, configFile: false, appType: "custom", server: { middlewareMode: true }, logLevel: "error" });
      try {
        const mod = await server.ssrLoadModule("/src/templates/routes.ts");
        const pages = mod.prerender(base) as { path: string; title: string; description: string; html: string }[];
        for (const page of pages) {
          const file = resolve(outDir, page.path);
          mkdirSync(dirname(file), { recursive: true });
          writeFileSync(
            file,
            shell
              .replace(/<title>[^<]*<\/title>/, `<title>${page.title}</title>`)
              .replace(/(<meta name="description" content=")[^"]*/, `$1${page.description}`)
              .replace("<!--app-->", page.html),
          );
        }
      } finally {
        await server.close();
      }
    },
  };
}

export default defineConfig({
  base,
  plugins: [heroMediaPlugin(), prerenderPlugin()],
  server: { port: 5174, fs: { allow: [resolve(root, "..")] } },
  preview: { port: 4174 },
  build: { target: "es2022", assetsInlineLimit: 0 },
});
