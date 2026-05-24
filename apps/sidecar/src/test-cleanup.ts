import { rm } from "node:fs/promises";

function isWindowsBusyError(error: unknown) {
  return (
    process.platform === "win32" &&
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === "EBUSY"
  );
}

export async function removeTemporaryDirectory(path: string) {
  try {
    await rm(path, {
      recursive: true,
      force: true
    });
  } catch (error) {
    if (isWindowsBusyError(error)) {
      return;
    }

    throw error;
  }
}
