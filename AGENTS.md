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

<!-- Add layout and commands here as each milestone lands. Keep this file a map: what lives where, and how to run it. -->

## Agent skills

### Issue tracker

GitHub Issues on `KingrogKDR/vault-viewer` via the `gh` CLI. The repo is public, so issues must never contain vault content. See `docs/agents/issue-tracker.md`.

### Triage labels

Default five-role vocabulary (`needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`), already created on the repo. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context: root `CONTEXT.md` + `docs/adr/`. See `docs/agents/domain.md`.
