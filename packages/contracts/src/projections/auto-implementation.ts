import type { ProjectionVersion, SchemaVersion, SessionId } from "../ids";

export const AUTO_IMPLEMENTATION_SCHEMA_VERSION = "solo-superman.auto-implementation.v1" as SchemaVersion;
export const AUTO_IMPLEMENTATION_TICK_INTERVAL_MS = 5 * 60 * 1000;

export const AUTO_IMPLEMENTATION_STAGES = [
  "initial_pr",
  "code_review_fix_1",
  "code_review_fix_2",
  "clean_code_fix_1",
  "clean_code_fix_2",
  "final_verify_pr_update",
  "merge_main"
] as const;

export const AUTO_IMPLEMENTATION_STAGE_LABELS = {
  initial_pr: "Initial implementation and PR creation",
  code_review_fix_1: "PR code review and fix pass 1",
  code_review_fix_2: "PR code review and fix pass 2",
  clean_code_fix_1: "Clean-code review and fix pass 1",
  clean_code_fix_2: "Broader clean-code review and fix pass 2",
  final_verify_pr_update: "PR description update and final test pass",
  merge_main: "Merge to main"
} as const satisfies Record<AutoImplementationStage, string>;

export const AUTO_IMPLEMENTATION_RUN_STATUSES = [
  "pending",
  "running",
  "paused",
  "blocked",
  "completed",
  "failed"
] as const;

export const AUTO_IMPLEMENTATION_STAGE_STATUSES = [
  "pending",
  "ready",
  "running",
  "completed",
  "blocked",
  "failed"
] as const;

export const AUTO_IMPLEMENTATION_REMOTE_STATUSES = [
  "connected",
  "not_authenticated",
  "no_remote",
  "permission_denied",
  "offline"
] as const;

export const AUTO_IMPLEMENTATION_ISSUE_MODES = ["github_ready", "markdown_fallback"] as const;

export const DEFAULT_AUTO_IMPLEMENTATION_ISSUE_TITLES = [
  "Workspace repo bootstrap and initial implementation PR",
  "PR code review and fix pass 1",
  "PR code review and fix pass 2",
  "Clean-code review and fix pass 1",
  "Broader clean-code review and fix pass 2",
  "Final PR description update and full verification",
  "Merge verified PR to main"
] as const;

export type AutoImplementationStage = (typeof AUTO_IMPLEMENTATION_STAGES)[number];
export type AutoImplementationRunStatus = (typeof AUTO_IMPLEMENTATION_RUN_STATUSES)[number];
export type AutoImplementationStageStatus = (typeof AUTO_IMPLEMENTATION_STAGE_STATUSES)[number];
export type AutoImplementationRemoteStatus = (typeof AUTO_IMPLEMENTATION_REMOTE_STATUSES)[number];
export type AutoImplementationIssueMode = (typeof AUTO_IMPLEMENTATION_ISSUE_MODES)[number];

export interface AutoImplementationStageRecord {
  readonly stage: AutoImplementationStage;
  readonly label: string;
  readonly status: AutoImplementationStageStatus;
  readonly sequenceOrder: number;
  readonly nextScheduledAt: string | null;
  readonly evidenceRefs: readonly string[];
}

export interface AutoImplementationRemoteGuide {
  readonly status: AutoImplementationRemoteStatus;
  readonly warning: string | null;
  readonly commands: readonly string[];
  readonly nextAction: string;
}

export interface AutoImplementationIssueDocument {
  readonly issueId: string;
  readonly title: string;
  readonly relativePath: string;
  readonly stage: AutoImplementationStage;
  readonly status: "open" | "completed" | "blocked";
}

export interface AutoImplementationIssueManagement {
  readonly mode: AutoImplementationIssueMode;
  readonly trackerRelativePath: string;
  readonly issueDocs: readonly AutoImplementationIssueDocument[];
  readonly githubIssueUrls: readonly string[];
  readonly warning: string | null;
}

export interface AutoImplementationRun {
  readonly runId: string;
  readonly projectFolderName: string;
  readonly workspaceRoot: string;
  readonly generatedRepoPath: string;
  readonly gitDefaultBranch: "main";
  readonly currentStage: AutoImplementationStage;
  readonly status: AutoImplementationRunStatus;
  readonly remoteStatus: AutoImplementationRemoteStatus;
  readonly nextTickAt: string;
  readonly stagePlan: readonly AutoImplementationStageRecord[];
  readonly issueManagement: AutoImplementationIssueManagement;
  readonly remoteGuide: AutoImplementationRemoteGuide;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly evidenceRefs: readonly string[];
}

