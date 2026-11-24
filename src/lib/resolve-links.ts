// Rehype plugin: points a note's links and images at the vault files they
// resolve to (see link-resolver.ts). Runs after rehype-raw, so links written
// as raw HTML resolve too.

import type { Element, Root } from "hast";
import { visit } from "unist-util-visit";
import { resolveLink } from "./link-resolver";
import { viewerUrlFor } from "./slug";
import type { Vault } from "./vault";

export interface ResolveLinksOptions {
  vault: Vault;
  /** Vault path of the note being rendered. */
  fromPath: string;
}

export function rehypeResolveLinks({ vault, fromPath }: ResolveLinksOptions) {
  return (tree: Root) => {
    visit(tree, "element", (node: Element) => {
      if (node.tagName !== "a") return;
      const href = node.properties.href;
      if (typeof href !== "string") return;
      const file = resolveLink(vault, fromPath, href);
      if (file) node.properties.href = viewerUrlFor(file.slug);
    });
  };
}
