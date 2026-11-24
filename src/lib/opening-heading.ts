// A note's opening heading: a level-1 heading that is the first block of the
// note, after any frontmatter. The vault reader reads its text (a candidate
// title, see note-title.ts). The renderer makes the note's title the body's one
// opening h1: the opening heading itself when its text is the title, otherwise
// a plain h1 of the title in its place. Later h1s are left alone.

import type { Heading, Root } from "mdast";
import { toString } from "mdast-util-to-string";
import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkFrontmatter from "remark-frontmatter";

const parser = unified().use(remarkParse).use(remarkFrontmatter);

/** Index of the first block after frontmatter, and whether it is an opening heading. */
function openingBlock(tree: Root): { index: number; isHeading: boolean } {
  let index = tree.children.findIndex((node) => node.type !== "yaml");
  if (index === -1) index = tree.children.length;
  const node = tree.children[index];
  return { index, isHeading: node?.type === "heading" && node.depth === 1 };
}

/** Plain text of the note's opening `# Heading`, or undefined if it doesn't open with one (or it is empty). */
export function openingHeadingText(source: string): string | undefined {
  const tree = parser.parse(source);
  const { index, isHeading } = openingBlock(tree);
  const text = isHeading ? toString(tree.children[index]).trim() : "";
  return text === "" ? undefined : text;
}

/** Remark plugin: open the note's body with exactly one h1 showing `title`. */
export function remarkTitleHeading({ title }: { title: string }) {
  return (tree: Root) => {
    const { index, isHeading } = openingBlock(tree);
    if (isHeading && toString(tree.children[index]).trim() === title) return;
    const heading: Heading = { type: "heading", depth: 1, children: [{ type: "text", value: title }] };
    tree.children.splice(index, isHeading ? 1 : 0, heading);
  };
}
