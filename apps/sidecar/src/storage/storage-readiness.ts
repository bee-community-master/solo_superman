import { isAbsolute, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  applyMigrations,
  createSoloStorage,
  defaultMigrationsFolder,
  localDatabaseUrlFromAppDataDir,
  type MigrationStatus,
  type SoloStorage
} from "@solo-superman/db";
import type { SidecarConfig } from "../config/sidecar-config";

export interface InitializedStorageReadiness {
  readonly storage: SoloStorage | null;
  readonly migrationStatus: MigrationStatus;
}

function assertRuntimeDatabaseUrl(databaseUrl: string, appDataDir: string) {
  if (databaseUrl === ":memory:" || databaseUrl === "file::memory:") {
    throw new Error("Sidecar runtime storage cannot use in-memory libSQL.");
  }

  if (!databaseUrl.startsWith("file:")) {
    throw new Error("Sidecar runtime databaseUrl override must use a local file URL under appDataDir.");
  }

  const appDataRoot = resolve(appDataDir);
  const databasePath = resolve(fileURLToPath(databaseUrl));
  const relativePath = relative(appDataRoot, databasePath);

  if (relativePath === "" || relativePath.startsWith("..") || isAbsolute(relativePath)) {
    throw new Error("Sidecar runtime databaseUrl must stay under appDataDir.");
  }
}

function resolveRuntimeDatabaseUrl(config: Pick<SidecarConfig, "appDataDir" | "databaseUrl">) {
  const defaultDatabaseUrl = localDatabaseUrlFromAppDataDir(config.appDataDir);

  if (!config.databaseUrl) {
    return defaultDatabaseUrl;
  }

  assertRuntimeDatabaseUrl(config.databaseUrl, config.appDataDir);

  return config.databaseUrl;
}

export async function initializeStorageReadiness(config: Pick<SidecarConfig, "appDataDir" | "databaseUrl">) {
  let databaseUrl = config.databaseUrl ?? "not_configured";

  try {
    databaseUrl = resolveRuntimeDatabaseUrl(config);
    const storage = await createSoloStorage({ url: databaseUrl });
    const migrationStatus = await applyMigrations(storage);

    if (migrationStatus.state === "failed") {
      await storage.close();

      return {
        storage: null,
        migrationStatus
      };
    }

    return {
      storage,
      migrationStatus
    };
  } catch (error) {
    const migrationStatus: MigrationStatus = {
      state: "failed",
      databaseUrl,
      migrationsFolder: defaultMigrationsFolder,
      appliedMigrationCount: 0,
      latestMigrationMillis: null,
      checkedAt: new Date().toISOString(),
      errorMessage: error instanceof Error ? error.message : String(error)
    };

    return {
      storage: null,
      migrationStatus
    };
  }
}
