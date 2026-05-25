import { describe, expect, it } from "vitest";
import type { AutoImplementationPipelineSmokeEvidence } from "./auto-implementation-pipeline-smoke";
import type { ClarificationPipelineSmokeEvidence } from "./clarification-pipeline-smoke";
import { CORE_PRODUCT_LOOP_SMOKE, runCoreProductLoopSmoke } from "./core-product-loop-smoke";
import type { ReadinessToImplementationSmokeEvidence } from "./readiness-to-implementation-smoke";
import type { ResearchPipelineSmokeEvidence } from "./research-pipeline-smoke";
import type { SingleSessionLiveImplementationSmokeEvidence } from "./single-session-live-implementation-smoke";
import type { SingleSessionProductLoopSmokeEvidence } from "./single-session-product-loop-smoke";

function clarificationEvidence(overrides: Partial<ClarificationPipelineSmokeEvidence> = {}) {
  return {
    status: "passed",
    smoke: "clarification_pipeline",
    mode: "fixture",
    project: {
      projectId: "proj_core_loop_clarification",
      sessionId: "sess_core_loop_clarification"
    },
    clarification: {
      generatedQuestionCount: 16,
      activeQuestionCount: 5,
      answeredQuestionCount: 1,
      followUpQuestionCount: 1,
      visibleQuestionDebtCount: 5,
      researchTaskCount: 1,
      firstQuestionId: "queue_core_loop_first",
      firstQuestionTopicKey: "primary_customer_narrowing",
      answerFormatKinds: ["open_text", "single_choice", "multi_select", "ranked_choice", "experiment_plan"],
      answerSelectionModes: ["single", "multiple", "ranked"],
      completenessStatus: "not_ready",
      questionDebtGatePassed: false,
      planningHandoffStatus: "source_trace_incomplete"
    },
    checked: ["clarification fixture checked"],
    ...overrides
  } satisfies ClarificationPipelineSmokeEvidence;
}

function researchEvidence(overrides: Partial<ResearchPipelineSmokeEvidence> = {}) {
  return {
    status: "passed",
    smoke: "research_pipeline",
    mode: "fixture",
    project: {
      projectId: "proj_core_loop_research",
      sessionId: "sess_core_loop_research"
    },
    research: {
      allowlistId: "allowlist_core_loop",
      researchRunId: "research_run_core_loop",
      researchTaskId: "research_task_core_loop",
      runStatus: "research_insufficient",
      providerAdapterKind: "web_search_readonly",
      qualityGateStatus: "insufficient",
      sourceRefCount: 3,
      matrixBalanceStatus: "missing_con_evidence",
      evidencePackGateStatus: "research_insufficient",
      reviewCardState: "research_insufficient",
      followUpQuestionCount: 1,
      followUpResearchTaskCount: 1,
      queueBlockedCount: 2,
      researchMemorySourceRefCount: 1,
      followUpResearchSourceRefCount: 2,
      sourceUrls: [
        "https://example.com/core-loop-research",
        "https://example.org/core-loop-counterpoint"
      ]
    },
    checked: ["research fixture checked"],
    ...overrides
  } satisfies ResearchPipelineSmokeEvidence;
}

