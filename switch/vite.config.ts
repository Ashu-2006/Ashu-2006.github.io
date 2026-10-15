import { defineConfig, createServer, type Plugin, type ResolvedConfig } from "vite";
import { cpSync, createReadStream, existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { dirname, extname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(fileURLToPath(import.meta.url));
/* Read-only folders from the main site, served at <base><key>/ so the files live in one place */
const HERO_DIRS: Record<string, string> = {
  media: resolve(root, "../hero/public/media"),
  images: resolve(root, "../hero/public/images"),
};
const base = process.env.BASE_PATH || "/switch/";

const TYPES: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".mp4": "video/mp4",
  ".svg": "image/svg+xml",
};

/** Serves hero/public/media and hero/public/images in dev and copies them into the build. */
function heroMediaPlugin(): Plugin {
  let config: ResolvedConfig;
  const resolveFile = (url: string) => {
    for (const [key, dir] of Object.entries(HERO_DIRS)) {
      const prefix = `${base}${key}/`;
      if (!url.startsWith(prefix)) continue;
      const file = join(dir, url.slice(prefix.length));
      return file.startsWith(dir) && existsSync(file) && statSync(file).isFile() ? file : null;
    }
    return null;
  };
  return {
    name: "hero-media",
    configResolved: (c) => void (config = c),
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const file = resolveFile(decodeURIComponent((req.url || "").split("?")[0]));
        if (!file) return next();
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
      for (const [key, dir] of Object.entries(HERO_DIRS)) cpSync(dir, resolve(config.build.outDir, key), { recursive: true });
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
              .replace("<!--chrome-->", mod.chrome(base))
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
  server: { port: 5176, fs: { allow: [resolve(root, "..")] } },
  preview: { port: 4176 },
  build: { target: "es2022", assetsInlineLimit: 0 },
});
