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
});
