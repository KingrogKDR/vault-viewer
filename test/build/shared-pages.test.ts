import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { parseHTML } from "linkedom";
import { buildFixtureVault, cleanupTempDirs, type FixtureFiles, type SiteBuild } from "../harness/site-build";

// Made-up secrets, long enough to be accepted.
const SECRET = "fixture-share-secret-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
const OTHER_SECRET = "fixture-share-secret-bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";

/** The site URL a viewer page's Share button points to, if it has one. */
async function shareUrlOn(build: SiteBuild, viewerUrl: string): Promise<string | undefined> {
  const doc = await build.page(viewerUrl);
  return doc.querySelector(".page-actions a.share-button")?.getAttribute("href") ?? undefined;
}

const VAULT: FixtureFiles = {
  "Trips/Lisbon.md": "---\nshare: true\n---\n# Lisbon\n\nWe walked up to the castle.\n",
  "Trips/Porto.md": "---\nshare: \"TRUE\"\n---\n# Porto\n\nThe bridge at night.\n",
  "Trips/Budget.md": "# Budget\n\nNot shared.\n",
  "Drafts/Hidden Draft.md": "---\npublish: false\nshare: true\n---\n# Hidden Draft\n\nUnpublished, so never shared.\n",
};

let build: SiteBuild;

beforeAll(async () => {
  build = await buildFixtureVault(VAULT, { shareSecret: SECRET });
}, 60_000);

afterAll(cleanupTempDirs);

/**
 * Output files under `s/` that belong to shared pages: everything there but
 * `s/_astro/`, the site's own bundled CSS, fonts and scripts (from this repo).
 */
async function sharedOutput(b: SiteBuild): Promise<string[]> {
  return (await b.outputFiles()).filter((path) => path.startsWith("s/") && !path.startsWith("s/_astro/"));
}

