import { afterAll, describe, expect, test } from "bun:test";
import { buildFixtureVault, cleanupTempDirs, type SiteBuild } from "../harness/site-build";

afterAll(cleanupTempDirs);

// A valid 1x1 transparent PNG, so a followed image src can be checked byte for byte.
const PNG_1X1 = new Uint8Array([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52,
  0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01, 0x08, 0x06, 0x00, 0x00, 0x00, 0x1f, 0x15, 0xc4,
  0x89, 0x00, 0x00, 0x00, 0x0d, 0x49, 0x44, 0x41, 0x54, 0x78, 0x9c, 0x63, 0x00, 0x01, 0x00, 0x00,
  0x05, 0x00, 0x01, 0x0d, 0x0a, 0x2d, 0xb4, 0x00, 0x00, 0x00, 0x00, 0x49, 0x45, 0x4e, 0x44, 0xae,
  0x42, 0x60, 0x82,
]);

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

  test("an image's src points at the raw file of the vault file it resolves to", async () => {
    const build = await buildFixtureVault({
      "Garden/Tomatoes.md": "# Tomatoes\n\n![first leaf](photos/Leaf.png)\n",
      "Garden/photos/Leaf.png": PNG_1X1,
    });

    expect(build.ok).toBe(true);
    const src = (await build.page("/garden/tomatoes/")).querySelector('article.note img[alt="first leaf"]')!.getAttribute("src")!;
    expect(src).toBe("/raw/garden/photos/leaf.png");
    expect(await build.bytes(decodeURI(src))).toEqual(PNG_1X1);
  }, 30_000);

  test("a link's #fragment is kept on the resolved URL and names a heading on the target page", async () => {
    const build = await buildFixtureVault({
      "Garden/Tomatoes.md": "# Tomatoes\n\nWater like [basil](Basil.md#watering).\n",
      "Garden/Basil.md": "# Basil\n\n## Watering\n\nDaily.\n",
    });

    expect(build.ok).toBe(true);
    const href = (await hrefOf(build, "/garden/tomatoes/", "basil"))!;
    expect(href).toBe("/garden/basil/#watering");
    const [url, fragment] = href.split("#");
    expect((await build.page(url!)).getElementById(fragment!)?.textContent).toBe("Watering");
  }, 30_000);

  test("URL-encoded and non-ASCII targets resolve", async () => {
    const build = await buildFixtureVault({
      "Trips/Lisbon.md": [
        "# Lisbon",
        "",
        "Read [the plan](Trip%20Plan.md) and [the bracketed plan](<Trip Plan.md>).",
        "",
        "![old map](Old%20Maps/Caf%C3%A9.png)",
        "",
      ].join("\n"),
      "Trips/Trip Plan.md": "# Trip plan\n",
      "Trips/Old Maps/Café.png": PNG_1X1,
    });

    expect(build.ok).toBe(true);
    expect(await headingAt(build, (await hrefOf(build, "/trips/lisbon/", "the plan"))!)).toBe("Trip plan");
    expect(await headingAt(build, (await hrefOf(build, "/trips/lisbon/", "the bracketed plan"))!)).toBe("Trip plan");
    const src = (await build.page("/trips/lisbon/")).querySelector('article.note img[alt="old map"]')!.getAttribute("src")!;
    expect(await build.bytes(decodeURI(src))).toEqual(PNG_1X1);
  }, 30_000);

  test("a link or image that resolves to nothing keeps its text, loses its target, and is marked as a broken link", async () => {
    const build = await buildFixtureVault({
      "Garden/Tomatoes.md": "# Tomatoes\n\nAsk [the neighbour](Neighbour.md) about ![the blight](blight.png), or see [basil](Basil.md).\n",
      "Garden/Basil.md": "# Basil\n",
    });

    expect(build.ok).toBe(true);
    const note = (await build.page("/garden/tomatoes/")).querySelector("article.note")!;
    expect(
      [...note.querySelectorAll(".broken-link")].map((el) => [el.tagName, el.textContent || el.getAttribute("alt"), el.getAttribute("href") ?? el.getAttribute("src")]),
    ).toEqual([
      ["A", "the neighbour", null],
      ["IMG", "the blight", null],
    ]);
    expect(note.innerHTML).not.toContain("Neighbour");
    expect(note.innerHTML).not.toContain("blight.png");
    expect(note.querySelector('a[href="/garden/basil/"]')?.classList.contains("broken-link")).toBe(false);
  }, 30_000);

  test("external URLs, mailto: and #anchor links are left exactly as written", async () => {
    const written = [
      "https://example.com/Basil.md",
      "http://example.org/a?b=c#d",
      "//cdn.example.net/Basil.md",
      "mailto:gardener@example.invalid",
      "tel:+15550100",
      "#watering",
    ];
    const build = await buildFixtureVault({
      "Basil.md": [
        "# Basil",
        "",
        ...written.map((href, i) => `[link ${i}](${href})`),
        "",
        "![remote photo](https://example.com/leaf.png)",
        "",
        "## Watering",
        "",
      ].join("\n"),
    });

    expect(build.ok).toBe(true);
    const note = (await build.page("/basil/")).querySelector("article.note")!;
    expect(written.map((_, i) => [...note.querySelectorAll("a")].find((a) => a.textContent === `link ${i}`)?.getAttribute("href"))).toEqual(
      written,
    );
    expect(note.querySelector('img[alt="remote photo"]')?.getAttribute("src")).toBe("https://example.com/leaf.png");
    expect(note.querySelectorAll(".broken-link").length).toBe(0);
  }, 30_000);

  test("links, images and media written as raw HTML resolve too, and a link to an attachment opens its viewer page", async () => {
    const build = await buildFixtureVault({
      "Garden/Tomatoes.md": [
        "# Tomatoes",
        "",
        '<p><a href="Basil.md">html basil</a> <img src="photos/Leaf.png" alt="html leaf"></p>',
        "",
        '<video src="clips/Growth.mp4"></video>',
        "",
        '<audio><source src="clips/Rain.mp3"></audio>',
        "",
        "Full size: [the leaf](photos/Leaf.png).",
        "",
      ].join("\n"),
      "Garden/Basil.md": "# Basil\n",
      "Garden/photos/Leaf.png": PNG_1X1,
      "Garden/clips/Growth.mp4": "not really a video",
      "Garden/clips/Rain.mp3": "not really audio",
    });

    expect(build.ok).toBe(true);
    const note = (await build.page("/garden/tomatoes/")).querySelector("article.note")!;
    expect(await headingAt(build, (await hrefOf(build, "/garden/tomatoes/", "html basil"))!)).toBe("Basil");
    expect(await build.bytes(decodeURI(note.querySelector('img[alt="html leaf"]')!.getAttribute("src")!))).toEqual(PNG_1X1);
    expect(await build.file(decodeURI(note.querySelector("video")!.getAttribute("src")!))).toBe("not really a video");
    expect(await build.file(decodeURI(note.querySelector("audio source")!.getAttribute("src")!))).toBe("not really audio");
    const viewer = await build.page(decodeURI((await hrefOf(build, "/garden/tomatoes/", "the leaf"))!));
    expect(viewer.querySelector("main h1")?.textContent).toBe("Leaf.png");
  }, 30_000);
});
