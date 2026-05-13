import type { ProjectionVersion, SchemaVersion, SessionId } from "../ids";

export const IMPLEMENTATION_STEP_LEDGER_SCHEMA_VERSION =
  "solo-superman.implementation-step-ledger.v1" as SchemaVersion;

export const IMPLEMENTATION_STEP_STATUSES = [
  "planned",
  "ready",
  "implementing",
  "committed",
  "review_required",
  "clean_code_review_required",
  "tests_required",
  "blocked",
  "completed"
] as const;

export type ImplementationStepStatus = (typeof IMPLEMENTATION_STEP_STATUSES)[number];

export const IMPLEMENTATION_REVIEW_VERDICTS = ["passed", "changes_requested", "blocked"] as const;
export type ImplementationReviewVerdict = (typeof IMPLEMENTATION_REVIEW_VERDICTS)[number];

export const IMPLEMENTATION_TEST_OUTCOMES = ["passed", "failed", "not_run"] as const;
export type ImplementationTestOutcome = (typeof IMPLEMENTATION_TEST_OUTCOMES)[number];

export interface TrackerDoc {
  readonly trackerId: string;
  readonly title: string;
  readonly goal: string;
  readonly sourceRefs: readonly string[];
}

export interface ImplementationStepDoc {
  readonly stepId: string;
  readonly title: string;
  readonly description: string;
  readonly sourceRefs: readonly string[];
  readonly expectedChangeScope: "tracked_code_docs_config" | "verification_only" | "no_op_review";
}

export interface StepCommitRecord {
  readonly stepId: string;
  readonly commitSha: string;
  readonly previousCommitSha: string;
  readonly diffRange: string;
  readonly changedFiles: readonly string[];
  readonly rollbackRef: string;
  readonly evidenceRefs: readonly string[];
}

export interface NoCodeStepEvidence {
  readonly stepId: string;
  readonly baselineCommitSha: string;
  readonly cleanTrackedState: boolean;
  readonly intendedTrackedDiff: "none";
  readonly noCodeReason: string;
  readonly commandEvidenceRefs: readonly string[];
  readonly notTestedGaps: readonly string[];
}

export interface CodeReviewRecord {
  readonly stepId: string;
  readonly reviewId: string;
  readonly reviewer: string;
  readonly verdict: ImplementationReviewVerdict;
  readonly comparedFromCommitSha: string;
  readonly comparedToCommitSha: string;
  readonly findings: readonly string[];
  readonly evidenceRefs: readonly string[];
}

export interface CleanCodeReviewRecord {
  readonly stepId: string;
  readonly reviewId: string;
  readonly reviewer: string;
  readonly verdict: ImplementationReviewVerdict;
  readonly comparedFromCommitSha: string;
  readonly comparedToCommitSha: string;
  readonly simplifications: readonly string[];
  readonly evidenceRefs: readonly string[];
}

export interface TestEvidenceRecord {
  readonly stepId: string;
  readonly testEvidenceId: string;
  readonly commands: readonly string[];
  readonly outcome: ImplementationTestOutcome;
  readonly verifiedCommitSha?: string;
  readonly passedTestCount: number;
  readonly failedTestCount: number;
  readonly notTestedGaps: readonly string[];
  readonly evidenceRefs: readonly string[];
}

export interface ImplementationStepBlocker {
  readonly stepId: string;
  readonly reason: string;
  readonly missingEvidence: readonly string[];
  readonly nextRequiredAction: string;
  readonly evidenceRefs: readonly string[];
}

export interface ImplementationStepRecord {
  readonly stepDoc: ImplementationStepDoc;
  readonly status: ImplementationStepStatus;
  readonly missingEvidence: readonly string[];
  readonly blocker: ImplementationStepBlocker | null;
  readonly evidenceRefs: readonly string[];
  readonly updatedAt: string;
  readonly stepCommitRecord: StepCommitRecord | null;
  readonly noCodeStepEvidence: NoCodeStepEvidence | null;
  readonly codeReviewRecord: CodeReviewRecord | null;
  readonly cleanCodeReviewRecord: CleanCodeReviewRecord | null;
  readonly testEvidenceRecord: TestEvidenceRecord | null;
}

