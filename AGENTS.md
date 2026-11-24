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

- `src/lib/vault.ts`: the vault reader. Reads `VAULT_DIR` and lists vault files with their slugs. The list comes from `git ls-files` when the vault is a git repo, else a folder walk (ADR-0004). It fails closed: a vault with a `.git` entry never falls back to the walk, and any git failure other than "not a git repository" fails the build naming the path and git's error.
- `src/lib/slug.ts`: `slugFor`, the only place a vault path becomes a slug.
- `src/lib/render-note.ts`: our unified pipeline that renders a note to HTML (ADR-0003). New syntax lands here as remark/rehype plugins.
- `src/pages/[...slug].astro`: one viewer page per vault file, at `/<slug>/`.
- `astro.config.mjs`: static output, trailing-slash directory URLs. Astro handles routing and layout only.
- `test/harness/site-build.ts`: the seam-1 harness. `buildFixtureVault({ "Path/Note.md": "..." })` writes a made-up vault to a temp dir, commits it to git, runs the real build into its own temp out dir, and returns `{ ok, output, outDir, hasPage(url), page(url) }`; `page` returns a DOM document to query with selectors. `createFixtureVault` + `buildSite({ vaultDir })` split those steps (`vaultDir: null` leaves `VAULT_DIR` unset). `buildFixtureVault` and `createFixtureVault` take an optional second argument `{ untracked, deleted, git }`: `untracked` files are written after the commit, `deleted` paths are removed after it (git still tracks them), and `git: false` makes a plain folder with no repo. Put a `.gitignore` in the files to ignore paths. Call `cleanupTempDirs` in `afterAll`.
- `test/build/`: build tests, one file per feature area.

## Agent skills

### Issue tracker

GitHub Issues on `KingrogKDR/vault-viewer` via the `gh` CLI. The repo is public, so issues must never contain vault content. See `docs/agents/issue-tracker.md`.

### Triage labels

Default five-role vocabulary (`needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`), already created on the repo. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context: root `CONTEXT.md` + `docs/adr/`. See `docs/agents/domain.md`.
