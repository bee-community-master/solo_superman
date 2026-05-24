import { randomUUID } from "node:crypto";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import {
  AUTO_IMPLEMENTATION_STAGES,
  IMPLEMENTATION_REQUIRED_NO_FINDING_REVIEW_STREAK,
  autoImplementationFinalPrBodyEvidenceRefs,
  type AutoImplementationStage,
  type ImplementationStepDoc,
  type RecordImplementationStepLedgerPayload,
  type TrackerDoc
} from "@solo-superman/contracts";
import { applyMigrations, createSoloStorage, localDatabaseUrlFromAppDataDir } from "@solo-superman/db";
import {
  createSmokePlanningHandoff,
  createSmokeProject,
  objectAt,
  postJson,
  recordArray,
  sessionEventCount,
  stringAt,
  type AutoImplementationSmokePlanningFixture,
  type JsonRecord,
  type SmokeSidecarApp,
  type SmokeStorage
} from "./auto-implementation-smoke-fixtures";
import type { AutoImplementationPullRequestMutationAdapter } from "./product-engine/auto-implementation-workspace";
import { createSidecarApp } from "./server";
import { removeTemporaryDirectory } from "./test-cleanup";

export const AUTO_IMPLEMENTATION_REVIEW_LOOP_SMOKE = "auto_implementation_review_loop" as const;

const PROJECT_FOLDER_NAME = "review-loop-smoke-demo";
const FIXTURE_PR_URL = "https://github.com/bee-community-master/generated-demo/pull/233";
const PLANNING_FIXTURE: AutoImplementationSmokePlanningFixture = {
  idPrefix: "review_loop_smoke",
  sourceLabelPrefix: "Review loop smoke Planning Handoff",
  specTitle: "Review loop smoke Planning Handoff ready spec",
  taskObjective: "Validate full auto-implementation review-loop smoke evidence.",
  resultSummary: "Accepted evidence supports a review-loop smoke run.",
  claim: "The review-loop smoke can exercise every auto-implementation stage.",
  decisionContext: "Review loop smoke Planning Handoff",
  completionSummary: "Spec and research are ready for Planning Handoff.",
  nextBuildSliceSummary: "Next build slice can be planned through review and merge gates."
};

type SmokeStatus = "blocked" | "passed";

type StageEvidence = {
  readonly stage: AutoImplementationStage;
  readonly ledgerStatus: string;
  readonly implementationStepId: string;
  readonly stageStatusAfter: string;
  readonly runStatusAfter: string;
  readonly currentStageAfter: string;
  readonly codeReviewSatisfiedScopes: readonly string[];
  readonly cleanCodeReviewSatisfiedScopes: readonly string[];
  readonly missingTestAuditGapCount: number;
  readonly testOutcome: string;
};

export interface AutoImplementationReviewLoopSmokeEvidence {
  readonly status: SmokeStatus;
  readonly smoke: typeof AUTO_IMPLEMENTATION_REVIEW_LOOP_SMOKE;
  readonly mode: "fixture";
  readonly run?: {
    readonly runId: string;
    readonly finalStatus: string;
    readonly finalStage: string;
    readonly completedStageCount: number;
    readonly projectFolderName: string;
    readonly stages: readonly StageEvidence[];
  };
  readonly reason?: string;
  readonly blockers?: readonly string[];
  readonly checked: readonly string[];
}

export interface AutoImplementationReviewLoopSmokeOptions {
  readonly appDataDir?: string;
  readonly cleanupAppDataDir?: boolean;
  readonly localCapabilityToken?: string;
}

interface ReviewLoopScenario {
  readonly storageApp: SmokeSidecarApp;
  readonly storage: SmokeStorage;
}

interface PreparedRun {
  readonly sessionId: string;
  readonly runId: string;
}

interface StageResult {
  readonly stage: AutoImplementationStage;
  readonly ledger: JsonRecord;
  readonly advancedRun: JsonRecord;
  readonly implementationStepId: string;
}

interface ReviewLoopResult {
  readonly runId: string;
  readonly finalRun: JsonRecord;
  readonly stages: readonly StageResult[];
}

function latestRunFromProjection(projection: JsonRecord, label: string) {
  return objectAt(projection.latestRun, `${label} latestRun`);
}

