import { defineConfig } from "astro/config";

// Astro handles routing, layout and static output only. Markdown never goes
// through Astro's markdown or content collections (ADR-0003): notes are read
// by src/lib/vault.ts and rendered by src/lib/render-note.ts.
export default defineConfig({
  output: "static",
  trailingSlash: "always",
  build: { format: "directory" },
});
