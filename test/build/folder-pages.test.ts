import { afterAll, describe, expect, test } from "bun:test";
import { buildFixtureVault, cleanupTempDirs } from "../harness/site-build";

afterAll(cleanupTempDirs);

/** A folder page's listing: [link text, href] for its folders and for its vault files. */
function listing(doc: Document) {
  const links = (selector: string) =>
    [...doc.querySelectorAll(`body > main ${selector} a`)].map((a) => [a.textContent!.trim(), a.getAttribute("href")]);
  return { folders: links(".home-folders"), files: links(".home-files") };
}

/** Where the home page's link to its one top-level folder goes. */
async function homeFolderHref(files: Record<string, string>): Promise<string | null | undefined> {
  const build = await buildFixtureVault(files);
  expect(build.ok).toBe(true);
  const links = [...(await build.page("/")).querySelectorAll("body > main .home-folders a")];
  expect(links).toHaveLength(1);
  return links[0].getAttribute("href");
}

describe("folder index notes", () => {
  // Each case's vault holds the winning note plus every lower-ranked candidate.
  const cases: [string, Record<string, string>, string][] = [
    [
      "Folder/index.md comes first",
      {
        "Garden/index.md": "# i\n",
        "Garden/README.md": "# r\n",
        "Garden/Garden.md": "# g\n",
        "Garden.md": "# s\n",
        "Garden/Plant Index.md": "# p\n",
      },
      "/garden/index/",
    ],
    [
      "then Folder/README.md",
      { "Garden/Readme.md": "# r\n", "Garden/Garden.md": "# g\n", "Garden.md": "# s\n", "Garden/Plant Index.md": "# p\n" },
      "/garden/readme/",
    ],
    [
      "then Folder/<FolderName>.md inside the folder",
      { "Garden/garden.md": "# g\n", "Garden.md": "# s\n", "Garden/Plant Index.md": "# p\n" },
      "/garden/garden/",
    ],
    ["then a sibling <FolderName>.md next to the folder", { "garden.md": "# s\n", "Garden/Plant Index.md": "# p\n" }, "/garden/"],
    [
      "then the one note directly inside with the whole word \"index\" in its name, in any case",
      { "Garden/Plant INDEX.md": "# p\n", "Garden/Reindex.md": "# r\n", "Garden/Indexes.md": "# x\n", "Garden/Sub/Index of seeds.md": "# s\n" },
      "/garden/plant-index/",
    ],
  ];
  for (const [rule, files, href] of cases) {
    test(`${rule}`, async () => {
      expect(await homeFolderHref({ ...files, "Garden/Watering.md": "# Watering\n" })).toBe(href);
    }, 30_000);
  }

  test("\"index\" must be a whole word: Reindex.md and Indexes.md don't count, so the folder links to its folder page", async () => {
    expect(await homeFolderHref({ "Garden/Reindex.md": "# r\n", "Garden/Indexes.md": "# x\n" })).toBe("/garden/");
  }, 30_000);

  test("two notes with \"index\" in their names means neither counts", async () => {
    expect(await homeFolderHref({ "Garden/Plant index.md": "# p\n", "Garden/Seed-Index.md": "# s\n" })).toBe("/garden/");
  }, 30_000);

  test("unpublished notes are never chosen", async () => {
    const unpublished = "---\npublish: false\n---\n# Secret\n";
    expect(
      await homeFolderHref({
        "Garden/index.md": unpublished,
        "Garden.md": unpublished,
        "Garden/Plant Index.md": unpublished,
        "Garden/Seed Index.md": "# s\n",
      }),
    ).toBe("/garden/seed-index/");
  }, 30_000);

  test("a folder index note is still an ordinary note: listed in its folder, with its own viewer page", async () => {
    const build = await buildFixtureVault({ "Garden/index.md": "# Garden home\n", "Garden/Watering.md": "# Watering\n" });

    expect(build.ok).toBe(true);
    expect(build.hasPage("/garden/index/")).toBe(true);
    expect(listing(await build.page("/garden/")).files).toEqual([
      ["index", "/garden/index/"],
      ["Watering", "/garden/watering/"],
    ]);
  }, 30_000);
});

