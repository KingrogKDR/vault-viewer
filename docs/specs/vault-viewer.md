---
title: Vault Viewer — Spec
status: ready-for-agent
labels: [ready-for-agent]
source: Vault Viewer Plan (2026-11-23), kept in the private vault
created: 2026-11-24
---

# Vault Viewer — Spec

## Problem Statement

My notes live in an Obsidian vault on one desktop machine. That vault holds markdown notes, plus images, PDFs, HTML lessons, Excalidraw drawings, Office documents, code and data files, and some large videos. Away from that desktop I can't read any of it. Obsidian Sync and hosted note services cost money or don't handle every file type. A self-hosted server (Nextcloud, a VM) is more to maintain than I want.

I want to read the whole vault from any device, my phone included, and offline where possible. It must cost nothing, stay private, and leave editing in Obsidian on the desktop exactly as it is today.

## Solution

There are three parts:

1. **vaultsync.** A small desktop CLI, run every hour, keeps the vault backed up to a private GitHub repo (`Obsidian_notes`). Files over 20 MB go to a private Cloudflare R2 bucket instead of git, and a manifest in the vault records where each one went.
2. **The vault viewer.** A read-only static site, built daily from that repo (or on demand), runs on Cloudflare Pages behind Cloudflare Access with GitHub login. Every file type has a viewer:
   - notes are rendered with Obsidian's syntax (wikilinks, embeds, callouts, tags, backlinks);
   - PDFs open in a PDF viewer, and Office files are converted to PDF;
   - media plays inline;
   - code is highlighted;
   - everything else can be downloaded.
3. **Offline use.** The site is an installable PWA that keeps working offline. It caches notes ahead of time, caches big files once opened, and lets me pin files or folders for offline use.

## User Stories

### Reading notes

1. As the vault owner, I want to open the site on my phone and see my notes rendered as formatted pages, so that I can read them away from my desktop.
2. As the vault owner, I want GitHub-flavoured markdown (tables, task lists, strikethrough, autolinks, fenced code) to render correctly, so that my notes look as they do in Obsidian.
3. As the vault owner, I want frontmatter hidden from the rendered page, so that metadata doesn't clutter the note.
4. As the vault owner, I want a frontmatter `title` to replace the file name as the page title, so that notes can have nicer titles than their file names.
5. As the vault owner, I want notes with `publish: false` left off the site entirely, so that I can keep some notes desktop-only.
6. As the vault owner, I want links pointing to unpublished notes to show as broken rather than leaking the note, so that hiding a note really hides it.
7. As the vault owner, I want raw inline HTML in my notes (e.g. `<br/>`, `<details>`) to render, so that notes using HTML look right.
8. As the vault owner, I want headings to get stable anchor IDs, so that `#heading` links land on the right section.
9. As the vault owner, I want standard markdown links and images that use relative paths (e.g. `images/foo.png`) to resolve to the right vault file, so that my existing notes work without edits.
10. As the vault owner, I want links that resolve to nothing to look visibly broken, so that I can find and fix them.
11. As the vault owner, I want `[[note]]` wikilinks to resolve the way Obsidian does (shortest unique path, case-insensitive fallback), so that every link I made in Obsidian works on the site.
12. As the vault owner, I want `[[note|alias]]` to show the alias text, so that link text reads as I wrote it.
13. As the vault owner, I want `[[note#heading]]` to jump to that heading, so that section links work.
14. As the vault owner, I want `![[note]]` to embed the other note's content inline, so that composed notes read as in Obsidian.
15. As the vault owner, I want `![[image.png]]`, `![[file.pdf]]`, `![[video.mp4]]` and `![[audio.mp3]]` to embed the matching viewer inline, so that embedded media shows up in the note.
16. As the vault owner, I want `#tags` in the body and in frontmatter to become links to a tag page, so that I can browse by tag.
17. As the vault owner, I want a tag index listing every tag and its notes, so that I can find everything on a topic.
18. As the vault owner, I want `> [!type]` callouts (including foldable ones) to render as styled boxes, so that my callouts keep their meaning.
19. As the vault owner, I want mermaid code blocks to render as diagrams, so that my architecture diagrams are readable.
20. As the vault owner, I want `==highlight==` to render as highlighted text, so that my emphasis survives.
21. As the vault owner, I want a backlinks panel on each note listing the notes that link to it, so that I can follow connections both ways.
22. As the vault owner, I want PDF++ highlight links (`[[file.pdf#page=N&selection=…|text]]`) to render as a quote that opens the PDF at page N, so that my PDF highlights are readable and traceable.
23. As the vault owner, I want unsupported syntax (Dataview, block refs, `%%comments%%`, Canvas) to fail safely, either hidden or shown as plain text, so that it never breaks a page.

