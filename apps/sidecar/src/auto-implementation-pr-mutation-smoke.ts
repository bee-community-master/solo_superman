import { randomUUID } from "node:crypto";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import {
  AUTO_IMPLEMENTATION_STAGES,
  CONTRACT_SCHEMA_VERSION,
  type AutoImplementationPullRequestMutationAction,
  type AutoImplementationPullRequestMutationRecord,
  type AutoImplementationRun,
  type AutoImplementationRunProjection,
  type AutoImplementationStage,
  type AutoImplementationStageLedgerEvidence,
  type ProjectId,
  type ProjectionVersion,
  type SessionId
} from "@solo-superman/contracts";
import {
  applyMigrations,
  createProjectionRepository,
  createSoloStorage,
  localDatabaseUrlFromAppDataDir
} from "@solo-superman/db";
import {
  createSmokePlanningHandoff,
  createSmokeProject,
  objectAt,
  postJson,
  stringAt,
  type AutoImplementationSmokePlanningFixture,
  type JsonRecord,
  type SmokeSidecarApp,
  type SmokeStorage
} from "./auto-implementation-smoke-fixtures";
import type {
  AutoImplementationPullRequestMutationAdapter,
  AutoImplementationPullRequestMutationInput
} from "./product-engine/auto-implementation-workspace";
import { createCodexRuntimeAdapter } from "./runtime";
import { createSidecarApp } from "./server";
import { removeTemporaryDirectory } from "./test-cleanup";

export const AUTO_IMPLEMENTATION_PR_MUTATION_SMOKE = "auto_implementation_pr_mutation" as const;

const FIXTURE_NOW = "2026-05-23T00:00:00.000Z";
const PROJECT_FOLDER_NAME = "pr-mutation-smoke-demo";
const FIXTURE_PR_URL = "https://github.com/bee-community-master/generated-demo/pull/210";
const PLANNING_FIXTURE: AutoImplementationSmokePlanningFixture = {
  idPrefix: "pr_mutation_smoke",
  sourceLabelPrefix: "PR mutation smoke Planning Handoff",
  specTitle: "PR mutation smoke Planning Handoff ready spec",
  taskObjective: "Validate PR mutation smoke Planning Handoff evidence.",
  resultSummary: "Accepted evidence supports a PR mutation smoke run.",
  claim: "The PR mutation smoke can exercise generated PR lifecycle guards.",
  decisionContext: "PR mutation smoke Planning Handoff",
  completionSummary: "Spec and research are ready for Planning Handoff.",
  nextBuildSliceSummary: "Next PR mutation smoke slice can be planned."
};

type SmokeStatus = "blocked" | "passed";

interface PrMutationScenario {
  readonly storageApp: SmokeSidecarApp;
  readonly storage: SmokeStorage;
  readonly mutationInputs: AutoImplementationPullRequestMutationInput[];
}

interface PrMutationScenarioInput {
  readonly appDataDir: string;
  readonly localCapabilityToken: string;
}

interface PrMutationFlowResult {
  readonly runId: string;
  readonly projectFolderName: string;
  readonly blockedOpen: AutoImplementationPullRequestMutationRecord;
  readonly opened: AutoImplementationPullRequestMutationRecord;
  readonly bodyUpdated: AutoImplementationPullRequestMutationRecord;
  readonly blockedBeforeFinalVerify: AutoImplementationPullRequestMutationRecord;
  readonly blockedMissingBody: AutoImplementationPullRequestMutationRecord;
  readonly merged: AutoImplementationPullRequestMutationRecord;
  readonly duplicateMerge: AutoImplementationPullRequestMutationRecord;
  readonly mutationInputs: readonly AutoImplementationPullRequestMutationInput[];
}

interface PreparedPrMutationRun {
  readonly projectId: string;
  readonly sessionId: string;
  readonly runId: string;
}

