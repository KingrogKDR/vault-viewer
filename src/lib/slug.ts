// The one place vault paths become slugs.

/**
 * Slug for a vault path. Each segment is NFC-normalised and lowercased, every
 * run of characters other than Unicode letters (with their combining marks),
 * digits, `.`, `_` and `-` is collapsed to one `-`, and leading and trailing
 * `-` are trimmed. Notes drop `.md`; other vault files keep their extension.
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
        .replace(/^-+|-+$/g, ""),
    )
    .join("/");
}
