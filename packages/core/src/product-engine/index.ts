import {
  CONTRACT_SCHEMA_VERSION,
  type ActiveBatchSafeProjection,
  type AmbiguityIssueSnapshot,
  type DecisionQueueProjection,
  type ProductEngineCommand,
  type ProductEngineEffectPlanItem,
  type ProductEngineEvent,
  type ProductEngineEventDraft,
  type ProductEngineReduction,
  type ProductEngineRejectionCode,
  type ProductEngineStateSnapshot,
  type ProjectId,
  type ProjectionVersion,
  type QueueItemId,
  type ResearchEvidenceProjection,
  type RuntimeActivityProjection,
  type SessionShellProjection,
  type SessionId,
  type StateVersion
} from "@solo-superman/contracts";

export const PACKAGE_SLICE_STATUS = "product-engine-reducer-pr-04" as const;

type PrivacyMode = "local_only" | "local_with_manual_export";

const EMPTY_RESEARCH_PROJECTION: ResearchEvidenceProjection = {
  kind: "ResearchEvidenceProjection",
  version: 0 as ProjectionVersion,
  taskIds: [],
  proConBalanceStatus: "unknown"
};

const EMPTY_RUNTIME_PROJECTION: RuntimeActivityProjection = {
  kind: "RuntimeActivityProjection",
  version: 0 as ProjectionVersion,
  effects: [],
  runtimeArtifacts: [],
  runtimeStatus: "scaffold_placeholder"
};

function reject(message: string, code: ProductEngineRejectionCode = "COMMAND_PRECONDITION_FAILED"): ProductEngineReduction {
  return {
    accepted: false,
    rejectionReason: { code, message },
    events: [],
    nextState: {},
    effectPlan: [],
    deterministicOutputs: []
  };
}

function isPrivacyMode(value: unknown): value is PrivacyMode {
  return value === "local_only" || value === "local_with_manual_export";
}

function requiredString(value: unknown) {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

function queueItemIdSelection(value: unknown): readonly QueueItemId[] | null | "invalid" {
  if (value === undefined) {
    return null;
  }

  if (!Array.isArray(value)) {
    return "invalid";
  }

  const queueItemIds: QueueItemId[] = [];

  for (const item of value) {
    const queueItemId = requiredString(item);

    if (!queueItemId) {
      return "invalid";
    }

    queueItemIds.push(queueItemId as QueueItemId);
  }

  const uniqueQueueItemIds = new Set(queueItemIds);

  if (uniqueQueueItemIds.size !== queueItemIds.length) {
    return "invalid";
  }

  return queueItemIds as readonly QueueItemId[];
}

function numericVersion(version: StateVersion) {
  return Number(version);
}

function nextVersion(state: ProductEngineStateSnapshot) {
  return (numericVersion(state.stateVersion) + 1) as StateVersion;
}

function projectionVersionFor(state: ProductEngineStateSnapshot) {
  return nextVersion(state) as unknown as ProjectionVersion;
}

function eventDraft(
  command: ProductEngineCommand,
  eventType: ProductEngineEventDraft["eventType"],
  payload: ProductEngineEventDraft["payload"]
): ProductEngineEventDraft {
  return {
    eventType,
    projectId: command.projectId,
    sessionId: command.sessionId,
    sourceCommandId: command.commandId,
    correlationId: command.correlationId,
    causationId: command.causationId,
    schemaVersion: command.schemaVersion,
    payload
  };
}

function stableToken(input: string) {
  let hash = 0x811c9dc5;

  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }

  return (hash >>> 0).toString(36);
}

function emptyQueueProjection(version: ProjectionVersion = 0 as ProjectionVersion): DecisionQueueProjection {
  return {
    kind: "DecisionQueueProjection",
    version,
    active: [],
    next: [],
    blocked: [],
    deferred: []
  };
}

