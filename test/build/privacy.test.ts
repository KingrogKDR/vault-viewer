import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { parseHTML } from "linkedom";
import { buildFixtureVault, cleanupTempDirs, type SiteBuild } from "../harness/site-build";

/** Parse Cloudflare's `_headers` format: a path line, then indented `Name: value` lines. */
function parseHeadersFile(text: string): Map<string, Record<string, string>> {
  const rules = new Map<string, Record<string, string>>();
  let current: Record<string, string> | undefined;
  for (const line of text.split("\n")) {
    if (line.trim() === "" || line.trim().startsWith("#")) continue;
    if (/^\s/.test(line)) {
      if (!current) throw new Error(`Header line before any path: ${line}`);
      const colon = line.indexOf(":");
      if (colon === -1) throw new Error(`Malformed header line: ${line}`);
      current[line.slice(0, colon).trim()] = line.slice(colon + 1).trim();
    } else {
      current = {};
      rules.set(line.trim(), current);
    }
  }
  return rules;
}

let build: SiteBuild;

beforeAll(async () => {
  build = await buildFixtureVault({
    "Garden Plans.md": "# Garden Plans\n\nTomatoes go by the fence.\n",
    "Recipes/Soup.md": "# Soup\n\nLeeks and potatoes.\n",
  });
}, 30_000);

afterAll(cleanupTempDirs);

describe("privacy headers and robots rules", () => {
  test("_headers sends noindex, no-referrer and nosniff on every path", async () => {
    expect(build.ok).toBe(true);
    const rules = parseHeadersFile(await build.file("_headers"));
    expect(rules.get("/*")).toMatchObject({
      "X-Robots-Tag": "noindex, nofollow",
      "Referrer-Policy": "no-referrer",
      "X-Content-Type-Options": "nosniff",
    });
  });

  test("robots.txt disallows everything for every user agent", async () => {
    const lines = (await build.file("robots.txt"))
      .split("\n")
      .map((line) => line.replace(/#.*/, "").trim())
      .filter(Boolean)
      .map((line) => {
        const colon = line.indexOf(":");
        return [line.slice(0, colon).trim().toLowerCase(), line.slice(colon + 1).trim()];
      });
    expect(lines).toEqual([
      ["user-agent", "*"],
      ["disallow", "/"],
    ]);
  });

  test("every HTML page carries a robots noindex, nofollow meta tag", async () => {
    const pages = await build.htmlPages();
    expect(pages).toContain("garden-plans/index.html");
    expect(pages).toContain("recipes/soup/index.html");
    for (const path of pages) {
      const doc = parseHTML(await build.file(path)).document;
      const robots = doc.querySelector('head meta[name="robots"]');
      expect({ path, content: robots?.getAttribute("content") }).toEqual({ path, content: "noindex, nofollow" });
    }
  });
});
