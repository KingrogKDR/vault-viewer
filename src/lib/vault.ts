// Vault reader: turns the vault directory into the list of vault files.
// The listing follows the vault's git (ADR-0004); attachments and frontmatter
// arrive in #7 and #6.

import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import { readdir } from "node:fs/promises";
import { join, relative, sep } from "node:path";
import { promisify } from "node:util";
import { slugFor } from "./slug";

const execFileAsync = promisify(execFile);

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
  const files: VaultFile[] = [];
  for (const path of await listVaultPaths(dir)) {
    // Only notes get viewer pages until attachments land (#7).
    if (!path.toLowerCase().endsWith(".md")) continue;
    files.push({ path, absolutePath: join(dir, ...path.split("/")), kind: "note", slug: slugFor(path) });
  }
  files.sort((a, b) => a.path.localeCompare(b.path));
  return { dir, files };
}

/**
 * Every vault path in the vault at `dir` (ADR-0004): what its git would publish
 * when it is a git repo, otherwise every file in the folder. Paths with a
 * segment starting with `.` are never vault files.
 */
async function listVaultPaths(dir: string): Promise<string[]> {
  const paths = (await isGitRepo(dir)) ? await gitListing(dir) : await folderWalk(dir);
  return paths.filter((path) => !path.split("/").some((segment) => segment.startsWith(".")));
}

async function isGitRepo(dir: string): Promise<boolean> {
  try {
    const { stdout } = await execFileAsync("git", ["rev-parse", "--is-inside-work-tree"], { cwd: dir });
    return stdout.trim() === "true";
  } catch {
    return false;
  }
}

/** Tracked files plus untracked files that aren't ignored. */
async function gitListing(dir: string): Promise<string[]> {
  const { stdout } = await execFileAsync(
    "git",
    ["ls-files", "--cached", "--others", "--exclude-standard", "-z"],
    { cwd: dir, maxBuffer: 256 * 1024 * 1024 },
  );
  return [...new Set(stdout.split("\0").filter(Boolean))];
}

async function folderWalk(dir: string): Promise<string[]> {
  const entries = await readdir(dir, { recursive: true, withFileTypes: true });
  return entries
    .filter((entry) => entry.isFile())
    .map((entry) => relative(dir, join(entry.parentPath, entry.name)).split(sep).join("/"));
}
