# vault-viewer

A read-only, offline-capable website for one person's Obsidian vault. It is built statically with Astro, hosted on Cloudflare Pages behind Cloudflare Access, and fed by `vaultsync`, a Go CLI that pushes the vault to a private GitHub repo every hour.

## Read before working

1. `CONTEXT.md`: the glossary. Use its terms in code, tests, issues and commits (e.g. **vault file**, **note**, **attachment**, **large file**, **deploy**).
2. `docs/specs/vault-viewer.md`: the full spec. Its user stories, decisions, test seams and 7 milestones are what we build against.
3. `docs/adr/`: decisions that are hard to reverse. If a change contradicts one, say so explicitly instead of quietly working around it.

## Hard rules

- **This repo is public; the vault is private.** Never commit, log, or put in issues or fixtures anything from the real vault: content, note titles, folder names. Test fixtures are made-up vaults. (ADR-0001)
- **$0 is a constraint, not a goal.** Never weaken the R2 storage cap, the no-delete rule in `vaultsync`, or the Access/noindex protections. (ADR-0002, ADR-0005)
- **Test at the four seams only:** the site build against a fixture vault, the `vaultsync` binary, the `/media/*` Function handler, and a Playwright run against the built site. Test what can be observed from outside, never internal helpers. See the spec's Testing Decisions.

## Toolchain

Bun for JS/TS (there is no npm on the dev machine) and Go for `vaultsync`. Local builds read the vault from `VAULT_DIR`.

<!-- Keep this file a map: what lives where, and how to run it. Update it as each milestone lands. -->

### Commands

- `bun install`: install dependencies.
- `VAULT_DIR=/path/to/vault bun run dev`: local preview with reload.
- `VAULT_DIR=/path/to/vault bun run build`: build the site into `dist/`. Without a usable `VAULT_DIR` the build fails and says why.
- `bun test`: the seam-1 build tests. They need no vault: each test builds its own fixture vault.

### Layout

- `src/lib/vault.ts`: the vault reader. Reads `VAULT_DIR` and lists every vault file with its slug, size and `kind` (`note`, `image`, `other`; `kindFor` is the one place kinds are assigned, by extension, so new viewers add kinds there). `VaultFile` is `Note | Attachment`: notes also carry `frontmatter` and `openingHeading`; attachments' contents are never read while listing. The list comes from `git ls-files` when the vault is a git repo, else a folder walk (ADR-0004). It fails closed: a vault with a `.git` entry never falls back to the walk, and any git failure other than "not a git repository" fails the build naming the path and git's error. Pages and layouts call `loadVault()`, which a production build reads once and shares (dev reads afresh each call); don't call `readVault` per page.
- `src/lib/frontmatter.ts`: `parseFrontmatter`; the vault reader puts the result on each note as `frontmatter` (`{}` when missing or malformed).
- `src/lib/note-title.ts`: `noteTitle`, the one place a note's displayed title is chosen (frontmatter `title`, else the opening `# Heading`, else file name without `.md`). The page shows it as the one h1.
- `src/lib/opening-heading.ts`: what counts as a note's opening heading (an h1 as the first block after frontmatter): its text for the vault reader, and `remarkTitleHeading`, which makes the rendered body open with exactly one h1 showing the title (the opening heading itself when its text is the title, else a replacement), so rehype-slug ids it like any heading. `renderNote(source, { title })` takes the title from `noteTitle`.
- `src/lib/slug.ts`: `slugFor`, the only place a vault path becomes a slug (attachments keep their extension); `viewerUrlFor(slug)`, a viewer page's href; `rawUrlFor(vaultPath)`, a raw file's href (`/raw/<slug>`, `/raw/<slug>.md` for notes); and `rawPathFor(vaultPath)`, the same path decoded, for the output file. Slugs keep non-ASCII letters raw (output dirs too), so build every href with `viewerUrlFor`/`rawUrlFor`, never by hand.
- `src/lib/render-note.ts`: our unified pipeline that renders a note to HTML (ADR-0003). New syntax lands here as remark/rehype plugins.
- `src/lib/file-tree.ts`: `buildFileTree(files)`, the file tree's data. Arranges any vault files (`{ path, slug }`) into nested folders, folders first, names in natural case-insensitive order.
- `src/components/FileTree.astro`: renders file tree entries as nested `ul` > `li` > `details`/`a`. Opens the current vault file's ancestor folders and marks its entry `aria-current="page"`.
- `src/layouts/Base.astro`: the shared page layout every page uses: `<Base title="..." current="Vault/path.md">`, with the page's own `<main>` in the default slot and extra `<head>` tags in the `head` slot. Holds the header, the `nav.file-tree` sidebar, its no-JavaScript narrow-screen toggle (checkbox `#file-tree-toggle` + label), and the global CSS. Theme: every colour is a `:root` variable, redefined in full under `@media (prefers-color-scheme: dark)`, with `color-scheme: light dark`; write no colour literals outside those two `:root` blocks (a build test checks this).
- `src/pages/index.astro`: the home page at `/`, inside `Base` with no `current`. Shows note and vault file counts for the whole vault (notes counted by `kind === "note"`, so attachments count only as files), then the top-level folders (plain labels, no folder pages yet) and top-level vault files, taken from `buildFileTree` so names and order match the sidebar.
- `src/pages/[...slug].astro`: one viewer page per vault file, at `/<slug>/`, inside `Base`: a rendered note, or `AttachmentViewer` (title = file name with extension).
- `src/components/AttachmentViewer.astro`: an attachment's viewer: vault path, human-readable size, a `download` link to its raw file, and the image inline for `image` kind. Its styles live in the component and use only Base's colour variables.
- `src/pages/raw/[...path].ts`: every vault file's raw file, its exact bytes, at `rawUrlFor(path)`. Reads each whole file into memory (large files move to object storage in M5).
- `astro.config.mjs`: static output, trailing-slash directory URLs. Astro handles routing and layout only. A dev-only integration appends `/` to `/raw/…` requests, because dev applies `trailingSlash` to the extensionless raw route; the build is unaffected.
- `test/harness/site-build.ts`: the seam-1 harness. `buildFixtureVault({ "Path/Note.md": "..." })` writes a made-up vault to a temp dir, commits it to git, runs the real build into its own temp out dir, and returns `{ ok, output, outDir, hasPage(url), page(url), file(path), bytes(path), htmlPages() }`; `page` returns a DOM document to query with selectors, `file` reads any output file as text (e.g. `_headers`), `bytes` reads one's exact bytes as a `Uint8Array` (paths decoded, e.g. `raw/café.png`), and `htmlPages` lists every `.html` file written, as `/`-separated paths relative to the output dir. `createFixtureVault` + `buildSite({ vaultDir })` split those steps (`vaultDir: null` leaves `VAULT_DIR` unset). `buildFixtureVault` and `createFixtureVault` take an optional second argument `{ untracked, deleted, git }`: `untracked` files are written after the commit, `deleted` paths are removed after it (git still tracks them), and `git: false` makes a plain folder with no repo. Put a `.gitignore` in the files to ignore paths. Call `cleanupTempDirs` in `afterAll`.
- `test/build/`: build tests, one file per feature area.

## Agent skills

### Issue tracker

GitHub Issues on `KingrogKDR/vault-viewer` via the `gh` CLI. The repo is public, so issues must never contain vault content. See `docs/agents/issue-tracker.md`.

### Triage labels

Default five-role vocabulary (`needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`), already created on the repo. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context: root `CONTEXT.md` + `docs/adr/`. See `docs/agents/domain.md`.
