// Rehype plugin: wraps each table in a note in its own scroll region, so a
// wide table scrolls sideways instead of widening the page, while the table
// itself keeps `display: table` (and so its table semantics). The region is
// focusable so keyboard users can scroll it, and named so screen readers
// announce what it holds: the table's caption when it has one, else "Table".

import type { Element, Root } from "hast";
import { toString } from "hast-util-to-string";
import { visit } from "unist-util-visit";

export function rehypeScrollTables() {
  return (tree: Root) => {
    visit(tree, "element", (node, index, parent) => {
      if (node.tagName !== "table" || !parent || index === undefined) return;
      if (parent.type === "element" && parent.properties.className?.toString() === "table-scroll") return;
      const caption = node.children.find((c): c is Element => c.type === "element" && c.tagName === "caption");
      const name = (caption && toString(caption).trim()) || "Table";
      const wrapper: Element = {
        type: "element",
        tagName: "div",
        properties: { className: ["table-scroll"], role: "region", tabIndex: 0, ariaLabel: name },
        children: [node],
      };
      parent.children[index] = wrapper;
    });
  };
}
