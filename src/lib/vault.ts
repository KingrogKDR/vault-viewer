// Vault reader: turns the vault directory into the list of vault files.
// The listing follows the vault's git (ADR-0004). Every vault file gets a kind,
// which picks its viewer; notes also carry their parsed frontmatter.

import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import { readdir, readFile, stat } from "node:fs/promises";
import { join, relative, resolve, sep } from "node:path";
import { promisify } from "node:util";
import { rawPathFor, slugFor } from "./slug";
import { parseFrontmatter, type Frontmatter } from "./frontmatter";
import { openingHeadingText } from "./opening-heading";

const execFileAsync = promisify(execFile);

/** Which viewer shows a vault file. More kinds (pdf, video, ...) arrive with their viewers. */
export type VaultFileKind = "note" | "image" | "other";

const IMAGE_EXTENSIONS = new Set(["png", "jpg", "jpeg", "webp", "gif", "svg", "avif"]);

/** The one place a vault file's kind is decided, from its vault path's extension. */
function kindFor(path: string): VaultFileKind {
  const name = path.slice(path.lastIndexOf("/") + 1);
  const dot = name.lastIndexOf(".");
  const extension = dot > 0 ? name.slice(dot + 1).toLowerCase() : "";
  if (extension === "md") return "note";
  if (IMAGE_EXTENSIONS.has(extension)) return "image";
  return "other";
}

interface VaultFileBase {
  /** Vault path, relative to the vault root, `/`-separated. */
  path: string;
  /** Absolute path on disk. */
  absolutePath: string;
  slug: string;
  /** Size in bytes. */
  size: number;
}

export interface Note extends VaultFileBase {
  kind: "note";
  /** Parsed YAML frontmatter; `{}` when the note has none or it is malformed. */
  frontmatter: Frontmatter;
  /** Plain text of the note's opening `# Heading`, if it opens with one. */
  openingHeading?: string;
}

/** Any vault file that is not a note. The vault reader never reads its contents. */
export interface Attachment extends VaultFileBase {
  kind: Exclude<VaultFileKind, "note">;
}

export type VaultFile = Note | Attachment;

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

const builtVaults = new Map<string, Promise<Vault>>();

/**
 * The vault at `VAULT_DIR`. Every page needs it (the file tree is on all of
 * them), so a production build reads and parses it once and shares the result.
 * `astro dev` reads it afresh on each call, so edits to the vault show on reload.
 */
export function loadVault(): Promise<Vault> {
  const dir = resolve(vaultDirFromEnv());
  if (process.env.NODE_ENV !== "production") return readVault(dir);
  let vault = builtVaults.get(dir);
  if (!vault) {
    vault = readVault(dir);
    builtVaults.set(dir, vault);
  }
  return vault;
}

/** Read the vault at `dir`. */
export async function readVault(dir: string): Promise<Vault> {
  const files: VaultFile[] = [];
  for (const path of await listVaultPaths(dir)) {
    const absolutePath = join(dir, ...path.split("/"));
    const base = { path, absolutePath, slug: slugFor(path), size: (await stat(absolutePath)).size };
    const kind = kindFor(path);
    if (kind === "note") {
      const source = await readFile(absolutePath, "utf8");
      files.push({ ...base, kind, frontmatter: parseFrontmatter(source), openingHeading: openingHeadingText(source) });
    } else {
      files.push({ ...base, kind });
    }
  }
  files.sort((a, b) => a.path.localeCompare(b.path));
  assertNoOutputClashes(files);
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

/**
 * Where a vault file is written in the build output: its viewer page and its
 * raw file. Keep in step with src/pages/[...slug].astro and src/pages/raw/.
 */
function outputPathsFor(file: VaultFile): string[] {
  return [`${file.slug}/index.html`, `raw/${rawPathFor(file.path)}`];
}

/**
 * Fail when two vault files would be written to the same place, so neither
 * silently loses its page or raw file: the same output path (e.g. a shared
 * slug), or one's file where the other needs a folder (raw file `raw/foo`
 * against `raw/foo/index.html`, the viewer page of a note `raw/foo.md`).
 */
function assertNoOutputClashes(files: VaultFile[]): void {
  const owners = new Map<string, VaultFile>();
  for (const file of files) {
    for (const out of outputPathsFor(file)) if (!owners.has(out)) owners.set(out, file);
  }

  const clashes = new Set<string>();
  const clash = (first: VaultFile, second: VaultFile, why: string) => {
    if (first.path !== second.path) clashes.add(`"${first.path}" and "${second.path}" ${why}`);
  };
  for (const file of files) {
    for (const out of outputPathsFor(file)) {
      const owner = owners.get(out)!;
      clash(owner, file, owner.slug === file.slug ? `both have the URL slug "${file.slug}"` : `would both be written to ${out}`);
      const segments = out.split("/");
      for (let i = 1; i < segments.length; i++) {
        const folder = segments.slice(0, i).join("/");
        const fileThere = owners.get(folder);
        if (fileThere) clash(fileThere, file, `clash: the first is written to the file ${folder}, which the second needs as a folder for ${out}`);
      }
    }
  }
  if (clashes.size > 0) {
    throw new Error(
      `Vault files collide in the site's output. Rename one file in each pair:\n${[...clashes].map((c) => `  - ${c}`).join("\n")}`,
    );
  }
}
