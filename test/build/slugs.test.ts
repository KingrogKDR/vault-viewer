import { afterAll, describe, expect, test } from "bun:test";
import { buildFixtureVault, cleanupTempDirs } from "../harness/site-build";

afterAll(cleanupTempDirs);

describe("slugs", () => {
  test("spaces and punctuation collapse to one hyphen, trimmed at segment ends", async () => {
    const build = await buildFixtureVault({
      "Trips & Plans/(2024) Rome, Day 1?!.md": "# Rome\n",
      "Ideas/v1.2_draft  notes.md": "# Draft\n",
    });

    expect(build.ok).toBe(true);
    expect((await build.page("/trips-plans/2024-rome-day-1/")).querySelector("h1")?.textContent).toBe("Rome");
    expect(build.hasPage("/ideas/v1.2_draft-notes/")).toBe(true);
  }, 30_000);

  test("runs of hyphens, typed or from collapsing, become one hyphen", async () => {
    const build = await buildFixtureVault({
      "Rome -- Day 1.md": "# Rome\n",
      "a---b.md": "# A to B\n",
    });

    expect(build.ok).toBe(true);
    expect((await build.page("/rome-day-1/")).querySelector("h1")?.textContent).toBe("Rome");
    expect(build.hasPage("/a-b/")).toBe(true);
  }, 30_000);

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

  test("two vault files with the same slug fail the build, naming both vault paths", async () => {
    const build = await buildFixtureVault({
      "Reading List.md": "# Reading list\n",
      "reading-list.md": "# Another reading list\n",
      "Other.md": "# Other\n",
    });

    expect(build.ok).toBe(false);
    expect(build.output).toContain("Reading List.md");
    expect(build.output).toContain("reading-list.md");
  }, 30_000);
});
