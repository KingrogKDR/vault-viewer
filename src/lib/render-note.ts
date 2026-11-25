// Our own markdown pipeline (ADR-0003): GFM, frontmatter (kept out of the
// page), raw HTML, links, wikilinks and embeds, and heading ids.

import { readFile } from "node:fs/promises";
import type { Root } from "hast";
import { toHtml } from "hast-util-to-html";
import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkFrontmatter from "remark-frontmatter";
import remarkGfm from "remark-gfm";
import remarkRehype from "remark-rehype";
import rehypeRaw from "rehype-raw";
import rehypeSlug from "rehype-slug";
import { remarkTitleHeading } from "./opening-heading";
import { rehypeResolveLinks } from "./resolve-links";
import { rehypeScrollTables } from "./scroll-tables";
import { WIKILINK_NODE_TYPES, rehypeWikilinks, remarkWikilinks } from "./wikilinks";
import type { Note, Vault } from "./vault";

/**
 * Render a note's markdown source to an HTML string. The body opens with one
 * h1 showing `title` (see opening-heading.ts), so it gets an id like any heading.
 * Its links, images, wikilinks and embeds are resolved against `vault`, from
 * `note`'s folder.
 */
export async function renderNote(vault: Vault, note: Note, source: string, { title }: { title: string }): Promise<string> {
  return toHtml(await noteTree(vault, note, source, { title, chain: [note.path] }));
}

/**
 * A note's rendered body as a hast tree. A page's own note gets its title
 * heading and heading ids; an embedded note (`title` undefined) gets neither,
 * as the page it lands in ids every heading once, embedded ones included.
 */
async function noteTree(vault: Vault, note: Note, source: string, { title, chain }: { title?: string; chain: string[] }): Promise<Root> {
  const renderEmbed = async (embedded: Note, embedChain: string[]) =>
    noteTree(vault, embedded, await readFile(embedded.absolutePath, "utf8"), { chain: embedChain });
  // Raw HTML in notes is kept on purpose: the content is self-authored and
  // behind Access (spec, "Markdown renderer").
  const processor = unified()
    .use(remarkParse)
    .use(remarkFrontmatter)
    .use(title === undefined ? [] : [[remarkTitleHeading, { title }]])
    .use(remarkGfm)
    .use(remarkWikilinks)
    .use(remarkRehype, { allowDangerousHtml: true, passThrough: [...WIKILINK_NODE_TYPES] })
    .use(rehypeRaw, { passThrough: [...WIKILINK_NODE_TYPES] })
    .use(rehypeResolveLinks, { vault, fromPath: note.path })
    .use(rehypeWikilinks, { vault, note, chain, renderEmbed })
    // GitHub-style heading ids ("Fixing a Flat" -> "fixing-a-flat", repeats get -1, -2).
    .use(title === undefined ? [] : [rehypeSlug, rehypeScrollTables]);
  return (await processor.run(processor.parse(source))) as Root;
}
