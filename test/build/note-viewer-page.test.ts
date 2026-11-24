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

  test("a note's CommonMark content is rendered", async () => {
    const build = await buildFixtureVault({
      "Recipes/Soup.md": [
        "# Soup",
        "",
        "A *warm* bowl with **plenty** of broth.",
        "",
        "## Ingredients",
        "",
        "- leeks",
        "- potatoes",
        "",
        "1. chop",
        "2. simmer",
        "",
        "See [the stock guide](https://example.com/stock) and use `salt`.",
        "",
        "```",
        "simmer(20)",
        "```",
        "",
      ].join("\n"),
    });

    expect(build.ok).toBe(true);
    const doc = await build.page("/recipes/soup/");
    const note = doc.querySelector("article.note")!;
    expect(note.querySelector("h1")?.textContent).toBe("Soup");
    expect(note.querySelector("h2")?.textContent).toBe("Ingredients");
    expect(note.querySelector("p em")?.textContent).toBe("warm");
    expect(note.querySelector("p strong")?.textContent).toBe("plenty");
    expect([...note.querySelectorAll("ul > li")].map((li) => li.textContent)).toEqual(["leeks", "potatoes"]);
    expect([...note.querySelectorAll("ol > li")].map((li) => li.textContent)).toEqual(["chop", "simmer"]);
    const link = note.querySelector("a")!;
    expect(link.getAttribute("href")).toBe("https://example.com/stock");
    expect(link.textContent).toBe("the stock guide");
    expect(note.querySelector("p code")?.textContent).toBe("salt");
    expect(note.querySelector("pre > code")?.textContent).toBe("simmer(20)\n");
  }, 30_000);
});
