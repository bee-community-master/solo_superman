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

export const IMPLEMENTATION_CODE_REVIEW_SCOPES = ["feature", "repository"] as const;
export type ImplementationCodeReviewScope = (typeof IMPLEMENTATION_CODE_REVIEW_SCOPES)[number];

export const IMPLEMENTATION_CLEAN_CODE_REVIEW_SCOPES = ["changed_code", "repository"] as const;
export type ImplementationCleanCodeReviewScope = (typeof IMPLEMENTATION_CLEAN_CODE_REVIEW_SCOPES)[number];

export const IMPLEMENTATION_REQUIRED_NO_FINDING_REVIEW_STREAK = 2;

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
  readonly reviewScope: ImplementationCodeReviewScope;
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
  readonly reviewScope: ImplementationCleanCodeReviewScope;
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

export interface CodeReviewStreakRecord {
  readonly reviewScope: ImplementationCodeReviewScope;
  readonly requiredNoFindingPasses: typeof IMPLEMENTATION_REQUIRED_NO_FINDING_REVIEW_STREAK;
  readonly currentNoFindingPasses: number;
  readonly satisfied: boolean;
  readonly latestReviewIds: readonly string[];
  readonly missingEvidenceLabel: string;
}

export interface CleanCodeReviewStreakRecord {
  readonly reviewScope: ImplementationCleanCodeReviewScope;
  readonly requiredNoFindingPasses: typeof IMPLEMENTATION_REQUIRED_NO_FINDING_REVIEW_STREAK;
  readonly currentNoFindingPasses: number;
  readonly satisfied: boolean;
  readonly latestReviewIds: readonly string[];
  readonly missingEvidenceLabel: string;
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
  readonly codeReviewStreaks: readonly CodeReviewStreakRecord[];
  readonly cleanCodeReviewStreaks: readonly CleanCodeReviewStreakRecord[];
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

function sameStringArray(left: readonly string[], right: readonly string[]) {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

function sameImplementationStepDoc(left: ImplementationStepDoc, right: ImplementationStepDoc) {
  return left.stepId === right.stepId &&
    left.title === right.title &&
    left.description === right.description &&
    left.expectedChangeScope === right.expectedChangeScope &&
    sameStringArray(left.sourceRefs, right.sourceRefs);
}

function isOneOf<TValue extends string>(value: unknown, allowedValues: readonly TValue[]): value is TValue {
  return typeof value === "string" && allowedValues.includes(value as TValue);
}

function isCommitSha(value: string) {
  return /^[a-f0-9]{7,64}$/iu.test(value);
}

function isNonNegativeInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0;
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
    isOneOf(value.reviewScope, IMPLEMENTATION_CODE_REVIEW_SCOPES) &&
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
    isOneOf(value.reviewScope, IMPLEMENTATION_CLEAN_CODE_REVIEW_SCOPES) &&
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
    isNonNegativeInteger(value.passedTestCount) &&
    isNonNegativeInteger(value.failedTestCount) &&
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

function isCodeReviewStreakRecord(value: unknown): value is CodeReviewStreakRecord {
  return isRecord(value) &&
    isOneOf(value.reviewScope, IMPLEMENTATION_CODE_REVIEW_SCOPES) &&
    value.requiredNoFindingPasses === IMPLEMENTATION_REQUIRED_NO_FINDING_REVIEW_STREAK &&
    typeof value.currentNoFindingPasses === "number" &&
    Number.isInteger(value.currentNoFindingPasses) &&
    value.currentNoFindingPasses >= 0 &&
    typeof value.satisfied === "boolean" &&
    stringArray(value.latestReviewIds) &&
    isNonEmptyString(value.missingEvidenceLabel);
}

function isCleanCodeReviewStreakRecord(value: unknown): value is CleanCodeReviewStreakRecord {
  return isRecord(value) &&
    isOneOf(value.reviewScope, IMPLEMENTATION_CLEAN_CODE_REVIEW_SCOPES) &&
    value.requiredNoFindingPasses === IMPLEMENTATION_REQUIRED_NO_FINDING_REVIEW_STREAK &&
    typeof value.currentNoFindingPasses === "number" &&
    Number.isInteger(value.currentNoFindingPasses) &&
    value.currentNoFindingPasses >= 0 &&
    typeof value.satisfied === "boolean" &&
    stringArray(value.latestReviewIds) &&
    isNonEmptyString(value.missingEvidenceLabel);
}

function topLevelRecordStepId(value: unknown) {
  return isRecord(value) && typeof value.stepId === "string" ? value.stepId : null;
}

function topLevelStepRecordIssues(
  records: readonly unknown[],
  isValid: (value: unknown) => boolean,
  stepIds: ReadonlySet<string>,
  issue: string
) {
  return records.flatMap((record) => {
    const stepId = topLevelRecordStepId(record);

    return isValid(record) && stepId && stepIds.has(stepId) ? [] : [issue];
  });
}

function hasImplementationEvidence(step: ImplementationStepRecord) {
  return Boolean(step.stepCommitRecord || step.noCodeStepEvidence);
}

function reviewPassed(record: CodeReviewRecord | CleanCodeReviewRecord | null) {
  return record?.verdict === "passed";
}

function codeReviewNoFindingPassed(record: CodeReviewRecord) {
  return record.verdict === "passed" && record.findings.length === 0;
}

function cleanCodeReviewNoFindingPassed(record: CleanCodeReviewRecord) {
  return record.verdict === "passed" && record.simplifications.length === 0;
}

function latestNoFindingReviewIds<TRecord extends { readonly reviewId: string }>(
  records: readonly TRecord[],
  noFindingPassed: (record: TRecord) => boolean
) {
  const reviewIds: string[] = [];

  for (const record of [...records].reverse()) {
    if (!noFindingPassed(record)) {
      break;
    }

    reviewIds.unshift(record.reviewId);
  }

  return reviewIds.slice(-IMPLEMENTATION_REQUIRED_NO_FINDING_REVIEW_STREAK);
}

function uniqueReviewRecordsById<TRecord extends { readonly reviewId: string }>(records: readonly TRecord[]) {
  const byId = new Map<string, TRecord>();

  for (const record of records) {
    byId.set(record.reviewId, record);
  }

  return [...byId.values()];
}

function reviewStreaksForScopes<
  TScope extends string,
  TRecord extends { readonly reviewId: string; readonly reviewScope: TScope }
>(
  records: readonly TRecord[],
  reviewScopes: readonly TScope[],
  noFindingPassed: (record: TRecord) => boolean,
  reviewLabel: string
): readonly {
  readonly reviewScope: TScope;
  readonly requiredNoFindingPasses: typeof IMPLEMENTATION_REQUIRED_NO_FINDING_REVIEW_STREAK;
  readonly currentNoFindingPasses: number;
  readonly satisfied: boolean;
  readonly latestReviewIds: readonly string[];
  readonly missingEvidenceLabel: string;
}[] {
  const uniqueRecords = uniqueReviewRecordsById(records);

  return reviewScopes.map((reviewScope) => {
    const scopedRecords = uniqueRecords.filter((record) => record.reviewScope === reviewScope);
    const latestReviewIds = latestNoFindingReviewIds(scopedRecords, noFindingPassed);
    const currentNoFindingPasses = latestReviewIds.length;

    return {
      reviewScope,
      requiredNoFindingPasses: IMPLEMENTATION_REQUIRED_NO_FINDING_REVIEW_STREAK,
      currentNoFindingPasses,
      satisfied: currentNoFindingPasses >= IMPLEMENTATION_REQUIRED_NO_FINDING_REVIEW_STREAK,
      latestReviewIds,
      missingEvidenceLabel: `${reviewScope} ${reviewLabel} requires ${IMPLEMENTATION_REQUIRED_NO_FINDING_REVIEW_STREAK} consecutive no-finding passes`
    };
  });
}

export function implementationCodeReviewStreaks(
  records: readonly CodeReviewRecord[]
): readonly CodeReviewStreakRecord[] {
  return reviewStreaksForScopes(
    records,
    IMPLEMENTATION_CODE_REVIEW_SCOPES,
    codeReviewNoFindingPassed,
    "code review"
  );
}

export function implementationCleanCodeReviewStreaks(
  records: readonly CleanCodeReviewRecord[]
): readonly CleanCodeReviewStreakRecord[] {
  return reviewStreaksForScopes(
    records,
    IMPLEMENTATION_CLEAN_CODE_REVIEW_SCOPES,
    cleanCodeReviewNoFindingPassed,
    "clean-code review"
  );
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
  if (!reviewPassed(step.codeReviewRecord) || !step.codeReviewStreaks.every((streak) => streak.satisfied)) {
    missing.push("two consecutive no-finding CodeReviewRecord passes for feature and repository scopes");
  }
  if (!reviewPassed(step.cleanCodeReviewRecord) || !step.cleanCodeReviewStreaks.every((streak) => streak.satisfied)) {
    missing.push("two consecutive no-finding CleanCodeReviewRecord passes for changed-code and repository scopes");
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
      const codeReviewStreaks = step.codeReviewStreaks
        .map((streak) => `${streak.reviewScope} code ${streak.currentNoFindingPasses}/${streak.requiredNoFindingPasses}`)
        .join(", ");
      const cleanCodeReviewStreaks = step.cleanCodeReviewStreaks
        .map((streak) => `${streak.reviewScope} clean ${streak.currentNoFindingPasses}/${streak.requiredNoFindingPasses}`)
        .join(", ");

      return `${index + 1}. ${step.stepDoc.title} — ${step.status}.${missing}${tests} Review streaks: ${codeReviewStreaks}; ${cleanCodeReviewStreaks}.`;
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
  const latestStepById = new Map<string, ImplementationStepRecord>();

  for (const step of projection.steps) {
    if (isStepDoc(step.stepDoc)) {
      latestStepById.set(step.stepDoc.stepId, step);
    }
  }

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
    if (step.stepCommitRecord !== null && step.stepCommitRecord.stepId !== step.stepDoc.stepId) {
      issues.push("stepCommitRecord must match its ImplementationStepDoc stepId");
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
    if (step.noCodeStepEvidence !== null && step.noCodeStepEvidence.stepId !== step.stepDoc.stepId) {
      issues.push("NoCodeStepEvidence must match its ImplementationStepDoc stepId");
    }
    if (step.codeReviewRecord !== null && !isCodeReviewRecord(step.codeReviewRecord)) {
      issues.push("CodeReviewRecord must be valid and separate from clean-code review");
    }
    if (step.codeReviewRecord !== null && step.codeReviewRecord.stepId !== step.stepDoc.stepId) {
      issues.push("CodeReviewRecord must match its ImplementationStepDoc stepId");
    }
    if (step.cleanCodeReviewRecord !== null && !isCleanCodeReviewRecord(step.cleanCodeReviewRecord)) {
      issues.push("CleanCodeReviewRecord must be valid and separate from code review");
    }
    if (step.cleanCodeReviewRecord !== null && step.cleanCodeReviewRecord.stepId !== step.stepDoc.stepId) {
      issues.push("CleanCodeReviewRecord must match its ImplementationStepDoc stepId");
    }
    if (
      !Array.isArray(step.codeReviewStreaks) ||
      step.codeReviewStreaks.length !== IMPLEMENTATION_CODE_REVIEW_SCOPES.length ||
      !step.codeReviewStreaks.every(isCodeReviewStreakRecord)
    ) {
      issues.push("codeReviewStreaks must cover feature and repository no-finding streaks");
    }
    if (
      !Array.isArray(step.cleanCodeReviewStreaks) ||
      step.cleanCodeReviewStreaks.length !== IMPLEMENTATION_CLEAN_CODE_REVIEW_SCOPES.length ||
      !step.cleanCodeReviewStreaks.every(isCleanCodeReviewStreakRecord)
    ) {
      issues.push("cleanCodeReviewStreaks must cover changed-code and repository no-finding streaks");
    }
    const expectedCodeStreaks = implementationCodeReviewStreaks(
      projection.codeReviewRecords.filter((record) => record.stepId === step.stepDoc.stepId)
    );
    const expectedCleanCodeStreaks = implementationCleanCodeReviewStreaks(
      projection.cleanCodeReviewRecords.filter((record) => record.stepId === step.stepDoc.stepId)
    );
    if (latestStepById.get(step.stepDoc.stepId) === step && JSON.stringify(step.codeReviewStreaks) !== JSON.stringify(expectedCodeStreaks)) {
      issues.push("codeReviewStreaks must match recorded CodeReviewRecord history");
    }
    if (latestStepById.get(step.stepDoc.stepId) === step && JSON.stringify(step.cleanCodeReviewStreaks) !== JSON.stringify(expectedCleanCodeStreaks)) {
      issues.push("cleanCodeReviewStreaks must match recorded CleanCodeReviewRecord history");
    }
    if (step.testEvidenceRecord !== null && !isTestEvidenceRecord(step.testEvidenceRecord)) {
      issues.push("TestEvidenceRecord must include commands, outcome, counts, Not-tested gaps, and evidence refs");
    }
    if (step.testEvidenceRecord !== null && step.testEvidenceRecord.stepId !== step.stepDoc.stepId) {
      issues.push("TestEvidenceRecord must match its ImplementationStepDoc stepId");
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
    if (step.blocker !== null && step.blocker.stepId !== step.stepDoc.stepId) {
      issues.push("blocked step must match its ImplementationStepDoc stepId");
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

  const validSteps = projection.steps.filter((step) => isStepDoc(step.stepDoc));
  const stepIds = new Set(validSteps.map((step) => step.stepDoc.stepId));
  const stepDocsById = new Map<string, ImplementationStepDoc>();

  for (const step of validSteps) {
    const existingDoc = stepDocsById.get(step.stepDoc.stepId);

    if (existingDoc && !sameImplementationStepDoc(existingDoc, step.stepDoc)) {
      issues.push("ImplementationStepDoc must stay stable for repeated records of the same step id");
    }
    stepDocsById.set(step.stepDoc.stepId, step.stepDoc);
  }
  issues.push(
    ...topLevelStepRecordIssues(projection.stepCommitRecords, isStepCommitRecord, stepIds, "stepCommitRecords must point to known steps"),
    ...topLevelStepRecordIssues(projection.noCodeStepEvidenceRecords, isNoCodeStepEvidence, stepIds, "noCodeStepEvidenceRecords must point to known steps"),
    ...topLevelStepRecordIssues(projection.codeReviewRecords, isCodeReviewRecord, stepIds, "codeReviewRecords must point to known steps"),
    ...topLevelStepRecordIssues(projection.cleanCodeReviewRecords, isCleanCodeReviewRecord, stepIds, "cleanCodeReviewRecords must point to known steps"),
    ...topLevelStepRecordIssues(projection.testEvidenceRecords, isTestEvidenceRecord, stepIds, "testEvidenceRecords must point to known steps"),
    ...topLevelStepRecordIssues(projection.blockedSteps, isBlocker, stepIds, "blockedSteps must point to known steps")
  );

  if (issues.length) {
    throw new ImplementationStepLedgerValidationError(issues);
  }

  return projection;
}

const IMPLEMENTATION_STEP_LEDGER_FIXTURE_CODE_REVIEWS: readonly CodeReviewRecord[] = [
  {
    stepId: "step_demo",
    reviewId: "review_code_feature_demo_1",
    reviewer: "codex-code-reviewer",
    reviewScope: "feature",
    verdict: "passed",
    comparedFromCommitSha: "1234567",
    comparedToCommitSha: "abcdef1",
    findings: [],
    evidenceRefs: ["review:code:feature:1"]
  },
  {
    stepId: "step_demo",
    reviewId: "review_code_feature_demo_2",
    reviewer: "codex-code-reviewer",
    reviewScope: "feature",
    verdict: "passed",
    comparedFromCommitSha: "1234567",
    comparedToCommitSha: "abcdef1",
    findings: [],
    evidenceRefs: ["review:code:feature:2"]
  },
  {
    stepId: "step_demo",
    reviewId: "review_code_repository_demo_1",
    reviewer: "codex-repo-reviewer",
    reviewScope: "repository",
    verdict: "passed",
    comparedFromCommitSha: "1234567",
    comparedToCommitSha: "abcdef1",
    findings: [],
    evidenceRefs: ["review:code:repository:1"]
  },
  {
    stepId: "step_demo",
    reviewId: "review_code_repository_demo_2",
    reviewer: "codex-repo-reviewer",
    reviewScope: "repository",
    verdict: "passed",
    comparedFromCommitSha: "1234567",
    comparedToCommitSha: "abcdef1",
    findings: [],
    evidenceRefs: ["review:code:repository:2"]
  }
];

const IMPLEMENTATION_STEP_LEDGER_FIXTURE_CLEAN_CODE_REVIEWS: readonly CleanCodeReviewRecord[] = [
  {
    stepId: "step_demo",
    reviewId: "review_clean_changed_demo_1",
    reviewer: "codex-clean-code-reviewer",
    reviewScope: "changed_code",
    verdict: "passed",
    comparedFromCommitSha: "1234567",
    comparedToCommitSha: "abcdef1",
    simplifications: [],
    evidenceRefs: ["review:clean:changed:1"]
  },
  {
    stepId: "step_demo",
    reviewId: "review_clean_changed_demo_2",
    reviewer: "codex-clean-code-reviewer",
    reviewScope: "changed_code",
    verdict: "passed",
    comparedFromCommitSha: "1234567",
    comparedToCommitSha: "abcdef1",
    simplifications: [],
    evidenceRefs: ["review:clean:changed:2"]
  },
  {
    stepId: "step_demo",
    reviewId: "review_clean_repository_demo_1",
    reviewer: "codex-repo-clean-code-reviewer",
    reviewScope: "repository",
    verdict: "passed",
    comparedFromCommitSha: "1234567",
    comparedToCommitSha: "abcdef1",
    simplifications: [],
    evidenceRefs: ["review:clean:repository:1"]
  },
  {
    stepId: "step_demo",
    reviewId: "review_clean_repository_demo_2",
    reviewer: "codex-repo-clean-code-reviewer",
    reviewScope: "repository",
    verdict: "passed",
    comparedFromCommitSha: "1234567",
    comparedToCommitSha: "abcdef1",
    simplifications: [],
    evidenceRefs: ["review:clean:repository:2"]
  }
];

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
        codeReviewRecord: IMPLEMENTATION_STEP_LEDGER_FIXTURE_CODE_REVIEWS.at(-1) ?? null,
        cleanCodeReviewRecord: IMPLEMENTATION_STEP_LEDGER_FIXTURE_CLEAN_CODE_REVIEWS.at(-1) ?? null,
        codeReviewStreaks: implementationCodeReviewStreaks(IMPLEMENTATION_STEP_LEDGER_FIXTURE_CODE_REVIEWS),
        cleanCodeReviewStreaks: implementationCleanCodeReviewStreaks(IMPLEMENTATION_STEP_LEDGER_FIXTURE_CLEAN_CODE_REVIEWS),
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
    codeReviewRecords: IMPLEMENTATION_STEP_LEDGER_FIXTURE_CODE_REVIEWS,
    cleanCodeReviewRecords: IMPLEMENTATION_STEP_LEDGER_FIXTURE_CLEAN_CODE_REVIEWS,
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
