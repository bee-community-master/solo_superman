import type { ApiError, ApiErrorEnvelope, ApiSuccessEnvelope, SseEvent } from "@solo-superman/contracts";

type ApiEnvelope<TData> = ApiSuccessEnvelope<TData> | ApiErrorEnvelope;
export type FetchImplementation = (input: string, init?: RequestInit) => Promise<Response>;

const LOOPBACK_URL_HOSTNAMES = new Set(["127.0.0.1", "localhost", "::1", "[::1]"]);

export interface SidecarConnection {
  readonly baseUrl: string;
  readonly localCapabilityToken: string;
  readonly mode: string;
  readonly status: string;
  readonly tokenSource: string;
}

export interface SidecarClientOptions {
  readonly connection: SidecarConnection;
  readonly fetchImpl?: FetchImplementation;
}

export class SidecarClientError extends Error {
  readonly apiError: ApiError;
  readonly httpStatus: number;

  constructor(apiError: ApiError, httpStatus: number) {
    super(apiError.message);
    this.name = "SidecarClientError";
    this.apiError = apiError;
    this.httpStatus = httpStatus;
  }
}

function ensureNoTrailingSlash(value: string) {
  return value.replace(/\/+$/, "");
}

export function apiUrl(baseUrl: string, path: string) {
  const base = new URL(`${ensureNoTrailingSlash(baseUrl)}/`);
  const requestUrl = /^https?:\/\//iu.test(path) ? new URL(path) : new URL(path.startsWith("/") ? path : `/${path}`, base);

  if (requestUrl.origin !== base.origin) {
    throw new Error("Sidecar request URL must stay on the discovered sidecar origin.");
  }

  return requestUrl.toString();
}

function invalidApiResponse(response: Response, message: string) {
  return new SidecarClientError(
    {
      code: "SIDECAR_NOT_READY",
      message
    },
    response.status
  );
}

export async function unwrapEnvelope<TData>(response: Response): Promise<TData> {
  let envelope: ApiEnvelope<TData>;

  try {
    envelope = (await response.json()) as ApiEnvelope<TData>;
  } catch {
    throw invalidApiResponse(response, "Sidecar returned a non-JSON response.");
  }

  if (envelope.ok) {
    return envelope.data;
  }

  throw new SidecarClientError(envelope.error, response.status);
}

export function parseSseEvents(text: string): readonly SseEvent[] {
  return text
    .split(/\n\n+/u)
    .map((frame) =>
      frame
        .split(/\n/u)
        .filter((line) => line.startsWith("data:"))
        .map((line) => line.slice("data:".length).trim())
        .join("\n")
    )
    .filter((payload) => payload.length > 0)
    .map((payload) => JSON.parse(payload) as SseEvent);
}

export async function unwrapSseEvents(response: Response): Promise<readonly SseEvent[]> {
  if (!response.ok) {
    await unwrapEnvelope<never>(response);
  }

  return parseSseEvents(await response.text());
}

export function jsonHeaders(token: string) {
  return {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json"
  };
}

export function authHeaders(token: string) {
  return {
    Authorization: `Bearer ${token}`
  };
}

function envValue(env: Readonly<Record<string, string | boolean | undefined>>, key: string) {
  const value = env[key];

  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

function loopbackHttpBaseUrl(value: string) {
  try {
    const url = new URL(value);
    const isLoopbackHost = LOOPBACK_URL_HOSTNAMES.has(url.hostname);
    const hasOnlyOriginParts =
      value === url.origin &&
      url.username.length === 0 &&
      url.password.length === 0 &&
      url.pathname === "/" &&
      url.search.length === 0 &&
      url.hash.length === 0;

    return url.protocol === "http:" && isLoopbackHost && url.port.length > 0 && hasOnlyOriginParts ? url.origin : null;
  } catch {
    return null;
  }
}

export function sidecarConnectionFromEnv(
  env: Readonly<Record<string, string | boolean | undefined>> = import.meta.env
): SidecarConnection | null {
  const localCapabilityToken = envValue(env, "VITE_SOLO_LOCAL_CAPABILITY_TOKEN");

  if (!localCapabilityToken) {
    return null;
  }

  const envBaseUrl = envValue(env, "VITE_SOLO_SIDECAR_BASE_URL");
  const baseUrl = envBaseUrl ? loopbackHttpBaseUrl(envBaseUrl) : null;

  if (!baseUrl) {
    return null;
  }

  return {
    baseUrl,
    localCapabilityToken,
    mode: "vite_env",
    status: "discovered",
    tokenSource: "vite_env"
  };
}

export async function discoverSidecarConnection(): Promise<SidecarConnection | null> {
  return sidecarConnectionFromEnv();
}
