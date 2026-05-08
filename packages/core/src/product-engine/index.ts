import {
  CONTRACT_SCHEMA_VERSION,
  BLOCKED_ACTION_TYPES,
  CODEX_APPLY_POLICY_BY_TURN_PURPOSE,
  CODEX_APPLY_POLICIES,
  CODEX_ARTIFACT_KIND_BY_TURN_PURPOSE,
  CODEX_ARTIFACT_KINDS,
  CODEX_RUNTIME_ADAPTER_VERSION,
  CODEX_TURN_PURPOSES,
  CANONICAL_INITIAL_SPEC_SECTIONS,
  assertPhase15bUpgradeHintsMatchBlockedAction,
  isPhase15bHintArtifactKind,
  validatePhase15bUpgradeHints,
  type ActiveBatchSafeProjection,
  type AmbiguityIssueSnapshot,
  type BlockedActionType,
  type CodexApplyPolicy,
  type CodexArtifactKind,
  type CodexRuntimeSource,
  type CodexTurnPurpose,
  type ConfidenceCompletionProjection,
  type DecisionId,
  type QueueItemProjection,
  type DecisionQueueProjection,
  type EvidenceMatrixProjection,
  type FounderBriefProjection,
  type LivingSpecProjection,
  type PlanningHandoffArtifactDto,
  type PlanningHandoffBlockerArtifactDto,
  type PlanningHandoffBlockerClass,
  type PlanningHandoffBlockerDto,
  type PlanningHandoffGateVerdictDto,
  type PlanningHandoffProjection,
  type PlanningHandoffQueueOutcome,
  type PlanningHandoffQueueOutcomeSummaryDto,
  type PlanningHandoffRequestedScopeDto,
  type PlanningHandoffRequiredUserAction,
  type PlanningHandoffResidualRiskClass,
  type PlanningHandoffResidualRiskDto,
  type PlanningHandoffSourceRefDto,
  type PlanningHandoffSourceType,
  type PlanningHandoffTaskDto,
  type PlanningHandoffVerdict,
  type ProductEngineCommand,
  type ProductEngineEffectPlanItem,
  type ProductEngineEvent,
  type ProductEngineEventDraft,
  type ProductEngineReduction,
  type ProductEngineRejectionCode,
  type ProductEngineStateSnapshot,
  type Phase15bUpgradeHints,
  type ProjectId,
  type ProjectionVersion,
  type QueueItemId,
  type EffectTaskId,
  type RequiredDecisionRef,
  type ResearchImpact,
  type ResearchEvidenceProjection,
  type ResearchQueueTerminalOutcome,
  type ResearchResultId,
  type ResearchRunId,
  type ResearchRouteOutcome,
  type ResearchReviewCardProjection,
  type ResearchSourceReliability,
  type ResearchTaskId,
  type ResearchTaskProjection,
  type RuntimeActivityProjection,
  type RuntimeArtifactId,
  type RuntimePreviewArtifact,
  type SessionShellProjection,
  type SessionId,
  type SpecVersionId,
  type SpecUpdatePreviewSnapshot,
  type StateVersion
} from "@solo-superman/contracts";
import {
  buildConfidenceCompletionProjection,
  buildFounderBriefProjection
} from "../completeness";
import {
  addImportedResearchResultToProjection,
  addResearchResultToProjection,
  buildDecisionEvidencePack,
  addResearchTaskToProjection,
  emptyResearchEvidenceProjection,
  importResearchResult,
  planResearchTask,
  resolveResearchReviewCardInProjection,
  synthesizeEvidenceMatrix
} from "../research-engine";
import { sha256Hex } from "./deterministic-hash";

export const PACKAGE_SLICE_STATUS = "product-engine-e2e-dry-run-pr-09" as const;

type PrivacyMode = "local_only" | "local_with_manual_export";

const EMPTY_RESEARCH_PROJECTION: ResearchEvidenceProjection = emptyResearchEvidenceProjection();

const EMPTY_RUNTIME_PROJECTION: RuntimeActivityProjection = {
  kind: "RuntimeActivityProjection",
  version: 0 as ProjectionVersion,
  effects: [],
  runtimeArtifacts: [],
  runtimeStatus: "scaffold_placeholder"
};

const DEFAULT_QUESTION_BATCH_SIZE = 5;
const AMBIGUITY_SEVERITY_PRIORITY = {
  high: 0,
  medium: 1,
  low: 2
} satisfies Record<NonNullable<AmbiguityIssueSnapshot["severity"]>, number>;

function emptyConfidenceCompletionProjection(
  sessionIdValue: SessionId,
  version: ProjectionVersion = 0 as ProjectionVersion
): ConfidenceCompletionProjection {
  return {
    kind: "ConfidenceCompletionProjection",
    sessionId: sessionIdValue,
    version,
    compositeScore: 0,
    readinessLabel: "draft",
    axes: [],
    scoreBreakdown: {
      sectionCompleteness: 0,
      questionDebtResolution: 0,
      evidenceQuality: 0,
      decisionApproval: 0,
      consistencyAndConflict: 0
    },
    gates: [],
    topRisks: [],
    topRiskCards: [],
    nextBestActions: ["Capture intake and draft the initial spec."],
    completionCandidate: {
      status: "not_ready",
      summary: "Completeness has not been scored yet.",
      gateFailures: ["Completeness has not been scored yet."],
      ifStopNowArtifact: {
        title: "If stop now",
        summary: "No founder brief can be prepared before intake and scoring.",
        knownRisks: [],
        nextValidationActions: ["Capture intake and draft the initial spec."]
      }
    }
  };
}

function isRequiredDecisionRef(value: unknown): value is RequiredDecisionRef {
  return (
    value === "primary_customer" ||
    value === "problem" ||
    value === "value" ||
    value === "mvp_scope" ||
    value === "validation_plan" ||
    value === "success_criteria"
  );
}

function reject(
  message: string,
  code: ProductEngineRejectionCode = "COMMAND_PRECONDITION_FAILED",
  details?: Readonly<Record<string, unknown>>
): ProductEngineReduction {
  return {
    accepted: false,
    rejectionReason: {
      code,
      message,
      ...(details ? { details } : {})
    },
    events: [],
    nextState: {},
    effectPlan: [],
    deterministicOutputs: []
  };
}

function isPrivacyMode(value: unknown): value is PrivacyMode {
  return value === "local_only" || value === "local_with_manual_export";
}

function isDecisionResolutionStatus(value: unknown): value is Exclude<
  ProductEngineStateSnapshot["decisions"][number]["status"],
  "active"
> {
  return value === "approved" || value === "rejected" || value === "deferred" || value === "risk_accepted";
}

function isResearchQueueTerminalOutcome(value: unknown): value is ResearchQueueTerminalOutcome {
  return (
    value === "approved" ||
    value === "revised" ||
    value === "rejected" ||
    value === "deferred" ||
    value === "risk_accepted" ||
    value === "research_insufficient"
  );
}

function mergeDecision(
  decisions: ProductEngineStateSnapshot["decisions"],
  decision: ProductEngineStateSnapshot["decisions"][number]
) {
  return [...decisions.filter((candidate) => candidate.decisionId !== decision.decisionId), decision];
}

function mergeSpecUpdatePreview(
  previews: readonly SpecUpdatePreviewSnapshot[],
  preview: SpecUpdatePreviewSnapshot
) {
  return [...previews.filter((candidate) => candidate.previewRef !== preview.previewRef), preview];
}

