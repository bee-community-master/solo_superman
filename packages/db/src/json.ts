export type JsonRecord = Readonly<Record<string, unknown>>;

export function stringifyJson(value: unknown) {
  return JSON.stringify(value ?? {});
}

export function parseJsonRecord(value: string): JsonRecord {
  const parsed = JSON.parse(value) as unknown;

  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("Expected JSON object record.");
  }

  return parsed as JsonRecord;
}

export function parseJsonArray(value: string): readonly string[] {
  const parsed = JSON.parse(value) as unknown;

  if (!Array.isArray(parsed) || parsed.some((item) => typeof item !== "string")) {
    throw new Error("Expected JSON string array.");
  }

  return parsed as readonly string[];
}
