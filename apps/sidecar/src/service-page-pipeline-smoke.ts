import { randomUUID } from "node:crypto";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import {
  SERVICE_PAGE_USE_PERMISSION_BLOCKED_ACTION_CLASSES,
  type BrowserActionPreviewDto,
  type ServicePageUseActionClass
} from "@solo-superman/contracts";
import { applyMigrations, createSoloStorage, localDatabaseUrlFromAppDataDir } from "@solo-superman/db";
import { sessionEventCount } from "./auto-implementation-smoke-fixtures";
import {
  createLocalBrowserTargetServer,
  requestedMutationBrowserActionPreview,
  safeBrowserActionPreview,
  stringArrayAt
} from "./browser-smoke-helpers";
import { hashBrowserActionPreview } from "./product-engine/browser-action-adapter";
import { createSidecarApp } from "./server";
import {
  getJson,
  objectAt,
  postJson,
  recordArray,
  stringAt,
  type JsonRecord,
  type SmokeRequestApp
} from "./smoke-helpers";

export const SERVICE_PAGE_PIPELINE_SMOKE = "service_page_pipeline" as const;

const PROJECT_IDEA = "A service page-use pipeline smoke idea for founder validation.";
const SERVICE_NAME = "Vercel";
const SERVICE_ORIGIN = "https://vercel.com";
const SERVICE_PAGE_URL = "https://vercel.com/new";
const MOCK_SERVICE_PAGE = [
  "<!doctype html>",
  "<title>Mock Vercel setup page</title>",
  '<main data-service-page-state="ready">User-owned Vercel setup page mock with visible fields</main>'
].join("");
const EXECUTION_WINDOW = {
  requestedAt: "2026-05-23T02:00:00.000Z",
  approvalExpiresAt: "2026-05-23T02:05:00.000Z"
} as const;
const DATA_CATEGORIES = ["public_page_content", "user_provided_project_context", "prompt_result_screenshot_log_refs"] as const;

type SmokeStatus = "blocked" | "passed";

type SmokeStorage = Awaited<ReturnType<typeof createSoloStorage>>;

interface ServicePageScenario {
  readonly storage: SmokeStorage;
  readonly app: SmokeRequestApp;
}

interface ProjectContext {
  readonly projectId: string;
  readonly sessionId: string;
}

interface ServicePageAuthorityScope {
  readonly permissionId?: string;
  readonly actionClass?: ServicePageUseActionClass;
  readonly serviceOrigin?: string;
  readonly servicePageUrl?: string;
}

interface BrowserAuthorityResult {
  readonly browserHash: string;
  readonly browserRecordId: string;
  readonly servicePagePermissionId?: string;
  readonly servicePageActionClass?: ServicePageUseActionClass;
}

interface ServicePageFlowResult {
  readonly project: ProjectContext;
  readonly missingPermissionBrowser: JsonRecord;
  readonly readPermissionId: string;
  readonly readBrowser: JsonRecord;
  readonly readReplayWithoutEcho: JsonRecord;
  readonly artifactDelete: JsonRecord;
  readonly afterArtifactDelete: JsonRecord;
  readonly revokedPermission: JsonRecord;
  readonly afterRevokeBrowser: JsonRecord;
  readonly fillDraftPermissionId: string;
  readonly fillDraftBrowser: JsonRecord;
  readonly finalSubmitBlocked: JsonRecord;
  readonly finalSubmitBrowser: JsonRecord;
}

export interface ServicePagePipelineSmokeEvidence {
  readonly status: SmokeStatus;
  readonly smoke: typeof SERVICE_PAGE_PIPELINE_SMOKE;
  readonly mode: "fixture";
  readonly project?: {
    readonly projectId: string;
    readonly sessionId: string;
  };
  readonly permission?: {
    readonly readPermissionId: string;
    readonly fillDraftPermissionId: string;
    readonly readStatus: string;
    readonly artifactRetention: string;
    readonly revokeStatus: string;
    readonly finalSubmitStatus: string;
  };
  readonly browser?: {
    readonly readStatus: string;
    readonly fillDraftStatus: string;
    readonly missingPermissionStatus: string;
    readonly replayWithoutEchoStatus: string;
    readonly afterRevokeStatus: string;
    readonly finalSubmitBrowserStatus: string;
    readonly readScreenshotRefCount: number;
    readonly readLogRefCount: number;
    readonly readAuditRefCount: number;
  };
  readonly reason?: string;
  readonly blockers?: readonly string[];
  readonly checked: readonly string[];
}