describe("shared pages", () => {
  test("a shared note's shared page is at the URL its viewer page's Share button points to", async () => {
    expect(build.ok).toBe(true);
    const url = await shareUrlOn(build, "/trips/lisbon/");
    expect(url).toMatch(/^\/s\/[A-Za-z0-9_-]{22,}\/$/);
    const shared = await build.page(url!);
    expect(shared.querySelector("main article.note h1")?.textContent).toBe("Lisbon");
    expect(shared.querySelector("main")?.textContent).toContain("We walked up to the castle.");
  });

  test("`share` is read like `publish`: the string \"true\" in any case shares; notes without it, and unpublished notes, get no shared page", async () => {
    expect(build.ok).toBe(true);
    const porto = await shareUrlOn(build, "/trips/porto/");
    expect(porto).toBeDefined();
    expect(await shareUrlOn(build, "/trips/budget/")).toBeUndefined();
    // Exactly the two shared notes have shared pages.
    const pages = (await sharedOutput(build)).filter((path) => path.endsWith("/index.html"));
    expect(pages.sort()).toEqual(
      [await shareUrlOn(build, "/trips/lisbon/"), porto].map((url) => `${url!.slice(1)}index.html`).sort(),
    );
  });

  test("a different secret gives a different URL, and the same secret the same one", async () => {
    const again = await buildFixtureVault(VAULT, { shareSecret: SECRET });
    const other = await buildFixtureVault(VAULT, { shareSecret: OTHER_SECRET });
    expect(again.ok && other.ok).toBe(true);
    const url = await shareUrlOn(build, "/trips/lisbon/");
    expect(await shareUrlOn(again, "/trips/lisbon/")).toBe(url);
    const otherUrl = await shareUrlOn(other, "/trips/lisbon/");
    expect(otherUrl).toMatch(/^\/s\/[A-Za-z0-9_-]{22,}\/$/);
    expect(otherUrl).not.toBe(url);
    expect(other.hasPage(url!)).toBe(false);
  }, 60_000);

  test("without SHARE_SECRET the build succeeds, says sharing is off, and writes no shared pages or their files, and no Share button", async () => {
    const off = await buildFixtureVault(VAULT);
    expect(off.ok).toBe(true);
    expect(off.output).toMatch(/sharing is off/i);
    expect(await sharedOutput(off)).toEqual([]);
    expect(off.hasPage("/trips/lisbon/")).toBe(true);
    expect(await shareUrlOn(off, "/trips/lisbon/")).toBeUndefined();
  }, 60_000);

  test("a SHARE_SECRET too short to keep links unguessable fails the build, saying why", async () => {
    const weak = await buildFixtureVault(VAULT, { shareSecret: "short-secret" });
    expect(weak.ok).toBe(false);
    expect(weak.output).toMatch(/SHARE_SECRET .*at least 32/);
    expect(weak.output).not.toContain("short-secret");
  }, 60_000);

  test("a vault file whose page would land under /s/, outside Access, fails the build naming it", async () => {
    const clash = await buildFixtureVault({ "S/Groceries.md": "# Groceries\n", "Inbox.md": "# Inbox\n" });
    expect(clash.ok).toBe(false);
    expect(clash.output).toContain('"S/Groceries.md"');
    expect(clash.output).toMatch(/\/s\//);
  }, 60_000);
});

describe("what a shared page shows", () => {
  // A made-up 1x1 PNG.
  const PNG = new Uint8Array([
    0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52, 0x00, 0x00, 0x00, 0x01,
    0x00, 0x00, 0x00, 0x01, 0x08, 0x06, 0x00, 0x00, 0x00, 0x1f, 0x15, 0xc4, 0x89, 0x00, 0x00, 0x00, 0x0d, 0x49, 0x44, 0x41,
    0x54, 0x78, 0x9c, 0x63, 0x00, 0x01, 0x00, 0x00, 0x05, 0x00, 0x01, 0x0d, 0x0a, 0x2d, 0xb4, 0x00, 0x00, 0x00, 0x00, 0x49,
    0x45, 0x4e, 0x44, 0xae, 0x42, 0x60, 0x82,
  ]);
  // Names that must never reach a visitor: the unshared and unpublished notes' titles, file names and folders.
  const SECRETS = ["Wedding Seating", "wedding-seating", "Seating Plan", "Quarrels", "quarrels", "Family Matters", "family-matters", "Pictures", "pictures"];

  let site: SiteBuild;
  let sharedUrl: string;

  beforeAll(async () => {
    site = await buildFixtureVault(
      {
        "Garden/Plan.md": [
          "---\nshare: true\n---\n# Garden plan",
          "Beds go by the [[Shed]] and the [shed again](Shed.md), not by the [[Wedding Seating]] or [[Quarrels|the other thing]].",
          "Also see [this](<Family Matters/Quarrels.md>) and <a href=\"Wedding%20Seating.md\">that</a>.",
          "![[Beds.png]] and ![the pond](Pictures/Pond.png)",
          "![[Family Matters/Recipes]]",
          "",
        ].join("\n\n"),
        "Garden/Shed.md": "---\nshare: true\n---\n# Shed\n\nTools.\n",
        "Garden/Pictures/Beds.png": PNG,
        "Garden/Pictures/Pond.png": PNG,
        "Wedding Seating.md": "# Seating Plan\n\nPrivate.\n",
        "Family Matters/Quarrels.md": "---\npublish: false\n---\n# Quarrels\n",
        // Embedded into the shared note, so its content is shared (ADR-0006); its own link is not.
        "Family Matters/Recipes.md": "Soup with leeks, from [[Wedding Seating|a list]].\n",
      },
      { shareSecret: SECRET },
    );
    expect(site.ok).toBe(true);
    sharedUrl = (await shareUrlOn(site, "/garden/plan/"))!;
  }, 60_000);

  test("a link to another shared note goes to that note's shared page; a link to anything else keeps its text and has no href", async () => {
    const doc = await site.page(sharedUrl);
    const shedUrl = (await shareUrlOn(site, "/garden/shed/"))!;
    const links = [...doc.querySelectorAll("article.note a")].map((a) => [a.textContent, a.getAttribute("href"), a.classList.contains("broken-link")]);
    expect(links).toEqual([
      ["Shed", shedUrl, false],
      ["shed again", shedUrl, false],
      ["broken link", null, true],
      ["the other thing", null, true],
      ["this", null, true],
      ["that", null, true],
      ["a list", null, true],
    ]);
  });

  test("the shared page's images are copied under /s/<token>/ and shown from there", async () => {
    const doc = await site.page(sharedUrl);
    const sources = [...doc.querySelectorAll("article.note img")].map((img) => img.getAttribute("src")!);
    expect(sources).toHaveLength(2);
    for (const src of sources) {
      expect(src.startsWith(sharedUrl)).toBe(true);
      expect(await site.bytes(decodeURIComponent(src.slice(1)))).toEqual(PNG);
    }
    expect(new Set(sources).size).toBe(2);
    // The embedded note's content is there too.
    expect(doc.querySelector("article.note .embed")?.textContent).toContain("Soup with leeks");
  });

  test("no unshared note's title, file name or path appears anywhere under /s/", async () => {
    const files = (await site.outputFiles()).filter((path) => path.startsWith("s/"));
    expect(files.length).toBeGreaterThan(0);
    for (const path of files) {
      const text = path.endsWith(".png") ? "" : await site.file(path);
      for (const secret of SECRETS) {
        expect({ path, leaks: path.includes(secret) || text.includes(secret) }).toEqual({ path, leaks: false });
      }
    }
  });

  test("the shared page has no way out: no link to /, no file tree, no download, no header; and the robots meta", async () => {
    const doc = await site.page(sharedUrl);
    expect(doc.querySelector("nav, .file-tree, .site-header, [download], .page-actions")).toBeNull();
    expect(doc.querySelector('head meta[name="robots"]')?.getAttribute("content")).toBe("noindex, nofollow");
  });

  test("nothing the shared page loads leaves /s/, the only path outside Access: its stylesheets and fonts included", async () => {
    const doc = await site.page(sharedUrl);
    const urls = [
      ...[...doc.querySelectorAll("[href]")].map((el) => el.getAttribute("href")!),
      ...[...doc.querySelectorAll("[src]")].map((el) => el.getAttribute("src")!),
    ];
    const stylesheets = [...doc.querySelectorAll('link[rel="stylesheet"]')].map((el) => el.getAttribute("href")!);
    expect(stylesheets.length).toBeGreaterThan(0);
    for (const sheet of stylesheets) {
      const css = await site.file(sheet);
      urls.push(...[...css.matchAll(/url\(\s*["']?([^"')]+)["']?\s*\)/g)].map((m) => m[1]!).filter((url) => !url.startsWith("data:")));
    }
    expect(urls.length).toBeGreaterThan(stylesheets.length);
    for (const url of urls) expect({ url, underS: url.startsWith("/s/") }).toEqual({ url, underS: true });
  });

  test("a top-level 404.html exists and shows nothing of the vault, since a host without one serves the home page for unknown /s/ URLs", async () => {
    const files = await site.outputFiles();
    expect(files).toContain("404.html");
    const text = await site.file("404.html");
    const doc = parseHTML(text).document;
    expect(doc.querySelector("nav, .file-tree, .site-header, article.note")).toBeNull();
    expect(doc.querySelector('head meta[name="robots"]')?.getAttribute("content")).toBe("noindex, nofollow");
    for (const name of ["Garden", "garden", "Shed", "Wedding", "Family", "Plan", ...SECRETS]) expect({ name, shown: text.includes(name) }).toEqual({ name, shown: false });
    for (const href of [...doc.querySelectorAll("[href], [src]")].map((el) => el.getAttribute("href") ?? el.getAttribute("src")!)) {
      expect(href.startsWith("/s/_astro/")).toBe(true);
    }
  });

  test("notes and attachments that aren't shared get no Share button", async () => {
    expect(await shareUrlOn(site, "/wedding-seating/")).toBeUndefined();
    expect(await shareUrlOn(site, "/garden/pictures/beds.png/")).toBeUndefined();
  });
});
