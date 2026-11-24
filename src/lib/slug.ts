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
