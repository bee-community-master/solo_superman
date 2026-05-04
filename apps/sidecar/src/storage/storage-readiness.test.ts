import { existsSync } from "node:fs";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { afterEach, describe, expect, it } from "vitest";
import { initializeStorageReadiness } from "./storage-readiness";

const tempDirs: string[] = [];

async function makeTempAppDataDir() {
  const tempDir = await mkdtemp(join(tmpdir(), "solo-superman-sidecar-storage-test-"));

  tempDirs.push(tempDir);

  return tempDir;
}

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((tempDir) => rm(tempDir, { recursive: true, force: true })));
});

describe("PR-03 sidecar storage readiness", () => {
  it("initializes migrated local storage from appDataDir", async () => {
    const appDataDir = await makeTempAppDataDir();
    const readiness = await initializeStorageReadiness({
      appDataDir,
      databaseUrl: undefined
    });

    try {
      expect(readiness.storage).not.toBeNull();
      expect(readiness.migrationStatus).toMatchObject({
        state: "migrated",
        appliedMigrationCount: 1
      });
      expect(existsSync(join(appDataDir, "solo-superman.db"))).toBe(true);
    } finally {
      await readiness.storage?.close();
    }
  });

  it("rejects in-memory database overrides for sidecar runtime storage", async () => {
    const appDataDir = await makeTempAppDataDir();
    const readiness = await initializeStorageReadiness({
      appDataDir,
      databaseUrl: ":memory:"
    });

    expect(readiness.storage).toBeNull();
    expect(readiness.migrationStatus).toMatchObject({
      state: "failed",
      databaseUrl: ":memory:",
      appliedMigrationCount: 0
    });
    expect(readiness.migrationStatus.errorMessage).toContain("cannot use in-memory libSQL");
  });

  it("rejects database file overrides outside appDataDir", async () => {
    const appDataDir = await makeTempAppDataDir();
    const outsideDir = await makeTempAppDataDir();
    const outsideDatabaseUrl = pathToFileURL(join(outsideDir, "outside.db")).href;
    const readiness = await initializeStorageReadiness({
      appDataDir,
      databaseUrl: outsideDatabaseUrl
    });

    expect(readiness.storage).toBeNull();
    expect(readiness.migrationStatus).toMatchObject({
      state: "failed",
      databaseUrl: outsideDatabaseUrl,
      appliedMigrationCount: 0
    });
    expect(readiness.migrationStatus.errorMessage).toContain("must stay under appDataDir");
  });

  it("accepts database file overrides under appDataDir", async () => {
    const appDataDir = await makeTempAppDataDir();
    const databaseUrl = pathToFileURL(join(appDataDir, "custom", "solo-superman.db")).href;
    const readiness = await initializeStorageReadiness({
      appDataDir,
      databaseUrl
    });

    try {
      expect(readiness.storage).not.toBeNull();
      expect(readiness.migrationStatus).toMatchObject({
        state: "migrated",
        databaseUrl,
        appliedMigrationCount: 1
      });
      expect(existsSync(join(appDataDir, "custom", "solo-superman.db"))).toBe(true);
    } finally {
      await readiness.storage?.close();
    }
  });

  it("reports invalid remote database URLs as readiness failures without crashing health", async () => {
    const appDataDir = await makeTempAppDataDir();
    const readiness = await initializeStorageReadiness({
      appDataDir,
      databaseUrl: "libsql://future-remote.example"
    });

    expect(readiness.storage).toBeNull();
    expect(readiness.migrationStatus).toMatchObject({
      state: "failed",
      databaseUrl: "libsql://future-remote.example",
      appliedMigrationCount: 0
    });
    expect(readiness.migrationStatus.errorMessage).toContain("local file URL under appDataDir");
  });
});