interface OpenLifecycleResult {
  readonly blockedOpen: AutoImplementationPullRequestMutationRecord;
  readonly opened: AutoImplementationPullRequestMutationRecord;
  readonly bodyUpdated: AutoImplementationPullRequestMutationRecord;
}

interface MergeLifecycleResult {
  readonly blockedBeforeFinalVerify: AutoImplementationPullRequestMutationRecord;
  readonly blockedMissingBody: AutoImplementationPullRequestMutationRecord;
  readonly merged: AutoImplementationPullRequestMutationRecord;
  readonly duplicateMerge: AutoImplementationPullRequestMutationRecord;
}

export interface AutoImplementationPrMutationSmokeEvidence {
  readonly status: SmokeStatus;
  readonly smoke: typeof AUTO_IMPLEMENTATION_PR_MUTATION_SMOKE;
  readonly mode: "fixture";
  readonly prMutation?: {
    readonly runId: string;
    readonly projectFolderName: string;
    readonly pullRequestUrl: string;
    readonly blockedOpenReason: string | null;
    readonly openStatus: string;
    readonly bodyUpdateStatus: string;
    readonly blockedBeforeFinalVerifyReason: string | null;
    readonly blockedMissingBodyReason: string | null;
    readonly mergeStatus: string;
    readonly duplicateMergeReason: string | null;
    readonly adapterActions: readonly AutoImplementationPullRequestMutationAction[];
    readonly bodyMarkdownChecks: readonly string[];
  };
  readonly reason?: string;
  readonly blockers?: readonly string[];
  readonly checked: readonly string[];
}

export interface AutoImplementationPrMutationSmokeOptions {
  readonly appDataDir?: string;
  readonly cleanupAppDataDir?: boolean;
  readonly localCapabilityToken?: string;
}

async function createAutoImplementationRun(input: {
  readonly scenario: PrMutationScenario;
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
      idempotencyKey: "pr-mutation-smoke:auto-run",
      projectFolderName: PROJECT_FOLDER_NAME,
      projectName: "PR Mutation Smoke Demo",
      sourcePlanningRef: input.sourcePlanningRef
    }
  );

  return latestRunFromProjection(data, "created auto implementation run");
}

function latestRunFromProjection(projection: JsonRecord, label: string) {
  return objectAt(projection.latestRun, `${label} latestRun`);
}

async function recordPrMutation(input: {
  readonly scenario: PrMutationScenario;
  readonly localCapabilityToken: string;
  readonly sessionId: string;
  readonly runId: string;
  readonly body: Readonly<Record<string, unknown>>;
}) {
  const data = await postJson(
    input.scenario.storageApp,
    `/api/v1/sessions/${input.sessionId}/auto-implementation-runs/${input.runId}/pr-mutations`,
    input.localCapabilityToken,
    {
      sessionId: input.sessionId,
      runId: input.runId,
      ...input.body
    }
  );
  const latestRun = latestRunFromProjection(data, "recorded PR mutation");

  return latestPullRequestMutation(latestRun);
}

function latestPullRequestMutation(run: JsonRecord): AutoImplementationPullRequestMutationRecord {
  const pullRequestMutations = objectAt(run.pullRequestMutations, "pullRequestMutations");
  const latestRecord = objectAt(pullRequestMutations.latestRecord, "pullRequestMutations.latestRecord");

  return latestRecord as unknown as AutoImplementationPullRequestMutationRecord;
}

function approval(approvalId: string, evidenceRef = `approval:${approvalId}`) {
  return {
    approvalId,
    approvedBy: "local_operator",
    approvedAt: "2026-05-23T00:03:00.000Z",
    actionClass: "github_pr_mutation",
    approvalGranularity: "per_action",
    remoteStatusAtApproval: "connected",
    rollbackPlan: "Revert the fixture PR mutation if generated evidence is wrong.",
    evidenceRefs: [evidenceRef]
  };
}

