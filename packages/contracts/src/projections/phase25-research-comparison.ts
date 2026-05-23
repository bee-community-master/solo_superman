import type { ProjectionVersion, SchemaVersion, SessionId } from "../ids";
import { isProjectionRecord as isRecord } from "./validation-helpers";

export const PHASE25_RESEARCH_COMPARISON_SCHEMA_VERSION =
  "solo-superman.phase25-research-quality-comparison.v1" as SchemaVersion;

export const PHASE25_NO_EXECUTION_BOUNDARY =
  "no_submit_write_credential_custody_or_live_browser_execution" as const;

export const PHASE25_CANDIDATE_LANES = [
  "playwright_preview",
  "browseruse_preview",
  "chatgpt_deep_research_preview",
  "manual_prompt_handoff",
  "official_codex_fallback"
] as const;

export type Phase25CandidateLane = (typeof PHASE25_CANDIDATE_LANES)[number];

export const PHASE25_DELEGATION_RISK_GATE_VERDICTS = [
  "allowed_for_comparative_preview",
  "blocked_by_policy_risk",
  "blocked_by_data_sensitivity",
  "blocked_by_session_custody",
  "blocked_by_write_action",
  "fallback_required"
] as const;

export type Phase25DelegationRiskGateVerdict = (typeof PHASE25_DELEGATION_RISK_GATE_VERDICTS)[number];

export const PHASE25_DELEGATION_RISK_GATE_CHECKS = [
  "policy_terms",
  "data_disclosure",
  "session_custody",
  "browser_action",
  "revoke_audit",
  "fallback_available"
] as const;

export type Phase25DelegationRiskGateCheckName = (typeof PHASE25_DELEGATION_RISK_GATE_CHECKS)[number];
export type Phase25DelegationRiskGateCheckStatus = "pass" | "block" | "fallback";
export type Phase25FallbackLane = Extract<Phase25CandidateLane, "manual_prompt_handoff" | "official_codex_fallback">;

export const PHASE25_RESEARCH_QUALITY_RUBRIC_DIMENSIONS = [
  "evidence_balance",
  "source_trace",
  "decision_impact",
  "freshness_staleness",
  "safety_revoke",
  "baseline_lift"
] as const;

export type Phase25ResearchQualityRubricDimension = (typeof PHASE25_RESEARCH_QUALITY_RUBRIC_DIMENSIONS)[number];
export type Phase25ResearchQualityRubricStatus = "pass" | "fail";
export type Phase25ResearchQualityLiftStatus = "material_quality_lift" | "safe_failure_no_lift";
export type Phase25ResearchComparisonStatus = "quality_lift_ready" | "safe_failure_blocked";

export const PHASE25_SOURCE_TYPES = [
  "phase15a_baseline",
  "candidate_output",
  "policy_note",
  "manual_handoff",
  "codex_fallback",
  "decision_context",
  "research_question"
] as const;

export type Phase25SourceType = (typeof PHASE25_SOURCE_TYPES)[number];

export interface Phase25SourceRefDto {
  readonly sourceType: Phase25SourceType;
  readonly sourceId: string;
  readonly sourceLabel?: string;
  readonly required: boolean;
  readonly stale: boolean;
}

export interface Phase25DelegationRiskGateCheckDto {
  readonly checkName: Phase25DelegationRiskGateCheckName;
  readonly status: Phase25DelegationRiskGateCheckStatus;
  readonly rationale: string;
  readonly sourceRefs: readonly Phase25SourceRefDto[];
}

export interface Phase25DelegationRiskGateDto {
  readonly verdict: Phase25DelegationRiskGateVerdict;
  readonly candidateLane: Phase25CandidateLane;
  readonly checks: readonly Phase25DelegationRiskGateCheckDto[];
  readonly blockedReasons: readonly string[];
  readonly fallbackLane?: Phase25FallbackLane;
  readonly noExecutionBoundary: typeof PHASE25_NO_EXECUTION_BOUNDARY;
  readonly rationale: string;
}

