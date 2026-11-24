// Rehype plugin: points a note's links and images at the vault files they
// resolve to (see link-resolver.ts). Runs after rehype-raw, so links and
// images written as raw HTML resolve too.

import type { Element, Root } from "hast";
import { visit } from "unist-util-visit";
import { resolveLink } from "./link-resolver";
import { rawUrlFor, viewerUrlFor } from "./slug";
import type { Vault, VaultFile } from "./vault";

export interface ResolveLinksOptions {
  vault: Vault;
  /** Vault path of the note being rendered. */
  fromPath: string;
}

interface Target {
  attribute: "href" | "src";
  urlFor: (file: VaultFile) => string;
}

// A link opens the vault file's viewer page; an image or media source shows its bytes.
const LINK: Target = { attribute: "href", urlFor: (file) => viewerUrlFor(file.slug) };
const EMBED: Target = { attribute: "src", urlFor: (file) => rawUrlFor(file.path) };

/** Elements whose target is a vault file, by tag name. */
const TARGETS: Record<string, Target> = { a: LINK, img: EMBED, video: EMBED, audio: EMBED, source: EMBED };

/**
 * Whether a target names a vault file. Anything with a scheme (`https:`,
 * `mailto:`, ...), a `//host` URL, or a pure `#anchor` within the page is left
 * as written, and never counts as broken.
 */
function pointsIntoVault(target: string): boolean {
  return target !== "" && !/^[a-z][a-z\d+.-]*:/i.test(target) && !target.startsWith("//") && !target.startsWith("#");
}

/**
 * A target with its percent-escapes decoded (`Trip%20Plan.md` -> `Trip Plan.md`;
 * markdown also escapes non-ASCII and spaces in `<...>` targets this way).
 * A target that isn't valid percent-encoding, like `100%.md`, is used as written.
 */
function decoded(target: string): string {
  try {
    return decodeURIComponent(target);
  } catch {
    return target;
  }
}

export function rehypeResolveLinks({ vault, fromPath }: ResolveLinksOptions) {
  return (tree: Root) => {
    visit(tree, "element", (node: Element) => {
      const target = TARGETS[node.tagName];
      if (!target) return;
      const value = node.properties[target.attribute];
      if (typeof value !== "string" || !pointsIntoVault(value)) return;
      // The fragment is split off to resolve, then put back as written.
      const hash = value.indexOf("#");
      const [path, fragment] = hash === -1 ? [value, ""] : [value.slice(0, hash), value.slice(hash)];
      const file = resolveLink(vault, fromPath, decoded(path));
      if (file) {
        node.properties[target.attribute] = target.urlFor(file) + fragment;
      } else {
        // Kept and shown as broken, never dropped, but without its target:
        // it would only 404, and it may name an unpublished note.
        delete node.properties[target.attribute];
        const classes = node.properties.className;
        node.properties.className = [...(Array.isArray(classes) ? classes : []), "broken-link"];
      }
    });
  };
}
