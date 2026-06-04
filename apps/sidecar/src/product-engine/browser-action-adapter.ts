import { createHash } from "node:crypto";
import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import type { LookupAddress } from "node:dns";
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
const PUBLIC_READ_BLOCKED_HOST_SUFFIXES = [".local", ".localhost", ".lan", ".home", ".internal", ".invalid"] as const;
const DEFAULT_BROWSER_ACTION_TIMEOUT_MS = 30_000;
const FETCH_LOG_SUMMARY_MAX_CHARS = 2_000;

type BrowserActionDnsLookup = (hostname: string) => Promise<readonly Pick<LookupAddress, "address" | "family">[]>;

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

function normalizedHostname(hostname: string) {
  return hostname.replace(/^\[(.*)\]$/u, "$1").toLowerCase();
}

function isLoopbackHostname(hostname: string) {
  const normalized = normalizedHostname(hostname);

  return LOOPBACK_BROWSER_HOSTS.has(hostname) || LOOPBACK_BROWSER_HOSTS.has(normalized);
}

function isPublicReadHostname(hostname: string) {
  const normalized = normalizedHostname(hostname);

  if (isLoopbackHostname(normalized) || isIP(normalized) !== 0) {
    return false;
  }

  if (!normalized.includes(".")) {
    return false;
  }

  return !PUBLIC_READ_BLOCKED_HOST_SUFFIXES.some((suffix) => normalized.endsWith(suffix));
}

function isNonPublicIpv4Address(hostname: string) {
  const parts = hostname.split(".").map((part) => Number.parseInt(part, 10));

  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) {
    return false;
  }

  const [first = 0, second = 0] = parts;

  return (
    first === 0 ||
    first === 10 ||
    first === 127 ||
    (first === 100 && second >= 64 && second <= 127) ||
    (first === 169 && second === 254) ||
    (first === 172 && second >= 16 && second <= 31) ||
    (first === 192 && second === 168) ||
    (first === 198 && (second === 18 || second === 19)) ||
    first >= 224
  );
}

function ipv4AddressFromIpv6Suffix(suffix: string) {
  if (isIP(suffix) === 4) {
    return suffix;
  }

  const hextets = suffix.split(":");

  if (hextets.length !== 2 || hextets.some((hextet) => !/^[\da-f]{1,4}$/iu.test(hextet))) {
    return null;
  }

  const [high = Number.NaN, low = Number.NaN] = hextets.map((hextet) => Number.parseInt(hextet, 16));

  if (!Number.isInteger(high) || !Number.isInteger(low)) {
    return null;
  }

  return `${Math.floor(high / 256)}.${high % 256}.${Math.floor(low / 256)}.${low % 256}`;
}

function ipv4AddressFromEmbeddedIpv6(hostname: string) {
  if (hostname.startsWith("::ffff:")) {
    return ipv4AddressFromIpv6Suffix(hostname.slice("::ffff:".length));
  }

  if (hostname.startsWith("::")) {
    return ipv4AddressFromIpv6Suffix(hostname.slice("::".length));
  }

  return null;
}

function firstIpv6Hextet(hostname: string) {
  const [first] = hostname.split(":");

  if (!first || !/^[\da-f]{1,4}$/iu.test(first)) {
    return null;
  }

  return Number.parseInt(first, 16);
}

function isNonPublicIpv6Address(hostname: string) {
  const embeddedIpv4 = ipv4AddressFromEmbeddedIpv6(hostname);
  const first = firstIpv6Hextet(hostname);
  const isLinkLocal = first !== null && first >= 0xfe80 && first <= 0xfebf;
  const isUniqueLocal = first !== null && first >= 0xfc00 && first <= 0xfdff;
  const isMulticast = first !== null && first >= 0xff00 && first <= 0xffff;
  const isDiscardOnly = first === 0x0100;

  return (
    Boolean(embeddedIpv4 && isNonPublicIpv4Address(embeddedIpv4)) ||
    hostname === "::" ||
    hostname === "::1" ||
    hostname.startsWith("2001:db8:") ||
    isLinkLocal ||
    isUniqueLocal ||
    isMulticast ||
    isDiscardOnly
  );
}

function isPublicIpAddress(value: string) {
  const hostname = normalizedHostname(value);
  const ipVersion = isIP(hostname);

  if (ipVersion === 4) {
    return !isNonPublicIpv4Address(hostname);
  }

  if (ipVersion === 6) {
    return !isNonPublicIpv6Address(hostname);
  }

  return false;
}

