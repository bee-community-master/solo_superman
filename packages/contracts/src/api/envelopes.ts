import type { SchemaVersion } from "../ids";
import type { ApiError } from "./errors";

export interface ApiResponseMeta {
  readonly requestId: string;
  readonly schemaVersion: SchemaVersion;
}

export interface ApiSuccessEnvelope<TData> {
  readonly ok: true;
  readonly data: TData;
  readonly meta: ApiResponseMeta;
}

export interface ApiErrorEnvelope {
  readonly ok: false;
  readonly error: ApiError;
  readonly meta: ApiResponseMeta;
}