function stageTickAt(index: number) {
  return new Date(Date.UTC(2026, 4, 23, 0, 10 + index * 10, 0, 0)).toISOString();
}

function fixturePrMergeMutationAdapter(): AutoImplementationPullRequestMutationAdapter {
  return {
    async mutate(input) {
      return {
        pullRequestUrl: input.pullRequestUrl ?? FIXTURE_PR_URL,
        auditEvidenceRefs: [`github-pr-mutation:review-loop-fixture:${input.action}`],
        mergeEvidenceRefs: input.action === "merge_pr"
          ? ["github-pr-mutation:review-loop-fixture:merge-completed"]
          : []
      };
    }
  };
}

async function createAutoImplementationRun(input: {
  readonly scenario: ReviewLoopScenario;
  readonly localCapabilityToken: string;
  readonly sessionId: string;
  readonly sourcePlanningRef: string;
}) {
  const data = await postJson(
    input.scenario.storageApp,
    `/api/v1/sessions/${input.sessionId}/auto-implementation-runs`,
    input.localCapabilityToken,
    {
      sessionId: input.sessionId,
      idempotencyKey: "review-loop-smoke:auto-run",
      projectFolderName: PROJECT_FOLDER_NAME,
      projectName: "Review Loop Smoke Demo",
      sourcePlanningRef: input.sourcePlanningRef
    }
  );

  return latestRunFromProjection(data, "created auto implementation run");
}

async function prepareRun(scenario: ReviewLoopScenario, localCapabilityToken: string): Promise<PreparedRun> {
  const { projectId, sessionId } = await createSmokeProject({
    app: scenario.storageApp,
    localCapabilityToken,
    rawIdea: "A review-loop smoke idea that should exercise every delivery review stage."
  });
  const sourcePlanningRef = await createSmokePlanningHandoff({
    app: scenario.storageApp,
    storage: scenario.storage,
    localCapabilityToken,
    projectId,
    sessionId,
    fixture: PLANNING_FIXTURE
  });
  const run = await createAutoImplementationRun({ scenario, localCapabilityToken, sessionId, sourcePlanningRef });

  return {
    sessionId,
    runId: stringAt(run.runId, "auto implementation runId")
  };
}

function trackerDoc(runId: string): TrackerDoc {
  return {
    trackerId: `auto-implementation-tracker:${runId}`,
    title: `${PROJECT_FOLDER_NAME} implementation tracker`,
    goal: "Complete the staged auto implementation protocol with review, clean-code, test, PR, and merge evidence.",
    sourceRefs: [`auto-implementation-run:${runId}`, "tracker-doc:implementation-tracker.md"]
  };
}

function stepDoc(runId: string, stage: AutoImplementationStage, stageIndex: number): ImplementationStepDoc {
  return {
    stepId: `auto-implementation-step:${runId}:${stage}:review-loop-smoke-${String(stageIndex + 1).padStart(3, "0")}`,
    title: `Review loop smoke ${stage}`,
    description: `Fixture evidence for the ${stage} delivery/review stage.`,
    sourceRefs: [
      `auto-implementation-run:${runId}`,
      `auto-implementation-stage:${stage}`,
      `issue-doc:implementation-issues/${String(stageIndex + 1).padStart(3, "0")}_${stage}.md`,
      "planning-handoff-plan:planning-handoff-implementation-plan.md"
    ],
    expectedChangeScope: "tracked_code_docs_config"
  };
}

function commitForStage(stageIndex: number) {
  const previousCommitSha = (0x1234500 + stageIndex).toString(16);
  const commitSha = (0xabcde00 + stageIndex).toString(16);

  return {
    previousCommitSha,
    commitSha,
    diffRange: `${previousCommitSha}..${commitSha}`
  };
}

