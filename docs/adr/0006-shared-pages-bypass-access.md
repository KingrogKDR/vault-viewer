# Shared pages bypass Access at unguessable URLs

Amends ADR-0002. The owner can share single notes with anyone by setting `share: true` in a note's frontmatter. The build writes a separate **shared page** for each such note under `/s/<token>/`, and one Cloudflare Access application for the `/s/` path has a Bypass (Everyone) policy, so visitors need no login. Everything else stays behind Access with GitHub login, exactly as ADR-0002 says. Sharing is set in the vault, not by a button, because the site is static and has no backend to change state. The share button on the owner's viewer page only copies or hands off the link.

The token is an HMAC of the note's vault path under a build secret (`SHARE_SECRET`). It is stable across builds, cannot be guessed or derived from the public repo, and needs no state kept anywhere.

## Consequences

- A shared page is a separate output, not the owner's viewer page with Access removed. It has no file tree, no download of the note's markdown, and no links to other vault files except other shared pages. A link to anything else keeps its text and loses its target, like a broken link, so visitors never learn other notes' names.
- What the owner sees in the note body is what a visitor sees. Images and embeds in the note are part of the shared page, and their bytes are copied under the same `/s/<token>/` path. Embedding a note into a shared note shares the embedded content too.
- Taking a page down means removing `share: true`; the next deploy no longer writes it. Moving or renaming a shared note changes its link. Rotating `SHARE_SECRET` revokes every link at once.
- Without `SHARE_SECRET` the build writes no shared pages and shows no share button. It never fails open.
- Shared pages keep `noindex`, `robots.txt` and `Referrer-Policy: no-referrer`, so the token is not leaked to linked sites or indexed. Large files (ADR-0005) are served by the Access-protected media Function, so they don't load on shared pages until that's decided separately.
- "Only the owner can read the site" becomes "only the owner can read the site, apart from the pages the owner shares."

## Considered Options

- **Named people only** (`share: [emails]`, with one Access policy per shared page created by the deploy through the Cloudflare API): more private, but adds an API token with Access rights, deploy-time state, and a login for every reader. Rejected for now. Unguessable links can move to it later without changing the frontmatter flag's meaning for the owner.
- **Removing Access from the owner's viewer page itself:** would expose the file tree and every link target. Rejected.
