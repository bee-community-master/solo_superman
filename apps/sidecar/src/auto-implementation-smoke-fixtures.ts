import {
  CONTRACT_SCHEMA_VERSION,
  type CommandId,
  type CorrelationId,
  type EventId,
  type PlanningHandoffSourceRefDto,
  type ProjectId,
  type ProjectionVersion,
  type SessionId
} from "@solo-superman/contracts";
import { createEventRepository, type createSoloStorage } from "@solo-superman/db";
import type { createSidecarApp } from "./server";
import {
  objectAt,
  postJson,
  stringAt
} from "./smoke-helpers";
export {
  authHeaders,
  dataRecord,
  getJson,
  jsonEnvelope,
  lastRecord,
  objectAt,
  postJson,
  recordArray,
  stringAt,
  type JsonRecord
} from "./smoke-helpers";

export type SmokeSidecarApp = ReturnType<typeof createSidecarApp>;
export type SmokeStorage = Awaited<ReturnType<typeof createSoloStorage>>;

export interface AutoImplementationSmokePlanningFixture {
  readonly idPrefix: string;
  readonly sourceLabelPrefix: string;
  readonly specTitle: string;
  readonly taskObjective: string;
  readonly resultSummary: string;
  readonly claim: string;
  readonly decisionContext: string;
  readonly completionSummary: string;
  readonly nextBuildSliceSummary: string;
}

const PLANNING_READY_PROJECTION_VERSION = 3 as ProjectionVersion;

export async function sessionEventCount(storage: SmokeStorage, sessionId: string) {
  return (await createEventRepository(storage.db).listForSession(sessionId as SessionId)).length;
}

export function planningReadySourceRefs(
  sessionId: string,
  fixture: AutoImplementationSmokePlanningFixture
): readonly PlanningHandoffSourceRefDto[] {
  return [
    {
      sourceType: "spec_version",
      sourceId: planningId(fixture, "spec_version"),
      sourceLabel: `${fixture.sourceLabelPrefix} SpecVersion`,
      required: true,
      stale: false
    },
    {
      sourceType: "completion_candidate",
      sourceId: `completion_candidate:${sessionId}:${PLANNING_READY_PROJECTION_VERSION}`,
      sourceLabel: `${fixture.sourceLabelPrefix} completion candidate`,
      required: true,
      stale: false
    },
    {
      sourceType: "decision_linked_evidence_pack",
      sourceId: planningId(fixture, "evidence_pack"),
      sourceLabel: `${fixture.sourceLabelPrefix} Evidence Pack`,
      required: true,
      stale: false
    },
    {
      sourceType: "research_updated_queue_item",
      sourceId: planningId(fixture, "queue_item"),
      sourceLabel: `${fixture.sourceLabelPrefix} research queue card`,
      required: true,
      stale: false
    }
  ];
}

export async function seedPlanningReadyState(input: {
  readonly storage: SmokeStorage;
  readonly projectId: string;
  readonly sessionId: string;
  readonly fixture: AutoImplementationSmokePlanningFixture;
}) {
  const eventRepository = createEventRepository(input.storage.db);
  const correlationId = `corr_${input.fixture.idPrefix}_${input.sessionId}` as CorrelationId;

  await eventRepository.append({
    eventId: `evt_${input.fixture.idPrefix}_spec_${input.sessionId}` as EventId,
    eventType: "SpecVersionCreated",
    projectId: input.projectId as ProjectId,
    sessionId: input.sessionId as SessionId,
    sourceCommandId: `cmd_${input.fixture.idPrefix}_spec_${input.sessionId}` as CommandId,
    correlationId,
    causationId: null,
    schemaVersion: CONTRACT_SCHEMA_VERSION,
    occurredAt: "2026-05-23T00:01:00.000Z",
    payload: {
      versionRef: planningId(input.fixture, "spec_version"),
      title: input.fixture.specTitle,
      sections: ["Problem", "Customer", "Value", "Validation"]
    }
  });

  await eventRepository.append({
    eventId: `evt_${input.fixture.idPrefix}_evidence_${input.sessionId}` as EventId,
    eventType: "EvidenceSynthesized",
    projectId: input.projectId as ProjectId,
    sessionId: input.sessionId as SessionId,
    sourceCommandId: `cmd_${input.fixture.idPrefix}_evidence_${input.sessionId}` as CommandId,
    correlationId,
    causationId: null,
    schemaVersion: CONTRACT_SCHEMA_VERSION,
    occurredAt: "2026-05-23T00:02:00.000Z",
    payload: planningReadyEvidencePayload(input.sessionId, input.fixture)
  });
}

