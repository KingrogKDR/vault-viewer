// A note's opening heading: a level-1 heading that is the first block of the
// note, after any frontmatter. The vault reader reads its text (a candidate
// title, see note-title.ts); the renderer drops it, because the viewer page
// already shows the note's title as its one h1. Later h1s are left alone.

import type { Root } from "mdast";
import { toString } from "mdast-util-to-string";
import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkFrontmatter from "remark-frontmatter";

const parser = unified().use(remarkParse).use(remarkFrontmatter);

function openingHeadingIndex(tree: Root): number {
  const first = tree.children.findIndex((node) => node.type !== "yaml");
  const node = tree.children[first];
  return node?.type === "heading" && node.depth === 1 ? first : -1;
}

/** Plain text of the note's opening `# Heading`, or undefined if it doesn't open with one (or it is empty). */
export function openingHeadingText(source: string): string | undefined {
  const tree = parser.parse(source);
  const index = openingHeadingIndex(tree);
  const text = index === -1 ? "" : toString(tree.children[index]).trim();
  return text === "" ? undefined : text;
}

/** Remark plugin: remove the note's opening heading from the rendered body. */
export function remarkDropOpeningHeading() {
  return (tree: Root) => {
    const index = openingHeadingIndex(tree);
    if (index !== -1) tree.children.splice(index, 1);
  };
}