export interface ServicePagePipelineSmokeOptions {
  readonly appDataDir?: string;
  readonly cleanupAppDataDir?: boolean;
  readonly localCapabilityToken?: string;
}

function latestPermissionFromProjection(projection: JsonRecord, label: string) {
  return objectAt(projection.latestPermission, `${label} latestPermission`);
}

function blockReasonsInclude(value: unknown, code: string) {
  return recordArray(value, `${code} blockReasons`).some((reason) => reason.code === code);
}

function createProject(app: SmokeRequestApp, localCapabilityToken: string): Promise<ProjectContext> {
  return postJson(app, "/api/v1/projects", localCapabilityToken, {
    rawIdea: PROJECT_IDEA,
    localPrivacyMode: "local_only",
    projectPurposeMode: "personal",
    projectPurposeModeConfirmation: "user_confirmed"
  }).then((data) => {
    const projection = objectAt(data.immediateProjection, "project immediateProjection");

    return {
      projectId: stringAt(projection.projectId, "projectId"),
      sessionId: stringAt(projection.sessionId, "sessionId")
    };
  });
}

async function createBrowserAuthority(input: {
  readonly scenario: ServicePageScenario;
  readonly localCapabilityToken: string;
  readonly sessionId: string;
  readonly targetUrl: string;
  readonly idSuffix: string;
  readonly action: BrowserActionPreviewDto;
  readonly servicePageScope?: ServicePageAuthorityScope;
}): Promise<BrowserAuthorityResult> {
  const browserHash = hashBrowserActionPreview({ targetUrl: input.targetUrl, action: input.action });
  const expectedStateVersion = await sessionEventCount(input.scenario.storage, input.sessionId);
  const scope = input.servicePageScope ?? {};
  const data = await postJson(
    input.scenario.app,
    `/api/v1/sessions/${input.sessionId}/execution-authority`,
    input.localCapabilityToken,
    {
      sessionId: input.sessionId,
      expectedStateVersion,
      idempotencyKey: `service-page-smoke:authority:${input.idSuffix}`,
      sourcePlanningHandoffRef: `planning_handoff_service_page_${input.idSuffix}`,
      boundedAgentOutput: {
        outputId: `bounded_output_service_page_${input.idSuffix}`,
        sourceRefs: [`planning_handoff_service_page_${input.idSuffix}`],
        intendedDecisionImpact: "Validate the credential-free service page-use permission pipeline smoke.",
        proposedActionPreviewRefs: [`preview_service_page_${input.idSuffix}`],
        requiredApprovals: [`approval_service_page_${input.idSuffix}`],
        evidenceRefs: [`evidence_service_page_${input.idSuffix}`],
        failureMode: "ready_for_preview",
        noExecutionPolicy: "controlled_execution_required"
      },
      actionClass: "browser_action",
      previewArtifactRef: `preview_service_page_${input.idSuffix}`,
      previewArtifactHash: browserHash,
      reviewedPreviewArtifactHash: browserHash,
      requestedScope: {
        browserTargetRef: `browser_target:${input.targetUrl}`,
        ...(scope.permissionId ? { servicePagePermissionId: scope.permissionId } : {}),
        ...(scope.actionClass ? { servicePageActionClass: scope.actionClass } : {}),
        ...(scope.serviceOrigin ? { serviceOrigin: scope.serviceOrigin } : {}),
        ...(scope.servicePageUrl ? { servicePageUrl: scope.servicePageUrl } : {}),
        maxDurationMs: 1_000
      },
      approvalDecision: "approved",
      approver: {
        actorId: "service_page_smoke_owner",
        actorType: "user",
        approvedAt: "2026-05-23T02:00:00.000Z",
        decidedAt: "2026-05-23T02:00:00.000Z"
      },
      sandboxBoundary: {
        mode: "browser_preview_session",
        networkPolicy: "loopback_only",
        secretPolicy: "no_secret_values"
      },
      rollbackReference: {
        kind: "browser_state_reset",
        ref: `rollback_service_page_${input.idSuffix}`
      },
      evidenceRefs: [`service_page_smoke:authority-preview:${input.idSuffix}`],
      auditRefs: [`audit:service-page-smoke:authority:${input.idSuffix}`],
      preconditionChecks: {
        planningSourceExists: true,
        previewArtifactExists: true,
        previewHashMatches: true,
        rollbackAvailable: true,
        credentialValueRequired: false,
        sandboxEnforced: true
      }
    }
  );
  const projection = objectAt(data.immediateProjection, "execution authority projection");
  const latestRecord = objectAt(projection.latestRecord, "execution authority latestRecord");

  return {
    browserHash,
    browserRecordId: stringAt(latestRecord.recordId, "execution authority recordId"),
    ...(scope.permissionId ? { servicePagePermissionId: scope.permissionId } : {}),
    ...(scope.actionClass ? { servicePageActionClass: scope.actionClass } : {})
  };
}

