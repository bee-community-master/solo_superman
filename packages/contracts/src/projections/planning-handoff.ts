import type { ProjectionVersion, SessionId } from "../ids";

export type PlanningHandoffArtifactKind = "PlanningHandoffArtifact" | "PlanningHandoffBlockerArtifact";

export type PlanningHandoffVerdict =
  | "planning_ready"
  | "blocked_by_fatal"
  | "needs_risk_acceptance"
  | "queue_review_incomplete"
  | "source_trace_incomplete";

export type PlanningHandoffBlockerClass =
  | "customer_problem_jtbd"
  | "success_metrics_validation"
  | "approval_security_execution_safety";

export type PlanningHandoffResidualRiskClass =
  | "value_proposition_differentiation"
  | "mvp_scope_non_scope"
  | "known_low_medium_risk"
  | "phase15b_readiness_gap";

export type PlanningHandoffQueueOutcome =
  | "approved"
  | "revised"
  | "rejected"
  | "risk_accepted"
  | "research_insufficient"
  | "deferred";

export type PlanningHandoffRequiredUserAction =
  | "approve"
  | "revise"
  | "reject"
  | "defer_with_reason"
  | "risk_accept"
  | "research_more";

export type PlanningHandoffSourceType =
  | "spec_version"
  | "founder_brief"
  | "completion_candidate"
  | "decision_linked_evidence_pack"
  | "research_updated_queue_item"
  | "decision"
  | "risk_acceptance"
  | "known_risk"
  | "open_question"
  | "phase15b_hint"
  | "runtime_preview_artifact"
  | "activity_event";

export interface PlanningHandoffSourceRefDto {
  readonly sourceType: PlanningHandoffSourceType;
  readonly sourceId: string;
  readonly sourceLabel?: string;
  readonly required: boolean;
  readonly stale: boolean;
}

export interface PlanningHandoffRequestedScopeDto {
  readonly productSlice: string;
  readonly userFacingJourneyLabel: "Planning-ready";
  readonly nonGoals: readonly string[];
  readonly excludedInternalPhases: readonly (
    | "phase3_controlled_execution"
    | "chatgpt_web_automation"
    | "external_deploy"
  )[];
  readonly assumptions: readonly string[];
}

export interface PlanningHandoffGateVerdictDto {
  readonly verdict: PlanningHandoffVerdict;
  readonly reviewedQueueItemIds: readonly string[];
  readonly terminalOutcomeSummary: readonly PlanningHandoffQueueOutcomeSummaryDto[];
  readonly fatalBlockerClassesChecked: readonly PlanningHandoffBlockerClass[];
  readonly residualRiskVisibilityCheck: "passed" | "failed";
  readonly rationale: string;
}

export interface PlanningHandoffQueueOutcomeSummaryDto {
  readonly queueItemId: string;
  readonly outcome: PlanningHandoffQueueOutcome;
  readonly impact: "low" | "medium" | "high";
  readonly blockerClass?: PlanningHandoffBlockerClass;
  readonly residualRiskClass?: PlanningHandoffResidualRiskClass;
  readonly riskAccepted: boolean;
  readonly sourceRefs: readonly PlanningHandoffSourceRefDto[];
}

export type PlanningHandoffOwnerRole = "frontend" | "backend" | "product" | "qa" | "docs" | "security" | "research";

export interface PlanningHandoffTaskDto {
  readonly taskId: string;
  readonly title: string;
  readonly intent: string;
  readonly sourceRefs: readonly PlanningHandoffSourceRefDto[];
  readonly dependsOn: readonly string[];
  readonly ownerRole: PlanningHandoffOwnerRole;
  readonly acceptanceEvidence: readonly string[];
  readonly nonGoals: readonly string[];
  readonly riskRefs: readonly string[];
}

export interface PlanningHandoffPrIssuePlanItemDto {
  readonly sequenceId: string;
  readonly summary: string;
  readonly includedTaskIds: readonly string[];
  readonly entryPrerequisites: readonly string[];
  readonly exitEvidence: readonly string[];
  readonly blockedBy: readonly string[];
  readonly phaseBoundary: "phase2_planning_handoff" | "phase3_controlled_execution_prerequisite";
}

export interface PlanningHandoffReadinessChecklistDto {
  readonly requiredApprovals: readonly string[];
  readonly sandboxBoundary: string;
  readonly rollbackReference: string;
  readonly expectedEvidence: readonly string[];
  readonly commandPreviewRequirements: readonly string[];
  readonly filePreviewRequirements: readonly string[];
  readonly browserPreviewRequirements: readonly string[];
}