async function lookupBrowserActionTarget(hostname: string) {
  return lookup(hostname, { all: true });
}

export async function publicReadTargetDnsBlockReason(
  target: BrowserActionTargetDto,
  dnsLookup: BrowserActionDnsLookup = lookupBrowserActionTarget
) {
  try {
    const addresses = await dnsLookup(target.hostname);

    if (addresses.length > 0 && addresses.every(({ address }) => isPublicIpAddress(address))) {
      return null;
    }
  } catch {
    return blockReason(
      "sandbox_failure",
      "approved_public_read browser_action target DNS lookup failed before execution.",
      [`browser_action:public_read_dns_lookup_failed:${target.hostname}`]
    );
  }

  return blockReason(
    "sandbox_failure",
    "approved_public_read browser_action target DNS must resolve only to public addresses, not private, loopback, or otherwise non-public addresses.",
    [`browser_action:blocked_public_read_dns:${target.hostname}`]
  );
}

function portForUrl(url: URL) {
  if (url.port) {
    return Number.parseInt(url.port, 10);
  }

  return url.protocol === "https:" ? 443 : 80;
}

export function browserActionTargetFromUrl(
  rawTargetUrl: string,
  networkPolicy: ExecutionAuthorityRecord["sandboxBoundary"]["networkPolicy"] = "loopback_only"
): BrowserActionTargetDto | ExecutionAuthorityBlockReasonDto {
  let url: URL;

  try {
    url = new URL(rawTargetUrl);
  } catch {
    return blockReason("sandbox_failure", "browser_action targetUrl must be an absolute URL.");
  }

  const normalized = normalizedHostname(url.hostname);

  if (containsExecutionAuthoritySecretValueLeak(rawTargetUrl)) {
    return blockReason(
      "credential_value_required",
      "browser_action targetUrl must not contain credential, token, or secret-like values.",
      ["browser_action:credential_target_url"]
    );
  }

  if (url.username || url.password) {
    return blockReason(
      "credential_value_required",
      "browser_action targetUrl must not include username, password, or credential material.",
      ["browser_action:credential_url"]
    );
  }

  if (networkPolicy === "blocked") {
    return blockReason(
      "sandbox_failure",
      "browser_action target policy is blocked by the authority network policy.",
      ["browser_action:network_policy_blocked"]
    );
  }

  if (networkPolicy === "approved_public_read") {
    if (url.protocol !== "https:") {
      return blockReason("sandbox_failure", "approved_public_read browser_action targets must use HTTPS.");
    }

    if (!isPublicReadHostname(url.hostname)) {
      return blockReason(
        "sandbox_failure",
        "approved_public_read browser_action targets must use public DNS hostnames, not loopback, LAN, private, local, or IP literal targets.",
        [`browser_action:blocked_public_read_target:${normalized}`]
      );
    }
  } else {
    if (url.protocol !== "http:") {
      return blockReason("sandbox_failure", "loopback_only browser_action targets must use loopback HTTP URLs.");
    }

    if (!isLoopbackHostname(url.hostname)) {
      return blockReason(
        "sandbox_failure",
        "loopback_only browser_action target policy allows only localhost, 127.0.0.1, or ::1 targets.",
        [`browser_action:blocked_target:${url.hostname}`]
      );
    }

    if (!url.port) {
      return blockReason(
        "sandbox_failure",
        "loopback_only browser_action targetUrl must include an explicit local web or sidecar port.",
        ["browser_action:missing_explicit_port"]
      );
    }
  }

  const port = portForUrl(url);

  if (!Number.isInteger(port) || port <= 0 || port > 65_535) {
    return blockReason("sandbox_failure", "browser_action targetUrl port must be a valid TCP port.");
  }

  return {
    url: url.toString(),
    origin: url.origin,
    hostname: normalized,
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

  const target = browserActionTargetFromUrl(input.targetUrl, input.record.sandboxBoundary.networkPolicy);

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

  const dnsBlockReason =
    input.record.sandboxBoundary.networkPolicy === "approved_public_read"
      ? await publicReadTargetDnsBlockReason(target)
      : null;

  if (dnsBlockReason) {
    return browserActionResult({
      status: "blocked",
      target,
      action: input.action,
      blockReasons: [dnsBlockReason]
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