export interface ImplementationStepLedgerProjection {
  readonly kind: "ImplementationStepLedgerProjection";
  readonly sessionId: SessionId;
  readonly version: ProjectionVersion;
  readonly currentStatus: ImplementationStepStatus;
  readonly trackerDoc: TrackerDoc;
  readonly steps: readonly ImplementationStepRecord[];
  readonly stepCommitRecords: readonly StepCommitRecord[];
  readonly noCodeStepEvidenceRecords: readonly NoCodeStepEvidence[];
  readonly codeReviewRecords: readonly CodeReviewRecord[];
  readonly cleanCodeReviewRecords: readonly CleanCodeReviewRecord[];
  readonly testEvidenceRecords: readonly TestEvidenceRecord[];
  readonly blockedSteps: readonly ImplementationStepBlocker[];
  readonly progressReport: string;
  readonly summary: string;
  readonly refetchUrl: string;
  readonly schemaVersion: SchemaVersion;
}

export interface RecordImplementationStepLedgerPayload {
  readonly trackerDoc: TrackerDoc;
  readonly stepDoc: ImplementationStepDoc;
  readonly targetStatus: ImplementationStepStatus;
  readonly startedEvidenceRefs?: readonly string[];
  readonly stepCommitRecord?: StepCommitRecord;
  readonly noCodeStepEvidence?: NoCodeStepEvidence;
  readonly codeReviewRecord?: CodeReviewRecord;
  readonly cleanCodeReviewRecord?: CleanCodeReviewRecord;
  readonly testEvidenceRecord?: TestEvidenceRecord;
  readonly blocker?: ImplementationStepBlocker;
  readonly evidenceRefs?: readonly string[];
}

export class ImplementationStepLedgerValidationError extends Error {
  constructor(readonly issues: readonly string[]) {
    super(`Invalid ImplementationStepLedgerProjection: ${issues.join("; ")}`);
    this.name = "ImplementationStepLedgerValidationError";
  }
}

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function stringArray(value: unknown): value is readonly string[] {
  return Array.isArray(value) && value.every(isNonEmptyString);
}

function isOneOf<TValue extends string>(value: unknown, allowedValues: readonly TValue[]): value is TValue {
  return typeof value === "string" && allowedValues.includes(value as TValue);
}

function isCommitSha(value: string) {
  return /^[a-f0-9]{7,64}$/iu.test(value);
}

function isTrackerDoc(value: unknown): value is TrackerDoc {
  return isRecord(value) &&
    isNonEmptyString(value.trackerId) &&
    isNonEmptyString(value.title) &&
    isNonEmptyString(value.goal) &&
    stringArray(value.sourceRefs) &&
    value.sourceRefs.length > 0;
}

function isStepDoc(value: unknown): value is ImplementationStepDoc {
  return isRecord(value) &&
    isNonEmptyString(value.stepId) &&
    isNonEmptyString(value.title) &&
    isNonEmptyString(value.description) &&
    stringArray(value.sourceRefs) &&
    value.sourceRefs.length > 0 &&
    isOneOf(value.expectedChangeScope, ["tracked_code_docs_config", "verification_only", "no_op_review"] as const);
}

function isStepCommitRecord(value: unknown): value is StepCommitRecord {
  return isRecord(value) &&
    isNonEmptyString(value.stepId) &&
    isNonEmptyString(value.commitSha) &&
    isCommitSha(value.commitSha) &&
    isNonEmptyString(value.previousCommitSha) &&
    isCommitSha(value.previousCommitSha) &&
    isNonEmptyString(value.diffRange) &&
    value.diffRange.includes("..") &&
    stringArray(value.changedFiles) &&
    value.changedFiles.length > 0 &&
    isNonEmptyString(value.rollbackRef) &&
    stringArray(value.evidenceRefs) &&
    value.evidenceRefs.length > 0;
}

function isNoCodeStepEvidence(value: unknown): value is NoCodeStepEvidence {
  return isRecord(value) &&
    isNonEmptyString(value.stepId) &&
    isNonEmptyString(value.baselineCommitSha) &&
    isCommitSha(value.baselineCommitSha) &&
    typeof value.cleanTrackedState === "boolean" &&
    value.intendedTrackedDiff === "none" &&
    isNonEmptyString(value.noCodeReason) &&
    stringArray(value.commandEvidenceRefs) &&
    value.commandEvidenceRefs.length > 0 &&
    stringArray(value.notTestedGaps);
}