export interface PlanningHandoffResidualRiskDto {
  readonly riskId: string;
  readonly riskClass: PlanningHandoffResidualRiskClass;
  readonly title: string;
  readonly severity: "low" | "medium" | "high";
  readonly sourceRefs: readonly PlanningHandoffSourceRefDto[];
  readonly assumption: string;
  readonly prerequisite: string;
  readonly validationDependency: string;
  readonly ownerRole: PlanningHandoffOwnerRole;
  readonly followUpTrigger: string;
}

export interface PlanningHandoffBuildSlicePlanDto {
  readonly sliceGoal: string;
  readonly includedCapabilities: readonly string[];
  readonly nonGoals: readonly string[];
  readonly sourceRefs: readonly PlanningHandoffSourceRefDto[];
  readonly acceptanceCriteria: readonly string[];
  readonly smokeTests: readonly string[];
  readonly validationMetric: string;
  readonly residualRisks: readonly string[];
}

export interface PlanningHandoffServeEnvVarDto {
  readonly envVarName: string;
  readonly required: boolean;
  readonly present: boolean;
  readonly valueIncluded: false;
  readonly note?: string;
}

export interface PlanningHandoffServeChecklistDto {
  readonly serveTarget: string;
  readonly envVars: readonly PlanningHandoffServeEnvVarDto[];
  readonly publicUrl?: string;
  readonly authAndPrivacyCheck: string;
  readonly smokeTestChecklist: readonly string[];
  readonly rollbackPlan: string;
  readonly launchNote: string;
  readonly learningMetrics: readonly string[];
}

export type PlanningHandoffLearningDecisionOption = "pivot" | "persevere" | "narrow_scope" | "next_slice";

export interface PlanningHandoffLearningLoopHookDto {
  readonly signalsToCollect: readonly string[];
  readonly interpretationFrame: string;
  readonly decisionOptions: readonly PlanningHandoffLearningDecisionOption[];
  readonly recommendedNextSliceRule: string;
  readonly riskUpdateRule: string;
}

export interface PlanningHandoffArtifactDto {
  readonly artifactId: string;
  readonly kind: "PlanningHandoffArtifact";
  readonly schemaVersion: "solo-superman.phase2-planning-handoff.v1";
  readonly createdAt: string;
  readonly createdBy: "user" | "product_engine" | "system";
  readonly status: "planning_ready";
  readonly sourceRefs: readonly PlanningHandoffSourceRefDto[];
  readonly gateVerdict: PlanningHandoffGateVerdictDto & { readonly verdict: "planning_ready" };
  readonly scopeSnapshot: PlanningHandoffRequestedScopeDto;
  readonly taskBreakdown: readonly PlanningHandoffTaskDto[];
  readonly prIssuePlan: readonly PlanningHandoffPrIssuePlanItemDto[];
  readonly buildSlicePlan: PlanningHandoffBuildSlicePlanDto;
  readonly serveChecklist: PlanningHandoffServeChecklistDto;
  readonly learningLoopHook: PlanningHandoffLearningLoopHookDto;
  readonly readinessChecklist: PlanningHandoffReadinessChecklistDto;
  readonly residualRiskRegister: readonly PlanningHandoffResidualRiskDto[];
  readonly phase15bHintMapping: readonly PlanningHandoffSourceRefDto[];
  readonly noExecutionPolicy: "no_file_shell_browser_deploy_or_external_mutation";
  readonly handoffSummary: string;
}

export interface PlanningHandoffBlockerDto {
  readonly blockerId: string;
  readonly blockerClass: PlanningHandoffBlockerClass | "source_trace" | "queue_review";
  readonly queueItemId?: string;
  readonly currentOutcome?: PlanningHandoffQueueOutcome;
  readonly whyFatal: string;
  readonly requiredNextAction: PlanningHandoffRequiredUserAction;
  readonly sourceRefs: readonly PlanningHandoffSourceRefDto[];
}

export interface PlanningHandoffBlockerArtifactDto {
  readonly artifactId: string;
  readonly kind: "PlanningHandoffBlockerArtifact";
  readonly schemaVersion: "solo-superman.phase2-planning-handoff-blocker.v1";
  readonly createdAt: string;
  readonly createdBy: "user" | "product_engine" | "system";
  readonly status: Exclude<PlanningHandoffVerdict, "planning_ready">;
  readonly sourceRefs: readonly PlanningHandoffSourceRefDto[];
  readonly gateVerdict: PlanningHandoffGateVerdictDto & {
    readonly verdict: Exclude<PlanningHandoffVerdict, "planning_ready">;
  };
  readonly blockers: readonly PlanningHandoffBlockerDto[];
  readonly residualRisks: readonly PlanningHandoffResidualRiskDto[];
  readonly requiredUserActions: readonly PlanningHandoffRequiredUserAction[];
  readonly safePreviewRefs: readonly PlanningHandoffSourceRefDto[];
  readonly noFinalLabelRule: "must_not_use_planning_ready_label";
}