export async function createSmokeProject(input: {
  readonly app: SmokeSidecarApp;
  readonly localCapabilityToken: string;
  readonly rawIdea: string;
}) {
  const data = await postJson(input.app, "/api/v1/projects", input.localCapabilityToken, {
    rawIdea: input.rawIdea,
    localPrivacyMode: "local_only",
    projectPurposeMode: "business",
    projectPurposeModeConfirmation: "user_confirmed",
    businessCriticIntensity: "balanced",
    businessCriticIntensityConfirmation: "user_confirmed"
  });
  const projection = objectAt(data.immediateProjection, "project immediateProjection");

  return {
    projectId: stringAt(projection.projectId, "projectId"),
    sessionId: stringAt(projection.sessionId, "sessionId")
  };
}

export async function createSmokePlanningHandoff(input: {
  readonly app: SmokeSidecarApp;
  readonly storage: SmokeStorage;
  readonly localCapabilityToken: string;
  readonly projectId: string;
  readonly sessionId: string;
  readonly fixture: AutoImplementationSmokePlanningFixture;
}) {
  await seedPlanningReadyState({
    storage: input.storage,
    projectId: input.projectId,
    sessionId: input.sessionId,
    fixture: input.fixture
  });

  const expectedStateVersion = await sessionEventCount(input.storage, input.sessionId);
  const data = await postJson(input.app, `/api/v1/sessions/${input.sessionId}/planning-handoff`, input.localCapabilityToken, {
    sessionId: input.sessionId,
    expectedStateVersion,
    sourceRefs: planningReadySourceRefs(input.sessionId, input.fixture)
  });
  const projection = objectAt(data.immediateProjection, "planning handoff projection");
  const finalArtifact = objectAt(projection.finalArtifact, "planning handoff finalArtifact");

  if (projection.currentStatus !== "planning_ready") {
    throw new Error(`planning handoff must be planning_ready; received ${JSON.stringify(projection.currentStatus)}`);
  }

  return stringAt(finalArtifact.artifactId, "planning handoff artifactId");
}

function planningId(fixture: AutoImplementationSmokePlanningFixture, kind: string) {
  return `${kind}_${fixture.idPrefix}_ready`;
}

function planningReadyEvidencePayload(sessionId: string, fixture: AutoImplementationSmokePlanningFixture) {
  return {
    projection: planningReadyResearchProjection(sessionId, fixture),
    queueProjection: planningReadyQueueProjection(fixture),
    confidenceProjection: planningReadyConfidenceProjection(fixture)
  };
}

function planningReadyResearchProjection(sessionId: string, fixture: AutoImplementationSmokePlanningFixture) {
  return {
    kind: "ResearchEvidenceProjection",
    version: PLANNING_READY_PROJECTION_VERSION,
    taskIds: [planningId(fixture, "research_task")],
    tasks: [planningReadyTask(sessionId, fixture)],
    results: [planningReadyResult(fixture)],
    evidenceMatrices: [planningReadyEvidenceMatrix(fixture)],
    evidencePacks: [planningReadyEvidencePack(fixture)],
    reviewCards: [planningReadyReviewCard(fixture)],
    knownRisks: [],
    nextValidationActions: [],
    proConBalanceStatus: "balanced"
  };
}

function planningReadyQueueProjection(fixture: AutoImplementationSmokePlanningFixture) {
  return {
    kind: "DecisionQueueProjection",
    version: PLANNING_READY_PROJECTION_VERSION,
    active: [],
    next: [],
    blocked: [],
    deferred: [planningReadyDeferredQueueItem(fixture)]
  };
}

function planningReadyConfidenceProjection(fixture: AutoImplementationSmokePlanningFixture) {
  return {
    kind: "ConfidenceCompletionProjection",
    version: PLANNING_READY_PROJECTION_VERSION,
    compositeScore: 92,
    readinessLabel: "spec_ready",
    gates: [planningReadyConfidenceGate()],
    topRisks: [],
    topRiskCards: [],
    nextBestActions: ["Create Planning Handoff."],
    completionCandidate: planningReadyCompletionCandidate(fixture)
  };
}