export interface AutoImplementationRunProjection {
  readonly kind: "AutoImplementationRunProjection";
  readonly sessionId: SessionId;
  readonly version: ProjectionVersion;
  readonly latestRun: AutoImplementationRun | null;
  readonly runs: readonly AutoImplementationRun[];
  readonly summary: string;
  readonly refetchUrl: string;
  readonly schemaVersion: SchemaVersion;
}

export interface CreateAutoImplementationRunRequest {
  readonly sessionId: SessionId;
  readonly idempotencyKey: string;
  readonly projectFolderName?: string;
  readonly projectName?: string;
  readonly sourcePlanningRef?: string;
  readonly trackerTitle?: string;
  readonly trackerGoal?: string;
  readonly issueTitles?: readonly string[];
}

export class AutoImplementationRunValidationError extends Error {
  constructor(readonly issues: readonly string[]) {
    super(`Invalid AutoImplementationRunProjection: ${issues.join("; ")}`);
    this.name = "AutoImplementationRunValidationError";
  }
}

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isStringArray(value: unknown): value is readonly string[] {
  return Array.isArray(value) && value.every(isNonEmptyString);
}

function isOneOf<TValue extends string>(value: unknown, values: readonly TValue[]): value is TValue {
  return typeof value === "string" && values.includes(value as TValue);
}

function validFolderName(value: string) {
  return /^[a-z0-9](?:[a-z0-9._-]{0,78}[a-z0-9])?$/u.test(value) && value !== "." && value !== ".." && value !== ".git";
}

function isStageRecord(value: unknown): value is AutoImplementationStageRecord {
  return isRecord(value) &&
    isOneOf(value.stage, AUTO_IMPLEMENTATION_STAGES) &&
    isNonEmptyString(value.label) &&
    isOneOf(value.status, AUTO_IMPLEMENTATION_STAGE_STATUSES) &&
    typeof value.sequenceOrder === "number" &&
    Number.isInteger(value.sequenceOrder) &&
    value.sequenceOrder >= 1 &&
    (value.nextScheduledAt === null || isNonEmptyString(value.nextScheduledAt)) &&
    isStringArray(value.evidenceRefs);
}

function isRemoteGuide(value: unknown): value is AutoImplementationRemoteGuide {
  return isRecord(value) &&
    isOneOf(value.status, AUTO_IMPLEMENTATION_REMOTE_STATUSES) &&
    (value.warning === null || isNonEmptyString(value.warning)) &&
    isStringArray(value.commands) &&
    isNonEmptyString(value.nextAction);
}

function isIssueDoc(value: unknown): value is AutoImplementationIssueDocument {
  return isRecord(value) &&
    isNonEmptyString(value.issueId) &&
    isNonEmptyString(value.title) &&
    isNonEmptyString(value.relativePath) &&
    isOneOf(value.stage, AUTO_IMPLEMENTATION_STAGES) &&
    isOneOf(value.status, ["open", "completed", "blocked"] as const);
}

function isIssueManagement(value: unknown): value is AutoImplementationIssueManagement {
  return isRecord(value) &&
    isOneOf(value.mode, AUTO_IMPLEMENTATION_ISSUE_MODES) &&
    isNonEmptyString(value.trackerRelativePath) &&
    Array.isArray(value.issueDocs) &&
    value.issueDocs.every(isIssueDoc) &&
    isStringArray(value.githubIssueUrls) &&
    (value.warning === null || isNonEmptyString(value.warning));
}

function isRun(value: unknown): value is AutoImplementationRun {
  return isRecord(value) &&
    isNonEmptyString(value.runId) &&
    isNonEmptyString(value.projectFolderName) &&
    validFolderName(value.projectFolderName) &&
    isNonEmptyString(value.workspaceRoot) &&
    isNonEmptyString(value.generatedRepoPath) &&
    value.gitDefaultBranch === "main" &&
    isOneOf(value.currentStage, AUTO_IMPLEMENTATION_STAGES) &&
    isOneOf(value.status, AUTO_IMPLEMENTATION_RUN_STATUSES) &&
    isOneOf(value.remoteStatus, AUTO_IMPLEMENTATION_REMOTE_STATUSES) &&
    isNonEmptyString(value.nextTickAt) &&
    Array.isArray(value.stagePlan) &&
    value.stagePlan.length === AUTO_IMPLEMENTATION_STAGES.length &&
    value.stagePlan.every(isStageRecord) &&
    isIssueManagement(value.issueManagement) &&
    isRemoteGuide(value.remoteGuide) &&
    isNonEmptyString(value.createdAt) &&
    isNonEmptyString(value.updatedAt) &&
    isStringArray(value.evidenceRefs) &&
    value.evidenceRefs.length > 0;
}

