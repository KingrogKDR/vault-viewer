// Vault reader: turns the vault directory into the list of vault files.
// For now this is a plain directory walk over notes; the git-based listing
// (ADR-0004), attachments and frontmatter arrive in #3, #6 and #7.

import { existsSync } from "node:fs";
import { readdir } from "node:fs/promises";
import { join } from "node:path";
import { slugFor } from "./slug";

export interface VaultFile {
  /** Vault path, relative to the vault root, `/`-separated. */
  path: string;
  /** Absolute path on disk. */
  absolutePath: string;
  kind: "note";
  slug: string;
}

export interface Vault {
  dir: string;
  files: VaultFile[];
}

/** The vault directory the build reads from, taken from `VAULT_DIR`. Throws a clear error if unusable. */
export function vaultDirFromEnv(): string {
  const dir = process.env.VAULT_DIR;
  if (!dir) {
    throw new Error("VAULT_DIR is not set. Point it at the vault directory to build, e.g. VAULT_DIR=~/vault bun run build");
  }
  if (!existsSync(dir)) {
    throw new Error(`VAULT_DIR points to ${dir}, which does not exist`);
  }
  return dir;
}

/** Read the vault at `dir`. */
export async function readVault(dir: string): Promise<Vault> {
  const entries = await readdir(dir, { recursive: true, withFileTypes: true });
  const files: VaultFile[] = [];
  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.toLowerCase().endsWith(".md")) continue;
    const absolutePath = join(entry.parentPath, entry.name);
    const path = absolutePath.slice(dir.length + 1).split("\\").join("/");
    if (path.split("/").some((segment) => segment.startsWith("."))) continue;
    files.push({ path, absolutePath, kind: "note", slug: slugFor(path) });
  }
  files.sort((a, b) => a.path.localeCompare(b.path));
  return { dir, files };
}
