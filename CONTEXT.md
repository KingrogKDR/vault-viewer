# Vault Viewer

A private, read-only window onto one person's Obsidian vault. It is readable from any device and works offline. Editing happens only in Obsidian on the desktop; everything here publishes the vault and displays it.

## Language

### The vault

**Vault**:
The folder of notes and files the owner edits in Obsidian. It is the single source of truth for all content.
_Avoid_: notes repo, workspace, knowledge base

**Vault file**:
Any file in the vault that is eligible for publishing: tracked or not ignored by the vault's git, and not under a dot-folder.
_Avoid_: document, asset, entry

**Vault path**:
A vault file's location relative to the vault root, always written with `/`. It identifies the file.
_Avoid_: filename, key, id

**Note**:
A vault file in Obsidian markdown (`.md`).
_Avoid_: page, document, post, article

**Attachment**:
Any vault file that is not a note: images, PDFs, media, Office files, code, and so on.
_Avoid_: asset, media (media is reserved for large files), binary

**Unpublished note**:
A note whose frontmatter says `publish: false`. To the site it does not exist, and links to it count as broken.
_Avoid_: private note, draft, hidden note

**Owner**:
The one person who edits the vault and reads the whole site. There are no other users with logins.
_Avoid_: user, admin, author

**Shared note**:
A note whose frontmatter says `share: true`. The owner chose to let anyone with its link read it.
_Avoid_: public note, published note

**Visitor**:
Anyone other than the owner who opens a shared page. A visitor sees that page and nothing else of the vault.
_Avoid_: guest, reader, user

### Links

**Link**:
A reference from a note to a vault file. It can be a wikilink or a markdown link, and may carry a fragment.
_Avoid_: reference, href

**Wikilink**:
Obsidian's `[[target]]` link syntax, optionally with `|alias` and `#heading`.
_Avoid_: internal link, double-bracket link

**Embed**:
A link written with a leading `!`, which puts the target's content into the note instead of linking to it.
_Avoid_: transclusion, include

**Resolution**:
Finding the vault file a link points to, using Obsidian's rules (relative folder, then vault root, then the shortest matching path).
_Avoid_: lookup, linking

**Broken link**:
A link whose resolution finds no published vault file. It is shown as broken, never dropped silently.
_Avoid_: dead link, missing link

**Backlink**:
A note that links to the note being viewed.
_Avoid_: inbound link, reference

**Tag**:
A `#label` in a note's body or frontmatter, used to group notes.
_Avoid_: category, label

**Callout**:
An Obsidian `> [!type]` block shown as a styled box.
_Avoid_: admonition, alert

**PDF highlight link**:
A wikilink made by PDF++ that points to a page and text selection in a PDF. It is shown as a quote that opens that page.
_Avoid_: annotation, PDF comment

### The site

**Site**:
The static, read-only website built from the vault and served behind Access.
_Avoid_: app, frontend, portal

**Slug**:
The URL form of a vault path: lowercased, unsafe characters collapsed to `-`, and `.md` dropped for notes. Each slug belongs to exactly one vault file.
_Avoid_: permalink, route, URL path

**Viewer page**:
The site page for one vault file: a rendered note, or the viewer for an attachment.
_Avoid_: file page, detail page

**Viewer**:
How a viewer page displays a given kind of vault file (rendered note, image, PDF, video, sandboxed HTML, and so on).
_Avoid_: renderer, preview, player

**Shared page**:
The page a visitor sees for a shared note, at an unguessable link outside Access. It is a separate output from the note's viewer page.
_Avoid_: public page, share link (the link is just the shared page's URL)

**Raw file**:
A vault file's original bytes, served by the site for download or for embedding.
_Avoid_: source file, asset

**Converted PDF**:
The PDF that the build makes from an Office attachment so it can be shown in the PDF viewer.
_Avoid_: rendition, export

**File tree**:
The sidebar that mirrors the vault's folder structure.
_Avoid_: explorer, navigation, sitemap

**Recently changed**:
The list of vault files ordered by their last commit in the vault's history.
_Avoid_: recent, activity feed, changelog

### Large files

**Large file**:
A vault file over 20 MB. Its bytes live in object storage, not in the vault's git history.
_Avoid_: big file, LFS file, media file

**Media manifest**:
The record, kept in the vault, of every large file: its vault path, content hash, size, type and media key.
_Avoid_: index, lockfile, registry

**Media key**:
A large file's storage name in object storage, derived from its content hash.
_Avoid_: object id, R2 path

**Storage cap**:
The 8 GB limit on object storage that sync refuses to exceed, so the free tier is never passed.
_Avoid_: quota, budget

### Publishing

**Sync**:
The hourly desktop run that moves large files to object storage, updates the media manifest, and commits and pushes the vault.
_Avoid_: backup, upload, push

**Sync conflict**:
When pulling the remote vault can't be rebased cleanly. Sync stops and notifies the owner; it never forces.
_Avoid_: merge error

**Build**:
Turning one vault commit into the site's static output.
_Avoid_: compile, render, generate

**Deploy**:
Uploading a build to hosting so it becomes the live site.
_Avoid_: publish, release, ship

**Deployed commit**:
The vault commit the live site was built from. Scheduled builds are skipped when it matches the vault's current head.
_Avoid_: last SHA, version

### Offline

**Precache**:
The vault content the installed site saves ahead of time: every rendered note, the search index, and small images.
_Avoid_: preload, prefetch

**Pinned**:
A vault file or folder the owner explicitly marked to keep offline, whatever its size.
_Avoid_: starred, favourited, downloaded

**Session expiry**:
When the owner's Access login has lapsed. The site keeps serving cached content and asks the owner to log in again.
_Avoid_: logout, auth error

## Relationships

- The **vault** contains **vault files**; each is either a **note** or an **attachment**.
- Each **vault file** has exactly one **slug** and one **viewer page**.
- A **large file** is a **vault file** whose bytes are found through the **media manifest** by **media key**, not through git.
- A **link** goes through **resolution** to one **vault file**, or it is a **broken link**.
- A **shared note** has one **viewer page**, for the **owner**, and one **shared page**, for **visitors**.
- **Sync** produces the vault commits that a **build** consumes; a **deploy** turns a build into the live **site** and records the **deployed commit**.

## Example dialogue

> **Dev:** "When a **note** embeds a video that's a **large file**, does the **build** copy it as a **raw file**?"
> **Domain expert:** "No. The **build** never has its bytes. The **viewer** reads the **media key** from the **media manifest**, and the bytes stream from object storage."

## Flagged ambiguities

- "Media" was used both for any image, video or audio and for files over 20 MB. Resolved: **large file** means over 20 MB; image, video and audio are **viewers**.
- "Public" could mean a shared page or the site repo, which is public on GitHub. Resolved: pages are **shared**; only the repo is called public.
- "Publish" was used both for "eligible for the site" (`publish: false`) and for deploying. Resolved: **unpublished note** keeps the frontmatter meaning; going live is a **deploy**.
