import { describe, expect, it, vi } from "vitest";
import { CHATGPT_BROWSER_DELEGATION_READY_PROJECTION_FIXTURE } from "@solo-superman/contracts";
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
  ResearchDisclosureLogId,
  ResearchEvidenceProjection,
  ResearchResultId,
  ResearchRunControlProjection,
  ResearchRunId,
  ResearchTaskId,
  SessionId
} from "@solo-superman/contracts";
import { renderMarkup } from "../test-rendering";
import { ResearchView } from "./ResearchView";
import { emptyProjectionState, emptyResearchOperationsState } from "./decision-queue-shell-model";
import type { DecisionQueueShellController } from "./useDecisionQueueShellController";

const DEFAULT_PHASE15A_OPERATIONS = {
  activeAllowlistCount: 1,
  allowlistPolicyLabel: "Active · Public web search · Public websites · Public-safe summary only · 2 concurrent / 12 per session",
  disclosureActivityLabel: "No disclosure activity loaded.",
  runRecoveryLabel: "No research run status loaded.",
  qualityGateLabel: "Quality check has not produced a visible result.",
  staleOrFailureReasons: [],
  exitGate: {
    status: "blocked_for_1_5b" as const,
    label: "Evidence checks are not finished yet. Check the remaining items and recovery paths first.",
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

function researchRunProjectionWithRuns(): ResearchRunControlProjection {
  const projectId = "proj_research_batch" as ProjectId;
  const firstRunId = "research_run_batch_1" as ResearchRunId;
  const secondRunId = "research_run_batch_2" as ResearchRunId;
  const staleSelectedRunStatusUrl = "/api/v1/projects/proj_research_batch/research-runs/research_run_selected/status";

  function run(
    researchRunId: ResearchRunId,
    researchTaskId: ResearchTaskId,
    disclosureLogId: ResearchDisclosureLogId
  ): ResearchRunControlProjection["runs"][number] {
    return {
      kind: "ResearchRunProjection",
      version: 3 as ProjectionVersion,
      researchRunId,
      projectId,
      researchTaskId,
      allowlistId: "research_allowlist_public_web" as ResearchAllowlistId,
      disclosureLogId,
      connectorId: "public_search" as ResearchConnectorId,
      sourceCategory: "public_web",
      status: "running",
      provider: {
        researchRunId,
        researchTaskId,
        adapterKind: "web_search_readonly",
        adapterVersion: "test",
        sourceCategory: "public_web",
        idempotencyKey: `${researchRunId}:attempt-1`,
        startedAt: "2026-05-22T00:00:00.000Z",
        attempt: 1
      },
      qualityGateStatus: "not_evaluated",
      sourceRefs: [],
      createdAt: "2026-05-22T00:00:00.000Z",
      updatedAt: "2026-05-22T00:00:00.000Z"
    };
  }

  return {
    kind: "ResearchRunControlProjection",
    projectionKind: "ResearchRunProjection",
    projectId,
    version: 4 as ProjectionVersion,
    generatedAt: "2026-05-22T00:00:00.000Z",
    stale: false,
    refetchUrl: "/api/v1/projects/proj_research_batch/research-runs",
    statusUrl: staleSelectedRunStatusUrl,
    pendingEffectSummary: {
      totalPending: 0,
      byType: {},
      visibleLabel: "No async ProductEngine effects are pending."
    },
    runs: [
      run(
        firstRunId,
        "research_task_ready_batch_1" as ResearchTaskId,
        "research_disclosure_batch_1" as ResearchDisclosureLogId
      ),
      run(
        secondRunId,
        "research_task_ready_batch_2" as ResearchTaskId,
        "research_disclosure_batch_2" as ResearchDisclosureLogId
      )
    ],
    recovery: {
      refetchUrl: staleSelectedRunStatusUrl,
      sseEventNames: ["projection.updated"],
      projectionHints: [
        {
          projectionKind: "ResearchRunProjection",
          refetchUrl: staleSelectedRunStatusUrl
        }
      ]
    }
  };
}

function renderResearchView(
  controllerOverrides: Partial<DecisionQueueShellController> = {},
  language: Parameters<typeof renderMarkup>[1] = "en"
) {
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

  return renderMarkup(<ResearchView controller={controller as DecisionQueueShellController} />, language);
}

describe("ResearchView", () => {
  it("renders a bounded batch action for currently startable public web research tasks", () => {
    const markup = renderResearchView();

    expect(markup).toContain("Start 2 ready public web runs");
    expect(markup).toContain("Ready public web batch plan");
    expect(markup).toContain("2 planned read-only research tasks will start with the current source settings.");
    expect(markup).not.toContain("Task IDs queued for this batch");
    expect(markup).not.toContain("research_task_ready_batch_1");
    expect(markup).not.toContain("research_task_ready_batch_2");
    expect(markup).not.toContain("Start 3 ready public web runs");
    expect(markup).not.toContain("Source trace");
    expect(markup).not.toContain("Evidence matrix");
    expect(markup).toContain("Validate public evidence path 1.");
    expect(markup).toContain("Validate public evidence path 2.");
    expect(markup).toContain("Review already returned evidence.");
  });

  it("shows visible ChatGPT import guidance on matching research tasks", () => {
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
          ...researchProjection(),
          taskIds: ["research_task_chatgpt_ready" as ResearchTaskId],
          tasks: [
            {
              researchTaskId: "research_task_chatgpt_ready" as ResearchTaskId,
              sessionId: "sess_research_batch" as SessionId,
              objective: "Use visible ChatGPT Deep Research for the buyer/user split.",
              routeOutcome: "research_needed",
              impact: "high",
              status: "planned",
              createdAt: "2026-05-22T00:00:00.000Z"
            }
          ]
        },
        chatGptDelegation: CHATGPT_BROWSER_DELEGATION_READY_PROJECTION_FIXTURE
      }
    });

    expect(markup).toContain("A ChatGPT Deep Research request is ready for this task.");
    expect(markup).toContain("ChatGPT Deep Research request");
    expect(markup).toContain("Open ChatGPT");
    expect(markup).toContain('href="https://chatgpt.com/"');
    expect(markup).toContain("Prompt to paste into ChatGPT Deep Research");
    expect(markup).toContain("Decision this research should narrow: Use visible ChatGPT Deep Research for the buyer/user split.");
    expect(markup).toContain("Possible user futures");
    expect(markup).toContain("Do not include passwords, session cookies, API keys");
    expect(markup).not.toContain("이번 리서치가 좁힐 결정");
    expect(markup).toContain("Before importing the result");
    expect(markup).toContain("Paste the user-reviewed result here");
  });

  it("shows the user-owned ChatGPT handoff prompt when onboarding allowed visible ChatGPT research", () => {
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
          projectPurposeModeEffect: "Business validation mode keeps commercialization gates active.",
          initialResearchAutomationPermission: "allow_codex_and_chatgpt_visible"
        },
        research: {
          ...researchProjection(),
          taskIds: ["research_task_deep_research" as ResearchTaskId],
          tasks: [
            {
              researchTaskId: "research_task_deep_research" as ResearchTaskId,
              sessionId: "sess_research_batch" as SessionId,
              objective: "Compare multiple sources for possible user futures, representative use cases, and existing alternatives.",
              routeOutcome: "research_needed",
              impact: "high",
              status: "planned",
              createdAt: "2026-05-22T00:00:00.000Z"
            }
          ]
        }
      }
    });

    expect(markup).toContain("ChatGPT Deep Research request");
    expect(markup).toContain("Decision this research should narrow: Compare multiple sources for possible user futures");
    expect(markup).toContain("Solo Superman does not use your account in the background.");
    expect(markup).not.toContain("A ChatGPT Pro/Deep Research request is ready for this task.");
  });

  it("keeps imported handoff results visible while evidence synthesis is pending", () => {
    const researchTaskId = "research_task_imported_handoff" as ResearchTaskId;
    const markup = renderResearchView({
      readyReadOnlyResearchTaskIds: [],
      readyReadOnlyResearchStartPlan: {
        status: "blocked",
        reason: "no_ready_tasks",
        message: "No planned public web research tasks are ready within the active allowlist concurrency budget."
      },
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
          ...researchProjection(),
          taskIds: [researchTaskId],
          tasks: [
            {
              researchTaskId,
              sessionId: "sess_research_batch" as SessionId,
              objective: "Check whether pet lifecycle app buyers and daily users are the same people.",
              routeOutcome: "research_needed",
              impact: "high",
              status: "handoff_ready",
              createdAt: "2026-05-22T00:00:00.000Z"
            }
          ],
          results: [
            {
              researchResultId: "research_result_imported_handoff" as ResearchResultId,
              researchTaskId,
              sourceTitle: "User-reviewed ChatGPT Deep Research notes",
              sourceUrl: "https://example.com/pet-lifecycle-research",
              sourceReliability: "unknown",
              resultSummary:
                "Pet care decisions may involve one household buyer while another family member handles daily care.",
              limitationNotes: "Source citations and counterexamples still need quality-gate review.",
              questionRef: "visible_chatgpt_handoff:research_task_imported_handoff",
              implicationScope: "Decide whether the next question should separate payer, caregiver, and clinic-contact roles.",
              importedAt: "2026-05-22T00:05:00.000Z"
            }
          ]
        }
      }
    });

    expect(markup).toContain("Ready for handoff");
    expect(markup).toContain("Imported result is being turned into evidence");
    expect(markup).toContain(
      "The pasted research result is retained here while the evidence matrix, follow-up questions, and quality checks are prepared."
    );
    expect(markup).toContain("User-reviewed ChatGPT Deep Research notes");
    expect(markup).toContain('href="https://example.com/pet-lifecycle-research"');
    expect(markup).toContain("Unknown reliability");
    expect(markup).toContain("Pet care decisions may involve one household buyer");
    expect(markup).toContain("Source citations and counterexamples still need quality-gate review.");
    expect(markup).not.toContain("visible_chatgpt_handoff:research_task_imported_handoff");
    expect(markup).toContain("payer, caregiver, and clinic-contact roles");
    expect(markup).not.toContain(
      "Import research for Check whether pet lifecycle app buyers and daily users are the same people."
    );
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
    expect(markup).toContain("Public web search");
    expect(markup).toContain("Public-safe summary only");
    expect(markup).not.toContain("public_search");
    expect(markup).not.toContain("public_web");
    expect(markup).not.toContain("public_safe_summary");
    expect(markup).not.toContain("research_allowlist_public_web");
    expect(markup).toContain("Apply limit");
    expect(markup).toContain("value=\"3\"");
  });

  it("renders each research run card with its own recovery status URL", () => {
    const markup = renderResearchView({
      researchOperations: {
        ...emptyResearchOperationsState(),
        runs: researchRunProjectionWithRuns()
      }
    });

    expect(markup).toContain("Research run cards 1");
    expect(markup).toContain("Research run cards 2");
    expect(markup).not.toContain("research_task_ready_batch_1");
    expect(markup).not.toContain("research_task_ready_batch_2");
    expect(markup).not.toContain("/api/v1/projects/proj_research_batch/research-runs/research_run_batch_1/status");
    expect(markup).not.toContain("/api/v1/projects/proj_research_batch/research-runs/research_run_batch_2/status");
    expect(markup).not.toContain("/api/v1/projects/proj_research_batch/research-runs/research_run_selected/status");
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
    expect(markup).toContain("Research tasks exist, but public web sources must be enabled before they can run.");
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
    expect(markup).toContain("No public web research task is executable with the current source settings.");
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
          tasks: research.tasks.map((task) =>
            task.researchTaskId === "research_task_reviewed"
              ? {
                  ...task,
                  objective:
                    "Find decision evidence for: pricing. Original ambiguity: paid intent is still unclear. Collect current public evidence with source freshness, limitations, and counterexamples before treating the answer as implementation-ready."
                }
              : task
          ),
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
                "answer_public_web_1",
                "question:pricing-evidence"
              ],
              additionalQuestions: [
                "Which proof narrows the pricing risk?",
                "Which proof narrows the pricing risk?"
              ],
              availableOutcomes: ["approved", "risk_accepted"],
              blocksPlanning: false,
              recoveryActions: []
            }
          ]
        }
      }
    });

    expect(markup).toContain("Research-generated follow-up questions");
    expect(markup).toContain("Evidence raised a follow-up question");
    expect(markup).not.toContain("Original ambiguity");
    expect(markup).not.toContain("Collect current public evidence");
    expect(markup).toContain("Which proof narrows the pricing risk?");
    expect(markup.split("Which proof narrows the pricing risk?")).toHaveLength(2);
    expect(markup).toContain('class="research-card-header"');
    expect(markup).toContain('class="research-status-badge"');
    expect(markup).toContain('class="research-card-facts"');
    expect(markup).toContain("Ready for review");
    expect(markup).toContain("Decision context");
    expect(markup).toContain("Follow-up question");
    expect(markup).toContain("Impact");
    expect(markup).toContain("Medium impact");
    expect(markup).toContain("Approve evidence");
    expect(markup).toContain("Accept risk");
    expect(markup).not.toContain("ready_for_review");
    expect(markup).not.toContain("follow_up_question");
    expect(markup).not.toContain(">approved<");
    expect(markup).not.toContain(">risk_accepted<");
    expect(markup).toContain("Source trace");
    expect(markup).not.toContain("research_run_public_web_1");
    expect(markup).not.toContain("answer_public_web_1");
    expect(markup).toContain("question:pricing-evidence");
    expect(markup.split("https://example.com/source-report")).toHaveLength(2);
  });

  it("localizes research card title prefixes for the active UI language", () => {
    const markup = renderResearchView({
      projections: {
        ...emptyProjectionState(),
        research: {
          ...researchProjection(),
          reviewCards: [
            {
              cardId: "research_reviewed_card" as QueueItemId,
              researchTaskId: "research_task_reviewed" as ResearchTaskId,
              cardType: "research_review",
              title: "추가 근거 필요: onboarding retention",
              state: "research_insufficient",
              impact: "high",
              retainedSourceRefs: [],
              availableOutcomes: ["risk_accepted", "research_insufficient"],
              blocksPlanning: true,
              recoveryActions: ["mark_research_insufficient"]
            }
          ]
        }
      }
    });

    expect(markup).toContain("Needs more research: onboarding retention");
    expect(markup).not.toContain("추가 근거 필요: onboarding retention");
  });

  it("shows a compact insufficient public research summary when no public source URL is retained", () => {
    const research = researchProjection();
    const markup = renderResearchView({
        projections: {
          ...emptyProjectionState(),
          research: {
            ...research,
            tasks: research.tasks.map((task) =>
              task.researchTaskId === "research_task_reviewed"
                ? {
                    ...task,
                    status: "research_insufficient" as const,
                    objective: "Find decision evidence for: career transition planner alternatives."
                  }
                : task
            ),
            results: [
              {
                researchResultId: "research_result_no_source" as ResearchResultId,
                researchTaskId: "research_task_reviewed" as ResearchTaskId,
                resultSummary: "Evidence has 0 usable finding(s), below configured minimum 1.",
                limitationNotes: "No public URL was retained from the browser search.",
                importedAt: "2026-05-22T00:00:00.000Z"
              }
            ],
            reviewCards: [
              {
                cardId: "research_reviewed_card" as QueueItemId,
                researchTaskId: "research_task_reviewed" as ResearchTaskId,
                cardType: "research_review",
                title: "Needs more research: career alternatives",
                state: "research_insufficient",
                impact: "high",
                availableOutcomes: ["risk_accepted", "research_insufficient"],
                terminalOutcome: "research_insufficient",
                terminalRationale: "Evidence has 0 usable finding(s), below configured minimum 1.",
                blocksPlanning: true,
                recoveryActions: ["mark_research_insufficient"]
              }
            ]
          }
        }
      },
      "ko"
    );

    expect(markup).toContain("이 공개 리서치만으로 부족한 이유");
    expect(markup).toContain("검색한 것");
    expect(markup).toContain("career transition planner alternatives");
    expect(markup).toContain("확인한 범위");
    expect(markup).toContain("공개 출처 URL을 확인하지 못했습니다.");
    expect(markup).toContain("근거가 부족한 이유");
    expect(markup).not.toContain("Evidence has 0 usable finding");
    expect(markup).toContain("다음 수동 검증");
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
              additionalQuestions: [
                "Which source disproves pricing urgency?",
                "Which source disproves pricing urgency?"
              ],
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
    expect(markup).not.toContain("matrix_pricing_counter_evidence");
    expect(markup).toContain("Balance status");
    expect(markup).toContain("Missing counter-evidence");
    expect(markup).not.toContain(">missing_con_evidence<");
    expect(markup).toContain("Risk remains before planning handoff");
    expect(markup).toContain("Supporting signals");
    expect(markup).toContain("Founders report willingness to pay");
    expect(markup).toContain("Counterpoints / risks");
    expect(markup.split("Which source disproves pricing urgency?")).toHaveLength(2);
    expect(markup).toContain("No evidence items");
    expect(markup).toContain("Uncertainties");
    expect(markup).toContain("Counter-evidence still needs");
    expect(markup).toContain("Missing counterpoints reason");
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
    expect(markup).toContain("Review status");
    expect(markup).toContain("Accepted");
    expect(markup).toContain("Source reliability");
    expect(markup).toContain("High reliability");
    expect(markup).not.toContain(">accepted<");
    expect(markup).not.toContain(">high<");
    expect(markup).toContain("Decision context");
    expect(markup).toContain("Decide whether to continue the paid founder interview workflow.");
    expect(markup).toContain("Founder interview pricing notes");
    expect(markup).toContain('href="https://example.com/pricing-notes"');
    expect(markup).not.toContain(">https://example.com/pricing-notes<");
    expect(markup).toContain("Review checks");
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

    expect(markup).toContain("No public source URL was confirmed.");
    expect(markup).not.toContain('href="javascript:alert(1)"');
  });
});
