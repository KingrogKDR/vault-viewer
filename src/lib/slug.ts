// The one place vault paths become slugs. Full rules (NFC, per-segment
// collapsing, keeping extensions for attachments, collision checks) land in #4.

/** Slug for a vault path: lowercased, unsafe characters collapsed to `-`, `.md` dropped for notes. */
export function slugFor(vaultPath: string): string {
  return vaultPath
    .replace(/\.md$/i, "")
    .split("/")
    .map((segment) =>
      segment
        .toLowerCase()
        .replace(/[^a-z0-9._-]+/g, "-")
        .replace(/^-+|-+$/g, ""),
    )
    .join("/");
}
