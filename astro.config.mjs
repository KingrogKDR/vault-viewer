import { defineConfig } from "astro/config";

/**
 * `astro dev` only: raw files are served by the catch-all endpoint
 * src/pages/raw/[...path].ts. Its route name has no file extension, so dev
 * applies `trailingSlash: "always"` to it and 404s `/raw/x.png`. Add the slash
 * before routing. The build writes raw files at their exact paths regardless.
 */
const rawFilesInDev = {
  name: "raw-files-in-dev",
  hooks: {
    "astro:server:setup": ({ server }) => {
      server.middlewares.use((req, _res, next) => {
        if (req.url?.startsWith("/raw/") && !req.url.endsWith("/")) req.url += "/";
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
  build: { format: "directory" },
  integrations: [rawFilesInDev],
});
