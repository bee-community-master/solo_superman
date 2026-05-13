import { describe, expect, it } from "vitest";
import {
  CONTRACT_SCHEMA_VERSION,
  SERVICE_PAGE_USE_PERMISSION_BLOCKED_ACTION_CLASSES,
  type CommandId,
  type CorrelationId,
  type ProductEngineCommand,
  type ProjectId,
  type SessionId,
  type StateVersion
} from "@solo-superman/contracts";
import { createInitialProductEngineState, reduceProductEngineCommand } from "./index";

const projectId = "proj_service_page_permission_core" as ProjectId;
const sessionId = "sess_service_page_permission_core" as SessionId;

function command(
  payload: ProductEngineCommand["payload"],
  expectedStateVersion: StateVersion = 0 as StateVersion
): ProductEngineCommand {
  return {
    commandId: `cmd_service_page_permission_${expectedStateVersion}` as CommandId,
    commandType: "CreateServicePageUsePermission",
    projectId,
    sessionId,
    actor: "product_engine",
    issuedAt: "2026-05-13T00:00:00.000Z",
    idempotencyKey: `CreateServicePageUsePermission:${expectedStateVersion}`,
    expectedStateVersion,
    causationId: null,
    correlationId: "corr_service_page_permission" as CorrelationId,
    schemaVersion: CONTRACT_SCHEMA_VERSION,
    payload
  };
}

function revokeCommand(
  payload: ProductEngineCommand["payload"],
  expectedStateVersion: StateVersion = 1 as StateVersion
): ProductEngineCommand {
  return {
    ...command(payload, expectedStateVersion),
    commandId: `cmd_service_page_permission_revoke_${expectedStateVersion}` as CommandId,
    commandType: "RevokeServicePageUsePermission",
    idempotencyKey: `RevokeServicePageUsePermission:${expectedStateVersion}`
  };
}

function readyPayload(overrides: ProductEngineCommand["payload"] = {}): ProductEngineCommand["payload"] {
  return {
    serviceName: "Vercel",
    serviceOrigin: "https://vercel.com",
    pageUrl: "https://vercel.com/new",
    purpose: "Read and preview deployment setup fields while the user stays present and logged in.",
    allowedActionClasses: ["read", "preview"],
    blockedActionClasses: SERVICE_PAGE_USE_PERMISSION_BLOCKED_ACTION_CLASSES,
    dataCategories: ["public_page_content", "user_provided_project_context", "prompt_result_screenshot_log_refs"],
    approvalGranularity: "per_page",
    approvalDecision: "approved",
    userApprovalRef: "user_approval:service-page:vercel",
    promptPreviewRef: "prompt_preview_service_page_vercel",
    redactionPreviewRef: "redaction_preview_service_page_vercel",
    userExportDeleteControls: true,
    screenshotRefs: ["screenshot:vercel-setup"],
    logRefs: ["log:vercel-setup"],
    evidenceRefs: ["evidence:vercel-setup"],
    auditRefs: ["audit:vercel-setup"],
    activityFeedRefs: ["setup_step:vercel-deploy-settings"],
    ...overrides
  };
}

