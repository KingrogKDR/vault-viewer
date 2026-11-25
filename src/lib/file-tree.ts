// The file tree's data: the vault's files arranged in their folders.
// Rendering lives in src/components/FileTree.astro.

import { viewerUrlFor } from "./slug";

/** What the tree needs from a vault file. Any kind of vault file works. */
export interface TreeSource {
  /** Vault path, `/`-separated. */
  path: string;
  slug: string;
}

export interface TreeFile {
  kind: "file";
  /** Label shown in the tree. */
  name: string;
  path: string;
  /** Site URL of the file's viewer page. */
  href: string;
}

export interface TreeFolder {
  kind: "folder";
  name: string;
  /** Vault path of the folder, `/`-separated. */
  path: string;
  /** Where a link to the folder goes, when `buildFileTree` was given `folderHref`. */
  href?: string;
  entries: TreeEntry[];
}

export type TreeEntry = TreeFile | TreeFolder;

/** Label for a vault file in the tree: its file name, without `.md` for notes. */
function labelFor(fileName: string): string {
  return fileName.replace(/\.md$/i, "");
}

/**
 * Arrange vault files into nested folders. `folderHref` gives each folder's
 * link destination (see folders.ts), by the folder's vault path.
 */
export function buildFileTree(files: TreeSource[], folderHref?: (folderPath: string) => string | undefined): TreeEntry[] {
  const root: TreeFolder = { kind: "folder", name: "", path: "", entries: [] };
  for (const file of files) {
    const segments = file.path.split("/");
    const fileName = segments.pop()!;
    let folder = root;
    for (const segment of segments) {
      const path = folder.path ? `${folder.path}/${segment}` : segment;
      let next = folder.entries.find((e): e is TreeFolder => e.kind === "folder" && e.name === segment);
      if (!next) {
        next = { kind: "folder", name: segment, path, href: folderHref?.(path), entries: [] };
        folder.entries.push(next);
      }
      folder = next;
    }
    folder.entries.push({ kind: "file", name: labelFor(fileName), path: file.path, href: viewerUrlFor(file.slug) });
  }
  sortEntries(root.entries);
  return root.entries;
}

/** The folder at vault path `path` in a built tree, if there is one. */
export function findTreeFolder(entries: TreeEntry[], path: string): TreeFolder | undefined {
  for (const entry of entries) {
    if (entry.kind !== "folder") continue;
    if (entry.path === path) return entry;
    if (path.startsWith(`${entry.path}/`)) return findTreeFolder(entry.entries, path);
  }
  return undefined;
}

/** Natural, case-insensitive order: `Day 2` before `Day 10`, `apple` before `Banana`. */
const byName = new Intl.Collator("en", { numeric: true, sensitivity: "base" });

function sortEntries(entries: TreeEntry[]): void {
  entries.sort((a, b) => {
    if (a.kind !== b.kind) return a.kind === "folder" ? -1 : 1;
    return byName.compare(a.name, b.name) || a.path.localeCompare(b.path);
  });
  for (const entry of entries) if (entry.kind === "folder") sortEntries(entry.entries);
}