function isCodeReviewRecord(value: unknown): value is CodeReviewRecord {
  return isRecord(value) &&
    isNonEmptyString(value.stepId) &&
    isNonEmptyString(value.reviewId) &&
    isNonEmptyString(value.reviewer) &&
    isOneOf(value.verdict, IMPLEMENTATION_REVIEW_VERDICTS) &&
    isNonEmptyString(value.comparedFromCommitSha) &&
    isCommitSha(value.comparedFromCommitSha) &&
    isNonEmptyString(value.comparedToCommitSha) &&
    isCommitSha(value.comparedToCommitSha) &&
    stringArray(value.findings) &&
    stringArray(value.evidenceRefs) &&
    value.evidenceRefs.length > 0;
}

function isCleanCodeReviewRecord(value: unknown): value is CleanCodeReviewRecord {
  return isRecord(value) &&
    isNonEmptyString(value.stepId) &&
    isNonEmptyString(value.reviewId) &&
    isNonEmptyString(value.reviewer) &&
    isOneOf(value.verdict, IMPLEMENTATION_REVIEW_VERDICTS) &&
    isNonEmptyString(value.comparedFromCommitSha) &&
    isCommitSha(value.comparedFromCommitSha) &&
    isNonEmptyString(value.comparedToCommitSha) &&
    isCommitSha(value.comparedToCommitSha) &&
    stringArray(value.simplifications) &&
    stringArray(value.evidenceRefs) &&
    value.evidenceRefs.length > 0;
}

function isTestEvidenceRecord(value: unknown): value is TestEvidenceRecord {
  return isRecord(value) &&
    isNonEmptyString(value.stepId) &&
    isNonEmptyString(value.testEvidenceId) &&
    stringArray(value.commands) &&
    value.commands.length > 0 &&
    isOneOf(value.outcome, IMPLEMENTATION_TEST_OUTCOMES) &&
    (value.verifiedCommitSha === undefined || (isNonEmptyString(value.verifiedCommitSha) && isCommitSha(value.verifiedCommitSha))) &&
    typeof value.passedTestCount === "number" &&
    value.passedTestCount >= 0 &&
    typeof value.failedTestCount === "number" &&
    value.failedTestCount >= 0 &&
    stringArray(value.notTestedGaps) &&
    stringArray(value.evidenceRefs) &&
    value.evidenceRefs.length > 0;
}

function isBlocker(value: unknown): value is ImplementationStepBlocker {
  return isRecord(value) &&
    isNonEmptyString(value.stepId) &&
    isNonEmptyString(value.reason) &&
    stringArray(value.missingEvidence) &&
    value.missingEvidence.length > 0 &&
    isNonEmptyString(value.nextRequiredAction) &&
    stringArray(value.evidenceRefs) &&
    value.evidenceRefs.length > 0;
}

function hasImplementationEvidence(step: ImplementationStepRecord) {
  return Boolean(step.stepCommitRecord || step.noCodeStepEvidence);
}

function reviewPassed(record: CodeReviewRecord | CleanCodeReviewRecord | null) {
  return record?.verdict === "passed";
}

function testsPassed(record: TestEvidenceRecord | null) {
  return Boolean(record && record.outcome === "passed" && record.passedTestCount > 0 && record.failedTestCount === 0 && record.notTestedGaps.length === 0);
}

function reviewMatchesStepBounds(
  review: CodeReviewRecord | CleanCodeReviewRecord | null,
  step: ImplementationStepRecord
) {
  if (!review) {
    return true;
  }

  if (step.stepCommitRecord) {
    return review.comparedFromCommitSha === step.stepCommitRecord.previousCommitSha &&
      review.comparedToCommitSha === step.stepCommitRecord.commitSha;
  }

  if (step.noCodeStepEvidence) {
    return review.comparedFromCommitSha === step.noCodeStepEvidence.baselineCommitSha &&
      review.comparedToCommitSha === step.noCodeStepEvidence.baselineCommitSha;
  }

  return true;
}

function completedEvidenceMissing(step: ImplementationStepRecord) {
  const missing: string[] = [];

  if (!hasImplementationEvidence(step)) {
    missing.push(step.stepDoc.expectedChangeScope === "tracked_code_docs_config" ? "StepCommitRecord" : "StepCommitRecord or NoCodeStepEvidence");
  }
  if (step.noCodeStepEvidence && (!step.noCodeStepEvidence.cleanTrackedState || step.noCodeStepEvidence.notTestedGaps.length > 0)) {
    missing.push("clean no-code evidence without Not-tested gaps");
  }
  if (!reviewPassed(step.codeReviewRecord)) {
    missing.push("passing CodeReviewRecord");
  }
  if (!reviewPassed(step.cleanCodeReviewRecord)) {
    missing.push("passing CleanCodeReviewRecord");
  }
  if (!testsPassed(step.testEvidenceRecord)) {
    missing.push("passing TestEvidenceRecord without Not-tested gaps");
  }

  return missing;
}

