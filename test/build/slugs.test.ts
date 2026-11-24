import { afterAll, describe, expect, test } from "bun:test";
import { buildFixtureVault, cleanupTempDirs } from "../harness/site-build";

afterAll(cleanupTempDirs);

describe("slugs", () => {
  test("accented letters are kept, lowercased and NFC-normalised", async () => {
    const build = await buildFixtureVault({
      // "Cafe" + combining acute accent: the decomposed (NFD) form of "Café".
      "Café Menu.md": "# Café menu\n",
      "Été/Ölmühle.md": "# Oil mill\n",
    });

    expect(build.ok).toBe(true);
    expect(build.hasPage("/café-menu/")).toBe(true);
    expect((await build.page("/été/ölmühle/")).querySelector("h1")?.textContent).toBe("Oil mill");
  }, 30_000);
});
