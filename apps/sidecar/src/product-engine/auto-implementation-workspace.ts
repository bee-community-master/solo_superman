import { createHash } from "node:crypto";
import { execFile } from "node:child_process";
import { lstat, mkdir, readFile, rename, unlink, writeFile } from "node:fs/promises";
import { basename, dirname, isAbsolute, relative, resolve, sep } from "node:path";
import { promisify } from "node:util";
import {
  AUTO_IMPLEMENTATION_SCHEMA_VERSION,
  AUTO_IMPLEMENTATION_STAGE_LABELS,
  AUTO_IMPLEMENTATION_STAGES,
  AUTO_IMPLEMENTATION_TICK_INTERVAL_MS,
  DEFAULT_AUTO_IMPLEMENTATION_ISSUE_TITLES,
  type AutoImplementationIssueDocument,
  type AutoImplementationRemoteGuide,
  type AutoImplementationRemoteStatus,
  type AutoImplementationRun,
  type AutoImplementationStage,
  type CreateAutoImplementationRunRequest,
  type SessionId
} from "@solo-superman/contracts";

const execFileAsync = promisify(execFile);
const COMMAND_TIMEOUT_MS = 10_000;

export interface PrepareAutoImplementationWorkspaceInput {
  readonly sessionId: SessionId;
  readonly runId: string;
  readonly request: CreateAutoImplementationRunRequest;
  readonly workspaceRoot: string;
  readonly now: string;
}

function shortHash(value: string) {
  return createHash("sha256").update(value).digest("hex").slice(0, 16);
}

export function autoImplementationRunId(sessionId: SessionId, idempotencyKey: string) {
  return `auto_run_${shortHash(`${sessionId}:${idempotencyKey}`)}`;
}

export function defaultAutoImplementationWorkspaceRoot() {
  return resolve(process.cwd(), "workspace");
}

export function sanitizeProjectFolderName(input: string) {
  const slug = input
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/gu, "-")
    .replace(/^[._-]+|[._-]+$/gu, "")
    .replace(/[-_]{2,}/gu, "-")
    .slice(0, 80)
    .replace(/[._-]+$/u, "");

  if (!slug || slug === "." || slug === ".." || slug === ".git") {
    return "solo-superman-project";
  }

  return slug;
}

function isInsideDirectory(parent: string, child: string) {
  const relativePath = relative(parent, child);

  return relativePath === "" || (!relativePath.startsWith("..") && !isAbsolute(relativePath));
}

function assertInsideDirectory(parent: string, child: string, message: string) {
  if (!isInsideDirectory(parent, child)) {
    throw new Error(message);
  }
}

async function lstatOrNull(path: string) {
  try {
    return await lstat(path);
  } catch (error) {
    const maybeError = error as { readonly code?: string };

    if (maybeError.code === "ENOENT") {
      return null;
    }

    throw error;
  }
}

async function ensureRealDirectoryWithin(workspaceRoot: string, directoryPath: string) {
  const resolvedRoot = resolve(workspaceRoot);
  const resolvedDirectoryPath = resolve(directoryPath);

  assertInsideDirectory(
    resolvedRoot,
    resolvedDirectoryPath,
    "Workspace output directory must stay inside the configured workspace root."
  );

  const rootStat = await lstatOrNull(resolvedRoot);

  if (!rootStat) {
    await mkdir(resolvedRoot, { recursive: true });
  } else if (rootStat.isSymbolicLink() || !rootStat.isDirectory()) {
    throw new Error("Workspace root must be a real directory.");
  }

  const relativeDirectoryPath = relative(resolvedRoot, resolvedDirectoryPath);
  const segments = relativeDirectoryPath ? relativeDirectoryPath.split(sep).filter(Boolean) : [];
  let current = resolvedRoot;

  for (const segment of segments) {
    current = resolve(current, segment);

    const segmentStat = await lstatOrNull(current);

    if (!segmentStat) {
      try {
        await mkdir(current);
      } catch (error) {
        const maybeError = error as { readonly code?: string };

        if (maybeError.code !== "EEXIST") {
          throw error;
        }

        const raceStat = await lstatOrNull(current);

        if (raceStat?.isSymbolicLink() || !raceStat?.isDirectory()) {
          throw new Error("Workspace output directories must not contain symbolic links.", { cause: error });
        }
      }
      continue;
    }

    if (segmentStat.isSymbolicLink() || !segmentStat.isDirectory()) {
      throw new Error("Workspace output directories must not contain symbolic links.");
    }
  }
}