async function runBrowserAction(input: {
  readonly scenario: ServicePageScenario;
  readonly localCapabilityToken: string;
  readonly sessionId: string;
  readonly targetUrl: string;
  readonly authority: BrowserAuthorityResult;
  readonly idempotencyKey: string;
  readonly action: BrowserActionPreviewDto;
  readonly echoServiceScope?: boolean;
}) {
  return postJson(
    input.scenario.app,
    `/api/v1/execution-authorities/${input.authority.browserRecordId}/browser-action`,
    input.localCapabilityToken,
    {
      sessionId: input.sessionId,
      idempotencyKey: input.idempotencyKey,
      previewArtifactHash: input.authority.browserHash,
      ...EXECUTION_WINDOW,
      targetUrl: input.targetUrl,
      action: input.action,
      ...(input.echoServiceScope && input.authority.servicePagePermissionId
        ? { servicePagePermissionId: input.authority.servicePagePermissionId }
        : {}),
      ...(input.echoServiceScope && input.authority.servicePageActionClass
        ? { servicePageActionClass: input.authority.servicePageActionClass }
        : {})
    }
  );
}

function servicePermissionBase(sessionId: string) {
  return {
    sessionId,
    serviceName: SERVICE_NAME,
    serviceOrigin: SERVICE_ORIGIN,
    pageUrl: SERVICE_PAGE_URL,
    purpose: "Use a user-present Vercel setup page to read and preview deployment settings.",
    blockedActionClasses: SERVICE_PAGE_USE_PERMISSION_BLOCKED_ACTION_CLASSES,
    dataCategories: DATA_CATEGORIES,
    approvalDecision: "approved",
    userApprovalRef: "user_approval:service-page:smoke",
    promptPreviewRef: "prompt_preview_service_page_smoke",
    redactionPreviewRef: "redaction_preview_service_page_smoke",
    userExportDeleteControls: true,
    evidenceRefs: ["evidence:service-page-permission:smoke"],
    auditRefs: ["audit:service-page-permission:smoke"],
    activityFeedRefs: ["setup_step:vercel-deploy-settings"]
  } as const;
}