function implementationStepSummaryForStatus(status: ImplementationStepStatus) {
  switch (status) {
    case "planned":
      return "Implementation step is planned.";
    case "ready":
      return "Implementation step is ready with documented inputs.";
    case "implementing":
      return "Implementation step is in progress.";
    case "committed":
      return "Implementation step has a local commit record.";
    case "review_required":
      return "Implementation step is waiting for code review.";
    case "clean_code_review_required":
      return "Implementation step is waiting for clean-code review.";
    case "tests_required":
      return "Implementation step is waiting for test evidence.";
    case "blocked":
      return "Implementation step ledger is blocked by missing or failed evidence.";
    case "completed":
      return "Implementation step is completed with commit/review/test evidence.";
  }
}

export function implementationStepLedgerProgressReport(projection: ImplementationStepLedgerProjection) {
  const lines = [
    `Tracker: ${projection.trackerDoc.title}`,
    `Summary: ${projection.summary}`,
    ...projection.steps.map((step, index) => {
      const missing = step.missingEvidence.length ? ` Missing: ${step.missingEvidence.join(", ")}.` : "";
      const tests = step.testEvidenceRecord
        ? ` Tests: ${step.testEvidenceRecord.outcome} (${step.testEvidenceRecord.commands.join(" | ")}).`
        : " Tests: not recorded.";

      return `${index + 1}. ${step.stepDoc.title} — ${step.status}.${missing}${tests}`;
    }),
    ...projection.blockedSteps.map((blocker) =>
      `Blocked history: ${blocker.stepId} — ${blocker.reason} Missing: ${blocker.missingEvidence.join(", ")}. Next: ${blocker.nextRequiredAction}`
    )
  ];

  return lines.join("\n");
}

