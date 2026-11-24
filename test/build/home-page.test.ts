import { afterAll, describe, expect, test } from "bun:test";
import { buildFixtureVault, cleanupTempDirs } from "../harness/site-build";

afterAll(cleanupTempDirs);

/** The home page's own content, outside the file tree sidebar. */
function homeMain(doc: Document): Element {
  const main = doc.querySelector("body > main");
  if (!main) throw new Error("no <main> on the home page");
  return main;
}

describe("home page", () => {
  test("/ lists the vault's top-level folders and top-level vault files", async () => {
    const build = await buildFixtureVault({
      "Inbox.md": "# Inbox\n",
      "Garden/Watering.md": "# Watering\n",
      "Garden/Vegetables/Tomatoes.md": "# Tomatoes\n",
      "Recipes/Soup.md": "# Soup\n",
      "about.md": "# About\n",
    });

    expect(build.ok).toBe(true);
    expect(build.hasPage("/")).toBe(true);
    const main = homeMain(await build.page("/"));

    const folders = [...main.querySelectorAll(".home-folders li")].map((li) => li.textContent!.trim());
    expect(folders).toEqual(["Garden", "Recipes"]);
    const files = [...main.querySelectorAll(".home-files a")].map((a) => [a.textContent!.trim(), a.getAttribute("href")]);
    expect(files).toEqual([
      ["about", "/about/"],
      ["Inbox", "/inbox/"],
    ]);
  }, 30_000);

  test("/ counts the notes and vault files in the whole vault, not just the top level", async () => {
    const build = await buildFixtureVault({
      "Inbox.md": "# Inbox\n",
      "Garden/Watering.md": "# Watering\n",
      "Garden/Vegetables/Tomatoes.md": "# Tomatoes\n",
    });

    expect(build.ok).toBe(true);
    const counts = homeMain(await build.page("/")).querySelector(".home-counts")?.textContent?.replace(/\s+/g, " ").trim();
    expect(counts).toBe("3 notes, 3 files");
  }, 30_000);

  test("/ says \"1 note\" and \"1 file\" for a one-note vault", async () => {
    const build = await buildFixtureVault({ "Inbox.md": "# Inbox\n" });

    expect(build.ok).toBe(true);
    const counts = homeMain(await build.page("/")).querySelector(".home-counts")?.textContent?.replace(/\s+/g, " ").trim();
    expect(counts).toBe("1 note, 1 file");
  }, 30_000);

  test("/ has the file tree sidebar with no vault file marked current, and the robots meta", async () => {
    const build = await buildFixtureVault({
      "Inbox.md": "# Inbox\n",
      "Garden/Watering.md": "# Watering\n",
    });

    expect(build.ok).toBe(true);
    const doc = await build.page("/");
    const tree = doc.querySelector("nav.file-tree");
    expect([...(tree?.querySelectorAll("a") ?? [])].map((a) => a.textContent!.trim())).toEqual(["Watering", "Inbox"]);
    expect(tree!.querySelectorAll("[aria-current]")).toHaveLength(0);
    expect(tree!.querySelectorAll("details[open]")).toHaveLength(0);
    expect(doc.querySelector('head meta[name="robots"]')?.getAttribute("content")).toBe("noindex, nofollow");
  }, 30_000);
});