async function createServicePagePermission(input: {
  readonly scenario: ServicePageScenario;
  readonly localCapabilityToken: string;
  readonly sessionId: string;
  readonly idempotencyKey: string;
  readonly allowedActionClasses: readonly ServicePageUseActionClass[];
  readonly approvalGranularity: "per_action" | "per_page" | "per_setup_step";
  readonly purpose?: string;
  readonly finalSubmitRequested?: boolean;
}) {
  const expectedStateVersion = await sessionEventCount(input.scenario.storage, input.sessionId);

  return postJson(
    input.scenario.app,
    `/api/v1/sessions/${input.sessionId}/service-page-use-permissions`,
    input.localCapabilityToken,
    {
      ...servicePermissionBase(input.sessionId),
      expectedStateVersion,
      idempotencyKey: input.idempotencyKey,
      ...(input.purpose ? { purpose: input.purpose } : {}),
      allowedActionClasses: input.allowedActionClasses,
      approvalGranularity: input.approvalGranularity,
      ...(input.finalSubmitRequested
        ? {
            finalSubmitRequested: true,
            finalSubmitConfirmationRef: "confirmation_card_service_page_smoke",
            finalSubmitExecutionAuthorityRef: "execution_authority_service_page_smoke"
          }
        : {})
    }
  );
}

async function deletePermissionArtifacts(input: {
  readonly scenario: ServicePageScenario;
  readonly localCapabilityToken: string;
  readonly sessionId: string;
  readonly permissionId: string;
}) {
  const expectedStateVersion = await sessionEventCount(input.scenario.storage, input.sessionId);

  return postJson(
    input.scenario.app,
    `/api/v1/sessions/${input.sessionId}/service-page-use-permissions/${input.permissionId}/artifacts/delete`,
    input.localCapabilityToken,
    {
      sessionId: input.sessionId,
      expectedStateVersion,
      idempotencyKey: "service-page-smoke:artifacts-delete",
      permissionId: input.permissionId,
      reason: "User deleted retained service page-use artifact refs during the smoke.",
      auditRefs: ["audit:service-page-permission:smoke-artifacts-deleted"]
    }
  );
}

async function revokePermission(input: {
  readonly scenario: ServicePageScenario;
  readonly localCapabilityToken: string;
  readonly sessionId: string;
  readonly permissionId: string;
}) {
  const expectedStateVersion = await sessionEventCount(input.scenario.storage, input.sessionId);

  return postJson(
    input.scenario.app,
    `/api/v1/sessions/${input.sessionId}/service-page-use-permissions/${input.permissionId}/revoke`,
    input.localCapabilityToken,
    {
      sessionId: input.sessionId,
      expectedStateVersion,
      idempotencyKey: "service-page-smoke:revoked",
      permissionId: input.permissionId,
      reason: "User stopped the mocked service page-use permission during the smoke.",
      auditRefs: ["audit:service-page-permission:smoke-revoked"]
    }
  );
}