describe("folder pages", () => {
  test("a folder with no folder index note gets a folder page listing its subfolders, then its vault files, in file tree order", async () => {
    const build = await buildFixtureVault({
      "Garden/Watering.md": "# Watering\n",
      "Garden/Day 10.md": "# Day 10\n",
      "Garden/Day 2.md": "# Day 2\n",
      "Garden/Bed Layout.png": "png",
      "Garden/Vegetables/Tomatoes.md": "# Tomatoes\n",
      "Garden/herbs/Basil.md": "# Basil\n",
    });

    expect(build.ok).toBe(true);
    const doc = await build.page("/garden/");
    expect(doc.querySelector("body > main h1")?.textContent?.trim()).toBe("Garden");
    expect(listing(doc)).toEqual({
      folders: [
        ["herbs", "/garden/herbs/"],
        ["Vegetables", "/garden/vegetables/"],
      ],
      files: [
        ["Bed Layout.png", "/garden/bed-layout.png/"],
        ["Day 2", "/garden/day-2/"],
        ["Day 10", "/garden/day-10/"],
        ["Watering", "/garden/watering/"],
      ],
    });
    expect(build.hasPage("/garden/vegetables/")).toBe(true);
  }, 30_000);

  test("the breadcrumb links the vault and each ancestor to its folder index note or folder page, and marks the folder itself current", async () => {
    const build = await buildFixtureVault({
      "Garden/README.md": "# Garden\n",
      "Garden/Vegetables/Notes.md": "# Notes\n",
      "Garden/Vegetables/Roots/Carrots.md": "# Carrots\n",
    });

    expect(build.ok).toBe(true);
    const doc = await build.page("/garden/vegetables/roots/");
    const crumbs = doc.querySelector('body > main nav[aria-label="Breadcrumbs"] ol');
    expect(
      [...crumbs!.querySelectorAll(":scope > li > a")].map((a) => [a.textContent!.trim(), a.getAttribute("href"), a.getAttribute("aria-current")]),
    ).toEqual([
      ["Vault", "/", null],
      ["Garden", "/garden/readme/", null],
      ["Vegetables", "/garden/vegetables/", null],
      ["Roots", "/garden/vegetables/roots/", "page"],
    ]);
  }, 30_000);

  test("a folder's index note comes first, as a link to its viewer page, and stays in the file list", async () => {
    const build = await buildFixtureVault({
      "Garden/index.md": "---\ntitle: Garden overview\n---\nHello.\n",
      "Garden/Watering.md": "# Watering\n",
    });

    expect(build.ok).toBe(true);
    const doc = await build.page("/garden/");
    const main = doc.querySelector("body > main")!;
    const first = main.querySelector(".folder-index-note a");
    expect([first?.textContent?.trim(), first?.getAttribute("href")]).toEqual(["Garden overview", "/garden/index/"]);
    // It comes before the folder's listing.
    const order = [...main.querySelectorAll(".folder-index-note, .home-files")].map((el) => el.className);
    expect(order[0]).toContain("folder-index-note");
    expect(listing(doc).files.map(([name]) => name)).toEqual(["index", "Watering"]);
  }, 30_000);

  test("a folder page has no Share button and no download, and is marked current in the file tree", async () => {
    const build = await buildFixtureVault(
      { "Garden/Lisbon.md": "---\nshare: true\n---\n# Lisbon\n", "Garden/Herbs/Basil.md": "# Basil\n" },
      { shareSecret: "fixture-share-secret-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa" },
    );

    expect(build.ok).toBe(true);
    const doc = await build.page("/garden/herbs/");
    expect(doc.querySelector(".page-actions, .share-button, a[download]")).toBeNull();
    const tree = doc.querySelector("nav.file-tree")!;
    expect([...tree.querySelectorAll('[aria-current="page"]')].map((a) => a.getAttribute("href"))).toEqual(["/garden/herbs/"]);
    expect([...tree.querySelectorAll("details[open] > summary")].map((s) => s.textContent!.trim())).toEqual(["Garden", "Herbs"]);
  }, 30_000);

  test("every folder in the file tree keeps its no-JavaScript toggle and has a named link to its destination", async () => {
    const build = await buildFixtureVault({
      "Garden/index.md": "# Garden\n",
      "Garden/Herbs/Basil.md": "# Basil\n",
      "Recipes.md": "# Recipes\n",
      "Recipes/Soup.md": "# Soup\n",
    });

    expect(build.ok).toBe(true);
    const tree = (await build.page("/recipes/soup/")).querySelector("nav.file-tree")!;
    const folders = [...tree.querySelectorAll("li:has(> details)")].map((li) => {
      const link = li.querySelector(":scope > a")!;
      return [li.querySelector(":scope > details > summary")!.textContent!.trim(), link.textContent!.trim(), link.getAttribute("href")];
    });
    expect(folders).toEqual([
      ["Garden", "Open Garden", "/garden/index/"],
      ["Herbs", "Open Herbs", "/garden/herbs/"],
      ["Recipes", "Open Recipes", "/recipes/"],
    ]);
    // The summary only toggles: it holds no link, and the page needs no script.
    expect(tree.querySelectorAll("summary a")).toHaveLength(0);
    expect((await build.page("/recipes/soup/")).querySelectorAll("script")).toHaveLength(0);
  }, 30_000);

  test("unpublished notes are never listed on a folder page, and a folder holding only unpublished notes gets no page", async () => {
    const unpublished = "---\npublish: false\n---\n# Secret plans\n";
    const build = await buildFixtureVault({
      "Garden/Watering.md": "# Watering\n",
      "Garden/Secret plans.md": unpublished,
      "Garden/Hidden/Only.md": unpublished,
    });

    expect(build.ok).toBe(true);
    const doc = await build.page("/garden/");
    expect(listing(doc)).toEqual({ folders: [], files: [["Watering", "/garden/watering/"]] });
    expect(doc.documentElement.outerHTML).not.toContain("Secret");
    expect(doc.documentElement.outerHTML).not.toContain("Hidden");
    expect(build.hasPage("/garden/hidden/")).toBe(false);
  }, 30_000);

  test("folder pages add nothing under /s/: only the shared pages are there", async () => {
    const secret = "fixture-share-secret-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
    const files = { "Trips/Lisbon.md": "---\nshare: true\n---\n# Lisbon\n", "Trips/Day 1/Notes.md": "# Notes\n" };
    const build = await buildFixtureVault(files, { shareSecret: secret });

    expect(build.ok).toBe(true);
    expect(build.hasPage("/trips/day-1/")).toBe(true);
    const underS = (await build.outputFiles()).filter((path) => path.startsWith("s/") && !path.startsWith("s/_astro/"));
    expect(underS).toHaveLength(1);
    expect(underS[0]).toMatch(/^s\/[A-Za-z0-9_-]{22}\/index\.html$/);
  }, 30_000);

  test("a sibling Folder.md takes the folder page's place: /folder/ is that note's viewer page", async () => {
    const build = await buildFixtureVault({ "Garden.md": "# All about the garden\n", "Garden/Watering.md": "# Watering\n" });

    expect(build.ok).toBe(true);
    const doc = await build.page("/garden/");
    expect(doc.querySelector("body > main article.note h1")?.textContent).toBe("All about the garden");
    expect(doc.querySelector("body > main .home-folders, body > main .home-files")).toBeNull();
  }, 30_000);

  test("a folder page that would land on another vault file's output fails the build, naming both", async () => {
    // Not a sibling folder note by name, but "Garden!.md" has the slug "garden" too.
    const build = await buildFixtureVault({ "Garden!.md": "# Garden\n", "Garden/Watering.md": "# Watering\n" });

    expect(build.ok).toBe(false);
    expect(build.output).toContain('"Garden!.md"');
    expect(build.output).toContain('"Garden/"');
  }, 30_000);
});
