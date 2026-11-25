// Shared pages (ADR-0006): a shared note's page for visitors, at an
// unguessable URL outside Access. Which notes are shared is read by the vault
// reader (`Note.shared`); this module decides whether the build shares at all,
// each shared page's token, and renders the page so it points nowhere but
// other shared pages and its own copied files.

import { createHmac } from "node:crypto";
import { readFile } from "node:fs/promises";
import { noteTitle } from "./note-title";
import { renderNote } from "./render-note";
import type { LinkUrls } from "./resolve-links";
import { sharedFileUrlFor, sharedPageUrlFor } from "./slug";
import type { Attachment, Note, Vault, VaultFile } from "./vault";

/** A shorter `SHARE_SECRET` fails the build: the tokens are only as unguessable as the secret. */
const MIN_SECRET_LENGTH = 32;

/** base64url characters kept from the HMAC: 22 of them carry 132 bits. */
const TOKEN_LENGTH = 22;

/**
 * The build's share secret, from `SHARE_SECRET`, or undefined when it is
 * unset or empty: then sharing is off. Throws when it is too short to keep
 * links unguessable, so a weak secret never ships.
 */
export function shareSecretFromEnv(): string | undefined {
  const secret = process.env.SHARE_SECRET;
  if (!secret) return undefined;
  if (secret.length < MIN_SECRET_LENGTH) {
    throw new Error(
      `SHARE_SECRET is set but only ${secret.length} characters long. Use at least ${MIN_SECRET_LENGTH} random characters ` +
        "(e.g. openssl rand -base64 32), or unset it to turn sharing off.",
    );
  }
  return secret;
}

/**
 * A shared note's token: base64url HMAC-SHA256 of its vault path under the
 * share secret, truncated to 132 bits. Stable across builds, and without the
 * secret neither guessable nor derivable from the public repo.
 */
export function shareTokenFor(secret: string, vaultPath: string): string {
  return createHmac("sha256", secret).update(vaultPath).digest("base64url").slice(0, TOKEN_LENGTH);
}

export interface SharedPage {
  note: Note;
  token: string;
  /** Its site URL, `/s/<token>/`. */
  url: string;
}

let loggedSharingOff = false;

/**
 * Every shared page this build writes: one per shared note, or none when
 * there is no share secret (logged once, as sharing is off).
 */
export function sharedPages(vault: Vault): SharedPage[] {
  const secret = shareSecretFromEnv();
  if (!secret) {
    if (!loggedSharingOff) console.log("Sharing is off: SHARE_SECRET is not set, so no shared pages are written.");
    loggedSharingOff = true;
    return [];
  }
  return vault.files
    .filter((file): file is Note => file.kind === "note" && file.shared)
    .map((note) => {
      const token = shareTokenFor(secret, note.path);
      return { note, token, url: sharedPageUrlFor(token) };
    });
}

/** The shared page of a vault file, if it is a shared note and the build shares. */
export function sharedPageFor(vault: Vault, file: VaultFile): SharedPage | undefined {
  if (file.kind !== "note" || !file.shared) return undefined;
  return sharedPages(vault).find((page) => page.note.path === file.path);
}

/** A vault file a shared page shows inline, copied under the page's URL as `name`. */
export interface SharedFile {
  name: string;
  file: Attachment;
}

export interface RenderedSharedPage {
  title: string;
  html: string;
  files: SharedFile[];
}

const rendered = new WeakMap<Vault, Map<string, Promise<RenderedSharedPage>>>();

/**
 * A shared page's title, body and the files it shows. Rendered once per vault
 * read, since both the page and its copied files need it.
 *
 * Its links go through the one resolver like the owner's page, but point only
 * at other shared pages; anything else is a broken link. The images, audio
 * and video it shows are copied under its own URL, named by their order of
 * first use (`1.png`, `2.mp3`, ...), so no request leaves `/s/<token>/` and
 * no file name or folder of the vault shows in a URL.
 */
export function renderSharedPage(vault: Vault, page: SharedPage): Promise<RenderedSharedPage> {
  let pages = rendered.get(vault);
  if (!pages) rendered.set(vault, (pages = new Map()));
  let result = pages.get(page.note.path);
  if (!result) {
    result = render(vault, page);
    pages.set(page.note.path, result);
  }
  return result;
}

async function render(vault: Vault, page: SharedPage): Promise<RenderedSharedPage> {
  const others = new Map(sharedPages(vault).map((other) => [other.note.path, other.url]));
  const files = new Map<string, SharedFile>();
  const urls: LinkUrls = {
    link: (file) => others.get(file.path),
    media: (file) => {
      if (file.kind !== "image" && file.kind !== "audio" && file.kind !== "video") return undefined;
      let shared = files.get(file.path);
      if (!shared) {
        shared = { name: `${files.size + 1}${extensionOf(file.path)}`, file };
        files.set(file.path, shared);
      }
      return sharedFileUrlFor(page.token, shared.name);
    },
  };
  const title = noteTitle(page.note);
  const html = await renderNote(vault, page.note, await readFile(page.note.absolutePath, "utf8"), { title, urls });
  return { title, html, files: [...files.values()] };
}

/** `.png` for `Photos/Beach.PNG`: the lowercased extension, so the host still serves the right type. */
function extensionOf(path: string): string {
  const name = path.slice(path.lastIndexOf("/") + 1);
  const dot = name.lastIndexOf(".");
  return dot > 0 ? name.slice(dot).toLowerCase() : "";
}