async function git(cwd: string, args: readonly string[]) {
  const { stdout } = await execFileAsync("git", args, {
    cwd,
    encoding: "utf8",
    maxBuffer: 1024 * 1024,
    timeout: COMMAND_TIMEOUT_MS
  });

  return stdout.trim();
}

async function safeGit(cwd: string, args: readonly string[]) {
  try {
    return { ok: true as const, stdout: await git(cwd, args), stderr: "" };
  } catch (error) {
    const maybeError = error as { stderr?: string; message?: string };

    return {
      ok: false as const,
      stdout: "",
      stderr: maybeError.stderr ?? maybeError.message ?? "git command failed"
    };
  }
}

async function ensureGitRepo(projectDir: string) {
  const existingRepo = await safeGit(projectDir, ["rev-parse", "--is-inside-work-tree"]);

  if (existingRepo.ok && existingRepo.stdout === "true") {
    const currentBranch = await git(projectDir, ["branch", "--show-current"]);

    if (currentBranch !== "main") {
      throw new Error("Auto implementation workspace git repo must be on main.");
    }

    return "git:existing:main";
  }

  if (await lstatOrNull(resolve(projectDir, ".git"))) {
    throw new Error("Existing .git metadata is not a valid git repository.");
  }

  const init = await safeGit(projectDir, ["init", "-b", "main"]);

  if (!init.ok) {
    await git(projectDir, ["init"]);
    await git(projectDir, ["checkout", "-B", "main"]);
  }

  const currentBranch = await git(projectDir, ["branch", "--show-current"]);

  if (currentBranch !== "main") {
    throw new Error("Auto implementation workspace git repo must be on main.");
  }

  return "git:init:main";
}

function addMinutes(isoDate: string, millis: number) {
  return new Date(Date.parse(isoDate) + millis).toISOString();
}

function remoteGuide(status: AutoImplementationRemoteStatus): AutoImplementationRemoteGuide {
  switch (status) {
    case "connected":
      return {
        status,
        warning: null,
        commands: [],
        nextAction: "Remote issue, PR, and merge automation can run when the later runner stage is enabled."
      };
    case "not_authenticated":
      return {
        status,
        warning: "GitHub remote exists, but gh is not authenticated. Local markdown issues remain active until login succeeds.",
        commands: ["gh auth login", "gh auth status", "git push -u origin main"],
        nextAction: "Sign in with gh, then retry the auto implementation run."
      };
    case "permission_denied":
      return {
        status,
        warning: "GitHub remote exists, but the current account cannot access it. Local markdown issues remain active.",
        commands: ["gh auth status", "git remote -v", "git push -u origin main"],
        nextAction: "Check repository permissions or update origin to a writable GitHub repo."
      };
    case "offline":
      return {
        status,
        warning: "GitHub remote could not be reached. Local markdown issues remain active until connectivity recovers.",
        commands: ["git remote -v", "git ls-remote origin HEAD"],
        nextAction: "Reconnect to the network, then retry the auto implementation run."
      };
    case "no_remote":
      return {
        status,
        warning: "Remote is not connected; local markdown issues are the source of truth.",
        commands: ["git remote add origin <github-repo-url>", "gh auth login", "git push -u origin main"],
        nextAction: "Connect a GitHub remote when remote issue/PR automation is desired."
      };
  }
}

async function remoteStatus(projectDir: string): Promise<AutoImplementationRemoteStatus> {
  const origin = await safeGit(projectDir, ["remote", "get-url", "origin"]);

  if (!origin.ok || origin.stdout.trim().length === 0) {
    return "no_remote";
  }

  const ghStatus = await execFileAsync("gh", ["auth", "status"], {
    cwd: projectDir,
    encoding: "utf8",
    maxBuffer: 1024 * 1024,
    timeout: COMMAND_TIMEOUT_MS
  }).then(
    () => true,
    () => false
  );

  if (!ghStatus) {
    return "not_authenticated";
  }

  const remoteReachable = await safeGit(projectDir, ["ls-remote", "--exit-code", "origin", "HEAD"]);

  if (remoteReachable.ok) {
    return "connected";
  }

  return /permission|denied|not found|authentication|authorization/iu.test(remoteReachable.stderr)
    ? "permission_denied"
    : "offline";
}

