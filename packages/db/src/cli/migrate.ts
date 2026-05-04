import { applyMigrations, createSoloStorage, defaultDevAppDataDir, localDatabaseUrlFromAppDataDir } from "../client";

const databaseUrl =
  process.env.SOLO_DATABASE_URL ?? localDatabaseUrlFromAppDataDir(process.env.SOLO_APP_DATA_DIR ?? defaultDevAppDataDir());
const storage = await createSoloStorage({ url: databaseUrl });

try {
  const status = await applyMigrations(storage);

  if (status.state === "failed") {
    console.error(JSON.stringify(status));
    process.exitCode = 1;
  } else {
    console.log(JSON.stringify(status));
  }
} finally {
  await storage.close();
}
