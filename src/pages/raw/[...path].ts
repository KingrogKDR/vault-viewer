// Every vault file's raw file: its original bytes at `rawUrlFor(path)`.
// The whole file is read into memory; large files (over 20 MB) will be served
// from object storage instead (M5).
import type { APIRoute, GetStaticPaths } from "astro";
import { readFile } from "node:fs/promises";
import { loadVault, type VaultFile } from "../../lib/vault";
import { rawPathFor } from "../../lib/slug";

export const getStaticPaths = (async () => {
  const vault = await loadVault();
  return vault.files.map((file) => ({ params: { path: rawPathFor(file.path) }, props: { file } }));
}) satisfies GetStaticPaths;

export const GET: APIRoute = async ({ props }) => {
  const { file } = props as { file: VaultFile };
  return new Response(await readFile(file.absolutePath));
};
