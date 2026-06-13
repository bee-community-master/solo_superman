import { describe, expect, it } from "vitest";

import type {
  DecisionEvidencePackId,
  ProjectId,
  ProjectionVersion,
  QueueItemId,
  ResearchAllowlistGovernanceProjection,
  ResearchAllowlistId,
  ResearchConnectorId,
  ResearchDisclosureLogId,
  ResearchDisclosureLogProjection,
  ResearchEvidenceProjection,
  ResearchResultId,
  ResearchRunControlProjection,
  ResearchRunId,
  ResearchTaskId,
  SessionId,
} from "@solo-superman/contracts";
import {
  type Phase15aOperationsInput,
  phase15aOperationsViewModel,
  startableReadOnlyResearchTaskIds,
} from "./decision-queue-view-model";
import { DECISION_QUEUE_COPY } from "./shell/decision-queue-copy";

const projectId = "proj_phase15a_ui" as ProjectId;
const allowlistId = "research_allowlist_phase15a_ui" as ResearchAllowlistId;
const researchTaskId = "research_task_phase15a_ui" as ResearchTaskId;

function allowlistProjection(): ResearchAllowlistGovernanceProjection {
  return {
    kind: "ResearchAllowlistGovernanceProjection",
    projectionKind: "ResearchAllowlistProjection",
    projectId,
    version: 1 as ProjectionVersion,
    generatedAt: "2026-05-06T00:00:00.000Z",
    stale: false,
    refetchUrl: `/api/v1/projects/${projectId}/research-allowlists`,
    pendingEffectSummary: {
      totalPending: 0,
      byType: {},
      visibleLabel: "No async ProductEngine effects are pending for this allowlist governance action."
    },
    allowlists: [
      {
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
        approvedAt: "2026-05-06T00:00:00.000Z",
        createdAt: "2026-05-06T00:00:00.000Z",
        updatedAt: "2026-05-06T00:00:00.000Z"
      }
    ],
    automaticRunStartPolicies: [
      {
        allowed: true,
        allowlistId,
        allowlistVersion: 1 as ProjectionVersion,
        reason: "active_public_safe_allowlist"
      }
    ]
  };
}

function disclosureProjection(): ResearchDisclosureLogProjection {
  const latestDisclosureLog = {
    logId: "research_disclosure_phase15a_ui" as ResearchDisclosureLogId,
    projectId,
    allowlistId,
    connectorId: "public_search" as ResearchConnectorId,
    sourceCategory: "public_web",
    researchObjective: "Find public onboarding evidence.",
    objectiveSummary: "Find public onboarding evidence.",
    publicSafeSummarySent: "Product category: Founder workflow assistant.",
    sourceRefs: ["queue_item_phase15a"],
    automaticExternalTransferAllowed: true,
    status: "automatic_payload_ready",
    createdAt: "2026-05-06T00:00:00.000Z"
  } as const;

  return {
    kind: "ResearchDisclosureLogProjection",
    version: 1 as ProjectionVersion,
    projectId,
    generatedAt: "2026-05-06T00:00:00.000Z",
    stale: false,
    refetchUrl: `/api/v1/projects/${projectId}/research-disclosures`,
    disclosureLogs: [latestDisclosureLog],
    latestDisclosureLog
  };
}

