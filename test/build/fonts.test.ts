import { afterAll, describe, expect, test } from "bun:test";
import { buildFixtureVault, cleanupTempDirs } from "../harness/site-build";

afterAll(cleanupTempDirs);

describe("fonts", () => {
  test("web fonts are self-hosted: every @font-face source is a file in the build, nothing is fetched from another host", async () => {
    const build = await buildFixtureVault({ "Inbox.md": "# Inbox\n\nSome text.\n" });

    expect(build.ok).toBe(true);
    const files = await build.outputFiles();
    const css = (await Promise.all(files.filter((f) => f.endsWith(".css")).map((f) => build.file(f)))).join("\n");
    const html = (await Promise.all((await build.htmlPages()).map((f) => build.file(f)))).join("\n");

    // At least one web font is declared, and each of its sources was written by the build.
    const fontFaces = `${css}\n${html}`.match(/@font-face\s*\{[^}]*\}/g) ?? [];
    expect(fontFaces.length).toBeGreaterThan(0);
    const sources = fontFaces.flatMap((face) => [...face.matchAll(/url\(\s*["']?([^"')]+)["']?\s*\)/g)].map((m) => m[1]));
    expect(sources.length).toBeGreaterThan(0);
    for (const src of sources) {
      expect(src).toStartWith("/");
      expect(files).toContain(src.slice(1));
    }

    // No page or stylesheet points at a font host or any other origin for fonts.
    for (const text of [css, html]) {
      expect(text).not.toMatch(/fonts\.(googleapis|gstatic)\.com|use\.typekit|fonts\.bunny/);
      expect(text).not.toMatch(/url\(\s*["']?(https?:)?\/\//);
    }
    expect(html).not.toMatch(/<link[^>]+href=["']?(https?:)?\/\//);
  }, 30_000);
});
