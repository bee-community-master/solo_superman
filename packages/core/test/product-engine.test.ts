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

  it("accepts active question answers without replacing the active batch", () => {
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
    expect(answer.effectPlan).toEqual([]);
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
      ]
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
      }
    ]);

    expect(replayed.queueProjection.active.map((item) => item.queueItemId)).toEqual(activeItemIds);
    expect(replayed.queueProjection.active[0]?.state).toBe("answered");
  });
});
