import { createHash } from "node:crypto";
import type {
  BrowserActionExecutionResult,
  BrowserActionPreviewDto,
  BrowserActionTargetDto,
  ExecutionAuthorityBlockReasonDto,
  ExecutionAuthorityRecord
} from "@solo-superman/contracts";
import { containsExecutionAuthoritySecretValueLeak } from "@solo-superman/contracts";

export interface BrowserActionApplyInput {
  readonly record: ExecutionAuthorityRecord;
  readonly idempotencyKey: string;
  readonly targetUrl: string;
  readonly action: BrowserActionPreviewDto;
}

export interface BrowserActionApplyOutput {
  readonly status: BrowserActionExecutionResult["status"];
  readonly target: BrowserActionTargetDto | null;
  readonly action: BrowserActionPreviewDto;
  readonly httpStatusCode: number | null;
  readonly durationMs: number;
  readonly screenshotRefs: readonly string[];
  readonly logRefs: readonly string[];
  readonly blockReasons: readonly ExecutionAuthorityBlockReasonDto[];
  readonly evidenceRefs: readonly string[];
  readonly auditRefs: readonly string[];
}

const LOOPBACK_BROWSER_HOSTS = new Set(["localhost", "127.0.0.1", "::1", "[::1]"]);
const DEFAULT_BROWSER_ACTION_TIMEOUT_MS = 30_000;
const FETCH_LOG_SUMMARY_MAX_CHARS = 2_000;

export function hashBrowserActionPreview(input: {
  readonly targetUrl: string;
  readonly action: BrowserActionPreviewDto;
}) {
  return `sha256:${createHash("sha256").update(stableJson(input)).digest("hex")}`;
}

function stableJson(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map(stableJson).join(",")}]`;
  }

  if (typeof value === "object" && value !== null) {
    const record = value as Readonly<Record<string, unknown>>;

    return `{${Object.keys(record)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${stableJson(record[key])}`)
      .join(",")}}`;
  }

  return JSON.stringify(value);
}

function blockReason(
  code: ExecutionAuthorityBlockReasonDto["code"],
  message: string,
  evidenceRefs: readonly string[] = [`browser_action:${code}`]
): ExecutionAuthorityBlockReasonDto {
  return {
    code,
    message,
    evidenceRefs
  };
}

function browserActionResult(input: {
  readonly status: BrowserActionApplyOutput["status"];
  readonly target?: BrowserActionTargetDto | null;
  readonly action: BrowserActionPreviewDto;
  readonly httpStatusCode?: number | null;
  readonly durationMs?: number;
  readonly screenshotRefs?: readonly string[];
  readonly logRefs?: readonly string[];
  readonly blockReasons?: readonly ExecutionAuthorityBlockReasonDto[];
  readonly evidenceRefs?: readonly string[];
  readonly auditRefs?: readonly string[];
}): BrowserActionApplyOutput {
  return {
    status: input.status,
    target: input.target ?? null,
    action: input.action,
    httpStatusCode: input.httpStatusCode ?? null,
    durationMs: input.durationMs ?? 0,
    screenshotRefs: input.screenshotRefs ?? [],
    logRefs: input.logRefs ?? [],
    blockReasons: input.blockReasons ?? [],
    evidenceRefs: input.evidenceRefs ?? [],
    auditRefs: input.auditRefs ?? []
  };
}

function normalizedLoopbackHostname(hostname: string) {
  return hostname.replace(/^\[(.*)\]$/u, "$1").toLowerCase();
}

export function browserActionTargetFromUrl(
  rawTargetUrl: string
): BrowserActionTargetDto | ExecutionAuthorityBlockReasonDto {
  let url: URL;

  try {
    url = new URL(rawTargetUrl);
  } catch {
    return blockReason("sandbox_failure", "browser_action targetUrl must be an absolute loopback HTTP URL.");
  }

  const normalizedHostname = normalizedLoopbackHostname(url.hostname);

  if (containsExecutionAuthoritySecretValueLeak(rawTargetUrl)) {
    return blockReason(
      "credential_value_required",
      "browser_action targetUrl must not contain credential, token, or secret-like values.",
      ["browser_action:credential_target_url"]
    );
  }

  if (url.protocol !== "http:") {
    return blockReason("sandbox_failure", "browser_action MVP only allows loopback HTTP targets.");
  }

  if (url.username || url.password) {
    return blockReason(
      "credential_value_required",
      "browser_action targetUrl must not include username, password, or credential material.",
      ["browser_action:credential_url"]
    );
  }

  if (!LOOPBACK_BROWSER_HOSTS.has(url.hostname) && !LOOPBACK_BROWSER_HOSTS.has(normalizedHostname)) {
    return blockReason(
      "sandbox_failure",
      "browser_action MVP target policy allows only localhost, 127.0.0.1, or ::1 targets.",
      [`browser_action:blocked_target:${url.hostname}`]
    );
  }

  if (!url.port) {
    return blockReason(
      "sandbox_failure",
      "browser_action targetUrl must include an explicit local web or sidecar port.",
      ["browser_action:missing_explicit_port"]
    );
  }

  const port = Number.parseInt(url.port, 10);

  if (!Number.isInteger(port) || port <= 0 || port > 65_535) {
    return blockReason("sandbox_failure", "browser_action targetUrl port must be a valid TCP port.");
  }

  return {
    url: url.toString(),
    origin: url.origin,
    hostname: normalizedHostname,
    port
  };
}

