import { createHash } from "node:crypto";
import { lstat, mkdir, readFile, realpath, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, isAbsolute, relative, resolve, sep, posix as posixPath } from "node:path";
import type {
  ExecutionAuthorityBlockReasonDto,
  ExecutionAuthorityRecord,
  FileDiffChangedFileDto,
  FileDiffStatsDto
} from "@solo-superman/contracts";

export interface FileDiffApplyInput {
  readonly record: ExecutionAuthorityRecord;
  readonly idempotencyKey: string;
  readonly workspaceRoot: string;
  readonly unifiedDiff: string;
}

export interface FileDiffApplyOutput {
  readonly status: "blocked" | "completed" | "failed" | "partial";
  readonly changedFiles: readonly FileDiffChangedFileDto[];
  readonly diffStats: FileDiffStatsDto;
  readonly blockReasons: readonly ExecutionAuthorityBlockReasonDto[];
  readonly evidenceRefs: readonly string[];
  readonly auditRefs: readonly string[];
}

interface ParsedHunkLine {
  readonly kind: "context" | "add" | "remove";
  readonly value: string;
}

interface ParsedHunk {
  readonly oldStart: number;
  readonly lines: readonly ParsedHunkLine[];
}

interface ParsedFilePatch {
  readonly path: string;
  readonly hunks: readonly ParsedHunk[];
  readonly additions: number;
  readonly deletions: number;
  readonly createsFile: boolean;
}

interface MutableFilePatch {
  oldPath: string | null;
  newPath: string | null;
  hunks: ParsedHunk[];
  additions: number;
  deletions: number;
  createsFile: boolean;
}

interface MutableHunk {
  oldStart: number;
  oldLineCount: number;
  newLineCount: number;
  oldConsumed: number;
  newConsumed: number;
  lines: ParsedHunkLine[];
}

export function hashFileDiffPreview(unifiedDiff: string) {
  return `sha256:${createHash("sha256").update(unifiedDiff).digest("hex")}`;
}

function blockReason(
  code: ExecutionAuthorityBlockReasonDto["code"],
  message: string,
  evidenceRefs: readonly string[] = [`file_diff:${code}`]
): ExecutionAuthorityBlockReasonDto {
  return {
    code,
    message,
    evidenceRefs
  };
}

function emptyStats(): FileDiffStatsDto {
  return {
    fileCount: 0,
    additions: 0,
    deletions: 0
  };
}

function fileDiffResult(input: {
  readonly status: FileDiffApplyOutput["status"];
  readonly changedFiles?: readonly FileDiffChangedFileDto[];
  readonly blockReasons?: readonly ExecutionAuthorityBlockReasonDto[];
  readonly evidenceRefs?: readonly string[];
  readonly auditRefs?: readonly string[];
}): FileDiffApplyOutput {
  const changedFiles = input.changedFiles ?? [];

  return {
    status: input.status,
    changedFiles,
    diffStats: changedFiles.reduce<FileDiffStatsDto>(
      (stats, file) => ({
        fileCount: stats.fileCount + 1,
        additions: stats.additions + file.additions,
        deletions: stats.deletions + file.deletions
      }),
      emptyStats()
    ),
    blockReasons: input.blockReasons ?? [],
    evidenceRefs: input.evidenceRefs ?? [],
    auditRefs: input.auditRefs ?? []
  };
}

function headerPath(line: string) {
  const rawPath = line.slice(4).trim();
  const tabIndex = rawPath.indexOf("\t");

  return tabIndex >= 0 ? rawPath.slice(0, tabIndex) : rawPath;
}

