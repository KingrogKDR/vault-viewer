import { afterAll, describe, expect, test } from "bun:test";
import { buildFixtureVault, cleanupTempDirs, type SiteBuild } from "../harness/site-build";

afterAll(cleanupTempDirs);

/** Each link in the note body on `url`, as [text, href, class]. */
async function linksOn(build: SiteBuild, url: string): Promise<(string | null)[][]> {
  return [...(await build.page(url)).querySelectorAll("article.note p a")].map((a) => [
    a.textContent,
    a.getAttribute("href"),
    a.getAttribute("class") || null,
  ]);
}

describe("wikilinks", () => {
  test("[[note]], [[folder/note]] and [[note.md]] link to the note's viewer page, showing the target without .md", async () => {
    const build = await buildFixtureVault({
      "Garden/Tomatoes.md": "# Tomatoes\n\nNext to [[Basil]], see [[Tools/Spade]] and [[Basil.md]].\n",
      "Garden/Basil.md": "# Basil\n",
      "Tools/Spade.md": "# Spade\n",
    });

    expect(build.ok).toBe(true);
    expect(await linksOn(build, "/garden/tomatoes/")).toEqual([
      ["Basil", "/garden/basil/", null],
      ["Tools/Spade", "/tools/spade/", null],
      ["Basil", "/garden/basil/", null],
    ]);
  }, 30_000);

  test("an ambiguous name resolves the way Obsidian does: own folder, then shortest path, then case-insensitively", async () => {
    const build = await buildFixtureVault({
      "Trips/Lisbon.md": "# Lisbon\n\n[[Budget]], [[Soup]], [[recipes/soup]] and [[KETTLE]].\n",
      "Trips/Budget.md": "# Trip budget\n",
      "Budget.md": "# Household budget\n",
      "Archive/Old/Recipes/Soup.md": "# Old soup\n",
      "Kitchen/Recipes/Soup.md": "# Kitchen soup\n",
      "Kitchen/Kettle.md": "# Kettle\n",
    });

    expect(build.ok).toBe(true);
    expect(await linksOn(build, "/trips/lisbon/")).toEqual([
      ["Budget", "/trips/budget/", null],
      ["Soup", "/kitchen/recipes/soup/", null],
      ["recipes/soup", "/kitchen/recipes/soup/", null],
      ["KETTLE", "/kitchen/kettle/", null],
    ]);
  }, 30_000);

  test("[[note|alias]] shows the alias, and [[file.pdf]] links to the attachment's viewer page", async () => {
    const build = await buildFixtureVault({
      "Desk.md": "# Desk\n\nRead [[Manuals/Lamp|the lamp manual]] or [[Lamp guide.pdf]].\n",
      "Manuals/Lamp.md": "# Lamp\n",
      "Manuals/Lamp guide.pdf": "%PDF-1.4 made up\n",
    });

    expect(build.ok).toBe(true);
    expect(await linksOn(build, "/desk/")).toEqual([
      ["the lamp manual", "/manuals/lamp/", null],
      ["Lamp guide.pdf", "/manuals/lamp-guide.pdf/", null],
    ]);
  }, 30_000);

  test("[[note#Heading]] jumps to the id that heading has on the target page; [[#Heading]] stays within the note", async () => {
    const build = await buildFixtureVault({
      "Bike.md": [
        "# Bike",
        "",
        "See [[Repairs#Fixing a Flat]], [[Repairs#Brakes#Pads|the pads]], [[Repairs#^chain-note]] and [[#Gear list]].",
        "",
        "## Gear list",
        "",
      ].join("\n"),
      "Repairs.md": "# Repairs\n\n## Fixing a Flat\n\nPatch it.\n\n## Brakes\n\n### Pads\n\nSwap them. ^chain-note\n",
    });

    expect(build.ok).toBe(true);
    expect(await linksOn(build, "/bike/")).toEqual([
      ["Repairs > Fixing a Flat", "/repairs/#fixing-a-flat", null],
      ["the pads", "/repairs/#pads", null],
      // Block references have no anchor on the site: they lead to the note.
      ["Repairs > ^chain-note", "/repairs/", null],
      ["Gear list", "#gear-list", null],
    ]);
    const repairs = await build.page("/repairs/");
    expect(repairs.querySelector("#fixing-a-flat")?.textContent).toBe("Fixing a Flat");
    expect(repairs.querySelector("#pads")?.textContent).toBe("Pads");
    expect((await build.page("/bike/")).querySelector("#gear-list")?.textContent).toBe("Gear list");
  }, 30_000);

  test("a wikilink that resolves to nothing, or to an unpublished note, is a broken link that never names its target", async () => {
    const build = await buildFixtureVault({
      "Inbox.md": "# Inbox\n\n[[Quillwort Ledger]], [[Quillwort Ledger|my diary]] and [[Nowhere Plan#Step]].\n",
      "Quillwort Ledger.md": "---\npublish: false\n---\n\n# Hidden\n",
    });

    expect(build.ok).toBe(true);
    expect(await linksOn(build, "/inbox/")).toEqual([
      ["broken link", null, "broken-link"],
      ["my diary", null, "broken-link"],
      ["broken link", null, "broken-link"],
    ]);
    const html = (await build.page("/inbox/")).documentElement.outerHTML.toLowerCase();
    expect(html).not.toContain("quillwort");
    expect(html).not.toContain("nowhere");
  }, 30_000);

  test("wikilinks in code stay literal; escaped, unclosed or empty ones stay text; `\\|` works inside tables", async () => {
    const build = await buildFixtureVault({
      "Syntax.md": [
        "# Syntax",
        "",
        "Inline `[[Basil]]` and \\[[Basil]] and [[Basil and [[]] here.",
        "",
        "```",
        "[[Basil]]",
        "```",
        "",
        "| Plant | Link |",
        "| --- | --- |",
        "| herb | [[Basil\\|sweet basil]] |",
        "",
      ].join("\n"),
      "Basil.md": "# Basil\n",
    });

    expect(build.ok).toBe(true);
    const page = await build.page("/syntax/");
    expect([...page.querySelectorAll("article.note a")].map((a) => [a.textContent, a.getAttribute("href")])).toEqual([
      ["sweet basil", "/basil/"],
    ]);
    expect(page.querySelector("article.note p code")?.textContent).toBe("[[Basil]]");
    expect(page.querySelector("article.note pre code")?.textContent).toBe("[[Basil]]\n");
    expect(page.querySelector("article.note p")?.textContent).toBe("Inline [[Basil]] and [[Basil]] and [[Basil and [[]] here.");
  }, 30_000);
});
