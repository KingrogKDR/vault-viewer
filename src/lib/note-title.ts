import type { VaultFile } from "./vault";

/** A note's title: its frontmatter `title` when set, otherwise its file name without `.md`. */
export function noteTitle(file: VaultFile): string {
  const title = file.frontmatter.title;
  if ((typeof title === "string" || typeof title === "number") && String(title).trim() !== "") {
    return String(title).trim();
  }
  const name = file.path.slice(file.path.lastIndexOf("/") + 1);
  return name.replace(/\.md$/i, "");
}