function stagePlan(nextTickAt: string) {
  return AUTO_IMPLEMENTATION_STAGES.map((stage, index) => ({
    stage,
    label: AUTO_IMPLEMENTATION_STAGE_LABELS[stage],
    status: index === 0 ? "ready" as const : "pending" as const,
    sequenceOrder: index + 1,
    nextScheduledAt: index === 0 ? nextTickAt : null,
    evidenceRefs: []
  }));
}

function markdownFileName(index: number, stage: AutoImplementationStage) {
  return `${String(index + 1).padStart(3, "0")}-${stage}.md`;
}

function trackerMarkdown(input: {
  readonly title: string;
  readonly goal: string;
  readonly runId: string;
  readonly projectFolderName: string;
  readonly sourcePlanningRef: string;
  readonly issueDocs: readonly AutoImplementationIssueDocument[];
  readonly remoteGuide: AutoImplementationRemoteGuide;
}) {
  return [
    `# ${input.title}`,
    "",
    `- Run: ${input.runId}`,
    `- Project folder: ${input.projectFolderName}`,
    `- Goal: ${input.goal}`,
    `- Source planning ref: ${input.sourcePlanningRef}`,
    `- Remote status: ${input.remoteGuide.status}`,
    input.remoteGuide.warning ? `- Remote warning: ${input.remoteGuide.warning}` : "- Remote warning: none",
    "",
    "## Local issue sequence",
    "",
    ...input.issueDocs.map((issue) => `- [ ] ${issue.issueId} ${issue.title} (${issue.relativePath})`),
    "",
    "## Remote connection guide",
    "",
    input.remoteGuide.nextAction,
    "",
    ...input.remoteGuide.commands.map((command) => `\`${command}\``),
    ""
  ].join("\n");
}

function issueMarkdown(input: {
  readonly issue: AutoImplementationIssueDocument;
  readonly trackerTitle: string;
  readonly goal: string;
  readonly sourcePlanningRef: string;
}) {
  return [
    `# ${input.issue.title}`,
    "",
    `- Local issue id: ${input.issue.issueId}`,
    `- Stage: ${input.issue.stage}`,
    `- Tracker: ${input.trackerTitle}`,
    `- Goal: ${input.goal}`,
    `- Source planning ref: ${input.sourcePlanningRef}`,
    "",
    "## Acceptance",
    "",
    "- The stage leaves durable git, review, test, or blocker evidence.",
    "- Any missing remote connection remains visible instead of blocking local work.",
    "- No credential, token, session cookie, production deploy, or external final-submit action is stored or executed.",
    "",
    "## Verification",
    "",
    "- Run the stage-specific targeted tests first.",
    "- Run the project final verification command before the final merge stage.",
    "",
    "## Stop condition",
    "",
    "Stop and record a blocker when a new dependency, external service mutation, credential requirement, or production action is needed.",
    ""
  ].join("\n");
}

async function writeIfChanged(workspaceRoot: string, path: string, content: string) {
  const resolvedWorkspaceRoot = resolve(workspaceRoot);
  const resolvedPath = resolve(path);

  assertInsideDirectory(
    resolvedWorkspaceRoot,
    resolvedPath,
    "Workspace output file must stay inside the configured workspace root."
  );
  await ensureRealDirectoryWithin(resolvedWorkspaceRoot, dirname(resolvedPath));

  const fileStat = await lstatOrNull(resolvedPath);

  if (fileStat?.isSymbolicLink() || fileStat?.isDirectory()) {
    throw new Error("Workspace output files must be regular files.");
  }

  let existing: string | null;

  try {
    existing = await readFile(resolvedPath, "utf8");
  } catch (error) {
    const maybeError = error as { readonly code?: string };

    if (maybeError.code !== "ENOENT") {
      throw error;
    }

    existing = null;
  }

  if (existing !== content) {
    const temporaryPath = resolve(dirname(resolvedPath), `.${basename(resolvedPath)}.${process.pid}.${Date.now()}.tmp`);

    assertInsideDirectory(
      resolvedWorkspaceRoot,
      temporaryPath,
      "Workspace temporary output file must stay inside the configured workspace root."
    );

    try {
      await writeFile(temporaryPath, content, { encoding: "utf8", flag: "wx" });
      await rename(temporaryPath, resolvedPath);
    } catch (error) {
      await unlink(temporaryPath).catch(() => undefined);
      throw error;
    }
  }
}