function runProjection(status: "needs_review" | "accepted" = "needs_review"): ResearchRunControlProjection {
  const researchRunId = "research_run_phase15a_ui" as ResearchRunId;

  return {
    kind: "ResearchRunControlProjection",
    projectionKind: "ResearchRunProjection",
    projectId,
    version: 2 as ProjectionVersion,
    generatedAt: "2026-05-06T00:00:00.000Z",
    stale: false,
    refetchUrl: `/api/v1/projects/${projectId}/research-runs`,
    statusUrl: `/api/v1/projects/${projectId}/research-runs/${researchRunId}/status`,
    pendingEffectSummary: {
      totalPending: 0,
      byType: {},
      visibleLabel: "No async ProductEngine effects are pending."
    },
    runs: [
      {
        kind: "ResearchRunProjection",
        version: 2 as ProjectionVersion,
        researchRunId,
        projectId,
        researchTaskId,
        allowlistId,
        disclosureLogId: "research_disclosure_phase15a_ui" as ResearchDisclosureLogId,
        connectorId: "public_search" as ResearchConnectorId,
        sourceCategory: "public_web",
        status,
        provider: {
          researchRunId,
          researchTaskId,
          adapterKind: "local_fake_readonly",
          adapterVersion: "solo-superman.fake-readonly-research-adapter.v1",
          providerRunId: "fake_readonly_research_run_phase15a_ui",
          sourceCategory: "public_web",
          idempotencyKey: "research-run:v1:phase15a-ui",
          startedAt: "2026-05-06T00:00:00.000Z",
          ...(status === "accepted" ? { completedAt: "2026-05-06T00:01:00.000Z" } : {}),
          attempt: 1
        },
        qualityGateStatus: status === "accepted" ? "passed" : "pending_review",
        ...(status === "needs_review"
          ? { qualityGateReviewReason: "Source reliability is insufficient for automatic acceptance." }
          : { terminalReason: "quality_gate_accepted" as const }),
        sourceRefs: ["queue_item_phase15a"],
        createdAt: "2026-05-06T00:00:00.000Z",
        updatedAt: "2026-05-06T00:01:00.000Z"
      }
    ],
    recovery: {
      statusUrl: `/api/v1/projects/${projectId}/research-runs/${researchRunId}/status`,
      refetchUrl: `/api/v1/projects/${projectId}/research-runs/${researchRunId}/status`,
      sseEventNames: ["projection.updated"],
      projectionHints: [
        {
          projectionKind: "ResearchRunProjection",
          refetchUrl: `/api/v1/projects/${projectId}/research-runs/${researchRunId}/status`
        }
      ]
    }
  };
}

type ResearchRunProjectionItem = ResearchRunControlProjection["runs"][number];

function researchRunForTask(
  baseRun: ResearchRunProjectionItem,
  {
    researchRunId,
    researchTaskId,
    runAllowlistId = baseRun.allowlistId
  }: {
    readonly researchRunId: ResearchRunId;
    readonly researchTaskId: ResearchTaskId;
    readonly runAllowlistId?: ResearchAllowlistId;
  }
): ResearchRunProjectionItem {
  return {
    ...baseRun,
    researchRunId,
    researchTaskId,
    allowlistId: runAllowlistId,
    provider: {
      ...baseRun.provider,
      researchRunId,
      researchTaskId,
      providerRunId: `fake_readonly_${researchRunId}`,
      idempotencyKey: `research-run:v1:${researchRunId}`
    },
    disclosureLogId: `research_disclosure_${researchRunId}` as ResearchDisclosureLogId
  };
}