async function executeServicePageFlow(
  scenario: ServicePageScenario,
  localCapabilityToken: string
): Promise<ServicePageFlowResult> {
  const project = await createProject(scenario.app, localCapabilityToken);
  const browserTarget = await createLocalBrowserTargetServer({
    html: MOCK_SERVICE_PAGE,
    path: "/mock-vercel/setup",
    failureMessage: "Local service page target server did not expose a TCP address."
  });
  const safeAction = safeBrowserActionPreview();

  try {
    const missingPermissionAuthority = await createBrowserAuthority({
      scenario,
      localCapabilityToken,
      sessionId: project.sessionId,
      targetUrl: browserTarget.targetUrl,
      idSuffix: "missing_permission",
      action: safeAction,
      servicePageScope: {
        permissionId: "service_page_permission_missing",
        actionClass: "read",
        serviceOrigin: SERVICE_ORIGIN,
        servicePageUrl: SERVICE_PAGE_URL
      }
    });
    const missingPermissionBrowser = await runBrowserAction({
      scenario,
      localCapabilityToken,
      sessionId: project.sessionId,
      targetUrl: browserTarget.targetUrl,
      authority: missingPermissionAuthority,
      idempotencyKey: "service-page-smoke:browser-missing-permission",
      action: safeAction,
      echoServiceScope: true
    });
    const readPermission = await createServicePagePermission({
      scenario,
      localCapabilityToken,
      sessionId: project.sessionId,
      idempotencyKey: "service-page-smoke:read-preview",
      allowedActionClasses: ["read", "preview"],
      approvalGranularity: "per_page"
    });
    const readPermissionProjection = objectAt(readPermission.immediateProjection, "read permission projection");
    const readPermissionRecord = latestPermissionFromProjection(readPermissionProjection, "read permission");
    const readPermissionId = stringAt(readPermissionRecord.permissionId, "read permissionId");
    const readAuthority = await createBrowserAuthority({
      scenario,
      localCapabilityToken,
      sessionId: project.sessionId,
      targetUrl: browserTarget.targetUrl,
      idSuffix: "read_preview",
      action: safeAction,
      servicePageScope: {
        permissionId: readPermissionId,
        actionClass: "read",
        serviceOrigin: SERVICE_ORIGIN,
        servicePageUrl: SERVICE_PAGE_URL
      }
    });
    const readBrowser = await runBrowserAction({
      scenario,
      localCapabilityToken,
      sessionId: project.sessionId,
      targetUrl: browserTarget.targetUrl,
      authority: readAuthority,
      idempotencyKey: "service-page-smoke:browser-read-preview",
      action: safeAction,
      echoServiceScope: true
    });
    const readReplayWithoutEcho = await runBrowserAction({
      scenario,
      localCapabilityToken,
      sessionId: project.sessionId,
      targetUrl: browserTarget.targetUrl,
      authority: readAuthority,
      idempotencyKey: "service-page-smoke:browser-read-without-echo",
      action: safeAction,
      echoServiceScope: false
    });
    const artifactDelete = await deletePermissionArtifacts({
      scenario,
      localCapabilityToken,
      sessionId: project.sessionId,
      permissionId: readPermissionId
    });
    const afterArtifactDelete = await getJson(
      scenario.app,
      `/api/v1/sessions/${project.sessionId}/service-page-use-permissions`,
      localCapabilityToken
    );
    const revokedPermission = await revokePermission({
      scenario,
      localCapabilityToken,
      sessionId: project.sessionId,
      permissionId: readPermissionId
    });
    const afterRevokeAuthority = await createBrowserAuthority({
      scenario,
      localCapabilityToken,
      sessionId: project.sessionId,
      targetUrl: browserTarget.targetUrl,
      idSuffix: "after_revoke",
      action: safeAction,
      servicePageScope: {
        permissionId: readPermissionId,
        actionClass: "preview",
        serviceOrigin: SERVICE_ORIGIN,
        servicePageUrl: SERVICE_PAGE_URL
      }
    });
    const afterRevokeBrowser = await runBrowserAction({
      scenario,
      localCapabilityToken,
      sessionId: project.sessionId,
      targetUrl: browserTarget.targetUrl,
      authority: afterRevokeAuthority,
      idempotencyKey: "service-page-smoke:browser-after-revoke",
      action: safeAction,
      echoServiceScope: true
    });
    const fillDraftPermission = await createServicePagePermission({
      scenario,
      localCapabilityToken,
      sessionId: project.sessionId,
      idempotencyKey: "service-page-smoke:fill-draft",
      purpose: "Fill a draft deployment settings form while the user stays present and can stop automation.",
      allowedActionClasses: ["fill_draft"],
      approvalGranularity: "per_action"
    });
    const fillDraftProjection = objectAt(fillDraftPermission.immediateProjection, "fill draft permission projection");
    const fillDraftRecord = latestPermissionFromProjection(fillDraftProjection, "fill draft permission");
    const fillDraftPermissionId = stringAt(fillDraftRecord.permissionId, "fill draft permissionId");
    const fillDraftAuthority = await createBrowserAuthority({
      scenario,
      localCapabilityToken,
      sessionId: project.sessionId,
      targetUrl: browserTarget.targetUrl,
      idSuffix: "fill_draft",
      action: safeAction,
      servicePageScope: {
        permissionId: fillDraftPermissionId,
        actionClass: "fill_draft",
        serviceOrigin: SERVICE_ORIGIN,
        servicePageUrl: SERVICE_PAGE_URL
      }
    });
    const fillDraftBrowser = await runBrowserAction({
      scenario,
      localCapabilityToken,
      sessionId: project.sessionId,
      targetUrl: browserTarget.targetUrl,
      authority: fillDraftAuthority,
      idempotencyKey: "service-page-smoke:browser-fill-draft",
      action: safeAction,
      echoServiceScope: true
    });
    const finalSubmitBlocked = await createServicePagePermission({
      scenario,
      localCapabilityToken,
      sessionId: project.sessionId,
      idempotencyKey: "service-page-smoke:final-submit-blocked",
      purpose: "Request final submit for setup without passing production-mutation contract evidence.",
      allowedActionClasses: ["final_submit_request"],
      approvalGranularity: "per_action",
      finalSubmitRequested: true
    });
    const finalSubmitProjection = objectAt(finalSubmitBlocked.immediateProjection, "final submit permission projection");
    const finalSubmitRecord = latestPermissionFromProjection(finalSubmitProjection, "final submit permission");
    const finalSubmitPermissionId = stringAt(finalSubmitRecord.permissionId, "final submit permissionId");
    const finalAction = requestedMutationBrowserActionPreview();
    const finalSubmitAuthority = await createBrowserAuthority({
      scenario,
      localCapabilityToken,
      sessionId: project.sessionId,
      targetUrl: browserTarget.targetUrl,
      idSuffix: "final_submit_blocked",
      action: finalAction,
      servicePageScope: {
        permissionId: finalSubmitPermissionId,
        actionClass: "final_submit_request",
        serviceOrigin: SERVICE_ORIGIN,
        servicePageUrl: SERVICE_PAGE_URL
      }
    });
    const finalSubmitBrowser = await runBrowserAction({
      scenario,
      localCapabilityToken,
      sessionId: project.sessionId,
      targetUrl: browserTarget.targetUrl,
      authority: finalSubmitAuthority,
      idempotencyKey: "service-page-smoke:browser-final-submit-blocked",
      action: finalAction,
      echoServiceScope: true
    });

    return {
      project,
      missingPermissionBrowser,
      readPermissionId,
      readBrowser,
      readReplayWithoutEcho,
      artifactDelete,
      afterArtifactDelete,
      revokedPermission,
      afterRevokeBrowser,
      fillDraftPermissionId,
      fillDraftBrowser,
      finalSubmitBlocked,
      finalSubmitBrowser
    };
  } finally {
    await browserTarget.close();
  }
}