### Navigating

24. As the vault owner, I want a file-tree sidebar mirroring my vault's folders, so that I can browse the way I do in Obsidian.
25. As the vault owner, I want the folders containing the current page to be open and the current file highlighted in the tree, so that I know where I am.
26. As the vault owner, I want folders listed before files, in natural sort order (so "2" comes before "10"), so that the tree reads like a file manager.
27. As a phone user, I want the file tree to collapse behind a menu button, so that notes get the full screen width.
28. As the vault owner, I want a home page showing the vault's folders and some counts, so that I have a starting point.
29. As the vault owner, I want readable, stable URLs derived from file paths (lowercase, spaces as hyphens), so that links are shareable and bookmarkable.
30. As the vault owner, I want the build to fail with a clear message when two files map to the same URL, so that no file silently disappears.
31. As the vault owner, I want a light and dark theme that follows my device setting, so that the site is comfortable at night.
85. As the vault owner, I want every folder to lead somewhere: to its folder index note (`index.md`, `README.md`, a note named like the folder, or its one "index" note) when it has one, else to a generated folder page listing its subfolders and files with a breadcrumb, so that I can browse folders from the home page, the file tree and breadcrumbs.

### Viewing other file types

32. As the vault owner, I want every non-markdown file to have its own viewer page showing its path, size and a download link, so that I can open anything in the vault.
33. As the vault owner, I want images (png, jpg, webp, gif, svg, avif) shown inline, so that I can look at them without downloading.
34. As the vault owner, I want PDFs opened in an in-page PDF viewer, so that I can read them on my phone without leaving the site.
35. As the vault owner, I want video (mp4, webm, mov, mkv, ogv) and audio (mp3, m4a, ogg, flac, wav) to play inline with seeking, so that I can watch and listen in the browser.
36. As the vault owner, I want HTML files (e.g. my lesson pages) shown in a sandboxed frame without same-origin access, so that I can view them without them touching the site or my session.
37. As the vault owner, I want Word, ODT, PowerPoint and Excel files shown as converted PDFs, with a link to download the original, so that I can read Office documents on any device.
38. As the vault owner, I want Excalidraw drawings shown as their exported SVG, so that drawings are viewable outside Obsidian.
39. As the vault owner, I want code, text and JSON files shown with syntax highlighting, so that they are readable.
40. As the vault owner, I want CSV files shown as a table, so that tabular data is easy to scan.
41. As the vault owner, I want any other file type to offer a download, so that nothing is unreachable.
42. As the vault owner, I want to download any file's original bytes, notes' markdown source included, so that I can open them in another app.

### Search and history

43. As the vault owner, I want full-text search across all notes that works offline, so that I can find things fast on my phone.
44. As the vault owner, I want each note to show when it was last edited, according to git history, so that I know how fresh it is.
45. As the vault owner, I want a "recently changed" page, so that I can see what I've been working on.

### Large files

46. As the vault owner, I want files over 20 MB stored in a private R2 bucket instead of git, so that the repo stays small and within GitHub and Pages limits.
47. As the vault owner, I want large files to stream through the site with Range support, so that big videos seek without downloading the whole file.
48. As the vault owner, I want the R2 bucket to stay private and be reachable only through the Access-protected site, so that my files are never publicly exposed.
49. As the vault owner, I want large-file viewer pages to look the same as normal ones, so that where a file is stored doesn't matter to me.

### Sync (desktop)

50. As the vault owner, I want my vault committed and pushed to GitHub every hour automatically, so that my edits are backed up and published without manual steps.
51. As the vault owner, I want sync to skip `.git/` and `.obsidian/`, so that app state isn't synced.
52. As the vault owner, I want large files uploaded to R2 once, keyed by content hash, so that unchanged files are never re-uploaded.
53. As the vault owner, I want sync to keep a managed block in `.gitignore` listing the large files, so that they never get committed by accident.
54. As the vault owner, I want `media-manifest.json` updated with each large file's hash, size, key, MIME type and mtime, and entries for deleted files removed, so that the site can find every large file.
55. As the vault owner, I want sync to pull with rebase before pushing, and to stop and notify me on a conflict without forcing anything, so that I never lose work.
56. As the vault owner, I want sync to refuse any upload that would take the bucket over 8 GB, notify me, and leave the file local and uncommitted, so that I never pay for R2.
57. As the vault owner, I want sync never to delete anything from R2 itself, so that a sync bug can't destroy files.
58. As the vault owner, I want a `--dry-run` mode that reports what sync would do without doing it, so that I can test it safely.
59. As the vault owner, I want sync to commit only when something changed, so that history isn't full of empty commits.
60. As the vault owner, I want systemd user units (a oneshot service and an hourly persistent timer), so that sync runs reliably, including after the machine was off.

