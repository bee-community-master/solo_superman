import type { SchemaVersion } from "../ids";
import type { ApiError } from "./errors";

export interface ApiSuccessEnvelope<TData> {
  readonly ok: true;
  readonly data: TData;
  readonly schemaVersion: SchemaVersion;
}

export interface ApiErrorEnvelope {
  readonly ok: false;
  readonly error: ApiError;
  readonly schemaVersion: SchemaVersion;
}