export interface Phase25BaselineResearchSummaryDto {
  readonly baselineRef: string;
  readonly summary: string;
  readonly proEvidence: readonly string[];
  readonly conEvidence: readonly string[];
  readonly uncertainties: readonly string[];
  readonly limitations: readonly string[];
  readonly sourceRefs: readonly Phase25SourceRefDto[];
}

export interface Phase25CandidateResearchSummaryDto {
  readonly candidateRef: string;
  readonly lane: Phase25CandidateLane;
  readonly summary: string;
  readonly proEvidence: readonly string[];
  readonly conEvidence: readonly string[];
  readonly uncertainties: readonly string[];
  readonly decisionImpacts: readonly string[];
  readonly sourceTraceRefs: readonly Phase25SourceRefDto[];
  readonly staleRisk: "low" | "medium" | "high";
  readonly policyNotes: readonly string[];
}

export interface Phase25ResearchQualityRubricScoreDto {
  readonly dimension: Phase25ResearchQualityRubricDimension;
  readonly status: Phase25ResearchQualityRubricStatus;
  readonly rationale: string;
  readonly sourceRefs: readonly Phase25SourceRefDto[];
}

export interface Phase25ResearchQualityComparisonReportDto {
  readonly artifactId: string;
  readonly kind: "ResearchQualityComparisonReport";
  readonly schemaVersion: typeof PHASE25_RESEARCH_COMPARISON_SCHEMA_VERSION;
  readonly createdAt: string;
  readonly createdBy: "user" | "product_engine" | "system";
  readonly status: Phase25ResearchComparisonStatus;
  readonly researchQuestion: string;
  readonly decisionContext: string;
  readonly candidateLane: Phase25CandidateLane;
  readonly sourceRefs: readonly Phase25SourceRefDto[];
  readonly baseline: Phase25BaselineResearchSummaryDto;
  readonly candidate: Phase25CandidateResearchSummaryDto;
  readonly delegationRiskGate: Phase25DelegationRiskGateDto;
  readonly rubric: readonly Phase25ResearchQualityRubricScoreDto[];
  readonly qualityLiftStatus: Phase25ResearchQualityLiftStatus;
  readonly qualityLiftClaimed: boolean;
  readonly decisionImpactSummary: string;
  readonly requiredFollowUps: readonly string[];
  readonly noExecutionPolicy: typeof PHASE25_NO_EXECUTION_BOUNDARY;
}

export interface CreatePhase25ResearchComparisonPayload {
  readonly researchQuestion: string;
  readonly decisionContext: string;
  readonly sourceRefs: readonly Phase25SourceRefDto[];
  readonly baseline: Phase25BaselineResearchSummaryDto;
  readonly candidate: Phase25CandidateResearchSummaryDto;
  readonly delegationRiskGate: Phase25DelegationRiskGateDto;
  readonly rubric: readonly Phase25ResearchQualityRubricScoreDto[];
}

export interface Phase25ResearchComparisonProjection {
  readonly kind: "Phase25ResearchComparisonProjection";
  readonly sessionId: SessionId;
  readonly version: ProjectionVersion;
  readonly currentStatus: Phase25ResearchComparisonStatus;
  readonly artifact: Phase25ResearchQualityComparisonReportDto;
  readonly sourceRefs: readonly Phase25SourceRefDto[];
  readonly summary: string;
  readonly refetchUrl: string;
}

export interface Phase25ResearchCandidateAdapterInput {
  readonly researchQuestion: string;
  readonly decisionContext: string;
  readonly baseline: Phase25BaselineResearchSummaryDto;
  readonly allowedSourceRefs: readonly Phase25SourceRefDto[];
}

export interface Phase25ResearchCandidateAdapterOutput {
  readonly candidate: Phase25CandidateResearchSummaryDto;
  readonly delegationRiskGate: Phase25DelegationRiskGateDto;
  readonly generatedAt: string;
}

