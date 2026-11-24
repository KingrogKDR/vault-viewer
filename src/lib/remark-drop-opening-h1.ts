// The viewer page shows the note's title (see note-title.ts) as its one h1,
// so a level-1 heading that opens the note, after any frontmatter, is dropped
// instead of showing as a second, competing h1. Later h1s are left alone.

import type { Root } from "mdast";

export default function remarkDropOpeningH1() {
  return (tree: Root) => {
    const first = tree.children.findIndex((node) => node.type !== "yaml");
    const node = tree.children[first];
    if (node?.type === "heading" && node.depth === 1) tree.children.splice(first, 1);
  };
}
