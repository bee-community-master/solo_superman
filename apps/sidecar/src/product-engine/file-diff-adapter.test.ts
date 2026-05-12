import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  EXECUTION_AUTHORITY_SCHEMA_VERSION,
  type ExecutionAuthorityRecord
} from "@solo-superman/contracts";
import { applyFileDiff, hashFileDiffPreview } from "./file-diff-adapter";

const tempDirs: string[] = [];

async function makeWorkspace() {
  const workspaceRoot = await mkdtemp(join(tmpdir(), "solo-file-diff-adapter-"));
  tempDirs.push(workspaceRoot);

  return workspaceRoot;
}

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

function authorityRecord(input: {
  readonly workspaceRoot: string;
  readonly unifiedDiff: string;
  readonly filePathGlobs?: readonly string[];
  readonly rollbackKind?: "git_diff_reverse" | "filesystem_snapshot";
}): ExecutionAuthorityRecord {
  const previewArtifactHash = hashFileDiffPreview(input.unifiedDiff);

  return {
    recordId: "exec_auth_file_diff_adapter_unit",
    sourcePlanningHandoffRef: "planning_handoff_file_diff_adapter_unit",
    boundedAgentOutputId: "bounded_output_file_diff_adapter_unit",
    actionClass: "file_diff",
    previewArtifactRef: "preview:file_diff_adapter_unit",
    previewArtifactHash,
    reviewedPreviewArtifactHash: previewArtifactHash,
    requestedScope: {
      workspaceRef: `workspace:${input.workspaceRoot}`,
      filePathGlobs: input.filePathGlobs ?? ["**/*"]
    },
    approvalDecision: "approved",
    approver: {
      actorId: "unit_test_operator",
      actorType: "local_operator",
      approvedAt: "2026-05-13T00:00:00.000Z",
      decidedAt: "2026-05-13T00:00:00.000Z"
    },
    sandboxBoundary: {
      mode: "workspace_patch",
      networkPolicy: "blocked",
      secretPolicy: "no_secret_values"
    },
    rollbackReference: {
      kind: input.rollbackKind ?? "git_diff_reverse",
      ref: "rollback:file_diff_adapter_unit"
    },
    executionResult: "not_run",
    blockReasons: [],
    evidenceRefs: ["evidence:file_diff_adapter_unit"],
    auditRefs: ["audit:file_diff_adapter_unit"],
    createdAt: "2026-05-13T00:00:00.000Z",
    schemaVersion: EXECUTION_AUTHORITY_SCHEMA_VERSION
  };
}

