// Vault reader: turns the vault directory into the list of vault files.
// The listing follows the vault's git (ADR-0004). Every vault file gets a kind,
// which picks its viewer; notes also carry their parsed frontmatter.
// Unpublished notes (`publish: false`) are dropped here, so the rest of the
// site never sees them.

import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import { readdir, readFile, stat } from "node:fs/promises";
import { join, relative, resolve, sep } from "node:path";
import { promisify } from "node:util";
import { rawPathFor, slugFor } from "./slug";
import { foldersOf } from "./folders";
import { parseFrontmatter, type Frontmatter } from "./frontmatter";
import { openingHeadingText } from "./opening-heading";

const execFileAsync = promisify(execFile);

/** Which viewer shows a vault file. More kinds (pdf, video, ...) arrive with their viewers. */
export type VaultFileKind = "note" | "image" | "audio" | "video" | "other";

const IMAGE_EXTENSIONS = new Set(["png", "jpg", "jpeg", "webp", "gif", "svg", "avif"]);
// Obsidian's audio and video formats (`webm` plays as video).
const AUDIO_EXTENSIONS = new Set(["mp3", "wav", "m4a", "ogg", "3gp", "flac"]);
const VIDEO_EXTENSIONS = new Set(["mp4", "webm", "ogv", "mov", "mkv"]);

/** The one place a vault file's kind is decided, from its vault path's extension. */
function kindFor(path: string): VaultFileKind {
  const name = path.slice(path.lastIndexOf("/") + 1);
  const dot = name.lastIndexOf(".");
  const extension = dot > 0 ? name.slice(dot + 1).toLowerCase() : "";
  if (extension === "md") return "note";
  if (IMAGE_EXTENSIONS.has(extension)) return "image";
  if (AUDIO_EXTENSIONS.has(extension)) return "audio";
  if (VIDEO_EXTENSIONS.has(extension)) return "video";
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
  /** Whether it is a shared note (frontmatter `share`); it gets a shared page only when the build has a share secret. */
  shared: boolean;
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
      const frontmatter = parseFrontmatter(source);
      // An unpublished note stops here, so nothing downstream ever sees it.
      if (isUnpublished(frontmatter)) continue;
      files.push({ ...base, kind, frontmatter, openingHeading: openingHeadingText(source), shared: isShared(frontmatter) });
    } else {
      files.push({ ...base, kind });
    }
  }
  files.sort((a, b) => a.path.localeCompare(b.path));
  assertNoOutputClashes(files);
  assertNothingUnderShared(files);
  return { dir, files };
}

/**
 * Whether a note is an unpublished note: its frontmatter `publish` is `false`,
 * or the string "false" in any case. Anything else, malformed frontmatter
 * included, leaves the note published.
 */
function isUnpublished(frontmatter: Frontmatter): boolean {
  const publish = frontmatter.publish;
  return publish === false || (typeof publish === "string" && publish.toLowerCase() === "false");
}

/**
 * Whether a note is a shared note (ADR-0006): its frontmatter `share` is
 * `true`, or the string "true" in any case. Anything else leaves it unshared.
 * Unpublished notes never get this far, so they are never shared.
 */
function isShared(frontmatter: Frontmatter): boolean {
  const share = frontmatter.share;
  return share === true || (typeof share === "string" && share.toLowerCase() === "true");
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
 * Fail when a vault file's viewer page would land under `/s/`: that path is
 * for shared pages and sits outside Access (ADR-0006), so the page and its
 * file tree would be readable by anyone. Checked with or without a share
 * secret, since the Access bypass doesn't depend on the build.
 */
function assertNothingUnderShared(files: VaultFile[]): void {
  const exposed = files.filter((file) => file.slug === "s" || file.slug.startsWith("s/")).map((file) => `"${file.path}"`);
  if (exposed.length > 0) {
    throw new Error(
      `The site keeps /s/ for shared pages, which are outside Access, so these vault files' pages can't go there. ` +
        `Rename the vault file or folder that becomes "s": ${exposed.join(", ")}`,
    );
  }
}

/** Something the build writes output for: a vault file, or a folder with a folder page (named `Folder/`). */
interface OutputOwner {
  path: string;
  slug: string;
  outputs: string[];
}

/**
 * Fail when two vault files, or a vault file and a folder page, would be
 * written to the same place, so neither silently loses its page or raw file:
 * the same output path (e.g. a shared slug), or one's file where the other
 * needs a folder (raw file `raw/foo` against `raw/foo/index.html`, the viewer
 * page of a note `raw/foo.md`).
 */
function assertNoOutputClashes(files: VaultFile[]): void {
  const all: OutputOwner[] = [
    ...files.map((file) => ({ path: file.path, slug: file.slug, outputs: outputPathsFor(file) })),
    // A folder page; keep in step with src/pages/[...slug].astro.
    ...[...foldersOf(files).values()]
      .filter((folder) => folder.hasPage)
      .map((folder) => ({ path: `${folder.path}/`, slug: folder.slug, outputs: [`${folder.slug}/index.html`] })),
  ];
  const owners = new Map<string, OutputOwner>();
  for (const file of all) {
    for (const out of file.outputs) if (!owners.has(out)) owners.set(out, file);
  }

  const clashes = new Set<string>();
  const clash = (first: OutputOwner, second: OutputOwner, why: string) => {
    if (first.path !== second.path) clashes.add(`"${first.path}" and "${second.path}" ${why}`);
  };
  for (const file of all) {
    for (const out of file.outputs) {
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
      `Vault files collide in the site's output. Rename one file or folder in each pair:\n${[...clashes].map((c) => `  - ${c}`).join("\n")}`,
    );
  }
}