function autoImplementationEvidence(overrides: Partial<AutoImplementationPipelineSmokeEvidence> = {}) {
  return {
    status: "passed",
    smoke: "auto_implementation_pipeline",
    mode: "fixture",
    stages: {
      runtimePreviewTurn: {
        status: "passed",
        smoke: "codex_runtime_preview_turn",
        mode: "fixture",
        runtime: {
          status: "available",
          executionMode: "fixture",
          liveTurnExecutionEnabled: false,
          accountStatus: "authenticated"
        },
        preview: {
          sessionId: "sess_core_loop_preview",
          commandStatus: "complete",
          effectStatus: "succeeded",
          artifactKind: "ImplementationPlanPreviewArtifact",
          artifactStatus: "preview_ready",
          artifactSource: "protocol_fixture",
          applyPolicy: "note_only"
        },
        checked: ["runtime preview checked"]
      },
      workerJob: {
        status: "passed",
        smoke: "auto_implementation_worker_job",
        mode: "fixture",
        runtime: {
          status: "available",
          executionMode: "fixture",
          liveTurnExecutionEnabled: false,
          accountStatus: "authenticated"
        },
        worker: {
          runId: "auto_run_core_loop_worker",
          jobId: "auto-worker-job:core-loop",
          jobStatus: "completed",
          stageBefore: "initial_pr",
          stageAfter: "code_review_fix_1",
          ledgerStatus: "completed",
          implementationStepId: "auto-implementation-step:core-loop",
          projectFolderName: "core-loop-demo",
          issueRelativePath: "implementation-issues/001-initial_pr.md"
        },
        checked: ["worker job checked"]
      },
      prMutation: {
        status: "passed",
        smoke: "auto_implementation_pr_mutation",
        mode: "fixture",
        prMutation: {
          runId: "auto_run_core_loop_pr",
          projectFolderName: "core-loop-demo",
          pullRequestUrl: "https://github.com/bee-community-master/generated-demo/pull/1",
          blockedOpenReason: "blocked before evidence",
          openStatus: "applied",
          bodyUpdateStatus: "applied",
          blockedBeforeFinalVerifyReason: "blocked before final verify",
          blockedMissingBodyReason: "blocked without body evidence",
          mergeStatus: "applied",
          duplicateMergeReason: "duplicate merge blocked",
          adapterActions: ["open_pr", "update_pr_body", "merge_pr"],
          bodyMarkdownChecks: ["update body includes verification commands"]
        },
        checked: ["PR mutation checked"]
      },
      reviewLoop: {
        status: "passed",
        smoke: "auto_implementation_review_loop",
        mode: "fixture",
        run: {
          runId: "auto_run_core_loop_review",
          finalStatus: "completed",
          finalStage: "merge_main",
          completedStageCount: 7,
          projectFolderName: "core-loop-demo",
          stages: []
        },
        checked: ["review loop checked"]
      }
    },
    checked: ["auto implementation pipeline checked"],
    ...overrides
  } satisfies AutoImplementationPipelineSmokeEvidence;
}

function readinessToImplementationEvidence(overrides: Partial<ReadinessToImplementationSmokeEvidence> = {}) {
  return {
    status: "passed",
    smoke: "readiness_to_implementation",
    mode: "fixture",
    project: {
      projectId: "proj_core_loop_readiness",
      sessionId: "sess_core_loop_readiness"
    },
    readiness: {
      compositeScore: 92,
      readinessLabel: "spec_ready",
      completionCandidateStatus: "candidate",
      passedGateCount: 1,
      planningHandoffStatus: "planning_ready",
      planningArtifactId: "handoff_core_loop_readiness",
      planningSourceRefTypes: [
        "spec_version",
        "completion_candidate",
        "decision_linked_evidence_pack",
        "research_updated_queue_item"
      ]
    },
    implementation: {
      runId: "auto_run_core_loop_readiness",
      status: "pending",
      currentStage: "initial_pr",
      initialStageStatus: "ready",
      stageCount: 7,
      projectFolderName: "core-loop-readiness-demo",
      remoteStatus: "no_remote"
    },
    checked: ["readiness-to-implementation checked"],
    ...overrides
  } satisfies ReadinessToImplementationSmokeEvidence;
}

function singleSessionEvidence(overrides: Partial<SingleSessionProductLoopSmokeEvidence> = {}) {
  return {
    status: "passed",
    smoke: "single_session_product_loop",
    mode: "fixture",
    project: {
      projectId: "proj_core_loop_single_session",
      sessionId: "sess_core_loop_single_session"
    },
    loop: {
      generatedQuestionCount: 15,
      activeQuestionCount: 5,
      firstQuestionId: "queue_core_loop_pet_first",
      firstQuestionTopicKey: "primary_customer_narrowing",
      petDomainQuestionSignalCount: 8,
      staleFounderOptionCount: 0,
      answeredQuestionCount: 1,
      answerLinkedResearchTaskId: "research_task_core_loop_pet",
      providerRunStatus: "research_insufficient",
      providerAdapterKind: "web_search_readonly",
      providerSourceRefCount: 3,
      providerSourceUrls: [
        "https://example.com/core-loop-pet-research",
        "https://example.org/core-loop-pet-insurance"
      ],
      followUpQuestionCount: 1,
      followUpResearchTaskCount: 0,
      readinessCompositeScore: 92,
      readinessLabel: "spec_ready",
      completionCandidateStatus: "candidate",
      planningHandoffStatus: "planning_ready",
      planningArtifactId: "handoff_core_loop_pet",
      autoImplementationRunId: "auto_run_core_loop_pet",
      autoImplementationStatus: "pending",
      autoImplementationCurrentStage: "initial_pr",
      autoImplementationStageCount: 7
    },
    checked: ["single-session product loop checked"],
    ...overrides
  } satisfies SingleSessionProductLoopSmokeEvidence;
}

