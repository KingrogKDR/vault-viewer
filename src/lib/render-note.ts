// Our own markdown pipeline (ADR-0003). GFM, raw HTML, heading ids,
// frontmatter and the Obsidian plugins slot in here in later tickets.

import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkRehype from "remark-rehype";
import rehypeStringify from "rehype-stringify";

const processor = unified().use(remarkParse).use(remarkRehype).use(rehypeStringify);

/** Render a note's markdown source to an HTML string. */
export async function renderNote(source: string): Promise<string> {
  return String(await processor.process(source));
}
