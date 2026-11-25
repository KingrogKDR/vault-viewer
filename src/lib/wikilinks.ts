// Obsidian wikilinks (`[[target#heading|alias]]`) and embeds (`![[target]]`),
// in two halves (spec, "Markdown renderer"):
//
// - `remarkWikilinks` parses them into `wikiLink` nodes. It is a micromark
//   syntax extension, so code spans and blocks keep them literal, `\[[` stays
//   text, and an unclosed `[[` is plain text. remark-rehype and rehype-raw pass
//   the nodes through untouched.
// - `rehypeWikilinks` turns each node into HTML, resolving its target with the
//   one link resolver (link-resolver.ts). It runs after rehypeResolveLinks, so
//   the URLs it writes are never resolved a second time.

import type { Element, ElementContent, Root, RootContent } from "hast";
import type { Extension as FromMarkdownExtension } from "mdast-util-from-markdown";
import type { Code, Construct, Extension as SyntaxExtension, State, TokenizeContext, Effects } from "micromark-util-types";
import { slug } from "github-slugger";
import { toString } from "hast-util-to-string";
import type { Processor } from "unified";
import { resolveLink } from "./link-resolver";
import { noteTitle } from "./note-title";
import type { LinkUrls } from "./resolve-links";
import type { Note, Vault, VaultFile } from "./vault";

/** A parsed wikilink or embed, as written. */
export interface WikiLink {
  type: "wikiLink";
  /** Written with a leading `!`. */
  embed: boolean;
  /** The target before any `#`, trimmed; `""` for a link within the same note (`[[#Heading]]`). */
  target: string;
  /** What follows the first `#`, split on further `#`s (`[[note#A#B]]` -> ["A", "B"]); empty when there is none. */
  fragment: string[];
  /** The text after the first `|`, if any. */
  alias?: string;
}

declare module "mdast" {
  interface PhrasingContentMap {
    wikiLink: WikiLink;
  }
  interface RootContentMap {
    wikiLink: WikiLink;
  }
}
declare module "hast" {
  interface ElementContentMap {
    wikiLink: WikiLink;
  }
  interface RootContentMap {
    wikiLink: WikiLink;
  }
}
declare module "micromark-util-types" {
  interface TokenTypeMap {
    wikiLink: "wikiLink";
  }
}

const BANG = 33;
const LEFT_BRACKET = 91;
const RIGHT_BRACKET = 93;

/** micromark: `[[...]]` or `![[...]]` on one line, with something inside and no `[` or `]` but the closing pair. */
const wikiLinkConstruct: Construct = {
  name: "wikiLink",
  tokenize(this: TokenizeContext, effects: Effects, ok: State, nok: State): State {
    let size = 0;
    const open =
      (next: State): State =>
      (code: Code) => {
        if (code !== LEFT_BRACKET) return nok(code);
        effects.consume(code);
        return next;
      };
    const close: State = (code) => {
      if (code !== RIGHT_BRACKET) return nok(code);
      effects.consume(code);
      effects.exit("wikiLink");
      return ok;
    };
    const inside: State = (code) => {
      // EOF and line endings (codes below -2) end the attempt: it stays text.
      // So does another `[`: in `[[a [[b]]` only `[[b]]` is a wikilink.
      if (code === null || code < -2 || code === LEFT_BRACKET) return nok(code);
      if (code === RIGHT_BRACKET) {
        if (size === 0) return nok(code);
        effects.consume(code);
        return close;
      }
      size++;
      effects.consume(code);
      return inside;
    };
    return (code) => {
      effects.enter("wikiLink");
      if (code === BANG) {
        effects.consume(code);
        return open(open(inside));
      }
      return open(open(inside))(code);
    };
  },
};

const syntax: SyntaxExtension = { text: { [BANG]: wikiLinkConstruct, [LEFT_BRACKET]: wikiLinkConstruct } };

/** Split a wikilink's source (`![[...]]`) into its parts. `\|` (needed inside tables) counts as `|`. */
function parseWikiLink(source: string): WikiLink {
  const embed = source.startsWith("!");
  const inner = source.slice(embed ? 3 : 2, -2).replaceAll("\\|", "|");
  const bar = inner.indexOf("|");
  const [link, alias] = bar === -1 ? [inner, undefined] : [inner.slice(0, bar), inner.slice(bar + 1).trim()];
  const [target, ...fragment] = link.split("#");
  return {
    type: "wikiLink",
    embed,
    target: target!.trim(),
    fragment: fragment.map((part) => part.trim()).filter((part) => part !== ""),
    ...(alias ? { alias } : {}),
  };
}

