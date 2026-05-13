import { execFile } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { afterEach, describe, expect, it } from "vitest";
import { captureStepCommitRecordFromGit } from "./implementation-step-ledger-git";

const execFileAsync = promisify(execFile);
const tempDirs: string[] = [];

async function git(repoRoot: string, args: readonly string[]) {
  const { stdout } = await execFileAsync("git", ["-C", repoRoot, ...args], {
    encoding: "utf8"
  });

  return stdout.trim();
}

async function createGitFixture() {
  const repoRoot = await mkdtemp(join(tmpdir(), "solo-superman-ledger-git-"));

  tempDirs.push(repoRoot);
  await git(repoRoot, ["init"]);
  await git(repoRoot, ["config", "user.name", "Solo Superman Test"]);
  await git(repoRoot, ["config", "user.email", "solo-superman-test@example.invalid"]);
  await writeFile(join(repoRoot, "feature.txt"), "before\n", "utf8");
  await git(repoRoot, ["add", "feature.txt"]);
  await git(repoRoot, ["commit", "-m", "baseline"]);
  const previousCommitSha = await git(repoRoot, ["rev-parse", "HEAD"]);

  await writeFile(join(repoRoot, "feature.txt"), "after\n", "utf8");
  await writeFile(join(repoRoot, "new-file.txt"), "new\n", "utf8");
  await git(repoRoot, ["add", "feature.txt", "new-file.txt"]);
  await git(repoRoot, ["commit", "-m", "implementation step"]);
  const commitSha = await git(repoRoot, ["rev-parse", "HEAD"]);

  return {
    repoRoot,
    previousCommitSha,
    commitSha
  };
}

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((tempDir) => rm(tempDir, { recursive: true, force: true })));
});

describe("captureStepCommitRecordFromGit", () => {
  it("captures actual commit SHAs, diff range, changed files, rollback ref, and evidence refs from a git fixture", async () => {
    const fixture = await createGitFixture();
    const record = await captureStepCommitRecordFromGit({
      repoRoot: fixture.repoRoot,
      stepId: "step_git_fixture",
      previousRef: fixture.previousCommitSha,
      commitRef: fixture.commitSha,
      evidenceRefs: ["test:git-fixture"]
    });

    expect(record).toEqual({
      stepId: "step_git_fixture",
      commitSha: fixture.commitSha,
      previousCommitSha: fixture.previousCommitSha,
      diffRange: `${fixture.previousCommitSha}..${fixture.commitSha}`,
      changedFiles: ["feature.txt", "new-file.txt"],
      rollbackRef: `rollback:git-revert:${fixture.commitSha}`,
      evidenceRefs: ["test:git-fixture"]
    });
  });
});
