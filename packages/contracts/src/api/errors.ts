export type ApiErrorCode =
  | "AUTH_REQUIRED"
  | "VALIDATION_FAILED"
  | "IDEMPOTENCY_CONFLICT"
  | "RESOURCE_NOT_FOUND"
  | "COMMAND_PRECONDITION_FAILED"
  | "STATE_VERSION_CONFLICT"
  | "RUNTIME_UNAVAILABLE"
  | "RUNTIME_ACTION_BLOCKED"
  | "SIDECAR_NOT_READY"
  | "STREAM_SESSION_REQUIRED"
  | "EFFECT_STATUS_UNAVAILABLE";

export interface ApiError {
  readonly code: ApiErrorCode;
  readonly message: string;
  readonly details?: Readonly<Record<string, unknown>>;
}