export interface Phase25ResearchCandidateAdapterPort {
  readonly adapterKind: Phase25CandidateLane;
  readonly adapterVersion: string;
  readonly compare: (input: Phase25ResearchCandidateAdapterInput) => Promise<Phase25ResearchCandidateAdapterOutput>;
}

export class Phase25ResearchComparisonValidationError extends Error {
  readonly issues: readonly string[];

  constructor(issues: readonly string[]) {
    super(`Invalid Phase 2.5 ResearchQualityComparisonReport: ${issues.join("; ")}`);
    this.name = "Phase25ResearchComparisonValidationError";
    this.issues = issues;
  }
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function nonEmptyStringArray(value: readonly string[] | undefined) {
  return Array.isArray(value) && value.every(isNonEmptyString) && value.length > 0;
}

function isPhase25SourceType(value: unknown): value is Phase25SourceType {
  return typeof value === "string" && PHASE25_SOURCE_TYPES.includes(value as Phase25SourceType);
}

function isPhase25FallbackLane(value: unknown): value is Phase25FallbackLane {
  return value === "manual_prompt_handoff" || value === "official_codex_fallback";
}

function phase25SourceRefIsValid(sourceRef: unknown): sourceRef is Phase25SourceRefDto {
  if (!isRecord(sourceRef)) {
    return false;
  }

  return (
    isPhase25SourceType(sourceRef.sourceType) &&
    isNonEmptyString(sourceRef.sourceId) &&
    (sourceRef.sourceLabel === undefined || isNonEmptyString(sourceRef.sourceLabel)) &&
    typeof sourceRef.required === "boolean" &&
    typeof sourceRef.stale === "boolean"
  );
}

function phase25SourceRefsAreValid(sourceRefs: readonly unknown[] | undefined) {
  return Array.isArray(sourceRefs) && sourceRefs.length > 0 && sourceRefs.every(phase25SourceRefIsValid);
}

function hasDuplicates(values: readonly string[]) {
  return new Set(values).size !== values.length;
}

function sourceRefKeys(sourceRefs: readonly Phase25SourceRefDto[]) {
  return sourceRefs.map((sourceRef) => `${sourceRef.sourceType}:${sourceRef.sourceId}`);
}

function gateCoversEveryCheck(report: Phase25ResearchQualityComparisonReportDto) {
  const checks = new Set(report.delegationRiskGate.checks.map((check) => check.checkName));

  return PHASE25_DELEGATION_RISK_GATE_CHECKS.every((checkName) => checks.has(checkName));
}

function gateHasNonPassingChecks(report: Phase25ResearchQualityComparisonReportDto) {
  return report.delegationRiskGate.checks.some((check) => check.status !== "pass");
}

function rubricCoversEveryDimension(report: Phase25ResearchQualityComparisonReportDto) {
  const dimensions = new Set(report.rubric.map((score) => score.dimension));

  return PHASE25_RESEARCH_QUALITY_RUBRIC_DIMENSIONS.every((dimension) => dimensions.has(dimension));
}

export function phase25ResearchComparisonValidationIssues(
  report: Phase25ResearchQualityComparisonReportDto
): readonly string[] {
  const issues: string[] = [];

  if (!report.artifactId.startsWith("phase25_cmp_")) {
    issues.push("artifactId must use the phase25_cmp_ prefix");
  }

  if (report.kind !== "ResearchQualityComparisonReport") {
    issues.push("kind must be ResearchQualityComparisonReport");
  }

  if (report.schemaVersion !== PHASE25_RESEARCH_COMPARISON_SCHEMA_VERSION) {
    issues.push("schemaVersion must match Phase 2.5 research comparison schema");
  }

  if (!isNonEmptyString(report.researchQuestion)) {
    issues.push("researchQuestion is required");
  }

  if (!isNonEmptyString(report.decisionContext)) {
    issues.push("decisionContext is required");
  }

  if (!isNonEmptyString(report.decisionImpactSummary)) {
    issues.push("decisionImpactSummary is required");
  }

  if (!nonEmptyStringArray(report.requiredFollowUps)) {
    issues.push("requiredFollowUps must include at least one follow-up or boundary note");
  }

  if (!phase25SourceRefsAreValid(report.sourceRefs)) {
    issues.push("sourceRefs must include traceable references");
  } else if (hasDuplicates(sourceRefKeys(report.sourceRefs))) {
    issues.push("sourceRefs must not duplicate sourceType/sourceId pairs");
  }

  if (!phase25SourceRefsAreValid(report.baseline.sourceRefs)) {
    issues.push("baseline sourceRefs must include traceable references");
  }

  if (!phase25SourceRefsAreValid(report.candidate.sourceTraceRefs)) {
    issues.push("candidate sourceTraceRefs must include traceable references");
  }

  if (!gateCoversEveryCheck(report)) {
    issues.push("DelegationRiskGate must cover every Phase 2.5 gate check");
  }

  if (hasDuplicates(report.delegationRiskGate.checks.map((check) => check.checkName))) {
    issues.push("DelegationRiskGate checks must not duplicate checkName");
  }

  if (!rubricCoversEveryDimension(report)) {
    issues.push("rubric must cover every Phase 2.5 quality dimension");
  }

  if (hasDuplicates(report.rubric.map((score) => score.dimension))) {
    issues.push("rubric must not duplicate quality dimensions");
  }

  const allRubricPass = report.rubric.every((score) => score.status === "pass");
  const gateAllowed = report.delegationRiskGate.verdict === "allowed_for_comparative_preview";
  const gateBlockedOrFallback = gateHasNonPassingChecks(report);

  if (report.noExecutionPolicy !== PHASE25_NO_EXECUTION_BOUNDARY) {
    issues.push("report no-execution policy must match Phase 2.5 no-execution boundary");
  }

  if (report.delegationRiskGate.noExecutionBoundary !== PHASE25_NO_EXECUTION_BOUNDARY) {
    issues.push("DelegationRiskGate noExecutionBoundary must match Phase 2.5 no-execution boundary");
  }

  if (report.delegationRiskGate.noExecutionBoundary !== report.noExecutionPolicy) {
    issues.push("delegation risk gate and report no-execution policy must match");
  }

  if (report.candidateLane !== report.candidate.lane) {
    issues.push("candidateLane must match candidate.lane");
  }

  if (report.delegationRiskGate.candidateLane !== report.candidateLane) {
    issues.push("DelegationRiskGate candidateLane must match report candidateLane");
  }

  if (
    report.delegationRiskGate.fallbackLane !== undefined &&
    !isPhase25FallbackLane(report.delegationRiskGate.fallbackLane)
  ) {
    issues.push("DelegationRiskGate fallbackLane must be manual_prompt_handoff or official_codex_fallback");
  }

  if (report.delegationRiskGate.verdict === "fallback_required" && !report.delegationRiskGate.fallbackLane) {
    issues.push("fallback_required requires an explicit fallbackLane");
  }

  if (gateAllowed && gateBlockedOrFallback) {
    issues.push("allowed_for_comparative_preview requires every DelegationRiskGate check to pass");
  }

  if (gateAllowed && report.delegationRiskGate.blockedReasons.length > 0) {
    issues.push("allowed_for_comparative_preview must not include blockedReasons");
  }

  if (report.status === "quality_lift_ready") {
    if (!gateAllowed) {
      issues.push("quality_lift_ready requires an allowed DelegationRiskGate verdict");
    }

    if (!allRubricPass) {
      issues.push("quality_lift_ready requires every rubric dimension to pass");
    }

    if (report.qualityLiftStatus !== "material_quality_lift" || !report.qualityLiftClaimed) {
      issues.push("quality_lift_ready must explicitly claim material_quality_lift");
    }

    if (!nonEmptyStringArray(report.candidate.proEvidence)) {
      issues.push("quality_lift_ready requires candidate pro evidence");
    }

    if (!nonEmptyStringArray(report.candidate.conEvidence)) {
      issues.push("quality_lift_ready rejects pro-only candidate output");
    }

    if (!nonEmptyStringArray(report.candidate.uncertainties)) {
      issues.push("quality_lift_ready requires explicit candidate uncertainties");
    }

    if (!nonEmptyStringArray(report.candidate.decisionImpacts)) {
      issues.push("quality_lift_ready requires decision impact evidence");
    }
  }

  if (report.status === "safe_failure_blocked") {
    if (report.qualityLiftStatus !== "safe_failure_no_lift" || report.qualityLiftClaimed) {
      issues.push("safe_failure_blocked must not claim quality lift");
    }

    if (!report.delegationRiskGate.blockedReasons.length) {
      issues.push("safe_failure_blocked requires explicit blockedReasons");
    }
  }

  return issues;
}

export function validatePhase25ResearchComparisonReport(
  report: Phase25ResearchQualityComparisonReportDto
): Phase25ResearchQualityComparisonReportDto {
  const issues = phase25ResearchComparisonValidationIssues(report);

  if (issues.length) {
    throw new Phase25ResearchComparisonValidationError(issues);
  }

  return report;
}

export function validatePhase25ResearchComparisonProjection(
  projection: Phase25ResearchComparisonProjection
): Phase25ResearchComparisonProjection {
  validatePhase25ResearchComparisonReport(projection.artifact);

  if (projection.kind !== "Phase25ResearchComparisonProjection") {
    throw new Phase25ResearchComparisonValidationError(["projection kind must be Phase25ResearchComparisonProjection"]);
  }

  if (projection.currentStatus !== projection.artifact.status) {
    throw new Phase25ResearchComparisonValidationError(["projection currentStatus must match artifact status"]);
  }

  return projection;
}

const phase25DemoSessionId = "session_phase25_demo_001" as SessionId;
const phase25DemoRefetchUrl = `/api/v1/sessions/${phase25DemoSessionId}/phase25/research-comparison`;

const phase25BaselineRef = {
  sourceType: "phase15a_baseline",
  sourceId: "phase15a_baseline_demo_001",
  sourceLabel: "Phase 1.5A allowlisted baseline evidence pack",
  required: true,
  stale: false
} as const satisfies Phase25SourceRefDto;

const phase25CandidateRef = {
  sourceType: "candidate_output",
  sourceId: "phase25_candidate_demo_001",
  sourceLabel: "Phase 2.5 manual delegation candidate output",
  required: true,
  stale: false
} as const satisfies Phase25SourceRefDto;

const phase25PolicyRef = {
  sourceType: "policy_note",
  sourceId: "phase25_policy_note_demo_001",
  sourceLabel: "Delegation risk gate policy note",
  required: true,
  stale: false
} as const satisfies Phase25SourceRefDto;

const phase25DecisionRef = {
  sourceType: "decision_context",
  sourceId: "decision_phase25_demo_001",
  sourceLabel: "High-impact customer validation decision",
  required: true,
  stale: false
} as const satisfies Phase25SourceRefDto;

const phase25FinalSourceRefs = [
  phase25BaselineRef,
  phase25CandidateRef,
  phase25PolicyRef,
  phase25DecisionRef
] as const satisfies readonly Phase25SourceRefDto[];

export const PHASE25_QUALITY_LIFT_REPORT_FIXTURE = {
  artifactId: "phase25_cmp_quality_lift_demo_001",
  kind: "ResearchQualityComparisonReport",
  schemaVersion: PHASE25_RESEARCH_COMPARISON_SCHEMA_VERSION,
  createdAt: "2026-05-12T00:00:00.000Z",
  createdBy: "product_engine",
  status: "quality_lift_ready",
  researchQuestion: "Which onboarding wedge should the solo founder validate first?",
  decisionContext: "Choose whether to build browser delegation preview before Phase 3 execution planning.",
  candidateLane: "manual_prompt_handoff",
  sourceRefs: phase25FinalSourceRefs,
  baseline: {
    baselineRef: "phase15a_baseline_demo_001",
    summary: "The Phase 1.5A baseline found public evidence but left the buyer objection and counter-signal unclear.",
    proEvidence: ["Founders want faster evidence gathering before committing to a build slice."],
    conEvidence: ["Manual source review still misses policy and session-risk objections."],
    uncertainties: ["Deep Research terms and session boundaries may prevent safe delegated use."],
    limitations: ["Baseline did not compare fallback behavior when delegated research is blocked."],
    sourceRefs: [phase25BaselineRef]
  },
  candidate: {
    candidateRef: "phase25_candidate_demo_001",
    lane: "manual_prompt_handoff",
    summary: "The candidate added policy risk, fallback, and decision-impact evidence without taking session custody.",
    proEvidence: ["Manual handoff can widen source coverage while leaving credentials with the user."],
    conEvidence: ["ChatGPT Pro delegation may be blocked by account/session policy for automated third-party service use."],
    uncertainties: ["Usage limits and plan settings can change, so the product needs visible fallback."],
    decisionImpacts: ["Build an Artifact+Gate core first; defer live adapter execution to a separately approved phase."],
    sourceTraceRefs: [phase25CandidateRef, phase25PolicyRef],
    staleRisk: "medium",
    policyNotes: ["No submit/write, credential custody, hidden browser action, or live adapter execution is permitted."]
  },
  delegationRiskGate: {
    verdict: "allowed_for_comparative_preview",
    candidateLane: "manual_prompt_handoff",
    checks: PHASE25_DELEGATION_RISK_GATE_CHECKS.map((checkName) => ({
      checkName,
      status: "pass",
      rationale: `${checkName} passes because this fixture is adapter-interface-only and user-mediated.`,
      sourceRefs: [phase25PolicyRef]
    })),
    blockedReasons: [],
    fallbackLane: "official_codex_fallback",
    noExecutionBoundary: PHASE25_NO_EXECUTION_BOUNDARY,
    rationale: "Manual handoff evidence is allowed for comparative preview because it keeps session custody with the user."
  },
  rubric: PHASE25_RESEARCH_QUALITY_RUBRIC_DIMENSIONS.map((dimension) => ({
    dimension,
    status: "pass",
    rationale: `${dimension} is represented with baseline comparison, source trace, safety, and decision impact.`,
    sourceRefs: [phase25BaselineRef, phase25CandidateRef, phase25PolicyRef]
  })),
  qualityLiftStatus: "material_quality_lift",
  qualityLiftClaimed: true,
  decisionImpactSummary: "Phase 2.5 should implement Artifact+Gate product code before any Phase 3 execution authority.",
  requiredFollowUps: ["Keep live browser/ChatGPT adapter execution behind a later explicit approval gate."],
  noExecutionPolicy: PHASE25_NO_EXECUTION_BOUNDARY
} as const satisfies Phase25ResearchQualityComparisonReportDto;

export const PHASE25_QUALITY_LIFT_PROJECTION_FIXTURE = {
  kind: "Phase25ResearchComparisonProjection",
  sessionId: phase25DemoSessionId,
  version: 1 as ProjectionVersion,
  currentStatus: "quality_lift_ready",
  artifact: PHASE25_QUALITY_LIFT_REPORT_FIXTURE,
  sourceRefs: PHASE25_QUALITY_LIFT_REPORT_FIXTURE.sourceRefs,
  summary: PHASE25_QUALITY_LIFT_REPORT_FIXTURE.decisionImpactSummary,
  refetchUrl: phase25DemoRefetchUrl
} as const satisfies Phase25ResearchComparisonProjection;

const phase25BlockedCandidateRef = {
  ...phase25CandidateRef,
  sourceId: "phase25_candidate_policy_blocked_demo_001",
  sourceLabel: "Blocked ChatGPT Pro delegation candidate"
} as const satisfies Phase25SourceRefDto;

export const PHASE25_SAFE_FAILURE_REPORT_FIXTURE = {
  ...PHASE25_QUALITY_LIFT_REPORT_FIXTURE,
  artifactId: "phase25_cmp_safe_failure_demo_001",
  createdAt: "2026-05-12T00:05:00.000Z",
  status: "safe_failure_blocked",
  candidateLane: "chatgpt_deep_research_preview",
  sourceRefs: [phase25BaselineRef, phase25BlockedCandidateRef, phase25PolicyRef, phase25DecisionRef],
  candidate: {
    ...PHASE25_QUALITY_LIFT_REPORT_FIXTURE.candidate,
    candidateRef: "phase25_candidate_policy_blocked_demo_001",
    lane: "chatgpt_deep_research_preview",
    summary: "The ChatGPT Pro candidate is blocked before quality lift can be claimed because policy/session custody risk is unresolved.",
    proEvidence: [],
    conEvidence: ["Delegated Pro account use may create policy and session-custody risk."],
    uncertainties: ["The user has not approved a live browser session or credential boundary."],
    decisionImpacts: ["Use manual handoff or official Codex fallback instead of live browser delegation."],
    sourceTraceRefs: [phase25BlockedCandidateRef, phase25PolicyRef],
    staleRisk: "high"
  },
  delegationRiskGate: {
    ...PHASE25_QUALITY_LIFT_REPORT_FIXTURE.delegationRiskGate,
    verdict: "blocked_by_session_custody",
    candidateLane: "chatgpt_deep_research_preview",
    checks: PHASE25_QUALITY_LIFT_REPORT_FIXTURE.delegationRiskGate.checks.map((check) =>
      check.checkName === "session_custody"
        ? {
            ...check,
            status: "block",
            rationale: "Session custody is unresolved, so ChatGPT Pro delegation cannot be treated as quality-lift evidence."
          }
        : check
    ),
    blockedReasons: ["Session custody is unresolved for ChatGPT Pro delegation."],
    fallbackLane: "manual_prompt_handoff",
    rationale: "The candidate fails safely: it records the policy risk and falls back without claiming quality lift."
  },
  rubric: PHASE25_QUALITY_LIFT_REPORT_FIXTURE.rubric.map((score) =>
    score.dimension === "baseline_lift"
      ? {
          ...score,
          status: "fail",
          rationale: "No quality lift may be claimed when the DelegationRiskGate blocks the candidate."
        }
      : score
  ),
  qualityLiftStatus: "safe_failure_no_lift",
  qualityLiftClaimed: false,
  decisionImpactSummary: "Do not implement live ChatGPT/browser delegation until session-custody risk is explicitly resolved.",
  requiredFollowUps: [
    "Use manual prompt handoff fallback for this research question.",
    "Keep Phase 3 execution planning closed until a separate approval exists."
  ]
} as const satisfies Phase25ResearchQualityComparisonReportDto;

export const PHASE25_SAFE_FAILURE_PROJECTION_FIXTURE = {
  kind: "Phase25ResearchComparisonProjection",
  sessionId: phase25DemoSessionId,
  version: 2 as ProjectionVersion,
  currentStatus: "safe_failure_blocked",
  artifact: PHASE25_SAFE_FAILURE_REPORT_FIXTURE,
  sourceRefs: PHASE25_SAFE_FAILURE_REPORT_FIXTURE.sourceRefs,
  summary: PHASE25_SAFE_FAILURE_REPORT_FIXTURE.decisionImpactSummary,
  refetchUrl: phase25DemoRefetchUrl
} as const satisfies Phase25ResearchComparisonProjection;
