// Our own markdown pipeline (ADR-0003): GFM, frontmatter (kept out of the
// page), raw HTML and heading ids. The Obsidian plugins slot in here later.

import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkFrontmatter from "remark-frontmatter";
import remarkGfm from "remark-gfm";
import remarkRehype from "remark-rehype";
import rehypeRaw from "rehype-raw";
import rehypeSlug from "rehype-slug";
import rehypeStringify from "rehype-stringify";
import { remarkDropOpeningHeading } from "./opening-heading";

// Raw HTML in notes is kept on purpose: the content is self-authored and
// behind Access (spec, "Markdown renderer").
const processor = unified()
  .use(remarkParse)
  .use(remarkFrontmatter)
  .use(remarkDropOpeningHeading)
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