export function createInitialProductEngineState(projectId: ProjectId, sessionId: SessionId): ProductEngineStateSnapshot {
  return {
    stateVersion: 0 as StateVersion,
    project: {
      projectId,
      privacyMode: "local_only"
    },
    session: {
      sessionId,
      phase: "intake"
    },
    currentSpec: {
      draftRef: ""
    },
    openIssues: [],
    queueProjection: emptyQueueProjection(),
    researchState: EMPTY_RESEARCH_PROJECTION,
    decisions: [],
    runtimeState: EMPTY_RUNTIME_PROJECTION,
    completeness: {
      kind: "ConfidenceCompletionProjection",
      sessionId,
      version: 0 as ProjectionVersion,
      compositeScore: 0,
      topRisks: []
    }
  };
}

function createSessionShellProjection(command: ProductEngineCommand, version: ProjectionVersion) {
  return {
    kind: "SessionShellProjection",
    projectId: command.projectId,
    sessionId: command.sessionId,
    version,
    phase: "intake"
  } as const;
}

function createLivingSpecProjection(command: ProductEngineCommand, version: ProjectionVersion, sectionCount: number) {
  return {
    kind: "LivingSpecProjection",
    sessionId: command.sessionId,
    version,
    sectionCount,
    approvalStatus: "draft"
  } as const;
}

function createAmbiguityIssues(sessionId: SessionId, specRef: string): readonly AmbiguityIssueSnapshot[] {
  const token = stableToken(`${sessionId}:${specRef}`);
  const issueSeeds = [
    {
      key: "customer-problem",
      summary: "핵심 고객 문제와 즉시성",
      question: "가장 먼저 검증해야 할 고객 문제는 무엇인가?"
    },
    {
      key: "cost-of-delay",
      summary: "문제를 방치했을 때의 비용",
      question: "이 문제를 지금 해결하지 못하면 어떤 비용이 생기는가?"
    },
    {
      key: "alternative-gap",
      summary: "대체재 대비 차별화 기준",
      question: "대체재와 비교했을 때 반드시 달라야 하는 지점은 무엇인가?"
    },
    {
      key: "first-decision",
      summary: "세션 종료 시 내려야 할 첫 결정",
      question: "2~5시간 세션이 끝났을 때 창업자가 내려야 할 첫 결정은 무엇인가?"
    }
  ] as const;

  return issueSeeds.map((seed, index) => ({
    queueItemId: `queue_${token}_${index + 1}` as QueueItemId,
    summary: seed.summary,
    status: "open",
    questionText: seed.question,
    sourceRef: seed.key
  }));
}

function queueProjectionFromIssues(
  issues: readonly AmbiguityIssueSnapshot[],
  version: ProjectionVersion
): DecisionQueueProjection {
  return {
    kind: "DecisionQueueProjection",
    version,
    active: issues.map((issue) => ({
      queueItemId: issue.queueItemId,
      title: issue.questionText ?? issue.summary,
      state: "active"
    })),
    next: [],
    blocked: [],
    deferred: []
  };
}

function queueProjectionEffect(
  command: ProductEngineCommand,
  sourceEventType: ProductEngineEventDraft["eventType"],
  inputRef: ProductEngineEffectPlanItem["inputRef"],
  priority: ProductEngineEffectPlanItem["priority"]
): ProductEngineEffectPlanItem {
  return {
    effectType: "queue_projection_effect",
    idempotencyKey: `${command.commandId}:${sourceEventType}:decision_queue`,
    sourceCommandId: command.commandId,
    sourceEventTypes: [sourceEventType],
    correlationId: command.correlationId,
    priority,
    inputRef,
    previewPolicy: "auto_low_risk"
  };
}

function acceptedReduction(
  command: ProductEngineCommand,
  state: ProductEngineStateSnapshot,
  event: ProductEngineEventDraft,
  patch: ProductEngineReduction["nextState"],
  deterministicOutputs: ProductEngineReduction["deterministicOutputs"],
  effectPlan: readonly ProductEngineEffectPlanItem[] = [],
  immediateProjection?: ActiveBatchSafeProjection
): ProductEngineReduction {
  return {
    accepted: true,
    events: [event],
    nextState: {
      stateVersion: nextVersion(state),
      ...patch
    },
    effectPlan,
    deterministicOutputs,
    ...(immediateProjection ? { immediateProjection } : {})
  };
}