function researchProjection(blocksPlanning = true): ResearchEvidenceProjection {
  return {
    kind: "ResearchEvidenceProjection",
    version: 3 as ProjectionVersion,
    taskIds: [researchTaskId],
    tasks: [
      {
        researchTaskId,
        sessionId: "sess_phase15a_ui" as SessionId,
        objective: "Find public onboarding evidence.",
        routeOutcome: "research_needed",
        impact: "high",
        status: "needs_review",
        createdAt: "2026-05-06T00:00:00.000Z"
      }
    ],
    results: [],
    evidenceMatrices: [],
    evidencePacks: [
      {
        evidencePackId: "evidence_pack_phase15a_ui" as DecisionEvidencePackId,
        researchTaskId,
        researchResultId: "research_result_phase15a_ui" as ResearchResultId,
        researchRunId: "research_run_phase15a_ui" as ResearchRunId,
        claim: "Founders need safer onboarding research.",
        decisionContext: "Phase 1.5A acceptance",
        sourceReliability: "unknown",
        retrievedAt: "2026-05-06T00:01:00.000Z",
        gateStatus: blocksPlanning ? "needs_review" : "accepted",
        gateChecks: [],
        proEvidenceItemIds: [],
        conEvidenceItemIds: [],
        uncertaintyItemIds: [],
        limitationRefs: [],
        implicationScope: "UI acceptance coverage",
        createdAt: "2026-05-06T00:01:00.000Z"
      }
    ],
    reviewCards: [
      {
        cardId: "research_card_phase15a_ui" as QueueItemId,
        researchTaskId,
        evidencePackId: "evidence_pack_phase15a_ui" as DecisionEvidencePackId,
        cardType: "research_review",
        title: "Review public onboarding evidence",
        state: blocksPlanning ? "quality_gate_review" : "resolved",
        impact: "high",
        gateStatus: blocksPlanning ? "needs_review" : "accepted",
        availableOutcomes: blocksPlanning ? ["approved", "revised", "research_insufficient"] : [],
        ...(blocksPlanning ? {} : { terminalOutcome: "approved" as const }),
        blocksPlanning,
        recoveryActions: blocksPlanning ? ["import_manual_result", "mark_research_insufficient"] : []
      }
    ],
    knownRisks: [],
    nextValidationActions: [],
    proConBalanceStatus: blocksPlanning ? "source_quality_insufficient" : "balanced"
  };
}

function phase15aOperations(overrides: Partial<Phase15aOperationsInput> = {}) {
  return phase15aOperationsViewModel(
    {
      allowlists: allowlistProjection(),
      disclosures: disclosureProjection(),
      runs: runProjection(),
      research: researchProjection(true),
      ...overrides
    },
    DECISION_QUEUE_COPY.ko.phase15a
  );
}