function basePrMutationRequest(action: AutoImplementationPullRequestMutationAction, idempotencyKey: string) {
  return {
    action,
    requestMode: "approved",
    idempotencyKey,
    pullRequestTitle: "Generated implementation PR",
    issueLinks: ["local-001", "https://github.com/bee-community-master/generated-demo/issues/210"],
    implementationScope: "Exercise the generated PR mutation lifecycle without real GitHub writes.",
    reviewStreakRefs: [
      "code-review:feature:clean-1",
      "code-review:feature:clean-2",
      "code-review:repository:clean-1",
      "code-review:repository:clean-2",
      "clean-code-review:changed_code:clean-1",
      "clean-code-review:changed_code:clean-2",
      "clean-code-review:repository:clean-1",
      "clean-code-review:repository:clean-2"
    ],
    verificationCommands: ["pnpm verify:pr-mutation", "pnpm verify"],
    knownGaps: ["Fixture mode does not perform a real gh PR mutation."],
    rollbackNotes: "Drop the fixture mutation record if the smoke fails.",
    approval: approval(idempotencyKey.replaceAll(":", "_")),
    verifierEvidenceRefs: [`verifier:${idempotencyKey}`]
  };
}

function openPrRequest(idempotencyKey: string) {
  return basePrMutationRequest("open_pr", idempotencyKey);
}

function updateBodyRequest(idempotencyKey: string) {
  return {
    ...basePrMutationRequest("update_pr_body", idempotencyKey),
    pullRequestUrl: FIXTURE_PR_URL,
    bodyEvidenceRefs: ["pr-body:current-evidence"]
  };
}

function mergePrRequest(idempotencyKey: string, bodyEvidenceRefs: readonly string[] = ["pr-body:current-evidence"]) {
  return {
    ...basePrMutationRequest("merge_pr", idempotencyKey),
    pullRequestUrl: FIXTURE_PR_URL,
    bodyEvidenceRefs,
    mergeEvidenceRefs: ["merge-ready:checks-green"]
  };
}

function completedStageLedgerEvidence(stage: AutoImplementationStage): AutoImplementationStageLedgerEvidence {
  return {
    implementationStepId: `step_${stage}`,
    trackerDocRef: "implementation-step-ledger:tracker:pr-mutation-smoke",
    stepDocRef: `implementation-step-ledger:step:${stage}`,
    implementationEvidenceRefs: [`commit:${stage}:abcdef1`],
    codeReviewStreakRefs: [
      `code-review:feature:${stage}:1`,
      `code-review:feature:${stage}:2`,
      `code-review:repository:${stage}:1`,
      `code-review:repository:${stage}:2`
    ],
    cleanCodeReviewStreakRefs: [
      `clean-code-review:changed_code:${stage}:1`,
      `clean-code-review:changed_code:${stage}:2`,
      `clean-code-review:repository:${stage}:1`,
      `clean-code-review:repository:${stage}:2`
    ],
    missingTestAuditRefs: [`missing-test-audit:${stage}:coverage`],
    testEvidenceRefs: [`test:${stage}:verify`],
    blockerEvidenceRefs: [],
    evidenceRefs: [
      `implementation-step-ledger:${stage}`,
      `missing-test-audit:${stage}:coverage`,
      `test:${stage}:verify`
    ]
  };
}

function stagePlanWithCompletedStages(
  run: AutoImplementationRun,
  completedStages: ReadonlySet<AutoImplementationStage>,
  currentStage: AutoImplementationStage
) {
  return run.stagePlan.map((stageRecord) => {
    if (completedStages.has(stageRecord.stage)) {
      return {
        ...stageRecord,
        status: "completed" as const,
        nextScheduledAt: FIXTURE_NOW,
        evidenceRefs: [...stageRecord.evidenceRefs, `stage:${stageRecord.stage}:completed`],
        ledgerEvidence: completedStageLedgerEvidence(stageRecord.stage),
        blocker: null
      };
    }

    if (stageRecord.stage === currentStage) {
      return {
        ...stageRecord,
        status: "ready" as const,
        nextScheduledAt: FIXTURE_NOW,
        evidenceRefs: [...stageRecord.evidenceRefs, `stage:${stageRecord.stage}:ready`],
        ledgerEvidence: null,
        blocker: null
      };
    }

    return stageRecord;
  });
}