function browserTargetRefMatches(record: ExecutionAuthorityRecord, target: BrowserActionTargetDto) {
  const browserTargetRef = record.requestedScope.browserTargetRef;

  if (!browserTargetRef) {
    return false;
  }

  const acceptedRefs = new Set([
    target.url,
    target.origin,
    `browser_target:${target.url}`,
    `browser_target:${target.origin}`
  ]);

  return acceptedRefs.has(browserTargetRef);
}

function browserActionPolicyBlockReasons(
  action: BrowserActionPreviewDto
): readonly ExecutionAuthorityBlockReasonDto[] {
  const reasons: ExecutionAuthorityBlockReasonDto[] = [];

  if (action.kind !== "navigate_and_capture") {
    reasons.push(blockReason("sandbox_failure", "browser_action MVP only supports navigate_and_capture previews."));
  }

  if (action.visibleAction !== true) {
    reasons.push(blockReason("sandbox_failure", "browser_action execution requires an explicitly visible action."));
  }

  if (action.credentialMode !== "none") {
    reasons.push(
      blockReason(
        "credential_value_required",
        "browser_action execution cannot request credential/session custody or credential entry.",
        ["browser_action:credential_mode"]
      )
    );
  }

  if (action.externalMutation !== "blocked") {
    reasons.push(
      blockReason(
        "sandbox_failure",
        "browser_action execution cannot approve external-production mutation in the MVP.",
        ["browser_action:external_mutation"]
      )
    );
  }

  if (containsExecutionAuthoritySecretValueLeak(action)) {
    reasons.push(
      blockReason(
        "credential_value_required",
        "browser_action preview action appears to contain credential or secret values.",
        ["browser_action:credential_action"]
      )
    );
  }

  return reasons;
}

function browserActionTimeoutMs(record: ExecutionAuthorityRecord) {
  return Math.min(
    record.requestedScope.maxDurationMs ?? DEFAULT_BROWSER_ACTION_TIMEOUT_MS,
    DEFAULT_BROWSER_ACTION_TIMEOUT_MS
  );
}

function fetchLogRef(input: {
  readonly idempotencyKey: string;
  readonly target: BrowserActionTargetDto;
  readonly status: number | null;
  readonly contentType: string | null;
  readonly bodyPreview: string;
}) {
  return [
    `browser_action:log:${input.idempotencyKey}`,
    `target=${input.target.origin}`,
    `status=${input.status ?? "null"}`,
    `content-type=${input.contentType ?? "unknown"}`,
    `body-chars=${input.bodyPreview.length}`
  ].join("|");
}

