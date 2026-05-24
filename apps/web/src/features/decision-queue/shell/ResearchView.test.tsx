import { describe, expect, it, vi } from "vitest";
import type {
  DecisionEvidencePackId,
  DecisionEvidencePackProjection,
  EvidenceItemId,
  ProjectId,
  ProjectionVersion,
  QueueItemId,
  ResearchAllowlistGovernanceProjection,
  ResearchAllowlistId,
  ResearchConnectorId,
  ResearchEvidenceProjection,
  ResearchResultId,
  ResearchTaskId,
  SessionId
} from "@solo-superman/contracts";
import { renderEnglishMarkup } from "../test-rendering";
import { ResearchView } from "./ResearchView";
import { emptyProjectionState, emptyResearchOperationsState } from "./decision-queue-shell-model";
import type { DecisionQueueShellController } from "./useDecisionQueueShellController";

const DEFAULT_PHASE15A_OPERATIONS = {
  activeAllowlistCount: 1,
  allowlistPolicyLabel: "active · public_search · public_web · public_safe_summary · 2 concurrent / 12 per session",
  disclosureActivityLabel: "No disclosure activity loaded.",
  runRecoveryLabel: "No research run status loaded.",
  qualityGateLabel: "Quality check has not produced a visible result.",
  staleOrFailureReasons: [],
  exitGate: {
    status: "blocked_for_1_5b" as const,
    label: "Research review is not finished yet. Check the remaining items and recovery paths first.",
    blockers: []
  }
} as const;