function stageTransitions(input: {
  readonly runId: string;
  readonly stage: AutoImplementationStage;
  readonly stageIndex: number;
}): readonly RecordImplementationStepLedgerPayload[] {
  const tracker = trackerDoc(input.runId);
  const step = stepDoc(input.runId, input.stage, input.stageIndex);
  const commit = commitForStage(input.stageIndex);
  const base = { trackerDoc: tracker, stepDoc: step };
  const stepCommitRecord = {
    stepId: step.stepId,
    commitSha: commit.commitSha,
    previousCommitSha: commit.previousCommitSha,
    diffRange: commit.diffRange,
    changedFiles: [`implementation-issues/${String(input.stageIndex + 1).padStart(3, "0")}_${input.stage}.md`],
    rollbackRef: `rollback:git-revert:${commit.commitSha}`,
    evidenceRefs: [`commit:${commit.commitSha}`]
  };
  const codeReviewRecord = (reviewScope: "feature" | "repository", pass: 1 | 2) => ({
    stepId: step.stepId,
    reviewId: `review-code-${input.stage}-${reviewScope}-${pass}`,
    reviewer: reviewScope === "feature" ? "codex-code-reviewer" : "codex-repo-reviewer",
    reviewScope,
    verdict: "passed" as const,
    comparedFromCommitSha: commit.previousCommitSha,
    comparedToCommitSha: commit.commitSha,
    findings: [],
    evidenceRefs: [`review:code:${input.stage}:${reviewScope}:${pass}`]
  });
  const cleanCodeReviewRecord = (reviewScope: "changed_code" | "repository", pass: 1 | 2) => ({
    stepId: step.stepId,
    reviewId: `review-clean-${input.stage}-${reviewScope}-${pass}`,
    reviewer: reviewScope === "changed_code" ? "codex-clean-code-reviewer" : "codex-repo-clean-code-reviewer",
    reviewScope,
    verdict: "passed" as const,
    comparedFromCommitSha: commit.previousCommitSha,
    comparedToCommitSha: commit.commitSha,
    simplifications: [],
    evidenceRefs: [`review:clean:${input.stage}:${reviewScope}:${pass}`]
  });
  const testEvidenceRecord = {
    stepId: step.stepId,
    testEvidenceId: `test-${input.stage}`,
    commands: ["pnpm verify"],
    outcome: "passed" as const,
    verifiedCommitSha: commit.commitSha,
    passedTestCount: 1,
    failedTestCount: 0,
    notTestedGaps: [],
    evidenceRefs: [
      `test:${input.stage}:verify`,
      ...(input.stage === "merge_main" ? [`post-merge-verify:${input.stage}:pnpm-verify`] : [])
    ]
  };
  const missingTestAuditRecord = {
    stepId: step.stepId,
    auditId: `missing-test-audit-${input.stage}`,
    auditedCriteriaRefs: [`issue:${input.stage}:acceptance`],
    coverageEvidenceRefs: testEvidenceRecord.evidenceRefs,
    missingTestGaps: [],
    evidenceRefs: [`missing-test-audit:${input.stage}:coverage`]
  };

  return [
    { ...base, targetStatus: "ready" },
    { ...base, targetStatus: "implementing", startedEvidenceRefs: [`review-loop-smoke:${input.stage}:started`] },
    { ...base, targetStatus: "committed", stepCommitRecord },
    { ...base, targetStatus: "review_required", stepCommitRecord },
    { ...base, targetStatus: "review_required", stepCommitRecord, codeReviewRecord: codeReviewRecord("feature", 1) },
    { ...base, targetStatus: "review_required", stepCommitRecord, codeReviewRecord: codeReviewRecord("feature", 2) },
    { ...base, targetStatus: "review_required", stepCommitRecord, codeReviewRecord: codeReviewRecord("repository", 1) },
    { ...base, targetStatus: "review_required", stepCommitRecord, codeReviewRecord: codeReviewRecord("repository", 2) },
    { ...base, targetStatus: "clean_code_review_required", stepCommitRecord },
    {
      ...base,
      targetStatus: "clean_code_review_required",
      stepCommitRecord,
      cleanCodeReviewRecord: cleanCodeReviewRecord("changed_code", 1)
    },
    {
      ...base,
      targetStatus: "clean_code_review_required",
      stepCommitRecord,
      cleanCodeReviewRecord: cleanCodeReviewRecord("changed_code", 2)
    },
    {
      ...base,
      targetStatus: "clean_code_review_required",
      stepCommitRecord,
      cleanCodeReviewRecord: cleanCodeReviewRecord("repository", 1)
    },
    {
      ...base,
      targetStatus: "clean_code_review_required",
      stepCommitRecord,
      cleanCodeReviewRecord: cleanCodeReviewRecord("repository", 2)
    },
    { ...base, targetStatus: "tests_required", stepCommitRecord },
    {
      ...base,
      targetStatus: "completed",
      stepCommitRecord,
      missingTestAuditRecord,
      testEvidenceRecord,
      evidenceRefs: [`review-loop-smoke:${input.stage}:completed`]
    }
  ];
}