function projectionPayload<TProjection>(payload: ProductEngineEvent["payload"], fallback: TProjection): TProjection {
  return typeof payload.projection === "object" && payload.projection !== null
    ? (payload.projection as TProjection)
    : fallback;
}

export function sessionPhaseForProductEngineEvent(
  event: ProductEngineEvent
): ProductEngineStateSnapshot["session"]["phase"] | null {
  switch (event.eventType) {
    case "ProjectStarted":
      return "intake";
    case "InitialSpecDrafted":
      return "spec";
    case "QuestionBatchActivated":
      return "question_loop";
    default:
      return null;
  }
}

export function sessionShellPhaseForProductEnginePhase(
  phase: ProductEngineStateSnapshot["session"]["phase"]
): SessionShellProjection["phase"] {
  switch (phase) {
    case "spec":
      return "spec";
    case "question_loop":
    case "research":
      return "validation";
    case "completion":
      return "complete";
    case "intake":
      return "intake";
  }
}

function reduceStartProject(command: ProductEngineCommand, state: ProductEngineStateSnapshot): ProductEngineReduction {
  const rawIdea = requiredString(command.payload.rawIdea);
  const localPrivacyMode = command.payload.localPrivacyMode;

  if (!rawIdea || !isPrivacyMode(localPrivacyMode)) {
    return reject("StartProject requires rawIdea and a valid local privacy mode.", "VALIDATION_FAILED");
  }

  if (numericVersion(state.stateVersion) !== 0) {
    return reject("StartProject can only initialize an empty ProductEngine state.");
  }

  const projection = createSessionShellProjection(command, projectionVersionFor(state));
  const event = eventDraft(command, "ProjectStarted", {
    rawIdea,
    localPrivacyMode,
    sourceNote: typeof command.payload.sourceNote === "string" ? command.payload.sourceNote : undefined,
    sessionPhase: "intake",
    projection
  });

  return acceptedReduction(
    command,
    state,
    event,
    {
      project: {
        projectId: command.projectId,
        privacyMode: localPrivacyMode,
        rawIdeaText: rawIdea
      },
      session: {
        sessionId: command.sessionId,
        phase: "intake"
      },
      sessionShellProjection: projection
    },
    [
      {
        outputType: "reducer_deterministic_output",
        outputRef: `project:${command.projectId}:session:${command.sessionId}`,
        payload: {
          rawIdea,
          localPrivacyMode
        }
      }
    ],
    [],
    projection
  );
}

function reduceCaptureIntake(command: ProductEngineCommand, state: ProductEngineStateSnapshot): ProductEngineReduction {
  const answer = requiredString(command.payload.answer);

  if (!answer) {
    return reject("CaptureIntake requires a non-empty answer.", "VALIDATION_FAILED");
  }

  if (numericVersion(state.stateVersion) < 1) {
    return reject("CaptureIntake requires an initialized project.");
  }

  const intakeRef = `intake_${stableToken(`${command.sessionId}:${answer}`)}`;
  const event = eventDraft(command, "IntakeCaptured", {
    intakeRef,
    answer,
    source: "user_intake"
  });

  return acceptedReduction(command, state, event, { intake: { intakeRef, answer } }, [
    {
      outputType: "reducer_deterministic_output",
      outputRef: intakeRef,
      payload: {
        normalizedAnswer: answer
      }
    }
  ]);
}

function reduceDraftInitialSpec(command: ProductEngineCommand, state: ProductEngineStateSnapshot): ProductEngineReduction {
  if (numericVersion(state.stateVersion) < 2 || !state.intake?.answer) {
    return reject("DraftInitialSpec requires captured intake.");
  }

  if (state.currentSpec.draftRef) {
    return reject("Initial spec draft already exists.");
  }

  const draftRef = `spec_draft_${stableToken(`${command.sessionId}:${state.intake.answer}`)}`;
  const sections = [
    "Problem",
    "Target customer",
    "Value proposition",
    "Validation risks"
  ];
  const projection = createLivingSpecProjection(command, projectionVersionFor(state), sections.length);
  const event = eventDraft(command, "InitialSpecDrafted", {
    draftRef,
    title: `초기 제품 스펙 초안: ${state.project.rawIdeaText ?? "Untitled idea"}`,
    sections,
    projection
  });

  return acceptedReduction(
    command,
    state,
    event,
    {
      currentSpec: {
        draftRef,
        title: `초기 제품 스펙 초안: ${state.project.rawIdeaText ?? "Untitled idea"}`,
        sections
      },
      livingSpecProjection: projection
    },
    [
      {
        outputType: "initial_spec_draft",
        outputRef: draftRef,
        payload: {
          sections
        }
      }
    ],
    [],
    projection
  );
}