const fromMarkdown: FromMarkdownExtension = {
  enter: {
    wikiLink(token) {
      this.enter(parseWikiLink(this.sliceSerialize(token)) as never, token);
    },
  },
  exit: {
    wikiLink(token) {
      this.exit(token);
    },
  },
};

/** Remark plugin: parse wikilinks and embeds into `wikiLink` nodes. */
export function remarkWikilinks(this: Processor) {
  const data = this.data();
  (data.micromarkExtensions ??= []).push(syntax);
  (data.fromMarkdownExtensions ??= []).push(fromMarkdown);
}

/** Node types that remark-rehype and rehype-raw must pass through for rehypeWikilinks. */
export const WIKILINK_NODE_TYPES = ["wikiLink"] as const;

export interface WikilinksOptions {
  vault: Vault;
  /** The note being rendered. */
  note: Note;
  /**
   * Vault paths of the notes being embedded into one another, outermost
   * first, ending with `note`. Its length is the embed depth.
   */
  chain: string[];
  /** Render `note`'s content as an embed, with `chain` as its own chain. */
  renderEmbed: (note: Note, chain: string[]) => Promise<Root>;
  /** Where links and media point; a target it gives no URL for is a broken link. */
  urls: LinkUrls;
}

/** How many notes deep embeds may nest (the page's own note is depth 1). */
const MAX_EMBED_DEPTH = 4;

function fileName(path: string): string {
  return path.slice(path.lastIndexOf("/") + 1);
}

function text(value: string): ElementContent {
  return { type: "text", value };
}

function element(tagName: string, properties: Element["properties"], children: ElementContent[] = []): Element {
  return { type: "element", tagName, properties, children };
}

/** The text Obsidian shows for an unaliased wikilink: the target without `.md`, then `> heading` for each heading. */
function defaultText(link: WikiLink): string {
  const target = link.target.replace(/\.md$/i, "");
  return [...(target ? [target] : []), ...link.fragment].join(" > ");
}

/**
 * The `#id` a fragment points to: the id rehype-slug gives a heading with the
 * last heading's text. Block references (`^id`) have no anchor on the site,
 * so they lead to the note itself.
 */
function anchorFor(fragment: string[]): string {
  const last = fragment.at(-1);
  if (last === undefined || last.startsWith("^")) return "";
  return `#${slug(last)}`;
}

/**
 * A broken link: its alias stays, but never its target, which may name an
 * unpublished note. An unaliased one shows a fixed label instead.
 */
function broken(link: WikiLink): Element {
  const label = link.embed ? (imageSize(link.alias) ? undefined : link.alias) ?? "broken embed" : (link.alias ?? "broken link");
  return element("a", { className: ["broken-link"] }, [text(label)]);
}

/** A plain link to `file` (its viewer page, or wherever `urls` points), or a broken link when `urls` gives none. */
function linkTo(file: VaultFile, link: WikiLink, urls: LinkUrls): Element {
  const href = urls.link(file);
  if (href === undefined) return broken(link);
  return element("a", { href: href + anchorFor(link.fragment) }, [text(link.alias ?? defaultText(link))]);
}

/** `|300` or `|300x200` on an image embed: its display size. */
function imageSize(alias: string | undefined): { width?: string; height?: string } | undefined {
  const match = alias?.match(/^(\d+)(?:x(\d+))?$/);
  if (!match) return undefined;
  return { width: match[1], ...(match[2] ? { height: match[2] } : {}) };
}

/**
 * The part of an embedded note under the heading `fragment` names: that
 * heading and everything after it up to the next heading of the same or a
 * higher level. Undefined if the note has no such heading.
 */
function section(tree: Root, fragment: string[]): RootContent[] | undefined {
  const wanted = slug(fragment.at(-1)!);
  const rank = (node: RootContent) => (node.type === "element" ? /^h([1-6])$/.exec(node.tagName)?.[1] : undefined);
  const start = tree.children.findIndex((node) => rank(node) && slug(toString(node as Element)) === wanted);
  if (start === -1) return undefined;
  const level = Number(rank(tree.children[start]!));
  let end = tree.children.findIndex((node, i) => i > start && rank(node) && Number(rank(node)) <= level);
  if (end === -1) end = tree.children.length;
  return tree.children.slice(start, end);
}