async function recordLedgerTransition(input: {
  readonly scenario: ReviewLoopScenario;
  readonly localCapabilityToken: string;
  readonly sessionId: string;
  readonly stage: AutoImplementationStage;
  readonly transitionIndex: number;
  readonly transition: RecordImplementationStepLedgerPayload;
}) {
  return postJson(
    input.scenario.storageApp,
    `/api/v1/sessions/${input.sessionId}/implementation-step-ledger`,
    input.localCapabilityToken,
    {
      sessionId: input.sessionId,
      expectedStateVersion: await sessionEventCount(input.scenario.storage, input.sessionId),
      idempotencyKey: `review-loop-smoke:ledger:${input.stage}:${input.transitionIndex}`,
      ...input.transition
    }
  );
}

async function recordCompletedLedger(input: {
  readonly scenario: ReviewLoopScenario;
  readonly localCapabilityToken: string;
  readonly preparedRun: PreparedRun;
  readonly stage: AutoImplementationStage;
  readonly stageIndex: number;
}) {
  const transitions = stageTransitions({
    runId: input.preparedRun.runId,
    stage: input.stage,
    stageIndex: input.stageIndex
  });
  let latestLedger: JsonRecord | null = null;

  for (const [transitionIndex, transition] of transitions.entries()) {
    const data = await recordLedgerTransition({
      scenario: input.scenario,
      localCapabilityToken: input.localCapabilityToken,
      sessionId: input.preparedRun.sessionId,
      stage: input.stage,
      transitionIndex,
      transition
    });

    latestLedger = objectAt(data.immediateProjection, `${input.stage} implementation ledger projection`);
  }

  return objectAt(latestLedger, `${input.stage} latest ledger`);
}

async function completeStage(input: {
  readonly scenario: ReviewLoopScenario;
  readonly localCapabilityToken: string;
  readonly preparedRun: PreparedRun;
  readonly stage: AutoImplementationStage;
  readonly stageIndex: number;
  readonly implementationStepId: string;
}) {
  const data = await postJson(
    input.scenario.storageApp,
    `/api/v1/sessions/${input.preparedRun.sessionId}/auto-implementation-runs/${input.preparedRun.runId}/stages/${input.stage}`,
    input.localCapabilityToken,
    {
      sessionId: input.preparedRun.sessionId,
      runId: input.preparedRun.runId,
      stage: input.stage,
      action: "complete",
      implementationStepId: input.implementationStepId,
      idempotencyKey: `review-loop-smoke:stage-complete:${input.stage}`,
      tickedAt: stageTickAt(input.stageIndex),
      evidenceRefs: [`review-loop-smoke:stage:${input.stage}:complete`]
    }
  );

  return latestRunFromProjection(data, `${input.stage} completed stage`);
}

async function recordAppliedMergeMutation(input: {
  readonly scenario: ReviewLoopScenario;
  readonly localCapabilityToken: string;
  readonly preparedRun: PreparedRun;
}) {
  const data = await postJson(
    input.scenario.storageApp,
    `/api/v1/sessions/${input.preparedRun.sessionId}/auto-implementation-runs/${input.preparedRun.runId}/pr-mutations`,
    input.localCapabilityToken,
    {
      sessionId: input.preparedRun.sessionId,
      runId: input.preparedRun.runId,
      action: "merge_pr",
      requestMode: "approved",
      idempotencyKey: "review-loop-smoke:pr-merge:approved",
      pullRequestTitle: "Review-loop smoke generated implementation PR",
      pullRequestUrl: FIXTURE_PR_URL,
      issueLinks: ["https://github.com/bee-community-master/generated-demo/issues/233"],
      implementationScope: "Fixture merge proves merge_main cannot complete before an applied PR merge record exists.",
      reviewStreakRefs: [],
      verificationCommands: ["pnpm verify"],
      knownGaps: [],
      rollbackNotes: "Reopen or revert the fixture merge if post-merge verification evidence fails.",
      mergeEvidenceRefs: ["merge-ready:review-loop-fixture"],
      bodyEvidenceRefs: autoImplementationFinalPrBodyEvidenceRefs(input.preparedRun.runId),
      approval: {
        approvalId: "approval_review_loop_fixture_merge",
        approvedBy: "fixture_operator",
        approvedAt: "2026-05-23T01:05:00.000Z",
        actionClass: "github_pr_mutation",
        approvalGranularity: "per_action",
        remoteStatusAtApproval: "connected",
        rollbackPlan: "Reopen or revert the fixture merge if post-merge verification evidence fails.",
        evidenceRefs: ["approval:review-loop-fixture-merge"]
      },
      verifierEvidenceRefs: ["verifier:review-loop-fixture-merge-ready"]
    }
  );

  return latestRunFromProjection(data, "review-loop fixture PR merge");
}