function flowBlockers(result: ServicePageFlowResult) {
  const blockers: string[] = [];
  const readTarget = objectAt(result.readBrowser.target, "read browser target");
  const readScreenshots = stringArrayAt(result.readBrowser.screenshotRefs, "read browser screenshotRefs");
  const readLogs = stringArrayAt(result.readBrowser.logRefs, "read browser logRefs");
  const readAudits = stringArrayAt(result.readBrowser.auditRefs, "read browser auditRefs");
  const artifactDeleteProjection = objectAt(result.artifactDelete.immediateProjection, "artifact delete projection");
  const artifactDeletePermission = latestPermissionFromProjection(artifactDeleteProjection, "artifact delete");
  const retention = objectAt(artifactDeletePermission.artifactRetention, "artifact retention");
  const afterArtifactDeletePermission = latestPermissionFromProjection(result.afterArtifactDelete, "after artifact delete");
  const afterDeleteRetention = objectAt(afterArtifactDeletePermission.artifactRetention, "after delete retention");
  const revokedProjection = objectAt(result.revokedPermission.immediateProjection, "revoked permission projection");
  const revokedPermission = latestPermissionFromProjection(revokedProjection, "revoked permission");
  const finalSubmitProjection = objectAt(result.finalSubmitBlocked.immediateProjection, "final submit projection");
  const finalSubmitPermission = latestPermissionFromProjection(finalSubmitProjection, "final submit permission");

  if (result.missingPermissionBrowser.status !== "blocked") {
    blockers.push("service page browser action must be blocked before a matching permission exists.");
  }

  if (!blockReasonsInclude(result.missingPermissionBrowser.blockReasons, "service_page_permission_required")) {
    blockers.push("missing permission browser action must report service_page_permission_required.");
  }

  if (result.readBrowser.status !== "completed" || readTarget.hostname !== "127.0.0.1") {
    blockers.push("read browser action must complete on loopback.");
  }

  if (!readScreenshots.length || !readLogs.length || !readAudits.length) {
    blockers.push("read browser action must collect screenshot, log, and audit refs.");
  }

  if (result.readReplayWithoutEcho.status !== "blocked") {
    blockers.push("service page browser action must require request echo for scoped permission usage.");
  }

  if (!blockReasonsInclude(result.readReplayWithoutEcho.blockReasons, "service_page_permission_scope_mismatch")) {
    blockers.push("missing service page echo must report service_page_permission_scope_mismatch.");
  }

  if (retention.promptResultScreenshotLogRetention !== "deleted_audit_metadata_only") {
    blockers.push("artifact delete must switch retention to audit-metadata-only.");
  }

  if (afterDeleteRetention.redactionPreviewRef !== null) {
    blockers.push("GET after artifact delete must keep redaction preview refs deleted.");
  }

  if (revokedProjection.currentStatus !== "revoked" || revokedPermission.canRevoke !== false) {
    blockers.push("revoked service page permission must be terminal and not revokable.");
  }

  if (!blockReasonsInclude(revokedPermission.blockReasons, "revoked_by_user")) {
    blockers.push("revoked permission must record revoked_by_user.");
  }

  if (result.afterRevokeBrowser.status !== "blocked") {
    blockers.push("browser action after revoke must be blocked.");
  }

  if (!blockReasonsInclude(result.afterRevokeBrowser.blockReasons, "service_page_permission_revoked")) {
    blockers.push("browser action after revoke must report service_page_permission_revoked.");
  }

  if (result.fillDraftBrowser.status !== "completed") {
    blockers.push("fill_draft browser action must complete when per-action permission is granted.");
  }

  if (finalSubmitProjection.currentStatus !== "blocked") {
    blockers.push("final submit permission must remain blocked without passing production-mutation contract evidence.");
  }

  if (!blockReasonsInclude(finalSubmitPermission.blockReasons, "final_submit_requires_confirmation_and_authority")) {
    blockers.push("final submit permission must report final_submit_requires_confirmation_and_authority.");
  }

  if (result.finalSubmitBrowser.status !== "blocked") {
    blockers.push("final submit browser action must remain blocked.");
  }

  return blockers;
}

