import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  CONTRACT_SCHEMA_VERSION,
  type CommandId,
  type CorrelationId,
  type ProjectId,
  type QueueItemId,
  type SessionId,
  type StateVersion
} from "@solo-superman/contracts";
import {
  createInitialProductEngineState,
  reduceProductEngineCommand,
  replayProductEngineEvents,
  sessionPhaseForProductEngineEvent,
  sessionShellPhaseForProductEnginePhase
} from "../src/product-engine";

const projectId = "proj_product_engine_test" as ProjectId;
const sessionId = "sess_product_engine_test" as SessionId;
const correlationId = "corr_product_engine_test" as CorrelationId;

function command(
  commandType: Parameters<typeof reduceProductEngineCommand>[0]["commandType"],
  expectedStateVersion: number,
  payload: Readonly<Record<string, unknown>>,
  index: number
) {
  return {
    commandId: `cmd_product_engine_${index}` as CommandId,
    commandType,
    projectId,
    sessionId,
    actor: "user",
    issuedAt: `2026-05-05T00:00:0${index}.000Z`,
    idempotencyKey: `${commandType}:${index}`,
    expectedStateVersion: expectedStateVersion as StateVersion,
    causationId: index === 1 ? null : (`cmd_product_engine_${index - 1}` as CommandId),
    correlationId,
    schemaVersion: CONTRACT_SCHEMA_VERSION,
    payload
  } as const;
}

function effectExecutorCommand(
  commandType: Parameters<typeof reduceProductEngineCommand>[0]["commandType"],
  expectedStateVersion: number,
  payload: Readonly<Record<string, unknown>>,
  index: number
) {
  return {
    ...command(commandType, expectedStateVersion, payload, index),
    actor: "effect_executor" as const
  };
}

function stateWithActiveQuestionBatch() {
  const commands = [
    command("StartProject", 0, {
      rawIdea: "A focused founder brief generator",
      localPrivacyMode: "local_only"
    }, 1),
    command("CaptureIntake", 1, {
      answer: "Help solo founders turn a rough idea into a traceable product spec."
    }, 2),
    command("DraftInitialSpec", 2, {}, 3),
    command("AnalyzeAmbiguity", 3, {
      targetRef: "current_spec"
    }, 4),
    command("ActivateQuestionBatch", 4, {}, 5)
  ] as const;
  let state = createInitialProductEngineState(projectId, sessionId);
  const eventDrafts = [];

  for (const nextCommand of commands) {
    const reduction = reduceProductEngineCommand(nextCommand, state);

    expect(reduction.accepted).toBe(true);
    eventDrafts.push(reduction.events[0]);
    state = replayProductEngineEvents(
      projectId,
      sessionId,
      eventDrafts.map((eventDraft, index) => ({
        ...eventDraft,
        eventId: `evt_active_batch_${index + 1}`,
        sequence: index + 1,
        occurredAt: `2026-05-05T00:00:${index + 1}0.000Z`
      }))
    );
  }

  return { state, eventDrafts } as const;
}