function normalizedPatchPath(rawPath: string | null): string | null | "blocked" {
  if (!rawPath || rawPath === "/dev/null") {
    return null;
  }

  const withoutPrefix = rawPath.replace(/^[ab]\//u, "");

  if (
    withoutPrefix.length === 0 ||
    withoutPrefix.startsWith("~") ||
    withoutPrefix.includes("\\") ||
    posixPath.isAbsolute(withoutPrefix)
  ) {
    return "blocked";
  }

  const normalized = posixPath.normalize(withoutPrefix);
  const parts = normalized.split("/");

  if (normalized === "." || normalized.startsWith("../") || parts.includes("..")) {
    return "blocked";
  }

  return normalized;
}

function finalizeFilePatch(patch: MutableFilePatch): ParsedFilePatch | null | "blocked" {
  const newPath = normalizedPatchPath(patch.newPath);
  const oldPath = normalizedPatchPath(patch.oldPath);

  if (newPath === "blocked" || oldPath === "blocked") {
    return "blocked";
  }

  if (!newPath) {
    return "blocked";
  }

  if (oldPath && oldPath !== newPath) {
    return "blocked";
  }

  if (!patch.hunks.length) {
    return "blocked";
  }

  return {
    path: newPath,
    hunks: patch.hunks,
    additions: patch.additions,
    deletions: patch.deletions,
    createsFile: !oldPath
  };
}

function parseHunkHeader(line: string) {
  const match = /^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/u.exec(line);

  if (!match?.[1] || !match[3]) {
    return null;
  }

  return {
    oldStart: Number(match[1]),
    oldLineCount: match[2] === undefined ? 1 : Number(match[2]),
    newLineCount: match[4] === undefined ? 1 : Number(match[4])
  };
}

type DiffMetadataReview = "allowed" | ExecutionAuthorityBlockReasonDto | null;

function reviewDiffMetadataLine(line: string): DiffMetadataReview {
  if (line.startsWith("new file mode ")) {
    return line === "new file mode 100644"
      ? "allowed"
      : blockReason("sandbox_failure", "File diff contains an unsupported new-file mode.");
  }

  if (line.startsWith("index ")) {
    return "allowed";
  }

  if (
    line.startsWith("old mode ") ||
    line.startsWith("new mode ") ||
    line.startsWith("deleted file mode ") ||
    line.startsWith("similarity index ") ||
    line.startsWith("dissimilarity index ") ||
    line.startsWith("rename from ") ||
    line.startsWith("rename to ") ||
    line.startsWith("copy from ") ||
    line.startsWith("copy to ")
  ) {
    return blockReason("sandbox_failure", "File diff contains an unsupported diff entry with file metadata changes.");
  }

  return null;
}

function parseUnifiedDiff(unifiedDiff: string): ParsedFilePatch[] | ExecutionAuthorityBlockReasonDto[] {
  const lines = unifiedDiff.replaceAll("\r\n", "\n").split("\n");
  const patches: ParsedFilePatch[] = [];
  let currentPatch: MutableFilePatch | null = null;
  let currentHunk: MutableHunk | null = null;
  let pendingDiffHeader = false;

  function flushHunk() {
    if (
      currentHunk &&
      (currentHunk.oldConsumed !== currentHunk.oldLineCount || currentHunk.newConsumed !== currentHunk.newLineCount)
    ) {
      return blockReason("sandbox_failure", "File diff hunk ended before its declared line counts were satisfied.");
    }

    if (currentPatch && currentHunk) {
      currentPatch.hunks.push({
        oldStart: currentHunk.oldStart,
        lines: currentHunk.lines
      });
    }

    currentHunk = null;
    return null;
  }

  function flushPatch() {
    const hunkBlock = flushHunk();

    if (hunkBlock) {
      return hunkBlock;
    }

    if (!currentPatch) {
      return null;
    }

    const finalized = finalizeFilePatch(currentPatch);

    if (finalized === "blocked") {
      return blockReason("sandbox_failure", "File diff contains an unsafe, destructive, or unsupported file patch.");
    }

    if (finalized) {
      patches.push(finalized);
    }

    currentPatch = null;
    return null;
  }

  function hunkCountsSatisfied(hunk: MutableHunk) {
    return hunk.oldConsumed === hunk.oldLineCount && hunk.newConsumed === hunk.newLineCount;
  }

  function consumeHunkLine(line: string) {
    if (!currentPatch || !currentHunk) {
      return null;
    }

    const prefix = line[0];
    const value = line.slice(1);

    if (prefix === " ") {
      currentHunk.lines.push({ kind: "context", value });
      currentHunk.oldConsumed += 1;
      currentHunk.newConsumed += 1;
    } else if (prefix === "+") {
      currentHunk.lines.push({ kind: "add", value });
      currentPatch.additions += 1;
      currentHunk.newConsumed += 1;
    } else if (prefix === "-") {
      currentHunk.lines.push({ kind: "remove", value });
      currentPatch.deletions += 1;
      currentHunk.oldConsumed += 1;
    } else {
      return blockReason("sandbox_failure", "File diff contains a malformed hunk line.");
    }

    if (
      currentHunk.oldConsumed > currentHunk.oldLineCount ||
      currentHunk.newConsumed > currentHunk.newLineCount
    ) {
      return blockReason("sandbox_failure", "File diff hunk line counts exceed the declared hunk header.");
    }

    return null;
  }

  for (const line of lines) {
    if (line === "\\ No newline at end of file") {
      return [blockReason("sandbox_failure", "File diff no-newline markers are not supported.")];
    }

    if (currentHunk && hunkCountsSatisfied(currentHunk)) {
      const hunkBlock = flushHunk();

      if (hunkBlock) {
        return [hunkBlock];
      }
    }

    if (currentHunk) {
      const hunkLineBlock = consumeHunkLine(line);

      if (hunkLineBlock) {
        return [hunkLineBlock];
      }

      continue;
    }

    if (line.startsWith("diff --git ")) {
      const flushBlock = flushPatch();

      if (flushBlock) {
        return [flushBlock];
      }

      if (pendingDiffHeader) {
        return [blockReason("sandbox_failure", "File diff contains an unsupported diff entry without text hunks.")];
      }

      pendingDiffHeader = true;
      continue;
    }

    if (line.startsWith("Binary files ") || line === "GIT binary patch") {
      return [blockReason("sandbox_failure", "Binary file diffs are not supported by the file_diff adapter.")];
    }

    const metadataReview = reviewDiffMetadataLine(line);

    if (metadataReview === "allowed") {
      if (!pendingDiffHeader) {
        return [blockReason("sandbox_failure", "File diff contains unsupported content outside file hunks.")];
      }

      continue;
    }

    if (metadataReview) {
      return [metadataReview];
    }

    if (line.startsWith("--- ")) {
      const flushBlock = flushPatch();

      if (flushBlock) {
        return [flushBlock];
      }

      currentPatch = {
        oldPath: headerPath(line),
        newPath: null,
        hunks: [],
        additions: 0,
        deletions: 0,
        createsFile: headerPath(line) === "/dev/null"
      };
      pendingDiffHeader = false;
      continue;
    }

    if (line.startsWith("+++ ")) {
      if (!currentPatch) {
        return [blockReason("sandbox_failure", "File diff new-file header appeared before an old-file header.")];
      }

      currentPatch.newPath = headerPath(line);
      continue;
    }

    if (line.startsWith("@@ ")) {
      if (!currentPatch?.newPath) {
        return [blockReason("sandbox_failure", "File diff hunk appeared before a complete file header.")];
      }

      flushHunk();
      const parsedHeader = parseHunkHeader(line);

      if (!parsedHeader) {
        return [blockReason("sandbox_failure", "File diff contains a malformed hunk header.")];
      }

      currentHunk = {
        oldStart: parsedHeader.oldStart,
        oldLineCount: parsedHeader.oldLineCount,
        newLineCount: parsedHeader.newLineCount,
        oldConsumed: 0,
        newConsumed: 0,
        lines: []
      };
      continue;
    }

    if (line.trim().length > 0 && pendingDiffHeader) {
      return [blockReason("sandbox_failure", "File diff contains unsupported diff metadata.")];
    }

    if (line.trim().length > 0) {
      return [blockReason("sandbox_failure", "File diff contains unsupported content outside file hunks.")];
    }
  }

  const flushBlock = flushPatch();

  if (flushBlock) {
    return [flushBlock];
  }

  if (pendingDiffHeader) {
    return [blockReason("sandbox_failure", "File diff contains an unsupported diff entry without text hunks.")];
  }

  if (!patches.length) {
    return [blockReason("sandbox_failure", "File diff did not include any patchable file hunks.")];
  }

  return patches;
}

function compileGlob(glob: string) {
  const normalized = glob.replace(/^\//u, "");

  if (normalized === "**" || normalized === "**/*") {
    return /^.*$/u;
  }

  if (normalized.endsWith("/**")) {
    const prefix = normalized.slice(0, -3).replace(/[.+^${}()|[\]\\]/gu, "\\$&");

    return new RegExp(`^${prefix}(?:/.*)?$`, "u");
  }

  const escaped = normalized
    .replace(/[.+^${}()|[\]\\]/gu, "\\$&")
    .replace(/\*\*/gu, "\0")
    .replace(/\*/gu, "[^/]*")
    .replaceAll("\0", ".*");

  return new RegExp(`^${escaped}$`, "u");
}

function pathMatchesAllowedGlobs(path: string, globs: readonly string[] | undefined) {
  if (!globs?.length) {
    return false;
  }

  return globs.some((glob) => compileGlob(glob).test(path));
}

function duplicatePatchPathBlockReason(
  patches: readonly ParsedFilePatch[]
): ExecutionAuthorityBlockReasonDto | null {
  const seenPaths = new Set<string>();

  for (const patch of patches) {
    if (seenPaths.has(patch.path)) {
      return blockReason(
        "sandbox_failure",
        `File diff contains multiple patch entries for the same target: ${patch.path}`
      );
    }

    seenPaths.add(patch.path);
  }

  return null;
}

function sensitivePathReason(path: string) {
  const parts = path.split("/").map((part) => part.toLowerCase());

  if (parts.some((part) => /^\.env(?:\.|$)/u.test(part))) {
    return "File diff targets .env-style files, which are always blocked.";
  }

  if (parts.some((part) => part === ".ssh" || part === ".aws" || part === ".config")) {
    return "File diff targets a credential-bearing home/config directory, which is always blocked.";
  }

  if (parts.some((part) => /(?:credential|secret|password|api[_-]?key|private[_-]?key|token)/u.test(part))) {
    return "File diff targets credential/secret/key material, which is always blocked.";
  }

  return null;
}

function isInsideDirectory(parent: string, child: string) {
  const relativePath = relative(parent, child);

  return relativePath === "" || (!relativePath.startsWith("..") && !isAbsolute(relativePath));
}

function isFilesystemRoot(path: string) {
  return dirname(path) === path;
}

async function realExistingAncestor(path: string) {
  let candidate = path;

  while (true) {
    try {
      await lstat(candidate);
      return realpath(candidate);
    } catch {
      const parent = dirname(candidate);

      if (parent === candidate) {
        throw new Error(`No existing ancestor found for ${path}.`);
      }

      candidate = parent;
    }
  }
}

async function assertSafeWorkspacePath(input: {
  readonly realWorkspaceRoot: string;
  readonly patchPath: string;
}): Promise<ExecutionAuthorityBlockReasonDto | null> {
  const targetPath = resolve(input.realWorkspaceRoot, input.patchPath.split("/").join(sep));

  if (!isInsideDirectory(input.realWorkspaceRoot, targetPath)) {
    return blockReason("sandbox_failure", `File diff target escapes the approved workspace: ${input.patchPath}`);
  }

  const sensitiveReason = sensitivePathReason(input.patchPath);

  if (sensitiveReason) {
    return blockReason("credential_value_required", sensitiveReason, [`file_diff:sensitive_path:${input.patchPath}`]);
  }

  try {
    const realAncestor = await realExistingAncestor(targetPath);

    if (!isInsideDirectory(input.realWorkspaceRoot, realAncestor)) {
      return blockReason("sandbox_failure", `File diff target follows a symlink outside the workspace: ${input.patchPath}`);
    }
  } catch (error) {
    return blockReason(
      "sandbox_failure",
      error instanceof Error ? error.message : `File diff could not validate path ${input.patchPath}.`
    );
  }

  return null;
}

function workspaceRefMatches(record: ExecutionAuthorityRecord, workspaceRoot: string, realWorkspaceRoot: string) {
  const workspaceRef = record.requestedScope.workspaceRef;

  if (!workspaceRef) {
    return false;
  }

  const acceptedRefs = new Set([
    workspaceRoot,
    realWorkspaceRoot,
    `workspace:${workspaceRoot}`,
    `workspace:${realWorkspaceRoot}`
  ]);

  return acceptedRefs.has(workspaceRef);
}

function splitFileLines(text: string) {
  const normalized = text.replaceAll("\r\n", "\n");

  if (normalized.length === 0) {
    return [];
  }

  return (normalized.endsWith("\n") ? normalized.slice(0, -1) : normalized).split("\n");
}

function applyParsedPatchToText(originalText: string, patch: ParsedFilePatch): string | ExecutionAuthorityBlockReasonDto {
  const originalLines = splitFileLines(originalText);
  const outputLines: string[] = [];
  let originalIndex = 0;

  for (const hunk of patch.hunks) {
    const targetIndex = Math.max(hunk.oldStart - 1, 0);

    if (targetIndex < originalIndex || targetIndex > originalLines.length) {
      return blockReason("sandbox_failure", `File diff hunk range does not match ${patch.path}.`);
    }

    outputLines.push(...originalLines.slice(originalIndex, targetIndex));
    originalIndex = targetIndex;

    for (const line of hunk.lines) {
      if (line.kind === "add") {
        outputLines.push(line.value);
        continue;
      }

      const currentLine = originalLines[originalIndex];

      if (currentLine !== line.value) {
        return blockReason("sandbox_failure", `File diff hunk context does not match ${patch.path}.`);
      }

      if (line.kind === "context") {
        outputLines.push(currentLine);
      }

      originalIndex += 1;
    }
  }

  outputLines.push(...originalLines.slice(originalIndex));

  return `${outputLines.join("\n")}\n`;
}

async function readPatchTarget(workspaceRoot: string, patch: ParsedFilePatch) {
  const path = resolve(workspaceRoot, patch.path.split("/").join(sep));

  if (patch.createsFile) {
    try {
      await lstat(path);

      return new Error(`File diff create hunk refused to overwrite existing target ${patch.path}.`);
    } catch (error) {
      const code = typeof error === "object" && error !== null && "code" in error
        ? String((error as { readonly code?: unknown }).code)
        : null;

      if (code === "ENOENT") {
        return "";
      }

      return error instanceof Error ? error : new Error(`Could not validate new file target ${patch.path}.`);
    }
  }

  try {
    return await readFile(path, "utf8");
  } catch (error) {
    return error instanceof Error ? error : new Error(`Could not read ${patch.path}.`);
  }
}

export async function applyFileDiff(input: FileDiffApplyInput): Promise<FileDiffApplyOutput> {
  if (input.record.actionClass !== "file_diff") {
    return fileDiffResult({
      status: "blocked",
      blockReasons: [blockReason("sandbox_failure", "Only file_diff authority records can run the file_diff adapter.")]
    });
  }

  const computedHash = hashFileDiffPreview(input.unifiedDiff);

  if (computedHash !== input.record.previewArtifactHash) {
    return fileDiffResult({
      status: "blocked",
      blockReasons: [
        blockReason(
          "preview_hash_mismatch",
          "File diff body hash does not match the approved preview artifact hash."
        )
      ]
    });
  }

  if (!input.record.rollbackReference) {
    return fileDiffResult({
      status: "blocked",
      blockReasons: [blockReason("missing_rollback", "file_diff execution requires a rollback reference.")]
    });
  }

  if (input.record.rollbackReference.kind === "filesystem_snapshot") {
    // Allowed by the contract only as an explicit exception; the audit trail below records the exception use.
  } else if (input.record.rollbackReference.kind !== "git_diff_reverse") {
    return fileDiffResult({
      status: "blocked",
      blockReasons: [blockReason("missing_rollback", "file_diff rollback must be git_diff_reverse or filesystem_snapshot.")]
    });
  }

  const resolvedWorkspaceRoot = resolve(input.workspaceRoot);

  if (!isAbsolute(input.workspaceRoot) || resolvedWorkspaceRoot === homedir() || isFilesystemRoot(resolvedWorkspaceRoot)) {
    return fileDiffResult({
      status: "blocked",
      blockReasons: [
        blockReason(
          "sandbox_failure",
          "workspaceRoot must be an absolute project workspace, not the home or filesystem root directory."
        )
      ]
    });
  }

  let realWorkspaceRoot: string;

  try {
    realWorkspaceRoot = await realpath(input.workspaceRoot);
  } catch {
    return fileDiffResult({
      status: "blocked",
      blockReasons: [blockReason("sandbox_failure", "workspaceRoot must exist before file_diff execution.")]
    });
  }

  if (realWorkspaceRoot === homedir() || isFilesystemRoot(realWorkspaceRoot)) {
    return fileDiffResult({
      status: "blocked",
      blockReasons: [
        blockReason(
          "sandbox_failure",
          "workspaceRoot must resolve to a project workspace, not the home or filesystem root directory."
        )
      ]
    });
  }

  if (!workspaceRefMatches(input.record, input.workspaceRoot, realWorkspaceRoot)) {
    return fileDiffResult({
      status: "blocked",
      blockReasons: [blockReason("sandbox_failure", "workspaceRoot does not match the approved authority workspaceRef.")]
    });
  }

  const parsed = parseUnifiedDiff(input.unifiedDiff);

  const firstParsedItem = parsed[0];

  if (firstParsedItem && "code" in firstParsedItem) {
    return fileDiffResult({
      status: "blocked",
      blockReasons: parsed as readonly ExecutionAuthorityBlockReasonDto[]
    });
  }

  const patches = parsed as readonly ParsedFilePatch[];
  const validationReasons: ExecutionAuthorityBlockReasonDto[] = [];
  const duplicatePathReason = duplicatePatchPathBlockReason(patches);

  if (duplicatePathReason) {
    validationReasons.push(duplicatePathReason);
  }

  for (const patch of patches) {
    if (!pathMatchesAllowedGlobs(patch.path, input.record.requestedScope.filePathGlobs)) {
      validationReasons.push(
        blockReason("sandbox_failure", `File diff target is outside approved filePathGlobs: ${patch.path}`)
      );
    }

    const pathReason = await assertSafeWorkspacePath({ realWorkspaceRoot, patchPath: patch.path });

    if (pathReason) {
      validationReasons.push(pathReason);
    }
  }

  if (validationReasons.length) {
    return fileDiffResult({
      status: "blocked",
      blockReasons: validationReasons
    });
  }

  const writes: { readonly path: string; readonly text: string }[] = [];

  for (const patch of patches) {
    const originalText = await readPatchTarget(realWorkspaceRoot, patch);

    if (originalText instanceof Error) {
      return fileDiffResult({
        status: "failed",
        blockReasons: [blockReason("sandbox_failure", originalText.message)]
      });
    }

    const patchedText = applyParsedPatchToText(originalText, patch);

    if (typeof patchedText !== "string") {
      return fileDiffResult({
        status: "failed",
        blockReasons: [patchedText]
      });
    }

    writes.push({
      path: resolve(realWorkspaceRoot, patch.path.split("/").join(sep)),
      text: patchedText
    });
  }

  const changedFiles = patches.map<FileDiffChangedFileDto>((patch) => ({
    path: patch.path,
    additions: patch.additions,
    deletions: patch.deletions
  }));
  const writtenFiles: FileDiffChangedFileDto[] = [];

  try {
    for (const [index, write] of writes.entries()) {
      await mkdir(dirname(write.path), { recursive: true });
      await writeFile(write.path, write.text, "utf8");
      const changedFile = changedFiles[index];

      if (changedFile) {
        writtenFiles.push(changedFile);
      }
    }
  } catch (error) {
    return fileDiffResult({
      status: "partial",
      changedFiles: writtenFiles,
      blockReasons: [
        blockReason(
          "sandbox_failure",
          error instanceof Error ? error.message : "File diff write failed after validation."
        )
      ]
    });
  }

  const rollbackExceptionRefs = input.record.rollbackReference.kind === "filesystem_snapshot"
    ? {
        evidenceRefs: [`file_diff:filesystem_snapshot_exception:${input.idempotencyKey}`],
        auditRefs: [`audit:file_diff:filesystem_snapshot_exception:${input.idempotencyKey}`]
      }
    : {
        evidenceRefs: [],
        auditRefs: []
      };

  return fileDiffResult({
    status: "completed",
    changedFiles,
    evidenceRefs: [
      `file_diff:preview_hash:${computedHash}`,
      `file_diff:changed_files:${changedFiles.map((file) => file.path).join(",")}`,
      `file_diff:stats:+${changedFiles.reduce((sum, file) => sum + file.additions, 0)}-${changedFiles.reduce(
        (sum, file) => sum + file.deletions,
        0
      )}`,
      ...rollbackExceptionRefs.evidenceRefs
    ],
    auditRefs: [`audit:file_diff:${input.idempotencyKey}`, ...rollbackExceptionRefs.auditRefs]
  });
}