function passedEvidence(result: ServicePageFlowResult): ServicePagePipelineSmokeEvidence {
  const readScreenshots = stringArrayAt(result.readBrowser.screenshotRefs, "read browser screenshotRefs");
  const readLogs = stringArrayAt(result.readBrowser.logRefs, "read browser logRefs");
  const readAudits = stringArrayAt(result.readBrowser.auditRefs, "read browser auditRefs");
  const artifactDeleteProjection = objectAt(result.artifactDelete.immediateProjection, "artifact delete projection");
  const artifactDeletePermission = latestPermissionFromProjection(artifactDeleteProjection, "artifact delete");
  const retention = objectAt(artifactDeletePermission.artifactRetention, "artifact retention");
  const revokedProjection = objectAt(result.revokedPermission.immediateProjection, "revoked permission projection");
  const finalSubmitProjection = objectAt(result.finalSubmitBlocked.immediateProjection, "final submit projection");

  return {
    status: "passed",
    smoke: SERVICE_PAGE_PIPELINE_SMOKE,
    mode: "fixture",
    project: result.project,
    permission: {
      readPermissionId: result.readPermissionId,
      fillDraftPermissionId: result.fillDraftPermissionId,
      readStatus: stringAt(artifactDeletePermission.status, "read permission status"),
      artifactRetention: stringAt(retention.promptResultScreenshotLogRetention, "artifact retention status"),
      revokeStatus: stringAt(revokedProjection.currentStatus, "revoke status"),
      finalSubmitStatus: stringAt(finalSubmitProjection.currentStatus, "final submit status")
    },
    browser: {
      readStatus: stringAt(result.readBrowser.status, "read browser status"),
      fillDraftStatus: stringAt(result.fillDraftBrowser.status, "fill draft browser status"),
      missingPermissionStatus: stringAt(result.missingPermissionBrowser.status, "missing permission browser status"),
      replayWithoutEchoStatus: stringAt(result.readReplayWithoutEcho.status, "read replay without echo status"),
      afterRevokeStatus: stringAt(result.afterRevokeBrowser.status, "after revoke browser status"),
      finalSubmitBrowserStatus: stringAt(result.finalSubmitBrowser.status, "final submit browser status"),
      readScreenshotRefCount: readScreenshots.length,
      readLogRefCount: readLogs.length,
      readAuditRefCount: readAudits.length
    },
    checked: [
      "temporary local sidecar and app data created",
      "loopback mock service setup page served without credentials",
      "service page browser action blocks before matching permission exists",
      "approved service page-use permission grants read/preview actions",
      "scoped browser action requires permission/action echo and loopback no-secret boundary",
      "read browser action returns screenshot, log, and audit refs",
      "artifact delete switches retained refs to audit-metadata-only",
      "revoke blocks later browser actions with service_page_permission_revoked",
      "fill_draft action completes only with per-action permission",
      "final-submit request remains blocked without passing production-mutation contract evidence"
    ]
  };
}

