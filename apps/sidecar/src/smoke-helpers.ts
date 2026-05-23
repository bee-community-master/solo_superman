export type JsonRecord = Readonly<Record<string, unknown>>;

export interface SmokeRequestApp {
  request(path: string, init?: RequestInit): Response | Promise<Response>;
}

function isJsonRecord(value: unknown): value is JsonRecord {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

export function authHeaders(token: string) {
  return {
    Authorization: `Bearer ${token}`
  };
}

export async function jsonEnvelope(response: Response, label: string) {
  const body = (await response.json()) as JsonRecord;

  if (response.status < 200 || response.status >= 300) {
    throw new Error(`${label} failed with HTTP ${response.status}: ${JSON.stringify(body)}`);
  }

  return body;
}

export function dataRecord(body: JsonRecord, label: string) {
  if (body.ok !== true || !isJsonRecord(body.data)) {
    throw new Error(`${label} did not return an ok data envelope.`);
  }

  return body.data;
}

export async function postJson(
  app: SmokeRequestApp,
  path: string,
  localCapabilityToken: string,
  body: Readonly<Record<string, unknown>>
) {
  const response = await app.request(path, {
    method: "POST",
    headers: {
      ...authHeaders(localCapabilityToken),
      "Content-Type": "application/json"
    },
    body: JSON.stringify(body)
  });
  const data = dataRecord(await jsonEnvelope(response, path), path);

  if (data.category === "rejected") {
    throw new Error(`${path} rejected: ${JSON.stringify(data.error ?? data)}`);
  }

  return data;
}

export async function getJson(app: SmokeRequestApp, path: string, localCapabilityToken: string) {
  const response = await app.request(path, {
    headers: authHeaders(localCapabilityToken)
  });

  return dataRecord(await jsonEnvelope(response, path), path);
}

export function objectAt(value: unknown, label: string) {
  if (!isJsonRecord(value)) {
    throw new Error(`${label} must be a record object; received ${JSON.stringify(value)}.`);
  }

  return value;
}

export function recordArray(value: unknown, label: string) {
  if (!Array.isArray(value) || value.some((item) => !isJsonRecord(item))) {
    throw new Error(`${label} must be an array of record objects.`);
  }

  return value as readonly JsonRecord[];
}

export function firstRecord(value: unknown, label: string) {
  const first = recordArray(value, label)[0];

  if (!first) {
    throw new Error(`${label} must not be empty.`);
  }

  return first;
}

export function lastRecord(value: unknown, label: string) {
  const last = recordArray(value, label).at(-1);

  if (!last) {
    throw new Error(`${label} must not be empty.`);
  }

  return last;
}

export function stringAt(value: unknown, label: string) {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`${label} must be a non-empty string.`);
  }

  return value;
}