describe("CreateServicePageUsePermission reducer", () => {
  it("grants read/preview page-use permission without credential custody or side effects", () => {
    const reduction = reduceProductEngineCommand(
      command(readyPayload()),
      createInitialProductEngineState(projectId, sessionId)
    );

    expect(reduction.accepted).toBe(true);
    expect(reduction.events[0]).toMatchObject({
      eventType: "ServicePagePermissionGranted",
      payload: expect.objectContaining({
        serviceName: "Vercel",
        serviceOrigin: "https://vercel.com",
        status: "granted"
      })
    });
    expect(reduction.immediateProjection).toMatchObject({
      kind: "ServicePageUsePermissionProjection",
          currentStatus: "granted",
          latestPermission: expect.objectContaining({
            serviceOrigin: "https://vercel.com",
            pageUrl: "https://vercel.com/new",
            allowedActionClasses: ["read", "preview"],
            userApprovalRef: "user_approval:service-page:vercel",
            credentialEntryDelegated: false,
        userPresentLoginRequired: true,
        canRevoke: true
      })
    });
    expect(reduction.effectPlan).toEqual([]);
  });

  it("blocks fill-draft when approval is broader than per-action", () => {
    const reduction = reduceProductEngineCommand(
      command(readyPayload({
        allowedActionClasses: ["read", "fill_draft"],
        approvalGranularity: "per_setup_step"
      })),
      createInitialProductEngineState(projectId, sessionId)
    );

    expect(reduction.accepted).toBe(true);
    expect(reduction.events[0]).toMatchObject({ eventType: "ServicePageActionBlocked" });
    expect(reduction.immediateProjection).toMatchObject({
      currentStatus: "blocked",
      latestPermission: {
        blockReasons: expect.arrayContaining([
          expect.objectContaining({ code: "fill_draft_requires_per_action" })
        ]),
        canRevoke: false
      }
    });
  });

  it("blocks final-submit requests without confirmation card and execution authority linkage", () => {
    const reduction = reduceProductEngineCommand(
      command(readyPayload({
        allowedActionClasses: ["final_submit_request"],
        approvalGranularity: "per_action",
        finalSubmitRequested: true
      })),
      createInitialProductEngineState(projectId, sessionId)
    );

    expect(reduction.accepted).toBe(true);
    expect(reduction.events[0]).toMatchObject({ eventType: "ServicePageActionBlocked" });
    expect(reduction.immediateProjection).toMatchObject({
      currentStatus: "blocked",
      latestPermission: {
        finalSubmitBoundary: {
          requested: true,
          confirmationCardRef: null,
          executionAuthorityRef: null,
          productionMutationPerformed: false
        },
        blockReasons: expect.arrayContaining([
          expect.objectContaining({ code: "final_submit_requires_confirmation_and_authority" })
        ])
      }
    });
  });

  it("keeps final-submit blocked even when arbitrary confirmation and authority refs are supplied", () => {
    const reduction = reduceProductEngineCommand(
      command(readyPayload({
        allowedActionClasses: ["final_submit_request"],
        approvalGranularity: "per_action",
        finalSubmitRequested: true,
        finalSubmitConfirmationRef: "confirmation_card_fake",
        finalSubmitExecutionAuthorityRef: "exec_auth_fake"
      })),
      createInitialProductEngineState(projectId, sessionId)
    );

    expect(reduction.accepted).toBe(true);
    expect(reduction.immediateProjection).toMatchObject({
      currentStatus: "blocked",
      latestPermission: {
        finalSubmitBoundary: {
          requested: true,
          confirmationCardRef: "confirmation_card_fake",
          executionAuthorityRef: "exec_auth_fake",
          productionMutationPerformed: false
        },
        blockReasons: expect.arrayContaining([
          expect.objectContaining({ code: "final_submit_requires_confirmation_and_authority" })
        ])
      }
    });
  });

  it("blocks page URLs that do not match the approved service origin", () => {
    const reduction = reduceProductEngineCommand(
      command(readyPayload({ pageUrl: "https://attacker.example/phish" })),
      createInitialProductEngineState(projectId, sessionId)
    );

    expect(reduction.accepted).toBe(true);
    expect(reduction.immediateProjection).toMatchObject({
      currentStatus: "blocked",
      latestPermission: {
        pageUrl: "https://attacker.example/phish",
        blockReasons: expect.arrayContaining([
          expect.objectContaining({ code: "invalid_page_url" })
        ])
      }
    });
  });

  it("rejects missing explicit user approval evidence before grant", () => {
    const reduction = reduceProductEngineCommand(
      command({
        ...readyPayload(),
        approvalDecision: undefined,
        userApprovalRef: undefined
      }),
      createInitialProductEngineState(projectId, sessionId)
    );

    expect(reduction.accepted).toBe(false);
    expect(reduction.rejectionReason).toMatchObject({
      code: "VALIDATION_FAILED",
      message: "CreateServicePageUsePermission payload is invalid."
    });
  });

  it("rejects credential-shaped values before they enter permission storage", () => {
    const reduction = reduceProductEngineCommand(
      command(readyPayload({ credentialPassword: "secret_password=abc123" })),
      createInitialProductEngineState(projectId, sessionId)
    );

    expect(reduction.accepted).toBe(false);
    expect(reduction.rejectionReason).toMatchObject({
      code: "VALIDATION_FAILED",
      message: "CreateServicePageUsePermission payload contains unsupported keys."
    });

    const secretValueReduction = reduceProductEngineCommand(
      command(readyPayload({ purpose: "Use password=abc123 to keep the user logged in." })),
      createInitialProductEngineState(projectId, sessionId)
    );

    expect(secretValueReduction.accepted).toBe(false);
    expect(secretValueReduction.rejectionReason).toMatchObject({
      code: "VALIDATION_FAILED",
      message: "CreateServicePageUsePermission payload must not contain credential, session, token, or secret values."
    });

    const sessionCookieReduction = reduceProductEngineCommand(
      command(readyPayload({ purpose: "Keep session_cookie=abcd1234 in retained evidence." })),
      createInitialProductEngineState(projectId, sessionId)
    );

    expect(sessionCookieReduction.accepted).toBe(false);
    expect(sessionCookieReduction.rejectionReason).toMatchObject({
      code: "VALIDATION_FAILED",
      message: "CreateServicePageUsePermission payload must not contain credential, session, token, or secret values."
    });
  });
});

describe("RevokeServicePageUsePermission reducer", () => {
  it("revokes the latest service page-use permission and blocks further page actions", () => {
    const state = createInitialProductEngineState(projectId, sessionId);
    const granted = reduceProductEngineCommand(command(readyPayload()), state);
    const replayed = {
      ...state,
      ...granted.nextState
    };
    const permissionId = replayed.servicePageUsePermission?.latestPermission.permissionId;

    expect(permissionId).toBeTruthy();

    const revoked = reduceProductEngineCommand(
      revokeCommand({
        permissionId,
        reason: "User stopped the Vercel setup page-use permission.",
        auditRefs: ["audit:service-page-revoke"]
      }),
      replayed
    );

    expect(revoked.accepted).toBe(true);
    expect(revoked.events[0]).toMatchObject({ eventType: "ServicePagePermissionRevoked" });
    expect(revoked.immediateProjection).toMatchObject({
      currentStatus: "revoked",
      latestPermission: {
        status: "revoked",
        canRevoke: false,
        blockReasons: expect.arrayContaining([expect.objectContaining({ code: "revoked_by_user" })]),
        auditLog: expect.arrayContaining([expect.objectContaining({ eventType: "ServicePagePermissionRevoked" })])
      }
    });
  });
});
