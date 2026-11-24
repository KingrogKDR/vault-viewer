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

  test("CJK and combining-mark scripts are kept whole", async () => {
    const build = await buildFixtureVault({
      "日記/今日の メモ.md": "# Today\n",
      "हिन्दी नोट्स.md": "# Hindi notes\n",
    });

    expect(build.ok).toBe(true);
    expect((await build.page("/日記/今日の-メモ/")).querySelector("h1")?.textContent).toBe("Today");
    expect((await build.page("/हिन्दी-नोट्स/")).querySelector("h1")?.textContent).toBe("Hindi notes");
  }, 30_000);
});