describe("file_diff adapter", () => {
  it("treats hunk body lines that look like diff headers as file content", async () => {
    const workspaceRoot = await makeWorkspace();
    const targetPath = join(workspaceRoot, "header-like-content.txt");

    await writeFile(targetPath, "-- keep\n++ keep\n", "utf8");

    const unifiedDiff = [
      "diff --git a/header-like-content.txt b/header-like-content.txt",
      "--- a/header-like-content.txt",
      "+++ b/header-like-content.txt",
      "@@ -1,2 +1,2 @@",
      "--- keep",
      "-++ keep",
      "+-- changed",
      "+++ changed",
      ""
    ].join("\n");
    const result = await applyFileDiff({
      record: authorityRecord({ workspaceRoot, unifiedDiff }),
      idempotencyKey: "file-diff:header-like-content",
      workspaceRoot,
      unifiedDiff
    });

    expect(result).toMatchObject({
      status: "completed",
      changedFiles: [
        {
          path: "header-like-content.txt",
          additions: 2,
          deletions: 2
        }
      ]
    });
    await expect(readFile(targetPath, "utf8")).resolves.toBe("-- changed\n++ changed\n");
  });

  it("blocks unsupported diff entries instead of silently ignoring them", async () => {
    const workspaceRoot = await makeWorkspace();
    const targetPath = join(workspaceRoot, "mode-only.txt");

    await writeFile(targetPath, "old\n", "utf8");

    const unifiedDiff = [
      "diff --git a/mode-only.txt b/mode-only.txt",
      "old mode 100644",
      "new mode 100755",
      "diff --git a/mode-only.txt b/mode-only.txt",
      "--- a/mode-only.txt",
      "+++ b/mode-only.txt",
      "@@ -1 +1 @@",
      "-old",
      "+new",
      ""
    ].join("\n");
    const result = await applyFileDiff({
      record: authorityRecord({ workspaceRoot, unifiedDiff }),
      idempotencyKey: "file-diff:unsupported-entry",
      workspaceRoot,
      unifiedDiff
    });

    expect(result).toMatchObject({
      status: "blocked",
      changedFiles: [],
      blockReasons: [
        expect.objectContaining({
          code: "sandbox_failure",
          message: expect.stringContaining("unsupported diff entry")
        })
      ]
    });
    await expect(readFile(targetPath, "utf8")).resolves.toBe("old\n");
  });

  it("blocks file metadata changes even when text hunks are present", async () => {
    const workspaceRoot = await makeWorkspace();
    const targetPath = join(workspaceRoot, "mode-change.txt");

    await writeFile(targetPath, "old\n", "utf8");

    const unifiedDiff = [
      "diff --git a/mode-change.txt b/mode-change.txt",
      "old mode 100644",
      "new mode 100755",
      "--- a/mode-change.txt",
      "+++ b/mode-change.txt",
      "@@ -1 +1 @@",
      "-old",
      "+new",
      ""
    ].join("\n");
    const result = await applyFileDiff({
      record: authorityRecord({ workspaceRoot, unifiedDiff }),
      idempotencyKey: "file-diff:mode-change",
      workspaceRoot,
      unifiedDiff
    });

    expect(result).toMatchObject({
      status: "blocked",
      changedFiles: [],
      blockReasons: [
        expect.objectContaining({
          code: "sandbox_failure",
          message: expect.stringContaining("metadata")
        })
      ]
    });
    await expect(readFile(targetPath, "utf8")).resolves.toBe("old\n");
  });

  it.each([
    {
      name: "unknown diff metadata",
      fileName: "unknown-metadata.txt",
      idempotencyKey: "file-diff:unknown-metadata",
      expectedMessage: "unsupported diff metadata",
      lines: [
        "diff --git a/unknown-metadata.txt b/unknown-metadata.txt",
        "unknown metadata 100644",
        "--- a/unknown-metadata.txt",
        "+++ b/unknown-metadata.txt",
        "@@ -1 +1 @@",
        "-old",
        "+new",
        ""
      ]
    },
    {
      name: "unexpected non-hunk content",
      fileName: "trailing-garbage.txt",
      idempotencyKey: "file-diff:trailing-garbage",
      expectedMessage: "unsupported content",
      lines: [
        "diff --git a/trailing-garbage.txt b/trailing-garbage.txt",
        "--- a/trailing-garbage.txt",
        "+++ b/trailing-garbage.txt",
        "@@ -1 +1 @@",
        "-old",
        "+new",
        "unexpected footer",
        ""
      ]
    },
    {
      name: "diff metadata outside the diff header section",
      fileName: "misplaced-metadata.txt",
      idempotencyKey: "file-diff:misplaced-metadata",
      expectedMessage: "unsupported content",
      lines: [
        "diff --git a/misplaced-metadata.txt b/misplaced-metadata.txt",
        "--- a/misplaced-metadata.txt",
        "+++ b/misplaced-metadata.txt",
        "@@ -1 +1 @@",
        "-old",
        "+new",
        "index 1111111..2222222 100644",
        ""
      ]
    }
  ])("blocks $name instead of applying a partially parsed diff", async (scenario) => {
    const workspaceRoot = await makeWorkspace();
    const targetPath = join(workspaceRoot, scenario.fileName);

    await writeFile(targetPath, "old\n", "utf8");

    const unifiedDiff = scenario.lines.join("\n");
    const result = await applyFileDiff({
      record: authorityRecord({ workspaceRoot, unifiedDiff }),
      idempotencyKey: scenario.idempotencyKey,
      workspaceRoot,
      unifiedDiff
    });

    expect(result).toMatchObject({
      status: "blocked",
      changedFiles: [],
      blockReasons: [
        expect.objectContaining({
          code: "sandbox_failure",
          message: expect.stringContaining(scenario.expectedMessage)
        })
      ]
    });
    await expect(readFile(targetPath, "utf8")).resolves.toBe("old\n");
  });

  it("blocks no-newline markers instead of silently changing file endings", async () => {
    const workspaceRoot = await makeWorkspace();
    const targetPath = join(workspaceRoot, "no-newline.txt");

    await writeFile(targetPath, "old", "utf8");

    const unifiedDiff = [
      "diff --git a/no-newline.txt b/no-newline.txt",
      "--- a/no-newline.txt",
      "+++ b/no-newline.txt",
      "@@ -1 +1 @@",
      "-old",
      "\\ No newline at end of file",
      "+new",
      "\\ No newline at end of file",
      ""
    ].join("\n");
    const result = await applyFileDiff({
      record: authorityRecord({ workspaceRoot, unifiedDiff }),
      idempotencyKey: "file-diff:no-newline",
      workspaceRoot,
      unifiedDiff
    });

    expect(result).toMatchObject({
      status: "blocked",
      changedFiles: [],
      blockReasons: [
        expect.objectContaining({
          code: "sandbox_failure",
          message: expect.stringContaining("no-newline")
        })
      ]
    });
    await expect(readFile(targetPath, "utf8")).resolves.toBe("old");
  });

  it("blocks duplicate patch targets instead of applying competing stale writes", async () => {
    const workspaceRoot = await makeWorkspace();
    const targetPath = join(workspaceRoot, "duplicate-target.txt");

    await writeFile(targetPath, "old\n", "utf8");

    const unifiedDiff = [
      "diff --git a/duplicate-target.txt b/duplicate-target.txt",
      "--- a/duplicate-target.txt",
      "+++ b/duplicate-target.txt",
      "@@ -1 +1 @@",
      "-old",
      "+first",
      "diff --git a/duplicate-target.txt b/duplicate-target.txt",
      "--- a/duplicate-target.txt",
      "+++ b/duplicate-target.txt",
      "@@ -1 +1 @@",
      "-old",
      "+second",
      ""
    ].join("\n");
    const result = await applyFileDiff({
      record: authorityRecord({ workspaceRoot, unifiedDiff }),
      idempotencyKey: "file-diff:duplicate-target",
      workspaceRoot,
      unifiedDiff
    });

    expect(result).toMatchObject({
      status: "blocked",
      changedFiles: [],
      blockReasons: [
        expect.objectContaining({
          code: "sandbox_failure",
          message: expect.stringContaining("multiple patch entries")
        })
      ]
    });
    await expect(readFile(targetPath, "utf8")).resolves.toBe("old\n");
  });

  it("blocks filesystem root as a workspace root", async () => {
    const unifiedDiff = [
      "diff --git a/tmp/solo-superman-root-block.txt b/tmp/solo-superman-root-block.txt",
      "--- a/tmp/solo-superman-root-block.txt",
      "+++ b/tmp/solo-superman-root-block.txt",
      "@@ -1 +1 @@",
      "-old",
      "+new",
      ""
    ].join("\n");
    const result = await applyFileDiff({
      record: authorityRecord({
        workspaceRoot: "/",
        unifiedDiff,
        filePathGlobs: ["tmp/**"]
      }),
      idempotencyKey: "file-diff:root-workspace",
      workspaceRoot: "/",
      unifiedDiff
    });

    expect(result).toMatchObject({
      status: "blocked",
      blockReasons: [
        expect.objectContaining({
          code: "sandbox_failure",
          message: expect.stringContaining("filesystem root")
        })
      ]
    });
  });

  it("records evidence and audit refs for filesystem_snapshot rollback exceptions", async () => {
    const workspaceRoot = await makeWorkspace();
    const targetPath = join(workspaceRoot, "snapshot-exception.txt");

    await writeFile(targetPath, "old\n", "utf8");

    const unifiedDiff = [
      "diff --git a/snapshot-exception.txt b/snapshot-exception.txt",
      "--- a/snapshot-exception.txt",
      "+++ b/snapshot-exception.txt",
      "@@ -1 +1 @@",
      "-old",
      "+new",
      ""
    ].join("\n");
    const result = await applyFileDiff({
      record: authorityRecord({ workspaceRoot, unifiedDiff, rollbackKind: "filesystem_snapshot" }),
      idempotencyKey: "file-diff:snapshot-exception",
      workspaceRoot,
      unifiedDiff
    });

    expect(result).toMatchObject({
      status: "completed",
      evidenceRefs: expect.arrayContaining([
        "file_diff:filesystem_snapshot_exception:file-diff:snapshot-exception"
      ]),
      auditRefs: expect.arrayContaining([
        "audit:file_diff:filesystem_snapshot_exception:file-diff:snapshot-exception"
      ])
    });
    await expect(readFile(targetPath, "utf8")).resolves.toBe("new\n");
  });
});
