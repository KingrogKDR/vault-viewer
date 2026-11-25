import { afterAll, describe, expect, test } from "bun:test";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { buildFixtureVault, cleanupTempDirs, type SiteBuild } from "../harness/site-build";

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

/** All CSS a page uses: inline <style> elements plus stylesheets linked from the build output. */
async function pageCss(build: SiteBuild, doc: Document): Promise<string> {
  const inline = [...doc.querySelectorAll("style")].map((s) => s.textContent ?? "");
  const linked = await Promise.all(
    [...doc.querySelectorAll('link[rel="stylesheet"]')].map((link) =>
      readFile(join(build.outDir, ...link.getAttribute("href")!.split("/").filter(Boolean)), "utf8"),
    ),
  );
  return [...inline, ...linked].join("\n");
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

  test("attachments are listed by file name with extension; notes without .md", async () => {
    const build = await buildFixtureVault({
      "Garden/Watering.md": "# Watering\n",
      "Garden/Bed Layout.png": "png",
      "Garden/Seeds.csv": "name,count\n",
    });

    expect(build.ok).toBe(true);
    const doc = await build.page("/garden/watering/");
    expect(outline(fileTree(doc).querySelector(":scope > ul"))).toEqual([
      { folder: "Garden", open: true, entries: ["Bed Layout.png", "Seeds.csv", "Watering"] },
    ]);
    const layout = [...fileTree(doc).querySelectorAll("a")].find((a) => a.textContent === "Bed Layout.png");
    expect(layout?.getAttribute("href")).toBe("/garden/bed-layout.png/");
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

  test("only the current vault file's entry is marked as the current page", async () => {
    const build = await buildFixtureVault({
      "Recipes/Soup.md": "# Soup\n",
      "Recipes/Bread.md": "# Bread\n",
      "Soup.md": "# Soup\n",
    });

    expect(build.ok).toBe(true);
    const doc = await build.page("/recipes/soup/");
    const marked = [...fileTree(doc).querySelectorAll('[aria-current="page"]')];
    expect(marked.map((el) => el.getAttribute("href"))).toEqual(["/recipes/soup/"]);
  }, 30_000);

  test("on narrow screens a menu button shows and hides the tree without JavaScript", async () => {
    const build = await buildFixtureVault({ "Inbox.md": "# Inbox\n" });

    expect(build.ok).toBe(true);
    const doc = await build.page("/inbox/");
    const toggle = doc.querySelector('input[type="checkbox"]#file-tree-toggle');
    expect(toggle).not.toBeNull();
    expect(doc.querySelector('label[for="file-tree-toggle"]')?.textContent?.trim()).toBe("Files");
    // The checkbox precedes the tree as a sibling, so `:checked ~ .file-tree` can reveal it.
    expect(toggle!.parentElement).toBe(fileTree(doc).parentElement);
    expect([...toggle!.parentElement!.children].indexOf(fileTree(doc))).toBeGreaterThan(
      [...toggle!.parentElement!.children].indexOf(toggle!),
    );
    expect(doc.querySelectorAll("script")).toHaveLength(0);
    const css = (await pageCss(build, doc)).replace(/\s+/g, " ");
    // Inside a narrow-screen media query (`max-width:` or the minifier's `width<=`), the tree
    // starts hidden and the checked toggle shows it.
    const narrow = css.match(/@media\s*\((?:max-width:|width\s*<=)[^)]*\)\s*\{(.*?\})\s*\}/)?.[1] ?? "";
    expect(narrow).toMatch(/(^|\})\s*\.file-tree\s*\{[^}]*display:\s*none/);
    expect(narrow).toMatch(/#file-tree-toggle:checked\s*~\s*\.file-tree\s*\{[^}]*display:\s*block/);
  }, 30_000);

  test("on a folder page, the current folder's link is filled with its top-level folder's pastel, as a current vault file is", async () => {
    const build = await buildFixtureVault({ "Garden/Herbs/Basil.md": "# Basil\n" });

    expect(build.ok).toBe(true);
    const doc = await build.page("/garden/herbs/");
    expect(doc.querySelector('nav.file-tree a.folder-link[aria-current="page"]')?.getAttribute("href")).toBe("/garden/herbs/");
    const css = (await pageCss(build, doc)).replace(/\s+/g, " ");
    // Every rule that styles the current folder link and sets a fill uses the folder's pastel (--tab).
    const fills = [...css.matchAll(/([^{}]*\.folder-link[^{}]*\[aria-current=["']?page["']?\][^{}]*)\{([^}]*)\}/g)]
      .map((m) => m[2].match(/background(?:-color)?:\s*([^;]+)/)?.[1]?.trim())
      .filter(Boolean);
    expect(fills.length).toBeGreaterThan(0);
    for (const fill of fills) expect(fill).toBe("var(--tab)");
  }, 30_000);
});
