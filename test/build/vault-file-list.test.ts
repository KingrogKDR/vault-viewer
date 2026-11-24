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

  test("notes matched by the vault's .gitignore get no page", async () => {
    const build = await buildFixtureVault({
      ".gitignore": "Desktop Only/\nscratch.md\n",
      "Desktop Only/Plans.md": "# Plans\n",
      "scratch.md": "# Scratch\n",
      "Kept.md": "# Kept\n",
    });

    expect(build.ok).toBe(true);
    expect(build.hasPage("/kept/")).toBe(true);
    expect(build.hasPage("/desktop-only/plans/")).toBe(false);
    expect(build.hasPage("/scratch/")).toBe(false);
  }, 30_000);

  test("a tracked note deleted from the working tree gets no page", async () => {
    const build = await buildFixtureVault(
      { "Old Note.md": "# Old Note\n", "Current.md": "# Current\n" },
      { deleted: ["Old Note.md"] },
    );

    expect(build.ok).toBe(true);
    expect(build.hasPage("/current/")).toBe(true);
    expect(build.hasPage("/old-note/")).toBe(false);
  }, 30_000);

  test("notes under a path segment starting with . get no page, tracked or not", async () => {
    const build = await buildFixtureVault(
      {
        ".obsidian/workspace.md": "# Workspace\n",
        "Projects/.drafts/Outline.md": "# Outline\n",
        "Projects/.hidden note.md": "# Hidden\n",
        "Projects/Roadmap.md": "# Roadmap\n",
      },
      { untracked: { ".trash/Deleted Idea.md": "# Deleted Idea\n" } },
    );

    expect(build.ok).toBe(true);
    expect(build.hasPage("/projects/roadmap/")).toBe(true);
    expect(build.hasPage("/.obsidian/workspace/")).toBe(false);
    expect(build.hasPage("/projects/.drafts/outline/")).toBe(false);
    expect(build.hasPage("/projects/.hidden-note/")).toBe(false);
    expect(build.hasPage("/.trash/deleted-idea/")).toBe(false);
  }, 30_000);
});