export function validateImplementationStepLedgerProjection(
  projection: ImplementationStepLedgerProjection
): ImplementationStepLedgerProjection {
  const issues: string[] = [];
  const latestStep = projection.steps.at(-1);

  if (projection.kind !== "ImplementationStepLedgerProjection") {
    issues.push("kind must be ImplementationStepLedgerProjection");
  }
  if (!isTrackerDoc(projection.trackerDoc)) {
    issues.push("trackerDoc must include title, goal, and source refs");
  }
  if (!projection.steps.length || !latestStep) {
    issues.push("steps must include at least one ImplementationStepRecord");
  }
  if (!isOneOf(projection.currentStatus, IMPLEMENTATION_STEP_STATUSES)) {
    issues.push("currentStatus must be an ImplementationStepStatus");
  }
  if (latestStep && projection.currentStatus !== latestStep.status) {
    issues.push("currentStatus must match the newest implementation step status");
  }
  if (projection.summary !== implementationStepSummaryForStatus(projection.currentStatus)) {
    issues.push("summary must match currentStatus");
  }
  if (!isNonEmptyString(projection.progressReport)) {
    issues.push("progressReport must be user-readable text");
  }

  for (const step of projection.steps) {
    if (!isStepDoc(step.stepDoc)) {
      issues.push("stepDoc must be a valid ImplementationStepDoc");
      continue;
    }
    if (!isOneOf(step.status, IMPLEMENTATION_STEP_STATUSES)) {
      issues.push("step status must be valid");
    }
    if (!stringArray(step.missingEvidence) || !stringArray(step.evidenceRefs) || step.evidenceRefs.length === 0) {
      issues.push("step evidenceRefs and missingEvidence must be visible arrays");
    }
    if (!isNonEmptyString(step.updatedAt)) {
      issues.push("step updatedAt is required");
    }
    if (step.stepCommitRecord !== null && !isStepCommitRecord(step.stepCommitRecord)) {
      issues.push("stepCommitRecord must include commit SHA, previous commit, diff range, rollback ref, and evidence");
    }
    if (
      step.stepCommitRecord !== null &&
      step.stepCommitRecord.diffRange !== `${step.stepCommitRecord.previousCommitSha}..${step.stepCommitRecord.commitSha}`
    ) {
      issues.push("StepCommitRecord diffRange must equal previousCommitSha..commitSha");
    }
    if (step.noCodeStepEvidence !== null && !isNoCodeStepEvidence(step.noCodeStepEvidence)) {
      issues.push("NoCodeStepEvidence must include baseline commit, clean tracked state, no-code reason, command evidence, and Not-tested gaps");
    }
    if (step.codeReviewRecord !== null && !isCodeReviewRecord(step.codeReviewRecord)) {
      issues.push("CodeReviewRecord must be valid and separate from clean-code review");
    }
    if (step.cleanCodeReviewRecord !== null && !isCleanCodeReviewRecord(step.cleanCodeReviewRecord)) {
      issues.push("CleanCodeReviewRecord must be valid and separate from code review");
    }
    if (step.testEvidenceRecord !== null && !isTestEvidenceRecord(step.testEvidenceRecord)) {
      issues.push("TestEvidenceRecord must include commands, outcome, counts, Not-tested gaps, and evidence refs");
    }
    if (step.testEvidenceRecord && step.stepCommitRecord && step.testEvidenceRecord.verifiedCommitSha !== step.stepCommitRecord.commitSha) {
      issues.push("TestEvidenceRecord verifiedCommitSha must match StepCommitRecord commitSha");
    }
    if (step.testEvidenceRecord && step.noCodeStepEvidence && step.testEvidenceRecord.verifiedCommitSha !== step.noCodeStepEvidence.baselineCommitSha) {
      issues.push("TestEvidenceRecord verifiedCommitSha must match NoCodeStepEvidence baselineCommitSha");
    }
    if (step.codeReviewRecord && step.cleanCodeReviewRecord && step.codeReviewRecord.reviewId === step.cleanCodeReviewRecord.reviewId) {
      issues.push("CodeReviewRecord and CleanCodeReviewRecord must be separate records");
    }
    if (!reviewMatchesStepBounds(step.codeReviewRecord, step) || !reviewMatchesStepBounds(step.cleanCodeReviewRecord, step)) {
      issues.push("review records must compare the previous step commit to the step commit or no-code baseline");
    }
    if (step.blocker !== null && !isBlocker(step.blocker)) {
      issues.push("blocked step must include blocker reason, missing evidence, next action, and evidence refs");
    }
    if (step.status === "completed") {
      const missing = completedEvidenceMissing(step);

      if (missing.length > 0) {
        issues.push(`completed step is missing required evidence: ${missing.join(", ")}`);
      }
      if (step.stepDoc.expectedChangeScope === "tracked_code_docs_config" && !step.stepCommitRecord) {
        issues.push("tracked code/docs/config steps cannot complete without StepCommitRecord");
      }
    }
    if (step.status === "blocked" && (!step.blocker || step.missingEvidence.length === 0)) {
      issues.push("blocked steps must preserve missing evidence and next required action");
    }
  }

  const stepIds = new Set(projection.steps.map((step) => step.stepDoc.stepId));

  for (const record of projection.stepCommitRecords) {
    if (!isStepCommitRecord(record) || !stepIds.has(record.stepId)) {
      issues.push("stepCommitRecords must point to known steps");
    }
  }
  for (const record of projection.noCodeStepEvidenceRecords) {
    if (!isNoCodeStepEvidence(record) || !stepIds.has(record.stepId)) {
      issues.push("noCodeStepEvidenceRecords must point to known steps");
    }
  }
  for (const record of projection.codeReviewRecords) {
    if (!isCodeReviewRecord(record) || !stepIds.has(record.stepId)) {
      issues.push("codeReviewRecords must point to known steps");
    }
  }
  for (const record of projection.cleanCodeReviewRecords) {
    if (!isCleanCodeReviewRecord(record) || !stepIds.has(record.stepId)) {
      issues.push("cleanCodeReviewRecords must point to known steps");
    }
  }
  for (const record of projection.testEvidenceRecords) {
    if (!isTestEvidenceRecord(record) || !stepIds.has(record.stepId)) {
      issues.push("testEvidenceRecords must point to known steps");
    }
  }

  if (issues.length) {
    throw new ImplementationStepLedgerValidationError(issues);
  }

  return projection;
}

