import { afterAll, describe, expect, test } from "bun:test";
import { buildFixtureVault, cleanupTempDirs } from "../harness/site-build";

afterAll(cleanupTempDirs);

describe("attachment viewer page", () => {
  test("shows the vault path, a human-readable size and a download link to the raw file", async () => {
    const report = "%PDF-1.4 made-up report ".padEnd(1536, "x");
    const build = await buildFixtureVault({
      "Inbox.md": "# Inbox\n",
      "Work/Quarterly Report.pdf": report,
    });

    expect(build.ok).toBe(true);
    const doc = await build.page("/work/quarterly-report.pdf/");
    expect(doc.querySelector("title")?.textContent).toBe("Quarterly Report.pdf");
    const viewer = doc.querySelector("main .attachment")!;
    expect(viewer.querySelector("h1")?.textContent).toBe("Quarterly Report.pdf");
    expect(viewer.textContent).toContain("Work/Quarterly Report.pdf");
    expect(viewer.textContent).toContain("1.5 KB");
    const download = viewer.querySelector("a[download]")!;
    expect(download.getAttribute("href")).toBe("/raw/work/quarterly-report.pdf");
    expect(new TextDecoder().decode(await build.bytes("raw/work/quarterly-report.pdf"))).toBe(report);
  }, 30_000);

  test("image attachments of every image type display inline from their raw file", async () => {
    const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="1" height="1"/>';
    const build = await buildFixtureVault({
      "Inbox.md": "# Inbox\n",
      "Pics/a.png": "png",
      "Pics/b.JPG": "jpg",
      "Pics/c.jpeg": "jpeg",
      "Pics/d.webp": "webp",
      "Pics/e.gif": "gif",
      "Pics/f.svg": svg,
      "Pics/g.avif": "avif",
      "Pics/h.txt": "not an image",
    });

    expect(build.ok).toBe(true);
    for (const name of ["a.png", "b.jpg", "c.jpeg", "d.webp", "e.gif", "f.svg", "g.avif"]) {
      const img = (await build.page(`/pics/${name}/`)).querySelector("main .attachment img");
      expect(img?.getAttribute("src")).toBe(`/raw/pics/${name}`);
    }
    expect((await build.page("/pics/h.txt/")).querySelector("main img")).toBeNull();
  }, 30_000);
});
