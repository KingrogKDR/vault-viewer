import { afterAll, describe, expect, test } from "bun:test";
import { buildFixtureVault, cleanupTempDirs } from "../harness/site-build";

afterAll(cleanupTempDirs);

describe("the vault's file list follows git", () => {
  test("tracked notes and untracked notes that are not ignored get viewer pages", async () => {
    const build = await buildFixtureVault(
      { "Trips/Lisbon.md": "# Lisbon\n" },
      { untracked: { "Draft Ideas.md": "# Draft Ideas\n" } },
    );

    expect(build.ok).toBe(true);
    expect(build.hasPage("/trips/lisbon/")).toBe(true);
    expect(build.hasPage("/draft-ideas/")).toBe(true);
  }, 30_000);
});