async function persistRunStageState(input: {
  readonly scenario: PrMutationScenario;
  readonly projectId: string;
  readonly sessionId: string;
  readonly runId: string;
  readonly completedStages: readonly AutoImplementationStage[];
  readonly currentStage: AutoImplementationStage;
  readonly summary: string;
}) {
  const projectionRepository = createProjectionRepository(input.scenario.storage.db);
  const projection = await projectionRepository.get<AutoImplementationRunProjection>(
    input.sessionId as SessionId,
    "AutoImplementationRunProjection"
  );

  if (!projection?.latestRun) {
    throw new Error("AutoImplementationRunProjection must exist before seeding PR mutation stage state.");
  }

  const completedStages = new Set(input.completedStages);
  const latestRun = projection.latestRun;
  const updatedRun: AutoImplementationRun = {
    ...latestRun,
    currentStage: input.currentStage,
    status: "running",
    nextTickAt: FIXTURE_NOW,
    stagePlan: stagePlanWithCompletedStages(latestRun, completedStages, input.currentStage),
    updatedAt: FIXTURE_NOW,
    evidenceRefs: [...latestRun.evidenceRefs, `pr-mutation-smoke:stage-state:${input.currentStage}`]
  };
  const updatedProjection: AutoImplementationRunProjection = {
    ...projection,
    version: (Number(projection.version) + 1) as ProjectionVersion,
    latestRun: updatedRun,
    runs: projection.runs.map((run) => run.runId === input.runId ? updatedRun : run),
    summary: input.summary
  };

  await projectionRepository.save({
    projectId: input.projectId as ProjectId,
    sessionId: input.sessionId as SessionId,
    projection: updatedProjection,
    schemaVersion: CONTRACT_SCHEMA_VERSION,
    updatedAt: FIXTURE_NOW
  });
}

function completedThrough(stage: AutoImplementationStage) {
  const stageIndex = AUTO_IMPLEMENTATION_STAGES.indexOf(stage);

  if (stageIndex < 0) {
    throw new Error(`Unknown auto implementation stage ${stage}.`);
  }

  return AUTO_IMPLEMENTATION_STAGES.slice(0, stageIndex + 1);
}

function fixturePrMutationAdapter(inputs: AutoImplementationPullRequestMutationInput[]): AutoImplementationPullRequestMutationAdapter {
  return {
    async mutate(input) {
      inputs.push(input);

      if (input.action === "merge_pr") {
        return {
          pullRequestUrl: input.pullRequestUrl ?? FIXTURE_PR_URL,
          auditEvidenceRefs: ["github-pr-mutation:fixture-adapter:merged"],
          mergeEvidenceRefs: ["github-pr-mutation:fixture-adapter:merge-completed"]
        };
      }

      return {
        pullRequestUrl: input.pullRequestUrl ?? FIXTURE_PR_URL,
        auditEvidenceRefs: [`github-pr-mutation:fixture-adapter:${input.action}`],
        mergeEvidenceRefs: []
      };
    }
  };
}

