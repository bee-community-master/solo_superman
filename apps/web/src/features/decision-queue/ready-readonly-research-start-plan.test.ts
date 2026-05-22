import { describe, expect, it } from "vitest";
import type {
  ProjectId,
  ProjectionVersion,
  QueueItemId,
  ResearchAllowlistGovernanceProjection,
  ResearchAllowlistId,
  ResearchConnectorId,
  ResearchDisclosureLogId,
  ResearchEvidenceProjection,
  ResearchRunControlProjection,
  ResearchRunId,
  ResearchTaskId,
  SessionId
} from "@solo-superman/contracts";
import { readyReadOnlyResearchRunStartPlan } from "./ready-readonly-research-start-plan";

const projectId = "proj_auto_start_research" as ProjectId;
const sessionId = "sess_auto_start_research" as SessionId;
const allowlistId = "research_allowlist_auto_start" as ResearchAllowlistId;
const readyTaskId = "research_task_auto_start_ready" as ResearchTaskId;

function activeAllowlist(): ResearchAllowlistGovernanceProjection["allowlists"][number] {
  return {
    kind: "ResearchAllowlistProjection",
    version: 1 as ProjectionVersion,
    allowlistId,
    projectId,
    status: "active",
    connectorIds: ["public_search" as ResearchConnectorId],
    sourceCategories: ["public_web"],
    contextMode: "public_safe_summary",
    rateBudgetPolicy: {
      maxConcurrentRunsPerProject: 2,
      maxRunsPerSession: 12,
      maxAutomaticRetriesPerRun: 2,
      runTimeoutSeconds: 600,
      retryBackoffSeconds: [30, 120]
    },
    stalenessPolicy: {
      staleWhenRunExceedsTaskFreshnessWindow: true,
      staleWhenSourcePredatesTaskRequirement: true
    },
    disclosureLogPolicy: {
      logEveryAutomaticRun: true,
      publicSafeSummaryRequired: true
    },
    approvedBy: "owner_ui",
    approvedAt: "2026-05-23T00:00:00.000Z",
    createdAt: "2026-05-23T00:00:00.000Z",
    updatedAt: "2026-05-23T00:00:00.000Z"
  };
}

function researchProjection(status: ResearchEvidenceProjection["tasks"][number]["status"] = "planned"): ResearchEvidenceProjection {
  return {
    kind: "ResearchEvidenceProjection",
    version: 3 as ProjectionVersion,
    taskIds: [readyTaskId],
    tasks: [
      {
        researchTaskId: readyTaskId,
        sessionId,
        objective: "Validate public evidence after an answer.",
        routeOutcome: "research_needed",
        impact: "high",
        status,
        sourceQueueItemId: "queue_auto_start" as QueueItemId,
        createdAt: "2026-05-23T00:00:00.000Z"
      }
    ],
    results: [],
    evidenceMatrices: [],
    evidencePacks: [],
    reviewCards: [],
    knownRisks: [],
    nextValidationActions: [],
    proConBalanceStatus: "unknown"
  };
}

function runProjection(status: ResearchRunControlProjection["runs"][number]["status"]): ResearchRunControlProjection {
  const researchRunId = "research_run_auto_start_active" as ResearchRunId;

  return {
    kind: "ResearchRunControlProjection",
    projectionKind: "ResearchRunProjection",
    projectId,
    version: 1 as ProjectionVersion,
    generatedAt: "2026-05-23T00:00:00.000Z",
    stale: false,
    refetchUrl: `/api/v1/projects/${projectId}/research-runs`,
    pendingEffectSummary: {
      totalPending: 0,
      byType: {},
      visibleLabel: "No async ProductEngine effects are pending."
    },
    recovery: {
      refetchUrl: `/api/v1/projects/${projectId}/research-runs`,
      sseEventNames: ["projection.updated"],
      projectionHints: [
        {
          projectionKind: "ResearchRunProjection",
          refetchUrl: `/api/v1/projects/${projectId}/research-runs`
        }
      ]
    },
    runs: [
      {
        kind: "ResearchRunProjection",
        version: 1 as ProjectionVersion,
        researchRunId,
        projectId,
        researchTaskId: readyTaskId,
        allowlistId,
        disclosureLogId: "research_disclosure_auto_start" as ResearchDisclosureLogId,
        connectorId: "public_search" as ResearchConnectorId,
        sourceCategory: "public_web",
        status,
        provider: {
          researchRunId,
          researchTaskId: readyTaskId,
          adapterKind: "web_search_readonly",
          adapterVersion: "solo-superman.web-search-readonly.v1",
          sourceCategory: "public_web",
          idempotencyKey: "research-run:auto-start-ready",
          attempt: 1
        },
        qualityGateStatus: status === "accepted" ? "passed" : "not_evaluated",
        sourceRefs: ["queue_auto_start"],
        createdAt: "2026-05-23T00:00:00.000Z",
        updatedAt: "2026-05-23T00:00:00.000Z"
      }
    ]
  };
}

const blockerMessages = {
  missingAllowlistMessage: "Create an allowlist first.",
  noReadyTasksMessage: "No ready task."
};

describe("readyReadOnlyResearchRunStartPlan", () => {
  it("starts planned public-web tasks when an active allowlist and budget are available", () => {
    expect(
      readyReadOnlyResearchRunStartPlan({
        ...blockerMessages,
        allowlist: activeAllowlist(),
        quietNoop: false,
        research: researchProjection(),
        runs: null
      })
    ).toEqual({
      status: "start",
      taskIds: [readyTaskId]
    });
  });

  it("keeps answer-submission auto-start quiet when prerequisites are missing", () => {
    expect(
      readyReadOnlyResearchRunStartPlan({
        ...blockerMessages,
        allowlist: null,
        quietNoop: true,
        research: researchProjection(),
        runs: null
      })
    ).toEqual({
      status: "noop",
      reason: "missing_allowlist"
    });

    expect(
      readyReadOnlyResearchRunStartPlan({
        ...blockerMessages,
        allowlist: activeAllowlist(),
        quietNoop: true,
        research: researchProjection("needs_review"),
        runs: null
      })
    ).toEqual({
      status: "noop",
      reason: "no_ready_tasks"
    });
  });

  it("returns user-facing blockers for the manual Research tab action", () => {
    expect(
      readyReadOnlyResearchRunStartPlan({
        ...blockerMessages,
        allowlist: null,
        quietNoop: false,
        research: researchProjection(),
        runs: null
      })
    ).toEqual({
      status: "blocked",
      message: blockerMessages.missingAllowlistMessage
    });

    expect(
      readyReadOnlyResearchRunStartPlan({
        ...blockerMessages,
        allowlist: activeAllowlist(),
        quietNoop: false,
        research: researchProjection(),
        runs: runProjection("running")
      })
    ).toEqual({
      status: "blocked",
      message: blockerMessages.noReadyTasksMessage
    });
  });
});
