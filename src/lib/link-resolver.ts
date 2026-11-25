// Link resolver: finds the vault file a link target points to, using
// Obsidian's rules (spec, "Link resolver module"). Markdown links, images,
// wikilinks and embeds (wikilinks.ts) all use it.

import type { Vault, VaultFile } from "./vault";

/** A vault's files, keyed by vault path passed through `key` (exact, or lowercased). */
interface Index {
  key: (path: string) => string;
  byPath: Map<string, VaultFile>;
  /** Keyed file name (last path segment) → vault files with that name, shortest vault path first. */
  byName: Map<string, VaultFile[]>;
}

const exact = (path: string) => path;
const folded = (path: string) => path.toLowerCase();

const indexesByVault = new WeakMap<Vault, Index[]>();

/** The exact-case index, then the case-insensitive one, built once per vault read. */
function indexesFor(vault: Vault): Index[] {
  let indexes = indexesByVault.get(vault);
  if (!indexes) {
    indexes = [buildIndex(vault, exact), buildIndex(vault, folded)];
    indexesByVault.set(vault, indexes);
  }
  return indexes;
}

function buildIndex(vault: Vault, key: (path: string) => string): Index {
  const byPath = new Map<string, VaultFile>();
  const byName = new Map<string, VaultFile[]>();
  // Shortest first, so the first file found for a key is the one that wins.
  for (const file of [...vault.files].sort(shortestPathFirst)) {
    const path = key(file.path);
    if (!byPath.has(path)) byPath.set(path, file);
    const name = lastSegment(path);
    byName.set(name, [...(byName.get(name) ?? []), file]);
  }
  return { key, byPath, byName };
}

/**
 * The vault file that `target` (a link target with no fragment, already
 * URL-decoded) points to from the note at vault path `fromPath`, or undefined.
 *
 * Tried in order, first exactly and then case-insensitively: the target
 * relative to the note's folder, then relative to the vault root, then as the
 * trailing whole segments of any vault path (the shortest such path wins).
 * Each step tries the target as written, then with `.md` appended unless its
 * file name already ends in `.md`, so `Release-1.2` finds `Release-1.2.md`.
 */
export function resolveLink(vault: Vault, fromPath: string, target: string): VaultFile | undefined {
  const folder = fromPath.slice(0, fromPath.lastIndexOf("/") + 1);
  const spellings = /\.md$/i.test(target) ? [target] : [target, `${target}.md`];
  for (const index of indexesFor(vault)) {
    for (const step of [fromFolderOrRoot(folder), fromFolderOrRoot(""), byTrailingPath]) {
      for (const spelling of spellings) {
        const file = step(index, spelling);
        if (file) return file;
      }
    }
  }
  return undefined;
}

type Step = (index: Index, target: string) => VaultFile | undefined;

/** The target joined to `folder` (`""` for the vault root). */
function fromFolderOrRoot(folder: string): Step {
  return ({ key, byPath }, target) => {
    const path = normalise(folder + target);
    return path === undefined ? undefined : byPath.get(key(path));
  };
}

/** The shortest vault path whose trailing whole segments are the target. */
const byTrailingPath: Step = ({ key, byName }, target) => {
  const path = normalise(target);
  if (!path) return undefined;
  const tail = key(path);
  return byName.get(lastSegment(tail))?.find((file) => key(file.path).endsWith(`/${tail}`));
};

function lastSegment(path: string): string {
  return path.slice(path.lastIndexOf("/") + 1);
}

function shortestPathFirst(a: VaultFile, b: VaultFile): number {
  return a.path.length - b.path.length || a.path.localeCompare(b.path);
}

/** `path` with `.` and `..` segments followed and empty ones dropped; undefined if it climbs above the vault root. */
function normalise(path: string): string | undefined {
  const out: string[] = [];
  for (const segment of path.split("/")) {
    if (segment === "" || segment === ".") continue;
    if (segment === "..") {
      if (out.length === 0) return undefined;
      out.pop();
    } else {
      out.push(segment);
    }
  }
  return out.join("/");
}