function researchProjection(): ResearchEvidenceProjection {
  const plannedTaskIds = [
    "research_task_ready_batch_1",
    "research_task_ready_batch_2"
  ] as const satisfies readonly string[];

  return {
    kind: "ResearchEvidenceProjection",
    version: 3 as ProjectionVersion,
    taskIds: [
      ...plannedTaskIds.map((taskId) => taskId as ResearchTaskId),
      "research_task_reviewed" as ResearchTaskId
    ],
    tasks: [
      ...plannedTaskIds.map((taskId, index) => ({
        researchTaskId: taskId as ResearchTaskId,
        sessionId: "sess_research_batch" as SessionId,
        objective: `Validate public evidence path ${index + 1}.`,
        routeOutcome: "research_needed" as const,
        impact: "high" as const,
        status: "planned" as const,
        createdAt: "2026-05-22T00:00:00.000Z"
      })),
      {
        researchTaskId: "research_task_reviewed" as ResearchTaskId,
        sessionId: "sess_research_batch" as SessionId,
        objective: "Review already returned evidence.",
        routeOutcome: "research_needed",
        impact: "medium",
        status: "needs_review",
        createdAt: "2026-05-22T00:00:00.000Z"
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

type EvidencePackOverrides = Partial<Omit<DecisionEvidencePackProjection, "sourceTitle" | "sourceUrl">> & {
  readonly sourceTitle?: string | undefined;
  readonly sourceUrl?: string | undefined;
};

function evidencePackProjection(overrides: EvidencePackOverrides = {}): DecisionEvidencePackProjection {
  const { sourceTitle: overriddenSourceTitle, sourceUrl: overriddenSourceUrl, ...packOverrides } = overrides;
  const sourceTitle = "sourceTitle" in overrides ? overriddenSourceTitle : "Founder interview pricing notes";
  const sourceUrl = "sourceUrl" in overrides ? overriddenSourceUrl : "https://example.com/pricing-notes";

  return {
    evidencePackId: "evidence_pack_pricing" as DecisionEvidencePackId,
    researchTaskId: "research_task_reviewed" as ResearchTaskId,
    researchResultId: "research_result_pricing" as ResearchResultId,
    claim: "Pricing willingness has source-backed support.",
    decisionContext: "Decide whether to continue the paid founder interview workflow.",
    sourceReliability: "high",
    retrievedAt: "2026-05-22T00:00:00.000Z",
    gateStatus: "accepted",
    gateChecks: [
      {
        code: "source_reliability",
        status: "passed",
        reason: "The retained source is specific to the target founder workflow."
      }
    ],
    proEvidenceItemIds: ["evidence_pro_pricing" as EvidenceItemId],
    conEvidenceItemIds: [],
    uncertaintyItemIds: ["evidence_uncertainty_pricing" as EvidenceItemId],
    limitationRefs: ["limitation:small-sample"],
    implicationScope: "Planning-ready pricing confidence",
    knownRisk: "Counter-evidence has not been gathered yet.",
    nextValidationAction: "Search for founder tools with low conversion despite interview demand.",
    createdAt: "2026-05-22T00:00:00.000Z",
    ...(sourceTitle === undefined ? {} : { sourceTitle }),
    ...(sourceUrl === undefined ? {} : { sourceUrl }),
    ...packOverrides
  };
}

function allowlistProjection(maxConcurrentRunsPerProject = 2): ResearchAllowlistGovernanceProjection {
  return {
    kind: "ResearchAllowlistGovernanceProjection",
    projectionKind: "ResearchAllowlistProjection",
    version: 1 as ProjectionVersion,
    projectId: "proj_research_batch" as ProjectId,
    generatedAt: "2026-05-22T00:00:00.000Z",
    stale: false,
    refetchUrl: "/api/v1/projects/proj_research_batch/research-allowlists",
    pendingEffectSummary: {
      totalPending: 0,
      byType: {},
      visibleLabel: "No pending effects."
    },
    allowlists: [
      {
        kind: "ResearchAllowlistProjection",
        version: 1 as ProjectionVersion,
        allowlistId: "research_allowlist_public_web" as ResearchAllowlistId,
        projectId: "proj_research_batch" as ProjectId,
        status: "active",
        connectorIds: ["public_search" as ResearchConnectorId],
        sourceCategories: ["public_web"],
        contextMode: "public_safe_summary",
        rateBudgetPolicy: {
          maxConcurrentRunsPerProject,
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
        approvedBy: "web_ui_founder",
        approvedAt: "2026-05-22T00:00:00.000Z",
        createdAt: "2026-05-22T00:00:00.000Z",
        updatedAt: "2026-05-22T00:00:00.000Z"
      }
    ],
    automaticRunStartPolicies: [
      {
        allowed: true,
        allowlistId: "research_allowlist_public_web" as ResearchAllowlistId,
        allowlistVersion: 1 as ProjectionVersion,
        reason: "active_public_safe_allowlist"
      }
    ]
  };
}

function renderResearchView(controllerOverrides: Partial<DecisionQueueShellController> = {}) {
  const controller = {
    cancelResearchRun: vi.fn(),
    createOrReactivateAllowlist: vi.fn(),
    hasActiveResearchAllowlist: true,
    importResearchResult: vi.fn(),
    isBusy: false,
    pauseAllowlist: vi.fn(),
    phase15aOperations: DEFAULT_PHASE15A_OPERATIONS,
    planPhase15aResearchTask: vi.fn(),
    projections: {
      ...emptyProjectionState(),
      session: {
        kind: "SessionShellProjection",
        projectId: "proj_research_batch" as ProjectId,
        sessionId: "sess_research_batch" as SessionId,
        version: 1 as ProjectionVersion,
        phase: "spec",
        projectPurposeMode: "business",
        projectPurposeModeSelectionStatus: "confirmed",
        projectPurposeModeLabel: "Business validation",
        projectPurposeModeEffect: "Business validation mode keeps commercialization gates active."
      },
      research: researchProjection()
    },
    readyReadOnlyResearchTaskIds: [
      "research_task_ready_batch_1" as ResearchTaskId,
      "research_task_ready_batch_2" as ResearchTaskId
    ],
    readyReadOnlyResearchStartPlan: {
      status: "start" as const,
      taskIds: [
        "research_task_ready_batch_1" as ResearchTaskId,
        "research_task_ready_batch_2" as ResearchTaskId
      ]
    },
    refreshResearchOperations: vi.fn(),
    refreshResearchRunStatus: vi.fn(),
    researchDrafts: {},
    researchOperations: emptyResearchOperationsState(),
    resolveResearchCard: vi.fn(),
    retryResearchRun: vi.fn(),
    revokeAllowlist: vi.fn(),
    setResearchDrafts: vi.fn(),
    startReadOnlyResearchRun: vi.fn(),
    startReadyReadOnlyResearchRuns: vi.fn(),
    updateAllowlistMaxConcurrentRuns: vi.fn(),
    updateAllowlistMaxRunsPerSession: vi.fn(),
    ...controllerOverrides
  } satisfies Partial<DecisionQueueShellController>;

  return renderEnglishMarkup(<ResearchView controller={controller as DecisionQueueShellController} />);
}

describe("ResearchView", () => {
  it("renders a bounded batch action for currently startable public web research tasks", () => {
    const markup = renderResearchView();

    expect(markup).toContain("Start 2 ready public web runs");
    expect(markup).toContain("Ready public web batch plan");
    expect(markup).toContain("2 planned read-only research tasks will start within the active allowlist budget.");
    expect(markup).toContain("Task IDs queued for this batch");
    expect(markup).toContain("research_task_ready_batch_1");
    expect(markup).toContain("research_task_ready_batch_2");
    expect(markup).not.toContain("Start 3 ready public web runs");
    expect(markup).not.toContain("Source trace");
    expect(markup).not.toContain("Evidence matrix");
    expect(markup).toContain("Validate public evidence path 1.");
    expect(markup).toContain("Validate public evidence path 2.");
    expect(markup).toContain("Review already returned evidence.");
  });

  it("renders allowlist concurrency controls for manual and answer-triggered research starts", () => {
    const markup = renderResearchView({
      researchOperations: {
        ...emptyResearchOperationsState(),
        allowlists: allowlistProjection(3)
      }
    });

    expect(markup).toContain("Max simultaneous research runs");
    expect(markup).toContain("Applies to both manual and answer-triggered public web research starts.");
    expect(markup).toContain("Apply limit");
    expect(markup).toContain("value=\"3\"");
  });

  it("renders the blocked ready-batch reason when the active allowlist is missing", () => {
    const markup = renderResearchView({
      hasActiveResearchAllowlist: false,
      readyReadOnlyResearchTaskIds: [],
      readyReadOnlyResearchStartPlan: {
        status: "blocked",
        reason: "missing_allowlist",
        message: "Create or reactivate an active public web allowlist before starting research runs."
      }
    });

    expect(markup).toContain("No ready public web runs");
    expect(markup).toContain("Ready public web batch plan");
    expect(markup).toContain("Create or reactivate an active public web allowlist before starting the ready batch.");
    expect(markup).not.toContain("Task IDs queued for this batch");
  });

  it("renders the blocked ready-batch reason when no task fits the current budget", () => {
    const markup = renderResearchView({
      readyReadOnlyResearchTaskIds: [],
      readyReadOnlyResearchStartPlan: {
        status: "blocked",
        reason: "no_ready_tasks",
        message: "No planned public web research tasks are ready within the active allowlist concurrency budget."
      }
    });

    expect(markup).toContain("No ready public web runs");
    expect(markup).toContain("No planned public web tasks are ready within the active allowlist concurrency budget.");
    expect(markup).not.toContain("Task IDs queued for this batch");
  });

  it("renders deduped retained source traces with research-generated follow-up questions", () => {
    const research = researchProjection();
    const markup = renderResearchView({
      projections: {
        ...emptyProjectionState(),
        session: {
          kind: "SessionShellProjection",
          projectId: "proj_research_batch" as ProjectId,
          sessionId: "sess_research_batch" as SessionId,
          version: 1 as ProjectionVersion,
          phase: "spec",
          projectPurposeMode: "business",
          projectPurposeModeSelectionStatus: "confirmed",
          projectPurposeModeLabel: "Business validation",
          projectPurposeModeEffect: "Business validation mode keeps commercialization gates active."
        },
        research: {
          ...research,
          reviewCards: [
            {
              cardId: "research_reviewed_card" as QueueItemId,
              researchTaskId: "research_task_reviewed" as ResearchTaskId,
              cardType: "follow_up_question",
              title: "Evidence raised a follow-up question",
              state: "ready_for_review",
              impact: "medium",
              retainedSourceRef: "https://example.com/source-report",
              retainedSourceRefs: [
                "https://example.com/source-report",
                "research_run_public_web_1",
                "question:pricing-evidence"
              ],
              additionalQuestions: ["Which proof narrows the pricing risk?"],
              availableOutcomes: ["approved", "risk_accepted"],
              blocksPlanning: false,
              recoveryActions: []
            }
          ]
        }
      }
    });

    expect(markup).toContain("Research-generated follow-up questions");
    expect(markup).toContain("Which proof narrows the pricing risk?");
    expect(markup).toContain("Ready for review");
    expect(markup).toContain("Follow-up question · Medium impact");
    expect(markup).toContain("Approve evidence");
    expect(markup).toContain("Accept risk");
    expect(markup).not.toContain("ready_for_review");
    expect(markup).not.toContain("follow_up_question");
    expect(markup).not.toContain(">approved<");
    expect(markup).not.toContain(">risk_accepted<");
    expect(markup).toContain("Source trace");
    expect(markup).toContain("research_run_public_web_1");
    expect(markup).toContain("question:pricing-evidence");
    expect(markup.split("https://example.com/source-report")).toHaveLength(2);
  });

  it("renders evidence matrices with pro, con, uncertainty, blocker, and follow-up details", () => {
    const research = researchProjection();
    const markup = renderResearchView({
      projections: {
        ...emptyProjectionState(),
        research: {
          ...research,
          evidenceMatrices: [
            {
              evidenceMatrixId: "matrix_pricing_counter_evidence",
              researchTaskId: "research_task_reviewed" as ResearchTaskId,
              researchResultId: "research_result_pricing" as ResearchResultId,
              synthesisVersion: 1,
              proEvidence: [
                {
                  evidenceItemId: "evidence_pro_pricing" as EvidenceItemId,
                  kind: "pro",
                  summary: "Founders report willingness to pay for painful interview prep."
                }
              ],
              conEvidence: [],
              uncertainties: [
                {
                  evidenceItemId: "evidence_uncertainty_pricing" as EvidenceItemId,
                  kind: "uncertainty",
                  summary: "Counter-evidence still needs a narrower skeptical pricing search."
                }
              ],
              additionalQuestions: ["Which source disproves pricing urgency?"],
              balanceStatus: "missing_con_evidence",
              decisionBlocked: true,
              missingConEvidenceReason: "No credible counter-evidence source was retained.",
              knownRisk: "Pricing evidence remains one-sided."
            }
          ]
        }
      }
    });

    expect(markup).toContain("Evidence matrix");
    expect(markup).toContain("matrix_pricing_counter_evidence");
    expect(markup).toContain("Balance status");
    expect(markup).toContain("Missing counter-evidence");
    expect(markup).not.toContain(">missing_con_evidence<");
    expect(markup).toContain("Planning blocked");
    expect(markup).toContain("Pro evidence");
    expect(markup).toContain("Founders report willingness to pay");
    expect(markup).toContain("Con evidence");
    expect(markup).toContain("No evidence items");
    expect(markup).toContain("Uncertainties");
    expect(markup).toContain("Counter-evidence still needs");
    expect(markup).toContain("Missing con-evidence reason");
    expect(markup).toContain("No credible counter-evidence source was retained.");
    expect(markup).toContain("Known risk");
    expect(markup).toContain("Pricing evidence remains one-sided.");
    expect(markup).toContain("Which source disproves pricing urgency?");
  });

  it("renders evidence packs with research-level risks and validation actions", () => {
    const research = researchProjection();
    const markup = renderResearchView({
      projections: {
        ...emptyProjectionState(),
        research: {
          ...research,
          knownRisks: ["Pricing evidence is still biased toward founder interviews."],
          nextValidationActions: ["Run a skeptical pricing search before Planning-ready."],
          evidencePacks: [evidencePackProjection()]
        }
      }
    });

    expect(markup).toContain("Validation summary");
    expect(markup).toContain("Known risks");
    expect(markup).toContain("Pricing evidence is still biased toward founder interviews.");
    expect(markup).toContain("Next validation actions");
    expect(markup).toContain("Run a skeptical pricing search before Planning-ready.");
    expect(markup).toContain("Evidence packs");
    expect(markup).toContain("Pricing willingness has source-backed support.");
    expect(markup).toContain("Gate status");
    expect(markup).toContain("Accepted");
    expect(markup).toContain("Source reliability");
    expect(markup).toContain("High reliability");
    expect(markup).not.toContain(">accepted<");
    expect(markup).not.toContain(">high<");
    expect(markup).toContain("Decision context");
    expect(markup).toContain("Decide whether to continue the paid founder interview workflow.");
    expect(markup).toContain("Founder interview pricing notes");
    expect(markup).toContain('href="https://example.com/pricing-notes"');
    expect(markup).toContain("https://example.com/pricing-notes");
    expect(markup).toContain("Gate checks");
    expect(markup).toContain("Source reliability: Passed");
    expect(markup).toContain("The retained source is specific to the target founder workflow.");
    expect(markup).not.toContain("source_reliability:");
    expect(markup).toContain("Counter-evidence has not been gathered yet.");
    expect(markup).toContain("Search for founder tools with low conversion despite interview demand.");
    expect(markup).toContain("Limitations");
    expect(markup).toContain("limitation:small-sample");
  });

  it("renders unsafe evidence pack source URLs as text instead of links", () => {
    const research = researchProjection();
    const markup = renderResearchView({
      projections: {
        ...emptyProjectionState(),
        research: {
          ...research,
          evidencePacks: [
            evidencePackProjection({
              evidencePackId: "evidence_pack_unsafe_source" as DecisionEvidencePackId,
              sourceTitle: undefined,
              sourceUrl: "javascript:alert(1)"
            })
          ]
        }
      }
    });

    expect(markup).toContain("javascript:alert(1)");
    expect(markup).not.toContain('href="javascript:alert(1)"');
  });
});
