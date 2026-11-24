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
    expect(doc.querySelector("article.note h1")?.getAttribute("id")).toBe("pond-project-year-one");
  }, 30_000);

  test("without a frontmatter title or an opening h1, the file name is the title", async () => {
    const build = await buildFixtureVault({
      "Kitchen/Soup Stock.md": ["## Method", "", "Roast the bones first.", ""].join("\n"),
    });

    expect(build.ok).toBe(true);
    const doc = await build.page("/kitchen/soup-stock/");
    expect(doc.querySelector("title")?.textContent).toBe("Soup Stock");
    expect([...doc.querySelectorAll("h1")].map((h) => h.textContent)).toEqual(["Soup Stock"]);
    expect(doc.querySelector("article.note h2")?.textContent).toBe("Method");
    expect(doc.querySelector("article.note p")?.textContent).toBe("Roast the bones first.");
  }, 30_000);

  test("without a frontmatter title, the note's opening h1 is the title and is shown once", async () => {
    const build = await buildFixtureVault({
      "Kitchen/stock-v2.md": ["# My *Best* Stock", "", "Roast the bones first.", ""].join("\n"),
      "Kitchen/broth.md": ["---", "title: Winter Broth", "---", "# Draft heading", "", "Simmer slowly.", ""].join("\n"),
    });

    expect(build.ok).toBe(true);
    const stock = await build.page("/kitchen/stock-v2/");
    expect(stock.querySelector("title")?.textContent).toBe("My Best Stock");
    expect([...stock.querySelectorAll("h1")].map((h) => h.textContent)).toEqual(["My Best Stock"]);
    expect(stock.querySelector("article.note p")?.textContent).toBe("Roast the bones first.");

    // A frontmatter title wins over a differing opening h1, which is then not shown.
    const broth = await build.page("/kitchen/broth/");
    expect(broth.querySelector("title")?.textContent).toBe("Winter Broth");
    expect([...broth.querySelectorAll("h1")].map((h) => h.textContent)).toEqual(["Winter Broth"]);
  }, 30_000);

  test("malformed frontmatter does not fail the build; the note renders as if it had none", async () => {
    const build = await buildFixtureVault({
      "Broken Meta.md": ["---", "title: [unclosed", "tags: : :", "---", "", "The body still shows.", ""].join("\n"),
    });

    expect(build.ok).toBe(true);
    const doc = await build.page("/broken-meta/");
    expect(doc.querySelector("title")?.textContent).toBe("Broken Meta");
    expect([...doc.querySelectorAll("h1")].map((h) => h.textContent)).toEqual(["Broken Meta"]);
    const body = doc.querySelector("body")!.textContent!;
    expect(body).toContain("The body still shows.");
    expect(body).not.toContain("unclosed");
  }, 30_000);
});