export type PlanningHandoffProjection =
  | {
      readonly kind: "PlanningHandoffProjection";
      readonly sessionId: SessionId;
      readonly version: ProjectionVersion;
      readonly currentStatus: "planning_ready";
      readonly finalArtifact: PlanningHandoffArtifactDto;
      readonly blockerArtifact?: never;
      readonly sourceRefs: readonly PlanningHandoffSourceRefDto[];
      readonly summary: string;
      readonly refetchUrl: string;
    }
  | {
      readonly kind: "PlanningHandoffProjection";
      readonly sessionId: SessionId;
      readonly version: ProjectionVersion;
      readonly currentStatus: Exclude<PlanningHandoffVerdict, "planning_ready">;
      readonly finalArtifact?: never;
      readonly blockerArtifact: PlanningHandoffBlockerArtifactDto;
      readonly sourceRefs: readonly PlanningHandoffSourceRefDto[];
      readonly summary: string;
      readonly refetchUrl: string;
    };

const planningHandoffDemoSessionId = "session_demo_001" as SessionId;
const planningHandoffDemoRefetchUrl = `/api/v1/sessions/${planningHandoffDemoSessionId}/planning-handoff`;

const planningHandoffSpecRef = {
  sourceType: "spec_version",
  sourceId: "spec_version_demo_001",
  sourceLabel: "Current Living Spec v1",
  required: true,
  stale: false
} as const satisfies PlanningHandoffSourceRefDto;

const planningHandoffFounderBriefRef = {
  sourceType: "founder_brief",
  sourceId: "founder_brief_demo_001",
  sourceLabel: "Founder Brief candidate",
  required: true,
  stale: false
} as const satisfies PlanningHandoffSourceRefDto;

const planningHandoffEvidenceRef = {
  sourceType: "decision_linked_evidence_pack",
  sourceId: "evidence_pack_demo_001",
  sourceLabel: "Decision-linked evidence pack",
  required: true,
  stale: false
} as const satisfies PlanningHandoffSourceRefDto;

const planningHandoffQueueRef = {
  sourceType: "research_updated_queue_item",
  sourceId: "queue_item_demo_001",
  sourceLabel: "Research-updated queue card",
  required: true,
  stale: false
} as const satisfies PlanningHandoffSourceRefDto;

const planningHandoffHintRef = {
  sourceType: "phase15b_hint",
  sourceId: "phase15b_hint_demo_001",
  sourceLabel: "Readiness hint metadata",
  required: false,
  stale: false
} as const satisfies PlanningHandoffSourceRefDto;

const planningHandoffFinalSourceRefs = [
  planningHandoffSpecRef,
  planningHandoffFounderBriefRef,
  planningHandoffEvidenceRef,
  planningHandoffQueueRef,
  planningHandoffHintRef
] as const satisfies readonly PlanningHandoffSourceRefDto[];

