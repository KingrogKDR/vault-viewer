// Seam 1 harness: build the site from a fixture vault and inspect the output.
//
//   const vault = await createFixtureVault({ "Hello.md": "# Hello" });
//   const build = await buildSite({ vaultDir: vault });
//   const doc = await build.page("/hello/");
//   doc.querySelector("h1")?.textContent;
//
// Or in one call: `const build = await buildFixtureVault({ ... })`.
// Every build gets its own temporary output directory, so builds never collide.

import { mkdtemp, mkdir, readFile, readdir, writeFile, rm } from "node:fs/promises";
import { existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, relative, resolve, sep } from "node:path";
import { parseHTML } from "linkedom";

const REPO_ROOT = resolve(import.meta.dir, "../..");
const ASTRO_BIN = join(REPO_ROOT, "node_modules/.bin/astro");

/** Vault path (always `/`-separated) → file contents. */
export type FixtureFiles = Record<string, string | Uint8Array>;

const tempDirs: string[] = [];

async function makeTempDir(prefix: string): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), `vault-viewer-${prefix}-`));
  tempDirs.push(dir);
  return dir;
}

/** Remove every temporary vault and output directory created so far. */
export async function cleanupTempDirs(): Promise<void> {
  await Promise.all(tempDirs.splice(0).map((d) => rm(d, { recursive: true, force: true })));
}

/** How a fixture vault is set up beyond the committed files. */
export interface FixtureOptions {
  /** Files written after the commit and left untracked (never `git add`ed). */
  untracked?: FixtureFiles;
  /** Vault paths deleted from the working tree after the commit, so git still tracks them. */
  deleted?: string[];
  /** `false` makes a plain folder with no git repo; `untracked` and `deleted` then just write or remove files. */
  git?: boolean;
}

async function writeFiles(vaultDir: string, files: FixtureFiles): Promise<void> {
  for (const [vaultPath, contents] of Object.entries(files)) {
    const target = join(vaultDir, ...vaultPath.split("/"));
    await mkdir(dirname(target), { recursive: true });
    await writeFile(target, contents);
  }
}

/**
 * Write the given vault files to a fresh temporary directory and commit them
 * to a new git repo, the way CI checks the vault out. Returns the vault dir.
 */
export async function createFixtureVault(files: FixtureFiles, options: FixtureOptions = {}): Promise<string> {
  const vaultDir = await makeTempDir("vault");
  await writeFiles(vaultDir, files);
  if (options.git !== false) {
    await git(vaultDir, "init", "--quiet", "--initial-branch=main");
    await git(vaultDir, "add", "-A");
    await git(
      vaultDir,
      "-c", "user.name=Fixture",
      "-c", "user.email=fixture@example.invalid",
      "-c", "commit.gpgsign=false",
      "commit", "--quiet", "--allow-empty", "-m", "fixture vault",
    );
  }
  await writeFiles(vaultDir, options.untracked ?? {});
  for (const vaultPath of options.deleted ?? []) {
    await rm(join(vaultDir, ...vaultPath.split("/")));
  }
  return vaultDir;
}

async function git(cwd: string, ...args: string[]): Promise<void> {
  const proc = Bun.spawn(["git", ...args], { cwd, stdout: "pipe", stderr: "pipe" });
  if ((await proc.exited) !== 0) {
    throw new Error(`git ${args.join(" ")} failed: ${await new Response(proc.stderr).text()}`);
  }
}

export interface SiteBuild {
  /** True when the build exited 0. */
  ok: boolean;
  /** Combined stdout + stderr of the build, for asserting on error messages. */
  output: string;
  /** The build's output directory. */
  outDir: string;
  /** Whether the output has a viewer page at this site URL (e.g. `/hello/`, or `/café/` decoded, not `/caf%C3%A9/`). */
  hasPage(url: string): boolean;
  /** Load the page at this site URL as a DOM document. Throws if it doesn't exist. */
  page(url: string): Promise<Document>;
  /** Read any output file as text by its path in the output dir (e.g. `_headers`). Throws if it doesn't exist. */
  file(path: string): Promise<string>;
  /** Read any output file's exact bytes by its path in the output dir (decoded, e.g. `raw/café.png`). Throws if it doesn't exist. */
  bytes(path: string): Promise<Uint8Array>;
  /** Paths (`/`-separated, relative to the output dir) of every `.html` file the build wrote, sorted. */
  htmlPages(): Promise<string[]>;
  /** Paths (`/`-separated, relative to the output dir, decoded) of every file the build wrote, sorted. */
  outputFiles(): Promise<string[]>;
}

export interface BuildOptions {
  /** Vault directory to build from. `null` leaves `VAULT_DIR` unset. */
  vaultDir: string | null;
}

/** Run the real site build against a vault into a fresh temporary output directory. */
export async function buildSite({ vaultDir }: BuildOptions): Promise<SiteBuild> {
  const outDir = await makeTempDir("out");
  const env: Record<string, string | undefined> = { ...process.env, ASTRO_TELEMETRY_DISABLED: "1" };
  delete env.VAULT_DIR;
  if (vaultDir !== null) env.VAULT_DIR = vaultDir;

  const proc = Bun.spawn([ASTRO_BIN, "build", "--outDir", outDir], {
    cwd: REPO_ROOT,
    env,
    stdout: "pipe",
    stderr: "pipe",
  });
  const [stdout, stderr, exitCode] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
    proc.exited,
  ]);

  const outputFiles = async () => {
    const entries = await readdir(outDir, { recursive: true, withFileTypes: true });
    return entries
      .filter((entry) => entry.isFile())
      .map((entry) => relative(outDir, join(entry.parentPath, entry.name)).split(sep).join("/"))
      .sort();
  };
  const fileFor = (url: string) => join(outDir, ...url.split("/").filter(Boolean), "index.html");

  return {
    ok: exitCode === 0,
    output: stdout + stderr,
    outDir,
    hasPage: (url) => existsSync(fileFor(url)),
    async page(url) {
      const file = fileFor(url);
      if (!existsSync(file)) throw new Error(`No page at ${url} (looked for ${file})`);
      return parseHTML(await readFile(file, "utf8")).document as unknown as Document;
    },
    async file(path) {
      const file = join(outDir, ...path.split("/").filter(Boolean));
      if (!existsSync(file)) throw new Error(`No output file ${path} (looked for ${file})`);
      return readFile(file, "utf8");
    },
    async bytes(path) {
      const file = join(outDir, ...path.split("/").filter(Boolean));
      if (!existsSync(file)) throw new Error(`No output file ${path} (looked for ${file})`);
      return new Uint8Array(await readFile(file));
    },
    async htmlPages() {
      // Files only: an attachment's viewer page dir is named like `intro.html/`.
      return (await outputFiles()).filter((path) => path.endsWith(".html"));
    },
    outputFiles,
  };
}

/** One call: create a fixture vault from these files and build the site from it. */
export async function buildFixtureVault(files: FixtureFiles, options?: FixtureOptions): Promise<SiteBuild> {
  return buildSite({ vaultDir: await createFixtureVault(files, options) });
}
