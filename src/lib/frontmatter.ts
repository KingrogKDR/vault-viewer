// A note's YAML frontmatter: the `---` block at the very top of the file,
// the same block remark-frontmatter keeps out of the rendered page.

import { parse } from "yaml";

export type Frontmatter = Record<string, unknown>;

const BLOCK = /^---[ \t]*\r?\n([\s\S]*?)\r?\n?^---[ \t]*$/m;

/**
 * Parse a note's frontmatter. A note without frontmatter, or whose frontmatter
 * is malformed or isn't a mapping, gets `{}`: it is treated as having none.
 */
export function parseFrontmatter(source: string): Frontmatter {
  const match = BLOCK.exec(source);
  if (!match || match.index !== 0) return {};
  try {
    const data: unknown = parse(match[1]!);
    return data !== null && typeof data === "object" && !Array.isArray(data) ? (data as Frontmatter) : {};
  } catch {
    return {};
  }
}
