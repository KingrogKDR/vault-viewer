import { afterAll, describe, expect, test } from "bun:test";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { buildSite, cleanupTempDirs } from "../harness/site-build";

afterAll(cleanupTempDirs);

describe("VAULT_DIR", () => {
  test("the build fails naming VAULT_DIR when it is not set", async () => {
    const build = await buildSite({ vaultDir: null });

    expect(build.ok).toBe(false);
    expect(build.output).toMatch(/VAULT_DIR is not set/);
  }, 30_000);

  test("the build fails naming VAULT_DIR and the path when it does not exist", async () => {
    const missing = join(tmpdir(), "vault-viewer-no-such-vault");
    const build = await buildSite({ vaultDir: missing });

    expect(build.ok).toBe(false);
    expect(build.output).toContain(`VAULT_DIR points to ${missing}, which does not exist`);
  }, 30_000);
});