function planningReadyConfidenceGate() {
  return {
    gateId: "research_queue_cards",
    label: "Research-updated Queue cards terminal",
    passed: true
  };
}

function planningReadyCompletionCandidate(fixture: AutoImplementationSmokePlanningFixture) {
  return {
    status: "candidate",
    summary: fixture.completionSummary,
    gateFailures: [],
    ifStopNowArtifact: {
      title: "Planning Handoff candidate",
      summary: fixture.nextBuildSliceSummary,
      knownRisks: [],
      nextValidationActions: []
    }
  };
}

function planningReadyTask(sessionId: string, fixture: AutoImplementationSmokePlanningFixture) {
  return {
    researchTaskId: planningId(fixture, "research_task"),
    sessionId: sessionId as SessionId,
    objective: fixture.taskObjective,
    routeOutcome: "research_needed",
    impact: "high",
    status: "evidence_ready",
    createdAt: "2026-05-23T00:01:30.000Z"
  };
}

function planningReadyResult(fixture: AutoImplementationSmokePlanningFixture) {
  return {
    researchResultId: planningId(fixture, "research_result"),
    researchTaskId: planningId(fixture, "research_task"),
    resultSummary: fixture.resultSummary,
    sourceReliability: "high",
    claim: fixture.claim,
    decisionContext: fixture.decisionContext,
    importedAt: "2026-05-23T00:01:45.000Z"
  };
}

function planningReadyEvidenceMatrix(fixture: AutoImplementationSmokePlanningFixture) {
  return {
    evidenceMatrixId: planningId(fixture, "evidence_matrix"),
    researchTaskId: planningId(fixture, "research_task"),
    researchResultId: planningId(fixture, "research_result"),
    synthesisVersion: 1,
    proEvidence: [
      {
        evidenceItemId: planningId(fixture, "evidence_item"),
        kind: "pro",
        summary: `${fixture.sourceLabelPrefix} fixture has accepted evidence.`
      }
    ],
    conEvidence: [],
    uncertainties: [],
    additionalQuestions: [],
    balanceStatus: "balanced",
    decisionBlocked: false
  };
}

function planningReadyEvidencePack(fixture: AutoImplementationSmokePlanningFixture) {
  return {
    evidencePackId: planningId(fixture, "evidence_pack"),
    researchTaskId: planningId(fixture, "research_task"),
    researchResultId: planningId(fixture, "research_result"),
    claim: fixture.claim,
    decisionContext: fixture.decisionContext,
    sourceReliability: "high",
    retrievedAt: "2026-05-23T00:01:50.000Z",
    gateStatus: "accepted",
    gateChecks: [
      {
        code: "source_metadata",
        status: "passed",
        reason: "Source metadata is present."
      }
    ],
    proEvidenceItemIds: [planningId(fixture, "evidence_item")],
    conEvidenceItemIds: [],
    uncertaintyItemIds: [],
    limitationRefs: [],
    implicationScope: fixture.decisionContext,
    createdAt: "2026-05-23T00:01:55.000Z"
  };
}

function planningReadyReviewCard(fixture: AutoImplementationSmokePlanningFixture) {
  return {
    cardId: planningId(fixture, "queue_item"),
    researchTaskId: planningId(fixture, "research_task"),
    evidencePackId: planningId(fixture, "evidence_pack"),
    cardType: "research_review",
    title: `${fixture.sourceLabelPrefix} evidence`,
    state: "resolved",
    impact: "high",
    gateStatus: "accepted",
    availableOutcomes: ["approved", "revised", "risk_accepted", "research_insufficient"],
    terminalOutcome: "approved",
    blocksPlanning: true,
    recoveryActions: ["approve_evidence"]
  };
}

function planningReadyDeferredQueueItem(fixture: AutoImplementationSmokePlanningFixture) {
  return {
    queueItemId: planningId(fixture, "queue_item"),
    title: `${fixture.sourceLabelPrefix} evidence`,
    state: "resolved",
    cardType: "research_review",
    researchTaskId: planningId(fixture, "research_task"),
    evidencePackId: planningId(fixture, "evidence_pack"),
    blocksPlanning: true,
    availableOutcomes: ["approved", "revised", "risk_accepted", "research_insufficient"],
    terminalOutcome: "approved"
  };
}
