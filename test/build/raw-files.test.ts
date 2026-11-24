import { afterAll, describe, expect, test } from "bun:test";
import { buildFixtureVault, cleanupTempDirs } from "../harness/site-build";

afterAll(cleanupTempDirs);

// A valid 1x1 transparent PNG, written out by hand. Its bytes include values
// over 0x7f and CR/LF, which any text decoding or newline mangling would break.
const PNG_1X1 = new Uint8Array([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52,
  0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01, 0x08, 0x06, 0x00, 0x00, 0x00, 0x1f, 0x15, 0xc4,
  0x89, 0x00, 0x00, 0x00, 0x0d, 0x49, 0x44, 0x41, 0x54, 0x78, 0x9c, 0x63, 0x00, 0x01, 0x00, 0x00,
  0x05, 0x00, 0x01, 0x0d, 0x0a, 0x2d, 0xb4, 0x00, 0x00, 0x00, 0x00, 0x49, 0x45, 0x4e, 0x44, 0xae,
  0x42, 0x60, 0x82,
]);

describe("raw files", () => {
  test("a binary image's raw file, reached from its download link, is byte-identical", async () => {
    const build = await buildFixtureVault({
      "Inbox.md": "# Inbox\n",
      "Été/Café Plan.png": PNG_1X1,
    });

    expect(build.ok).toBe(true);
    const href = (await build.page("/été/café-plan.png/")).querySelector("main a[download]")!.getAttribute("href")!;
    expect(href).toBe("/raw/%C3%A9t%C3%A9/caf%C3%A9-plan.png");
    expect(await build.bytes(decodeURI(href))).toEqual(PNG_1X1);
  }, 30_000);

  test("a note's markdown source is a raw file at /raw/<slug>.md, exactly as written", async () => {
    const source = "---\ntitle: Soup\n---\n# Soup\r\n\r\nLeeks & *potatoes*.\n";
    const build = await buildFixtureVault({ "Recipes/Leek Soup.md": source });

    expect(build.ok).toBe(true);
    expect(await build.file("raw/recipes/leek-soup.md")).toBe(source);
  }, 30_000);

  test("an attachment without an extension gets a raw file at /raw/<slug>", async () => {
    const build = await buildFixtureVault({ "Inbox.md": "# Inbox\n", "Scripts/Makefile": "all:\n\techo hi\n" });

    expect(build.ok).toBe(true);
    const href = (await build.page("/scripts/makefile/")).querySelector("main a[download]")!.getAttribute("href")!;
    expect(href).toBe("/raw/scripts/makefile");
    expect(await build.file(href)).toBe("all:\n\techo hi\n");
  }, 30_000);
});