function blockedEvidence(result: ServicePageFlowResult, blockers: readonly string[]): ServicePagePipelineSmokeEvidence {
  return {
    ...passedEvidence(result),
    status: "blocked",
    reason: "Service page-use pipeline smoke did not satisfy every critical-path fixture check.",
    blockers
  };
}

function errorEvidence(error: unknown): ServicePagePipelineSmokeEvidence {
  const message = error instanceof Error ? error.message : String(error);

  return {
    status: "blocked",
    smoke: SERVICE_PAGE_PIPELINE_SMOKE,
    mode: "fixture",
    reason: "Service page-use pipeline smoke failed before full evidence could be collected.",
    blockers: [message],
    checked: ["temporary local service page-use pipeline smoke started"]
  };
}

async function createScenario(appDataDir: string, localCapabilityToken: string): Promise<ServicePageScenario> {
  const storage = await createSoloStorage({ url: localDatabaseUrlFromAppDataDir(appDataDir) });
  const migrationStatus = await applyMigrations(storage);

  if (migrationStatus.state === "failed") {
    await storage.close();
    throw new Error(migrationStatus.errorMessage);
  }

  return {
    storage,
    app: createSidecarApp({
      localCapabilityToken,
      migrationStatus,
      storage
    })
  };
}

export async function runServicePagePipelineSmoke(
  options: ServicePagePipelineSmokeOptions = {}
): Promise<ServicePagePipelineSmokeEvidence> {
  const appDataDir = options.appDataDir ?? (await mkdtemp(join(tmpdir(), "solo-superman-service-page-smoke-")));
  const shouldCleanup = options.cleanupAppDataDir ?? !options.appDataDir;
  const localCapabilityToken = options.localCapabilityToken ?? `service-page-smoke-${randomUUID()}`;
  let scenario: ServicePageScenario | null = null;

  try {
    scenario = await createScenario(appDataDir, localCapabilityToken);
    const result = await executeServicePageFlow(scenario, localCapabilityToken);
    const blockers = flowBlockers(result);

    return blockers.length ? blockedEvidence(result, blockers) : passedEvidence(result);
  } catch (error: unknown) {
    return errorEvidence(error);
  } finally {
    await scenario?.storage.close();

    if (shouldCleanup) {
      await rm(appDataDir, { recursive: true, force: true });
    }
  }
}

function exitCodeForEvidence(evidence: ServicePagePipelineSmokeEvidence) {
  return evidence.status === "passed" ? 0 : 1;
}

async function main() {
  const evidence = await runServicePagePipelineSmoke();

  console.log(JSON.stringify(evidence, null, 2));
  process.exitCode = exitCodeForEvidence(evidence);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  void main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.stack ?? error.message : String(error));
    process.exitCode = 1;
  });
}
