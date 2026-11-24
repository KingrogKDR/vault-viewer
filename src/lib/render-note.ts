// Our own markdown pipeline (ADR-0003). GFM, raw HTML, heading ids,
// frontmatter and the Obsidian plugins slot in here in later tickets.

import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkGfm from "remark-gfm";
import remarkRehype from "remark-rehype";
import rehypeRaw from "rehype-raw";
import rehypeSlug from "rehype-slug";
import rehypeStringify from "rehype-stringify";

// Raw HTML in notes is kept on purpose: the content is self-authored and
// behind Access (spec, "Markdown renderer").
const processor = unified()
  .use(remarkParse)
  .use(remarkGfm)
  .use(remarkRehype, { allowDangerousHtml: true })
  .use(rehypeRaw)
  // GitHub-style heading ids ("Fixing a Flat" -> "fixing-a-flat", repeats get -1, -2).
  .use(rehypeSlug)
  .use(rehypeStringify);

/** Render a note's markdown source to an HTML string. */
export async function renderNote(source: string): Promise<string> {
  return String(await processor.process(source));
}
