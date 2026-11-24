import { afterAll, describe, expect, test } from "bun:test";
import { buildFixtureVault, cleanupTempDirs } from "../harness/site-build";

afterAll(cleanupTempDirs);

/** A folder in the outline: its name and what it contains. */
type Outline = (string | { folder: string; open: boolean; entries: Outline })[];

/** The file tree's entries as an outline: link text for files, nested folders with their open state. */
function outline(list: Element | null): Outline {
  if (!list) throw new Error("no list in the file tree");
  return [...list.children].map((li) => {
    const details = li.querySelector(":scope > details");
    if (!details) return li.querySelector(":scope > a")!.textContent!.trim();
    return {
      folder: details.querySelector(":scope > summary")!.textContent!.trim(),
      open: details.hasAttribute("open"),
      entries: outline(details.querySelector(":scope > ul")),
    };
  });
}

function fileTree(doc: Document): Element {
  const nav = doc.querySelector("nav.file-tree");
  if (!nav) throw new Error("no file tree on the page");
  return nav;
}

describe("file tree", () => {
  test("the sidebar lists every vault file in its folders", async () => {
    const build = await buildFixtureVault({
      "Inbox.md": "# Inbox\n",
      "Garden/Watering.md": "# Watering\n",
      "Garden/Vegetables/Tomatoes.md": "# Tomatoes\n",
    });

    expect(build.ok).toBe(true);
    const doc = await build.page("/inbox/");
    expect(outline(fileTree(doc).querySelector(":scope > ul"))).toEqual([
      {
        folder: "Garden",
        open: false,
        entries: [{ folder: "Vegetables", open: false, entries: ["Tomatoes"] }, "Watering"],
      },
      "Inbox",
    ]);
    const tomatoes = [...fileTree(doc).querySelectorAll("a")].find((a) => a.textContent === "Tomatoes");
    expect(tomatoes?.getAttribute("href")).toBe("/garden/vegetables/tomatoes/");
  }, 30_000);

  test("folders come before files", async () => {
    const build = await buildFixtureVault({
      "Apples.md": "# Apples\n",
      "Zoo/Lions.md": "# Lions\n",
      "Mid.md": "# Mid\n",
    });

    expect(build.ok).toBe(true);
    const doc = await build.page("/apples/");
    expect(outline(fileTree(doc).querySelector(":scope > ul"))).toEqual([
      { folder: "Zoo", open: false, entries: ["Lions"] },
      "Apples",
      "Mid",
    ]);
  }, 30_000);

  test("names sort naturally and ignore case", async () => {
    const build = await buildFixtureVault({
      "Day 10.md": "# Day 10\n",
      "Day 2.md": "# Day 2\n",
      "banana.md": "# banana\n",
      "Cherry.md": "# Cherry\n",
      "apple.md": "# apple\n",
      "week 3/Notes.md": "# Notes\n",
      "Week 12/Notes.md": "# Notes\n",
    });

    expect(build.ok).toBe(true);
    const doc = await build.page("/apple/");
    expect(outline(fileTree(doc).querySelector(":scope > ul"))).toEqual([
      { folder: "week 3", open: false, entries: ["Notes"] },
      { folder: "Week 12", open: false, entries: ["Notes"] },
      "apple",
      "banana",
      "Cherry",
      "Day 2",
      "Day 10",
    ]);
  }, 30_000);

  test("the folders containing the current vault file are open and no others", async () => {
    const build = await buildFixtureVault({
      "Garden/Vegetables/Tomatoes.md": "# Tomatoes\n",
      "Garden/Herbs/Basil.md": "# Basil\n",
      "Recipes/Soup.md": "# Soup\n",
    });

    expect(build.ok).toBe(true);
    const doc = await build.page("/garden/vegetables/tomatoes/");
    expect(outline(fileTree(doc).querySelector(":scope > ul"))).toEqual([
      {
        folder: "Garden",
        open: true,
        entries: [
          { folder: "Herbs", open: false, entries: ["Basil"] },
          { folder: "Vegetables", open: true, entries: ["Tomatoes"] },
        ],
      },
      { folder: "Recipes", open: false, entries: ["Soup"] },
    ]);
  }, 30_000);
});