async function createPrMutationScenario(input: PrMutationScenarioInput): Promise<PrMutationScenario> {
  const storage = await createSoloStorage({ url: localDatabaseUrlFromAppDataDir(input.appDataDir) });
  const migrationStatus = await applyMigrations(storage);

  if (migrationStatus.state === "failed") {
    await storage.close();
    throw new Error(migrationStatus.errorMessage);
  }

  const workspaceRoot = join(input.appDataDir, "pr-mutation-workspaces");
  const mutationInputs: AutoImplementationPullRequestMutationInput[] = [];
  const storageApp = createSidecarApp({
    localCapabilityToken: input.localCapabilityToken,
    migrationStatus,
    storage,
    codexRuntimeAdapter: createCodexRuntimeAdapter({ fixtureMode: true, env: {}, now: () => FIXTURE_NOW }),
    autoImplementationWorkspaceRoot: workspaceRoot,
    autoImplementationRemoteStatusProvider: async () => "connected",
    autoImplementationPullRequestMutationAdapter: fixturePrMutationAdapter(mutationInputs)
  });

  return {
    storage,
    storageApp,
    mutationInputs
  };
}

async function preparePrMutationRun(
  scenario: PrMutationScenario,
  localCapabilityToken: string
): Promise<PreparedPrMutationRun> {
  const { projectId, sessionId } = await createSmokeProject({
    app: scenario.storageApp,
    localCapabilityToken,
    rawIdea: "A PR mutation smoke idea that should become a bounded generated implementation lifecycle."
  });
  const sourcePlanningRef = await createSmokePlanningHandoff({
    app: scenario.storageApp,
    storage: scenario.storage,
    localCapabilityToken,
    projectId,
    sessionId,
    fixture: PLANNING_FIXTURE
  });
  const createdRun = await createAutoImplementationRun({ scenario, localCapabilityToken, sessionId, sourcePlanningRef });
  const runId = stringAt(createdRun.runId, "auto implementation runId");

  return { projectId, sessionId, runId };
}

async function exerciseOpenLifecycle(input: {
  readonly scenario: PrMutationScenario;
  readonly localCapabilityToken: string;
  readonly prepared: PreparedPrMutationRun;
}): Promise<OpenLifecycleResult> {
  const blockedOpen = await recordPrMutation({
    scenario: input.scenario,
    localCapabilityToken: input.localCapabilityToken,
    sessionId: input.prepared.sessionId,
    runId: input.prepared.runId,
    body: openPrRequest("pr-mutation-smoke:open-before-initial")
  });

  await persistRunStageState({
    scenario: input.scenario,
    projectId: input.prepared.projectId,
    sessionId: input.prepared.sessionId,
    runId: input.prepared.runId,
    completedStages: ["initial_pr"],
    currentStage: "code_review_fix_1",
    summary: "PR mutation smoke initial stage is complete."
  });

  const opened = await recordPrMutation({
    scenario: input.scenario,
    localCapabilityToken: input.localCapabilityToken,
    sessionId: input.prepared.sessionId,
    runId: input.prepared.runId,
    body: openPrRequest("pr-mutation-smoke:open")
  });
  const bodyUpdated = await recordPrMutation({
    scenario: input.scenario,
    localCapabilityToken: input.localCapabilityToken,
    sessionId: input.prepared.sessionId,
    runId: input.prepared.runId,
    body: updateBodyRequest("pr-mutation-smoke:update-body")
  });

  return { blockedOpen, opened, bodyUpdated };
}