function reduceAnalyzeAmbiguity(command: ProductEngineCommand, state: ProductEngineStateSnapshot): ProductEngineReduction {
  if (!state.currentSpec.draftRef) {
    return reject("AnalyzeAmbiguity requires an initial spec draft.");
  }

  if (state.openIssues.some((issue) => issue.status === "open")) {
    return reject("AnalyzeAmbiguity cannot run while open ambiguity issues already exist.");
  }

  const issues = createAmbiguityIssues(command.sessionId, state.currentSpec.draftRef);
  const event = eventDraft(command, "AmbiguityAnalyzed", {
    targetRef: typeof command.payload.targetRef === "string" ? command.payload.targetRef : state.currentSpec.draftRef,
    issueCount: issues.length,
    issues
  });

  return acceptedReduction(
    command,
    state,
    event,
    {
      openIssues: issues
    },
    [
      {
        outputType: "ambiguity_analysis",
        outputRef: `ambiguity_${stableToken(`${command.sessionId}:${state.currentSpec.draftRef}`)}`,
        payload: {
          issueCount: issues.length,
          issues
        }
      }
    ],
    [
      queueProjectionEffect(
        command,
        "AmbiguityAnalyzed",
        {
          refType: "ambiguity_issue_set",
          refId: state.currentSpec.draftRef
        },
        "normal"
      )
    ]
  );
}

function reduceActivateQuestionBatch(command: ProductEngineCommand, state: ProductEngineStateSnapshot): ProductEngineReduction {
  const openIssues = state.openIssues.filter((issue) => issue.status === "open");
  const selectedQueueItemIds = queueItemIdSelection(command.payload.queueItemIds);

  if (selectedQueueItemIds === "invalid") {
    return reject("ActivateQuestionBatch queueItemIds must be unique non-empty strings.", "VALIDATION_FAILED");
  }

  const selectedIssues = selectedQueueItemIds
    ? selectedQueueItemIds.map((queueItemId) => openIssues.find((issue) => issue.queueItemId === queueItemId))
    : openIssues;

  if (selectedIssues.some((issue) => issue === undefined)) {
    return reject("ActivateQuestionBatch queueItemIds must reference open ambiguity issues.");
  }
  const candidateIssues = selectedIssues as readonly AmbiguityIssueSnapshot[];

  if (candidateIssues.length < 3 || candidateIssues.length > 5) {
    return reject("ActivateQuestionBatch requires 3 to 5 open ambiguity issues.");
  }

  if (state.queueProjection.active.length > 0) {
    return reject("ActivateQuestionBatch cannot replace an already active batch.");
  }

  const projection = queueProjectionFromIssues(candidateIssues, projectionVersionFor(state));
  const event = eventDraft(command, "QuestionBatchActivated", {
    batchRef: `batch_${stableToken(`${command.sessionId}:${candidateIssues.map((issue) => issue.queueItemId).join(":")}`)}`,
    activeCount: projection.active.length,
    activeItems: projection.active,
    projection
  });

  return acceptedReduction(
    command,
    state,
    event,
    {
      queueProjection: projection
    },
    [
      {
        outputType: "active_question_batch",
        outputRef: String(event.payload.batchRef),
        payload: {
          activeItems: projection.active
        }
      }
    ],
    [
      queueProjectionEffect(
        command,
        "QuestionBatchActivated",
        {
          refType: "active_batch",
          refId: String(event.payload.batchRef)
        },
        "high"
      )
    ],
    projection
  );
}

