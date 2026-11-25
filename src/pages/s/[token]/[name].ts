// The images, audio and video a shared page shows, copied under its own URL
// (`/s/<token>/1.png`, ...), so a visitor's browser never asks for anything
// outside `/s/`. renderSharedPage decides which files and their names.
import type { APIRoute, GetStaticPaths } from "astro";
import { readFile } from "node:fs/promises";
import { loadVault, type Attachment } from "../../../lib/vault";
import { renderSharedPage, sharedPages } from "../../../lib/share";

export const getStaticPaths = (async () => {
  const vault = await loadVault();
  const paths = [];
  for (const page of sharedPages(vault)) {
    for (const { name, file } of (await renderSharedPage(vault, page)).files) {
      paths.push({ params: { token: page.token, name }, props: { file } });
    }
  }
  return paths;
}) satisfies GetStaticPaths;

export const GET: APIRoute = async ({ props }) => {
  const { file } = props as { file: Attachment };
  return new Response(await readFile(file.absolutePath));
};
