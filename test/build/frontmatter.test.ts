import { afterAll, describe, expect, test } from "bun:test";
import { buildFixtureVault, cleanupTempDirs } from "../harness/site-build";

afterAll(cleanupTempDirs);

describe("frontmatter", () => {
  test("a note's frontmatter does not appear on its viewer page", async () => {
    const build = await buildFixtureVault({
      "Bird Log.md": ["---", "species: wren", "seen: 3", "---", "", "A wren sang by the shed.", ""].join("\n"),
    });

    expect(build.ok).toBe(true);
    const doc = await build.page("/bird-log/");
    const body = doc.querySelector("body")!.textContent!;
    expect(body).toContain("A wren sang by the shed.");
    expect(body).not.toContain("species");
    expect(body).not.toContain("wren\nseen");
    expect(doc.querySelector("hr")).toBeNull();
  }, 30_000);
});