async function executeStage(input: {
  readonly scenario: ReviewLoopScenario;
  readonly localCapabilityToken: string;
  readonly preparedRun: PreparedRun;
  readonly stage: AutoImplementationStage;
  readonly stageIndex: number;
}): Promise<StageResult> {
  if (input.stage === "merge_main") {
    await recordAppliedMergeMutation(input);
  }

  const ledger = await recordCompletedLedger(input);
  const implementationStepId = stepDoc(input.preparedRun.runId, input.stage, input.stageIndex).stepId;
  const advancedRun = await completeStage({
    ...input,
    implementationStepId
  });

  return {
    stage: input.stage,
    ledger,
    advancedRun,
    implementationStepId
  };
}

async function executeReviewLoop(scenario: ReviewLoopScenario, localCapabilityToken: string): Promise<ReviewLoopResult> {
  const preparedRun = await prepareRun(scenario, localCapabilityToken);
  const stages: StageResult[] = [];
  let finalRun: JsonRecord | null = null;

  for (const [stageIndex, stage] of AUTO_IMPLEMENTATION_STAGES.entries()) {
    const result = await executeStage({ scenario, localCapabilityToken, preparedRun, stage, stageIndex });

    stages.push(result);
    finalRun = result.advancedRun;
  }

  return {
    runId: preparedRun.runId,
    finalRun: objectAt(finalRun, "final auto implementation run"),
    stages
  };
}

function stepForStage(result: StageResult) {
  return [...recordArray(result.ledger.steps, `${result.stage} ledger steps`)].reverse().find((step) => {
    const stepDocRecord = objectAt(step.stepDoc, `${result.stage} stepDoc`);

    return stepDocRecord.stepId === result.implementationStepId;
  }) ?? null;
}

function satisfiedScopes(streaks: unknown, label: string) {
  return recordArray(streaks, label)
    .filter((streak) =>
      streak.satisfied === true &&
      streak.currentNoFindingPasses === IMPLEMENTATION_REQUIRED_NO_FINDING_REVIEW_STREAK &&
      streak.requiredNoFindingPasses === IMPLEMENTATION_REQUIRED_NO_FINDING_REVIEW_STREAK
    )
    .map((streak) => stringAt(streak.reviewScope, `${label} reviewScope`));
}

function stageRecord(run: JsonRecord, stage: AutoImplementationStage) {
  return recordArray(run.stagePlan, `${stage} stagePlan`).find((record) => record.stage === stage) ?? null;
}

function stringArrayAt(value: unknown, label: string) {
  if (!Array.isArray(value) || value.some((item) => typeof item !== "string")) {
    throw new Error(`${label} must be an array of strings.`);
  }

  return value as readonly string[];
}