async function exerciseMergeLifecycle(input: {
  readonly scenario: PrMutationScenario;
  readonly localCapabilityToken: string;
  readonly prepared: PreparedPrMutationRun;
}): Promise<MergeLifecycleResult> {
  const blockedBeforeFinalVerify = await recordPrMutation({
    scenario: input.scenario,
    localCapabilityToken: input.localCapabilityToken,
    sessionId: input.prepared.sessionId,
    runId: input.prepared.runId,
    body: mergePrRequest("pr-mutation-smoke:merge-before-final")
  });

  await persistRunStageState({
    scenario: input.scenario,
    projectId: input.prepared.projectId,
    sessionId: input.prepared.sessionId,
    runId: input.prepared.runId,
    completedStages: completedThrough("final_verify_pr_update"),
    currentStage: "merge_main",
    summary: "PR mutation smoke final verification is complete."
  });

  const blockedMissingBody = await recordPrMutation({
    scenario: input.scenario,
    localCapabilityToken: input.localCapabilityToken,
    sessionId: input.prepared.sessionId,
    runId: input.prepared.runId,
    body: mergePrRequest("pr-mutation-smoke:merge-missing-body", [])
  });
  const merged = await recordPrMutation({
    scenario: input.scenario,
    localCapabilityToken: input.localCapabilityToken,
    sessionId: input.prepared.sessionId,
    runId: input.prepared.runId,
    body: mergePrRequest("pr-mutation-smoke:merge")
  });
  const duplicateMerge = await recordPrMutation({
    scenario: input.scenario,
    localCapabilityToken: input.localCapabilityToken,
    sessionId: input.prepared.sessionId,
    runId: input.prepared.runId,
    body: mergePrRequest("pr-mutation-smoke:merge-duplicate", ["pr-body:current-evidence"])
  });

  return { blockedBeforeFinalVerify, blockedMissingBody, merged, duplicateMerge };
}

async function executePrMutationFlow(
  scenario: PrMutationScenario,
  localCapabilityToken: string
): Promise<PrMutationFlowResult> {
  const prepared = await preparePrMutationRun(scenario, localCapabilityToken);
  const openLifecycle = await exerciseOpenLifecycle({ scenario, localCapabilityToken, prepared });
  const mergeLifecycle = await exerciseMergeLifecycle({ scenario, localCapabilityToken, prepared });

  return {
    runId: prepared.runId,
    projectFolderName: PROJECT_FOLDER_NAME,
    ...openLifecycle,
    ...mergeLifecycle,
    mutationInputs: scenario.mutationInputs
  };
}

function includesMarkdown(input: AutoImplementationPullRequestMutationInput | undefined, expected: string) {
  return input?.bodyMarkdown.includes(expected) === true;
}

function appendOpenLifecycleBlockers(result: PrMutationFlowResult, blockers: string[]) {
  if (result.blockedOpen.blockedReason !==
    "GitHub PR open is blocked until initial_pr has completed validated implementation ledger evidence.") {
    blockers.push("PR open did not block before initial_pr ledger evidence.");
  }

  if (result.opened.status !== "applied" || result.opened.pullRequestUrl !== FIXTURE_PR_URL) {
    blockers.push("PR open did not apply through the fixture adapter after initial_pr evidence.");
  }

  if (result.bodyUpdated.status !== "applied" || !result.bodyUpdated.bodyEvidenceRefs.includes("pr-body:current-evidence")) {
    blockers.push("PR body update did not apply with current body evidence.");
  }
}

function appendMergeLifecycleBlockers(result: PrMutationFlowResult, blockers: string[]) {
  if (result.blockedBeforeFinalVerify.blockedReason !==
    "GitHub PR merge is blocked until final_verify_pr_update has completed validated final verification evidence.") {
    blockers.push("PR merge did not block before final_verify_pr_update evidence.");
  }

  if (result.blockedMissingBody.blockedReason !== "GitHub PR merge is blocked until the PR body contains current evidence.") {
    blockers.push("PR merge did not block when current PR body evidence was missing.");
  }

  if (result.merged.status !== "applied" || !result.merged.mergeEvidenceRefs.includes("merge-ready:checks-green")) {
    blockers.push("PR merge did not apply with merge readiness evidence.");
  }

  if (result.duplicateMerge.blockedReason !==
    "GitHub PR merge is blocked because a pull request merge is already recorded for this auto implementation run.") {
    blockers.push("Duplicate PR merge did not block after the first applied merge.");
  }
}