export const PLANNING_HANDOFF_FINAL_ARTIFACT_FIXTURE = {
  artifactId: "handoff_demo_final_001",
  kind: "PlanningHandoffArtifact",
  schemaVersion: "solo-superman.phase2-planning-handoff.v1",
  createdAt: "2026-05-06T00:00:00.000Z",
  createdBy: "product_engine",
  status: "planning_ready",
  sourceRefs: planningHandoffFinalSourceRefs,
  gateVerdict: {
    verdict: "planning_ready",
    reviewedQueueItemIds: ["queue_item_demo_001"],
    terminalOutcomeSummary: [
      {
        queueItemId: "queue_item_demo_001",
        outcome: "approved",
        impact: "high",
        riskAccepted: false,
        sourceRefs: [planningHandoffQueueRef, planningHandoffEvidenceRef]
      }
    ],
    fatalBlockerClassesChecked: [
      "customer_problem_jtbd",
      "success_metrics_validation",
      "approval_security_execution_safety"
    ],
    residualRiskVisibilityCheck: "passed",
    rationale: "All required source traces are current and the high-impact queue card has a terminal outcome."
  },
  scopeSnapshot: {
    productSlice: "Founder planning handoff",
    userFacingJourneyLabel: "Planning-ready",
    nonGoals: ["controlled execution", "external deployment", "browser automation"],
    excludedInternalPhases: ["phase3_controlled_execution", "chatgpt_web_automation", "external_deploy"],
    assumptions: ["Phase 2 remains a no-execution planning handoff."]
  },
  taskBreakdown: [
    {
      taskId: "task_contracts_001",
      title: "Lock Planning Handoff contracts",
      intent: "Expose closed DTOs and fixtures before reducer/storage/API/UI work.",
      sourceRefs: [planningHandoffSpecRef, planningHandoffEvidenceRef],
      dependsOn: [],
      ownerRole: "backend",
      acceptanceEvidence: ["contracts tests pass", "docs verifier passes"],
      nonGoals: ["no route handler persistence", "no controlled execution"],
      riskRefs: ["risk_phase2_no_execution"]
    }
  ],
  prIssuePlan: [
    {
      sequenceId: "phase2_pr01",
      summary: "Planning Handoff contracts and verifier sync",
      includedTaskIds: ["task_contracts_001"],
      entryPrerequisites: ["Phase 1.5 issues #27-#38 merged"],
      exitEvidence: ["PlanningHandoffProjection final fixture compiles"],
      blockedBy: [],
      phaseBoundary: "phase2_planning_handoff"
    }
  ],
  buildSlicePlan: {
    sliceGoal: "Validate the smallest Planning-ready handoff surface before any execution adapter work.",
    includedCapabilities: [
      "read-only final handoff projection",
      "blocker projection fallback",
      "source trace and residual risk display"
    ],
    nonGoals: ["automatic code generation", "automatic deployment", "external mutation"],
    sourceRefs: [planningHandoffSpecRef, planningHandoffEvidenceRef, planningHandoffQueueRef],
    acceptanceCriteria: [
      "final handoff shows only when the gate verdict is planning_ready",
      "blocker handoff avoids the Planning-ready label"
    ],
    smokeTests: ["render final fixture", "render blocker fixture", "refetch planning-handoff projection"],
    validationMetric: "First user can identify the next PR-sized build slice without hidden fatal blockers.",
    residualRisks: ["risk_phase2_no_execution"]
  },
  serveChecklist: {
    serveTarget: "local preview",
    envVars: [
      {
        envVarName: "SOLO_SUPERMAN_LOCAL_TOKEN",
        required: false,
        present: false,
        valueIncluded: false,
        note: "Token value is never stored in Planning Handoff DTOs."
      }
    ],
    authAndPrivacyCheck: "Planning-ready preview remains local/read-only and hides credential values.",
    smokeTestChecklist: ["open Planning-ready view", "confirm no file/shell/browser/deploy controls are available"],
    rollbackPlan: "Hide the Planning Handoff surface and return to queue review until blockers are resolved.",
    launchNote: "Planning-ready context is ready for review; execution remains out of scope.",
    learningMetrics: ["handoff understood", "next slice accepted", "blocker revisions requested"]
  },
  learningLoopHook: {
    signalsToCollect: ["reviewer questions", "accepted next-slice task", "blocker revision reasons"],
    interpretationFrame: "Signals update product confidence, implementation confidence, and visible residual risk only.",
    decisionOptions: ["persevere", "narrow_scope", "next_slice"],
    recommendedNextSliceRule: "Recommend the next slice only after fatal blockers stay resolved or risk-accepted.",
    riskUpdateRule: "Convert repeated blocker feedback into Known Risks or queue items before a final handoff retry."
  },
  readinessChecklist: {
    requiredApprovals: ["founder reviews Planning-ready handoff"],
    sandboxBoundary: "local preview metadata only",
    rollbackReference: "revert the contract PR before dependent reducer/storage/API work lands",
    expectedEvidence: ["pnpm verify", "pnpm verify:docs"],
    commandPreviewRequirements: ["preview commands remain non-executing"],
    filePreviewRequirements: ["file patches are described only as future evidence"],
    browserPreviewRequirements: ["browser actions are excluded from Phase 2 handoff"]
  },
  residualRiskRegister: [
    {
      riskId: "risk_phase2_no_execution",
      riskClass: "phase15b_readiness_gap",
      title: "Readiness hint requires explicit future execution approval",
      severity: "medium",
      sourceRefs: [planningHandoffHintRef],
      assumption: "Hint metadata is sufficient for planning but not for execution.",
      prerequisite: "Phase 3 controlled execution approval remains separate.",
      validationDependency: "Future PR must preserve no-execution field semantics.",
      ownerRole: "security",
      followUpTrigger: "Before implementing any controlled execution adapter."
    }
  ],
  phase15bHintMapping: [planningHandoffHintRef],
  noExecutionPolicy: "no_file_shell_browser_deploy_or_external_mutation",
  handoffSummary: "계획 준비(Planning-ready) handoff가 확정됐으며, 실행 권한 없이 다음 구현 조각과 남은 리스크를 보여준다."
} as const satisfies PlanningHandoffArtifactDto;