function stageEvidence(result: StageResult): StageEvidence {
  const step = objectAt(stepForStage(result), `${result.stage} completed ledger step`);
  const stageAfter = objectAt(stageRecord(result.advancedRun, result.stage), `${result.stage} stage after advance`);
  const testEvidence = objectAt(step.testEvidenceRecord, `${result.stage} testEvidenceRecord`);
  const missingTestAudit = objectAt(step.missingTestAuditRecord, `${result.stage} missingTestAuditRecord`);
  const missingTestGaps = stringArrayAt(
    missingTestAudit.missingTestGaps,
    `${result.stage} missingTestAuditRecord.missingTestGaps`
  );

  return {
    stage: result.stage,
    ledgerStatus: stringAt(step.status, `${result.stage} ledger step status`),
    implementationStepId: result.implementationStepId,
    stageStatusAfter: stringAt(stageAfter.status, `${result.stage} stage status after advance`),
    runStatusAfter: stringAt(result.advancedRun.status, `${result.stage} run status after advance`),
    currentStageAfter: stringAt(result.advancedRun.currentStage, `${result.stage} currentStage after advance`),
    codeReviewSatisfiedScopes: satisfiedScopes(step.codeReviewStreaks, `${result.stage} codeReviewStreaks`),
    cleanCodeReviewSatisfiedScopes: satisfiedScopes(step.cleanCodeReviewStreaks, `${result.stage} cleanCodeReviewStreaks`),
    missingTestAuditGapCount: missingTestGaps.length,
    testOutcome: stringAt(testEvidence.outcome, `${result.stage} test outcome`)
  };
}

function resultBlockers(result: ReviewLoopResult) {
  const blockers: string[] = [];
  const evidences = result.stages.map(stageEvidence);

  if (evidences.length !== AUTO_IMPLEMENTATION_STAGES.length) {
    blockers.push(`all canonical stages must execute; received ${evidences.length}/${AUTO_IMPLEMENTATION_STAGES.length}`);
  }

  for (const evidence of evidences) {
    const missingCodeScopes = ["feature", "repository"].filter(
      (scope) => !evidence.codeReviewSatisfiedScopes.includes(scope)
    );
    const missingCleanScopes = ["changed_code", "repository"].filter(
      (scope) => !evidence.cleanCodeReviewSatisfiedScopes.includes(scope)
    );

    if (evidence.ledgerStatus !== "completed") {
      blockers.push(`${evidence.stage} ledger step must complete; received ${JSON.stringify(evidence.ledgerStatus)}`);
    }
    if (evidence.stageStatusAfter !== "completed") {
      blockers.push(`${evidence.stage} stage must be completed after advance; received ${JSON.stringify(evidence.stageStatusAfter)}`);
    }
    if (missingCodeScopes.length > 0) {
      blockers.push(`${evidence.stage} is missing code-review no-finding streak scopes: ${missingCodeScopes.join(", ")}`);
    }
    if (missingCleanScopes.length > 0) {
      blockers.push(`${evidence.stage} is missing clean-code no-finding streak scopes: ${missingCleanScopes.join(", ")}`);
    }
    if (evidence.testOutcome !== "passed") {
      blockers.push(`${evidence.stage} test evidence must pass; received ${JSON.stringify(evidence.testOutcome)}`);
    }
    if (evidence.missingTestAuditGapCount !== 0) {
      blockers.push(`${evidence.stage} missing-test audit must have zero gaps; received ${evidence.missingTestAuditGapCount}`);
    }
  }

  if (result.finalRun.status !== "completed") {
    blockers.push(`final run status must be completed; received ${JSON.stringify(result.finalRun.status)}`);
  }

  if (result.finalRun.currentStage !== "merge_main") {
    blockers.push(`final currentStage must remain merge_main; received ${JSON.stringify(result.finalRun.currentStage)}`);
  }

  const pullRequestMutationState = result.finalRun.pullRequestMutations as JsonRecord | undefined;
  const latestPullRequestMutation = pullRequestMutationState?.latestRecord as JsonRecord | null | undefined;

  if (
    !latestPullRequestMutation ||
    latestPullRequestMutation.action !== "merge_pr" ||
    latestPullRequestMutation.status !== "applied"
  ) {
    blockers.push("merge_main completion must retain an applied PR merge mutation record.");
  }

  return blockers;
}

function runEvidence(result: ReviewLoopResult) {
  const stages = result.stages.map(stageEvidence);

  return {
    runId: result.runId,
    finalStatus: stringAt(result.finalRun.status, "final run status"),
    finalStage: stringAt(result.finalRun.currentStage, "final current stage"),
    completedStageCount: stages.filter((stage) => stage.stageStatusAfter === "completed").length,
    projectFolderName: PROJECT_FOLDER_NAME,
    stages
  };
}