describe("Decision Queue view model phase15a", () => {
  it("summarizes Phase 1.5A operations recovery and keeps blocking research cards explicit", () => {
    const operations = phase15aOperations();

    expect(operations.allowlistPolicyLabel).toContain("공개 웹 검색");
    expect(operations.allowlistPolicyLabel).toContain("공개 웹사이트");
    expect(operations.allowlistPolicyLabel).toContain("공개 가능한 요약만 사용");
    expect(operations.allowlistPolicyLabel).not.toContain("public_search");
    expect(operations.allowlistPolicyLabel).not.toContain("public_safe_summary");
    expect(operations.allowlistPolicyLabel).toContain("2 동시 / 세션당 12");
    expect(operations.disclosureActivityLabel).toContain("안전한 자동 리서치 준비됨");
    expect(operations.disclosureActivityLabel).not.toContain("automatic_payload_ready");
    expect(operations.runRecoveryLabel).toContain("상태 새로고침 가능");
    expect(operations.runRecoveryLabel).not.toContain("/api/v1/projects/proj_phase15a_ui/research-runs");
    expect(operations.qualityGateLabel).toContain("검토 필요");
    expect(operations.qualityGateLabel).not.toContain("needs_review");
    expect(operations.staleOrFailureReasons).toEqual([
      expect.stringMatching(/검토 필요[\s\S]*Source reliability is insufficient/u)
    ]);
    expect(operations.exitGate).toMatchObject({
      status: "blocked_for_1_5b",
      blockers: [expect.stringContaining("다음 리서치 카드 검토가 남아 있습니다")]
    });
  });

  it("marks the Phase 1.5A exit gate ready only when recovery, quality gate, and research cards are terminal", () => {
    const operations = phase15aOperations({
      runs: runProjection("accepted"),
      research: researchProjection(false)
    });

    expect(operations.exitGate).toEqual({
      status: "ready_for_1_5b",
      label: "리서치 결과와 복구 경로가 준비됐습니다. 실행 준비 검토로 넘어갈 수 있습니다.",
      blockers: []
    });
  });

  it("keeps terminal research-insufficient high-impact cards blocking 1.5B readiness", () => {
    const research = researchProjection(false);
    const terminalBlockingResearch = {
      ...research,
      reviewCards: research.reviewCards.map((card) => ({
        ...card,
        terminalOutcome: "research_insufficient" as const,
        terminalRationale: "Evidence remains too weak for Planning-ready handoff.",
        blocksPlanning: true
      }))
    };
    const operations = phase15aOperations({
      runs: runProjection("accepted"),
      research: terminalBlockingResearch
    });

    expect(operations.exitGate).toMatchObject({
      status: "blocked_for_1_5b",
      blockers: [expect.stringContaining("Review public onboarding evidence")]
    });
  });

  it("localizes research-card blocker title prefixes from persisted card titles", () => {
    const research = researchProjection(true);
    const localizedTitleResearch = {
      ...research,
      reviewCards: research.reviewCards.map((card) => ({
        ...card,
        title: "추가 근거 필요: onboarding retention",
        state: "research_insufficient" as const
      }))
    };
    const operations = phase15aOperationsViewModel(
      {
        allowlists: allowlistProjection(),
        disclosures: disclosureProjection(),
        runs: runProjection(),
        research: localizedTitleResearch
      },
      DECISION_QUEUE_COPY.en.phase15a
    );

    expect(operations.exitGate.blockers).toEqual([
      "Research card still needs review: Needs more research: onboarding retention"
    ]);
  });

  it("keeps review-card-only quality gate metadata visible", () => {
    const research = researchProjection(true);
    const reviewCardOnlyResearch = {
      ...research,
      evidencePacks: [],
      reviewCards: research.reviewCards.map((card) => ({
        ...card,
        reviewReason: "Manual quality gate review is still required."
      }))
    };
    const operations = phase15aOperations({
      runs: null,
      research: reviewCardOnlyResearch
    });

    expect(operations.qualityGateLabel).toContain("Review public onboarding evidence");
    expect(operations.qualityGateLabel).toContain("검토 필요");
    expect(operations.qualityGateLabel).not.toContain("needs_review");
  });

  it("keeps the Phase 1.5A exit gate blocked when allowlist refetch recovery is missing", () => {
    const allowlistsWithoutVisibleRefetch: ResearchAllowlistGovernanceProjection = {
      ...allowlistProjection(),
      refetchUrl: ""
    };

    const operations = phase15aOperations({
      allowlists: allowlistsWithoutVisibleRefetch,
      runs: runProjection("accepted"),
      research: researchProjection(false)
    });

    expect(operations.exitGate).toMatchObject({
      status: "blocked_for_1_5b",
      blockers: ["리서치 소스 상태를 다시 불러오는 경로가 보이지 않습니다."]
    });
  });

  it("selects only planned public-web research tasks within the active concurrency budget", () => {
    const [allowlist] = allowlistProjection().allowlists;
    const [baseTask] = researchProjection(false).tasks;
    const [baseRun] = runProjection().runs;
    const plannedTaskIds = [
      "research_task_batch_ready_1",
      "research_task_batch_ready_2",
      "research_task_batch_over_budget"
    ] as const;

    if (!allowlist || !baseTask || !baseRun) {
      throw new Error("Phase 1.5A research batch fixture is incomplete.");
    }

    const research = {
      ...researchProjection(false),
      taskIds: plannedTaskIds.map((taskId) => taskId as ResearchTaskId),
      tasks: [
        ...plannedTaskIds.map((taskId) => ({
          ...baseTask,
          researchTaskId: taskId as ResearchTaskId,
          status: "planned" as const,
          objective: `Validate public evidence for ${taskId}.`
        })),
        {
          ...baseTask,
          researchTaskId: "research_task_needs_review" as ResearchTaskId,
          status: "needs_review" as const,
          objective: "This task is already in review."
        }
      ]
    };
    const runs = {
      ...runProjection("accepted"),
      runs: [
        {
          ...baseRun,
          researchTaskId: "research_task_already_running" as ResearchTaskId,
          status: "running" as const,
          qualityGateStatus: "not_evaluated" as const
        }
      ]
    };

    expect(startableReadOnlyResearchTaskIds({ research, runs, allowlist })).toEqual([
      "research_task_batch_ready_1"
    ]);
  });

  it("stops planned research tasks when the allowlist session run budget is exhausted", () => {
    const [baseAllowlist] = allowlistProjection().allowlists;
    const [baseTask] = researchProjection(false).tasks;
    const [baseRun] = runProjection("accepted").runs;

    if (!baseAllowlist || !baseTask || !baseRun) {
      throw new Error("Phase 1.5A session budget fixture is incomplete.");
    }

    const allowlist = {
      ...baseAllowlist,
      rateBudgetPolicy: {
        ...baseAllowlist.rateBudgetPolicy,
        maxConcurrentRunsPerProject: 3,
        maxRunsPerSession: 2
      }
    };
    const consumedTaskIds = [
      "research_task_session_budget_consumed_1",
      "research_task_session_budget_consumed_2"
    ] as const;
    const plannedTaskIds = [
      "research_task_session_budget_ready_1",
      "research_task_session_budget_ready_2"
    ] as const;
    const research = {
      ...researchProjection(false),
      taskIds: [...consumedTaskIds, ...plannedTaskIds].map((taskId) => taskId as ResearchTaskId),
      tasks: [
        ...consumedTaskIds.map((taskId) => ({
          ...baseTask,
          researchTaskId: taskId as ResearchTaskId,
          status: "needs_review" as const,
          objective: `Review existing run for ${taskId}.`
        })),
        ...plannedTaskIds.map((taskId) => ({
          ...baseTask,
          researchTaskId: taskId as ResearchTaskId,
          status: "planned" as const,
          objective: `Validate session budget for ${taskId}.`
        }))
      ]
    };
    const runs = {
      ...runProjection("accepted"),
      runs: consumedTaskIds.map((taskId, index) =>
        researchRunForTask(baseRun, {
          researchRunId: `research_run_session_budget_consumed_${index + 1}` as ResearchRunId,
          researchTaskId: taskId as ResearchTaskId
        })
      )
    };

    expect(startableReadOnlyResearchTaskIds({ research, runs, allowlist })).toEqual([]);
  });

  it("does not spend the active allowlist session budget on other sessions or allowlists", () => {
    const [baseAllowlist] = allowlistProjection().allowlists;
    const [baseTask] = researchProjection(false).tasks;
    const [baseRun] = runProjection("accepted").runs;

    if (!baseAllowlist || !baseTask || !baseRun) {
      throw new Error("Phase 1.5A scoped session budget fixture is incomplete.");
    }

    const allowlist = {
      ...baseAllowlist,
      rateBudgetPolicy: {
        ...baseAllowlist.rateBudgetPolicy,
        maxConcurrentRunsPerProject: 3,
        maxRunsPerSession: 2
      }
    };
    const currentAllowlistConsumedTaskId = "research_task_session_budget_current" as ResearchTaskId;
    const otherAllowlistConsumedTaskId = "research_task_session_budget_other_allowlist" as ResearchTaskId;
    const plannedTaskIds = [
      "research_task_session_budget_scope_ready_1",
      "research_task_session_budget_scope_ready_2"
    ] as const;
    const research = {
      ...researchProjection(false),
      taskIds: [currentAllowlistConsumedTaskId, otherAllowlistConsumedTaskId, ...plannedTaskIds].map(
        (taskId) => taskId as ResearchTaskId
      ),
      tasks: [
        currentAllowlistConsumedTaskId,
        otherAllowlistConsumedTaskId,
        ...plannedTaskIds.map((taskId) => taskId as ResearchTaskId)
      ].map((taskId) => ({
        ...baseTask,
        researchTaskId: taskId,
        status: plannedTaskIds.includes(taskId as (typeof plannedTaskIds)[number])
          ? ("planned" as const)
          : ("needs_review" as const),
        objective: `Validate scoped session budget for ${taskId}.`
      }))
    };
    const runs = {
      ...runProjection("accepted"),
      runs: [
        researchRunForTask(baseRun, {
          researchRunId: "research_run_session_budget_current" as ResearchRunId,
          researchTaskId: currentAllowlistConsumedTaskId
        }),
        researchRunForTask(baseRun, {
          researchRunId: "research_run_session_budget_other_session" as ResearchRunId,
          researchTaskId: "research_task_session_budget_other_session" as ResearchTaskId
        }),
        researchRunForTask(baseRun, {
          researchRunId: "research_run_session_budget_other_allowlist" as ResearchRunId,
          researchTaskId: otherAllowlistConsumedTaskId,
          runAllowlistId: "research_allowlist_phase15a_other" as ResearchAllowlistId
        })
      ]
    };

    expect(startableReadOnlyResearchTaskIds({ research, runs, allowlist })).toEqual([
      "research_task_session_budget_scope_ready_1"
    ]);
  });

  it("skips planned research tasks that already have an active run", () => {
    const [baseAllowlist] = allowlistProjection().allowlists;
    const [baseTask] = researchProjection(false).tasks;
    const [baseRun] = runProjection().runs;

    if (!baseAllowlist || !baseTask || !baseRun) {
      throw new Error("Phase 1.5A active-run exclusion fixture is incomplete.");
    }

    const allowlist = {
      ...baseAllowlist,
      rateBudgetPolicy: {
        ...baseAllowlist.rateBudgetPolicy,
        maxConcurrentRunsPerProject: 3
      }
    };
    const readyTaskIds = [
      "research_task_active_exclusion_1",
      "research_task_active_exclusion_2",
      "research_task_active_exclusion_3"
    ] as const;
    const research = {
      ...researchProjection(false),
      taskIds: readyTaskIds.map((taskId) => taskId as ResearchTaskId),
      tasks: readyTaskIds.map((taskId) => ({
        ...baseTask,
        researchTaskId: taskId as ResearchTaskId,
        status: "planned" as const,
        objective: `Validate active-run exclusion for ${taskId}.`
      }))
    };
    const runs = {
      ...runProjection(),
      runs: [
        {
          ...baseRun,
          researchTaskId: "research_task_active_exclusion_2" as ResearchTaskId,
          status: "running" as const,
          qualityGateStatus: "not_evaluated" as const
        }
      ]
    };

    expect(startableReadOnlyResearchTaskIds({ research, runs, allowlist })).toEqual([
      "research_task_active_exclusion_1",
      "research_task_active_exclusion_3"
    ]);
  });

  it("localizes Research operations dynamic labels for Japanese users", () => {
    const operations = phase15aOperationsViewModel(
      {
        allowlists: {
          ...allowlistProjection(),
          refetchUrl: ""
        },
        disclosures: disclosureProjection(),
        runs: runProjection("accepted"),
        research: researchProjection(false)
      },
      DECISION_QUEUE_COPY.ja.phase15a
    );

    expect(operations.allowlistPolicyLabel).toContain("公開Web検索");
    expect(operations.allowlistPolicyLabel).toContain("公開してよい要約のみ");
    expect(operations.allowlistPolicyLabel).toContain("セッションあたり 12");
    expect(operations.disclosureActivityLabel).toContain("リサーチ利用ログ");
    expect(operations.runRecoveryLabel).toContain("再読み込み");
    expect(operations.exitGate).toMatchObject({
      status: "blocked_for_1_5b",
      blockers: ["リサーチソース状態の再読み込み経路がまだ見えていません。"]
    });
    expect(operations.exitGate.label).toContain("リサーチ確認はまだ完了していません");
    expect(operations.exitGate.label).not.toContain("리서치");
    expect(operations.runRecoveryLabel).not.toContain("need review or recovery");
  });

});