export async function prepareAutoImplementationWorkspaceRun(
  input: PrepareAutoImplementationWorkspaceInput
): Promise<AutoImplementationRun> {
  const workspaceRoot = resolve(input.workspaceRoot);
  const projectFolderName = sanitizeProjectFolderName(
    input.request.projectFolderName ?? input.request.projectName ?? "solo-superman-project"
  );
  const generatedRepoPath = resolve(workspaceRoot, projectFolderName);

  if (!isInsideDirectory(workspaceRoot, generatedRepoPath) || generatedRepoPath === workspaceRoot) {
    throw new Error("Generated repo path must stay inside the configured workspace root.");
  }

  await ensureRealDirectoryWithin(workspaceRoot, generatedRepoPath);
  const gitEvidence = await ensureGitRepo(generatedRepoPath);
  const status = await remoteStatus(generatedRepoPath);
  const guide = remoteGuide(status);
  const nextTickAt = addMinutes(input.now, AUTO_IMPLEMENTATION_TICK_INTERVAL_MS);
  const sourcePlanningRef = input.request.sourcePlanningRef ?? `session:${input.sessionId}`;
  const trackerTitle = input.request.trackerTitle ?? "Solo Superman auto implementation tracker";
  const trackerGoal = input.request.trackerGoal ?? "Move the planning handoff into a reviewed local program repo.";
  const issueTitles = input.request.issueTitles?.length ? input.request.issueTitles : DEFAULT_AUTO_IMPLEMENTATION_ISSUE_TITLES;
  const issueDocs = AUTO_IMPLEMENTATION_STAGES.map((stage, index) => ({
    issueId: `local-${String(index + 1).padStart(3, "0")}`,
    title: issueTitles[index] ?? DEFAULT_AUTO_IMPLEMENTATION_ISSUE_TITLES[index]!,
    relativePath: `implementation-issues/${markdownFileName(index, stage)}`,
    stage,
    status: "open" as const
  }));
  const issueMode = status === "connected" ? "github_ready" as const : "markdown_fallback" as const;
  const trackerRelativePath = "implementation-tracker.md";

  await writeIfChanged(
    workspaceRoot,
    resolve(generatedRepoPath, trackerRelativePath),
    trackerMarkdown({
      title: trackerTitle,
      goal: trackerGoal,
      runId: input.runId,
      projectFolderName,
      sourcePlanningRef,
      issueDocs,
      remoteGuide: guide
    })
  );

  await Promise.all(issueDocs.map((issue) =>
    writeIfChanged(
      workspaceRoot,
      resolve(generatedRepoPath, issue.relativePath.split("/").join(sep)),
      issueMarkdown({ issue, trackerTitle, goal: trackerGoal, sourcePlanningRef })
    )
  ));

  const manifestRelativePath = ".solo-superman/auto-implementation-run.json";
  const run: AutoImplementationRun = {
    runId: input.runId,
    projectFolderName,
    workspaceRoot,
    generatedRepoPath,
    gitDefaultBranch: "main",
    currentStage: "initial_pr",
    status: "pending",
    remoteStatus: status,
    nextTickAt,
    stagePlan: stagePlan(nextTickAt),
    issueManagement: {
      mode: issueMode,
      trackerRelativePath,
      issueDocs,
      githubIssueUrls: [],
      warning: guide.warning
    },
    remoteGuide: guide,
    createdAt: input.now,
    updatedAt: input.now,
    evidenceRefs: [
      `workspace:${projectFolderName}`,
      gitEvidence,
      `issues:${issueMode}`,
      `manifest:${manifestRelativePath}`,
      `schema:${AUTO_IMPLEMENTATION_SCHEMA_VERSION}`
    ]
  };

  await writeIfChanged(workspaceRoot, resolve(generatedRepoPath, manifestRelativePath), `${JSON.stringify(run, null, 2)}\n`);

  return run;
}
