import { afterAll, describe, expect, test } from "bun:test";
import { buildFixtureVault, cleanupTempDirs, type SiteBuild } from "../harness/site-build";

afterAll(cleanupTempDirs);

/** The href of the note link whose text is `text`, on the page at `url`. */
async function hrefOf(build: SiteBuild, url: string, text: string): Promise<string | null> {
  const links = [...(await build.page(url)).querySelectorAll("article.note a")];
  const link = links.find((a) => a.textContent === text);
  if (!link) throw new Error(`No link "${text}" on ${url}`);
  return link.getAttribute("href");
}

/** The opening h1 of the page a viewer URL leads to, proving which vault file it reached. */
async function headingAt(build: SiteBuild, href: string): Promise<string | null | undefined> {
  return (await build.page(decodeURI(href))).querySelector("article.note h1")?.textContent;
}

describe("relative links and images resolve the way Obsidian does", () => {
  test("a link to a note in the same folder leads to that note's viewer page", async () => {
    const build = await buildFixtureVault({
      "Garden/Tomatoes.md": "# Tomatoes\n\nWater them like the [basil](Basil.md).\n",
      "Garden/Basil.md": "# Basil\n",
    });

    expect(build.ok).toBe(true);
    const href = await hrefOf(build, "/garden/tomatoes/", "basil");
    expect(href).toBe("/garden/basil/");
    expect(await headingAt(build, href!)).toBe("Basil");
  }, 30_000);

  test("`./` and `../` in a link are followed from the note's folder", async () => {
    const build = await buildFixtureVault({
      "Garden/Beds/North.md": "# North bed\n\nSee [the shed](../../Shed.md) and [the south bed](./South.md).\n",
      "Garden/Beds/South.md": "# South bed\n",
      "Shed.md": "# Shed\n",
    });

    expect(build.ok).toBe(true);
    expect(await headingAt(build, (await hrefOf(build, "/garden/beds/north/", "the shed"))!)).toBe("Shed");
    expect(await headingAt(build, (await hrefOf(build, "/garden/beds/north/", "the south bed"))!)).toBe("South bed");
  }, 30_000);

  test("a target not in the note's folder resolves from the vault root, but the note's folder comes first", async () => {
    const build = await buildFixtureVault({
      "Trips/Lisbon.md": "# Lisbon\n\nPacked from [the list](Lists/Packing.md); costs in [the budget](Budget.md).\n",
      "Lists/Packing.md": "# Packing list\n",
      "Trips/Budget.md": "# Trip budget\n",
      "Budget.md": "# Household budget\n",
    });

    expect(build.ok).toBe(true);
    expect(await headingAt(build, (await hrefOf(build, "/trips/lisbon/", "the list"))!)).toBe("Packing list");
    expect(await headingAt(build, (await hrefOf(build, "/trips/lisbon/", "the budget"))!)).toBe("Trip budget");
  }, 30_000);

  test("otherwise a target matches the end of a vault path anywhere, by whole segments, and the shortest vault path wins", async () => {
    const build = await buildFixtureVault({
      "Journal/Monday.md": "# Monday\n\nMade [soup](Recipes/Soup.md) again.\n",
      "Archive/Old/Recipes/Soup.md": "# Old soup\n",
      "Kitchen/Recipes/Soup.md": "# Kitchen soup\n",
      "X/MyRecipes/Soup.md": "# Not a match\n",
    });

    expect(build.ok).toBe(true);
    expect(await headingAt(build, (await hrefOf(build, "/journal/monday/", "soup"))!)).toBe("Kitchen soup");
  }, 30_000);

  test("a target that matches nothing in its own case resolves case-insensitively, but an exact-case match anywhere wins", async () => {
    const build = await buildFixtureVault({
      "Desk.md": "# Desk\n\nSee [the lamp](office/LAMP.md) and [the plan](Plans/plan.md).\n",
      "Office/Lamp.md": "# Lamp\n",
      "Plans/Plan.md": "# Root plan\n",
      "Work/Plans/plan.md": "# Work plan\n",
    });

    expect(build.ok).toBe(true);
    expect(await headingAt(build, (await hrefOf(build, "/desk/", "the lamp"))!)).toBe("Lamp");
    expect(await headingAt(build, (await hrefOf(build, "/desk/", "the plan"))!)).toBe("Work plan");
  }, 30_000);

  test("a target written without `.md` also finds the note, at every step", async () => {
    const build = await buildFixtureVault({
      "Garden/Tomatoes.md": "# Tomatoes\n\nNext to [basil](Basil), see [soup](Recipes/Soup) and [the release](Release-1.2).\n",
      "Garden/Basil.md": "# Basil\n",
      "Kitchen/Recipes/Soup.md": "# Soup\n",
      "Release-1.2.md": "# Release 1.2\n",
    });

    expect(build.ok).toBe(true);
    expect(await headingAt(build, (await hrefOf(build, "/garden/tomatoes/", "basil"))!)).toBe("Basil");
    expect(await headingAt(build, (await hrefOf(build, "/garden/tomatoes/", "soup"))!)).toBe("Soup");
    expect(await headingAt(build, (await hrefOf(build, "/garden/tomatoes/", "the release"))!)).toBe("Release 1.2");
  }, 30_000);
});
