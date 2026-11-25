import { afterAll, describe, expect, test } from "bun:test";
import { buildFixtureVault, cleanupTempDirs } from "../harness/site-build";

afterAll(cleanupTempDirs);

// A valid 1x1 transparent PNG, so an embedded image's src can be checked byte for byte.
const PNG_1X1 = new Uint8Array([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52,
  0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01, 0x08, 0x06, 0x00, 0x00, 0x00, 0x1f, 0x15, 0xc4,
  0x89, 0x00, 0x00, 0x00, 0x0d, 0x49, 0x44, 0x41, 0x54, 0x78, 0x9c, 0x63, 0x00, 0x01, 0x00, 0x00,
  0x05, 0x00, 0x01, 0x0d, 0x0a, 0x2d, 0xb4, 0x00, 0x00, 0x00, 0x00, 0x49, 0x45, 0x4e, 0x44, 0xae,
  0x42, 0x60, 0x82,
]);

describe("embeds", () => {
  test("![[image]] shows the image from its raw file, with |width, |widthxheight or |alt", async () => {
    const build = await buildFixtureVault({
      "Garden/Plan.md": "# Plan\n\n![[Beds.png]] ![[Beds.png|300]] ![[Beds.png|300x200]] ![[Beds.png|the beds from above]]\n",
      "Garden/Pictures/Beds.png": PNG_1X1,
    });

    expect(build.ok).toBe(true);
    const images = [...(await build.page("/garden/plan/")).querySelectorAll("article.note img")].map((img) => [
      img.getAttribute("src"),
      img.getAttribute("alt"),
      img.getAttribute("width"),
      img.getAttribute("height"),
    ]);
    expect(images).toEqual([
      ["/raw/garden/pictures/beds.png", "Beds.png", null, null],
      ["/raw/garden/pictures/beds.png", "Beds.png", "300", null],
      ["/raw/garden/pictures/beds.png", "Beds.png", "300", "200"],
      ["/raw/garden/pictures/beds.png", "the beds from above", null, null],
    ]);
    expect(await build.bytes("raw/garden/pictures/beds.png")).toEqual(PNG_1X1);
  }, 30_000);

  test("![[audio]] and ![[video]] play from their raw files; other kinds link to their viewer page for now", async () => {
    const build = await buildFixtureVault({
      "Trip.md": "# Trip\n\n![[Waves.mp3]]\n\n![[Clips/Surf.mp4]]\n\n![[Tickets.pdf]]\n",
      "Waves.mp3": "made-up audio bytes",
      "Clips/Surf.mp4": "made-up video bytes",
      "Tickets.pdf": "%PDF-1.4 made up\n",
    });

    expect(build.ok).toBe(true);
    const note = (await build.page("/trip/")).querySelector("article.note")!;
    const audio = note.querySelector("audio")!;
    expect([audio.getAttribute("src"), audio.hasAttribute("controls")]).toEqual(["/raw/waves.mp3", true]);
    const video = note.querySelector("video")!;
    expect([video.getAttribute("src"), video.hasAttribute("controls")]).toEqual(["/raw/clips/surf.mp4", true]);
    const links = [...note.querySelectorAll("a")].map((a) => [a.textContent, a.getAttribute("href")]);
    expect(links).toEqual([["Tickets.pdf", "/tickets.pdf/"]]);
  }, 30_000);

  test("![[note]] puts the other note's rendered content inline, its own links resolved from its folder", async () => {
    const build = await buildFixtureVault({
      "Weekly.md": "# Weekly\n\nBefore.\n\n![[Recipes/Soup]]\n\nAfter.\n",
      "Recipes/Soup.md": "---\ntags: [food]\n---\n\n# Soup\n\nUse the [[Stock]] and **lots** of [salt](Salt.md).\n",
      "Recipes/Stock.md": "# Stock\n",
      "Recipes/Salt.md": "# Salt\n",
    });

    expect(build.ok).toBe(true);
    const note = (await build.page("/weekly/")).querySelector("article.note")!;
    const embed = note.querySelector(".embed")!;
    expect(embed.parentElement === note).toBe(true);
    expect(embed.querySelector("h1")?.textContent).toBe("Soup");
    expect(embed.querySelector("strong")?.textContent).toBe("lots");
    expect([...embed.querySelectorAll("a")].map((a) => [a.textContent, a.getAttribute("href")])).toEqual([
      ["Stock", "/recipes/stock/"],
      ["salt", "/recipes/salt/"],
    ]);
    expect(embed.textContent).not.toContain("food");
    expect([...note.children].map((el) => el.textContent!.trim().split("\n")[0])).toEqual(["Weekly", "Before.", "Soup", "After."]);
    // The page keeps one title h1 of its own; the embedded heading still gets an id.
    expect(note.querySelector(":scope > h1")?.textContent).toBe("Weekly");
    expect(embed.querySelector("h1")?.getAttribute("id")).toBe("soup");
  }, 30_000);

  test("![[note#Heading]] embeds only that section, up to the next heading of its level", async () => {
    const build = await buildFixtureVault({
      "Bike.md": "# Bike\n\n![[Repairs#Brakes]]\n",
      "Repairs.md": "# Repairs\n\n## Tyres\n\nPump them.\n\n## Brakes\n\nCheck them.\n\n### Pads\n\nSwap them.\n\n## Chain\n\nOil it.\n",
    });

    expect(build.ok).toBe(true);
    const embed = (await build.page("/bike/")).querySelector("article.note .embed")!;
    expect([...embed.children].map((el) => el.textContent)).toEqual(["Brakes", "Check them.", "Pads", "Swap them."]);
  }, 30_000);

  test("notes that embed each other stop with a visible marker instead of looping", async () => {
    const build = await buildFixtureVault({
      "Ping.md": "# Ping\n\nping text\n\n![[Pong]]\n",
      "Pong.md": "# Pong\n\npong text\n\n![[Ping]]\n",
      "Self.md": "# Self\n\n![[Self]]\n",
    });

    expect(build.ok).toBe(true);
    const ping = (await build.page("/ping/")).querySelector("article.note")!;
    expect(ping.querySelectorAll(".embed:not(.embed-stopped)").length).toBe(1);
    const stopped = ping.querySelector(".embed .embed-stopped")!;
    expect(stopped.textContent).toContain("nests too deep");
    expect(stopped.querySelector("a")?.getAttribute("href")).toBe("/ping/");
    expect((await build.page("/self/")).querySelector("article.note .embed-stopped a")?.getAttribute("href")).toBe("/self/");
  }, 30_000);

  test("an embed that resolves to nothing, or to an unpublished note, is a broken link that shows none of it", async () => {
    const build = await buildFixtureVault({
      "Inbox.md": "# Inbox\n\n![[Quillwort Ledger]]\n\n![[Quillwort Ledger|my diary]]\n\n![[Nowhere.png|300]]\n",
      "Quillwort Ledger.md": "---\npublish: false\n---\n\n# Hidden\n\nMarmalade obelisk.\n",
    });

    expect(build.ok).toBe(true);
    const page = await build.page("/inbox/");
    expect(page.querySelector("article.note .embed")).toBeNull();
    expect([...page.querySelectorAll("article.note .broken-link")].map((el) => [el.textContent, el.getAttribute("href")])).toEqual([
      ["broken embed", null],
      ["my diary", null],
      ["broken embed", null],
    ]);
    const html = page.documentElement.outerHTML.toLowerCase();
    for (const secret of ["quillwort", "marmalade", "nowhere"]) expect(html).not.toContain(secret);
  }, 30_000);
});
