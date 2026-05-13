export function requiredString(value: unknown) {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

export function hasOwnRecordKey(record: Readonly<Record<string, unknown>>, key: string) {
  return Object.prototype.hasOwnProperty.call(record, key);
}

export function hasOnlyRecordKeys(record: Readonly<Record<string, unknown>>, allowedKeys: readonly string[]) {
  return Object.keys(record).every((key) => allowedKeys.includes(key));
}

export function uniqueStrings(values: readonly string[]) {
  return [...new Set(values)];
}

export function uniqueStringRefs(values: readonly string[]) {
  return [...new Set(values.filter((value) => value.trim().length > 0))];
}

export function recordFromUnknown(value: unknown): Readonly<Record<string, unknown>> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Readonly<Record<string, unknown>>) : null;
}

export function stringArray(value: unknown, allowEmpty: boolean) {
  if (!Array.isArray(value)) {
    return null;
  }

  const strings = value.map((item) => requiredString(item));

  return (allowEmpty || strings.length > 0) && strings.every(Boolean) ? (strings as readonly string[]) : null;
}

export function requiredStringArray(value: unknown) {
  return stringArray(value, false);
}

export function optionalStringArray(value: unknown) {
  if (value === undefined) {
    return [] as const;
  }

  return stringArray(value, true);
}
