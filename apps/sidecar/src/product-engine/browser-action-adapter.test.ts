import { afterEach, describe, expect, it, vi } from "vitest";
import { EXECUTION_AUTHORITY_SCHEMA_VERSION, type BrowserActionPreviewDto, type ExecutionAuthorityRecord } from "@solo-superman/contracts";
import { browserActionTargetFromUrl, hashBrowserActionPreview, runBrowserAction } from "./browser-action-adapter";

const SAFE_ACTION = {
  kind: "navigate_and_capture",
  visibleAction: true,
  credentialMode: "none",
  externalMutation: "blocked"
} as const satisfies BrowserActionPreviewDto;

afterEach(() => {
  vi.restoreAllMocks();
});

function approvedBrowserRecord(targetUrl: string, overrides: Partial<ExecutionAuthorityRecord> = {}): ExecutionAuthorityRecord {
  const previewArtifactHash = hashBrowserActionPreview({ targetUrl, action: SAFE_ACTION });

  return {
    recordId: "exec_auth_public_read_test",
    sourcePlanningHandoffRef: "planning_handoff_public_read_test",
    boundedAgentOutputId: "bounded_output_public_read_test",
    actionClass: "browser_action",
    previewArtifactRef: "preview_public_read_test",
    previewArtifactHash,
    reviewedPreviewArtifactHash: previewArtifactHash,
    requestedScope: {
      browserTargetRef: `browser_target:${new URL(targetUrl).origin}`,
      maxDurationMs: 1_000
    },
    approvalDecision: "approved",
    approver: {
      actorId: "browser_public_read_owner",
      actorType: "user",
      approvedAt: "2026-05-24T00:00:00.000Z",
      decidedAt: "2026-05-24T00:00:00.000Z"
    },
    sandboxBoundary: {
      mode: "browser_preview_session",
      networkPolicy: "approved_public_read",
      secretPolicy: "no_secret_values"
    },
    rollbackReference: {
      kind: "browser_state_reset",
      ref: "rollback_public_read_test"
    },
    executionResult: "not_run",
    blockReasons: [],
    evidenceRefs: ["browser_action:public_read:test"],
    auditRefs: ["audit:browser_action:public_read:test"],
    createdAt: "2026-05-24T00:00:00.000Z",
    schemaVersion: EXECUTION_AUTHORITY_SCHEMA_VERSION,
    ...overrides
  };
}

describe("browser action public-read target policy", () => {
  it("keeps default loopback-only parsing strict", () => {
    const target = browserActionTargetFromUrl("https://research.example.com/path");

    expect(target).toMatchObject({
      code: "sandbox_failure",
      message: expect.stringContaining("loopback_only")
    });
  });

  it("accepts approved public-read HTTPS DNS targets", () => {
    const target = browserActionTargetFromUrl("https://research.example.com/path", "approved_public_read");

    expect(target).toMatchObject({
      url: "https://research.example.com/path",
      origin: "https://research.example.com",
      hostname: "research.example.com",
      port: 443
    });
  });

  it("blocks public-read targets that are local, private, IP literal, non-HTTPS, or credential-bearing", () => {
    for (const targetUrl of [
      "http://research.example.com/path",
      "https://127.0.0.1:4173/path",
      "https://192.168.0.5/path",
      "https://localhost:4173/path",
      "https://internal/path",
      "https://service.local/path",
      "https://user:pass@research.example.com/path",
      "https://research.example.com/path?token=plain-secret-value"
    ]) {
      const target = browserActionTargetFromUrl(targetUrl, "approved_public_read");

      expect(target).toHaveProperty("code");
    }
  });

  it("runs approved public-read browser actions without external mutation or credential custody", async () => {
    const targetUrl = "https://research.example.com/path";
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response("<main>public read fixture</main>", {
        status: 200,
        headers: { "content-type": "text/html" }
      })
    );

    const result = await runBrowserAction({
      record: approvedBrowserRecord(targetUrl),
      idempotencyKey: "browser-action:public-read",
      targetUrl,
      action: SAFE_ACTION
    });

    expect(fetchMock).toHaveBeenCalledWith("https://research.example.com/path", expect.objectContaining({
      method: "GET",
      redirect: "manual"
    }));
    expect(result).toMatchObject({
      status: "completed",
      target: {
        origin: "https://research.example.com",
        hostname: "research.example.com",
        port: 443
      },
      httpStatusCode: 200,
      blockReasons: []
    });
    expect(result.evidenceRefs).toEqual(expect.arrayContaining([
      "browser_action:target:https://research.example.com",
      "browser_action:http_status:200"
    ]));
  });
});