export const IMPLEMENTATION_STEP_LEDGER_READY_FIXTURE: ImplementationStepLedgerProjection =
  validateImplementationStepLedgerProjection({
    kind: "ImplementationStepLedgerProjection",
    sessionId: "demo-session" as SessionId,
    version: 1 as ProjectionVersion,
    currentStatus: "completed",
    trackerDoc: {
      trackerId: "tracker_demo",
      title: "Demo implementation tracker",
      goal: "Ship a reviewed implementation step with evidence.",
      sourceRefs: ["issue:104"]
    },
    steps: [
      {
        stepDoc: {
          stepId: "step_demo",
          title: "Create deterministic ledger",
          description: "Record implementation, reviews, and tests.",
          sourceRefs: ["issue:104"],
          expectedChangeScope: "tracked_code_docs_config"
        },
        status: "completed",
        missingEvidence: [],
        blocker: null,
        evidenceRefs: ["commit:abcdef1", "review:code", "review:clean", "test:verify"],
        updatedAt: "2026-05-13T00:00:00.000Z",
        stepCommitRecord: {
          stepId: "step_demo",
          commitSha: "abcdef1",
          previousCommitSha: "1234567",
          diffRange: "1234567..abcdef1",
          changedFiles: ["packages/core/src/product-engine/index.ts"],
          rollbackRef: "rollback:git-revert:abcdef1",
          evidenceRefs: ["commit:abcdef1"]
        },
        noCodeStepEvidence: null,
        codeReviewRecord: {
          stepId: "step_demo",
          reviewId: "review_code_demo",
          reviewer: "codex-code-reviewer",
          verdict: "passed",
          comparedFromCommitSha: "1234567",
          comparedToCommitSha: "abcdef1",
          findings: [],
          evidenceRefs: ["review:code"]
        },
        cleanCodeReviewRecord: {
          stepId: "step_demo",
          reviewId: "review_clean_demo",
          reviewer: "codex-clean-code-reviewer",
          verdict: "passed",
          comparedFromCommitSha: "1234567",
          comparedToCommitSha: "abcdef1",
          simplifications: ["reused existing projection pattern"],
          evidenceRefs: ["review:clean"]
        },
        testEvidenceRecord: {
          stepId: "step_demo",
          testEvidenceId: "test_verify_demo",
          commands: ["pnpm verify"],
          outcome: "passed",
          verifiedCommitSha: "abcdef1",
          passedTestCount: 10,
          failedTestCount: 0,
          notTestedGaps: [],
          evidenceRefs: ["test:verify"]
        }
      }
    ],
    stepCommitRecords: [
      {
        stepId: "step_demo",
        commitSha: "abcdef1",
        previousCommitSha: "1234567",
        diffRange: "1234567..abcdef1",
        changedFiles: ["packages/core/src/product-engine/index.ts"],
        rollbackRef: "rollback:git-revert:abcdef1",
        evidenceRefs: ["commit:abcdef1"]
      }
    ],
    noCodeStepEvidenceRecords: [],
    codeReviewRecords: [
      {
        stepId: "step_demo",
        reviewId: "review_code_demo",
        reviewer: "codex-code-reviewer",
        verdict: "passed",
        comparedFromCommitSha: "1234567",
        comparedToCommitSha: "abcdef1",
        findings: [],
        evidenceRefs: ["review:code"]
      }
    ],
    cleanCodeReviewRecords: [
      {
        stepId: "step_demo",
        reviewId: "review_clean_demo",
        reviewer: "codex-clean-code-reviewer",
        verdict: "passed",
        comparedFromCommitSha: "1234567",
        comparedToCommitSha: "abcdef1",
        simplifications: ["reused existing projection pattern"],
        evidenceRefs: ["review:clean"]
      }
    ],
    testEvidenceRecords: [
      {
        stepId: "step_demo",
        testEvidenceId: "test_verify_demo",
        commands: ["pnpm verify"],
        outcome: "passed",
        verifiedCommitSha: "abcdef1",
        passedTestCount: 10,
        failedTestCount: 0,
        notTestedGaps: [],
        evidenceRefs: ["test:verify"]
      }
    ],
    blockedSteps: [],
    progressReport: [
      "Tracker: Demo implementation tracker",
      "Summary: Implementation step is completed with commit/review/test evidence.",
      "1. Create deterministic ledger — completed. Tests: passed (pnpm verify)."
    ].join("\n"),
    summary: implementationStepSummaryForStatus("completed"),
    refetchUrl: "/api/v1/sessions/demo-session/implementation-step-ledger",
    schemaVersion: IMPLEMENTATION_STEP_LEDGER_SCHEMA_VERSION
  });