function requiredString(value: unknown) {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

function hasOwnRecordKey(record: Readonly<Record<string, unknown>>, key: string) {
  return Object.prototype.hasOwnProperty.call(record, key);
}

function hasOnlyRecordKeys(record: Readonly<Record<string, unknown>>, allowedKeys: readonly string[]) {
  return Object.keys(record).every((key) => allowedKeys.includes(key));
}

function optionalPayloadSections(value: unknown) {
  if (value === undefined) {
    return null;
  }

  if (!Array.isArray(value)) {
    return "invalid";
  }

  const sections = value.map((section) => (typeof section === "string" ? section.trim() : ""));

  return sections.every(Boolean) ? (sections as readonly string[]) : "invalid";
}

function stringArraysEqual(left: readonly string[], right: readonly string[]) {
  return left.length === right.length && left.every((value, index) => value === right[index]);
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
  return Number(nextVersion(state)) as ProjectionVersion;
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

function queueRefetchUrl(sessionId: SessionId) {
  return `/api/v1/sessions/${sessionId}/queue`;
}

function queueSseStreamUrl(sessionId: SessionId) {
  return `/api/v1/events/stream?sessionId=${encodeURIComponent(sessionId)}`;
}

function activeBatchProjection(
  items: readonly QueueItemProjection[],
  generatedAt: string
): DecisionQueueProjection["activeBatch"] {
  if (!items.length) {
    return undefined;
  }

  const prioritySignals = [
    ...new Set(
      items.map((item) =>
        [
          item.severity ? `severity:${item.severity}` : null,
          item.topicKey ? `topic:${item.topicKey}` : null,
          item.cardType ? `card:${item.cardType}` : null
        ]
          .filter((part): part is string => Boolean(part))
          .join("/")
      )
    )
  ].filter(Boolean);

  return {
    batchId: `active-batch:${items.map((item) => item.queueItemId).join(",")}`,
    queueItemIds: items.map((item) => item.queueItemId),
    selectedAt: generatedAt,
    priorityReason: prioritySignals.length
      ? `severity_ordered_batch(${prioritySignals.join("; ")})`
      : "active_batch_preserved_without_additional_priority_metadata",
    stabilityPolicy: "preserve_active_batch_until_terminal_or_explicit_reactivation"
  };
}

export function decisionQueueProjectionWithRecovery(
  projection: DecisionQueueProjection,
  sessionId: SessionId,
  generatedAt: string,
  pendingEffectCount = 0,
  staleReason?: string
): DecisionQueueProjection {
  const stale = Boolean(staleReason);
  const refetchUrl = queueRefetchUrl(sessionId);
  const activeBatch = activeBatchProjection(projection.active, generatedAt);

  return {
    kind: projection.kind,
    projectionKind: "DecisionQueueProjection",
    sessionId,
    version: projection.version,
    generatedAt,
    stale,
    refetchUrl,
    ...(activeBatch ? { activeBatch } : {}),
    active: projection.active,
    next: projection.next,
    blocked: projection.blocked,
    deferred: projection.deferred,
    recovery: {
      status: stale ? "stale" : pendingEffectCount > 0 ? "pending_refetch" : "fresh",
      refetchUrl,
      sseStreamUrl: queueSseStreamUrl(sessionId),
      sseEventNames: ["projection.updated"],
      pendingEffectCount,
      ...(pendingEffectCount > 0 || stale ? {} : { lastRefetchedAt: generatedAt }),
      ...(staleReason ? { staleReason } : {})
    }
  };
}

function refreshQueueProjectionMetadata(
  projection: DecisionQueueProjection,
  version: ProjectionVersion,
  generatedAt: string
): DecisionQueueProjection {
  if (!projection.sessionId) {
    return {
      ...projection,
      version
    };
  }

  return decisionQueueProjectionWithRecovery(
    {
      ...projection,
      version
    },
    projection.sessionId,
    generatedAt
  );
}

function emptyQueueProjection(
  version: ProjectionVersion = 0 as ProjectionVersion,
  sessionId?: SessionId,
  generatedAt = new Date(0).toISOString()
): DecisionQueueProjection {
  const projection: DecisionQueueProjection = {
    kind: "DecisionQueueProjection",
    version,
    active: [],
    next: [],
    blocked: [],
    deferred: []
  };

  return sessionId ? decisionQueueProjectionWithRecovery(projection, sessionId, generatedAt) : projection;
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
    queueProjection: emptyQueueProjection(0 as ProjectionVersion, sessionId),
    researchState: EMPTY_RESEARCH_PROJECTION,
    decisions: [],
    specUpdatePreviews: [],
    runtimeState: EMPTY_RUNTIME_PROJECTION,
    completeness: emptyConfidenceCompletionProjection(sessionId)
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

function createLivingSpecProjection(
  command: ProductEngineCommand,
  version: ProjectionVersion,
  title: string,
  sections: readonly string[],
  approvalStatus: LivingSpecProjection["approvalStatus"] = "draft"
) {
  return {
    kind: "LivingSpecProjection",
    sessionId: command.sessionId,
    version,
    title,
    sections,
    sectionCount: sections.length,
    approvalStatus
  } as const;
}

type AmbiguityIssueSeed = {
  readonly sectionRef: string;
  readonly topicKey: string;
  readonly uncertaintyType: NonNullable<AmbiguityIssueSnapshot["uncertaintyType"]>;
  readonly severity: NonNullable<AmbiguityIssueSnapshot["severity"]>;
  readonly summary: string;
  readonly whyItMatters: string;
  readonly question: string;
  readonly expectedAnswerType: NonNullable<AmbiguityIssueSnapshot["expectedAnswerType"]>;
  readonly decisionItUnlocks: string;
  readonly routes: NonNullable<AmbiguityIssueSnapshot["possibleRoutes"]>;
  readonly suggestedResearchTask?: string;
};

const INITIAL_AMBIGUITY_ISSUE_SEEDS = [
  {
    sectionRef: "Target Customer",
    topicKey: "primary_customer_narrowing",
    uncertaintyType: "vague",
    severity: "high",
    summary: "첫 고객 세그먼트가 너무 넓음",
    whyItMatters: "첫 고객이 좁혀지지 않으면 문제 강도, 채널, MVP scope 판단이 모두 흔들립니다.",
    question: "가장 먼저 검증할 primary customer는 어떤 상황의 누구인가?",
    expectedAnswerType: "choice",
    decisionItUnlocks: "primary_customer decision과 Target Customer section의 검증 채널을 잠급니다.",
    routes: ["question", "decision_candidate"]
  },
  {
    sectionRef: "Target Customer",
    topicKey: "buyer_user_split",
    uncertaintyType: "missing",
    severity: "high",
    summary: "구매자와 실제 사용자가 같은지 확인되지 않음",
    whyItMatters: "구매자와 사용자가 다르면 가격, 인터뷰 대상, 채널, 메시지가 모두 달라집니다.",
    question: "돈을 내는 사람과 실제 사용하는 사람은 같은가, 다르다면 각각 누구인가?",
    expectedAnswerType: "choice",
    decisionItUnlocks: "buyer/user split과 Target Customer section의 interview target을 잠급니다.",
    routes: ["question", "decision_candidate"]
  },
  {
    sectionRef: "Problem",
    topicKey: "problem_pain_intensity",
    uncertaintyType: "missing",
    severity: "high",
    summary: "문제 빈도와 강도가 아직 측정되지 않음",
    whyItMatters: "문제가 드물거나 약하면 value proposition과 validation plan이 재작성됩니다.",
    question: "이 문제가 얼마나 자주, 얼마나 큰 비용으로 발생하는가?",
    expectedAnswerType: "text",
    decisionItUnlocks: "problem decision과 Success Criteria의 pain threshold를 잠급니다.",
    routes: ["question", "research_needed"]
  },
  {
    sectionRef: "Value Proposition",
    topicKey: "value_prop_switching_reason",
    uncertaintyType: "decision_required",
    severity: "high",
    summary: "대체재 대비 전환 이유가 결정되지 않음",
    whyItMatters: "전환 이유가 없으면 MVP 기능과 메시지가 경쟁 대체재를 이길 수 없습니다.",
    question: "사용자가 현재 대체재를 버리고 이 제품으로 전환할 이유는 무엇인가?",
    expectedAnswerType: "rank",
    decisionItUnlocks: "value decision과 Differentiation section의 핵심 claim을 잠급니다.",
    routes: ["question", "decision_candidate"]
  },
  {
    sectionRef: "Current Alternatives",
    topicKey: "alternative_dissatisfaction_gap",
    uncertaintyType: "missing_con_evidence",
    severity: "medium",
    summary: "현재 대체재와 불만족 지점이 균형 있게 검증되지 않음",
    whyItMatters: "대체재 만족/불만족 근거 없이 차별화를 확정하면 Founder Brief 신뢰도가 낮아집니다.",
    question: "현재 대체재는 무엇이고, 충분히 좋은 상황과 불만족이 생기는 상황은 각각 언제인가?",
    expectedAnswerType: "evidence",
    decisionItUnlocks: "alternatives claim의 pro/con evidence gate와 differentiation 판단을 엽니다.",
    routes: ["research_needed", "missing_con_evidence"],
    suggestedResearchTask: "대체재 만족/불만족 근거를 균형 있게 수집합니다."
  },
  {
    sectionRef: "MVP Scope",
    topicKey: "mvp_validation_scope",
    uncertaintyType: "decision_required",
    severity: "high",
    summary: "MVP에 반드시 포함할 기능과 제외할 기능이 불명확함",
    whyItMatters: "MVP scope가 흐리면 Build Slice가 커지고 Planning Handoff가 blocker 상태로 남습니다.",
    question: "첫 Build Slice에서 반드시 검증해야 할 기능과 제외할 기능은 무엇인가?",
    expectedAnswerType: "choice",
    decisionItUnlocks: "mvp_scope decision과 Build Slice readiness를 잠급니다.",
    routes: ["question", "decision_candidate", "deferred"]
  },
  {
    sectionRef: "Validation Plan",
    topicKey: "first_validation_experiment",
    uncertaintyType: "missing",
    severity: "high",
    summary: "제품 없이 가능한 첫 검증 실험이 정의되지 않음",
    whyItMatters: "실험이 없으면 evidence loop가 시작되지 않아 SpecVersion 승인 근거가 부족합니다.",
    question: "제품 구현 전에 수행할 수 있는 첫 검증 실험은 무엇인가?",
    expectedAnswerType: "experiment",
    decisionItUnlocks: "validation_plan decision과 Research/Evidence task 생성을 엽니다.",
    routes: ["question", "research_needed"]
  },
  {
    sectionRef: "Success Criteria",
    topicKey: "success_metric_measurability",
    uncertaintyType: "vague",
    severity: "high",
    summary: "성공/실패 기준이 측정 가능하지 않음",
    whyItMatters: "측정 기준이 없으면 completeness score와 pivot trigger를 신뢰할 수 없습니다.",
    question: "첫 실험의 성공과 실패를 어떤 수치 또는 관찰 신호로 판단할 것인가?",
    expectedAnswerType: "text",
    decisionItUnlocks: "success_criteria decision과 completion gate 판단을 잠급니다.",
    routes: ["question", "decision_candidate"]
  },
  {
    sectionRef: "Evidence Status",
    topicKey: "evidence_balance",
    uncertaintyType: "unsupported",
    severity: "medium",
    summary: "핵심 claim의 찬반 근거 균형이 부족함",
    whyItMatters: "찬성 근거만 있으면 high-impact claim을 완료 상태로 승격할 수 없습니다.",
    question: "핵심 claim을 지지하거나 반박하는 근거는 무엇이며 어느 쪽이 비어 있는가?",
    expectedAnswerType: "evidence",
    decisionItUnlocks: "Evidence Matrix와 pro/con gate의 다음 research route를 결정합니다.",
    routes: ["research_needed", "missing_con_evidence"],
    suggestedResearchTask: "핵심 claim별 pro/con evidence coverage를 점검합니다."
  },
  {
    sectionRef: "Non-goals",
    topicKey: "non_goal_boundaries",
    uncertaintyType: "decision_required",
    severity: "medium",
    summary: "이번 MVP에서 하지 않을 범위가 충분히 잠기지 않음",
    whyItMatters: "non-goal이 명시되지 않으면 scope creep과 downstream rework가 생깁니다.",
    question: "이번 MVP에서 의도적으로 제외해야 하는 범위는 무엇인가?",
    expectedAnswerType: "choice",
    decisionItUnlocks: "Non-goals section과 Planning Handoff blocker 여부를 잠급니다.",
    routes: ["question", "deferred", "decision_candidate"]
  },
  {
    sectionRef: "Validation Plan",
    topicKey: "acquisition_channel_realism",
    uncertaintyType: "unsupported",
    severity: "medium",
    summary: "첫 사용자 모집 채널의 현실성이 근거로 확인되지 않음",
    whyItMatters: "획득 채널이 막히면 제품 없이 하는 검증 실험과 초기 adoption evidence가 진행되지 않습니다.",
    question: "첫 검증 참여자를 어디서 어떻게 모집할 수 있으며, 그 채널은 현실적인가?",
    expectedAnswerType: "evidence",
    decisionItUnlocks: "Validation Plan의 first channel과 acquisition risk 판단을 엽니다.",
    routes: ["research_needed", "spec_update_candidate"],
    suggestedResearchTask: "초기 사용자 모집 채널의 접근 가능성과 비용/응답률 근거를 확인합니다."
  },
  {
    sectionRef: "MVP Scope",
    topicKey: "implementation_resource_fit",
    uncertaintyType: "unsupported",
    severity: "medium",
    summary: "구현 난이도와 창업자 리소스의 적합성이 검증되지 않음",
    whyItMatters: "리소스 대비 어려운 MVP는 Planning Handoff 이후에도 실행 불가능한 Build Slice가 됩니다.",
    question: "현재 리소스로 첫 Build Slice를 구현할 수 있는가, 줄여야 할 scope는 무엇인가?",
    expectedAnswerType: "text",
    decisionItUnlocks: "MVP Scope와 Planning Handoff의 implementation fit blocker를 판단합니다.",
    routes: ["question", "deferred", "spec_update_candidate"]
  },
  {
    sectionRef: "Differentiation",
    topicKey: "founder_advantage",
    uncertaintyType: "unsupported",
    severity: "medium",
    summary: "창업자만의 유리함이나 방어 가능성이 근거로 연결되지 않음",
    whyItMatters: "차별화 근거가 약하면 Founder Brief와 acquisition story가 설득력을 잃습니다.",
    question: "이 founder/team이 이 문제를 더 잘 풀 수 있는 근거는 무엇인가?",
    expectedAnswerType: "evidence",
    decisionItUnlocks: "Differentiation section과 Founder Brief의 핵심 narrative를 엽니다.",
    routes: ["research_needed", "spec_update_candidate"]
  },
  {
    sectionRef: "JTBD / Use Case",
    topicKey: "job_context_specificity",
    uncertaintyType: "vague",
    severity: "medium",
    summary: "사용 맥락과 전후 행동 변화가 충분히 구체적이지 않음",
    whyItMatters: "use case가 흐리면 질문, 리서치, UI slice가 서로 다른 상황을 겨냥합니다.",
    question: "사용자가 어떤 상황에서 어떤 진전을 얻기 위해 이 제품을 쓰는가?",
    expectedAnswerType: "text",
    decisionItUnlocks: "JTBD section과 첫 UX journey 가설을 잠급니다.",
    routes: ["question", "spec_update_candidate"]
  },
  {
    sectionRef: "Known Risks / Open Questions",
    topicKey: "operational_risk_boundary",
    uncertaintyType: "missing",
    severity: "low",
    summary: "보안/법률/운영 리스크와 보류 이유가 정리되지 않음",
    whyItMatters: "남은 리스크가 보이지 않으면 완료 선언과 Planning Handoff가 과신 상태가 됩니다.",
    question: "현 단계에서 명시적으로 남겨야 할 보안, 법률, 운영 리스크는 무엇인가?",
    expectedAnswerType: "text",
    decisionItUnlocks: "Known Risks section과 residual risk register를 갱신합니다.",
    routes: ["question", "deferred", "repeat_limit_reached"]
  }
] satisfies readonly AmbiguityIssueSeed[];

function createAmbiguityIssues(sessionId: SessionId, specRef: string): readonly AmbiguityIssueSnapshot[] {
  const token = stableToken(`${sessionId}:${specRef}`);

  return INITIAL_AMBIGUITY_ISSUE_SEEDS.map((seed, index) => ({
    queueItemId: `queue_${token}_${index + 1}` as QueueItemId,
    sectionRef: seed.sectionRef,
    topicKey: seed.topicKey,
    uncertaintyType: seed.uncertaintyType,
    severity: seed.severity,
    summary: seed.summary,
    whyItMatters: seed.whyItMatters,
    status: "open",
    questionText: seed.question,
    expectedAnswerType: seed.expectedAnswerType,
    decisionItUnlocks: seed.decisionItUnlocks,
    ...(seed.suggestedResearchTask ? { suggestedResearchTask: seed.suggestedResearchTask } : {}),
    repeatCount: 0,
    repeatLimit: 3,
    possibleRoutes: seed.routes,
    sourceRef: seed.topicKey
  }));
}

function queueProjectionFromIssues(
  issues: readonly AmbiguityIssueSnapshot[],
  version: ProjectionVersion,
  sessionId: SessionId,
  generatedAt: string
): DecisionQueueProjection {
  return decisionQueueProjectionWithRecovery(
    {
      kind: "DecisionQueueProjection",
      version,
      active: issues.map(queueItemProjectionFromIssue),
      next: [],
      blocked: [],
      deferred: []
    },
    sessionId,
    generatedAt
  );
}

function queueItemProjectionFromIssue(issue: AmbiguityIssueSnapshot): QueueItemProjection {
  return {
    queueItemId: issue.queueItemId,
    title: issue.questionText ?? issue.summary,
    state: "active",
    cardType: "question",
    ...(issue.sectionRef ? { sectionRef: issue.sectionRef } : {}),
    ...(issue.topicKey ? { topicKey: issue.topicKey } : {}),
    ...(issue.severity ? { severity: issue.severity } : {}),
    ...(issue.whyItMatters ? { whyItMatters: issue.whyItMatters } : {}),
    ...(issue.decisionItUnlocks ? { decisionItUnlocks: issue.decisionItUnlocks } : {}),
    ...(issue.expectedAnswerType ? { expectedAnswerType: issue.expectedAnswerType } : {}),
    ...(issue.possibleRoutes ? { possibleRoutes: issue.possibleRoutes } : {})
  };
}

function ambiguityIssueSeverityRank(issue: AmbiguityIssueSnapshot) {
  return issue.severity ? AMBIGUITY_SEVERITY_PRIORITY[issue.severity] : 3;
}

function defaultQuestionBatchIssues(openIssues: readonly AmbiguityIssueSnapshot[]) {
  return openIssues
    .map((issue, index) => ({ issue, index }))
    .sort(
      (left, right) =>
        ambiguityIssueSeverityRank(left.issue) - ambiguityIssueSeverityRank(right.issue) || left.index - right.index
    )
    .slice(0, DEFAULT_QUESTION_BATCH_SIZE)
    .map(({ issue }) => issue);
}

function hasDuplicateTopicKey(issues: readonly AmbiguityIssueSnapshot[]) {
  const topicKeys = new Set<string>();

  return issues.some((issue) => {
    if (!issue.topicKey) {
      return false;
    }

    if (topicKeys.has(issue.topicKey)) {
      return true;
    }

    topicKeys.add(issue.topicKey);

    return false;
  });
}

function queueProjectionWithAnsweredItem(
  projection: DecisionQueueProjection,
  queueItemId: QueueItemId,
  version: ProjectionVersion,
  generatedAt = projection.generatedAt ?? new Date(0).toISOString()
): DecisionQueueProjection {
  const markAnswered = (items: DecisionQueueProjection["active"]) =>
    items.map((item) =>
      item.queueItemId === queueItemId
        ? {
            ...item,
            state: "answered" as const
          }
        : item
    );

  return refreshQueueProjectionMetadata(
    {
      ...projection,
      active: markAnswered(projection.active),
      next: markAnswered(projection.next),
      blocked: markAnswered(projection.blocked),
      deferred: markAnswered(projection.deferred)
    },
    version,
    generatedAt
  );
}

function queueProjectionWithoutItem(
  projection: DecisionQueueProjection,
  queueItemId: QueueItemId,
  version: ProjectionVersion,
  generatedAt = projection.generatedAt ?? new Date(0).toISOString()
): DecisionQueueProjection {
  const withoutItem = (items: readonly QueueItemProjection[]) =>
    items.filter((candidate) => candidate.queueItemId !== queueItemId);

  return refreshQueueProjectionMetadata(
    {
      ...projection,
      active: withoutItem(projection.active),
      next: withoutItem(projection.next),
      blocked: withoutItem(projection.blocked),
      deferred: withoutItem(projection.deferred)
    },
    version,
    generatedAt
  );
}

function queueProjectionWithNextOrBlockedItem(
  projection: DecisionQueueProjection,
  item: QueueItemProjection & { readonly state: "next" | "blocked" },
  version: ProjectionVersion,
  generatedAt = projection.generatedAt ?? new Date(0).toISOString()
): DecisionQueueProjection {
  const withoutItem = queueProjectionWithoutItem(projection, item.queueItemId, version, generatedAt);

  return refreshQueueProjectionMetadata(
    {
      ...withoutItem,
      next: item.state === "next" ? [...withoutItem.next, item] : withoutItem.next,
      blocked: item.state === "blocked" ? [...withoutItem.blocked, item] : withoutItem.blocked
    },
    version,
    generatedAt
  );
}

function queueProjectionWithDeferredItem(
  projection: DecisionQueueProjection,
  item: QueueItemProjection & { readonly state: "deferred" },
  version: ProjectionVersion,
  generatedAt = projection.generatedAt ?? new Date(0).toISOString()
): DecisionQueueProjection {
  const withoutItem = queueProjectionWithoutItem(projection, item.queueItemId, version, generatedAt);

  return refreshQueueProjectionMetadata(
    {
      ...withoutItem,
      deferred: [...withoutItem.deferred, item]
    },
    version,
    generatedAt
  );
}

function queueItemFromProjection(
  projection: DecisionQueueProjection,
  queueItemId: QueueItemId
): QueueItemProjection | null {
  return (
    [
      ...projection.active,
      ...projection.next,
      ...projection.blocked,
      ...projection.deferred
    ].find((item) => item.queueItemId === queueItemId) ?? null
  );
}

function issuesWithQueueItemStatus(
  issues: readonly AmbiguityIssueSnapshot[],
  queueItemId: QueueItemId,
  status: AmbiguityIssueSnapshot["status"]
): readonly AmbiguityIssueSnapshot[] {
  return issues.map((issue) =>
    issue.queueItemId === queueItemId
      ? {
          ...issue,
          status
        }
      : issue
  );
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

function researchEvidenceEffect(
  command: ProductEngineCommand,
  sourceEventTypes: readonly ProductEngineEventDraft["eventType"][],
  inputRef: ProductEngineEffectPlanItem["inputRef"],
  priority: ProductEngineEffectPlanItem["priority"],
  idempotencyKey: string,
  runAfter?: string
): ProductEngineEffectPlanItem {
  return {
    effectType: "research_evidence_effect",
    idempotencyKey,
    sourceCommandId: command.commandId,
    sourceEventTypes,
    correlationId: command.correlationId,
    priority,
    inputRef,
    previewPolicy: "manual_handoff_required",
    ...(runAfter ? { runAfter } : {})
  };
}

function codexRuntimePreviewEffect(
  command: ProductEngineCommand,
  turnPurpose: CodexTurnPurpose,
  contextHash: string
): ProductEngineEffectPlanItem {
  return {
    effectType: "codex_runtime_preview_effect",
    idempotencyKey: `codex:${command.sessionId}:${turnPurpose}:${contextHash}:${CODEX_RUNTIME_ADAPTER_VERSION}`,
    sourceCommandId: command.commandId,
    sourceEventTypes: ["RuntimePreviewRequested"],
    correlationId: command.correlationId,
    priority: "normal",
    inputRef: {
      refType: "RuntimePreviewRequest",
      refId: `${turnPurpose}:${contextHash}`
    },
    previewPolicy: "manual_handoff_required"
  };
}

function isCodexTurnPurpose(value: unknown): value is CodexTurnPurpose {
  return typeof value === "string" && CODEX_TURN_PURPOSES.includes(value as CodexTurnPurpose);
}

function isCodexArtifactKind(value: unknown): value is CodexArtifactKind {
  return typeof value === "string" && CODEX_ARTIFACT_KINDS.includes(value as CodexArtifactKind);
}

function isCodexApplyPolicy(value: unknown): value is CodexApplyPolicy {
  return typeof value === "string" && CODEX_APPLY_POLICIES.includes(value as CodexApplyPolicy);
}

function isBlockedActionType(value: unknown): value is BlockedActionType {
  return typeof value === "string" && BLOCKED_ACTION_TYPES.includes(value as BlockedActionType);
}

function requiredNonEmptyStringArray(value: unknown): readonly string[] | "invalid" {
  if (!Array.isArray(value) || value.length === 0) {
    return "invalid";
  }

  const strings = value.map((item) => (typeof item === "string" ? item.trim() : ""));

  return strings.every(Boolean) ? strings : "invalid";
}

function runtimeArtifactIdFor(
  sessionIdValue: SessionId,
  turnPurpose: CodexTurnPurpose,
  contextHash: string,
  runtimeAdapterVersion: string
): RuntimeArtifactId {
  return `runtime_artifact_${stableToken(
    `${sessionIdValue}:${turnPurpose}:${contextHash}:${runtimeAdapterVersion}`
  )}` as RuntimeArtifactId;
}

function isRuntimeArtifactBlocked(artifact: RuntimePreviewArtifact) {
  return Boolean(artifact.blockedAction) || artifact.status === "blocked" || artifact.applyPolicy === "blocked";
}

function runtimePreviewQueueItem(artifact: RuntimePreviewArtifact) {
  const isBlocked = isRuntimeArtifactBlocked(artifact);

  return {
    queueItemId: `runtime_preview_${artifact.artifactId}` as QueueItemId,
    title: isBlocked ? `Runtime blocked: ${artifact.summary}` : `Runtime preview: ${artifact.summary}`,
    state: isBlocked ? ("blocked" as const) : ("next" as const)
  };
}

function queueProjectionWithRuntimePreviewItem(
  projection: DecisionQueueProjection,
  artifact: RuntimePreviewArtifact,
  version: ProjectionVersion,
  generatedAt?: string
): DecisionQueueProjection {
  return queueProjectionWithNextOrBlockedItem(projection, runtimePreviewQueueItem(artifact), version, generatedAt);
}

function completionCandidateQueueItem(projection: ConfidenceCompletionProjection) {
  const isCandidate = projection.completionCandidate.status === "candidate";

  return {
    queueItemId: `completion_candidate_${projection.sessionId}` as QueueItemId,
    title: isCandidate
      ? `Completion candidate: Founder Brief ready (${projection.compositeScore})`
      : `Completion blocked: ${projection.completionCandidate.gateFailures[0] ?? "Gate failure"}`,
    state: isCandidate ? ("next" as const) : ("blocked" as const)
  };
}

function queueProjectionWithCompletionCandidate(
  projection: DecisionQueueProjection,
  confidenceProjection: ConfidenceCompletionProjection,
  version: ProjectionVersion,
  generatedAt?: string
): DecisionQueueProjection {
  return queueProjectionWithNextOrBlockedItem(projection, completionCandidateQueueItem(confidenceProjection), version, generatedAt);
}

function decisionIdForSpecUpdatePreview(previewRef: string): DecisionId {
  const stablePreviewToken = previewRef.replace(/^spec_update_/, "");

  return `decision_${stablePreviewToken}` as DecisionId;
}

function decisionQueueItemId(decisionId: DecisionId): QueueItemId {
  return `decision_card_${decisionId}` as QueueItemId;
}

function specUpdateDecisionQueueItem(decisionId: DecisionId, title: string) {
  return {
    queueItemId: decisionQueueItemId(decisionId),
    title,
    state: "next" as const
  };
}

function queueProjectionWithSpecUpdateDecision(
  projection: DecisionQueueProjection,
  decisionId: DecisionId,
  title: string,
  version: ProjectionVersion,
  generatedAt?: string
): DecisionQueueProjection {
  return queueProjectionWithNextOrBlockedItem(projection, specUpdateDecisionQueueItem(decisionId, title), version, generatedAt);
}

function completenessDeterministicOutputs(
  command: ProductEngineCommand,
  projection: ConfidenceCompletionProjection
): ProductEngineReduction["deterministicOutputs"] {
  return [
    {
      outputType: "completeness_snapshot",
      outputRef: `completeness:${command.sessionId}:${projection.version}`,
      payload: {
        compositeScore: projection.compositeScore,
        readinessLabel: projection.readinessLabel,
        gateFailures: projection.completionCandidate.gateFailures
      }
    },
    {
      outputType: "confidence_map",
      outputRef: `confidence:${command.sessionId}:${projection.version}`,
      payload: {
        axes: projection.axes
      }
    }
  ];
}

function runtimeProjectionWithArtifact(
  projection: RuntimeActivityProjection,
  artifact: RuntimePreviewArtifact,
  version: ProjectionVersion
): RuntimeActivityProjection {
  const artifacts = [
    ...projection.runtimeArtifacts.filter((candidate) => candidate.artifactId !== artifact.artifactId),
    artifact
  ];
  const hasBlocked = artifacts.some((candidate) => candidate.status === "blocked");
  const hasManualHandoff = artifacts.some((candidate) => candidate.status === "manual_handoff");

  return {
    ...projection,
    version,
    runtimeArtifacts: artifacts,
    runtimeStatus: hasBlocked ? "blocked" : hasManualHandoff ? "unavailable" : "available"
  };
}

function blockedArtifactFromConversion(
  command: ProductEngineCommand,
  artifact: RuntimePreviewArtifact
): RuntimePreviewArtifact {
  const blockReason =
    requiredString(command.payload.blockReason) ??
    artifact.blockedAction?.reason ??
    "Runtime artifact conversion was blocked by Phase 1 preview-only policy.";
  const blockedActionType = isBlockedActionType(command.payload.blockedActionType)
    ? command.payload.blockedActionType
    : artifact.blockedAction?.actionType;
  const payload = {
    ...artifact.payload,
    title: `Runtime artifact blocked: ${artifact.summary}`,
    body: blockReason,
    targetObject: "blocked_action",
    sourceRefs: artifact.sourceRefs,
    blockReason,
    originalArtifactId: artifact.artifactId
  };

  return {
    ...artifact,
    kind: "BlockedActionArtifact",
    applyPolicy: "blocked",
    status: "blocked",
    targetObject: "blocked_action",
    summary: `Runtime artifact blocked: ${artifact.summary}`,
    payload,
    ...(blockedActionType
      ? {
          blockedAction: {
            actionType: blockedActionType,
            reason: blockReason,
            ...(artifact.blockedAction?.suggestedSafeAlternative
              ? { suggestedSafeAlternative: artifact.blockedAction.suggestedSafeAlternative }
              : {})
          }
        }
      : {})
  };
}

function validResearchImpact(value: unknown): ResearchImpact {
  return value === "low" || value === "medium" || value === "high" ? value : "high";
}

function optionalResearchSourceReliability(value: unknown): ResearchSourceReliability | null | "invalid" {
  if (value === undefined) {
    return null;
  }

  return value === "high" || value === "medium" || value === "low" || value === "unknown" ? value : "invalid";
}

function optionalPositiveInteger(value: unknown): number | null | "invalid" {
  if (value === undefined) {
    return null;
  }

  return typeof value === "number" && Number.isInteger(value) && value > 0 ? value : "invalid";
}

function routeOutcomeForAnswer(command: ProductEngineCommand): ResearchRouteOutcome {
  if (command.payload.researchRouteHint === "research_needed" || command.payload.researchRouteHint === "missing_con_evidence") {
    return command.payload.researchRouteHint;
  }

  if (command.payload.evidenceBalanceHint === "pro_only") {
    return "missing_con_evidence";
  }

  const answer = typeof command.payload.answer === "string" ? command.payload.answer.toLowerCase() : "";

  return answer.includes("pro-only") || answer.includes("찬성만") || answer.includes("반대근거")
    ? "missing_con_evidence"
    : "research_needed";
}

function researchReviewQueueItem(researchTaskId: ResearchTaskId, title: string, state: "next" | "blocked") {
  return {
    queueItemId: `research_review_${researchTaskId}` as QueueItemId,
    title,
    state,
    cardType: "research_review" as const,
    researchTaskId
  };
}

function queueProjectionWithResearchReviewItem(
  projection: DecisionQueueProjection,
  researchTaskId: ResearchTaskId,
  title: string,
  state: "next" | "blocked",
  version: ProjectionVersion,
  generatedAt?: string
): DecisionQueueProjection {
  return queueProjectionWithNextOrBlockedItem(
    projection,
    researchReviewQueueItem(researchTaskId, title, state),
    version,
    generatedAt
  );
}

function researchCardQueueMetadata(
  card: ResearchReviewCardProjection,
  overrides: {
    readonly blocksPlanning?: boolean;
    readonly terminalOutcome?: ResearchQueueTerminalOutcome;
    readonly terminalRationale?: string;
  } = {}
): Omit<QueueItemProjection, "queueItemId" | "title" | "state"> {
  const terminalOutcome = overrides.terminalOutcome ?? card.terminalOutcome;
  const terminalRationale = overrides.terminalRationale ?? card.terminalRationale;

  return {
    cardType: card.cardType,
    researchTaskId: card.researchTaskId,
    ...(card.evidencePackId ? { evidencePackId: card.evidencePackId } : {}),
    blocksPlanning: overrides.blocksPlanning ?? card.blocksPlanning,
    availableOutcomes: card.availableOutcomes,
    ...(terminalOutcome ? { terminalOutcome } : {}),
    ...(terminalRationale ? { terminalRationale } : {})
  };
}

function queueProjectionWithResearchCard(
  projection: DecisionQueueProjection,
  card: ResearchReviewCardProjection,
  state: "next" | "blocked",
  version: ProjectionVersion,
  generatedAt?: string
): DecisionQueueProjection {
  return queueProjectionWithNextOrBlockedItem(
    projection,
    {
      queueItemId: card.cardId,
      title: card.title,
      state,
      ...researchCardQueueMetadata(card)
    },
    version,
    generatedAt
  );
}

function queueProjectionAfterResearchCardResolution(
  projection: DecisionQueueProjection,
  card: ResearchReviewCardProjection,
  outcome: ResearchQueueTerminalOutcome,
  rationale: string | undefined,
  version: ProjectionVersion,
  generatedAt?: string
): DecisionQueueProjection {
  if (outcome === "deferred") {
    return queueProjectionWithDeferredItem(
      projection,
      {
        queueItemId: card.cardId,
        title: `Research deferred: ${card.title}`,
        state: "deferred",
        ...researchCardQueueMetadata(card, {
          blocksPlanning: card.impact === "high",
          terminalOutcome: outcome,
          ...(rationale ? { terminalRationale: rationale } : {})
        })
      },
      version,
      generatedAt
    );
  }

  if (outcome === "research_insufficient") {
    return queueProjectionWithNextOrBlockedItem(
      projection,
      {
        queueItemId: card.cardId,
        title: `Research insufficient: ${card.title}`,
        state: "blocked",
        ...researchCardQueueMetadata(card, {
          blocksPlanning: card.impact === "high",
          terminalOutcome: outcome,
          ...(rationale ? { terminalRationale: rationale } : {})
        })
      },
      version,
      generatedAt
    );
  }

  return queueProjectionWithoutItem(projection, card.cardId, version, generatedAt);
}

function evidenceReviewQueueTitle(
  task: ResearchTaskProjection,
  matrix: EvidenceMatrixProjection,
  gateStatus?: "accepted" | "needs_review" | "research_insufficient" | "stale"
) {
  if (gateStatus === "stale") {
    return `Research stale: ${task.objective}`;
  }

  if (gateStatus === "needs_review") {
    return `Quality gate review required: ${task.objective}`;
  }

  if (gateStatus === "research_insufficient" && matrix.balanceStatus === "balanced") {
    return `Evidence still insufficient: ${task.objective}`;
  }

  if (matrix.balanceStatus === "balanced") {
    return `Evidence ready: ${task.objective}`;
  }

  return matrix.decisionBlocked ? `Decision blocked: ${task.objective}` : `Known risk: ${task.objective}`;
}

function evidenceReviewQueueState(
  matrix: EvidenceMatrixProjection,
  gateStatus?: "accepted" | "needs_review" | "research_insufficient" | "stale"
): "next" | "blocked" {
  return matrix.decisionBlocked || gateStatus === "needs_review" || gateStatus === "research_insufficient" || gateStatus === "stale"
    ? "blocked"
    : "next";
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

function acceptedMultiEventReduction(
  command: ProductEngineCommand,
  state: ProductEngineStateSnapshot,
  events: readonly ProductEngineEventDraft[],
  patch: ProductEngineReduction["nextState"],
  deterministicOutputs: ProductEngineReduction["deterministicOutputs"],
  effectPlan: readonly ProductEngineEffectPlanItem[] = [],
  immediateProjection?: ActiveBatchSafeProjection
): ProductEngineReduction {
  return {
    accepted: true,
    events,
    nextState: {
      stateVersion: (numericVersion(state.stateVersion) + events.length) as StateVersion,
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

function objectPayload<TValue>(payload: ProductEngineEvent["payload"], key: string): TValue | null {
  const value = payload[key];

  return typeof value === "object" && value !== null ? (value as TValue) : null;
}

function confidenceProjectionPayload(payload: ProductEngineEvent["payload"]) {
  return objectPayload<ConfidenceCompletionProjection>(payload, "confidenceProjection");
}

function queueProjectionPayload(payload: ProductEngineEvent["payload"]) {
  return objectPayload<DecisionQueueProjection>(payload, "queueProjection");
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
    case "ResearchPlanned":
    case "ResearchResultImported":
    case "EvidenceSynthesisRequested":
    case "EvidenceSynthesized":
    case "ResearchQueueCardResolved":
      return "research";
    case "CompletenessScored":
      return event.payload.candidateStatus === "candidate" ? "completion" : null;
    case "FounderBriefPrepared":
      return event.payload.exportReady === true ? "completion" : null;
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
  const sections = CANONICAL_INITIAL_SPEC_SECTIONS;
  const title = `초기 제품 스펙 초안: ${state.project.rawIdeaText ?? "Untitled idea"}`;
  const projection = createLivingSpecProjection(command, projectionVersionFor(state), title, sections);
  const event = eventDraft(command, "InitialSpecDrafted", {
    draftRef,
    title,
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
        title,
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
    : defaultQuestionBatchIssues(openIssues);

  if (selectedIssues.some((issue) => issue === undefined)) {
    return reject("ActivateQuestionBatch queueItemIds must reference open ambiguity issues.");
  }
  const candidateIssues = selectedIssues as readonly AmbiguityIssueSnapshot[];

  if (candidateIssues.length < 3 || candidateIssues.length > 5) {
    return reject("ActivateQuestionBatch requires 3 to 5 open ambiguity issues.");
  }

  if (hasDuplicateTopicKey(candidateIssues)) {
    return reject("ActivateQuestionBatch requires at most one open issue per topicKey.");
  }

  if (state.queueProjection.active.length > 0) {
    return reject("ActivateQuestionBatch cannot replace an already active batch.");
  }

  const projection = queueProjectionFromIssues(candidateIssues, projectionVersionFor(state), command.sessionId, command.issuedAt);
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

interface QueueItemResolutionConfig {
  readonly commandType: "DeferQueueItem" | "DismissQueueItem";
  readonly eventType: "QueueItemDeferred" | "QueueItemDismissed";
  readonly issueStatus: Extract<AmbiguityIssueSnapshot["status"], "deferred" | "resolved">;
  readonly nextQueueProjection: (
    projection: DecisionQueueProjection,
    item: QueueItemProjection,
    version: ProjectionVersion,
    generatedAt: string
  ) => DecisionQueueProjection;
  readonly unavailableMessage: string;
}

function reduceQueueItemResolution(
  command: ProductEngineCommand,
  state: ProductEngineStateSnapshot,
  config: QueueItemResolutionConfig
): ProductEngineReduction {
  const queueItemId = requiredString(command.payload.queueItemId);
  const reason = requiredString(command.payload.reason);

  if (!queueItemId || !reason) {
    return reject(`${config.commandType} requires queueItemId and a non-empty reason.`, "VALIDATION_FAILED");
  }

  const typedQueueItemId = queueItemId as QueueItemId;
  const existingItem = queueItemFromProjection(state.queueProjection, typedQueueItemId);

  if (!existingItem) {
    return reject(`${config.commandType} requires an existing queue item.`, "RESOURCE_NOT_FOUND");
  }

  if (existingItem.state === config.issueStatus) {
    return reject(config.unavailableMessage, "COMMAND_PRECONDITION_FAILED");
  }

  const queueProjection = config.nextQueueProjection(
    state.queueProjection,
    existingItem,
    projectionVersionFor(state),
    command.issuedAt
  );
  const nextOpenIssues = issuesWithQueueItemStatus(state.openIssues, typedQueueItemId, config.issueStatus);
  const confidenceProjection = buildConfidenceCompletionProjection(
    {
      ...state,
      openIssues: nextOpenIssues,
      queueProjection
    },
    queueProjection.version
  );
  const event = eventDraft(command, config.eventType, {
    queueItemId,
    reason,
    projection: queueProjection,
    confidenceProjection
  });

  return acceptedReduction(
    command,
    state,
    event,
    {
      openIssues: nextOpenIssues,
      queueProjection,
      completeness: confidenceProjection
    },
    [
      {
        outputType: "reducer_deterministic_output",
        outputRef: queueItemId,
        payload: {
          queueItemId,
          reason
        }
      },
      ...completenessDeterministicOutputs(command, confidenceProjection)
    ],
    [
      queueProjectionEffect(
        command,
        config.eventType,
        {
          refType: "queue_item",
          refId: queueItemId
        },
        "normal"
      )
    ],
    queueProjection
  );
}

function reduceDeferQueueItem(command: ProductEngineCommand, state: ProductEngineStateSnapshot): ProductEngineReduction {
  return reduceQueueItemResolution(command, state, {
    commandType: "DeferQueueItem",
    eventType: "QueueItemDeferred",
    issueStatus: "deferred",
    nextQueueProjection: (projection, item, version, generatedAt) =>
      queueProjectionWithDeferredItem(
        projection,
        {
          ...item,
          state: "deferred"
        },
        version,
        generatedAt
      ),
    unavailableMessage: "DeferQueueItem requires a queue item that is not already deferred."
  });
}

function reduceDismissQueueItem(command: ProductEngineCommand, state: ProductEngineStateSnapshot): ProductEngineReduction {
  return reduceQueueItemResolution(command, state, {
    commandType: "DismissQueueItem",
    eventType: "QueueItemDismissed",
    issueStatus: "resolved",
    nextQueueProjection: (projection, item, version, generatedAt) =>
      queueProjectionWithoutItem(projection, item.queueItemId, version, generatedAt),
    unavailableMessage: "DismissQueueItem requires a queue item that is not already resolved."
  });
}

function reduceSubmitAnswer(command: ProductEngineCommand, state: ProductEngineStateSnapshot): ProductEngineReduction {
  const queueItemId = requiredString(command.payload.queueItemId);
  const answer = requiredString(command.payload.answer);

  if (!queueItemId || !answer) {
    return reject("SubmitAnswer requires queueItemId and a non-empty answer.", "VALIDATION_FAILED");
  }

  const activeItem = state.queueProjection.active.find((item) => item.queueItemId === queueItemId);

  if (!activeItem || activeItem.state !== "active") {
    return reject("SubmitAnswer requires an active question card.");
  }

  const projection = queueProjectionWithAnsweredItem(
    state.queueProjection,
    queueItemId as QueueItemId,
    (numericVersion(state.stateVersion) + 2) as ProjectionVersion,
    command.issuedAt
  );
  const answerRef = `answer_${stableToken(`${command.sessionId}:${queueItemId}:${answer}`)}`;
  const routeOutcome = routeOutcomeForAnswer(command);
  const impact = validResearchImpact(command.payload.claimImpact);
  const sourceQuestion = state.openIssues.find((issue) => issue.queueItemId === queueItemId);
  const objective =
    requiredString(command.payload.researchObjective) ??
    `Validate evidence for: ${sourceQuestion?.summary ?? activeItem.title}`;
  const researchTaskId = `research_task_${stableToken(`${command.sessionId}:${queueItemId}:${answer}:${routeOutcome}`)}` as ResearchTaskId;
  const researchTask = planResearchTask({
    researchTaskId,
    sessionId: command.sessionId,
    sourceQueueItemId: queueItemId as QueueItemId,
    sourceAnswerRef: answerRef,
    objective,
    routeOutcome,
    impact,
    createdAt: command.issuedAt
  });
  const queueProjection = queueProjectionWithResearchReviewItem(
    projection,
    researchTaskId,
    routeOutcome === "missing_con_evidence"
      ? `반대근거 탐색 필요: ${activeItem.title}`
      : `Research review: ${activeItem.title}`,
    routeOutcome === "missing_con_evidence" ? "blocked" : "next",
    projection.version,
    command.issuedAt
  );
  const researchProjection = addResearchTaskToProjection(
    state.researchState,
    researchTask,
    queueProjection.version
  );
  const event = eventDraft(command, "AnswerSubmitted", {
    answerRef,
    queueItemId,
    answer,
    answerRouteOutcome: routeOutcome,
    researchTaskId,
    projection: queueProjection
  });
  const researchEvent = eventDraft(command, "ResearchPlanned", {
    researchTask,
    sourceAnswerRef: answerRef,
    projection: researchProjection
  });
  const nextOpenIssues = state.openIssues.map((issue) =>
    issue.queueItemId === queueItemId
      ? {
          ...issue,
          status: "answered" as const
        }
      : issue
  );
  const nextSession = {
    ...state.session,
    phase: "research" as const
  };
  const confidenceProjection = buildConfidenceCompletionProjection(
    {
      ...state,
      openIssues: nextOpenIssues,
      queueProjection,
      researchState: researchProjection,
      session: nextSession
    },
    queueProjection.version
  );
  const researchEventWithConfidence = {
    ...researchEvent,
    payload: {
      ...researchEvent.payload,
      confidenceProjection
    }
  };

  return acceptedMultiEventReduction(
    command,
    state,
    [event, researchEventWithConfidence],
    {
      openIssues: nextOpenIssues,
      queueProjection,
      researchState: researchProjection,
      completeness: confidenceProjection,
      session: nextSession
    },
    [
      {
        outputType: "reducer_deterministic_output",
        outputRef: answerRef,
        payload: {
          queueItemId,
          answer,
          answerRouteOutcome: routeOutcome,
          researchTaskId
        }
      },
      ...completenessDeterministicOutputs(command, confidenceProjection)
    ],
    [
      researchEvidenceEffect(
        command,
        ["ResearchPlanned"],
        {
          refType: "ResearchTask",
          refId: researchTaskId
        },
        "normal",
        `research:${researchTaskId}`
      )
    ],
    queueProjection
  );
}

function reducePlanResearch(command: ProductEngineCommand, state: ProductEngineStateSnapshot): ProductEngineReduction {
  const objective = requiredString(command.payload.objective);

  if (!objective) {
    return reject("PlanResearch requires a non-empty objective.", "VALIDATION_FAILED");
  }

  const sourceQueueItemId = requiredString(command.payload.sourceQueueItemId) as QueueItemId | null;
  const routeOutcome =
    command.payload.routeOutcome === "missing_con_evidence" ? "missing_con_evidence" : "research_needed";
  const impact = validResearchImpact(command.payload.impact);
  const researchTaskId = `research_task_${stableToken(`${command.sessionId}:${objective}:${sourceQueueItemId ?? "manual"}`)}` as ResearchTaskId;
  const researchTask = planResearchTask({
    researchTaskId,
    sessionId: command.sessionId,
    ...(sourceQueueItemId ? { sourceQueueItemId } : {}),
    objective,
    routeOutcome,
    impact,
    createdAt: command.issuedAt
  });
  const researchProjection = addResearchTaskToProjection(
    state.researchState,
    researchTask,
    projectionVersionFor(state)
  );
  const event = eventDraft(command, "ResearchPlanned", {
    researchTask,
    projection: researchProjection
  });

  return acceptedReduction(
    command,
    state,
    event,
    {
      researchState: researchProjection,
      session: {
        ...state.session,
        phase: "research"
      }
    },
    [
      {
        outputType: "reducer_deterministic_output",
        outputRef: researchTaskId,
        payload: {
          objective,
          routeOutcome,
          impact
        }
      }
    ],
    [
      researchEvidenceEffect(
        command,
        ["ResearchPlanned"],
        {
          refType: "ResearchTask",
          refId: researchTaskId
        },
        "normal",
        `research:${researchTaskId}`
      )
    ],
    researchProjection
  );
}

function reduceImportResearchResult(
  command: ProductEngineCommand,
  state: ProductEngineStateSnapshot
): ProductEngineReduction {
  const researchTaskId = requiredString(command.payload.researchTaskId) as ResearchTaskId | null;
  const result = requiredString(command.payload.result);

  if (!researchTaskId || !result) {
    return reject("ImportResearchResult requires researchTaskId and non-empty result.", "VALIDATION_FAILED");
  }

  const researchTask = state.researchState.tasks.find((task) => task.researchTaskId === researchTaskId);

  if (!researchTask) {
    return reject("ImportResearchResult requires an existing ResearchTask.", "RESOURCE_NOT_FOUND");
  }

  const requestedSynthesisVersion = optionalPositiveInteger(command.payload.synthesisVersion);

  if (requestedSynthesisVersion === "invalid") {
    return reject("ImportResearchResult requires synthesisVersion to be a positive integer.", "VALIDATION_FAILED");
  }

  const sourceReliability = optionalResearchSourceReliability(command.payload.sourceReliability);

  if (sourceReliability === "invalid") {
    return reject("ImportResearchResult requires sourceReliability to be high, medium, low, or unknown.", "VALIDATION_FAILED");
  }

  const synthesisVersion = requestedSynthesisVersion ?? 1;
  const researchResultId = `research_result_${stableToken(`${researchTaskId}:${result}`)}` as ResearchResultId;
  const researchResult = importResearchResult({
    researchResultId,
    researchTaskId,
    result,
    importedAt: command.issuedAt,
    ...(typeof command.payload.researchRunId === "string"
      ? { researchRunId: command.payload.researchRunId as ResearchRunId }
      : {}),
    ...(typeof command.payload.sourceTitle === "string" ? { sourceTitle: command.payload.sourceTitle } : {}),
    ...(typeof command.payload.sourceUrl === "string" ? { sourceUrl: command.payload.sourceUrl } : {}),
    ...(sourceReliability ? { sourceReliability } : {}),
    ...(typeof command.payload.sourcePublishedAt === "string"
      ? { sourcePublishedAt: command.payload.sourcePublishedAt }
      : {}),
    ...(typeof command.payload.sourceRetrievedAt === "string"
      ? { sourceRetrievedAt: command.payload.sourceRetrievedAt }
      : {}),
    ...(typeof command.payload.limitationNotes === "string" ? { limitationNotes: command.payload.limitationNotes } : {}),
    ...(typeof command.payload.claim === "string" ? { claim: command.payload.claim } : {}),
    ...(typeof command.payload.decisionContext === "string" ? { decisionContext: command.payload.decisionContext } : {}),
    ...(typeof command.payload.specSectionRef === "string" ? { specSectionRef: command.payload.specSectionRef } : {}),
    ...(typeof command.payload.questionRef === "string" ? { questionRef: command.payload.questionRef } : {}),
    ...(typeof command.payload.implicationScope === "string" ? { implicationScope: command.payload.implicationScope } : {}),
    ...(typeof command.payload.staleSensitive === "boolean" ? { staleSensitive: command.payload.staleSensitive } : {}),
    ...(typeof command.payload.sourceRequiredAfter === "string"
      ? { sourceRequiredAfter: command.payload.sourceRequiredAfter }
      : {})
  });
  const researchProjection = addImportedResearchResultToProjection(
    state.researchState,
    researchTask,
    researchResult,
    projectionVersionFor(state)
  );
  const importedEvent = eventDraft(command, "ResearchResultImported", {
    researchTaskId,
    researchResult,
    synthesisVersion,
    projection: researchProjection
  });

  return acceptedReduction(
    command,
    state,
    importedEvent,
    {
      researchState: researchProjection
    },
    [
      {
        outputType: "reducer_deterministic_output",
        outputRef: researchResultId,
        payload: {
          researchTaskId,
          synthesisVersion
        }
      }
    ],
    [
      researchEvidenceEffect(
        command,
        ["ResearchResultImported"],
        {
          refType: "ResearchResult",
          refId: researchResultId
        },
        "high",
        `research-result:${researchResultId}:v${synthesisVersion}`,
        `synthesisVersion:${synthesisVersion}`
      )
    ]
  );
}

function reduceSynthesizeEvidence(command: ProductEngineCommand, state: ProductEngineStateSnapshot): ProductEngineReduction {
  const researchResultId = requiredString(command.payload.researchResultId) as ResearchResultId | null;

  if (!researchResultId) {
    return reject("SynthesizeEvidence requires researchResultId.", "VALIDATION_FAILED");
  }

  const researchResult = state.researchState.results.find((result) => result.researchResultId === researchResultId);

  if (!researchResult) {
    return reject("SynthesizeEvidence requires an imported ResearchResult.", "RESOURCE_NOT_FOUND");
  }

  const researchTask = state.researchState.tasks.find((task) => task.researchTaskId === researchResult.researchTaskId);

  if (!researchTask) {
    return reject("SynthesizeEvidence requires the source ResearchTask.", "RESOURCE_NOT_FOUND");
  }

  const requestedSynthesisVersion = optionalPositiveInteger(command.payload.synthesisVersion);

  if (requestedSynthesisVersion === "invalid") {
    return reject("SynthesizeEvidence requires synthesisVersion to be a positive integer.", "VALIDATION_FAILED");
  }

  const synthesisVersion =
    requestedSynthesisVersion ??
    Math.max(
      1,
      ...state.researchState.evidenceMatrices
        .filter((matrix) => matrix.researchResultId === researchResultId)
        .map((matrix) => matrix.synthesisVersion + 1)
    );

  if (command.actor !== "effect_executor") {
    const requestedEvent = eventDraft(command, "EvidenceSynthesisRequested", {
      researchTaskId: researchTask.researchTaskId,
      researchResultId,
      synthesisVersion
    });

    return acceptedReduction(
      command,
      state,
      requestedEvent,
      {},
      [
        {
          outputType: "reducer_deterministic_output",
          outputRef: `synthesis_request:${researchResultId}:v${synthesisVersion}`,
          payload: {
            researchResultId,
            synthesisVersion
          }
        }
      ],
      [
        researchEvidenceEffect(
          command,
          ["EvidenceSynthesisRequested"],
          {
            refType: "ResearchResult",
            refId: researchResultId
          },
          "high",
          `research-result:${researchResultId}:v${synthesisVersion}`,
          `synthesisVersion:${synthesisVersion}`
        )
      ]
    );
  }

  const evidenceMatrix = synthesizeEvidenceMatrix({
    researchTask,
    researchResult,
    synthesisVersion
  });
  const evidencePack = buildDecisionEvidencePack({
    researchTask,
    researchResult,
    synthesisVersion,
    matrix: evidenceMatrix
  });
  const researchProjection = addResearchResultToProjection(
    state.researchState,
    researchTask,
    researchResult,
    evidenceMatrix,
    evidencePack,
    projectionVersionFor(state)
  );
  const researchCard = researchProjection.reviewCards.find((card) => card.researchTaskId === researchTask.researchTaskId);
  const queueProjection = researchCard
    ? queueProjectionWithResearchCard(
        state.queueProjection,
        researchCard,
        evidenceReviewQueueState(evidenceMatrix, evidencePack.gateStatus),
        researchProjection.version,
        command.issuedAt
      )
    : queueProjectionWithResearchReviewItem(
        state.queueProjection,
        researchTask.researchTaskId,
        evidenceReviewQueueTitle(researchTask, evidenceMatrix, evidencePack.gateStatus),
        evidenceReviewQueueState(evidenceMatrix, evidencePack.gateStatus),
        researchProjection.version,
        command.issuedAt
      );
  const confidenceProjection = buildConfidenceCompletionProjection(
    {
      ...state,
      researchState: researchProjection,
      queueProjection
    },
    researchProjection.version
  );
  const event = eventDraft(command, "EvidenceSynthesized", {
    researchTaskId: researchTask.researchTaskId,
    researchResultId,
    evidenceMatrix,
    evidencePack,
    projection: researchProjection,
    queueProjection,
    confidenceProjection
  });

  return acceptedReduction(
    command,
    state,
    event,
    {
      researchState: researchProjection,
      queueProjection,
      completeness: confidenceProjection
    },
    [
      {
        outputType: "reducer_deterministic_output",
        outputRef: evidenceMatrix.evidenceMatrixId,
        payload: {
          balanceStatus: evidenceMatrix.balanceStatus,
          decisionBlocked: evidenceMatrix.decisionBlocked,
          evidencePackId: evidencePack.evidencePackId,
          qualityGateStatus: evidencePack.gateStatus
        }
      },
      ...completenessDeterministicOutputs(command, confidenceProjection)
    ],
    [
      queueProjectionEffect(
        command,
        "EvidenceSynthesized",
        {
          refType: "EvidenceMatrix",
          refId: evidenceMatrix.evidenceMatrixId
        },
        "normal"
      )
    ]
  );
}

function reduceResolveResearchQueueCard(
  command: ProductEngineCommand,
  state: ProductEngineStateSnapshot
): ProductEngineReduction {
  const cardId = requiredString(command.payload.cardId) as QueueItemId | null;
  const outcome = isResearchQueueTerminalOutcome(command.payload.outcome) ? command.payload.outcome : null;
  const rationale = requiredString(command.payload.rationale) ?? undefined;

  if (!cardId || !outcome) {
    return reject("ResolveResearchQueueCard requires cardId and a supported terminal outcome.", "VALIDATION_FAILED");
  }

  const card = state.researchState.reviewCards.find((candidate) => candidate.cardId === cardId);

  if (!card) {
    return reject("ResolveResearchQueueCard requires an existing research-updated queue card.", "RESOURCE_NOT_FOUND");
  }

  if (card.terminalOutcome) {
    return reject("ResolveResearchQueueCard cannot resolve an already terminal research card.", "COMMAND_PRECONDITION_FAILED", {
      cardId,
      terminalOutcome: card.terminalOutcome
    });
  }

  if (!card.availableOutcomes.includes(outcome)) {
    return reject("ResolveResearchQueueCard outcome is not available for this card type.", "VALIDATION_FAILED", {
      cardId,
      cardType: card.cardType,
      availableOutcomes: card.availableOutcomes
    });
  }

  if ((outcome === "deferred" || outcome === "risk_accepted") && !rationale) {
    return reject("Deferred and risk_accepted research outcomes require a user-visible rationale.", "VALIDATION_FAILED", {
      outcome
    });
  }

  const version = projectionVersionFor(state);
  const researchProjection = resolveResearchReviewCardInProjection(
    state.researchState,
    cardId,
    outcome,
    rationale,
    version
  );
  const resolvedCard = researchProjection.reviewCards.find((candidate) => candidate.cardId === cardId) ?? card;
  const queueProjection = queueProjectionAfterResearchCardResolution(
    state.queueProjection,
    resolvedCard,
    outcome,
    rationale,
    version,
    command.issuedAt
  );
  const confidenceProjection = buildConfidenceCompletionProjection(
    {
      ...state,
      researchState: researchProjection,
      queueProjection
    },
    version
  );
  const event = eventDraft(command, "ResearchQueueCardResolved", {
    cardId,
    researchTaskId: card.researchTaskId,
    evidencePackId: card.evidencePackId,
    cardType: card.cardType,
    outcome,
    ...(rationale ? { rationale } : {}),
    projection: researchProjection,
    queueProjection,
    confidenceProjection
  });

  return acceptedReduction(
    command,
    state,
    event,
    {
      researchState: researchProjection,
      queueProjection,
      completeness: confidenceProjection
    },
    [
      {
        outputType: "reducer_deterministic_output",
        outputRef: cardId,
        payload: {
          outcome,
          ...(rationale ? { rationale } : {}),
          blocksPlanning: resolvedCard.blocksPlanning
        }
      },
      ...completenessDeterministicOutputs(command, confidenceProjection)
    ],
    [
      queueProjectionEffect(
        command,
        "ResearchQueueCardResolved",
        {
          refType: "queue_item",
          refId: cardId
        },
        "high"
      )
    ],
    queueProjection
  );
}

function runtimeArtifactFromPayload(
  command: ProductEngineCommand,
  source: CodexRuntimeSource
): RuntimePreviewArtifact | ProductEngineReduction {
  const turnPurpose = command.payload.turnPurpose;
  const contextHash = requiredString(command.payload.contextHash);
  const summary = requiredString(command.payload.summary) ?? requiredString(command.payload.prompt);
  const body = requiredString(command.payload.body) ?? requiredString(command.payload.prompt);
  const sourceRefs = requiredNonEmptyStringArray(command.payload.sourceRefs);

  if (!isCodexTurnPurpose(turnPurpose) || !contextHash || !summary || !body || sourceRefs === "invalid") {
    return reject("CreateRuntimePreview requires turnPurpose, contextHash, prompt/body, and valid sourceRefs.", "VALIDATION_FAILED");
  }

  const requestedBlockedActionType = command.payload.blockedActionType ?? command.payload.requestedActionType;
  const blockedActionReason =
    requiredString(command.payload.blockedActionReason) ??
    requiredString(command.payload.requestedActionReason) ??
    "Phase 1 converts forbidden runtime actions into blocked preview artifacts.";
  const blockedActionType = isBlockedActionType(requestedBlockedActionType) ? requestedBlockedActionType : null;
  const hasBlockedAction = blockedActionType !== null;
  const requestedKind = command.payload.artifactKind;
  const requestedPolicy = command.payload.applyPolicy;
  const kind = hasBlockedAction
    ? "BlockedActionArtifact"
    : isCodexArtifactKind(requestedKind)
      ? requestedKind
      : CODEX_ARTIFACT_KIND_BY_TURN_PURPOSE[turnPurpose];
  const applyPolicy = hasBlockedAction
    ? "blocked"
    : isCodexApplyPolicy(requestedPolicy)
      ? requestedPolicy
      : source === "manual_prompt_handoff"
        ? "manual_handoff_required"
        : CODEX_APPLY_POLICY_BY_TURN_PURPOSE[turnPurpose];
  const status = hasBlockedAction ? "blocked" : source === "manual_prompt_handoff" ? "manual_handoff" : "preview_ready";
  const runtimeAdapterVersion =
    requiredString(command.payload.runtimeAdapterVersion) ?? CODEX_RUNTIME_ADAPTER_VERSION;
  const artifactId = runtimeArtifactIdFor(command.sessionId, turnPurpose, contextHash, runtimeAdapterVersion);
  const targetObject =
    requiredString(command.payload.targetObject) ?? (kind === "BlockedActionArtifact" ? "blocked_action" : turnPurpose);
  const phase15bUpgradeHints = phase15bUpgradeHintsFromPayload(command.payload);

  if (phase15bUpgradeHints.kind === "invalid") {
    return phase15bUpgradeHints.rejection;
  }

  if (phase15bUpgradeHints.kind === "valid" && !isPhase15bHintArtifactKind(kind)) {
    return reject(
      "CreateRuntimePreview phase15bUpgradeHints may only be attached to ImplementationPlanPreviewArtifact or BlockedActionArtifact.",
      "VALIDATION_FAILED"
    );
  }

  if (phase15bUpgradeHints.kind === "valid" && hasBlockedAction) {
    try {
      assertPhase15bUpgradeHintsMatchBlockedAction(phase15bUpgradeHints.hints, blockedActionType);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);

      return reject(`CreateRuntimePreview phase15bUpgradeHints is invalid: ${message}`, "VALIDATION_FAILED");
    }
  }

  return {
    artifactId,
    turnPurpose,
    kind,
    applyPolicy,
    status,
    source,
    targetObject,
    summary,
    payload: {
      title: summary,
      body,
      targetObject,
      sourceRefs,
      ...(phase15bUpgradeHints.kind === "valid" ? { phase15bUpgradeHints: phase15bUpgradeHints.hints } : {})
    },
    sourceRefs,
    contextHash,
    runtimeAdapterVersion,
    ...(typeof command.payload.sourceEffectTaskId === "string"
      ? { sourceEffectTaskId: command.payload.sourceEffectTaskId as EffectTaskId }
      : {}),
    ...(hasBlockedAction
      ? {
          blockedAction: {
            actionType: blockedActionType,
            reason: blockedActionReason,
            ...(typeof command.payload.suggestedSafeAlternative === "string"
              ? { suggestedSafeAlternative: command.payload.suggestedSafeAlternative }
              : {})
          }
        }
      : {}),
    createdAt: command.issuedAt,
    schemaVersion: command.schemaVersion
  };
}

type Phase15bUpgradeHintsValidationResult =
  | { readonly kind: "absent" }
  | { readonly kind: "valid"; readonly hints: Phase15bUpgradeHints }
  | { readonly kind: "invalid"; readonly rejection: ProductEngineReduction };

function phase15bUpgradeHintsFromPayload(
  payload: ProductEngineCommand["payload"]
): Phase15bUpgradeHintsValidationResult {
  if (!hasOwnRecordKey(payload, "phase15bUpgradeHints")) {
    return { kind: "absent" };
  }

  try {
    return { kind: "valid", hints: validatePhase15bUpgradeHints(payload.phase15bUpgradeHints) };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);

    return {
      kind: "invalid",
      rejection: reject(`CreateRuntimePreview phase15bUpgradeHints is invalid: ${message}`, "VALIDATION_FAILED")
    };
  }
}

function reduceCreateRuntimePreview(
  command: ProductEngineCommand,
  state: ProductEngineStateSnapshot
): ProductEngineReduction {
  const turnPurpose = command.payload.turnPurpose;
  const contextHash = requiredString(command.payload.contextHash);
  const prompt = requiredString(command.payload.prompt);
  const sourceRefs = requiredNonEmptyStringArray(command.payload.sourceRefs);

  if (!isCodexTurnPurpose(turnPurpose) || !contextHash || !prompt || sourceRefs === "invalid") {
    return reject("CreateRuntimePreview requires turnPurpose, contextHash, prompt, and valid sourceRefs.", "VALIDATION_FAILED");
  }

  const source =
    command.actor === "effect_executor"
      ? command.payload.source === "protocol_fixture"
        ? "protocol_fixture"
        : command.payload.source === "codex_app_server"
          ? "codex_app_server"
          : "manual_prompt_handoff"
      : command.payload.mode === "manual_handoff"
        ? "manual_prompt_handoff"
        : null;

  if (!source) {
    const requestedActionType = isBlockedActionType(command.payload.requestedActionType)
      ? command.payload.requestedActionType
      : null;
    const requestedActionReason = requiredString(command.payload.requestedActionReason);
    const event = eventDraft(command, "RuntimePreviewRequested", {
      turnPurpose,
      contextHash,
      prompt,
      sourceRefs,
      targetObject: requiredString(command.payload.targetObject) ?? turnPurpose,
      runtimeAdapterVersion: CODEX_RUNTIME_ADAPTER_VERSION,
      ...(requestedActionType ? { requestedActionType } : {}),
      ...(requestedActionReason ? { requestedActionReason } : {})
    });

    return acceptedReduction(
      command,
      state,
      event,
      {},
      [
        {
          outputType: "reducer_deterministic_output",
          outputRef: `runtime_preview_request:${turnPurpose}:${contextHash}`,
          payload: {
            turnPurpose,
            contextHash,
            runtimeAdapterVersion: CODEX_RUNTIME_ADAPTER_VERSION
          }
        }
      ],
      [codexRuntimePreviewEffect(command, turnPurpose, contextHash)]
    );
  }

  const artifactOrRejection = runtimeArtifactFromPayload(command, source);

  if (!("artifactId" in artifactOrRejection)) {
    return artifactOrRejection;
  }

  const runtimeProjection = runtimeProjectionWithArtifact(
    state.runtimeState,
    artifactOrRejection,
    projectionVersionFor(state)
  );
  const queueProjection = queueProjectionWithRuntimePreviewItem(
    state.queueProjection,
    artifactOrRejection,
    runtimeProjection.version,
    command.issuedAt
  );
  const confidenceProjection = buildConfidenceCompletionProjection(
    {
      ...state,
      runtimeState: runtimeProjection,
      queueProjection
    },
    runtimeProjection.version
  );
  const event = eventDraft(command, "RuntimePreviewRequested", {
    turnPurpose,
    contextHash,
    runtimeArtifact: artifactOrRejection,
    projection: runtimeProjection,
    queueProjection,
    confidenceProjection
  });

  return acceptedReduction(
    command,
    state,
    event,
    {
      runtimeState: runtimeProjection,
      queueProjection,
      completeness: confidenceProjection
    },
    [
      {
        outputType: "reducer_deterministic_output",
        outputRef: artifactOrRejection.artifactId,
        payload: {
          turnPurpose,
          kind: artifactOrRejection.kind,
          applyPolicy: artifactOrRejection.applyPolicy,
          status: artifactOrRejection.status
        }
      },
      ...completenessDeterministicOutputs(command, confidenceProjection)
    ],
    [],
    runtimeProjection
  );
}

function reduceConvertRuntimeArtifact(
  command: ProductEngineCommand,
  state: ProductEngineStateSnapshot
): ProductEngineReduction {
  const artifactId = requiredString(command.payload.artifactId) as RuntimeArtifactId | null;
  const artifact = artifactId
    ? state.runtimeState.runtimeArtifacts.find((candidate) => candidate.artifactId === artifactId)
    : null;

  if (!artifact) {
    return reject("ConvertRuntimeArtifact requires an existing RuntimePreviewArtifact.", "RESOURCE_NOT_FOUND");
  }

  const artifactRef = artifact.artifactId;
  const target = requiredString(command.payload.target);
  const blockReason = requiredString(command.payload.blockReason);

  if (!target) {
    return reject("ConvertRuntimeArtifact requires target.", "VALIDATION_FAILED");
  }

  if (isFinalPlanningHandoffConversionTarget(target)) {
    return reject(
      "ConvertRuntimeArtifact cannot create a final PlanningHandoffArtifact; use CreatePlanningHandoff gate instead.",
      "RUNTIME_ACTION_BLOCKED"
    );
  }

  const requestsBlockedTarget = target === "blocked_action" || Boolean(blockReason);
  const hasBlockedActionTaxonomy =
    isBlockedActionType(command.payload.blockedActionType) || Boolean(artifact.blockedAction?.actionType);

  if (requestsBlockedTarget && !hasBlockedActionTaxonomy) {
    return reject("Blocked runtime artifact conversion requires blockedActionType taxonomy.", "VALIDATION_FAILED");
  }

  if (isRuntimeArtifactBlocked(artifact) || requestsBlockedTarget) {
    const blockedArtifact = requestsBlockedTarget ? blockedArtifactFromConversion(command, artifact) : artifact;
    const runtimeProjection = runtimeProjectionWithArtifact(
      state.runtimeState,
      blockedArtifact,
      projectionVersionFor(state)
    );
    const queueProjection = queueProjectionWithRuntimePreviewItem(
      state.queueProjection,
      blockedArtifact,
      runtimeProjection.version,
      command.issuedAt
    );
    const confidenceProjection = buildConfidenceCompletionProjection(
      {
        ...state,
        runtimeState: runtimeProjection,
        queueProjection
      },
      runtimeProjection.version
    );
    const event = eventDraft(command, "RuntimeArtifactConverted", {
      artifactId: artifactRef,
      conversionStatus: "blocked",
      blockReason:
        blockedArtifact.blockedAction?.reason ??
        blockReason ??
        "Blocked runtime artifact cannot be converted into execution.",
      runtimeArtifact: blockedArtifact,
      projection: runtimeProjection,
      queueProjection,
      confidenceProjection
    });

    return acceptedReduction(
      command,
      state,
      event,
      {
        runtimeState: runtimeProjection,
        queueProjection,
        completeness: confidenceProjection
      },
      [
        {
          outputType: "reducer_deterministic_output",
          outputRef: artifactRef,
          payload: {
            conversionStatus: "blocked"
          }
        },
        ...completenessDeterministicOutputs(command, confidenceProjection)
      ],
      [],
      runtimeProjection
    );
  }

  const event = eventDraft(command, "RuntimeArtifactConverted", {
    artifactId: artifactRef,
    conversionStatus: "preview_only",
    target
  });

  return acceptedReduction(
    command,
    state,
    event,
    {},
    [
      {
        outputType: "reducer_deterministic_output",
        outputRef: artifactRef,
        payload: {
          conversionStatus: "preview_only",
          target
        }
      }
    ]
  );
}

type NonReadyPlanningHandoffVerdict = Exclude<PlanningHandoffVerdict, "planning_ready">;

const PLANNING_HANDOFF_SOURCE_TYPES = [
  "spec_version",
  "founder_brief",
  "completion_candidate",
  "decision_linked_evidence_pack",
  "research_updated_queue_item",
  "decision",
  "risk_acceptance",
  "known_risk",
  "open_question",
  "phase15b_hint",
  "runtime_preview_artifact",
  "activity_event"
] as const satisfies readonly PlanningHandoffSourceType[];

const PLANNING_HANDOFF_FATAL_BLOCKER_CLASSES = [
  "customer_problem_jtbd",
  "success_metrics_validation",
  "approval_security_execution_safety"
] as const satisfies readonly PlanningHandoffBlockerClass[];

const PLANNING_HANDOFF_REQUIRED_SOURCE_REQUIREMENTS = [
  {
    sourceTypes: ["spec_version"],
    blockerId: "blocker_source_trace_spec_version",
    whyFatal: "Planning Handoff requires a current SpecVersion or living spec source ref.",
    requiredNextAction: "revise"
  },
  {
    sourceTypes: ["completion_candidate", "founder_brief"],
    blockerId: "blocker_source_trace_completion_candidate",
    whyFatal: "Planning Handoff requires a current completion candidate or Founder Brief source ref.",
    requiredNextAction: "revise"
  },
  {
    sourceTypes: ["decision_linked_evidence_pack"],
    blockerId: "blocker_source_trace_evidence_pack",
    whyFatal: "Planning Handoff requires a current decision-linked Evidence Pack source ref.",
    requiredNextAction: "research_more"
  },
  {
    sourceTypes: ["research_updated_queue_item"],
    blockerId: "blocker_source_trace_research_queue",
    whyFatal: "Planning Handoff requires a current research-updated Queue source ref.",
    requiredNextAction: "research_more"
  }
] as const satisfies readonly {
  readonly sourceTypes: readonly PlanningHandoffSourceType[];
  readonly blockerId: string;
  readonly whyFatal: string;
  readonly requiredNextAction: PlanningHandoffRequiredUserAction;
}[];

const PLANNING_HANDOFF_EXCLUDED_INTERNAL_PHASES = [
  "phase3_controlled_execution",
  "chatgpt_web_automation",
  "external_deploy"
] as const satisfies PlanningHandoffRequestedScopeDto["excludedInternalPhases"];

const PLANNING_HANDOFF_ALLOWED_PAYLOAD_KEYS = ["sourceRefs", "requestedScope"] as const;

const PLANNING_HANDOFF_ALLOWED_SOURCE_REF_KEYS = [
  "sourceType",
  "sourceId",
  "sourceLabel",
  "required",
  "stale"
] as const;

const PLANNING_HANDOFF_ALLOWED_REQUESTED_SCOPE_KEYS = [
  "productSlice",
  "userFacingJourneyLabel",
  "nonGoals",
  "excludedInternalPhases",
  "assumptions"
] as const;

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isPlanningHandoffSourceType(value: unknown): value is PlanningHandoffSourceType {
  return (
    typeof value === "string" &&
    PLANNING_HANDOFF_SOURCE_TYPES.includes(value as PlanningHandoffSourceType)
  );
}

function isPlanningHandoffExcludedInternalPhase(
  value: unknown
): value is PlanningHandoffRequestedScopeDto["excludedInternalPhases"][number] {
  return (
    typeof value === "string" &&
    PLANNING_HANDOFF_EXCLUDED_INTERNAL_PHASES.includes(
      value as PlanningHandoffRequestedScopeDto["excludedInternalPhases"][number]
    )
  );
}

function planningHandoffSourceRefFromValue(value: unknown): PlanningHandoffSourceRefDto | null {
  if (!isRecord(value)) {
    return null;
  }

  if (!hasOnlyRecordKeys(value, PLANNING_HANDOFF_ALLOWED_SOURCE_REF_KEYS)) {
    return null;
  }

  const sourceId = requiredString(value.sourceId);

  if (!isPlanningHandoffSourceType(value.sourceType) || !sourceId) {
    return null;
  }

  if (typeof value.required !== "boolean" || typeof value.stale !== "boolean") {
    return null;
  }

  if (value.sourceLabel !== undefined && typeof value.sourceLabel !== "string") {
    return null;
  }

  return {
    sourceType: value.sourceType,
    sourceId,
    ...(typeof value.sourceLabel === "string" ? { sourceLabel: value.sourceLabel } : {}),
    required: value.required,
    stale: value.stale
  };
}

function planningHandoffSourceRefsFromPayload(
  command: ProductEngineCommand
): readonly PlanningHandoffSourceRefDto[] | ProductEngineReduction {
  if (!Array.isArray(command.payload.sourceRefs) || command.payload.sourceRefs.length === 0) {
    return reject("CreatePlanningHandoff requires at least one sourceRef.", "VALIDATION_FAILED");
  }

  const sourceRefs: PlanningHandoffSourceRefDto[] = [];

  for (const sourceRefValue of command.payload.sourceRefs) {
    const sourceRef = planningHandoffSourceRefFromValue(sourceRefValue);

    if (!sourceRef) {
      return reject(
        "CreatePlanningHandoff sourceRefs must be valid PlanningHandoffSourceRefDto objects.",
        "VALIDATION_FAILED"
      );
    }

    sourceRefs.push(sourceRef);
  }

  const dedupeKeys = sourceRefs.map((sourceRef) => `${sourceRef.sourceType}:${sourceRef.sourceId}`);

  if (new Set(dedupeKeys).size !== dedupeKeys.length) {
    return reject("CreatePlanningHandoff sourceRefs must be unique by sourceType and sourceId.", "VALIDATION_FAILED");
  }

  return sourceRefs;
}

function planningHandoffRequestedScopeFromValue(value: unknown): PlanningHandoffRequestedScopeDto | null {
  if (value === undefined) {
    return null;
  }

  if (!isRecord(value)) {
    return null;
  }

  if (!hasOnlyRecordKeys(value, PLANNING_HANDOFF_ALLOWED_REQUESTED_SCOPE_KEYS)) {
    return null;
  }

  const productSlice = requiredString(value.productSlice);

  if (!productSlice || value.userFacingJourneyLabel !== "Planning-ready") {
    return null;
  }

  const nonGoals = requiredNonEmptyStringArray(value.nonGoals);
  const assumptions = requiredNonEmptyStringArray(value.assumptions);

  if (nonGoals === "invalid" || assumptions === "invalid") {
    return null;
  }

  if (!Array.isArray(value.excludedInternalPhases)) {
    return null;
  }

  const excludedInternalPhases = value.excludedInternalPhases.map((phase) =>
    isPlanningHandoffExcludedInternalPhase(phase) ? phase : null
  );

  if (excludedInternalPhases.some((phase) => phase === null)) {
    return null;
  }

  return {
    productSlice,
    userFacingJourneyLabel: "Planning-ready",
    nonGoals,
    excludedInternalPhases: excludedInternalPhases as PlanningHandoffRequestedScopeDto["excludedInternalPhases"],
    assumptions
  };
}

function derivePlanningHandoffScope(state: ProductEngineStateSnapshot): PlanningHandoffRequestedScopeDto {
  return {
    productSlice:
      state.currentSpec.title ??
      state.founderBrief?.problemCustomerValue ??
      "Founder planning handoff",
    userFacingJourneyLabel: "Planning-ready",
    nonGoals: [
      "controlled execution",
      "file patches",
      "shell commands",
      "browser automation",
      "external deployment"
    ],
    excludedInternalPhases: PLANNING_HANDOFF_EXCLUDED_INTERNAL_PHASES,
    assumptions: [
      "Phase 2 computes a planning handoff from the loaded ProductEngine snapshot only.",
      "Execution remains out of scope until a separate Phase 3 controlled-execution contract is approved."
    ]
  };
}

function containsUnsupportedPlanningHandoffPayload(command: ProductEngineCommand) {
  return !hasOnlyRecordKeys(command.payload, PLANNING_HANDOFF_ALLOWED_PAYLOAD_KEYS);
}

function isFinalPlanningHandoffConversionTarget(target: string) {
  const normalizedTarget = target.toLowerCase().replace(/[^a-z0-9]/g, "");

  return (
    normalizedTarget.includes("planninghandoff") ||
    normalizedTarget.includes("planningready") ||
    normalizedTarget.includes("finalhandoff") ||
    normalizedTarget.includes("handoffartifact")
  );
}

function allQueueItems(projection: DecisionQueueProjection): readonly QueueItemProjection[] {
  return [
    ...projection.active,
    ...projection.next,
    ...projection.blocked,
    ...projection.deferred
  ];
}

function sourceRefMatches(sourceRef: PlanningHandoffSourceRefDto, sourceType: PlanningHandoffSourceType, sourceId: string) {
  return sourceRef.sourceType === sourceType && sourceRef.sourceId === sourceId;
}

function planningHandoffSourceExists(
  state: ProductEngineStateSnapshot,
  sourceRef: PlanningHandoffSourceRefDto
): boolean {
  switch (sourceRef.sourceType) {
    case "spec_version":
      return [
        state.currentSpec.versionRef,
        state.livingSpecProjection ? `living_spec:${state.session.sessionId}:${state.livingSpecProjection.version}` : undefined
      ].includes(sourceRef.sourceId);
    case "founder_brief":
      return Boolean(
        state.founderBrief &&
          [
            `founder_brief:${state.session.sessionId}:${state.founderBrief.version}`,
            `founder_brief:${state.session.sessionId}`
          ].includes(sourceRef.sourceId)
      );
    case "completion_candidate":
      return (
        state.completeness.completionCandidate.status === "candidate" &&
        [
          `completion_candidate:${state.session.sessionId}:${state.completeness.version}`,
          `completion_candidate:${state.session.sessionId}`
        ].includes(sourceRef.sourceId)
      );
    case "decision_linked_evidence_pack":
      return state.researchState.evidencePacks.some(
        (pack) =>
          pack.evidencePackId === sourceRef.sourceId &&
          pack.gateStatus === "accepted" &&
          state.researchState.evidenceMatrices.some(
            (matrix) =>
              matrix.researchTaskId === pack.researchTaskId &&
              matrix.researchResultId === pack.researchResultId &&
              matrix.balanceStatus === "balanced" &&
              !matrix.decisionBlocked
          )
      );
    case "research_updated_queue_item":
      return (
        allQueueItems(state.queueProjection).some(
          (item) => item.queueItemId === sourceRef.sourceId && isResearchUpdatedQueueItem(item)
        ) || state.researchState.reviewCards.some((card) => card.cardId === sourceRef.sourceId)
      );
    case "decision":
      return state.decisions.some((decision) => decision.decisionId === sourceRef.sourceId);
    case "risk_acceptance":
      return state.decisions.some(
        (decision) => decision.decisionId === sourceRef.sourceId && decision.status === "risk_accepted"
      );
    case "known_risk":
      return (
        state.completeness.topRiskCards.some((risk) => risk.riskId === sourceRef.sourceId) ||
        state.researchState.knownRisks.includes(sourceRef.sourceId) ||
        state.founderBrief?.knownRisks.includes(sourceRef.sourceId) === true
      );
    case "open_question":
      return state.openIssues.some((issue) => issue.queueItemId === sourceRef.sourceId);
    case "runtime_preview_artifact":
      return state.runtimeState.runtimeArtifacts.some((artifact) => artifact.artifactId === sourceRef.sourceId);
    case "phase15b_hint":
      return state.runtimeState.runtimeArtifacts.some(
        (artifact) => artifact.artifactId === sourceRef.sourceId && hasOwnRecordKey(artifact.payload, "phase15bUpgradeHints")
      );
    case "activity_event":
      return false;
  }
}

function sourceRefForStateSourceId(
  state: ProductEngineStateSnapshot,
  sourceId: string,
  fallbackLabel?: string
): PlanningHandoffSourceRefDto {
  const sourceLabel = fallbackLabel && fallbackLabel !== sourceId ? fallbackLabel : undefined;
  const base = {
    sourceId,
    ...(sourceLabel ? { sourceLabel } : {}),
    required: false,
    stale: false
  };

  if (state.decisions.some((decision) => decision.decisionId === sourceId && decision.status === "risk_accepted")) {
    return {
      ...base,
      sourceType: "risk_acceptance"
    };
  }

  if (state.decisions.some((decision) => decision.decisionId === sourceId)) {
    return {
      ...base,
      sourceType: "decision"
    };
  }

  if (state.researchState.evidencePacks.some((pack) => pack.evidencePackId === sourceId)) {
    return {
      ...base,
      sourceType: "decision_linked_evidence_pack"
    };
  }

  if (
    allQueueItems(state.queueProjection).some((item) => item.queueItemId === sourceId) ||
    state.researchState.reviewCards.some((card) => card.cardId === sourceId)
  ) {
    return {
      ...base,
      sourceType: "research_updated_queue_item"
    };
  }

  if (state.openIssues.some((issue) => issue.queueItemId === sourceId)) {
    return {
      ...base,
      sourceType: "open_question"
    };
  }

  return {
    ...base,
    sourceType: "known_risk"
  };
}

function isRiskAcceptedDecisionSource(
  state: ProductEngineStateSnapshot,
  sourceRef: PlanningHandoffSourceRefDto
) {
  if (sourceRef.stale || (sourceRef.sourceType !== "risk_acceptance" && sourceRef.sourceType !== "decision")) {
    return false;
  }

  return state.decisions.some(
    (decision) => decision.decisionId === sourceRef.sourceId && decision.status === "risk_accepted"
  );
}

function riskAcceptanceDecisionIds(
  state: ProductEngineStateSnapshot,
  sourceRefs: readonly PlanningHandoffSourceRefDto[]
) {
  return sourceRefs
    .filter((sourceRef) => isRiskAcceptedDecisionSource(state, sourceRef))
    .map((sourceRef) => sourceRef.sourceId);
}

function hasRiskAcceptanceLinkedTo(
  state: ProductEngineStateSnapshot,
  sourceRefs: readonly PlanningHandoffSourceRefDto[],
  linkableSourceIds: readonly (string | undefined)[]
) {
  const linkableSourceIdSet = new Set(linkableSourceIds.filter((sourceId): sourceId is string => Boolean(sourceId)));

  return riskAcceptanceDecisionIds(state, sourceRefs).some((decisionId) => linkableSourceIdSet.has(decisionId));
}

function sourceRefForQueueItem(
  sourceRefs: readonly PlanningHandoffSourceRefDto[],
  queueItemId: string,
  title: string
): PlanningHandoffSourceRefDto {
  return (
    sourceRefs.find((sourceRef) => sourceRefMatches(sourceRef, "research_updated_queue_item", queueItemId)) ?? {
      sourceType: "research_updated_queue_item",
      sourceId: queueItemId,
      sourceLabel: title,
      required: true,
      stale: false
    }
  );
}

function sourceTraceBlockers(
  state: ProductEngineStateSnapshot,
  sourceRefs: readonly PlanningHandoffSourceRefDto[]
): readonly PlanningHandoffBlockerDto[] {
  const blockers: PlanningHandoffBlockerDto[] = [];
  const requiredCurrentRefs = sourceRefs.filter((sourceRef) => sourceRef.required && !sourceRef.stale);
  const requiredSourceTypes = new Set(requiredCurrentRefs.map((sourceRef) => sourceRef.sourceType));

  for (const requirement of PLANNING_HANDOFF_REQUIRED_SOURCE_REQUIREMENTS) {
    if (requirement.sourceTypes.some((sourceType) => requiredSourceTypes.has(sourceType))) {
      continue;
    }

    blockers.push({
      blockerId: requirement.blockerId,
      blockerClass: "source_trace",
      whyFatal: requirement.whyFatal,
      requiredNextAction: requirement.requiredNextAction,
      sourceRefs: []
    });
  }

  for (const sourceRef of sourceRefs) {
    if (sourceRef.required && (sourceRef.stale || !planningHandoffSourceExists(state, sourceRef))) {
      blockers.push({
        blockerId: `blocker_source_trace_${stableToken(`${sourceRef.sourceType}:${sourceRef.sourceId}`)}`,
        blockerClass: "source_trace",
        whyFatal: sourceRef.stale
          ? "Planning Handoff cannot use stale required source traces."
          : "Planning Handoff cannot use required source refs that are not present, accepted, and current in the loaded ProductEngine state.",
        requiredNextAction: sourceRef.sourceType === "research_updated_queue_item" ? "research_more" : "revise",
        sourceRefs: [sourceRef]
      });
    }
  }

  return blockers;
}

function isResearchUpdatedQueueItem(item: QueueItemProjection) {
  return (
    item.cardType === "research_review" ||
    item.cardType === "decision_approval" ||
    item.cardType === "risk_acceptance" ||
    item.cardType === "conflict_resolution" ||
    item.cardType === "follow_up_question" ||
    Boolean(item.researchTaskId) ||
    Boolean(item.evidencePackId) ||
    item.blocksPlanning === true
  );
}

function blockerClassForQueueItem(item: QueueItemProjection): PlanningHandoffBlockerClass {
  if (item.cardType === "risk_acceptance") {
    return "approval_security_execution_safety";
  }

  if (item.cardType === "decision_approval") {
    return "success_metrics_validation";
  }

  return "customer_problem_jtbd";
}

function highImpactPlanningQueueItems(state: ProductEngineStateSnapshot): readonly QueueItemProjection[] {
  const queueItems = allQueueItems(state.queueProjection).filter(isResearchUpdatedQueueItem);
  const cardIds = new Set(queueItems.map((item) => item.queueItemId));
  const itemsFromCards = state.researchState.reviewCards
    .filter((card) => !cardIds.has(card.cardId) && (card.impact === "high" || card.blocksPlanning))
    .map((card) => ({
      queueItemId: card.cardId,
      title: card.title,
      state: card.state === "resolved" ? ("resolved" as const) : ("blocked" as const),
      cardType: card.cardType,
      researchTaskId: card.researchTaskId,
      ...(card.evidencePackId ? { evidencePackId: card.evidencePackId } : {}),
      blocksPlanning: card.blocksPlanning,
      availableOutcomes: card.availableOutcomes,
      ...(card.terminalOutcome ? { terminalOutcome: card.terminalOutcome } : {}),
      ...(card.terminalRationale ? { terminalRationale: card.terminalRationale } : {})
    } satisfies QueueItemProjection));

  return [...queueItems, ...itemsFromCards].filter((item) => {
    const card = state.researchState.reviewCards.find((candidate) => candidate.cardId === item.queueItemId);

    return item.blocksPlanning === true || card?.impact === "high";
  });
}

function queueOutcomeSummary(
  item: QueueItemProjection,
  state: ProductEngineStateSnapshot,
  sourceRefs: readonly PlanningHandoffSourceRefDto[]
): PlanningHandoffQueueOutcomeSummaryDto | null {
  const card = state.researchState.reviewCards.find((candidate) => candidate.cardId === item.queueItemId);
  const terminalOutcome = item.terminalOutcome ?? card?.terminalOutcome;

  if (!terminalOutcome) {
    return null;
  }

  const blockerClass = blockerClassForQueueItem(item);
  const riskAccepted =
    terminalOutcome === "risk_accepted" ||
    hasRiskAcceptanceLinkedTo(state, sourceRefs, [
      item.queueItemId,
      item.researchTaskId,
      item.evidencePackId,
      card?.cardId,
      card?.researchTaskId,
      card?.evidencePackId,
      card?.retainedSourceRef,
      ...(card?.retainedSourceRefs ?? [])
    ]);

  return {
    queueItemId: item.queueItemId,
    outcome: terminalOutcome as PlanningHandoffQueueOutcome,
    impact: card?.impact ?? (item.blocksPlanning ? "high" : "medium"),
    ...(terminalOutcome === "research_insufficient" || terminalOutcome === "deferred" ? { blockerClass } : {}),
    ...(terminalOutcome === "risk_accepted"
      ? { residualRiskClass: "known_low_medium_risk" as PlanningHandoffResidualRiskClass }
      : {}),
    riskAccepted,
    sourceRefs: [sourceRefForQueueItem(sourceRefs, item.queueItemId, item.title)]
  };
}

function queueReviewIncompleteBlockers(
  queueItems: readonly QueueItemProjection[],
  state: ProductEngineStateSnapshot,
  sourceRefs: readonly PlanningHandoffSourceRefDto[]
): readonly PlanningHandoffBlockerDto[] {
  return queueItems
    .filter((item) => !queueOutcomeSummary(item, state, sourceRefs))
    .map((item) => ({
      blockerId: `blocker_queue_review_${stableToken(item.queueItemId)}`,
      blockerClass: "queue_review" as const,
      queueItemId: item.queueItemId,
      whyFatal: "High-impact research-updated queue cards need an explicit terminal outcome before final handoff.",
      requiredNextAction: "research_more" as const,
      sourceRefs: [sourceRefForQueueItem(sourceRefs, item.queueItemId, item.title)]
    }));
}

function fatalQueueBlockersFromSummaries(
  summaries: readonly PlanningHandoffQueueOutcomeSummaryDto[]
): readonly PlanningHandoffBlockerDto[] {
  return summaries
    .filter(
      (summary) =>
        (summary.outcome === "research_insufficient" || summary.outcome === "deferred") && !summary.riskAccepted
    )
    .map((summary) => ({
      blockerId: `blocker_fatal_queue_${stableToken(`${summary.queueItemId}:${summary.outcome}`)}`,
      blockerClass: summary.blockerClass ?? "customer_problem_jtbd",
      queueItemId: summary.queueItemId,
      currentOutcome: summary.outcome,
      whyFatal:
        summary.outcome === "deferred"
          ? "High-impact queue card is deferred without explicit risk acceptance."
          : "High-impact queue card remains research_insufficient.",
      requiredNextAction: summary.outcome === "deferred" ? ("risk_accept" as const) : ("research_more" as const),
      sourceRefs: summary.sourceRefs
    }));
}

function riskAcceptanceNeededBlockers(
  state: ProductEngineStateSnapshot,
  sourceRefs: readonly PlanningHandoffSourceRefDto[]
): readonly PlanningHandoffBlockerDto[] {
  return state.completeness.topRiskCards
    .filter(
      (risk) =>
        risk.severity === "high" &&
        !hasRiskAcceptanceLinkedTo(state, sourceRefs, [risk.riskId, ...risk.sourceRefs])
    )
    .map((risk) => {
      const riskSourceRef: PlanningHandoffSourceRefDto = {
        sourceType: "known_risk",
        sourceId: risk.riskId,
        sourceLabel: risk.title,
        required: false,
        stale: false
      };

      return {
        blockerId: `blocker_risk_acceptance_${stableToken(risk.riskId)}`,
        blockerClass: "approval_security_execution_safety" as const,
        whyFatal: "A high-severity known risk is visible but has not been explicitly risk-accepted.",
        requiredNextAction: "risk_accept" as const,
        sourceRefs: [riskSourceRef]
      };
    });
}

function residualRisksForPlanningHandoff(
  state: ProductEngineStateSnapshot,
  sourceRefs: readonly PlanningHandoffSourceRefDto[]
): readonly PlanningHandoffResidualRiskDto[] {
  const residualRisks = new Map<string, PlanningHandoffResidualRiskDto>();
  const addResidualRisk = (risk: PlanningHandoffResidualRiskDto) => {
    if (!residualRisks.has(risk.riskId)) {
      residualRisks.set(risk.riskId, risk);
    }
  };

  for (const risk of state.completeness.topRiskCards) {
    addResidualRisk({
      riskId: risk.riskId,
      riskClass: "known_low_medium_risk",
      title: risk.title,
      severity: risk.severity,
      sourceRefs: risk.sourceRefs.length
        ? risk.sourceRefs.map((sourceId) => sourceRefForStateSourceId(state, sourceId, risk.title))
        : sourceRefs.filter((sourceRef) => sourceRef.sourceType === "known_risk"),
      assumption: "Risk is visible in the Planning Handoff and remains non-executing metadata.",
      prerequisite: "Reviewer keeps or resolves this risk before downstream execution scope.",
      validationDependency: risk.nextValidationAction,
      ownerRole: "product",
      followUpTrigger: "When the next build slice is accepted or rejected."
    });
  }

  for (const risk of [...state.researchState.knownRisks, ...(state.founderBrief?.knownRisks ?? [])]) {
    addResidualRisk({
      riskId: risk,
      riskClass: "known_low_medium_risk",
      title: risk,
      severity: "medium",
      sourceRefs: [sourceRefForStateSourceId(state, risk)],
      assumption: "Known risk is preserved from research or Founder Brief context.",
      prerequisite: "Reviewer keeps the risk visible until a later decision resolves or accepts it.",
      validationDependency: "Confirm whether this known risk affects the next build slice.",
      ownerRole: "product",
      followUpTrigger: "When the next build slice scope is narrowed, accepted, or rejected."
    });
  }

  for (const issue of state.openIssues.filter((candidate) => candidate.status === "open")) {
    addResidualRisk({
      riskId: `open_question_${issue.queueItemId}`,
      riskClass: "mvp_scope_non_scope",
      title: issue.summary,
      severity: "medium",
      sourceRefs: [
        {
          sourceType: "open_question",
          sourceId: issue.queueItemId,
          sourceLabel: issue.questionText ?? issue.summary,
          required: false,
          stale: false
        }
      ],
      assumption: "Open question is intentionally visible rather than hidden before downstream build work.",
      prerequisite: "Reviewer confirms the question can remain non-fatal for the next slice.",
      validationDependency: issue.questionText ?? "Resolve or explicitly carry this open question.",
      ownerRole: "product",
      followUpTrigger: "When the next build slice converts the open question into a decision, scope cut, or risk acceptance."
    });
  }

  return [...residualRisks.values()];
}

function uniqueRequiredUserActions(
  blockers: readonly PlanningHandoffBlockerDto[]
): readonly PlanningHandoffRequiredUserAction[] {
  return [...new Set(blockers.map((blocker) => blocker.requiredNextAction))];
}

function planningHandoffGateContext(
  state: ProductEngineStateSnapshot,
  sourceRefs: readonly PlanningHandoffSourceRefDto[]
) {
  const sourceBlockers = sourceTraceBlockers(state, sourceRefs);
  const queueItems = highImpactPlanningQueueItems(state);
  const queueSummaries = queueItems
    .map((item) => queueOutcomeSummary(item, state, sourceRefs))
    .filter((summary): summary is PlanningHandoffQueueOutcomeSummaryDto => Boolean(summary));
  const queueBlockers = queueReviewIncompleteBlockers(queueItems, state, sourceRefs);
  const fatalBlockers = fatalQueueBlockersFromSummaries(queueSummaries);
  const riskAcceptanceBlockers = riskAcceptanceNeededBlockers(state, sourceRefs);
  const residualRisks = residualRisksForPlanningHandoff(state, sourceRefs);

  if (sourceBlockers.length > 0) {
    return {
      verdict: "source_trace_incomplete" as const,
      blockers: sourceBlockers,
      queueSummaries,
      residualRisks
    };
  }

  if (queueBlockers.length > 0) {
    return {
      verdict: "queue_review_incomplete" as const,
      blockers: queueBlockers,
      queueSummaries,
      residualRisks
    };
  }

  if (fatalBlockers.length > 0) {
    return {
      verdict: "blocked_by_fatal" as const,
      blockers: fatalBlockers,
      queueSummaries,
      residualRisks
    };
  }

  if (riskAcceptanceBlockers.length > 0) {
    return {
      verdict: "needs_risk_acceptance" as const,
      blockers: riskAcceptanceBlockers,
      queueSummaries,
      residualRisks
    };
  }

  return {
    verdict: "planning_ready" as const,
    blockers: [] as readonly PlanningHandoffBlockerDto[],
    queueSummaries,
    residualRisks
  };
}

function planningHandoffGateVerdict(
  verdict: PlanningHandoffVerdict,
  queueSummaries: readonly PlanningHandoffQueueOutcomeSummaryDto[],
  rationale: string
): PlanningHandoffGateVerdictDto {
  return {
    verdict,
    reviewedQueueItemIds: queueSummaries.map((summary) => summary.queueItemId),
    terminalOutcomeSummary: queueSummaries,
    fatalBlockerClassesChecked: PLANNING_HANDOFF_FATAL_BLOCKER_CLASSES,
    residualRiskVisibilityCheck: verdict === "planning_ready" ? "passed" : "failed",
    rationale
  };
}

function planningHandoffCreatedBy(command: ProductEngineCommand): PlanningHandoffArtifactDto["createdBy"] {
  return command.actor === "user" || command.actor === "product_engine" || command.actor === "system"
    ? command.actor
    : "product_engine";
}

function sortedStrings(values: readonly string[]) {
  return [...values].sort((left, right) => left.localeCompare(right));
}

function planningHandoffSourceRefHashMaterial(sourceRefs: readonly PlanningHandoffSourceRefDto[]) {
  return [...sourceRefs]
    .sort((left, right) =>
      `${left.sourceType}:${left.sourceId}:${left.sourceLabel ?? ""}`.localeCompare(
        `${right.sourceType}:${right.sourceId}:${right.sourceLabel ?? ""}`
      )
    )
    .map((sourceRef) => ({
      sourceType: sourceRef.sourceType,
      sourceId: sourceRef.sourceId,
      sourceLabel: sourceRef.sourceLabel ?? null,
      required: sourceRef.required,
      stale: sourceRef.stale
    }));
}

function planningHandoffScopeHashMaterial(scope: PlanningHandoffRequestedScopeDto) {
  return {
    productSlice: scope.productSlice,
    userFacingJourneyLabel: scope.userFacingJourneyLabel,
    nonGoals: sortedStrings(scope.nonGoals),
    excludedInternalPhases: sortedStrings(scope.excludedInternalPhases),
    assumptions: sortedStrings(scope.assumptions)
  };
}

function planningHandoffArtifactIdentityKey(
  command: ProductEngineCommand,
  sourceRefs: readonly PlanningHandoffSourceRefDto[],
  scope: PlanningHandoffRequestedScopeDto
) {
  const sourceRefsHash = sha256Hex(JSON.stringify(planningHandoffSourceRefHashMaterial(sourceRefs)));
  const scopeHash = sha256Hex(JSON.stringify(planningHandoffScopeHashMaterial(scope)));

  return `CreatePlanningHandoff:${command.sessionId}:${command.expectedStateVersion}:${sourceRefsHash}:${scopeHash}`;
}

function planningHandoffArtifactId(
  command: ProductEngineCommand,
  sourceRefs: readonly PlanningHandoffSourceRefDto[],
  scope: PlanningHandoffRequestedScopeDto
) {
  return `handoff_${sha256Hex(planningHandoffArtifactIdentityKey(command, sourceRefs, scope)).slice(0, 32)}`;
}

function buildPlanningHandoffFinalArtifact(
  command: ProductEngineCommand,
  artifactId: string,
  sourceRefs: readonly PlanningHandoffSourceRefDto[],
  scope: PlanningHandoffRequestedScopeDto,
  queueSummaries: readonly PlanningHandoffQueueOutcomeSummaryDto[],
  residualRisks: readonly PlanningHandoffResidualRiskDto[]
): PlanningHandoffArtifactDto {
  const task: PlanningHandoffTaskDto = {
    taskId: `task_${stableToken(`${artifactId}:build-slice`)}`,
    title: `${scope.productSlice} build slice를 검증 가능하게 구현`,
    intent: "Current source refs and queue outcomes are ready for the next PR-sized implementation slice.",
    sourceRefs,
    dependsOn: [],
    ownerRole: "backend",
    acceptanceEvidence: ["targeted reducer tests", "pnpm verify:docs", "pnpm verify"],
    nonGoals: scope.nonGoals,
    riskRefs: residualRisks.map((risk) => risk.riskId)
  };
  const handoffSummary = `Planning-ready handoff가 준비됐습니다: ${scope.productSlice}. 실행 권한 없이 다음 구현 조각과 잔여 리스크만 고정합니다.`;

  return {
    artifactId,
    kind: "PlanningHandoffArtifact",
    schemaVersion: "solo-superman.phase2-planning-handoff.v1",
    createdAt: command.issuedAt,
    createdBy: planningHandoffCreatedBy(command),
    status: "planning_ready",
    sourceRefs,
    gateVerdict: planningHandoffGateVerdict(
      "planning_ready",
      queueSummaries,
      "All required source traces are current, high-impact queue cards are terminal, and residual risks are visible."
    ) as PlanningHandoffArtifactDto["gateVerdict"],
    scopeSnapshot: scope,
    taskBreakdown: [task],
    prIssuePlan: [
      {
        sequenceId: `phase2_${stableToken(`${artifactId}:pr`)}`,
        summary: `${scope.productSlice}의 가장 작은 다음 구현 단위`,
        includedTaskIds: [task.taskId],
        entryPrerequisites: ["Planning Handoff gate verdict is planning_ready."],
        exitEvidence: ["Tests and docs contract checks pass.", "No execution authority was introduced."],
        blockedBy: [],
        phaseBoundary: "phase2_planning_handoff"
      }
    ],
    buildSlicePlan: {
      sliceGoal: scope.productSlice,
      includedCapabilities: ["deterministic planning handoff", "visible source trace", "visible residual risk"],
      nonGoals: scope.nonGoals,
      sourceRefs,
      acceptanceCriteria: ["Final handoff exists only for planning_ready verdict.", "Blocker paths remain separate."],
      smokeTests: ["run ProductEngine reducer tests", "run docs verifier"],
      validationMetric: "Reviewer can identify the next PR-sized build slice without hidden fatal blockers.",
      residualRisks: residualRisks.map((risk) => risk.riskId)
    },
    serveChecklist: {
      serveTarget: "local preview",
      envVars: [
        {
          envVarName: "SOLO_SUPERMAN_LOCAL_TOKEN",
          required: false,
          present: false,
          valueIncluded: false,
          note: "Token values are not included in Planning Handoff artifacts."
        }
      ],
      authAndPrivacyCheck: "Planning-ready remains local/read-only metadata and hides credential values.",
      smokeTestChecklist: ["Confirm final label appears only after planning_ready.", "Confirm no execution controls appear."],
      rollbackPlan: "Discard the handoff projection and return to queue review.",
      launchNote: "Planning-ready context is ready for review; execution remains out of scope.",
      learningMetrics: ["handoff understood", "next slice accepted", "blocker revisions requested"]
    },
    learningLoopHook: {
      signalsToCollect: ["reviewer questions", "accepted next-slice task", "blocker revision reasons"],
      interpretationFrame: "Signals update planning confidence and visible residual risk only.",
      decisionOptions: ["persevere", "narrow_scope", "next_slice"],
      recommendedNextSliceRule: "Recommend the next slice only while fatal blockers stay resolved or risk-accepted.",
      riskUpdateRule: "Convert repeated blocker feedback into Known Risks or queue items before retrying final handoff."
    },
    readinessChecklist: {
      requiredApprovals: ["Reviewer confirms the Planning-ready handoff."],
      sandboxBoundary: "No file, shell, browser, deploy, credential, or external mutation authority.",
      rollbackReference: `recompute CreatePlanningHandoff from stateVersion ${command.expectedStateVersion}`,
      expectedEvidence: ["pnpm --filter @solo-superman/core test -- product-engine", "pnpm verify:docs"],
      commandPreviewRequirements: ["Command previews remain non-executing."],
      filePreviewRequirements: ["File patches are future evidence only."],
      browserPreviewRequirements: ["Browser actions remain excluded from Phase 2 handoff."]
    },
    residualRiskRegister: residualRisks,
    phase15bHintMapping: sourceRefs.filter((sourceRef) => sourceRef.sourceType === "phase15b_hint"),
    noExecutionPolicy: "no_file_shell_browser_deploy_or_external_mutation",
    handoffSummary
  };
}

function buildPlanningHandoffBlockerArtifact(
  command: ProductEngineCommand,
  artifactId: string,
  verdict: NonReadyPlanningHandoffVerdict,
  sourceRefs: readonly PlanningHandoffSourceRefDto[],
  blockers: readonly PlanningHandoffBlockerDto[],
  queueSummaries: readonly PlanningHandoffQueueOutcomeSummaryDto[],
  residualRisks: readonly PlanningHandoffResidualRiskDto[]
): PlanningHandoffBlockerArtifactDto {
  return {
    artifactId,
    kind: "PlanningHandoffBlockerArtifact",
    schemaVersion: "solo-superman.phase2-planning-handoff-blocker.v1",
    createdAt: command.issuedAt,
    createdBy: planningHandoffCreatedBy(command),
    status: verdict,
    sourceRefs,
    gateVerdict: planningHandoffGateVerdict(
      verdict,
      queueSummaries,
      "Planning Handoff gate failed, so the reducer emitted a durable blocker artifact instead of a transient rejection."
    ) as PlanningHandoffBlockerArtifactDto["gateVerdict"],
    blockers,
    residualRisks,
    requiredUserActions: uniqueRequiredUserActions(blockers),
    safePreviewRefs: sourceRefs.filter(
      (sourceRef) => sourceRef.sourceType === "runtime_preview_artifact" || sourceRef.sourceType === "phase15b_hint"
    ),
    noFinalLabelRule: "must_not_use_planning_ready_label"
  };
}

function planningHandoffProjection(
  command: ProductEngineCommand,
  artifact: PlanningHandoffArtifactDto | PlanningHandoffBlockerArtifactDto
): PlanningHandoffProjection {
  const projectionUrl = `/api/v1/sessions/${command.sessionId}/planning-handoff`;
  const version = (Number(command.expectedStateVersion) + 1) as ProjectionVersion;

  if (artifact.kind === "PlanningHandoffArtifact") {
    return {
      kind: "PlanningHandoffProjection",
      sessionId: command.sessionId,
      version,
      currentStatus: "planning_ready",
      finalArtifact: artifact,
      sourceRefs: artifact.sourceRefs,
      summary: artifact.handoffSummary,
      refetchUrl: projectionUrl
    } as PlanningHandoffProjection;
  }

  return {
    kind: "PlanningHandoffProjection",
    sessionId: command.sessionId,
    version,
    currentStatus: artifact.status,
    blockerArtifact: artifact,
    sourceRefs: artifact.sourceRefs,
    summary: "Planning handoff remains blocked until required source traces, queue outcomes, or risk decisions are resolved.",
    refetchUrl: projectionUrl
  } as PlanningHandoffProjection;
}

function reduceCreatePlanningHandoff(
  command: ProductEngineCommand,
  state: ProductEngineStateSnapshot
): ProductEngineReduction {
  if (containsUnsupportedPlanningHandoffPayload(command)) {
    return reject(
      "CreatePlanningHandoff payload must only include sourceRefs and optional requestedScope.",
      "VALIDATION_FAILED"
    );
  }

  const sourceRefsOrRejection = planningHandoffSourceRefsFromPayload(command);

  if ("accepted" in sourceRefsOrRejection) {
    return sourceRefsOrRejection;
  }

  const requestedScope = planningHandoffRequestedScopeFromValue(command.payload.requestedScope);

  if (command.payload.requestedScope !== undefined && !requestedScope) {
    return reject("CreatePlanningHandoff requestedScope is invalid.", "VALIDATION_FAILED");
  }

  const scope = requestedScope ?? derivePlanningHandoffScope(state);
  const gate = planningHandoffGateContext(state, sourceRefsOrRejection);
  const artifactId = planningHandoffArtifactId(command, sourceRefsOrRejection, scope);
  const artifact =
    gate.verdict === "planning_ready"
      ? buildPlanningHandoffFinalArtifact(
          command,
          artifactId,
          sourceRefsOrRejection,
          scope,
          gate.queueSummaries,
          gate.residualRisks
        )
      : buildPlanningHandoffBlockerArtifact(
          command,
          artifactId,
          gate.verdict,
          sourceRefsOrRejection,
          gate.blockers,
          gate.queueSummaries,
          gate.residualRisks
        );
  const projection = planningHandoffProjection(command, artifact);
  const event = eventDraft(
    command,
    artifact.kind === "PlanningHandoffArtifact" ? "PlanningHandoffCreated" : "PlanningHandoffBlocked",
    {
      artifactId,
      verdict: gate.verdict,
      artifactKind: artifact.kind,
      sourceRefs: sourceRefsOrRejection,
      projection,
      summary: projection.summary
    }
  );

  return acceptedReduction(
    command,
    state,
    event,
    {
      planningHandoff: projection
    },
    [
      {
        outputType: "planning_handoff_artifact",
        outputRef: artifactId,
        payload: {
          artifactId,
          verdict: gate.verdict,
          artifactKind: artifact.kind,
          sourceRefs: sourceRefsOrRejection,
          summary: projection.summary
        }
      }
    ],
    [],
    projection
  );
}

function reduceCreateSpecUpdatePreview(command: ProductEngineCommand, state: ProductEngineStateSnapshot): ProductEngineReduction {
  if (!state.currentSpec.draftRef) {
    return reject("CreateSpecUpdatePreview requires an initial spec draft.");
  }

  const sourceRef =
    requiredString(command.payload.sourceRef) ??
    requiredString(command.payload.sourcePreviewRef) ??
    requiredString(command.payload.evidenceMatrixId) ??
    requiredString(command.payload.runtimeArtifactId);

  if (!sourceRef) {
    return reject("CreateSpecUpdatePreview requires a sourceRef trace link.", "VALIDATION_FAILED");
  }

  const requiredDecisionRef = isRequiredDecisionRef(command.payload.requiredDecisionRef)
    ? command.payload.requiredDecisionRef
    : "primary_customer";
  const payloadSections = optionalPayloadSections(command.payload.sections);

  if (payloadSections === "invalid") {
    return reject("CreateSpecUpdatePreview sections must be non-empty strings.", "VALIDATION_FAILED");
  }

  const previewRef = `spec_update_${stableToken(`${command.sessionId}:${sourceRef}:${requiredDecisionRef}`)}`;
  const decisionId = decisionIdForSpecUpdatePreview(previewRef);
  const existingDecision = state.decisions.find((decision) => decision.decisionId === decisionId);

  if (
    existingDecision &&
    existingDecision.status !== "active" &&
    existingDecision.status !== "deferred"
  ) {
    return reject("CreateSpecUpdatePreview cannot recreate a terminal decision card.", "COMMAND_PRECONDITION_FAILED", {
      decisionId,
      status: existingDecision.status
    });
  }

  const version = projectionVersionFor(state);
  const decision = {
    decisionId,
    requiredDecisionRef,
    status: "active" as const
  };
  const decisions = mergeDecision(state.decisions, decision);
  const title =
    requiredString(command.payload.title) ??
    state.currentSpec.title ??
    state.project.rawIdeaText ??
    "Spec update preview";
  const sections = payloadSections ?? state.currentSpec.sections ?? [];
  const specUpdatePreview = {
    previewRef,
    sourceRef,
    decisionId,
    requiredDecisionRef,
    title,
    sections
  } as const satisfies SpecUpdatePreviewSnapshot;
  const specUpdatePreviews = mergeSpecUpdatePreview(state.specUpdatePreviews ?? [], specUpdatePreview);
  const queueProjection = queueProjectionWithSpecUpdateDecision(
    state.queueProjection,
    decisionId,
    `Decision approval required: ${requiredDecisionRef}`,
    version,
    command.issuedAt
  );
  const confidenceProjection = buildConfidenceCompletionProjection(
    {
      ...state,
      decisions,
      queueProjection
    },
    version
  );
  const event = eventDraft(command, "SpecUpdatePreviewCreated", {
    previewRef,
    sourceRef,
    requiredDecisionRef,
    title,
    sections,
    decision,
    specUpdatePreview,
    queueProjection,
    confidenceProjection
  });

  return acceptedReduction(
    command,
    state,
    event,
    {
      decisions,
      specUpdatePreviews,
      queueProjection,
      completeness: confidenceProjection
    },
    [
      {
        outputType: "reducer_deterministic_output",
        outputRef: previewRef,
        payload: {
          previewRef,
          sourceRef,
          decisionId,
          requiredDecisionRef,
          title,
          sections
        }
      },
      ...completenessDeterministicOutputs(command, confidenceProjection)
    ],
    [
      queueProjectionEffect(
        command,
        "SpecUpdatePreviewCreated",
        {
          refType: "SpecUpdatePreview",
          refId: previewRef
        },
        "normal"
      )
    ],
    queueProjection
  );
}

function reduceResolveDecision(command: ProductEngineCommand, state: ProductEngineStateSnapshot): ProductEngineReduction {
  const decisionId = requiredString(command.payload.decisionId) as DecisionId | null;
  const outcome = isDecisionResolutionStatus(command.payload.outcome) ? command.payload.outcome : null;

  if (!decisionId || !outcome) {
    return reject("ResolveDecision requires decisionId and a supported resolution outcome.", "VALIDATION_FAILED");
  }

  const existingDecision = state.decisions.find((decision) => decision.decisionId === decisionId);

  if (!existingDecision) {
    return reject("ResolveDecision requires an existing decision.", "RESOURCE_NOT_FOUND");
  }

  if (existingDecision.status !== "active" && existingDecision.status !== "deferred") {
    return reject("ResolveDecision requires an active or deferred decision.", "COMMAND_PRECONDITION_FAILED");
  }

  const version = projectionVersionFor(state);
  const decisions = state.decisions.map((decision) =>
    decision.decisionId === decisionId
      ? {
          ...decision,
          status: outcome
        }
      : decision
  );
  const queueItemId = decisionQueueItemId(decisionId);
  const queueProjection =
    outcome === "deferred"
      ? queueProjectionWithDeferredItem(
          state.queueProjection,
          {
            queueItemId,
            title: `Decision deferred: ${existingDecision.requiredDecisionRef}`,
            state: "deferred"
          },
          version,
          command.issuedAt
        )
      : queueProjectionWithoutItem(state.queueProjection, queueItemId, version, command.issuedAt);
  const updatedConfidenceProjection = buildConfidenceCompletionProjection(
    {
      ...state,
      decisions,
      queueProjection
    },
    version
  );
  const event = eventDraft(command, "DecisionResolved", {
    decisionId,
    outcome,
    requiredDecisionRef: existingDecision.requiredDecisionRef,
    queueProjection,
    confidenceProjection: updatedConfidenceProjection
  });

  return acceptedReduction(
    command,
    state,
    event,
    {
      decisions,
      queueProjection,
      completeness: updatedConfidenceProjection
    },
    [
      {
        outputType: "reducer_deterministic_output",
        outputRef: decisionId,
        payload: {
          outcome
        }
      },
      ...completenessDeterministicOutputs(command, updatedConfidenceProjection)
    ],
    [],
    updatedConfidenceProjection
  );
}

function reduceCreateSpecVersion(command: ProductEngineCommand, state: ProductEngineStateSnapshot): ProductEngineReduction {
  const approvedPreviewRef = requiredString(command.payload.approvedPreviewRef);

  if (!state.currentSpec.draftRef) {
    return reject("CreateSpecVersion requires an initial spec draft.");
  }

  if (!approvedPreviewRef) {
    return reject("CreateSpecVersion requires approvedPreviewRef.", "VALIDATION_FAILED");
  }

  const approvedDecisionId = decisionIdForSpecUpdatePreview(approvedPreviewRef);
  const approvedDecision = state.decisions.find(
    (decision) => decision.decisionId === approvedDecisionId && decision.status === "approved"
  );
  const approvedPreview = state.specUpdatePreviews?.find((preview) => preview.previewRef === approvedPreviewRef);

  if (!approvedDecision) {
    return reject("CreateSpecVersion requires an approved decision for the preview ref.", "COMMAND_PRECONDITION_FAILED", {
      approvedPreviewRef,
      expectedDecisionId: approvedDecisionId
    });
  }

  if (!approvedPreview) {
    return reject("CreateSpecVersion requires approved spec update preview material.", "COMMAND_PRECONDITION_FAILED", {
      approvedPreviewRef
    });
  }

  const payloadSections = optionalPayloadSections(command.payload.sections);

  if (payloadSections === "invalid") {
    return reject("CreateSpecVersion sections must be non-empty strings.", "VALIDATION_FAILED");
  }

  const payloadTitle = requiredString(command.payload.title);

  if (payloadTitle && payloadTitle !== approvedPreview.title) {
    return reject("CreateSpecVersion title must match the approved preview material.", "COMMAND_PRECONDITION_FAILED", {
      approvedPreviewRef
    });
  }

  if (payloadSections && !stringArraysEqual(payloadSections, approvedPreview.sections)) {
    return reject("CreateSpecVersion sections must match the approved preview material.", "COMMAND_PRECONDITION_FAILED", {
      approvedPreviewRef
    });
  }

  const version = projectionVersionFor(state);
  const versionRef = `spec_version_${stableToken(`${command.sessionId}:${approvedPreviewRef}:${version}`)}` as SpecVersionId;
  const title = approvedPreview.title;
  const sections = approvedPreview.sections;
  const livingSpecProjection = createLivingSpecProjection(command, version, title, sections, "approved");
  const currentSpec = {
    ...state.currentSpec,
    versionRef,
    title,
    sections
  };
  const confidenceProjection = buildConfidenceCompletionProjection(
    {
      ...state,
      currentSpec,
      livingSpecProjection
    },
    version
  );
  const event = eventDraft(command, "SpecVersionCreated", {
    versionRef,
    approvedPreviewRef,
    title,
    sections,
    projection: livingSpecProjection,
    confidenceProjection
  });

  return acceptedReduction(
    command,
    state,
    event,
    {
      currentSpec,
      livingSpecProjection,
      completeness: confidenceProjection
    },
    [
      {
        outputType: "reducer_deterministic_output",
        outputRef: versionRef,
        payload: {
          approvedPreviewRef,
          sectionCount: sections.length
        }
      },
      ...completenessDeterministicOutputs(command, confidenceProjection)
    ],
    [],
    livingSpecProjection
  );
}

function reduceScoreCompleteness(
  command: ProductEngineCommand,
  state: ProductEngineStateSnapshot
): ProductEngineReduction {
  if (!state.currentSpec.draftRef) {
    return reject("ScoreCompleteness requires an initial spec draft.");
  }

  const version = projectionVersionFor(state);
  const confidenceProjection = buildConfidenceCompletionProjection(state, version);
  const candidateRequested = command.payload.candidateRequested === true;

  if (candidateRequested && confidenceProjection.completionCandidate.status !== "candidate") {
    return reject(
      `Completion candidate gates failed: ${confidenceProjection.completionCandidate.gateFailures.join("; ")}`,
      "COMMAND_PRECONDITION_FAILED",
      {
        axes: confidenceProjection.axes,
        gates: confidenceProjection.gates,
        topRisks: confidenceProjection.topRisks,
        topRiskCards: confidenceProjection.topRiskCards,
        completionCandidate: confidenceProjection.completionCandidate
      }
    );
  }

  const queueProjection = queueProjectionWithCompletionCandidate(
    state.queueProjection,
    confidenceProjection,
    version,
    command.issuedAt
  );
  const event = eventDraft(command, "CompletenessScored", {
    projection: confidenceProjection,
    queueProjection,
    compositeScore: confidenceProjection.compositeScore,
    readinessLabel: confidenceProjection.readinessLabel,
    candidateStatus: confidenceProjection.completionCandidate.status
  });

  return acceptedReduction(
    command,
    state,
    event,
    {
      completeness: confidenceProjection,
      queueProjection,
      session:
        confidenceProjection.completionCandidate.status === "candidate"
          ? {
              ...state.session,
              phase: "completion" as const
            }
          : state.session
    },
    completenessDeterministicOutputs(command, confidenceProjection),
    [],
    confidenceProjection
  );
}

function reducePrepareFounderBrief(
  command: ProductEngineCommand,
  state: ProductEngineStateSnapshot
): ProductEngineReduction {
  if (!state.currentSpec.draftRef) {
    return reject("PrepareFounderBrief requires an initial spec draft.");
  }

  if (command.payload.requestedFormat !== undefined && command.payload.requestedFormat !== "markdown") {
    return reject("PrepareFounderBrief requestedFormat must be markdown.", "VALIDATION_FAILED");
  }

  if (
    command.payload.fileWriteRequested === true ||
    command.payload.writeFile === true ||
    command.payload.externalExportRequested === true ||
    typeof command.payload.destinationPath === "string" ||
    typeof command.payload.exportUrl === "string"
  ) {
    return reject(
      "PrepareFounderBrief can prepare export metadata only; file and external export side effects are blocked in Phase 1.",
      "RUNTIME_ACTION_BLOCKED"
    );
  }

  const version = projectionVersionFor(state);
  const confidenceProjection = buildConfidenceCompletionProjection(state, version);
  const founderBrief = buildFounderBriefProjection(state, confidenceProjection, version, command.issuedAt);
  const event = eventDraft(command, "FounderBriefPrepared", {
    projection: founderBrief,
    confidenceProjection,
    exportReady: founderBrief.exportReady,
    exportMetadata: founderBrief.exportMetadata
  });

  return acceptedReduction(
    command,
    state,
    event,
    {
      completeness: confidenceProjection,
      founderBrief,
      session: founderBrief.exportReady
        ? {
            ...state.session,
            phase: "completion" as const
          }
        : state.session
    },
    [
      {
        outputType: "founder_brief_draft",
        outputRef: `founder_brief:${command.sessionId}:${version}`,
        payload: {
          exportReady: founderBrief.exportReady,
          exportMetadata: founderBrief.exportMetadata
        }
      }
    ],
    [],
    founderBrief
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
    case "DeferQueueItem":
      return reduceDeferQueueItem(command, state);
    case "DismissQueueItem":
      return reduceDismissQueueItem(command, state);
    case "SubmitAnswer":
      return reduceSubmitAnswer(command, state);
    case "PlanResearch":
      return reducePlanResearch(command, state);
    case "ImportResearchResult":
      return reduceImportResearchResult(command, state);
    case "SynthesizeEvidence":
      return reduceSynthesizeEvidence(command, state);
    case "ResolveResearchQueueCard":
      return reduceResolveResearchQueueCard(command, state);
    case "CreateRuntimePreview":
      return reduceCreateRuntimePreview(command, state);
    case "ConvertRuntimeArtifact":
      return reduceConvertRuntimeArtifact(command, state);
    case "CreateSpecUpdatePreview":
      return reduceCreateSpecUpdatePreview(command, state);
    case "ResolveDecision":
      return reduceResolveDecision(command, state);
    case "CreateSpecVersion":
      return reduceCreateSpecVersion(command, state);
    case "ScoreCompleteness":
      return reduceScoreCompleteness(command, state);
    case "PrepareFounderBrief":
      return reducePrepareFounderBrief(command, state);
    case "CreatePlanningHandoff":
      return reduceCreatePlanningHandoff(command, state);
    default:
      return reject(`${command.commandType} is outside the mounted PR-09 reducer slice.`);
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
    case "AnswerSubmitted": {
      const projection = projectionPayload(event.payload, state.queueProjection);
      const queueItemId = typeof event.payload.queueItemId === "string" ? event.payload.queueItemId : null;

      return {
        ...state,
        stateVersion: nextStateVersion,
        openIssues: queueItemId
          ? state.openIssues.map((issue) =>
              issue.queueItemId === queueItemId
                ? {
                    ...issue,
                    status: "answered" as const
                  }
                : issue
            )
          : state.openIssues,
        queueProjection: projection
      };
    }
    case "QueueItemDeferred": {
      const queueItemId = typeof event.payload.queueItemId === "string" ? (event.payload.queueItemId as QueueItemId) : null;
      const projection = projectionPayload(event.payload, state.queueProjection);
      const confidenceProjection = confidenceProjectionPayload(event.payload) ?? state.completeness;

      return {
        ...state,
        stateVersion: nextStateVersion,
        openIssues: queueItemId
          ? issuesWithQueueItemStatus(state.openIssues, queueItemId, "deferred")
          : state.openIssues,
        queueProjection: projection,
        completeness: confidenceProjection
      };
    }
    case "QueueItemDismissed": {
      const queueItemId = typeof event.payload.queueItemId === "string" ? (event.payload.queueItemId as QueueItemId) : null;
      const projection = projectionPayload(event.payload, state.queueProjection);
      const confidenceProjection = confidenceProjectionPayload(event.payload) ?? state.completeness;

      return {
        ...state,
        stateVersion: nextStateVersion,
        openIssues: queueItemId
          ? issuesWithQueueItemStatus(state.openIssues, queueItemId, "resolved")
          : state.openIssues,
        queueProjection: projection,
        completeness: confidenceProjection
      };
    }
    case "SpecUpdatePreviewCreated": {
      const projection = queueProjectionPayload(event.payload) ?? state.queueProjection;
      const decision = objectPayload<ProductEngineStateSnapshot["decisions"][number]>(event.payload, "decision");
      const specUpdatePreview = objectPayload<SpecUpdatePreviewSnapshot>(event.payload, "specUpdatePreview");
      const decisions =
        decision && isRequiredDecisionRef(decision.requiredDecisionRef)
          ? mergeDecision(state.decisions, decision)
          : state.decisions;
      const specUpdatePreviews = specUpdatePreview
        ? mergeSpecUpdatePreview(state.specUpdatePreviews ?? [], specUpdatePreview)
        : state.specUpdatePreviews;
      const confidenceProjection =
        confidenceProjectionPayload(event.payload) ??
        buildConfidenceCompletionProjection(
          {
            ...state,
            decisions,
            queueProjection: projection
          },
          Number(nextStateVersion) as ProjectionVersion
        );

      return {
        ...state,
        stateVersion: nextStateVersion,
        decisions,
        ...(specUpdatePreviews ? { specUpdatePreviews } : {}),
        queueProjection: projection,
        completeness: confidenceProjection
      };
    }
    case "DecisionResolved": {
      const decisionId = typeof event.payload.decisionId === "string" ? (event.payload.decisionId as DecisionId) : null;
      const outcome = isDecisionResolutionStatus(event.payload.outcome) ? event.payload.outcome : null;
      const requiredDecisionRef = isRequiredDecisionRef(event.payload.requiredDecisionRef)
        ? event.payload.requiredDecisionRef
        : null;
      const queueProjection = queueProjectionPayload(event.payload) ?? state.queueProjection;
      const decisions =
        decisionId && outcome && requiredDecisionRef
          ? state.decisions.some((decision) => decision.decisionId === decisionId)
            ? state.decisions.map((decision) =>
                decision.decisionId === decisionId
                  ? {
                      ...decision,
                      status: outcome
                    }
                  : decision
              )
            : [
                ...state.decisions,
                {
                  decisionId,
                  requiredDecisionRef,
                  status: outcome
                }
              ]
          : state.decisions;
      const confidenceProjection =
        confidenceProjectionPayload(event.payload) ??
        buildConfidenceCompletionProjection(
          {
            ...state,
            decisions,
            queueProjection
          },
          Number(nextStateVersion) as ProjectionVersion
        );

      return {
        ...state,
        stateVersion: nextStateVersion,
        decisions,
        queueProjection,
        completeness: confidenceProjection
      };
    }
    case "SpecVersionCreated": {
      const projection = projectionPayload<LivingSpecProjection | undefined>(
        event.payload,
        state.livingSpecProjection
      );
      const title =
        typeof event.payload.title === "string"
          ? event.payload.title
          : projection?.title ?? state.currentSpec.title;
      const sections = Array.isArray(event.payload.sections)
        ? event.payload.sections.map(String)
        : projection?.sections ?? state.currentSpec.sections;
      const versionRef =
        typeof event.payload.versionRef === "string" ? event.payload.versionRef : state.currentSpec.versionRef;
      const currentSpec = {
        ...state.currentSpec,
        ...(versionRef ? { versionRef } : {}),
        ...(title ? { title } : {}),
        ...(sections ? { sections } : {})
      };
      const confidenceProjection =
        confidenceProjectionPayload(event.payload) ??
        buildConfidenceCompletionProjection(
          {
            ...state,
            currentSpec,
            ...(projection ? { livingSpecProjection: projection } : {})
          },
          Number(nextStateVersion) as ProjectionVersion
        );

      return {
        ...state,
        stateVersion: nextStateVersion,
        currentSpec,
        ...(projection ? { livingSpecProjection: projection } : {}),
        completeness: confidenceProjection
      };
    }
    case "ResearchPlanned": {
      const projection = projectionPayload(event.payload, state.researchState);
      const confidenceProjection = confidenceProjectionPayload(event.payload) ?? state.completeness;
      const phase = sessionPhaseForProductEngineEvent(event) ?? state.session.phase;

      return {
        ...state,
        stateVersion: nextStateVersion,
        session: {
          ...state.session,
          phase
        },
        researchState: projection,
        completeness: confidenceProjection
      };
    }
    case "ResearchResultImported":
      return {
        ...state,
        stateVersion: nextStateVersion,
        researchState: projectionPayload(event.payload, state.researchState)
      };
    case "EvidenceSynthesisRequested":
      return {
        ...state,
        stateVersion: nextStateVersion,
        session: {
          ...state.session,
          phase: sessionPhaseForProductEngineEvent(event) ?? state.session.phase
        }
      };
    case "EvidenceSynthesized": {
      const researchProjection = projectionPayload(event.payload, state.researchState);
      const queueProjection = queueProjectionPayload(event.payload) ?? state.queueProjection;
      const confidenceProjection = confidenceProjectionPayload(event.payload) ?? state.completeness;

      return {
        ...state,
        stateVersion: nextStateVersion,
        researchState: researchProjection,
        queueProjection,
        completeness: confidenceProjection
      };
    }
    case "ResearchQueueCardResolved": {
      const researchProjection = projectionPayload(event.payload, state.researchState);
      const queueProjection = queueProjectionPayload(event.payload) ?? state.queueProjection;
      const confidenceProjection = confidenceProjectionPayload(event.payload) ?? state.completeness;

      return {
        ...state,
        stateVersion: nextStateVersion,
        researchState: researchProjection,
        queueProjection,
        completeness: confidenceProjection
      };
    }
    case "RuntimePreviewRequested": {
      const runtimeProjection = projectionPayload(event.payload, state.runtimeState);
      const queueProjection = queueProjectionPayload(event.payload) ?? state.queueProjection;
      const confidenceProjection = confidenceProjectionPayload(event.payload) ?? state.completeness;

      return {
        ...state,
        stateVersion: nextStateVersion,
        runtimeState: runtimeProjection,
        queueProjection,
        completeness: confidenceProjection
      };
    }
    case "RuntimeArtifactConverted": {
      const runtimeProjection = projectionPayload(event.payload, state.runtimeState);
      const queueProjection = queueProjectionPayload(event.payload) ?? state.queueProjection;
      const confidenceProjection = confidenceProjectionPayload(event.payload) ?? state.completeness;

      return {
        ...state,
        stateVersion: nextStateVersion,
        runtimeState: runtimeProjection,
        queueProjection,
        completeness: confidenceProjection
      };
    }
    case "CompletenessScored": {
      const completeness = projectionPayload(event.payload, state.completeness);
      const queueProjection = queueProjectionPayload(event.payload) ?? state.queueProjection;
      const phase = sessionPhaseForProductEngineEvent(event) ?? state.session.phase;

      return {
        ...state,
        stateVersion: nextStateVersion,
        session: {
          ...state.session,
          phase
        },
        completeness,
        queueProjection
      };
    }
    case "FounderBriefPrepared": {
      const founderBrief = projectionPayload(event.payload, state.founderBrief);
      const confidenceProjection = confidenceProjectionPayload(event.payload) ?? state.completeness;
      const phase = sessionPhaseForProductEngineEvent(event) ?? state.session.phase;

      return {
        ...state,
        stateVersion: nextStateVersion,
        session: {
          ...state.session,
          phase
        },
        completeness: confidenceProjection,
        ...(founderBrief ? { founderBrief: founderBrief as FounderBriefProjection } : {})
      };
    }
    case "PlanningHandoffCreated":
    case "PlanningHandoffBlocked": {
      const planningHandoff = projectionPayload(event.payload, state.planningHandoff);

      return {
        ...state,
        stateVersion: nextStateVersion,
        ...(planningHandoff ? { planningHandoff } : {})
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