/** A note embed: the note's rendered content (or one section of it) in a `div.embed`. */
async function embedNote(target: Note, link: WikiLink, options: WikilinksOptions): Promise<Element> {
  if (options.chain.includes(target.path) || options.chain.length >= MAX_EMBED_DEPTH) {
    // A visible stop instead of the content, so embeds can never loop. It
    // names the note only where the page may link to it.
    const href = options.urls.link(target);
    const stop = "Embed not shown, it nests too deep";
    return element("div", { className: ["embed", "embed-stopped"] }, [
      element("p", {}, href === undefined ? [text(`${stop}.`)] : [text(`${stop}: `), element("a", { href }, [text(noteTitle(target))])]),
    ]);
  }
  const tree = await options.renderEmbed(target, [...options.chain, target.path]);
  const wanted = link.fragment.length > 0 && !link.fragment.at(-1)!.startsWith("^") ? section(tree, link.fragment) : tree.children;
  if (!wanted) return linkTo(target, { ...link, fragment: [] }, options.urls);
  return element("div", { className: ["embed"] }, wanted as ElementContent[]);
}

/** The HTML for one wikilink or embed. */
async function replacementFor(link: WikiLink, options: WikilinksOptions): Promise<Element> {
  const { vault, note, urls } = options;
  if (link.target === "" && !link.embed) {
    // [[#Heading]]: within the note. Inside an embed, the anchor belongs to the embedded note's own page.
    const anchor = anchorFor(link.fragment);
    if (options.chain.length === 1 && anchor) return element("a", { href: anchor }, [text(link.alias ?? defaultText(link))]);
    return linkTo(note, link, urls);
  }
  const file = link.target === "" ? note : resolveLink(vault, note.path, link.target);
  if (!file) return broken(link);
  if (!link.embed) return linkTo(file, link, urls);

  if (file.kind === "note") return embedNote(file, link, options);
  if (file.kind === "other") {
    // Other kinds (pdf, ...) get their inline viewers later; for now, a link.
    return linkTo(file, link, urls);
  }
  const src = urls.media(file);
  if (src === undefined) return broken(link);
  if (file.kind === "image") {
    const size = imageSize(link.alias);
    return element("img", { src, alt: size || !link.alias ? fileName(file.path) : link.alias, ...size });
  }
  return element(file.kind, { src, controls: true });
}

/** Whether a replacement is block content, which can't sit inside a paragraph. */
function isBlock(node: ElementContent): boolean {
  return node.type === "element" && node.tagName === "div";
}

/**
 * Rehype plugin: replace each `wikiLink` node with its link, image, media
 * element or embedded note. A note embed is lifted out of its paragraph,
 * splitting the paragraph around it.
 */
export function rehypeWikilinks(options: WikilinksOptions) {
  return async (tree: Root) => {
    await replaceIn(tree, options);
  };
}

async function replaceIn(parent: Root | Element, options: WikilinksOptions): Promise<void> {
  const children: (RootContent | ElementContent)[] = [];
  for (const child of parent.children) {
    if (child.type === "wikiLink") {
      children.push(await replacementFor(child, options));
    } else if (child.type === "element") {
      await replaceIn(child, options);
      children.push(...(child.tagName === "p" ? splitParagraph(child) : [child]));
    } else {
      children.push(child);
    }
  }
  parent.children = children as typeof parent.children;
}

/** A paragraph with block children becomes paragraphs of its inline runs, with the blocks between them. */
function splitParagraph(paragraph: Element): Element[] {
  if (!paragraph.children.some(isBlock)) return [paragraph];
  const out: Element[] = [];
  let run: ElementContent[] = [];
  const flush = () => {
    if (run.some((node) => node.type !== "text" || node.value.trim() !== "")) out.push({ ...paragraph, children: run });
    run = [];
  };
  for (const node of paragraph.children) {
    if (isBlock(node)) {
      flush();
      out.push(node as Element);
    } else {
      run.push(node);
    }
  }
  flush();
  return out;
}