function checkedEvidence() {
  return [
    "temporary local sidecar and app data created",
    "planning-ready handoff created",
    "auto implementation workspace run created",
    "ImplementationStepLedger completed with two no-finding code-review passes per feature/repository scope for every stage",
    "ImplementationStepLedger completed with two no-finding clean-code passes per changed-code/repository scope for every stage",
    "missing-test audit evidence recorded with zero gaps for every stage",
    "passing test evidence recorded for every stage",
    "fixture PR merge mutation and post-merge verification evidence recorded before merge_main completion",
    "each canonical stage completed through the existing stage endpoint",
    "run reached completed status at merge_main without real GitHub writes"
  ];
}

function blockedEvidence(result: ReviewLoopResult, blockers: readonly string[]): AutoImplementationReviewLoopSmokeEvidence {
  return {
    status: "blocked",
    smoke: AUTO_IMPLEMENTATION_REVIEW_LOOP_SMOKE,
    mode: "fixture",
    run: runEvidence(result),
    reason: "Auto implementation review-loop smoke did not satisfy every staged review gate.",
    blockers,
    checked: checkedEvidence()
  };
}

function passedEvidence(result: ReviewLoopResult): AutoImplementationReviewLoopSmokeEvidence {
  return {
    status: "passed",
    smoke: AUTO_IMPLEMENTATION_REVIEW_LOOP_SMOKE,
    mode: "fixture",
    run: runEvidence(result),
    checked: checkedEvidence()
  };
}

function errorEvidence(error: unknown): AutoImplementationReviewLoopSmokeEvidence {
  const message = error instanceof Error ? error.message : String(error);

  return {
    status: "blocked",
    smoke: AUTO_IMPLEMENTATION_REVIEW_LOOP_SMOKE,
    mode: "fixture",
    reason: "Auto implementation review-loop smoke failed before full evidence could be collected.",
    blockers: [message],
    checked: ["temporary local review-loop smoke started"]
  };
}

async function createScenario(appDataDir: string, localCapabilityToken: string): Promise<ReviewLoopScenario> {
  const storage = await createSoloStorage({ url: localDatabaseUrlFromAppDataDir(appDataDir) });
  const migrationStatus = await applyMigrations(storage);

  if (migrationStatus.state === "failed") {
    await storage.close();
    throw new Error(migrationStatus.errorMessage);
  }

  return {
    storage,
    storageApp: createSidecarApp({
      localCapabilityToken,
      migrationStatus,
      storage,
      autoImplementationWorkspaceRoot: join(appDataDir, "review-loop-workspaces"),
      autoImplementationRemoteStatusProvider: async () => "connected",
      autoImplementationPullRequestMutationAdapter: fixturePrMergeMutationAdapter()
    })
  };
}

async function runScenario(input: {
  readonly appDataDir: string;
  readonly localCapabilityToken: string;
}) {
  const scenario = await createScenario(input.appDataDir, input.localCapabilityToken);

  try {
    const result = await executeReviewLoop(scenario, input.localCapabilityToken);
    const blockers = resultBlockers(result);

    return blockers.length ? blockedEvidence(result, blockers) : passedEvidence(result);
  } finally {
    await scenario.storage.close();
  }
}

export async function runAutoImplementationReviewLoopSmoke(
  options: AutoImplementationReviewLoopSmokeOptions = {}
): Promise<AutoImplementationReviewLoopSmokeEvidence> {
  const appDataDir = options.appDataDir ?? (await mkdtemp(join(tmpdir(), "solo-superman-review-loop-smoke-")));
  const shouldCleanup = options.cleanupAppDataDir ?? !options.appDataDir;
  const localCapabilityToken = options.localCapabilityToken ?? `review-loop-smoke-${randomUUID()}`;

  try {
    return await runScenario({ appDataDir, localCapabilityToken });
  } catch (error: unknown) {
    return errorEvidence(error);
  } finally {
    if (shouldCleanup) {
      await removeTemporaryDirectory(appDataDir);
    }
  }
}

function exitCodeForEvidence(evidence: AutoImplementationReviewLoopSmokeEvidence) {
  return evidence.status === "passed" ? 0 : 1;
}

async function main() {
  const evidence = await runAutoImplementationReviewLoopSmoke();

  console.log(JSON.stringify(evidence, null, 2));
  process.exitCode = exitCodeForEvidence(evidence);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  void main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.stack ?? error.message : String(error));
    process.exitCode = 1;
  });
}