describe("PR-04 ProductEngine reducer", () => {
  it("keeps the reducer source free of runtime, DB, Hono, Tauri, filesystem, shell, browser, and network imports", () => {
    const sourcePath = fileURLToPath(new URL("../src/product-engine/index.ts", import.meta.url));
    const source = readFileSync(sourcePath, "utf8");

    expect(source).not.toMatch(/from ["'](?:hono|@hono\/|@solo-superman\/db|drizzle-orm|@tauri-apps\/|node:|fs|http|https)/);
    expect(source).not.toMatch(/(?:fetch|new WebSocket|document\.|window\.|child_process|exec\()/);
  });

  it("runs the deterministic first command path and returns an active-batch-safe projection", () => {
    const commands = [
      command("StartProject", 0, {
        rawIdea: "A focused founder brief generator",
        localPrivacyMode: "local_only"
      }, 1),
      command("CaptureIntake", 1, {
        answer: "Help solo founders turn a rough idea into a traceable product spec."
      }, 2),
      command("DraftInitialSpec", 2, {}, 3),
      command("AnalyzeAmbiguity", 3, {
        targetRef: "current_spec"
      }, 4),
      command("ActivateQuestionBatch", 4, {}, 5)
    ] as const;
    let state = createInitialProductEngineState(projectId, sessionId);
    const eventDrafts = [];

    for (const nextCommand of commands) {
      const reduction = reduceProductEngineCommand(nextCommand, state);

      expect(reduction.accepted).toBe(true);
      expect(reduction.events).toHaveLength(1);
      expect(reduction.nextState).toMatchObject({
        stateVersion: nextCommand.expectedStateVersion + 1
      });
      eventDrafts.push(reduction.events[0]);
      state = replayProductEngineEvents(
        projectId,
        sessionId,
        eventDrafts.map((eventDraft, index) => ({
          ...eventDraft,
          eventId: `evt_product_engine_${index + 1}`,
          sequence: index + 1,
          occurredAt: `2026-05-05T00:00:${index + 1}0.000Z`
        }))
      );
    }

    expect(state.livingSpecProjection).toMatchObject({
      title: "초기 제품 스펙 초안: A focused founder brief generator",
      sections: ["Problem", "Target customer", "Value proposition", "Validation risks"],
      sectionCount: 4
    });
    expect(state.queueProjection.active).toHaveLength(4);
    expect(state.queueProjection.active.every((item) => item.state === "active")).toBe(true);
    expect(state.queueProjection.next).toEqual([]);
    expect(state.session.phase).toBe("question_loop");
  });

  it("replays the start-project session shell projection from the event log", () => {
    const startProject = command("StartProject", 0, {
      rawIdea: "A replayable founder brief generator",
      localPrivacyMode: "local_only"
    }, 1);
    const reduction = reduceProductEngineCommand(startProject, createInitialProductEngineState(projectId, sessionId));

    expect(reduction.accepted).toBe(true);

    const state = replayProductEngineEvents(projectId, sessionId, [
      {
        ...reduction.events[0],
        eventId: "evt_start_project_projection",
        sequence: 1,
        occurredAt: "2026-05-05T00:00:10.000Z"
      }
    ]);

    expect(state.sessionShellProjection).toMatchObject({
      kind: "SessionShellProjection",
      projectId,
      sessionId,
      version: 1,
      phase: "intake"
    });
  });

  it("keeps session phase mapping centralized for replay and sidecar shell projections", () => {
    const startProject = command("StartProject", 0, {
      rawIdea: "A phase mapping test idea",
      localPrivacyMode: "local_only"
    }, 1);
    const started = reduceProductEngineCommand(startProject, createInitialProductEngineState(projectId, sessionId));

    expect(started.accepted).toBe(true);
    expect(sessionPhaseForProductEngineEvent({
      ...started.events[0],
      eventId: "evt_phase_start",
      sequence: 1,
      occurredAt: "2026-05-05T00:00:10.000Z"
    })).toBe("intake");
    expect(sessionShellPhaseForProductEnginePhase("question_loop")).toBe("validation");
    expect(sessionShellPhaseForProductEnginePhase("completion")).toBe("complete");
  });

  it("defers active queue items through reducer and replay", () => {
    const { state, eventDrafts } = stateWithActiveQuestionBatch();
    const queueItemId = state.queueProjection.active[0]?.queueItemId;

    expect(queueItemId).toBeDefined();

    const reduction = reduceProductEngineCommand(
      command("DeferQueueItem", Number(state.stateVersion), {
        queueItemId,
        reason: "Need external evidence before answering."
      }, 6),
      state
    );

    expect(reduction.accepted).toBe(true);
    expect(reduction.events[0]).toMatchObject({
      eventType: "QueueItemDeferred",
      payload: {
        queueItemId,
        reason: "Need external evidence before answering."
      }
    });
    expect(reduction.immediateProjection).toMatchObject({
      deferred: [
        {
          queueItemId,
          state: "deferred"
        }
      ]
    });

    const replayed = replayProductEngineEvents(
      projectId,
      sessionId,
      [...eventDrafts, reduction.events[0]].map((eventDraft, index) => ({
        ...eventDraft,
        eventId: `evt_defer_queue_${index + 1}`,
        sequence: index + 1,
        occurredAt: `2026-05-05T00:00:${index + 1}0.000Z`
      }))
    );

    expect(replayed.openIssues.find((issue) => issue.queueItemId === queueItemId)?.status).toBe("deferred");
    expect(replayed.queueProjection.active.some((item) => item.queueItemId === queueItemId)).toBe(false);
    expect(replayed.queueProjection.deferred).toContainEqual(
      expect.objectContaining({
        queueItemId,
        state: "deferred"
      })
    );
  });

  it("dismisses active queue items through reducer and replay", () => {
    const { state, eventDrafts } = stateWithActiveQuestionBatch();
    const queueItemId = state.queueProjection.active[0]?.queueItemId;

    expect(queueItemId).toBeDefined();

    const reduction = reduceProductEngineCommand(
      command("DismissQueueItem", Number(state.stateVersion), {
        queueItemId,
        reason: "Covered by an existing founder decision."
      }, 6),
      state
    );

    expect(reduction.accepted).toBe(true);
    expect(reduction.events[0]).toMatchObject({
      eventType: "QueueItemDismissed",
      payload: {
        queueItemId,
        reason: "Covered by an existing founder decision."
      }
    });
    expect(reduction.immediateProjection).toMatchObject({
      active: expect.not.arrayContaining([
        expect.objectContaining({
          queueItemId
        })
      ])
    });

    const replayed = replayProductEngineEvents(
      projectId,
      sessionId,
      [...eventDrafts, reduction.events[0]].map((eventDraft, index) => ({
        ...eventDraft,
        eventId: `evt_dismiss_queue_${index + 1}`,
        sequence: index + 1,
        occurredAt: `2026-05-05T00:00:${index + 1}0.000Z`
      }))
    );

    expect(replayed.openIssues.find((issue) => issue.queueItemId === queueItemId)?.status).toBe("resolved");
    expect(replayed.queueProjection.active.some((item) => item.queueItemId === queueItemId)).toBe(false);
    expect(replayed.queueProjection.deferred.some((item) => item.queueItemId === queueItemId)).toBe(false);
  });

  it("rejects stale state and invalid preconditions without events or effects", () => {
    const state = createInitialProductEngineState(projectId, sessionId);
    const stale = reduceProductEngineCommand(
      command("CaptureIntake", 1, {
        answer: "This should not persist"
      }, 2),
      state
    );
    const invalidStart = reduceProductEngineCommand(
      command("StartProject", 0, {
        rawIdea: "",
        localPrivacyMode: "local_only"
      }, 1),
      state
    );

    expect(stale).toMatchObject({
      accepted: false,
      rejectionReason: {
        code: "STATE_VERSION_CONFLICT"
      },
      events: [],
      effectPlan: [],
      deterministicOutputs: []
    });
    expect(invalidStart).toMatchObject({
      accepted: false,
      rejectionReason: {
        code: "VALIDATION_FAILED"
      },
      events: [],
      effectPlan: [],
      deterministicOutputs: []
    });
  });

  it("queues durable queue projection effects only for ambiguity analysis and active batch activation", () => {
    let state = createInitialProductEngineState(projectId, sessionId);
    const persistedEvents = [];
    const commands = [
      command("StartProject", 0, {
        rawIdea: "A focused founder brief generator",
        localPrivacyMode: "local_only"
      }, 1),
      command("CaptureIntake", 1, {
        answer: "A session flow for founders."
      }, 2),
      command("DraftInitialSpec", 2, {}, 3),
      command("AnalyzeAmbiguity", 3, {
        targetRef: "current_spec"
      }, 4)
    ] as const;

    for (const nextCommand of commands) {
      const reduction = reduceProductEngineCommand(nextCommand, state);

      expect(reduction.accepted).toBe(true);
      persistedEvents.push(reduction.events[0]);
      state = replayProductEngineEvents(
        projectId,
        sessionId,
        persistedEvents.map((eventDraft, index) => ({
          ...eventDraft,
          eventId: `evt_queue_effect_${index + 1}`,
          sequence: index + 1,
          occurredAt: `2026-05-05T00:00:${index + 1}0.000Z`
        }))
      );

      if (nextCommand.commandType === "AnalyzeAmbiguity") {
        expect(reduction.effectPlan).toMatchObject([
          {
            effectType: "queue_projection_effect",
            sourceEventTypes: ["AmbiguityAnalyzed"],
            priority: "normal"
          }
        ]);
      } else {
        expect(reduction.effectPlan).toEqual([]);
      }
    }

    const activation = reduceProductEngineCommand(command("ActivateQuestionBatch", 4, {}, 5), state);

    expect(activation.accepted).toBe(true);
    expect(activation.effectPlan).toMatchObject([
      {
        effectType: "queue_projection_effect",
        sourceEventTypes: ["QuestionBatchActivated"],
        priority: "high"
      }
    ]);
    expect(activation.immediateProjection).toMatchObject({
      kind: "DecisionQueueProjection",
      active: expect.arrayContaining([
        expect.objectContaining({
          state: "active"
        })
      ])
    });
  });

  it("activates an explicit 3 to 5 item candidate batch when more open issues exist", () => {
    const openIssues = Array.from({ length: 6 }, (_, index) => ({
      queueItemId: `queue_explicit_${index + 1}` as QueueItemId,
      summary: `Ambiguity issue ${index + 1}`,
      status: "open" as const,
      questionText: `Question ${index + 1}?`,
      sourceRef: `issue_${index + 1}`
    }));
    const state = {
      ...createInitialProductEngineState(projectId, sessionId),
      stateVersion: 4 as StateVersion,
      openIssues
    };
    const implicitActivation = reduceProductEngineCommand(command("ActivateQuestionBatch", 4, {}, 5), state);
    const selectedQueueItemIds = openIssues.slice(1, 5).map((issue) => issue.queueItemId);
    const explicitActivation = reduceProductEngineCommand(
      command("ActivateQuestionBatch", 4, {
        queueItemIds: selectedQueueItemIds
      }, 5),
      state
    );
    const missingItemActivation = reduceProductEngineCommand(
      command("ActivateQuestionBatch", 4, {
        queueItemIds: [...selectedQueueItemIds.slice(0, 3), "queue_missing" as QueueItemId]
      }, 5),
      state
    );

    expect(implicitActivation).toMatchObject({
      accepted: false,
      rejectionReason: {
        code: "COMMAND_PRECONDITION_FAILED"
      }
    });
    expect(explicitActivation.accepted).toBe(true);
    expect(explicitActivation.immediateProjection).toMatchObject({
      kind: "DecisionQueueProjection",
      active: selectedQueueItemIds.map((queueItemId) =>
        expect.objectContaining({
          queueItemId,
          state: "active"
        })
      )
    });
    expect(missingItemActivation).toMatchObject({
      accepted: false,
      rejectionReason: {
        code: "COMMAND_PRECONDITION_FAILED"
      }
    });
  });

  it("routes active question answers into durable research without replacing the active batch", () => {
    const commands = [
      command("StartProject", 0, {
        rawIdea: "A focused founder brief generator",
        localPrivacyMode: "local_only"
      }, 1),
      command("CaptureIntake", 1, {
        answer: "A session flow for founders."
      }, 2),
      command("DraftInitialSpec", 2, {}, 3),
      command("AnalyzeAmbiguity", 3, {
        targetRef: "current_spec"
      }, 4),
      command("ActivateQuestionBatch", 4, {}, 5)
    ] as const;
    let state = createInitialProductEngineState(projectId, sessionId);
    const persistedEvents = [];

    for (const nextCommand of commands) {
      const reduction = reduceProductEngineCommand(nextCommand, state);

      expect(reduction.accepted).toBe(true);
      persistedEvents.push(reduction.events[0]);
      state = replayProductEngineEvents(
        projectId,
        sessionId,
        persistedEvents.map((eventDraft, index) => ({
          ...eventDraft,
          eventId: `evt_submit_answer_setup_${index + 1}`,
          sequence: index + 1,
          occurredAt: `2026-05-05T00:00:${index + 1}0.000Z`
        }))
      );
    }

    const activeItemIds = state.queueProjection.active.map((item) => item.queueItemId);
    const answeredQueueItemId = activeItemIds[0];
    const blankAnswer = reduceProductEngineCommand(
      command("SubmitAnswer", 5, {
        queueItemId: activeItemIds[1],
        answer: "   "
      }, 6),
      state
    );
    const unknownQuestionAnswer = reduceProductEngineCommand(
      command("SubmitAnswer", 5, {
        queueItemId: "queue_missing" as QueueItemId,
        answer: "This answer must reference an active card."
      }, 6),
      state
    );
    const answer = reduceProductEngineCommand(
      command("SubmitAnswer", 5, {
        queueItemId: answeredQueueItemId,
        answer: "The first validation decision should focus on paid founder urgency."
      }, 7),
      state
    );

    expect(blankAnswer).toMatchObject({
      accepted: false,
      rejectionReason: {
        code: "VALIDATION_FAILED"
      }
    });
    expect(unknownQuestionAnswer).toMatchObject({
      accepted: false,
      rejectionReason: {
        code: "COMMAND_PRECONDITION_FAILED"
      }
    });
    expect(answer.accepted).toBe(true);
    expect(answer.effectPlan).toMatchObject([
      {
        effectType: "research_evidence_effect",
        sourceEventTypes: ["ResearchPlanned"],
        priority: "normal"
      }
    ]);
    expect(answer.events.map((event) => event.eventType)).toEqual(["AnswerSubmitted", "ResearchPlanned"]);
    expect(answer.deterministicOutputs.map((output) => output.outputType)).toEqual(
      expect.arrayContaining(["reducer_deterministic_output", "completeness_snapshot", "confidence_map"])
    );
    expect(answer.immediateProjection).toMatchObject({
      kind: "DecisionQueueProjection",
      active: [
        expect.objectContaining({
          queueItemId: answeredQueueItemId,
          state: "answered"
        }),
        ...activeItemIds.slice(1).map((queueItemId) =>
          expect.objectContaining({
            queueItemId,
            state: "active"
          })
        )
      ],
      next: [
        expect.objectContaining({
          state: "next"
        })
      ]
    });
    expect(answer.nextState).toMatchObject({
      stateVersion: 7,
      session: {
        phase: "research"
      },
      completeness: {
        kind: "ConfidenceCompletionProjection",
        version: 7,
        completionCandidate: {
          status: "not_ready"
        }
      }
    });

    const replayed = replayProductEngineEvents(projectId, sessionId, [
      ...persistedEvents.map((eventDraft, index) => ({
        ...eventDraft,
        eventId: `evt_submit_answer_replay_${index + 1}` as const,
        sequence: index + 1,
        occurredAt: `2026-05-05T00:00:${index + 1}0.000Z`
      })),
      {
        ...answer.events[0],
        eventId: "evt_submit_answer_replay_6" as const,
        sequence: 6,
        occurredAt: "2026-05-05T00:01:00.000Z"
      },
      {
        ...answer.events[1],
        eventId: "evt_submit_answer_replay_7" as const,
        sequence: 7,
        occurredAt: "2026-05-05T00:01:01.000Z"
      }
    ]);

    expect(replayed.queueProjection.active.map((item) => item.queueItemId)).toEqual(activeItemIds);
    expect(replayed.queueProjection.active[0]?.state).toBe("answered");
    expect(replayed.queueProjection.next).toHaveLength(1);
    expect(replayed.researchState.tasks).toHaveLength(1);
    expect(replayed.completeness).toMatchObject({
      kind: "ConfidenceCompletionProjection",
      version: 7,
      completionCandidate: {
        status: "not_ready"
      }
    });
    expect(replayed.researchState.reviewCards[0]).toMatchObject({
      state: "pending_manual_result",
      recoveryActions: expect.arrayContaining(["import_manual_result"])
    });
  });

  it("imports manual research and blocks high-impact pro-only evidence as known risk", () => {
    const taskId = "research_task_high_impact" as const;
    const initialState = createInitialProductEngineState(projectId, sessionId);
    const plannedTaskCommand = command("PlanResearch", 0, {
      objective: "Validate paid founder urgency",
      routeOutcome: "missing_con_evidence",
      impact: "high"
    }, 1);
    const planned = reduceProductEngineCommand(plannedTaskCommand, initialState);

    expect(planned.accepted).toBe(true);

    const plannedState = replayProductEngineEvents(projectId, sessionId, [
      {
        ...planned.events[0],
        eventId: "evt_research_plan",
        sequence: 1,
        occurredAt: "2026-05-05T00:00:00.000Z"
      }
    ]);
    const researchTaskId = plannedState.researchState.taskIds[0] ?? taskId;
    const imported = reduceProductEngineCommand(
      command("ImportResearchResult", 1, {
        researchTaskId,
        result: "Pro: founders report urgency, but no skeptical con evidence was found.",
        limitationNotes: "Counter-evidence still needs a narrower skeptical search."
      }, 2),
      plannedState
    );

    expect(imported.accepted).toBe(true);
    expect(imported.events.map((event) => event.eventType)).toEqual(["ResearchResultImported"]);
    expect(imported.effectPlan).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          effectType: "research_evidence_effect",
          sourceEventTypes: ["ResearchResultImported"],
          idempotencyKey: expect.stringMatching(/^research-result:/)
        })
      ])
    );
    expect(imported.immediateProjection).toBeUndefined();
    expect(imported.nextState).toMatchObject({
      researchState: {
        evidenceMatrices: []
      }
    });

    const importedState = replayProductEngineEvents(projectId, sessionId, [
      {
        ...planned.events[0],
        eventId: "evt_research_plan",
        sequence: 1,
        occurredAt: "2026-05-05T00:00:00.000Z"
      },
      {
        ...imported.events[0],
        eventId: "evt_research_import",
        sequence: 2,
        occurredAt: "2026-05-05T00:00:01.000Z"
      }
    ]);
    const researchResultId = importedState.researchState.results[0]?.researchResultId;
    const synthesized = reduceProductEngineCommand(
      effectExecutorCommand("SynthesizeEvidence", 2, {
        researchResultId
      }, 3),
      importedState
    );

    expect(synthesized.accepted).toBe(true);
    expect(synthesized.immediateProjection).toBeUndefined();
    expect(synthesized.deterministicOutputs.map((output) => output.outputType)).toEqual(
      expect.arrayContaining(["reducer_deterministic_output", "completeness_snapshot", "confidence_map"])
    );
    expect(synthesized.nextState).toMatchObject({
      researchState: {
        proConBalanceStatus: "missing_con_evidence",
        evidenceMatrices: [
          expect.objectContaining({
            balanceStatus: "missing_con_evidence",
            decisionBlocked: true
          })
        ],
        knownRisks: [
          expect.stringContaining("missing_con_evidence")
        ]
      },
      completeness: {
        kind: "ConfidenceCompletionProjection",
        completionCandidate: {
          status: "not_ready"
        },
        topRisks: [
          expect.stringContaining("missing_con_evidence")
        ]
      }
    });
  });

  it("recalculates research review queue state from evidence outcome instead of original route", () => {
    const { state, eventDrafts } = stateWithActiveQuestionBatch();
    const activeItem = state.queueProjection.active[0];

    expect(activeItem).toBeDefined();

    const answer = reduceProductEngineCommand(
      command("SubmitAnswer", 5, {
        queueItemId: activeItem?.queueItemId,
        answer: "Validate the paid-founder urgency claim through research."
      }, 6),
      state
    );

    expect(answer.accepted).toBe(true);

    const answeredState = replayProductEngineEvents(
      projectId,
      sessionId,
      [...eventDrafts, ...answer.events].map((eventDraft, index) => ({
        ...eventDraft,
        eventId: `evt_research_needed_queue_${index + 1}`,
        sequence: index + 1,
        occurredAt: `2026-05-05T00:01:${index + 1}0.000Z`
      }))
    );
    const researchTaskId = answeredState.researchState.taskIds[0];
    const reviewQueueItemId = `research_review_${researchTaskId}`;
    const imported = reduceProductEngineCommand(
      command("ImportResearchResult", 7, {
        researchTaskId,
        result: "Pro: founders report urgency and support paid intent. No risks were found.",
        limitationNotes: "No counter-source imported yet."
      }, 8),
      answeredState
    );

    expect(imported.accepted).toBe(true);
    expect(imported.nextState).toMatchObject({
      researchState: {
        evidenceMatrices: []
      }
    });

    const importedState = replayProductEngineEvents(
      projectId,
      sessionId,
      [...eventDrafts, ...answer.events, ...imported.events].map((eventDraft, index) => ({
        ...eventDraft,
        eventId: `evt_research_needed_import_${index + 1}`,
        sequence: index + 1,
        occurredAt: `2026-05-05T00:01:${index + 1}0.000Z`
      }))
    );
    const researchResultId = importedState.researchState.results[0]?.researchResultId;
    const synthesized = reduceProductEngineCommand(
      effectExecutorCommand("SynthesizeEvidence", 8, {
        researchResultId
      }, 9),
      importedState
    );

    expect(synthesized.accepted).toBe(true);
    expect(synthesized.nextState).toMatchObject({
      queueProjection: {
        blocked: [
          expect.objectContaining({
            queueItemId: reviewQueueItemId,
            state: "blocked",
            title: expect.stringContaining("Decision blocked")
          })
        ]
      },
      researchState: {
        evidenceMatrices: [
          expect.objectContaining({
            balanceStatus: "missing_con_evidence",
            decisionBlocked: true
          })
        ]
      }
    });
    expect((synthesized.nextState.queueProjection as typeof answeredState.queueProjection).next).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          queueItemId: reviewQueueItemId
        })
      ])
    );
  });

  it("moves a previously blocked missing-con research review to next when evidence becomes balanced", () => {
    const { state, eventDrafts } = stateWithActiveQuestionBatch();
    const activeItem = state.queueProjection.active[0];

    expect(activeItem).toBeDefined();

    const answer = reduceProductEngineCommand(
      command("SubmitAnswer", 5, {
        queueItemId: activeItem?.queueItemId,
        answer: "This answer has only positive evidence so far.",
        evidenceBalanceHint: "pro_only"
      }, 6),
      state
    );

    expect(answer.accepted).toBe(true);

    const answeredState = replayProductEngineEvents(
      projectId,
      sessionId,
      [...eventDrafts, ...answer.events].map((eventDraft, index) => ({
        ...eventDraft,
        eventId: `evt_missing_con_queue_${index + 1}`,
        sequence: index + 1,
        occurredAt: `2026-05-05T00:02:${index + 1}0.000Z`
      }))
    );
    const researchTaskId = answeredState.researchState.taskIds[0];
    const reviewQueueItemId = `research_review_${researchTaskId}`;

    expect(answeredState.queueProjection.blocked).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          queueItemId: reviewQueueItemId
        })
      ])
    );

    const imported = reduceProductEngineCommand(
      command("ImportResearchResult", 7, {
        researchTaskId,
        result: "Pro: founders report urgency and willingness to pay. Risk: replacement workflows may be good enough.",
        limitationNotes: "Manual import retained both support and counter-evidence."
      }, 8),
      answeredState
    );

    expect(imported.accepted).toBe(true);
    expect(imported.nextState).toMatchObject({
      researchState: {
        evidenceMatrices: []
      }
    });

    const importedState = replayProductEngineEvents(
      projectId,
      sessionId,
      [...eventDrafts, ...answer.events, ...imported.events].map((eventDraft, index) => ({
        ...eventDraft,
        eventId: `evt_missing_con_import_${index + 1}`,
        sequence: index + 1,
        occurredAt: `2026-05-05T00:02:${index + 1}0.000Z`
      }))
    );
    const researchResultId = importedState.researchState.results[0]?.researchResultId;
    const synthesized = reduceProductEngineCommand(
      effectExecutorCommand("SynthesizeEvidence", 8, {
        researchResultId
      }, 9),
      importedState
    );

    expect(synthesized.accepted).toBe(true);
    expect(synthesized.nextState).toMatchObject({
      queueProjection: {
        next: [
          expect.objectContaining({
            queueItemId: reviewQueueItemId,
            state: "next",
            title: expect.stringContaining("Evidence ready")
          })
        ],
        blocked: []
      },
      researchState: {
        evidenceMatrices: [
          expect.objectContaining({
            balanceStatus: "balanced",
            decisionBlocked: false,
            conEvidence: [
              expect.objectContaining({
                summary: expect.stringContaining("Risk: replacement workflows")
              })
            ]
          })
        ]
      }
    });
  });

  it("synthesizes evidence from the full imported result instead of a shortened display summary", () => {
    const plannedTaskCommand = command("PlanResearch", 0, {
      objective: "Validate whether paid founders urgently need this workflow",
      routeOutcome: "missing_con_evidence",
      impact: "high"
    }, 1);
    const planned = reduceProductEngineCommand(plannedTaskCommand, createInitialProductEngineState(projectId, sessionId));

    expect(planned.accepted).toBe(true);

    const plannedState = replayProductEngineEvents(projectId, sessionId, [
      {
        ...planned.events[0],
        eventId: "evt_full_result_plan",
        sequence: 1,
        occurredAt: "2026-05-05T00:03:00.000Z"
      }
    ]);
    const researchTaskId = plannedState.researchState.taskIds[0];
    const longPositiveLead = `${"Pro: founder interviews support urgent paid demand. ".repeat(8)}This lead is intentionally long.`;
    const imported = reduceProductEngineCommand(
      command("ImportResearchResult", 1, {
        researchTaskId,
        result: `${longPositiveLead} Risk: incumbent templates may be good enough for early founders.`,
        limitationNotes: "Manual import retained both support and counter-evidence."
      }, 2),
      plannedState
    );

    expect(imported.accepted).toBe(true);
    expect(imported.nextState).toMatchObject({
      researchState: {
        results: [
          expect.objectContaining({
            resultSummary: expect.stringContaining("Risk: incumbent templates")
          })
        ],
        evidenceMatrices: []
      }
    });

    const importedState = replayProductEngineEvents(projectId, sessionId, [
      {
        ...planned.events[0],
        eventId: "evt_full_result_plan",
        sequence: 1,
        occurredAt: "2026-05-05T00:03:00.000Z"
      },
      {
        ...imported.events[0],
        eventId: "evt_full_result_import",
        sequence: 2,
        occurredAt: "2026-05-05T00:03:10.000Z"
      }
    ]);
    const researchResultId = importedState.researchState.results[0]?.researchResultId;
    const synthesized = reduceProductEngineCommand(
      effectExecutorCommand("SynthesizeEvidence", 2, {
        researchResultId
      }, 3),
      importedState
    );

    expect(synthesized.accepted).toBe(true);
    expect(synthesized.nextState).toMatchObject({
      researchState: {
        evidenceMatrices: [
          expect.objectContaining({
            balanceStatus: "balanced",
            decisionBlocked: false,
            conEvidence: [
              expect.objectContaining({
                summary: expect.stringContaining("Risk: incumbent templates")
              })
            ]
          })
        ]
      }
    });
  });

  it("rejects non-positive synthesis versions at the reducer boundary", () => {
    const plannedTaskCommand = command("PlanResearch", 0, {
      objective: "Validate whether paid founders urgently need this workflow",
      routeOutcome: "missing_con_evidence",
      impact: "high"
    }, 1);
    const planned = reduceProductEngineCommand(plannedTaskCommand, createInitialProductEngineState(projectId, sessionId));

    expect(planned.accepted).toBe(true);

    const plannedEvent = {
      ...planned.events[0],
      eventId: "evt_synthesis_version_plan",
      sequence: 1,
      occurredAt: "2026-05-05T00:04:00.000Z"
    };
    const plannedState = replayProductEngineEvents(projectId, sessionId, [plannedEvent]);
    const researchTaskId = plannedState.researchState.taskIds[0];
    const invalidImport = reduceProductEngineCommand(
      command("ImportResearchResult", 1, {
        researchTaskId,
        result: "Pro: founders report urgency.",
        synthesisVersion: 0
      }, 2),
      plannedState
    );

    expect(invalidImport).toMatchObject({
      accepted: false,
      rejectionReason: {
        code: "VALIDATION_FAILED"
      }
    });

    const imported = reduceProductEngineCommand(
      command("ImportResearchResult", 1, {
        researchTaskId,
        result: "Pro: founders report urgency. Risk: incumbent workflows may be enough."
      }, 3),
      plannedState
    );

    expect(imported.accepted).toBe(true);

    const importedState = replayProductEngineEvents(projectId, sessionId, [
      plannedEvent,
      {
        ...imported.events[0],
        eventId: "evt_synthesis_version_import",
        sequence: 2,
        occurredAt: "2026-05-05T00:04:01.000Z"
      },
      {
        ...imported.events[1],
        eventId: "evt_synthesis_version_matrix",
        sequence: 3,
        occurredAt: "2026-05-05T00:04:02.000Z"
      }
    ]);
    const researchResultId = importedState.researchState.results[0]?.researchResultId;
    const invalidSynthesis = reduceProductEngineCommand(
      command("SynthesizeEvidence", 3, {
        researchResultId,
        synthesisVersion: -1
      }, 4),
      importedState
    );

    expect(invalidSynthesis).toMatchObject({
      accepted: false,
      rejectionReason: {
        code: "VALIDATION_FAILED"
      }
    });
  });
});