async function readResponseBodyPreview(response: Response) {
  if (!response.body) {
    return "";
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let bodyPreview = "";

  try {
    while (bodyPreview.length < FETCH_LOG_SUMMARY_MAX_CHARS) {
      const { done, value } = await reader.read();

      if (done) {
        break;
      }

      bodyPreview += decoder.decode(value, { stream: true });

      if (bodyPreview.length >= FETCH_LOG_SUMMARY_MAX_CHARS) {
        await reader.cancel().catch(() => undefined);
        break;
      }
    }

    bodyPreview += decoder.decode();
  } finally {
    reader.releaseLock();
  }

  return bodyPreview.slice(0, FETCH_LOG_SUMMARY_MAX_CHARS);
}

async function fetchLocalTarget(input: {
  readonly target: BrowserActionTargetDto;
  readonly timeoutMs: number;
}): Promise<{
  readonly status: number | null;
  readonly contentType: string | null;
  readonly durationMs: number;
  readonly ok: boolean;
  readonly bodyPreview: string;
  readonly timedOut: boolean;
  readonly errorMessage?: string;
}> {
  const controller = new AbortController();
  const startedAt = Date.now();
  const timeout = setTimeout(() => controller.abort(), input.timeoutMs);

  try {
    const response = await fetch(input.target.url, {
      method: "GET",
      redirect: "manual",
      signal: controller.signal
    });
    const bodyPreview = await readResponseBodyPreview(response);

    return {
      status: response.status,
      contentType: response.headers.get("content-type"),
      durationMs: Date.now() - startedAt,
      ok: response.ok,
      bodyPreview,
      timedOut: false
    };
  } catch (error) {
    const timedOut = error instanceof Error && error.name === "AbortError";

    return {
      status: null,
      contentType: null,
      durationMs: Date.now() - startedAt,
      ok: false,
      bodyPreview: "",
      timedOut,
      errorMessage: error instanceof Error ? error.message : "browser_action local target fetch failed."
    };
  } finally {
    clearTimeout(timeout);
  }
}

export async function runBrowserAction(input: BrowserActionApplyInput): Promise<BrowserActionApplyOutput> {
  if (input.record.actionClass !== "browser_action") {
    return browserActionResult({
      status: "blocked",
      action: input.action,
      blockReasons: [blockReason("sandbox_failure", "Only browser_action authority records can run the browser adapter.")]
    });
  }

  const computedHash = hashBrowserActionPreview({
    targetUrl: input.targetUrl,
    action: input.action
  });

  if (computedHash !== input.record.previewArtifactHash) {
    return browserActionResult({
      status: "blocked",
      action: input.action,
      blockReasons: [
        blockReason(
          "preview_hash_mismatch",
          "Browser action preview hash does not match the approved preview artifact hash."
        )
      ]
    });
  }

  if (!input.record.rollbackReference) {
    return browserActionResult({
      status: "blocked",
      action: input.action,
      blockReasons: [blockReason("missing_rollback", "browser_action execution requires a reset/rollback reference.")]
    });
  }

  if (input.record.rollbackReference.kind !== "browser_state_reset") {
    return browserActionResult({
      status: "blocked",
      action: input.action,
      blockReasons: [blockReason("missing_rollback", "browser_action rollback must be browser_state_reset.")]
    });
  }

  const target = browserActionTargetFromUrl(input.targetUrl);

  if ("code" in target) {
    return browserActionResult({
      status: "blocked",
      action: input.action,
      blockReasons: [target]
    });
  }

  if (!browserTargetRefMatches(input.record, target)) {
    return browserActionResult({
      status: "blocked",
      target,
      action: input.action,
      blockReasons: [blockReason("sandbox_failure", "targetUrl does not match the approved authority browserTargetRef.")]
    });
  }

  const actionPolicyBlockReasons = browserActionPolicyBlockReasons(input.action);

  if (actionPolicyBlockReasons.length) {
    return browserActionResult({
      status: "blocked",
      target,
      action: input.action,
      blockReasons: actionPolicyBlockReasons
    });
  }

  const timeoutMs = browserActionTimeoutMs(input.record);
  const fetched = await fetchLocalTarget({
    target,
    timeoutMs
  });
  const screenshotRefs = [`browser_action:screenshot:${input.idempotencyKey}`];
  const logRefs = [
    fetchLogRef({
      idempotencyKey: input.idempotencyKey,
      target,
      status: fetched.status,
      contentType: fetched.contentType,
      bodyPreview: fetched.bodyPreview
    })
  ];
  const evidenceRefs = [
    `browser_action:preview_hash:${computedHash}`,
    `browser_action:target:${target.origin}`,
    `browser_action:http_status:${fetched.status ?? "null"}`,
    `browser_action:duration_ms:${fetched.durationMs}`,
    ...screenshotRefs,
    ...logRefs
  ];

  if (fetched.timedOut) {
    return browserActionResult({
      status: "failed",
      target,
      action: input.action,
      httpStatusCode: fetched.status,
      durationMs: fetched.durationMs,
      screenshotRefs,
      logRefs,
      blockReasons: [blockReason("sandbox_failure", "browser_action local target timed out before capture.")],
      evidenceRefs,
      auditRefs: [`audit:browser_action:${input.idempotencyKey}`]
    });
  }

  if (!fetched.ok) {
    return browserActionResult({
      status: "failed",
      target,
      action: input.action,
      httpStatusCode: fetched.status,
      durationMs: fetched.durationMs,
      screenshotRefs,
      logRefs,
      blockReasons: fetched.errorMessage
        ? [blockReason("sandbox_failure", fetched.errorMessage, ["browser_action:fetch_failed"])]
        : [],
      evidenceRefs,
      auditRefs: [`audit:browser_action:${input.idempotencyKey}`]
    });
  }

  return browserActionResult({
    status: "completed",
    target,
    action: input.action,
    httpStatusCode: fetched.status,
    durationMs: fetched.durationMs,
    screenshotRefs,
    logRefs,
    evidenceRefs,
    auditRefs: [`audit:browser_action:${input.idempotencyKey}`]
  });
}
