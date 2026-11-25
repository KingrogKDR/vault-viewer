import { defineConfig } from "astro/config";

/**
 * `astro dev` only: raw files are served by the catch-all endpoint
 * src/pages/raw/[...path].ts, and a shared page's files by
 * src/pages/s/[token]/[name].ts. Their route names have no file extension, so
 * dev applies `trailingSlash: "always"` to them and 404s `/raw/x.png`. Add the
 * slash before routing. The build writes these files at their exact paths regardless.
 */
const rawFilesInDev = {
  name: "raw-files-in-dev",
  hooks: {
    "astro:server:setup": ({ server }) => {
      server.middlewares.use((req, _res, next) => {
        const isFile = req.url?.startsWith("/raw/") || /^\/s\/[^/]+\/[^/]+$/.test(req.url ?? "");
        if (isFile && !req.url.endsWith("/")) req.url += "/";
        next();
      });
    },
  },
};

// Astro handles routing, layout and static output only. Markdown never goes
// through Astro's markdown or content collections (ADR-0003): notes are read
// by src/lib/vault.ts and rendered by src/lib/render-note.ts.
export default defineConfig({
  output: "static",
  trailingSlash: "always",
  // Bundled CSS, fonts and scripts go under /s/, the one path outside Access
  // (ADR-0006), so shared pages can load them without a login. They come from
  // this public repo only: nothing from the vault may ever be bundled.
  build: { format: "directory", assets: "s/_astro" },
  integrations: [rawFilesInDev],
});
