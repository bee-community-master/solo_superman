import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import type {
  CommandId,
  CommandResponse,
  CorrelationId,
  ProjectId,
  ProjectionVersion,
  ResearchEvidenceProjection,
  ResearchAllowlistGovernanceProjection,
  ResearchAllowlistId,
  ResearchConnectorId,
  ResearchDisclosureLogId,
  ResearchRunControlProjection,
  ResearchRunControlResult,
  ResearchRunId,
  ResearchTaskId,
  QueueItemId,
  SessionId,
  StateVersion
} from "@solo-superman/contracts";
import type { SidecarClient } from "../../../shared/api/sidecar-client";
import { DECISION_QUEUE_COPY } from "./decision-queue-copy";
import { emptyProjectionState, emptyResearchOperationsState } from "./decision-queue-shell-model";
import { useDecisionQueueResearchActions } from "./useDecisionQueueResearchActions";

const projectId = "proj_research_refresh" as ProjectId;
const sessionId = "sess_research_refresh" as SessionId;
const researchRunId = "research_run_refresh" as ResearchRunId;
const allowlistId = "research_allowlist_public_web" as ResearchAllowlistId;

function researchRunProjection(): ResearchRunControlProjection {
  return {
    kind: "ResearchRunControlProjection",
    projectionKind: "ResearchRunProjection",
    projectId,
    version: 2 as ProjectionVersion,
    generatedAt: "2026-05-23T00:00:00.000Z",
    stale: false,
    refetchUrl: `/api/v1/projects/${projectId}/research-runs`,
    statusUrl: `/api/v1/projects/${projectId}/research-runs/${researchRunId}/status`,
    pendingEffectSummary: {
      totalPending: 0,
      byType: {},
      visibleLabel: "No async ProductEngine effects are pending."
    },
    runs: [],
    recovery: {
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

function researchRunProjectionWithSelectedRun(
  status: NonNullable<ResearchRunControlProjection["selectedRun"]>["status"] = "accepted"
): ResearchRunControlProjection {
  const selectedRun = {
    kind: "ResearchRunProjection",
    version: 3 as ProjectionVersion,
    researchRunId,
    projectId,
    researchTaskId: "research_task_completed_run" as ResearchTaskId,
    allowlistId,
    connectorId: "public_search" as ResearchConnectorId,
    sourceCategory: "public_web",
    status,
    disclosureLogId: "research_disclosure_completed_run" as ResearchDisclosureLogId,
    contextHash: "completed_run_context",
    provider: {
      researchRunId,
      researchTaskId: "research_task_completed_run" as ResearchTaskId,
      adapterKind: "web_search_readonly",
      adapterVersion: "test",
      sourceCategory: "public_web",
      idempotencyKey: "completed_run_context",
      startedAt: "2026-05-23T00:00:00.000Z",
      completedAt: "2026-05-23T00:01:00.000Z",
      attempt: 1
    },
    qualityGateStatus: "passed",
    sourceRefs: ["source:completed_run"],
    createdAt: "2026-05-23T00:00:00.000Z",
    updatedAt: "2026-05-23T00:01:00.000Z"
  } as NonNullable<ResearchRunControlProjection["selectedRun"]>;

  return {
    ...researchRunProjection(),
    runs: [selectedRun],
    selectedRun
  };
}

function researchRunCommandResponse(
  projection = researchRunProjection()
): CommandResponse<ResearchRunControlResult> {
  return {
    category: "accepted_with_projection",
    commandId: "cmd_research_run_start" as CommandId,
    correlationId: "corr_research_run_start" as CorrelationId,
    stateVersionBefore: 2 as StateVersion,
    stateVersionAfter: 3 as StateVersion,
    immediateProjection: {
      kind: "ResearchRunControlResult",
      action: "start",
      status: "started",
      projectId,
      researchRunId,
      researchTaskId: "research_task_visible_chatgpt" as ResearchTaskId,
      allowlistId,
      projection,
      recovery: projection.recovery
    }
  };
}

function allowlistProjection(maxConcurrentRunsPerProject = 2, maxRunsPerSession = 3): ResearchAllowlistGovernanceProjection {
  return {
    kind: "ResearchAllowlistGovernanceProjection",
    projectionKind: "ResearchAllowlistProjection",
    projectId,
    version: 1 as ProjectionVersion,
    generatedAt: "2026-05-23T00:00:00.000Z",
    stale: false,
    refetchUrl: `/api/v1/projects/${projectId}/research-allowlists`,
    pendingEffectSummary: {
      totalPending: 0,
      byType: {},
      visibleLabel: "No async ProductEngine effects are pending."
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
          maxConcurrentRunsPerProject,
          maxRunsPerSession,
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
        approvedAt: "2026-05-23T00:00:00.000Z",
        createdAt: "2026-05-23T00:00:00.000Z",
        updatedAt: "2026-05-23T00:00:00.000Z"
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

function allowlistCommandResponse(projection = allowlistProjection()): CommandResponse<ResearchAllowlistGovernanceProjection> {
  return {
    category: "accepted_with_projection",
    commandId: "cmd_allowlist_update" as CommandId,
    correlationId: "corr_allowlist_update" as CorrelationId,
    stateVersionBefore: 1 as StateVersion,
    stateVersionAfter: 2 as StateVersion,
    immediateProjection: projection
  };
}

function researchEvidenceProjection(input: {
  readonly objective?: string;
  readonly researchTaskId?: ResearchTaskId;
} = {}): ResearchEvidenceProjection {
  const researchTaskId = input.researchTaskId ?? "research_task_visible_chatgpt" as ResearchTaskId;

  return {
    kind: "ResearchEvidenceProjection",
    version: 7 as ProjectionVersion,
    taskIds: [researchTaskId],
    tasks: [
      {
        researchTaskId,
        sessionId,
        sourceQueueItemId: "queue_visible_chatgpt" as QueueItemId,
        objective: input.objective ?? "기존 대안이 무엇인지 짧게 공개 검색으로 확인합니다.",
        routeOutcome: "research_needed",
        impact: "high",
        status: "planned",
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

function chatGptDelegationCommandResponse(): CommandResponse<unknown> {
  return {
    category: "accepted_with_projection",
    commandId: "cmd_visible_chatgpt_delegation" as CommandId,
    correlationId: "corr_visible_chatgpt_delegation" as CorrelationId,
    stateVersionBefore: 7 as StateVersion,
    stateVersionAfter: 8 as StateVersion,
    immediateProjection: {
      kind: "ChatGptBrowserDelegationProjection",
      sessionId,
      version: 8,
      currentStatus: "waiting_for_approval",
      runs: [],
      latestRun: {
        researchTaskId: "research_task_visible_chatgpt"
      }
    }
  };
}

type ResearchActions = ReturnType<typeof useDecisionQueueResearchActions>;

function captureResearchActions(overrides: Partial<Parameters<typeof useDecisionQueueResearchActions>[0]> = {}) {
  let actions: ResearchActions | undefined;
  const defaultProps: Parameters<typeof useDecisionQueueResearchActions>[0] = {
    appendCommand: vi.fn(),
    client: {
      getResearchRunStatus: vi.fn(async () => researchRunProjection())
    } as unknown as SidecarClient,
    copy: DECISION_QUEUE_COPY.en,
    projections: {
      ...emptyProjectionState(),
      session: {
        kind: "SessionShellProjection",
        projectId,
        sessionId,
        version: 1 as ProjectionVersion,
        phase: "spec",
        projectPurposeMode: "business",
        projectPurposeModeSelectionStatus: "confirmed",
        projectPurposeModeLabel: "Business validation",
        projectPurposeModeEffect: "Business validation mode keeps commercialization gates active."
      }
    },
    refreshProjections: vi.fn(async () => undefined),
    refreshResearchOperations: vi.fn(async () => undefined),
    researchOperations: emptyResearchOperationsState(),
    setIsBusy: vi.fn(),
    setProjections: vi.fn(),
    setResearchOperations: vi.fn(),
    setWorkflowError: vi.fn(),
    ...overrides
  };

  function Harness() {
    actions = useDecisionQueueResearchActions(defaultProps);
    return null;
  }

  renderToStaticMarkup(<Harness />);

  if (!actions) {
    throw new Error("Research actions were not captured.");
  }

  return {
    actions,
    props: defaultProps
  };
}

describe("useDecisionQueueResearchActions", () => {
  it("refreshes canonical queue and research projections after research-run status polling", async () => {
    const { actions, props } = captureResearchActions();

    await actions.refreshResearchRunStatus(researchRunId);

    expect(props.client?.getResearchRunStatus).toHaveBeenCalledWith(projectId, researchRunId);
    expect(props.setResearchOperations).toHaveBeenCalledWith(expect.any(Function));
    expect(props.refreshProjections).toHaveBeenCalledWith(projectId, sessionId);
    expect(props.setWorkflowError).toHaveBeenCalledTimes(1);
    expect(props.setWorkflowError).toHaveBeenCalledWith(null);
  });

  it("continues ready background research tasks after a refreshed run reaches a terminal status", async () => {
    const followUpResearchTaskId = "research_task_followup_after_terminal_run" as ResearchTaskId;
    const latestResearch = researchEvidenceProjection({
      researchTaskId: followUpResearchTaskId,
      objective: "Check the next source-traced question after the completed research run."
    });
    const terminalRuns = researchRunProjectionWithSelectedRun("accepted");
    const startResearchRun = vi.fn(async () => researchRunCommandResponse());
    const appendCommandCalls = vi.fn();
    const appendCommand: Parameters<typeof useDecisionQueueResearchActions>[0]["appendCommand"] = async (
      label,
      response
    ) => {
      appendCommandCalls(label, response);

      return response;
    };
    const { actions, props } = captureResearchActions({
      appendCommand,
      client: {
        getResearchRunStatus: vi.fn(async () => terminalRuns),
        listResearchAllowlists: vi.fn(async () => allowlistProjection()),
        getResearch: vi.fn(async () => latestResearch),
        listResearchRuns: vi.fn(async () => terminalRuns),
        startResearchRun
      } as unknown as SidecarClient
    });

    await actions.refreshResearchRunStatus(researchRunId);

    expect(props.client?.getResearchRunStatus).toHaveBeenCalledWith(projectId, researchRunId);
    expect(props.client?.getResearch).toHaveBeenCalledWith(sessionId);
    expect(startResearchRun).toHaveBeenCalledWith(projectId, expect.objectContaining({
      researchTaskId: followUpResearchTaskId,
      allowlistId,
      adapterKind: "web_search_readonly",
      researchObjective: "Check the next source-traced question after the completed research run."
    }));
    expect(appendCommandCalls).toHaveBeenCalledWith("Start background public web research run 1/1", expect.any(Object));
    expect(props.refreshProjections).toHaveBeenCalledWith(projectId, sessionId);
    expect(props.setWorkflowError).toHaveBeenCalledWith(null);
  });

  it("updates active allowlist concurrency so manual and answer-triggered research starts use the new budget", async () => {
    const updatedProjection = allowlistProjection(4);
    const updateResearchAllowlist = vi.fn(async () => allowlistCommandResponse(updatedProjection));
    const appendCommandCalls = vi.fn();
    const appendCommand: Parameters<typeof useDecisionQueueResearchActions>[0]["appendCommand"] = async (
      label,
      response
    ) => {
      appendCommandCalls(label, response);

      return response;
    };
    const { actions, props } = captureResearchActions({
      appendCommand,
      client: {
        updateResearchAllowlist,
        getResearchRunStatus: vi.fn(async () => researchRunProjection())
      } as unknown as SidecarClient,
      researchOperations: {
        ...emptyResearchOperationsState(),
        allowlists: allowlistProjection(2)
      }
    });

    await actions.updateAllowlistMaxConcurrentRuns(allowlistId, 4);

    expect(updateResearchAllowlist).toHaveBeenCalledWith(projectId, allowlistId, {
      rateBudgetPolicy: expect.objectContaining({
        maxConcurrentRunsPerProject: 4,
        maxRunsPerSession: 4
      })
    });
    expect(appendCommandCalls).toHaveBeenCalledWith("Update research run limit", expect.any(Object));
    expect(props.setResearchOperations).toHaveBeenCalledWith(expect.any(Function));
    expect(props.refreshResearchOperations).toHaveBeenCalledWith(projectId);
    expect(props.setWorkflowError).toHaveBeenCalledWith(null);
  });

  it("starts ready public-web research tasks immediately after the allowlist is activated", async () => {
    const createResearchAllowlist = vi.fn(async () => allowlistCommandResponse());
    const listResearchRuns = vi.fn(async () => researchRunProjection());
    const startResearchRun = vi.fn(async () => researchRunCommandResponse());
    const appendCommandCalls = vi.fn();
    const appendCommand: Parameters<typeof useDecisionQueueResearchActions>[0]["appendCommand"] = async (
      label,
      response
    ) => {
      appendCommandCalls(label, response);

      return response;
    };
    const { actions, props } = captureResearchActions({
      appendCommand,
      client: {
        createResearchAllowlist,
        listResearchRuns,
        startResearchRun,
        getResearchRunStatus: vi.fn(async () => researchRunProjection())
      } as unknown as SidecarClient,
      projections: {
        ...emptyProjectionState(),
        session: {
          kind: "SessionShellProjection",
          projectId,
          sessionId,
          version: 1 as ProjectionVersion,
          phase: "validation",
          projectPurposeMode: "business",
          projectPurposeModeSelectionStatus: "confirmed",
          projectPurposeModeLabel: "Business validation",
          projectPurposeModeEffect: "Business validation mode keeps commercialization gates active."
        },
        spec: {
          kind: "LivingSpecProjection",
          sessionId,
          version: 2 as ProjectionVersion,
          title: "Pet lifecycle manager",
          sections: ["Pet medical, feeding, daily care, insurance, and funeral records in one place."],
          sectionCount: 1,
          approvalStatus: "draft"
        },
        research: researchEvidenceProjection()
      }
    });

    await actions.createOrReactivateAllowlist();

    expect(createResearchAllowlist).toHaveBeenCalledWith(projectId, expect.objectContaining({
      allowlistId: expect.any(String),
      connectorIds: ["public_search"],
      sourceCategories: ["public_web"]
    }));
    expect(listResearchRuns).toHaveBeenCalledWith(projectId);
    expect(startResearchRun).toHaveBeenCalledWith(projectId, expect.objectContaining({
      researchTaskId: "research_task_visible_chatgpt",
      allowlistId,
      adapterKind: "web_search_readonly",
      researchObjective: "기존 대안이 무엇인지 짧게 공개 검색으로 확인합니다.",
      productCategory: "Pet lifecycle manager",
      customerProblemHypothesis: expect.stringContaining("insurance")
    }));
    expect(appendCommandCalls).toHaveBeenCalledWith("Create research allowlist", expect.any(Object));
    expect(appendCommandCalls).toHaveBeenCalledWith("Start background public web research run 1/1", expect.any(Object));
    expect(props.setResearchOperations).toHaveBeenCalledWith(expect.any(Function));
    expect(props.refreshProjections).toHaveBeenCalledWith(projectId, sessionId);
    expect(props.refreshResearchOperations).toHaveBeenCalledWith(projectId);
    expect(props.setWorkflowError).toHaveBeenCalledWith(null);
  });

  it("blocks manual public-web research starts when the task needs more clarification first", async () => {
    const startResearchRun = vi.fn();
    const { actions, props } = captureResearchActions({
      client: {
        startResearchRun,
        getResearchRunStatus: vi.fn(async () => researchRunProjection())
      } as unknown as SidecarClient,
      researchOperations: {
        ...emptyResearchOperationsState(),
        allowlists: allowlistProjection()
      },
      projections: {
        ...emptyProjectionState(),
        session: {
          kind: "SessionShellProjection",
          projectId,
          sessionId,
          version: 1 as ProjectionVersion,
          phase: "validation",
          projectPurposeMode: "business",
          projectPurposeModeSelectionStatus: "confirmed",
          projectPurposeModeLabel: "Business validation",
          projectPurposeModeEffect: "Business validation mode keeps commercialization gates active."
        },
        research: researchEvidenceProjection({
          objective: "첫 사용자 상황을 더 구체화해야 합니다."
        })
      }
    });

    await actions.startReadOnlyResearchRun("research_task_visible_chatgpt" as ResearchTaskId);

    expect(startResearchRun).not.toHaveBeenCalled();
    expect(props.setWorkflowError).toHaveBeenCalledWith(
      DECISION_QUEUE_COPY.en.research.researchActionErrors.readyRunsNoReadyTasks
    );
  });

  it("does not start Browser/Deep Research tasks as public-web quick searches", async () => {
    const startResearchRun = vi.fn();
    const { actions, props } = captureResearchActions({
      client: {
        startResearchRun,
        getResearchRunStatus: vi.fn(async () => researchRunProjection())
      } as unknown as SidecarClient,
      researchOperations: {
        ...emptyResearchOperationsState(),
        allowlists: allowlistProjection()
      },
      projections: {
        ...emptyProjectionState(),
        session: {
          kind: "SessionShellProjection",
          projectId,
          sessionId,
          version: 1 as ProjectionVersion,
          phase: "validation",
          projectPurposeMode: "business",
          projectPurposeModeSelectionStatus: "confirmed",
          projectPurposeModeLabel: "Business validation",
          projectPurposeModeEffect: "Business validation mode keeps commercialization gates active."
        },
        research: researchEvidenceProjection({
          objective: "여러 출처를 비교해 가능한 사용자 미래, 대표 사용 케이스, 기존 대안을 종합합니다."
        })
      }
    });

    await actions.startReadOnlyResearchRun("research_task_visible_chatgpt" as ResearchTaskId);

    expect(startResearchRun).not.toHaveBeenCalled();
    expect(props.setWorkflowError).toHaveBeenCalledWith(
      DECISION_QUEUE_COPY.en.research.researchActionErrors.readyRunsNoReadyTasks
    );
  });

  it("updates the per-session research run limit without changing the simultaneous run limit", async () => {
    const updatedProjection = allowlistProjection(2, 8);
    const updateResearchAllowlist = vi.fn(async () => allowlistCommandResponse(updatedProjection));
    const appendCommandCalls = vi.fn();
    const appendCommand: Parameters<typeof useDecisionQueueResearchActions>[0]["appendCommand"] = async (
      label,
      response
    ) => {
      appendCommandCalls(label, response);

      return response;
    };
    const { actions, props } = captureResearchActions({
      appendCommand,
      client: {
        updateResearchAllowlist,
        getResearchRunStatus: vi.fn(async () => researchRunProjection())
      } as unknown as SidecarClient,
      researchOperations: {
        ...emptyResearchOperationsState(),
        allowlists: allowlistProjection(2, 3)
      }
    });

    await actions.updateAllowlistMaxRunsPerSession(allowlistId, 8);

    expect(updateResearchAllowlist).toHaveBeenCalledWith(projectId, allowlistId, {
      rateBudgetPolicy: expect.objectContaining({
        maxConcurrentRunsPerProject: 2,
        maxRunsPerSession: 8
      })
    });
    expect(appendCommandCalls).toHaveBeenCalledWith("Update session research limit", expect.any(Object));
    expect(props.setResearchOperations).toHaveBeenCalledWith(expect.any(Function));
    expect(props.refreshResearchOperations).toHaveBeenCalledWith(projectId);
    expect(props.setWorkflowError).toHaveBeenCalledWith(null);
  });

  it("rejects fractional allowlist concurrency values before mutating the allowlist", async () => {
    const updateResearchAllowlist = vi.fn();
    const { actions, props } = captureResearchActions({
      client: {
        updateResearchAllowlist,
        getResearchRunStatus: vi.fn(async () => researchRunProjection())
      } as unknown as SidecarClient,
      researchOperations: {
        ...emptyResearchOperationsState(),
        allowlists: allowlistProjection(2)
      }
    });

    await actions.updateAllowlistMaxConcurrentRuns(allowlistId, 2.5);

    expect(updateResearchAllowlist).not.toHaveBeenCalled();
    expect(props.setWorkflowError).toHaveBeenCalledWith(
      "Max simultaneous research runs must be a positive whole number."
    );
  });

  it("rejects per-session research run limits below the simultaneous run limit", async () => {
    const updateResearchAllowlist = vi.fn();
    const { actions, props } = captureResearchActions({
      client: {
        updateResearchAllowlist,
        getResearchRunStatus: vi.fn(async () => researchRunProjection())
      } as unknown as SidecarClient,
      researchOperations: {
        ...emptyResearchOperationsState(),
        allowlists: allowlistProjection(3, 6)
      }
    });

    await actions.updateAllowlistMaxRunsPerSession(allowlistId, 2);

    expect(updateResearchAllowlist).not.toHaveBeenCalled();
    expect(props.setWorkflowError).toHaveBeenCalledWith(
      "Max research runs per session must be a whole number greater than or equal to the simultaneous run limit."
    );
  });

  it("prepares visible ChatGPT research handoff previews for newly planned tasks after answers", async () => {
    const latestResearch = researchEvidenceProjection({
      objective: "여러 출처를 비교해 가능한 사용자 미래, 대표 사용 케이스, 기존 대안을 종합합니다."
    });
    const createChatGptBrowserDelegationRun = vi.fn(async (request: unknown) => {
      void request;

      return chatGptDelegationCommandResponse();
    });
    const appendCommandCalls = vi.fn();
    const appendCommand: Parameters<typeof useDecisionQueueResearchActions>[0]["appendCommand"] = async (
      label,
      response
    ) => {
      appendCommandCalls(label, response);

      return response;
    };
    const { actions, props } = captureResearchActions({
      appendCommand,
      client: {
        listResearchAllowlists: vi.fn(async () => ({
          ...allowlistProjection(),
          allowlists: [],
          automaticRunStartPolicies: []
        })),
        getResearch: vi.fn(async () => latestResearch),
        listResearchRuns: vi.fn(async () => researchRunProjection()),
        getChatGptBrowserDelegation: vi.fn(async () => null),
        createChatGptBrowserDelegationRun,
        getResearchRunStatus: vi.fn(async () => researchRunProjection())
      } as unknown as SidecarClient,
      projections: {
        ...emptyProjectionState(),
        session: {
          kind: "SessionShellProjection",
          projectId,
          sessionId,
          version: 1 as ProjectionVersion,
          phase: "validation",
          projectPurposeMode: "business",
          projectPurposeModeSelectionStatus: "confirmed",
          projectPurposeModeLabel: "Business validation",
          projectPurposeModeEffect: "Business validation mode keeps commercialization gates active.",
          initialResearchAutomationPermission: "allow_codex_and_chatgpt_visible"
        }
      }
    });

    await actions.startReadyReadOnlyResearchRunsAfterAnswer();

    expect(props.client?.getChatGptBrowserDelegation).toHaveBeenCalledWith(sessionId);
    expect(createChatGptBrowserDelegationRun).toHaveBeenCalledWith(expect.objectContaining({
      sessionId,
      expectedStateVersion: 7,
      researchTaskId: "research_task_visible_chatgpt",
      approvalDecision: "pending",
      dataDisclosurePreview: expect.objectContaining({
        redactionPreviewShown: true,
        userCanEditPromptBeforeRun: true
      })
    }));
    const delegationRequest = createChatGptBrowserDelegationRun.mock.calls[0]?.[0] as
      | Readonly<Record<string, unknown>>
      | undefined;

    expect(delegationRequest).not.toHaveProperty("browserActionAuthorityRef");
    expect(appendCommandCalls).toHaveBeenCalledWith("Prepare ChatGPT research request", expect.any(Object));
    expect(props.setProjections).toHaveBeenCalledWith(expect.any(Function));
  });

  it("does not prepare ChatGPT handoff previews when onboarding kept browser research disabled", async () => {
    const createChatGptBrowserDelegationRun = vi.fn();
    const { actions, props } = captureResearchActions({
      client: {
        listResearchAllowlists: vi.fn(async () => ({
          ...allowlistProjection(),
          allowlists: [],
          automaticRunStartPolicies: []
        })),
        getResearch: vi.fn(async () => researchEvidenceProjection()),
        listResearchRuns: vi.fn(async () => researchRunProjection()),
        getChatGptBrowserDelegation: vi.fn(async () => null),
        createChatGptBrowserDelegationRun,
        getResearchRunStatus: vi.fn(async () => researchRunProjection())
      } as unknown as SidecarClient
    });

    await actions.startReadyReadOnlyResearchRunsAfterAnswer();

    expect(props.client?.getChatGptBrowserDelegation).not.toHaveBeenCalled();
    expect(createChatGptBrowserDelegationRun).not.toHaveBeenCalled();
  });
});