### Build and deploy

61. As the vault owner, I want the site rebuilt and deployed daily, so that it stays at most a day behind the vault.
62. As the vault owner, I want a manual "deploy now" trigger, so that I can publish an edit straight away.
63. As the vault owner, I want scheduled builds skipped when the vault's HEAD hasn't changed since the last deploy, so that Actions time and deploys aren't wasted.
64. As the vault owner, I want CI to read the private vault repo with a read-only deploy key, so that CI cannot modify my notes.
65. As the vault owner, I want Office-to-PDF conversion cached by content hash, so that builds stay fast.
66. As the vault owner, I want deploys done by direct upload, so that they don't use the Pages build quota.

### Privacy and protection

67. As the vault owner, I want the whole site behind Cloudflare Access with GitHub login only (no email OTP) and a one-month session, so that only I can read it (apart from the pages I share, see Sharing) and I rarely have to log in again.
68. As the vault owner, I want `X-Robots-Tag: noindex, nofollow` on every response and a `robots.txt` that disallows everything, so that nothing gets indexed even if Access is misconfigured.
69. As the vault owner, I want the site's own code in a public repo with no vault content in it, so that Actions minutes are free and nothing private leaks.

### Sharing

78. As the vault owner, I want to share one note by setting `share: true` in its frontmatter, so that I choose in Obsidian exactly which pages others can read.
79. As the vault owner, I want a share button at the top of a shared note's viewer page that copies its link (or opens my phone's share sheet), so that sending it is one tap.
80. As a visitor, I want to open a shared page without logging in, so that the owner can share with anyone.
81. As the vault owner, I want a shared page to show only that note (no file tree, no markdown download, no links into the rest of the vault except other shared pages), so that sharing one note reveals nothing else.
82. As the vault owner, I want the images and embeds in a shared note to show on its shared page, so that visitors see the note as I do.
83. As the vault owner, I want a shared page's link to be unguessable and to stop working after I remove `share: true` and the site deploys, so that I can take a page back.
84. As the vault owner, I want a build without the share secret to write no shared pages, so that a misconfigured build never exposes anything.

### Offline / PWA

70. As a phone user, I want to install the site as an app, so that it opens like a native app.
71. As a phone user, I want the app shell, every rendered note, the search index and images under 1 MB cached ahead of time, so that the whole vault's text works offline.
72. As a phone user, I want PDFs, videos and other large files cached when I first open them, so that anything I've viewed works offline later.
73. As a phone user, I want to pin a file or folder for offline use, so that I can prepare for a flight.
74. As a phone user, when my Access session expires I want to keep reading cached content and see a "Session expired — log in" banner, so that expiry doesn't lock me out of offline notes.
75. As a phone user, I want the login banner to do a top-level navigation to log in, so that the GitHub login flow works.
76. As the vault owner, I want redirects and Access login responses never cached, so that the app can't get stuck on a login page.
77. As the vault owner, I want media cached aggressively and never re-fetched once cached, so that the site stays under the 100k/day Functions quota.

## Implementation Decisions

### Repos and stack
- Two repos. The private `Obsidian_notes` repo holds the vault and is the source of truth. The public `vault-viewer` repo holds the site, the `vaultsync` CLI and CI. This project is `vault-viewer`.
- The site uses Astro (v7) with static output, built on Bun (there is no npm on the dev machine). Markdown goes through a unified pipeline we own: remark-parse, GFM, frontmatter, remark-rehype with raw HTML allowed, rehype-raw, heading slugs, then our own remark/rehype plugins. We don't use Astro's built-in markdown or content collections, so the Obsidian behaviour stays entirely in our plugins.
- Raw HTML in notes is allowed. The content is self-authored and behind Access. HTML *files* are still sandboxed in the viewer.
- `vaultsync` is written in Go, as a command in the same repo.
- Hosting is Cloudflare Pages on `*.pages.dev`, with no custom domain. One Pages Function serves `/media/*`. Everything else is static.

