// Vault reader: turns the vault directory into the list of vault files.
// The listing follows the vault's git (ADR-0004); attachments and frontmatter
// arrive in #7 and #6.

import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import { readdir, stat } from "node:fs/promises";
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

/**
 * Whether the vault's listing must come from git. Fails closed: a vault with a
 * `.git` entry is always a git vault, and only git's own "not a git repository"
 * answer lets a vault without one fall back to the folder walk. Anything else
 * (git missing, dubious ownership, a broken repo) fails the build, because the
 * walk ignores `.gitignore` and would publish ignored folders.
 */
async function isGitRepo(dir: string): Promise<boolean> {
  if (existsSync(join(dir, ".git"))) return true;
  try {
    return (await runGit(dir, ["rev-parse", "--is-inside-work-tree"])).trim() === "true";
  } catch (error) {
    if (/not a git repository/.test(String((error as { stderr?: unknown }).stderr))) return false;
    throw gitFailure(dir, error);
  }
}

/** Tracked files plus untracked files that aren't ignored, minus tracked files missing from the working tree. */
async function gitListing(dir: string): Promise<string[]> {
  let stdout: string;
  try {
    stdout = await runGit(dir, ["ls-files", "--cached", "--others", "--exclude-standard", "-z"]);
  } catch (error) {
    throw gitFailure(dir, error);
  }
  const listed = [...new Set(stdout.split("\0").filter(Boolean))];
  const present = await Promise.all(listed.map((path) => isFileOnDisk(join(dir, ...path.split("/")))));
  return listed.filter((_, i) => present[i]);
}

/** Run git in `dir` with untranslated messages, returning stdout. */
async function runGit(dir: string, args: string[]): Promise<string> {
  const { stdout } = await execFileAsync("git", args, {
    cwd: dir,
    env: { ...process.env, LC_ALL: "C" },
    maxBuffer: 256 * 1024 * 1024,
  });
  return stdout;
}

function gitFailure(dir: string, error: unknown): Error {
  const { stderr, message } = error as { stderr?: string; message?: string };
  const reason = stderr?.trim() || message || String(error);
  return new Error(
    `VAULT_DIR points to ${dir}, but git failed there, so the build stops rather than walk the folder and publish git-ignored files: ${reason}`,
  );
}

async function isFileOnDisk(absolutePath: string): Promise<boolean> {
  try {
    return (await stat(absolutePath)).isFile();
  } catch {
    return false;
  }
}

async function folderWalk(dir: string): Promise<string[]> {
  const entries = await readdir(dir, { recursive: true, withFileTypes: true });
  return entries
    .filter((entry) => entry.isFile())
    .map((entry) => relative(dir, join(entry.parentPath, entry.name)).split(sep).join("/"));
}
