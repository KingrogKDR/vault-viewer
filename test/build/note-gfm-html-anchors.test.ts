import { afterAll, describe, expect, test } from "bun:test";
import { buildFixtureVault, cleanupTempDirs } from "../harness/site-build";

afterAll(cleanupTempDirs);

describe("GFM, raw HTML and heading anchors in a note", () => {
  test("GitHub-flavoured markdown renders tables, task lists, strikethrough, autolinks and fenced code", async () => {
    const build = await buildFixtureVault({
      "Pantry.md": [
        "# Pantry",
        "",
        "| Item | Count |",
        "| ---- | ----- |",
        "| oats | 3 |",
        "| rice | 1 |",
        "",
        "- [x] buy flour",
        "- [ ] buy yeast",
        "",
        "We are ~~out of~~ low on sugar.",
        "",
        "Order more at https://example.com/shop today.",
        "",
        "```js",
        "restock('sugar');",
        "```",
        "",
      ].join("\n"),
    });

    expect(build.ok).toBe(true);
    const note = (await build.page("/pantry/")).querySelector("article.note")!;

    expect([...note.querySelectorAll("table thead th")].map((th) => th.textContent)).toEqual(["Item", "Count"]);
    expect(
      [...note.querySelectorAll("table tbody tr")].map((tr) => [...tr.querySelectorAll("td")].map((td) => td.textContent)),
    ).toEqual([
      ["oats", "3"],
      ["rice", "1"],
    ]);

    const tasks = [...note.querySelectorAll("li")].filter((li) => li.querySelector('input[type="checkbox"]'));
    expect(tasks.map((li) => [li.textContent?.trim(), li.querySelector("input")!.hasAttribute("checked")])).toEqual([
      ["buy flour", true],
      ["buy yeast", false],
    ]);

    expect(note.querySelector("del")?.textContent).toBe("out of");

    expect(note.querySelector('a[href="https://example.com/shop"]')?.textContent).toBe("https://example.com/shop");

    expect(note.querySelector("pre > code.language-js")?.textContent).toBe("restock('sugar');\n");
  }, 30_000);
});