### Vault reader module
- This module takes a vault directory and returns a list of vault files. Each file has: its vault-relative path, name, lowercased extension, kind, URL slug, viewer URL, raw-bytes URL, size, and parsed frontmatter (notes only). It also returns lookup maps by path and by slug.
- The file list comes from git when the vault is a git repo: tracked files plus untracked files that aren't ignored. That way a local preview matches what CI builds from the checkout and respects the vault's own `.gitignore`. When the vault isn't a git repo, the module walks the directory. Any path segment starting with `.` is always excluded.
- Notes with `publish: false` are removed at this stage, so the rest of the system never sees them.
- The vault location comes from the `VAULT_DIR` environment variable. The build fails with a clear message if it's missing or doesn't exist.

### URL scheme
- Each path segment becomes a slug: NFC-normalised, lowercased, runs of anything other than letters (with their combining marks), digits, `.`, `_` and `-` collapsed to one `-`, then runs of `-` collapsed to one, with leading and trailing `-` trimmed. Notes drop `.md`. Other files keep their extension.
- Viewer page: `/<slug>/` (trailing slash, directory format). Raw bytes: `/raw/<slug>` for non-notes and `/raw/<slug>.md` for notes. Large files: `/media/<vault path>`.
- If two files produce the same slug, the build fails and names both files.
- Folder page: `/<folder slug>/`, the folder's vault path slugged segment by segment like a vault path, but never dropping `.md`. A folder page that would land on a vault file's output fails the build the same way, naming the vault file and the folder (`Folder/`).

### Folders (story 85)
- A folder exists when a published vault file is inside it, at any depth; unpublished notes never make, fill or index one.
- Its **folder index note** is the first match, names compared case-insensitively, among published notes: `Folder/index.md`; `Folder/README.md`; `Folder/<FolderName>.md`; a sibling `<FolderName>.md` next to the folder (the Folder Notes plugin's layout); else the one note directly in the folder whose file name, without `.md`, contains the whole word "index" (letters and digits around it make it part of another word, so `Reindex.md` doesn't count; two such notes means none counts).
- Every folder gets a generated **folder page**, except one with a sibling `<FolderName>.md`: that note's viewer page already has the folder's URL. The folder page shows a breadcrumb (the vault, then each ancestor), the folder index note first as a prominent link when there is one, then the folder's subfolders and vault files in the file tree's order and names. The index note stays an ordinary note, listed and with its own viewer page.
- Any link to a folder (home page, breadcrumb, folder page, file tree) goes to its folder index note when it has one, else to its folder page. In the file tree, the folder's `summary` keeps toggling it without JavaScript, and a separate small icon link (named "Open <folder>") next to it goes to that destination.
- Folder pages are owner-only, like viewer pages: no Share button, nothing under `/s/`.