export const PLANNING_HANDOFF_FINAL_PROJECTION_FIXTURE = {
  kind: "PlanningHandoffProjection",
  sessionId: planningHandoffDemoSessionId,
  version: 1 as ProjectionVersion,
  currentStatus: "planning_ready",
  finalArtifact: PLANNING_HANDOFF_FINAL_ARTIFACT_FIXTURE,
  sourceRefs: PLANNING_HANDOFF_FINAL_ARTIFACT_FIXTURE.sourceRefs,
  summary: PLANNING_HANDOFF_FINAL_ARTIFACT_FIXTURE.handoffSummary,
  refetchUrl: planningHandoffDemoRefetchUrl
} as const satisfies PlanningHandoffProjection;

const stalePlanningHandoffSpecRef = {
  ...planningHandoffSpecRef,
  sourceId: "spec_version_stale_001",
  stale: true
} as const satisfies PlanningHandoffSourceRefDto;

const planningHandoffBlockerSourceRefs = [
  stalePlanningHandoffSpecRef,
  planningHandoffQueueRef
] as const satisfies readonly PlanningHandoffSourceRefDto[];

export const PLANNING_HANDOFF_BLOCKER_ARTIFACT_FIXTURE = {
  artifactId: "handoff_demo_blocker_001",
  kind: "PlanningHandoffBlockerArtifact",
  schemaVersion: "solo-superman.phase2-planning-handoff-blocker.v1",
  createdAt: "2026-05-06T00:05:00.000Z",
  createdBy: "product_engine",
  status: "source_trace_incomplete",
  sourceRefs: planningHandoffBlockerSourceRefs,
  gateVerdict: {
    verdict: "source_trace_incomplete",
    reviewedQueueItemIds: ["queue_item_demo_001"],
    terminalOutcomeSummary: [
      {
        queueItemId: "queue_item_demo_001",
        outcome: "deferred",
        impact: "high",
        blockerClass: "customer_problem_jtbd",
        riskAccepted: false,
        sourceRefs: [planningHandoffQueueRef]
      }
    ],
    fatalBlockerClassesChecked: ["customer_problem_jtbd"],
    residualRiskVisibilityCheck: "failed",
    rationale: "A required SpecVersion source is stale and the high-impact queue card is not fully resolved."
  },
  blockers: [
    {
      blockerId: "blocker_source_trace_001",
      blockerClass: "source_trace",
      whyFatal: "Planning handoff cannot use stale required source traces.",
      requiredNextAction: "revise",
      sourceRefs: [stalePlanningHandoffSpecRef]
    },
    {
      blockerId: "blocker_queue_review_001",
      blockerClass: "queue_review",
      queueItemId: "queue_item_demo_001",
      currentOutcome: "deferred",
      whyFatal: "High-impact queue cards need a terminal approval/rejection/risk acceptance before final handoff.",
      requiredNextAction: "research_more",
      sourceRefs: [planningHandoffQueueRef]
    }
  ],
  residualRisks: [],
  requiredUserActions: ["revise", "research_more"],
  safePreviewRefs: [planningHandoffHintRef],
  noFinalLabelRule: "must_not_use_planning_ready_label"
} as const satisfies PlanningHandoffBlockerArtifactDto;

export const PLANNING_HANDOFF_BLOCKER_PROJECTION_FIXTURE = {
  kind: "PlanningHandoffProjection",
  sessionId: planningHandoffDemoSessionId,
  version: 2 as ProjectionVersion,
  currentStatus: "source_trace_incomplete",
  blockerArtifact: PLANNING_HANDOFF_BLOCKER_ARTIFACT_FIXTURE,
  sourceRefs: PLANNING_HANDOFF_BLOCKER_ARTIFACT_FIXTURE.sourceRefs,
  summary: "Planning handoff remains blocked until required source traces and high-impact review outcomes are current.",
  refetchUrl: planningHandoffDemoRefetchUrl
} as const satisfies PlanningHandoffProjection;
