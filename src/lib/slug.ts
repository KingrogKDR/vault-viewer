// The one place vault paths become slugs.

/**
 * Slug for a vault path. Each segment is NFC-normalised and lowercased, every
 * run of characters other than Unicode letters (with their combining marks),
 * digits, `.`, `_` and `-` is collapsed to one `-`, then every run of `-` is
 * collapsed to one, and leading and trailing `-` are trimmed. Notes drop
 * `.md`; other vault files keep their extension.
 */
export function slugFor(vaultPath: string): string {
  return vaultPath
    .normalize("NFC")
    .replace(/\.md$/i, "")
    .split("/")
    .map((segment) =>
      segment
        .toLowerCase()
        .replace(/[^\p{L}\p{M}\p{N}._-]+/gu, "-")
        .replace(/-{2,}/g, "-")
        .replace(/^-+|-+$/g, ""),
    )
    .join("/");
}

/**
 * Site URL of a slug's viewer page, `/<slug>/`, for use in links. Slugs keep
 * non-ASCII letters raw, so each segment is percent-encoded here.
 */
export function viewerUrlFor(slug: string): string {
  return `/${slug.split("/").map(encodeURIComponent).join("/")}/`;
}

/**
 * Site URL of a vault file's raw file, for download and embedding:
 * `/raw/<slug>`, plus `.md` for notes (whose slug drops it). Percent-encoded
 * per segment, like `viewerUrlFor`.
 */
export function rawUrlFor(vaultPath: string): string {
  return `/raw/${rawPathFor(vaultPath).split("/").map(encodeURIComponent).join("/")}`;
}

/**
 * Site URL of a shared page, `/s/<token>/` (ADR-0006). `token` comes from
 * `shareTokenFor` (share.ts) and is already URL-safe. Everything a shared
 * page uses lives under this URL, outside Access.
 */
export function sharedPageUrlFor(token: string): string {
  return `/s/${token}/`;
}

/** Site URL of a file a shared page shows (an image, audio, video), copied under the page's own URL. */
export function sharedFileUrlFor(token: string, name: string): string {
  return `${sharedPageUrlFor(token)}${encodeURIComponent(name)}`;
}

/** Where a vault file's raw file is written under `/raw/`, decoded: its slug, plus `.md` for notes. */
export function rawPathFor(vaultPath: string): string {
  return /\.md$/i.test(vaultPath) ? `${slugFor(vaultPath)}.md` : slugFor(vaultPath);
}
