import { afterAll, describe, expect, test } from "bun:test";
import { buildFixtureVault, cleanupTempDirs } from "../harness/site-build";

afterAll(cleanupTempDirs);

describe("note viewer page", () => {
  test("a note builds to a viewer page at /<slug>/", async () => {
    const build = await buildFixtureVault({
      "Garden Plans.md": "# Garden Plans\n\nTomatoes go by the fence.\n",
    });

    expect(build.ok).toBe(true);
    const doc = await build.page("/garden-plans/");
    expect(doc.querySelector("h1")?.textContent).toBe("Garden Plans");
  }, 30_000);
});
