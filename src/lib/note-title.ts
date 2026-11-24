import type { Note } from "./vault";

/**
 * A note's title: its frontmatter `title` when set, otherwise the text of its
 * opening `# Heading`, otherwise its file name without `.md`.
 */
export function noteTitle(file: Note): string {
  const title = file.frontmatter.title;
  if ((typeof title === "string" || typeof title === "number") && String(title).trim() !== "") {
    return String(title).trim();
  }
  if (file.openingHeading) return file.openingHeading;
  const name = file.path.slice(file.path.lastIndexOf("/") + 1);
  return name.replace(/\.md$/i, "");
}