export function validateAutoImplementationRunProjection(
  projection: AutoImplementationRunProjection
): AutoImplementationRunProjection {
  const issues: string[] = [];

  if (projection.kind !== "AutoImplementationRunProjection") {
    issues.push("kind must be AutoImplementationRunProjection");
  }
  if (!isNonEmptyString(projection.sessionId)) {
    issues.push("sessionId must be set");
  }
  if (typeof projection.version !== "number" || projection.version < 1) {
    issues.push("version must be a positive projection version");
  }
  if (projection.latestRun !== null && !isRun(projection.latestRun)) {
    issues.push("latestRun must be a valid auto implementation run or null");
  }
  if (!Array.isArray(projection.runs) || !projection.runs.every(isRun)) {
    issues.push("runs must be valid auto implementation run records");
  }
  if (projection.latestRun && projection.runs.at(-1)?.runId !== projection.latestRun.runId) {
    issues.push("latestRun must match the last run record");
  }
  if (!isNonEmptyString(projection.summary)) {
    issues.push("summary must be set");
  }
  if (!isNonEmptyString(projection.refetchUrl)) {
    issues.push("refetchUrl must be set");
  }
  if (projection.schemaVersion !== AUTO_IMPLEMENTATION_SCHEMA_VERSION) {
    issues.push("schemaVersion must match AUTO_IMPLEMENTATION_SCHEMA_VERSION");
  }

  if (issues.length) {
    throw new AutoImplementationRunValidationError(issues);
  }

  return projection;
}

const AUTO_IMPLEMENTATION_RUN_READY_FIXTURE_RUN: AutoImplementationRun = {
  runId: "auto_run_demo",
  projectFolderName: "demo-project",
  workspaceRoot: "/repo/workspace",
  generatedRepoPath: "/repo/workspace/demo-project",
  gitDefaultBranch: "main",
  currentStage: "initial_pr",
  status: "pending",
  remoteStatus: "no_remote",
  nextTickAt: "2026-05-19T00:05:00.000Z",
  stagePlan: AUTO_IMPLEMENTATION_STAGES.map((stage, index) => ({
    stage,
    label: AUTO_IMPLEMENTATION_STAGE_LABELS[stage],
    status: index === 0 ? "ready" : "pending",
    sequenceOrder: index + 1,
    nextScheduledAt: index === 0 ? "2026-05-19T00:05:00.000Z" : null,
    evidenceRefs: []
  })),
  issueManagement: {
    mode: "markdown_fallback",
    trackerRelativePath: "implementation-tracker.md",
    issueDocs: AUTO_IMPLEMENTATION_STAGES.map((stage, index) => ({
      issueId: `local-${String(index + 1).padStart(3, "0")}`,
      title: DEFAULT_AUTO_IMPLEMENTATION_ISSUE_TITLES[index]!,
      relativePath: `implementation-issues/${String(index + 1).padStart(3, "0")}-${stage}.md`,
      stage,
      status: "open"
    })),
    githubIssueUrls: [],
    warning: "Remote is not connected; local markdown issues are the source of truth."
  },
  remoteGuide: {
    status: "no_remote",
    warning: "Remote is not connected; local markdown issues are the source of truth.",
    commands: ["git remote add origin <github-repo-url>", "git push -u origin main", "gh auth login"],
    nextAction: "Connect a GitHub remote when remote issue/PR automation is desired."
  },
  createdAt: "2026-05-19T00:00:00.000Z",
  updatedAt: "2026-05-19T00:00:00.000Z",
  evidenceRefs: ["workspace:demo-project", "git:init:main", "issues:markdown_fallback"]
};

export const AUTO_IMPLEMENTATION_RUN_READY_FIXTURE: AutoImplementationRunProjection =
  validateAutoImplementationRunProjection({
    kind: "AutoImplementationRunProjection",
    sessionId: "demo-session" as SessionId,
    version: 1 as ProjectionVersion,
    latestRun: AUTO_IMPLEMENTATION_RUN_READY_FIXTURE_RUN,
    runs: [AUTO_IMPLEMENTATION_RUN_READY_FIXTURE_RUN],
    summary: "Auto implementation workspace is ready for demo-project; remote status is no_remote.",
    refetchUrl: "/api/v1/sessions/demo-session/auto-implementation-runs",
    schemaVersion: AUTO_IMPLEMENTATION_SCHEMA_VERSION
  });
