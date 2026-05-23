export type ProjectionRecord = Readonly<Record<string, unknown>>;

export function isProjectionRecord(value: unknown): value is ProjectionRecord {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
