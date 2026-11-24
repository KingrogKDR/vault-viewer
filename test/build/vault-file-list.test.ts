import { afterAll, describe, expect, test } from "bun:test";
import { rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { buildFixtureVault, buildSite, cleanupTempDirs, createFixtureVault } from "../harness/site-build";

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

  test("a vault that is not a git repo builds from its folder, still skipping dot-segments", async () => {
    const build = await buildFixtureVault(
      {
        ".gitignore": "Loose.md\n",
        "Loose.md": "# Loose\n",
        "Journal/Monday.md": "# Monday\n",
        ".obsidian/app.md": "# App\n",
        "Journal/.private/Secret.md": "# Secret\n",
      },
      { git: false },
    );

    expect(build.ok).toBe(true);
    expect(build.hasPage("/journal/monday/")).toBe(true);
    expect(build.hasPage("/loose/")).toBe(true);
    expect(build.hasPage("/.obsidian/app/")).toBe(false);
    expect(build.hasPage("/journal/.private/secret/")).toBe(false);
  }, 30_000);

  // A git vault must never fall back to the folder walk: the walk ignores
  // .gitignore and would publish the owner's desktop-only folders.
  test("a git vault whose git is broken fails the build instead of walking the folder", async () => {
    const vault = await createFixtureVault({
      ".gitignore": "Desktop Only/\n",
      "Desktop Only/Plans.md": "# Plans\n",
      "Kept.md": "# Kept\n",
    });
    await writeFile(join(vault, ".git", "HEAD"), "garbage\n");

    const build = await buildSite({ vaultDir: vault });

    expect(build.ok).toBe(false);
    expect(build.output).toContain(vault);
    expect(build.output).toMatch(/not a git repository/);
    expect(build.hasPage("/desktop-only/plans/")).toBe(false);
  }, 30_000);

  test("a vault whose .git file points nowhere fails the build naming git's error", async () => {
    const vault = await createFixtureVault({
      ".gitignore": "Desktop Only/\n",
      "Desktop Only/Plans.md": "# Plans\n",
      "Kept.md": "# Kept\n",
    });
    await rm(join(vault, ".git"), { recursive: true });
    await writeFile(join(vault, ".git"), "gitdir: /nonexistent\n");

    const build = await buildSite({ vaultDir: vault });

    expect(build.ok).toBe(false);
    expect(build.output).toContain(vault);
    expect(build.output).toMatch(/gitfile does not point to a valid repository/);
    expect(build.hasPage("/desktop-only/plans/")).toBe(false);
  }, 30_000);
});
