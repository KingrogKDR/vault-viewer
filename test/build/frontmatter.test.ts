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

  test("a frontmatter title is the page title and the note's heading", async () => {
    const build = await buildFixtureVault({
      "Projects/pond-2031.md": ["---", "title: Pond Project, Year One", "---", "", "Dig first, plant later.", ""].join("\n"),
    });

    expect(build.ok).toBe(true);
    const doc = await build.page("/projects/pond-2031/");
    expect(doc.querySelector("title")?.textContent).toBe("Pond Project, Year One");
    expect([...doc.querySelectorAll("h1")].map((h) => h.textContent)).toEqual(["Pond Project, Year One"]);
  }, 30_000);

  test("without a frontmatter title the file name is used, and the note's opening h1 gives way to it", async () => {
    const build = await buildFixtureVault({
      "Kitchen/Soup Stock.md": ["# My Best Stock", "", "Roast the bones first.", ""].join("\n"),
    });

    expect(build.ok).toBe(true);
    const doc = await build.page("/kitchen/soup-stock/");
    expect(doc.querySelector("title")?.textContent).toBe("Soup Stock");
    expect([...doc.querySelectorAll("h1")].map((h) => h.textContent)).toEqual(["Soup Stock"]);
    expect(doc.querySelector("article.note p")?.textContent).toBe("Roast the bones first.");
  }, 30_000);
});