export function reduceProductEngineCommand(
  command: ProductEngineCommand,
  state: ProductEngineStateSnapshot
): ProductEngineReduction {
  if (command.schemaVersion !== CONTRACT_SCHEMA_VERSION) {
    return reject("Unsupported ProductEngine command schema version.", "VALIDATION_FAILED");
  }

  if (command.expectedStateVersion !== state.stateVersion) {
    return reject("Command expectedStateVersion does not match the loaded ProductEngine state.", "STATE_VERSION_CONFLICT");
  }

  switch (command.commandType) {
    case "StartProject":
      return reduceStartProject(command, state);
    case "CaptureIntake":
      return reduceCaptureIntake(command, state);
    case "DraftInitialSpec":
      return reduceDraftInitialSpec(command, state);
    case "AnalyzeAmbiguity":
      return reduceAnalyzeAmbiguity(command, state);
    case "ActivateQuestionBatch":
      return reduceActivateQuestionBatch(command, state);
    default:
      return reject(`${command.commandType} is outside the PR-04 reducer slice.`);
  }
}

function applyEvent(state: ProductEngineStateSnapshot, event: ProductEngineEvent): ProductEngineStateSnapshot {
  const nextStateVersion = event.sequence as StateVersion;

  switch (event.eventType) {
    case "ProjectStarted": {
      const rawIdeaText = typeof event.payload.rawIdea === "string" ? event.payload.rawIdea : undefined;
      const projection = projectionPayload(event.payload, state.sessionShellProjection);
      const phase = sessionPhaseForProductEngineEvent(event) ?? "intake";

      return {
        ...state,
        stateVersion: nextStateVersion,
        project: {
          projectId: event.projectId,
          privacyMode: isPrivacyMode(event.payload.localPrivacyMode) ? event.payload.localPrivacyMode : "local_only",
          ...(rawIdeaText ? { rawIdeaText } : {})
        },
        session: {
          sessionId: event.sessionId,
          phase
        },
        ...(projection ? { sessionShellProjection: projection } : {})
      };
    }
    case "IntakeCaptured":
      return {
        ...state,
        stateVersion: nextStateVersion,
        intake: {
          intakeRef: typeof event.payload.intakeRef === "string" ? event.payload.intakeRef : "intake_unknown",
          answer: typeof event.payload.answer === "string" ? event.payload.answer : ""
        }
      };
    case "InitialSpecDrafted": {
      const projection = projectionPayload(event.payload, state.livingSpecProjection);
      const title = typeof event.payload.title === "string" ? event.payload.title : state.currentSpec.title;
      const sections = Array.isArray(event.payload.sections)
        ? event.payload.sections.map(String)
        : state.currentSpec.sections;
      const phase = sessionPhaseForProductEngineEvent(event) ?? state.session.phase;

      return {
        ...state,
        stateVersion: nextStateVersion,
        currentSpec: {
          draftRef: typeof event.payload.draftRef === "string" ? event.payload.draftRef : state.currentSpec.draftRef,
          ...(title ? { title } : {}),
          ...(sections ? { sections } : {})
        },
        session: {
          ...state.session,
          phase
        },
        ...(projection ? { livingSpecProjection: projection } : {})
      };
    }
    case "AmbiguityAnalyzed": {
      const issues = Array.isArray(event.payload.issues)
        ? (event.payload.issues as readonly AmbiguityIssueSnapshot[])
        : state.openIssues;

      return {
        ...state,
        stateVersion: nextStateVersion,
        openIssues: issues
      };
    }
    case "QuestionBatchActivated": {
      const projection = projectionPayload(event.payload, state.queueProjection);
      const phase = sessionPhaseForProductEngineEvent(event) ?? state.session.phase;

      return {
        ...state,
        stateVersion: nextStateVersion,
        session: {
          ...state.session,
          phase
        },
        queueProjection: projection
      };
    }
    default:
      return {
        ...state,
        stateVersion: nextStateVersion
      };
  }
}

export function replayProductEngineEvents(
  projectId: ProjectId,
  sessionId: SessionId,
  events: readonly ProductEngineEvent[]
): ProductEngineStateSnapshot {
  return events.reduce(
    (state, event) => applyEvent(state, event),
    createInitialProductEngineState(projectId, sessionId)
  );
}
