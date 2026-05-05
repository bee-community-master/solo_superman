export type JsonRecord = Readonly<Record<string, unknown>>;

export function stringifyJson(value: unknown) {
  return JSON.stringify(value ?? {});
}

export function parseJsonRecord<TValue extends object = JsonRecord>(value: string, fieldName?: string): TValue {
  const parsed = JSON.parse(value) as unknown;

  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error(fieldName ? `${fieldName} must be a JSON object.` : "Expected JSON object record.");
  }

  return parsed as TValue;
}

export function parseJsonArray(value: string, fieldName?: string): readonly string[] {
  const parsed = JSON.parse(value) as unknown;

  if (!Array.isArray(parsed) || parsed.some((item) => typeof item !== "string")) {
    throw new Error(fieldName ? `${fieldName} must be a JSON string array.` : "Expected JSON string array.");
  }

  return parsed as readonly string[];
}
