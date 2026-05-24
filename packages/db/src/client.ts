import { chmod, mkdir } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, isAbsolute, join } from "node:path";
import { setTimeout as sleep } from "node:timers/promises";
import { fileURLToPath, pathToFileURL } from "node:url";
import { createClient, type Client } from "@libsql/client";
import { sql } from "drizzle-orm";
import { drizzle, type LibSQLDatabase } from "drizzle-orm/libsql";
import { migrate } from "drizzle-orm/libsql/migrator";
import * as schema from "./schema";

export type SoloDatabase = LibSQLDatabase<typeof schema>;
export type SoloDatabaseTransaction = Parameters<Parameters<SoloDatabase["transaction"]>[0]>[0];
export type SoloDatabaseExecutor = SoloDatabase | SoloDatabaseTransaction;

export interface SoloStorage {
  readonly url: string;
  readonly client: Client;
  readonly db: SoloDatabase;
  readonly close: () => Promise<void>;
}

export interface CreateSoloStorageOptions {
  readonly url: string;
  readonly ensureDirectory?: boolean;
}

export interface MigrationStatus {
  readonly state: "migrated" | "failed";
  readonly databaseUrl: string;
  readonly migrationsFolder: string;
  readonly appliedMigrationCount: number;
  readonly latestMigrationMillis: number | null;
  readonly checkedAt: string;
  readonly errorMessage?: string;
}

export const DEFAULT_DATABASE_FILENAME = "solo-superman.db";
export const defaultMigrationsFolder = fileURLToPath(new URL("../drizzle", import.meta.url));

export function defaultDevAppDataDir() {
  if (process.platform === "darwin") {
    return join(homedir(), "Library", "Application Support", "Solo Superman", "dev");
  }

  return join(homedir(), ".local", "share", "solo-superman", "dev");
}

export function localDatabaseUrlFromAppDataDir(appDataDir: string) {
  if (!isAbsolute(appDataDir)) {
    throw new Error(`appDataDir must be absolute: ${appDataDir}`);
  }

  return pathToFileURL(join(appDataDir, DEFAULT_DATABASE_FILENAME)).href;
}

export function assertLocalLibsqlUrl(url: string) {
  if (url === ":memory:" || url.startsWith("file:")) {
    return;
  }

  throw new Error("Phase 1 storage only accepts local libSQL file URLs.");
}

function localFilePathFromUrl(url: string) {
  if (url === ":memory:" || url === "file::memory:") {
    return null;
  }

  if (!url.startsWith("file:")) {
    return null;
  }

  return fileURLToPath(url);
}

async function ensureLocalDatabaseDirectory(url: string) {
  const filePath = localFilePathFromUrl(url);

  if (!filePath) {
    return;
  }

  const directoryPath = dirname(filePath);

  await mkdir(directoryPath, { recursive: true, mode: 0o700 });
  await chmod(directoryPath, 0o700);
}

export async function createSoloStorage(options: CreateSoloStorageOptions): Promise<SoloStorage> {
  const ensureDirectory = options.ensureDirectory ?? true;

  assertLocalLibsqlUrl(options.url);

  if (ensureDirectory) {
    await ensureLocalDatabaseDirectory(options.url);
  }

  const client = createClient({ url: options.url });
  const db = drizzle(client, { schema });
  const localFilePath = localFilePathFromUrl(options.url);

  return {
    url: options.url,
    client,
    db,
    close: async () => {
      await Promise.resolve(client.close());
      if (process.platform === "win32" && localFilePath) {
        await sleep(100);
      }
    }
  };
}

export async function readMigrationStatus(
  storage: Pick<SoloStorage, "db" | "url">,
  migrationsFolder = defaultMigrationsFolder
): Promise<MigrationStatus> {
  const rows = await storage.db.values<[number, string, number]>(
    sql`SELECT id, hash, created_at FROM __drizzle_migrations ORDER BY created_at ASC`
  );
  const latest = rows.at(-1);

  return {
    state: "migrated",
    databaseUrl: storage.url,
    migrationsFolder,
    appliedMigrationCount: rows.length,
    latestMigrationMillis: latest ? Number(latest[2]) : null,
    checkedAt: new Date().toISOString()
  };
}

export async function applyMigrations(
  storage: Pick<SoloStorage, "db" | "url">,
  migrationsFolder = defaultMigrationsFolder
): Promise<MigrationStatus> {
  try {
    await migrate(storage.db, { migrationsFolder });
    return await readMigrationStatus(storage, migrationsFolder);
  } catch (error) {
    return {
      state: "failed",
      databaseUrl: storage.url,
      migrationsFolder,
      appliedMigrationCount: 0,
      latestMigrationMillis: null,
      checkedAt: new Date().toISOString(),
      errorMessage: error instanceof Error ? error.message : String(error)
    };
  }
}
