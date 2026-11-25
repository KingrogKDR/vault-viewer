import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { buildFixtureVault, cleanupTempDirs, type SiteBuild } from "../harness/site-build";

// Three unpublished notes, each with an invented title, file name and body
// text that appear nowhere else in the fixture: one at the top level, one
// beside a published note, and one alone in its folder. The published notes
// link to and embed them under link text of their own.
const UNPUBLISHED = {
  "Zephyrine Ledger.md": "---\ntitle: Quillwort Almanac\npublish: false\n---\n\nMarmalade obelisk under the stairs.\n",
  "Garden/Vintner Thimble.md": '---\ntitle: Brackenfold Tally\npublish: "FALSE"\n---\n\nPeriwinkle anvil by the gate.\n',
  "Cellarwick/Saltmarsh Index.md": "---\ntitle: Gloamberry Roster\npublish: False\n---\n\nTangerine sextant in the crate.\n",
};

/** The unpublished notes' titles and body text, lowercased. */
const CONTENT = ["quillwort", "almanac", "marmalade", "obelisk", "brackenfold", "tally", "periwinkle", "anvil", "gloamberry", "roster", "tangerine", "sextant"];
/** The unpublished notes' file and folder names, lowercased. */
const NAMES = ["zephyrine", "ledger", "vintner", "thimble", "cellarwick", "saltmarsh"];

/**
 * The published notes that link to them. Each link's target names an
 * unpublished note, so the raw copy of these notes (the owner's own text,
 * byte for byte) is the one place those names may appear.
 */
const LINKING = {
  "Inbox.md": [
    "# Inbox",
    "",
    "See [the first](Zephyrine%20Ledger.md), [the second](Garden/Vintner%20Thimble.md) and [the third](<Cellarwick/Saltmarsh Index>).",
    "",
    "![a sketch](Zephyrine%20Ledger.md)",
    "",
  ].join("\n"),
  "Garden/Beds.md": [
    "---",
    "publish: true",
    "---",
    "",
    "# Beds",
    "",
    "Next to [this one](Vintner%20Thimble.md#gate), far from [that one](../Zephyrine%20Ledger.md).",
    "",
    '<img src="Vintner Thimble.md" alt="a drawing">',
    "",
  ].join("\n"),
};

let build: SiteBuild;

beforeAll(async () => {
  build = await buildFixtureVault({
    ...UNPUBLISHED,
    ...LINKING,
  });
}, 30_000);

afterAll(cleanupTempDirs);

describe("unpublished notes", () => {
  test("a note with publish: false has no viewer page and no raw file", async () => {
    expect(build.ok).toBe(true);
    expect(build.hasPage("/inbox/")).toBe(true);
    for (const url of ["/zephyrine-ledger/", "/garden/vintner-thimble/", "/cellarwick/saltmarsh-index/"]) {
      expect(build.hasPage(url)).toBe(false);
    }
    for (const raw of ["raw/zephyrine-ledger.md", "raw/garden/vintner-thimble.md", "raw/cellarwick/saltmarsh-index.md"]) {
      await expect(build.file(raw)).rejects.toThrow("No output file");
    }
  });

  test("it is absent from the file tree and the home page's list and counts", async () => {
    const home = await build.page("/");
    const tree = [...home.querySelectorAll("nav.file-tree a:not(.folder-link), nav.file-tree summary")].map((el) => el.textContent!.trim());
    expect(tree).toEqual(["Garden", "Beds", "Inbox"]);
    const main = home.querySelector("body > main")!;
    expect([...main.querySelectorAll(".home-folders li")].map((li) => li.textContent!.trim())).toEqual(["Garden"]);
    expect([...main.querySelectorAll(".home-files a")].map((a) => a.textContent!.trim())).toEqual(["Inbox"]);
    expect(main.querySelector(".home-counts")?.textContent).toBe("2 notes, 2 files");
  });

  test("links and images pointing to it, from its own folder and others, render as broken links with no target", async () => {
    const brokenOn = async (url: string) =>
      [...(await build.page(url)).querySelectorAll("article.note .broken-link")].map((el) => [
        el.tagName,
        el.textContent || el.getAttribute("alt"),
        el.getAttribute("href") ?? el.getAttribute("src"),
      ]);

    expect(await brokenOn("/inbox/")).toEqual([
      ["A", "the first", null],
      ["A", "the second", null],
      ["A", "the third", null],
      ["IMG", "a sketch", null],
    ]);
    expect(await brokenOn("/garden/beds/")).toEqual([
      ["A", "this one", null],
      ["A", "that one", null],
      ["IMG", "a drawing", null],
    ]);
  });

  test("no output file mentions it: not its title, file name, folder or text, in any path or contents", async () => {
    const linkingSources = new Set(Object.values(LINKING));
    const leaks: string[] = [];
    for (const path of await build.outputFiles()) {
      const contents = new TextDecoder().decode(await build.bytes(path));
      const secrets = linkingSources.has(contents) ? CONTENT : [...CONTENT, ...NAMES];
      const text = `${path}\n${contents}`.toLowerCase();
      for (const secret of secrets) if (text.includes(secret)) leaks.push(`${path}: ${secret}`);
    }
    expect(leaks).toEqual([]);
  });

  test("any other publish value, or malformed frontmatter, leaves a note published", async () => {
    const other = await buildFixtureVault({
      "Yes.md": "---\npublish: true\n---\n\n# Yes\n",
      "No word.md": "---\npublish: no\n---\n\n# No word\n",
      "Falsy.md": "---\npublish: 0\n---\n\n# Falsy\n",
      "Malformed.md": "---\npublish: false\ntags: [unclosed\n---\n\n# Malformed\n",
      "Hidden.md": "---\npublish: false\n---\n\n# Hidden\n",
    });

    expect(other.ok).toBe(true);
    for (const url of ["/yes/", "/no-word/", "/falsy/", "/malformed/"]) expect(other.hasPage(url)).toBe(true);
    expect(other.hasPage("/hidden/")).toBe(false);
  }, 30_000);
});
