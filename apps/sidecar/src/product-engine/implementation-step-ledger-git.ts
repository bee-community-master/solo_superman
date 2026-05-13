import { execFile } from "node:child_process";
import { promisify } from "node:util";
import type { StepCommitRecord } from "@solo-superman/contracts";

const execFileAsync = promisify(execFile);

export interface CaptureStepCommitRecordInput {
  readonly stepId: string;
  readonly repoRoot: string;
  readonly previousRef?: string;
  readonly commitRef?: string;
  readonly evidenceRefs?: readonly string[];
}

async function git(repoRoot: string, args: readonly string[]) {
  const { stdout } = await execFileAsync("git", ["-C", repoRoot, ...args], {
    encoding: "utf8",
    maxBuffer: 1024 * 1024
  });

  return stdout.trim();
}

export async function captureStepCommitRecordFromGit(
  input: CaptureStepCommitRecordInput
): Promise<StepCommitRecord> {
  const previousCommitSha = await git(input.repoRoot, [
    "rev-parse",
    "--verify",
    input.previousRef ?? "HEAD~1"
  ]);
  const commitSha = await git(input.repoRoot, ["rev-parse", "--verify", input.commitRef ?? "HEAD"]);
  const diffRange = `${previousCommitSha}..${commitSha}`;
  const changedFiles = (await git(input.repoRoot, ["diff", "--name-only", diffRange, "--"]))
    .split(/\r?\n/u)
    .map((line) => line.trim())
    .filter(Boolean);

  if (!changedFiles.length) {
    throw new Error("Implementation step git snapshot requires at least one changed tracked file.");
  }

  return {
    stepId: input.stepId,
    commitSha,
    previousCommitSha,
    diffRange,
    changedFiles,
    rollbackRef: `rollback:git-revert:${commitSha}`,
    evidenceRefs: input.evidenceRefs?.length ? input.evidenceRefs : [`git-diff:${diffRange}`]
  };
}
