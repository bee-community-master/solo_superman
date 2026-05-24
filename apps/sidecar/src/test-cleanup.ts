import { rm } from "node:fs/promises";

export async function removeTemporaryDirectory(path: string) {
  await rm(path, {
    recursive: true,
    force: true,
    maxRetries: process.platform === "win32" ? 5 : 0,
    retryDelay: 100
  });
}
