// Folders: every folder of the vault, its folder index note, and whether it
// gets a generated folder page. A folder exists when a published vault file
// is inside it, so unpublished notes never make or fill one.

import { buildFileTree, type TreeEntry } from "./file-tree";
import { folderSlugFor, folderUrlFor, viewerUrlFor } from "./slug";
import type { Note, VaultFile } from "./vault";

export interface Folder {
  /** Vault path of the folder, `/`-separated, no trailing `/`. */
  path: string;
  /** Its own name, the last segment of `path`. */
  name: string;
  /** Slug of its folder page's URL. */
  slug: string;
  /** Its folder index note, if it has one. */
  indexNote?: Note;
  /**
   * Whether the build writes a folder page for it: always, except when a
   * sibling `<FolderName>.md` already owns the folder's URL.
   */
  hasPage: boolean;
  /** Where links to the folder go: its folder index note's viewer page, else its folder page. */
  href: string;
}

const cache = new WeakMap<VaultFile[], Map<string, Folder>>();

/** Every folder that holds a vault file, at any depth, by vault path. Worked out once per file list. */
export function foldersOf(files: VaultFile[]): Map<string, Folder> {
  let folders = cache.get(files);
  if (!folders) {
    folders = findFolders(files);
    cache.set(files, folders);
  }
  return folders;
}

/** The file tree of `files`, each folder linking to its destination (`Folder.href`). */
export function vaultFileTree(files: VaultFile[]): TreeEntry[] {
  const folders = foldersOf(files);
  return buildFileTree(files, (path) => folders.get(path)?.href);
}

/** A name, NFC and lowercased, for case-insensitive matches. */
const fold = (name: string) => name.normalize("NFC").toLowerCase();

function findFolders(files: VaultFile[]): Map<string, Folder> {
  // Notes by the folder they sit in directly ("" for the vault root).
  const notesIn = new Map<string, Note[]>();
  const paths = new Set<string>();
  for (const file of files) {
    const segments = file.path.split("/");
    segments.pop();
    for (let i = 1; i <= segments.length; i++) paths.add(segments.slice(0, i).join("/"));
    if (file.kind === "note") {
      const parent = segments.join("/");
      notesIn.set(parent, [...(notesIn.get(parent) ?? []), file]);
    }
  }

  const folders = new Map<string, Folder>();
  for (const path of paths) {
    const slash = path.lastIndexOf("/");
    const name = path.slice(slash + 1);
    const parent = slash < 0 ? "" : path.slice(0, slash);
    const sibling = named(notesIn.get(parent) ?? [], `${name}.md`);
    const indexNote = folderIndexNote(notesIn.get(path) ?? [], name, sibling);
    folders.set(path, {
      path,
      name,
      slug: folderSlugFor(path),
      indexNote,
      hasPage: !sibling,
      href: indexNote ? viewerUrlFor(indexNote.slug) : folderUrlFor(path),
    });
  }
  return folders;
}

/**
 * A folder's folder index note, first match wins, names matched
 * case-insensitively: `index.md`, `README.md`, `<FolderName>.md` inside the
 * folder; a sibling `<FolderName>.md` next to it (as the Folder Notes plugin
 * does); else the one note directly inside whose name has the word "index".
 */
function folderIndexNote(children: Note[], folderName: string, sibling: Note | undefined): Note | undefined {
  const byWord = children.filter((note) => /(?<![\p{L}\p{M}\p{N}])index(?![\p{L}\p{M}\p{N}])/iu.test(fileName(note).replace(/\.md$/i, "")));
  return (
    named(children, "index.md") ??
    named(children, "README.md") ??
    named(children, `${folderName}.md`) ??
    sibling ??
    (byWord.length === 1 ? byWord[0] : undefined)
  );
}

/** The note among `notes` with file name `name`, ignoring case; an exact-case match wins a tie. */
function named(notes: Note[], name: string): Note | undefined {
  const matches = notes.filter((note) => fold(fileName(note)) === fold(name));
  return matches.find((note) => fileName(note) === name) ?? matches[0];
}

function fileName(file: VaultFile): string {
  return file.path.slice(file.path.lastIndexOf("/") + 1);
}
