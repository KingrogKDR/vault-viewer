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
import { remarkTitleHeading } from "./opening-heading";
import { rehypeResolveLinks } from "./resolve-links";
import type { Note, Vault } from "./vault";

/**
 * Render a note's markdown source to an HTML string. The body opens with one
 * h1 showing `title` (see opening-heading.ts), so it gets an id like any heading.
 * Its links and images are resolved against `vault`, from `note`'s folder.
 */
export async function renderNote(vault: Vault, note: Note, source: string, { title }: { title: string }): Promise<string> {
  // Raw HTML in notes is kept on purpose: the content is self-authored and
  // behind Access (spec, "Markdown renderer").
  const processor = unified()
    .use(remarkParse)
    .use(remarkFrontmatter)
    .use(remarkTitleHeading, { title })
    .use(remarkGfm)
    .use(remarkRehype, { allowDangerousHtml: true })
    .use(rehypeRaw)
    .use(rehypeResolveLinks, { vault, fromPath: note.path })
    // GitHub-style heading ids ("Fixing a Flat" -> "fixing-a-flat", repeats get -1, -2).
    .use(rehypeSlug)
    .use(rehypeStringify);
  return String(await processor.process(source));
}