### Link resolver module
- Signature: (vault, linking note's path, link target) → vault file or nothing.
- Obsidian's resolution order:
  1. relative to the linking note's folder;
  2. relative to the vault root;
  3. trailing-path match anywhere in the vault, shortest path wins, with a case-insensitive pass as fallback.

  Each step tries the target with `.md` appended when the target has no extension.
- Markdown links, images and wikilinks all use this resolver. The current vault uses relative markdown image links heavily, so these must work from milestone 1.
- Fragments (`#heading`, `#page=N…`) are split off before resolving and put back on the resulting URL.

### Markdown renderer
- Input: (vault, file, source). Output: an HTML string plus the data that other modules need: outgoing links (for backlinks), tags, and headings.
- Unresolved links and images get the `broken-link` class.
- Wikilinks and embeds are parsed by our own remark plugin. Embed depth is capped so that notes embedding each other can't loop forever.
- Callouts, `==highlight==`, mermaid, tags and PDF++ links are each a small plugin of their own.

### Viewers
- Each file kind maps to a viewer, following the plan's extension table. The vault reader assigns the kind; the viewer page picks the component. The kinds are note, image, pdf, video, audio, html, office, excalidraw, code, csv and other.
- PDFs use pdf.js. HTML uses an iframe with `sandbox` and no `allow-same-origin`. Code uses Shiki. CSV becomes a table.
- An Excalidraw note (`.excalidraw.md`) displays its sibling exported `.svg`.
- Office files are converted to PDF in CI with LibreOffice headless. The viewer shows the converted PDF plus a download link for the original.

### Large files and the media Function
- `media-manifest.json` schema (version 1) maps each vault path to `sha256`, `size`, `key` (`sha256/<hash>`), `mime` and `mtime`.
- The vault reader merges manifest entries into the file list, so large files get viewer pages like any other file. Their raw URL is `/media/<path>` instead of `/raw/…`.
- The `/media/*` Function looks up the path in the manifest bundled with the deploy and streams the object from the R2 binding. It supports single Range requests (206 with Content-Range), sets Content-Type from the manifest, and sends long-lived cache headers. Unknown paths get a 404.

### vaultsync CLI
- Steps, in order:
  1. walk the vault, skipping `.git/` and `.obsidian/`;
  2. hash each file over 20 MB and upload any unseen hash to R2;
  3. rewrite the managed `.gitignore` block;
  4. write the manifest, dropping entries for deleted files;
  5. `git pull --rebase` (on conflict: abort, `notify-send`, exit non-zero);
  6. `git add -A`, commit, push — only if something changed.
- R2 access sits behind a small object-store interface (head, put, total size), so tests can swap in a fake.
- The 8 GB cap is checked against the bucket's total before each upload. On refusal: notify, and leave that file out of both the commit and the manifest.
- The CLI never deletes from R2 and never force-pushes. `--dry-run` prints the planned actions and changes nothing.
- systemd user units: `vaultsync.service` (oneshot) and `vaultsync.timer` (`OnCalendar=hourly`, `Persistent=true`).

### Build pipeline (GitHub Actions in vault-viewer)
- Triggers: a daily `schedule` and `workflow_dispatch`.
- Check out `Obsidian_notes` with a read-only deploy key. Compare its HEAD SHA with the last deployed SHA, which is kept in the Actions cache. Skip if they're equal and the run isn't manual.
- Steps: LibreOffice conversion (cached by content hash) → read `git log` for per-file last-edited dates and the recently-changed list → Astro build → Pagefind → `wrangler pages deploy`.
- Secrets: `CLOUDFLARE_API_TOKEN` (Pages edit only), `VAULT_DEPLOY_KEY` and `SHARE_SECRET`.

### Sharing (ADR-0006)
- `share` is read like `publish`: `true` or the string `"true"` in any case shares the note; anything else does not. An unpublished note is never shared.
- Each shared note gets a shared page at `/s/<token>/`, where the token is a base64url HMAC-SHA256 of its vault path under `SHARE_SECRET` (a build secret). Its images and embedded raw files are copied under `/s/<token>/`.
- Links on a shared page go through the same resolver. A target that is itself a shared note links to its shared page; anything else keeps its text and loses its target, with the broken-link class.
- Cloudflare Access gets one extra application for the `/s/` path with a Bypass (Everyone) policy. Part of the manual setup checklist.
- Nothing a shared page loads leaves `/s/`: the site's bundled CSS, fonts and scripts are built under `/s/_astro/` (they come from the public repo, never the vault). The site has a vault-free top-level `404.html`, because without one Cloudflare Pages answers unknown URLs, `/s/` ones included, with the home page. No vault file's viewer page may land under `/s/`; the build fails if one would.
- The service worker never caches or precaches `/s/` pages for the owner.

### Headers
- `_headers` sets `X-Robots-Tag: noindex, nofollow`, `Referrer-Policy: no-referrer` and `X-Content-Type-Options: nosniff` on all paths. `robots.txt` disallows everything. Every page also carries a robots `noindex` meta tag.

### PWA
- A service worker with three caches: the precache (app shell, all note pages, search index, images under 1 MB, listed in a manifest generated at build time), an on-demand cache (anything opened), and a pinned cache.
- Every fetch sends `X-Requested-With: XMLHttpRequest`, so Access answers 401 instead of redirecting. On a 401 or an opaque redirect, the service worker serves the cached copy and the page shows the session-expired banner. Responses that are redirects or come from `cloudflareaccess.com` are never stored.
- Media is cache-first and never revalidated. Pages are network-first with cache fallback.

### Milestones (implementation chunks)
1. **Skeleton:** vault reader, URL scheme, link resolver (for relative markdown links), GFM rendering, images, file tree, home page, headers. Deployed by hand behind Access.
2. **Obsidian syntax:** wikilinks, embeds, callouts, tags with tag index, mermaid, highlight, backlinks.
3. **Pipeline:** the Actions workflow with SHA skip; `vaultsync` without R2, plus the systemd units.
4. **Viewers:** pdf.js, video and audio, sandboxed HTML, code and CSV, Excalidraw SVG, PDF++ quote links.
5. **Office and large files:** LibreOffice conversion, R2 upload, manifest, the `/media/*` Function, the 8 GB guard.
6. **Search and history:** Pagefind, last-edited dates, recently changed.
7. **PWA:** precache, on-demand cache, pinning, Access-expiry handling.
8. **Sharing:** shared pages, the share button, the `/s/` Access bypass. Can land any time after milestone 2.

## Testing Decisions

- **What makes a good test:** it drives the system from outside, through one of the four seams below, and checks only what a user or the next system sees: output files and HTML, git state, HTTP responses, and browser behaviour. Tests don't reach into internal functions, plugin order or intermediate ASTs, so refactoring the pipeline never breaks them.
- **Seam 1 — site build (primary).** Build the site against a small fixture vault that lives in the repo and is made into a git repo during test setup. Then check the output directory: which pages exist at which URLs, the HTML inside them (with a DOM parser and selectors, not string snapshots), copied raw bytes (byte-identical), headers and robots files, the tag index, backlinks, and the search index. The fixture vault holds one example of each syntax and file kind, plus edge cases:
  - a `publish: false` note;
  - colliding slugs, in a separate fixture that must fail;
  - a git-ignored file;
  - a relative image link and an ambiguous wikilink;
  - mutually embedding notes;
  - unicode and space-filled names;
  - a shared note that links to a shared and an unshared note, and a build without `SHARE_SECRET`.

  Milestones 1, 2, 4, 5 (the conversion output and how manifest entries render) and 6 are tested here.
- **Seam 2 — `vaultsync` CLI.** Run the compiled binary as a subprocess against a temporary vault, a local bare git repo acting as the remote, and a fake object store. Check: commits and pushed history, the `.gitignore` managed block, manifest contents, uploaded keys, no re-upload of known hashes, the 8 GB refusal, conflict handling (non-zero exit, no forced state), dry-run making no changes, and no empty commits. `notify-send` is replaced via `PATH` with a recorder.
- **Seam 3 — `/media/*` Function.** Call the Function's request handler with a fake R2 binding and a manifest. Check status codes, full and Range responses (206, Content-Range, correct byte slice), Content-Type, cache headers, and 404s for unknown paths.
- **Seam 4 — PWA (Playwright).** Run against a local preview of the built fixture site. Check:
  - precached notes open offline;
  - an opened PDF is available offline afterwards;
  - pinned folders are cached;
  - a 401 from a stubbed Access response shows the banner while cached content stays readable;
  - redirect responses are never cached.
- **Not automated:** the Actions workflow and the Cloudflare and Access setup. These are checked by hand using the plan's setup checklist and the per-milestone "Done when" criteria.
- **Runners:** `bun test` for seams 1, 3 and 4; `go test` for seam 2.
- **Prior art:** none yet. This is a fresh repo, so these tests set the pattern.

## Out of Scope

- Editing from phone or browser.
- Phone "inbox" capture.
- Drawn PDF highlights on the page.
- An old-version viewer.
- Office editing or a document server.
- Dataview, block references, Canvas.
- A custom domain.
- Nextcloud, Oracle VM, Emacs.
- Multiple users with logins. Visitors see only shared pages.
- Desktop plugin setup (PDF++, Office Reader, HTML Reader, VSCode Editor, CSV Lite, Excalidraw auto-export). That's a manual checklist item, not code.

## Further Notes

- **Cost guard:** everything must stay on free tiers. The 8 GB R2 cap and the $0.01 billing alert are the only protection against R2 charges; never bypass them.
- **Access workaround:** Access on `pages.dev` is a documented workaround, not a first-class feature. The fallback is our own auth in a Pages Function (passkey + signed cookie + Turnstile). Keep the media Function's auth assumptions in one place so that swap stays easy.
- **Sidebar size:** the file tree is embedded in every page. That's fine at today's ~100 files. If the vault grows into thousands of files, move the tree into a shared JSON file loaded once.
- **Lag:** edits can be up to an hour old on GitHub and up to a day old on the site.
- **Vault cleanup:** links in the real vault that point to files that don't exist show up as broken links. That's correct behaviour; fixing them is vault cleanup, not code.
- **One-time setup:** the plan's setup checklist (Cloudflare, Zero Trust, Pages project, Access policy, R2 bucket and token, deploy key, secrets) has to be done by hand before milestone 1 can be deployed.