function singleSessionImplementationEvidence(overrides: Partial<SingleSessionLiveImplementationSmokeEvidence> = {}) {
  return {
    status: "passed",
    smoke: "single_session_live_implementation",
    mode: "fixture",
    singleSession: singleSessionEvidence(),
    project: {
      projectId: "proj_core_loop_single_session",
      sessionId: "sess_core_loop_single_session"
    },
    runtime: {
      status: "available",
      executionMode: "fixture",
      liveTurnExecutionEnabled: false,
      accountStatus: "authenticated"
    },
    worker: {
      runId: "auto_run_core_loop_pet",
      jobId: "auto-worker-job:core-loop-same-session",
      sameSessionRunId: "auto_run_core_loop_pet",
      jobStatus: "completed",
      stageBefore: "initial_pr",
      stageAfter: "code_review_fix_1",
      ledgerStatus: "completed",
      implementationStepId: "auto-implementation-step:core-loop-same-session",
      issueRelativePath: "implementation-issues/001-initial_pr.md"
    },
    checked: ["single-session implementation worker checked"],
    ...overrides
  } satisfies SingleSessionLiveImplementationSmokeEvidence;
}

describe("core product loop smoke", () => {
  it("passes only when single-session, clarification, research, readiness, and auto implementation evidence form one complete product loop", async () => {
    const evidence = await runCoreProductLoopSmoke({
      runSingleSession: async () => singleSessionEvidence(),
      runSingleSessionImplementation: async () => singleSessionImplementationEvidence(),
      runClarification: async () => clarificationEvidence(),
      runResearch: async () => researchEvidence(),
      runReadinessToImplementation: async () => readinessToImplementationEvidence(),
      runAutoImplementation: async () => autoImplementationEvidence()
    });

    expect(evidence).toMatchObject({
      status: "passed",
      smoke: CORE_PRODUCT_LOOP_SMOKE,
      loop: {
        generatedQuestionCount: 16,
        answeredQuestionCount: 1,
        clarificationResearchTaskCount: 1,
        researchFollowUpQuestionCount: 1,
        researchFollowUpTaskCount: 1,
        generatedFollowUpResearchSourceRefCount: 2,
        singleSessionGeneratedQuestionCount: 15,
        singleSessionPetDomainQuestionSignalCount: 8,
        singleSessionFollowUpQuestionCount: 1,
        singleSessionPlanningHandoffStatus: "planning_ready",
        singleSessionAutoImplementationCurrentStage: "initial_pr",
        sameSessionWorkerStageAfter: "code_review_fix_1",
        sameSessionWorkerLedgerStatus: "completed",
        readinessCompositeScore: 92,
        readinessLabel: "spec_ready",
        completionCandidateStatus: "candidate",
        planningHandoffStatus: "planning_ready",
        readinessImplementationStatus: "pending",
        readinessImplementationCurrentStage: "initial_pr",
        readinessImplementationStageCount: 7,
        autoImplementationCompletedStageCount: 7,
        autoImplementationFinalStatus: "completed",
        prMutationMergeStatus: "applied"
      }
    });
    expect(evidence.checked).toEqual(expect.arrayContaining([
      "idea intake reached a broad generated question backlog before implementation",
      "single-session pet-lifecycle idea reached domain-fit questions, answer-linked research, follow-up questions, planning_ready, and initial_pr",
      "same-session worker proof reused the Planning Handoff run and advanced beyond initial_pr with completed ledger evidence",
      "positive readiness handoff proved spec_ready candidate, planning_ready artifact, and initial_pr auto implementation start",
      "auto implementation pipeline reached runtime preview, worker ledger import, PR mutation, review-loop, and merge_main fixture evidence"
    ]));
  });

  it("blocks when research does not create generated follow-up research debt", async () => {
    const evidence = await runCoreProductLoopSmoke({
      runSingleSession: async () => singleSessionEvidence(),
      runSingleSessionImplementation: async () => singleSessionImplementationEvidence(),
      runClarification: async () => clarificationEvidence(),
      runResearch: async () => researchEvidence({
        research: {
          ...researchEvidence().research!,
          followUpQuestionCount: 0,
          followUpResearchTaskCount: 0,
          followUpResearchSourceRefCount: 0
        }
      }),
      runReadinessToImplementation: async () => readinessToImplementationEvidence(),
      runAutoImplementation: async () => autoImplementationEvidence()
    });

    expect(evidence.status).toBe("blocked");
    expect(evidence.blockers).toEqual(expect.arrayContaining([
      "core loop must turn research evidence into follow-up question debt.",
      "core loop must create generated follow-up research tasks after evidence synthesis.",
      "core loop must attach prior source refs/memory to generated follow-up research runs."
    ]));
  });

  it("blocks when readiness does not produce a planning-ready implementation handoff", async () => {
    const evidence = await runCoreProductLoopSmoke({
      runSingleSession: async () => singleSessionEvidence(),
      runSingleSessionImplementation: async () => singleSessionImplementationEvidence(),
      runClarification: async () => clarificationEvidence(),
      runResearch: async () => researchEvidence(),
      runReadinessToImplementation: async () => readinessToImplementationEvidence({
        readiness: {
          ...readinessToImplementationEvidence().readiness!,
          compositeScore: 72,
          readinessLabel: "needs_validation",
          completionCandidateStatus: "not_ready",
          planningHandoffStatus: "source_trace_incomplete"
        },
        implementation: {
          ...readinessToImplementationEvidence().implementation!,
          status: "blocked",
          currentStage: "planning_handoff"
        }
      }),
      runAutoImplementation: async () => autoImplementationEvidence()
    });

    expect(evidence.status).toBe("blocked");
    expect(evidence.blockers).toEqual(expect.arrayContaining([
      "core loop readiness score must reach 85 before implementation; received 72",
      "core loop readiness label must be spec_ready; received needs_validation",
      "core loop completion candidate must be candidate before Planning Handoff; received not_ready",
      "core loop must produce a planning_ready handoff before implementation; received source_trace_incomplete",
      "core loop readiness handoff must start an implementation run in pending state; received blocked",
      "core loop readiness handoff must start at initial_pr; received planning_handoff"
    ]));
  });

  it("blocks when the single-session flow loses domain-fit questions or implementation handoff", async () => {
    const evidence = await runCoreProductLoopSmoke({
      runSingleSession: async () => singleSessionEvidence({
        loop: {
          ...singleSessionEvidence().loop!,
          petDomainQuestionSignalCount: 1,
          followUpQuestionCount: 0,
          planningHandoffStatus: "source_trace_incomplete",
          autoImplementationCurrentStage: "planning_handoff"
        }
      }),
      runSingleSessionImplementation: async () => singleSessionImplementationEvidence(),
      runClarification: async () => clarificationEvidence(),
      runResearch: async () => researchEvidence(),
      runReadinessToImplementation: async () => readinessToImplementationEvidence(),
      runAutoImplementation: async () => autoImplementationEvidence()
    });

    expect(evidence.status).toBe("blocked");
    expect(evidence.blockers).toEqual(expect.arrayContaining([
      "single-session core loop must keep generated questions fitted to the pet lifecycle idea; received 1",
      "single-session core loop must generate research follow-up questions in the same session.",
      "single-session core loop must reach planning_ready; received source_trace_incomplete",
      "single-session core loop must start auto implementation at initial_pr; received planning_handoff"
    ]));
  });

  it("blocks when the same-session worker proof does not complete ledger evidence", async () => {
    const evidence = await runCoreProductLoopSmoke({
      runSingleSession: async () => singleSessionEvidence(),
      runSingleSessionImplementation: async () => singleSessionImplementationEvidence({
        worker: {
          ...singleSessionImplementationEvidence().worker!,
          jobStatus: "blocked",
          stageAfter: "initial_pr",
          ledgerStatus: "missing"
        }
      }),
      runClarification: async () => clarificationEvidence(),
      runResearch: async () => researchEvidence(),
      runReadinessToImplementation: async () => readinessToImplementationEvidence(),
      runAutoImplementation: async () => autoImplementationEvidence()
    });

    expect(evidence.status).toBe("blocked");
    expect(evidence.blockers).toEqual(expect.arrayContaining([
      "single-session worker proof must complete an implementation ledger; received missing",
      "single-session worker proof must advance beyond initial_pr; received initial_pr"
    ]));
  });
});