function appendAdapterBlockers(result: PrMutationFlowResult, blockers: string[]) {
  const actions = result.mutationInputs.map((input) => input.action);

  if (actions.join(",") !== "open_pr,update_pr_body,merge_pr") {
    blockers.push(`Fixture adapter actions must be open_pr,update_pr_body,merge_pr; received ${actions.join(",")}.`);
  }

  const openInput = result.mutationInputs.find((input) => input.action === "open_pr");
  const updateInput = result.mutationInputs.find((input) => input.action === "update_pr_body");

  if (!includesMarkdown(openInput, "### Issue traceability")) {
    blockers.push("Generated open PR body did not include issue traceability.");
  }

  if (!includesMarkdown(openInput, "### Issue document status summary")) {
    blockers.push("Generated open PR body did not include issue document status summary.");
  }

  if (!includesMarkdown(openInput, "- Completed issue docs: 1/7")) {
    blockers.push("Generated open PR body did not include completed issue document count.");
  }

  if (!includesMarkdown(openInput, "- Open issue docs: 6")) {
    blockers.push("Generated open PR body did not include open issue document count.");
  }

  if (!includesMarkdown(openInput, "### Stage status summary")) {
    blockers.push("Generated open PR body did not include stage status summary.");
  }

  if (!includesMarkdown(openInput, "- Completed stages: 1/7")) {
    blockers.push("Generated open PR body did not include completed stage count.");
  }

  if (!includesMarkdown(openInput, "### Review gate summary")) {
    blockers.push("Generated open PR body did not include review gate summary.");
  }

  if (!includesMarkdown(openInput, "### Evidence gate summary")) {
    blockers.push("Generated open PR body did not include evidence gate summary.");
  }

  if (!includesMarkdown(openInput, "### Missing-test audit summary")) {
    blockers.push("Generated open PR body did not include missing-test audit summary.");
  }

  if (!includesMarkdown(openInput, "- Completed stage audits: 1/7")) {
    blockers.push("Generated open PR body did not include completed missing-test audit count.");
  }

  if (!includesMarkdown(openInput, "- Zero-gap completed audits: 1/1")) {
    blockers.push("Generated open PR body did not include zero-gap missing-test audit count.");
  }

  if (!includesMarkdown(openInput, "- implementation evidence: present (1 refs)")) {
    blockers.push("Generated open PR body did not include implementation evidence gate status.");
  }

  if (!includesMarkdown(openInput, "- missing-test audit evidence: present (1 refs)")) {
    blockers.push("Generated open PR body did not include missing-test audit evidence gate status.");
  }

  if (!includesMarkdown(openInput, "- feature: satisfied (2/2 no-finding code-review refs recorded)")) {
    blockers.push("Generated open PR body did not include satisfied feature code-review gate summary.");
  }

  if (!includesMarkdown(openInput, "- changed_code: satisfied (2/2 no-finding clean-code review refs recorded)")) {
    blockers.push("Generated open PR body did not include satisfied changed_code clean-code gate summary.");
  }

  if (!includesMarkdown(openInput, "### Implementation evidence")) {
    blockers.push("Generated open PR body did not include implementation evidence.");
  }

  if (!includesMarkdown(openInput, "### Missing-test audit evidence")) {
    blockers.push("Generated open PR body did not include missing-test audit evidence.");
  }

  if (!includesMarkdown(updateInput, "### Verification commands")) {
    blockers.push("Generated PR body update did not include verification commands.");
  }
}

function prMutationResultBlockers(result: PrMutationFlowResult) {
  const blockers: string[] = [];

  appendOpenLifecycleBlockers(result, blockers);
  appendMergeLifecycleBlockers(result, blockers);
  appendAdapterBlockers(result, blockers);
  return blockers;
}

