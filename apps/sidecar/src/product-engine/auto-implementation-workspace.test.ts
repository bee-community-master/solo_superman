import { describe, expect, it } from "vitest";
import { chmod, mkdir, mkdtemp, readdir, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { delimiter, join } from "node:path";
import {
  autoImplementationPullRequestGhArgs,
  ghAutoImplementationPullRequestMutationAdapter,
  isGitHubRemoteUrl,
  sanitizeProjectFolderName
} from "./auto-implementation-workspace";

describe("auto implementation workspace helpers", () => {
  it("recognizes common GitHub remote URL shapes without classifying URL schemes as SCP hosts", () => {
    expect(isGitHubRemoteUrl("https://github.com/bee-community-master/solo_superman.git")).toBe(true);
    expect(isGitHubRemoteUrl("git@github.com:bee-community-master/solo_superman.git")).toBe(true);
    expect(isGitHubRemoteUrl("ssh://git@github.com/bee-community-master/solo_superman.git")).toBe(true);
    expect(isGitHubRemoteUrl("https://gitlab.com/bee-community-master/solo_superman.git")).toBe(false);
    expect(isGitHubRemoteUrl("/tmp/local-bare-repo.git")).toBe(false);
  });

  it("uses deterministic safe fallback folders for non-ASCII or reserved project names", () => {
    expect(sanitizeProjectFolderName("Demo Workspace App")).toBe("demo-workspace-app");
    expect(sanitizeProjectFolderName("고양이 펜팔 서비스")).toMatch(/^solo-superman-project-[a-f0-9]{16}$/u);
    expect(sanitizeProjectFolderName("con")).toMatch(/^solo-superman-project-[a-f0-9]{16}$/u);
  });

  it("builds GitHub PR commands with body-file args instead of inline body text", () => {
    const longBody = "검증 결과\n".repeat(2_000);

    expect(autoImplementationPullRequestGhArgs({
      action: "open_pr",
      pullRequestTitle: "Generated implementation",
      pullRequestUrl: null,
      bodyFilePath: ".solo-superman/pr-body.md"
    })).toEqual([
      "pr",
      "create",
      "--title",
      "Generated implementation",
      "--body-file",
      ".solo-superman/pr-body.md"
    ]);
    expect(autoImplementationPullRequestGhArgs({
      action: "update_pr_body",
      pullRequestTitle: "Generated implementation",
      pullRequestUrl: "https://github.com/bee-community-master/generated-demo/pull/123",
      bodyFilePath: ".solo-superman/pr-body.md"
    })).toEqual([
      "pr",
      "edit",
      "https://github.com/bee-community-master/generated-demo/pull/123",
      "--body-file",
      ".solo-superman/pr-body.md"
    ]);
    expect(autoImplementationPullRequestGhArgs({
      action: "open_pr",
      pullRequestTitle: "Generated implementation",
      pullRequestUrl: null,
      bodyFilePath: longBody
    })).not.toContain("--body");
  });

  it.runIf(process.platform !== "win32")("passes generated PR bodies through a temporary body file and cleans it up", async () => {
    const tempRoot = await mkdtemp(join(tmpdir(), "solo-pr-body-file-test-"));
    const fakeBin = join(tempRoot, "bin");
    const projectDir = join(tempRoot, "project");
    const ghLogPath = join(tempRoot, "gh-log.jsonl");

    await mkdir(fakeBin, { recursive: true });
    await mkdir(projectDir, { recursive: true });

    const fakeGhPath = join(fakeBin, "gh");

    await writeFile(
      fakeGhPath,
      [
        "#!/usr/bin/env node",
        "const { appendFileSync, existsSync, readFileSync } = require('node:fs');",
        "const args = process.argv.slice(2);",
        "const bodyFileIndex = args.indexOf('--body-file');",
        "const bodyFile = bodyFileIndex >= 0 ? args[bodyFileIndex + 1] : null;",
        "const body = bodyFile ? readFileSync(bodyFile, 'utf8') : '';",
        "appendFileSync(process.env.SOLO_FAKE_GH_LOG, JSON.stringify({ args, bodyFile, body, bodyExistsDuringRun: bodyFile ? existsSync(bodyFile) : null }) + '\\n');",
        "if (args[0] === 'pr' && args[1] === 'create') { console.log('https://github.com/bee-community-master/generated-demo/pull/123'); process.exit(0); }",
        "if (args[0] === 'pr' && args[1] === 'edit') { process.exit(0); }",
        "if (args[0] === 'pr' && args[1] === 'merge') { process.exit(0); }",
        "process.exit(2);"
      ].join("\n"),
      "utf8"
    );
    await chmod(fakeGhPath, 0o755);

    const previousPath = process.env.PATH;
    const previousLog = process.env.SOLO_FAKE_GH_LOG;

    process.env.PATH = `${fakeBin}${delimiter}${previousPath ?? ""}`;
    process.env.SOLO_FAKE_GH_LOG = ghLogPath;

    try {
      const bodyMarkdown = ["# Final PR body", "검증: pnpm verify", "리뷰: 2회 연속 no finding"].join("\n");
      const opened = await ghAutoImplementationPullRequestMutationAdapter.mutate({
        projectDir,
        action: "open_pr",
        pullRequestTitle: "Generated implementation",
        pullRequestUrl: null,
        bodyMarkdown
      });
      await ghAutoImplementationPullRequestMutationAdapter.mutate({
        projectDir,
        action: "update_pr_body",
        pullRequestTitle: "Generated implementation",
        pullRequestUrl: opened.pullRequestUrl,
        bodyMarkdown: `${bodyMarkdown}\n최종 점검 완료`
      });

      const logEntries = (await readFile(ghLogPath, "utf8"))
        .trim()
        .split("\n")
        .map((line) => JSON.parse(line) as { readonly args: readonly string[]; readonly bodyFile: string; readonly body: string; readonly bodyExistsDuringRun: boolean });
      const metadataFilesAfterMutation = await readdir(join(projectDir, ".solo-superman"));

      expect(opened).toMatchObject({
        pullRequestUrl: "https://github.com/bee-community-master/generated-demo/pull/123",
        auditEvidenceRefs: expect.arrayContaining(["github-pr-mutation:gh:body-file"])
      });
      expect(logEntries).toHaveLength(2);
      expect(logEntries[0]?.args).toEqual(expect.arrayContaining(["pr", "create", "--body-file"]));
      expect(logEntries[0]?.args).not.toContain("--body");
      expect(logEntries[0]?.body).toBe(bodyMarkdown);
      expect(logEntries[0]?.bodyExistsDuringRun).toBe(true);
      expect(logEntries[1]?.args).toEqual(expect.arrayContaining(["pr", "edit", opened.pullRequestUrl, "--body-file"]));
      expect(logEntries[1]?.args).not.toContain("--body");
      expect(logEntries[1]?.body).toContain("최종 점검 완료");
      expect(metadataFilesAfterMutation.filter((file) => file.startsWith("github-pr-body-"))).toEqual([]);
    } finally {
      process.env.PATH = previousPath;
      if (previousLog === undefined) {
        delete process.env.SOLO_FAKE_GH_LOG;
      } else {
        process.env.SOLO_FAKE_GH_LOG = previousLog;
      }
    }
  });
});
