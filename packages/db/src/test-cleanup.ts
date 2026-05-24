import { rm } from "node:fs/promises";

const WINDOWS_TEMP_CLEANUP_MAX_RETRIES = 5;
const WINDOWS_TEMP_CLEANUP_RETRY_DELAY_MS = 100;

export async function removeTemporaryDirectory(path: string) {
  await rm(path, {
    recursive: true,
    force: true,
    maxRetries: process.platform === "win32" ? WINDOWS_TEMP_CLEANUP_MAX_RETRIES : 0,
    retryDelay: WINDOWS_TEMP_CLEANUP_RETRY_DELAY_MS
  });
}