function prMutationEvidence(result: PrMutationFlowResult) {
  return {
    runId: result.runId,
    projectFolderName: result.projectFolderName,
    pullRequestUrl: stringAt(result.opened.pullRequestUrl, "opened pullRequestUrl"),
    blockedOpenReason: result.blockedOpen.blockedReason,
    openStatus: result.opened.status,
    bodyUpdateStatus: result.bodyUpdated.status,
    blockedBeforeFinalVerifyReason: result.blockedBeforeFinalVerify.blockedReason,
    blockedMissingBodyReason: result.blockedMissingBody.blockedReason,
    mergeStatus: result.merged.status,
    duplicateMergeReason: result.duplicateMerge.blockedReason,
    adapterActions: result.mutationInputs.map((input) => input.action),
    bodyMarkdownChecks: [
      "open body includes issue traceability",
      "open body includes issue document status summary",
      "open body includes stage status summary",
      "open body includes review gate summary",
      "open body includes evidence gate summary",
      "open body includes missing-test audit summary",
      "open body includes implementation evidence",
      "open body includes missing-test audit evidence",
      "update body includes verification commands"
    ]
  };
}

function blockedPrMutationEvidence(result: PrMutationFlowResult, blockers: readonly string[]) {
  return {
    status: "blocked" as const,
    smoke: AUTO_IMPLEMENTATION_PR_MUTATION_SMOKE,
    mode: "fixture" as const,
    prMutation: prMutationEvidence(result),
    reason: "Auto implementation PR mutation lifecycle did not satisfy the fixture smoke contract.",
    blockers,
    checked: [
      "isolated project and planning-ready handoff created",
      "auto implementation workspace run created with connected fixture remote status",
      "PR open/update/merge lifecycle exercised through fixture adapter",
      "PR mutation records inspected"
    ]
  };
}

function passedPrMutationEvidence(result: PrMutationFlowResult) {
  return {
    status: "passed" as const,
    smoke: AUTO_IMPLEMENTATION_PR_MUTATION_SMOKE,
    mode: "fixture" as const,
    prMutation: prMutationEvidence(result),
    checked: [
      "default smoke remains credential-free and does not call gh",
      "isolated project and planning-ready handoff created",
      "auto implementation workspace run created with connected fixture remote status",
      "PR open blocked before initial_pr ledger evidence",
      "PR open applied through fixture adapter after initial_pr evidence",
      "PR body update included current body evidence and generated body markdown",
      "PR merge blocked before final verification evidence",
      "PR merge blocked without current PR body evidence",
      "PR merge applied with merge readiness evidence",
      "duplicate PR merge blocked after applied merge"
    ]
  };
}

async function runPrMutationScenario(input: PrMutationScenarioInput) {
  const scenario = await createPrMutationScenario(input);

  try {
    const result = await executePrMutationFlow(scenario, input.localCapabilityToken);
    const blockers = prMutationResultBlockers(result);

    if (blockers.length > 0) {
      return blockedPrMutationEvidence(result, blockers);
    }

    return passedPrMutationEvidence(result);
  } finally {
    await scenario.storage.close();
  }
}

export async function runAutoImplementationPrMutationSmoke(
  options: AutoImplementationPrMutationSmokeOptions = {}
): Promise<AutoImplementationPrMutationSmokeEvidence> {
  const appDataDir = options.appDataDir ?? (await mkdtemp(join(tmpdir(), "solo-superman-pr-mutation-smoke-")));
  const shouldCleanup = options.cleanupAppDataDir ?? !options.appDataDir;
  const localCapabilityToken = options.localCapabilityToken ?? `pr-mutation-smoke-${randomUUID()}`;

  try {
    return await runPrMutationScenario({
      appDataDir,
      localCapabilityToken
    });
  } finally {
    if (shouldCleanup) {
      await removeTemporaryDirectory(appDataDir);
    }
  }
}

function exitCodeForEvidence(evidence: AutoImplementationPrMutationSmokeEvidence) {
  return evidence.status === "passed" ? 0 : 1;
}

async function main() {
  const evidence = await runAutoImplementationPrMutationSmoke();

  console.log(JSON.stringify(evidence, null, 2));
  process.exitCode = exitCodeForEvidence(evidence);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  void main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.stack ?? error.message : String(error));
    process.exitCode = 1;
  });
}
