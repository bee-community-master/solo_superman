import { createHash } from "node:crypto";
import { spawn } from "node:child_process";
import { constants as fsConstants } from "node:fs";
import { access, readFile, realpath, stat } from "node:fs/promises";
import { homedir } from "node:os";
import { delimiter, dirname, isAbsolute, relative, resolve, sep, posix as posixPath } from "node:path";
import type {
  ExecutionAuthorityBlockReasonDto,
  ExecutionAuthorityRecord,
  ShellCommandExecutionResult,
  ShellCommandRunSummaryDto
} from "@solo-superman/contracts";
import { containsExecutionAuthoritySecretValueLeak } from "@solo-superman/contracts";

export interface ShellCommandApplyInput {
  readonly record: ExecutionAuthorityRecord;
  readonly idempotencyKey: string;
  readonly workspaceRoot: string;
  readonly command: readonly string[];
  readonly workingDirectory?: string;
}

export interface ShellCommandApplyOutput {
  readonly status: ShellCommandExecutionResult["status"];
  readonly command: ShellCommandRunSummaryDto;
  readonly exitCode: number | null;
  readonly durationMs: number;
  readonly stdoutSummary: string;
  readonly stderrSummary: string;
  readonly blockReasons: readonly ExecutionAuthorityBlockReasonDto[];
  readonly evidenceRefs: readonly string[];
  readonly auditRefs: readonly string[];
}

interface PackageJsonShape {
  readonly scripts?: Readonly<Record<string, unknown>>;
}

type ShellCommandClass = "diagnostic" | "test" | "build_or_full_verify";
type AllowedCommandReview = { readonly kind: "allowed"; readonly commandClass: ShellCommandClass };
type BlockedCommandReview = {
  readonly kind: "blocked";
  readonly blockReasons: readonly ExecutionAuthorityBlockReasonDto[];
};
type CommandReviewResult =
  | AllowedCommandReview
  | BlockedCommandReview
  | { readonly kind: "not_applicable" };

const READ_ONLY_DIAGNOSTIC_TIMEOUT_MS = 30_000;
const TEST_LINT_DOCS_TIMEOUT_MS = 600_000;
const BUILD_OR_FULL_VERIFY_TIMEOUT_MS = 1_200_000;
const RAW_OUTPUT_CAPTURE_MAX_CHARS = 64_000;
const OUTPUT_SUMMARY_MAX_CHARS = 4_000;
const OUTPUT_SUMMARY_MAX_LINES = 40;
const DEFAULT_WINDOWS_PATHEXT = ".COM;.EXE;.BAT;.CMD";

const READ_ONLY_DIAGNOSTIC_EXECUTABLES = new Set(["ls", "cat", "rg", "git"]);
const SAFE_GIT_STATUS_ARGS = new Set(["status", "--short", "--porcelain", "--branch"]);
const SAFE_LS_ARGS = new Set(["--", "-1", "-a", "-l", "-la", "-al", "-h", "-lh", "-hl", "-lah", "-alh"]);
const SAFE_CAT_ARGS = new Set(["--", "-n", "-b", "-s"]);
const SAFE_RG_ARGS = new Set([
  "--",
  "--files",
  "--fixed-strings",
  "--ignore-case",
  "--line-number",
  "--no-heading",
  "--color=never",
  "-F",
  "-i",
  "-n"
]);
const CREDENTIAL_DIRECTORY_NAMES = new Set([
  ".aws",
  ".azure",
  ".config",
  ".docker",
  ".gcloud",
  ".git",
  ".gnupg",
  ".kube",
  ".ssh"
]);
const CREDENTIAL_FILE_NAMES = new Set([
  ".dockercfg",
  ".envrc",
  ".git-credentials",
  ".gitconfig",
  ".netrc",
  ".npmrc",
  ".pypirc",
  "_netrc",
  "credentials",
  "credentials.json",
  "id_dsa",
  "id_ecdsa",
  "id_ed25519",
  "id_rsa",
  "service-account.json"
]);
const CREDENTIAL_PATH_PART_PATTERN =
  /(?:^|[._-])(?:credential|secret|password|passwd|api[_-]?key|private[_-]?key|auth[_-]?token|access[_-]?token|refresh[_-]?token|id[_-]?token|token)(?:$|[._-])/u;
const SECRET_ASSIGNMENT_KEY_PATTERN =
  /(?:^|[^a-z0-9])(?:api[_-]?key|auth[_-]?token|access[_-]?token|refresh[_-]?token|id[_-]?token|token|secret|password|passwd|private[_-]?key)(?:$|[^a-z0-9])/iu;
const SECRET_ASSIGNMENT_PATTERN = /([A-Za-z0-9_./:-]*[A-Za-z0-9_./-])(\s*[:=]\s*)\S+/gu;
const DANGEROUS_SCRIPT_NAME_PATTERN =
  /(?:^|[:_-])(?:dev|start|serve|watch|deploy|delete|destroy|reset|clean|migrate|generate)(?:$|[:_-])/iu;
const DANGEROUS_SCRIPT_BODY_PATTERN =
  /(?:\brm\s+-|\bsudo\b|\bchflags\b|\bchmod\b|\bkill(?:all)?\b|\blaunchctl\b|\bdeploy\b|\bdestroy\b|\breset\b|\bdelete\b|\bdrizzle-kit\s+generate\b|\bmigrate\b|\btsx\s+watch\b|\bvite\b)/iu;

export function hashShellCommandPreview(input: {
  readonly command: readonly string[];
  readonly workingDirectory?: string;
}) {
  const payload = {
    command: input.command,
    workingDirectory: normalizedWorkingDirectory(input.workingDirectory)
  };

  return `sha256:${createHash("sha256").update(stableJson(payload)).digest("hex")}`;
}

function stableJson(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map(stableJson).join(",")}]`;
  }

  if (typeof value === "object" && value !== null) {
    const record = value as Readonly<Record<string, unknown>>;

    return `{${Object.keys(record)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${stableJson(record[key])}`)
      .join(",")}}`;
  }

  return JSON.stringify(value);
}

function blockReason(
  code: ExecutionAuthorityBlockReasonDto["code"],
  message: string,
  evidenceRefs: readonly string[] = [`shell_command:${code}`]
): ExecutionAuthorityBlockReasonDto {
  return {
    code,
    message,
    evidenceRefs
  };
}

function allowedCommandReview(commandClass: ShellCommandClass): AllowedCommandReview {
  return { kind: "allowed", commandClass };
}

function blockedCommandReview(
  ...blockReasons: readonly ExecutionAuthorityBlockReasonDto[]
): BlockedCommandReview {
  return { kind: "blocked", blockReasons };
}

function notApplicableCommandReview(): Extract<CommandReviewResult, { readonly kind: "not_applicable" }> {
  return { kind: "not_applicable" };
}

function shellCommandResult(input: {
  readonly status: ShellCommandApplyOutput["status"];
  readonly command?: ShellCommandRunSummaryDto;
  readonly exitCode?: number | null;
  readonly durationMs?: number;
  readonly stdoutSummary?: string;
  readonly stderrSummary?: string;
  readonly blockReasons?: readonly ExecutionAuthorityBlockReasonDto[];
  readonly evidenceRefs?: readonly string[];
  readonly auditRefs?: readonly string[];
}): ShellCommandApplyOutput {
  return {
    status: input.status,
    command: input.command ?? {
      executable: "",
      args: [],
      workingDirectory: ".",
      commandClass: "diagnostic",
      timeoutMs: 0,
      timedOut: false
    },
    exitCode: input.exitCode ?? null,
    durationMs: input.durationMs ?? 0,
    stdoutSummary: input.stdoutSummary ?? "",
    stderrSummary: input.stderrSummary ?? "",
    blockReasons: input.blockReasons ?? [],
    evidenceRefs: input.evidenceRefs ?? [],
    auditRefs: input.auditRefs ?? []
  };
}

function isFilesystemRoot(path: string) {
  return dirname(path) === path;
}

function isInsideDirectory(parent: string, child: string) {
  const relativePath = relative(parent, child);

  return relativePath === "" || (!relativePath.startsWith("..") && !isAbsolute(relativePath));
}

function normalizedWorkingDirectory(workingDirectory: string | undefined) {
  if (!workingDirectory || workingDirectory.trim() === "" || workingDirectory === ".") {
    return ".";
  }

  return workingDirectory.replaceAll("\\", "/").replace(/\/+$/u, "") || ".";
}

function normalizedRelativePath(rawPath: string): string | "blocked" {
  if (
    rawPath.trim().length === 0 ||
    rawPath.startsWith("~") ||
    rawPath.includes("\\") ||
    posixPath.isAbsolute(rawPath)
  ) {
    return "blocked";
  }

  const normalized = posixPath.normalize(rawPath);
  const parts = normalized.split("/");

  if (normalized === ".." || normalized.startsWith("../") || parts.includes("..")) {
    return "blocked";
  }

  return normalized === "." ? "." : normalized;
}

function sensitivePathReason(path: string) {
  const parts = path.split("/").map((part) => part.toLowerCase());

  if (parts.some((part) => part === ".envrc" || /^\.env(?:\.|$)/u.test(part))) {
    return "Shell command targets .env-style files, which are always blocked.";
  }

  if (parts.some((part) => CREDENTIAL_DIRECTORY_NAMES.has(part))) {
    return "Shell command targets a credential-bearing home/config directory, which is always blocked.";
  }

  if (parts.some((part) => CREDENTIAL_FILE_NAMES.has(part) || CREDENTIAL_PATH_PART_PATTERN.test(part))) {
    return "Shell command targets credential/secret/key material, which is always blocked.";
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

async function assertSafeWorkspace(input: {
  readonly record: ExecutionAuthorityRecord;
  readonly workspaceRoot: string;
}): Promise<{ readonly realWorkspaceRoot: string } | ExecutionAuthorityBlockReasonDto> {
  const resolvedWorkspaceRoot = resolve(input.workspaceRoot);

  if (!isAbsolute(input.workspaceRoot) || resolvedWorkspaceRoot === homedir() || isFilesystemRoot(resolvedWorkspaceRoot)) {
    return blockReason(
      "sandbox_failure",
      "workspaceRoot must be an absolute project workspace, not the home or filesystem root directory."
    );
  }

  let realWorkspaceRoot: string;

  try {
    realWorkspaceRoot = await realpath(input.workspaceRoot);
  } catch {
    return blockReason("sandbox_failure", "workspaceRoot must exist before shell_command execution.");
  }

  if (realWorkspaceRoot === homedir() || isFilesystemRoot(realWorkspaceRoot)) {
    return blockReason(
      "sandbox_failure",
      "workspaceRoot must resolve to a project workspace, not the home or filesystem root directory."
    );
  }

  if (!workspaceRefMatches(input.record, input.workspaceRoot, realWorkspaceRoot)) {
    return blockReason("sandbox_failure", "workspaceRoot does not match the approved authority workspaceRef.");
  }

  return { realWorkspaceRoot };
}

async function resolveSafeWorkingDirectory(input: {
  readonly realWorkspaceRoot: string;
  readonly workingDirectory?: string;
}): Promise<{ readonly normalized: string; readonly realPath: string } | ExecutionAuthorityBlockReasonDto> {
  const normalized = normalizedRelativePath(normalizedWorkingDirectory(input.workingDirectory));

  if (normalized === "blocked") {
    return blockReason("sandbox_failure", "workingDirectory must be relative to the approved workspace.");
  }

  const targetPath = resolve(input.realWorkspaceRoot, normalized.split("/").join(sep));

  if (!isInsideDirectory(input.realWorkspaceRoot, targetPath)) {
    return blockReason("sandbox_failure", "workingDirectory escapes the approved workspace.");
  }

  const sensitiveReason = sensitivePathReason(normalized);

  if (sensitiveReason) {
    return blockReason("credential_value_required", sensitiveReason, [`shell_command:sensitive_path:${normalized}`]);
  }

  let realPath: string;

  try {
    realPath = await realpath(targetPath);
  } catch {
    return blockReason("sandbox_failure", "workingDirectory must exist before shell_command execution.");
  }

  if (!isInsideDirectory(input.realWorkspaceRoot, realPath)) {
    return blockReason("sandbox_failure", "workingDirectory follows a symlink outside the approved workspace.");
  }

  return { normalized, realPath };
}

function commandAllowlistRefAllowsDefault(record: ExecutionAuthorityRecord) {
  const ref = record.requestedScope.commandAllowlistRef;

  return Boolean(ref && /(?:shell_command|package|script|diagnostic|default|repo)/iu.test(ref));
}

async function packageScriptsForWorkspace(realWorkspaceRoot: string): Promise<Readonly<Record<string, string>>> {
  try {
    const packageJson = JSON.parse(await readFile(resolve(realWorkspaceRoot, "package.json"), "utf8")) as PackageJsonShape;
    const scripts = packageJson.scripts ?? {};
    const entries = Object.entries(scripts).filter((entry): entry is [string, string] => typeof entry[1] === "string");

    return Object.fromEntries(entries);
  } catch {
    return {};
  }
}

function scriptClass(scriptName: string): ShellCommandClass {
  if (scriptName === "verify" || scriptName.includes("build")) {
    return "build_or_full_verify";
  }

  return "test";
}

function timeoutCeilingForClass(commandClass: ShellCommandClass) {
  switch (commandClass) {
    case "diagnostic":
      return READ_ONLY_DIAGNOSTIC_TIMEOUT_MS;
    case "test":
      return TEST_LINT_DOCS_TIMEOUT_MS;
    case "build_or_full_verify":
      return BUILD_OR_FULL_VERIFY_TIMEOUT_MS;
  }
}

function diagnosticFlagReason(executable: string, arg: string) {
  switch (executable) {
    case "ls":
      return SAFE_LS_ARGS.has(arg) ? null : `ls option is outside the read-only diagnostic allowlist: ${arg}`;
    case "cat":
      return SAFE_CAT_ARGS.has(arg) ? null : `cat option is outside the read-only diagnostic allowlist: ${arg}`;
    case "rg":
      return SAFE_RG_ARGS.has(arg) ? null : `rg option is outside the read-only diagnostic allowlist: ${arg}`;
    default:
      return `Diagnostic command is outside the read-only diagnostic allowlist: ${executable}`;
  }
}

function diagnosticPathArgs(input: { readonly executable: string; readonly args: readonly string[] }) {
  const paths: string[] = [];
  const reasons: ExecutionAuthorityBlockReasonDto[] = [];
  let afterDoubleDash = false;
  let rgPatternSeen = false;
  const rgFilesMode = input.executable === "rg" && input.args.includes("--files");

  for (const arg of input.args) {
    if (!afterDoubleDash && arg.startsWith("-")) {
      const optionReason = diagnosticFlagReason(input.executable, arg);

      if (optionReason) {
        reasons.push(blockReason("sandbox_failure", optionReason));
      }

      if (arg === "--") {
        afterDoubleDash = true;
      }

      continue;
    }

    if (input.executable === "rg" && !rgFilesMode && !rgPatternSeen) {
      rgPatternSeen = true;
      continue;
    }

    paths.push(arg);
  }

  return { paths, reasons };
}

async function realpathExistingAncestor(targetPath: string) {
  let currentPath = targetPath;

  while (true) {
    try {
      return await realpath(currentPath);
    } catch {
      const parentPath = dirname(currentPath);

      if (parentPath === currentPath) {
        return null;
      }

      currentPath = parentPath;
    }
  }
}

async function safeDiagnosticPathArgs(input: {
  readonly executable: string;
  readonly args: readonly string[];
  readonly realWorkspaceRoot: string;
  readonly realWorkingDirectory: string;
}) {
  const { paths, reasons: parseReasons } = diagnosticPathArgs({ executable: input.executable, args: input.args });

  if (parseReasons.length) {
    return parseReasons;
  }

  if (input.executable === "rg" && !paths.length) {
    return [
      blockReason(
        "credential_value_required",
        "rg diagnostics require explicit non-sensitive file path arguments; implicit workspace scans are blocked.",
        ["shell_command:rg_implicit_workspace_scan"]
      )
    ];
  }

  if (!paths.length) {
    return [];
  }

  const reasons: ExecutionAuthorityBlockReasonDto[] = [];

  for (const pathArg of paths) {
    const normalized = normalizedRelativePath(pathArg);

    if (normalized === "blocked") {
      reasons.push(
        blockReason("sandbox_failure", `Diagnostic command path is outside the workspace boundary: ${pathArg}`)
      );
      continue;
    }

    const sensitiveReason = sensitivePathReason(normalized);

    if (sensitiveReason) {
      reasons.push(
        blockReason("credential_value_required", sensitiveReason, [`shell_command:sensitive_path:${normalized}`])
      );
      continue;
    }

    const targetPath = resolve(input.realWorkingDirectory, normalized.split("/").join(sep));

    if (!isInsideDirectory(input.realWorkspaceRoot, targetPath)) {
      reasons.push(blockReason("sandbox_failure", `Diagnostic command path escapes the workspace boundary: ${pathArg}`));
      continue;
    }

    let realTargetPath: string | null;
    let targetIsFile = false;

    try {
      realTargetPath = await realpath(targetPath);
      targetIsFile = (await stat(targetPath)).isFile();
    } catch {
      if (input.executable === "rg") {
        reasons.push(
          blockReason(
            "sandbox_failure",
            `rg diagnostic path must resolve to an existing non-sensitive file: ${pathArg}`,
            [`shell_command:rg_missing_path:${normalized}`]
          )
        );
        continue;
      }

      realTargetPath = await realpathExistingAncestor(dirname(targetPath));
    }

    if (!realTargetPath || !isInsideDirectory(input.realWorkspaceRoot, realTargetPath)) {
      reasons.push(
        blockReason(
          "sandbox_failure",
          `Diagnostic command path follows a symlink outside the workspace boundary: ${pathArg}`
        )
      );
      continue;
    }

    if (input.executable === "rg" && !targetIsFile) {
      reasons.push(
        blockReason(
          "credential_value_required",
          `rg diagnostics require explicit file paths; recursive directory scans are blocked: ${pathArg}`,
          [`shell_command:rg_recursive_path:${normalized}`]
        )
      );
    }
  }

  return reasons;
}

async function diagnosticReview(input: {
  readonly command: readonly string[];
  readonly realWorkspaceRoot: string;
  readonly realWorkingDirectory: string;
}): Promise<CommandReviewResult> {
  const command = input.command;
  const [executable, ...args] = command;

  if (!executable || !READ_ONLY_DIAGNOSTIC_EXECUTABLES.has(executable)) {
    return notApplicableCommandReview();
  }

  if (executable === "git") {
    if (args[0] !== "status" || args.some((arg) => !SAFE_GIT_STATUS_ARGS.has(arg))) {
      return blockedCommandReview(
        blockReason(
          "sandbox_failure",
          "Only git status diagnostics are allowed by the default shell_command adapter allowlist."
        )
      );
    }

    return allowedCommandReview("diagnostic");
  }

  const pathReasons = await safeDiagnosticPathArgs({
    executable,
    args,
    realWorkspaceRoot: input.realWorkspaceRoot,
    realWorkingDirectory: input.realWorkingDirectory
  });

  if (pathReasons.length) {
    return blockedCommandReview(...pathReasons);
  }

  return allowedCommandReview("diagnostic");
}

function packageScriptName(command: readonly string[]) {
  const [executable, first, second] = command;

  if (executable !== "pnpm") {
    return null;
  }

  if (first === "run" && typeof second === "string" && second.trim().length > 0) {
    return second;
  }

  if (typeof first === "string" && first.trim().length > 0) {
    return first;
  }

  return null;
}

async function packageScriptReview(input: {
  readonly command: readonly string[];
  readonly realWorkspaceRoot: string;
}): Promise<CommandReviewResult> {
  const scriptName = packageScriptName(input.command);

  if (!scriptName) {
    return notApplicableCommandReview();
  }

  const scripts = await packageScriptsForWorkspace(input.realWorkspaceRoot);
  const scriptBody = scripts[scriptName];

  if (!scriptBody) {
    return blockedCommandReview(
      blockReason(
        "sandbox_failure",
        `Shell command package script is not present in the approved workspace package.json: ${scriptName}`
      )
    );
  }

  if (input.command.length > (input.command[1] === "run" ? 3 : 2)) {
    return blockedCommandReview(
      blockReason(
        "sandbox_failure",
        "Package script execution does not accept additional arguments in the default shell_command adapter."
      )
    );
  }

  if (DANGEROUS_SCRIPT_NAME_PATTERN.test(scriptName) || DANGEROUS_SCRIPT_BODY_PATTERN.test(scriptBody)) {
    return blockedCommandReview(
      blockReason(
        "sandbox_failure",
        `Package script is outside the non-destructive shell_command allowlist: ${scriptName}`
      )
    );
  }

  return allowedCommandReview(scriptClass(scriptName));
}

async function reviewAllowedCommand(input: {
  readonly command: readonly string[];
  readonly record: ExecutionAuthorityRecord;
  readonly realWorkspaceRoot: string;
  readonly realWorkingDirectory: string;
}): Promise<AllowedCommandReview | BlockedCommandReview> {
  if (!input.command.length || input.command.some((part) => part.trim().length === 0)) {
    return blockedCommandReview(blockReason("sandbox_failure", "Shell command must include a non-empty argv array."));
  }

  if (input.command.some((part) => part.includes("\0") || part.includes("\r") || part.includes("\n"))) {
    return blockedCommandReview(
      blockReason("sandbox_failure", "Shell command argv cannot contain newline or NUL characters.")
    );
  }

  if (input.command[0]?.includes("/") || input.command[0]?.includes("\\")) {
    return blockedCommandReview(
      blockReason("sandbox_failure", "Shell command executable must be a bare allowlisted command name.")
    );
  }

  if (containsExecutionAuthoritySecretValueLeak(input.command)) {
    return blockedCommandReview(
      blockReason(
        "credential_value_required",
        "Shell command arguments appear to contain credential or secret values.",
        ["shell_command:credential_argument"]
      )
    );
  }

  if (!commandAllowlistRefAllowsDefault(input.record)) {
    return blockedCommandReview(
      blockReason("sandbox_failure", "shell_command execution requires an approved commandAllowlistRef.")
    );
  }

  const diagnostic = await diagnosticReview({
    command: input.command,
    realWorkspaceRoot: input.realWorkspaceRoot,
    realWorkingDirectory: input.realWorkingDirectory
  });

  if (diagnostic.kind === "allowed") {
    return diagnostic;
  }

  if (diagnostic.kind === "blocked") {
    return diagnostic;
  }

  const script = await packageScriptReview({
    command: input.command,
    realWorkspaceRoot: input.realWorkspaceRoot
  });

  if (script.kind !== "not_applicable") {
    return script;
  }

  return blockedCommandReview(
    blockReason(
      "sandbox_failure",
      "Shell command is outside the default allowlist of repo package scripts and read-only diagnostics."
    )
  );
}

function redactedOutputSummary(text: string) {
  const normalized = text.replaceAll("\r\n", "\n");
  const redacted = normalized
    .replace(SECRET_ASSIGNMENT_PATTERN, (match, key: string, separator: string) =>
      SECRET_ASSIGNMENT_KEY_PATTERN.test(key) ? `${key}${separator}[REDACTED]` : match
    )
    .replace(/\b(api[_-]?key|password|secret|token)\s*[:=]\s*\S+/giu, "$1=[REDACTED]")
    .replace(/\bBearer\s+[A-Za-z0-9._~+/-]{10,}/gu, "Bearer [REDACTED]")
    .replace(/\b(?:gh[pousr]_|github_pat_)[A-Za-z0-9_]{20,}/gu, "[REDACTED_GITHUB_TOKEN]")
    .replace(/\bsk-[A-Za-z0-9_-]{16,}/gu, "sk-[REDACTED]")
    .replace(/\bxox[baprs]-[A-Za-z0-9-]{10,}/gu, "xox[REDACTED]");
  const lines = redacted.split("\n").slice(0, OUTPUT_SUMMARY_MAX_LINES);
  const lineLimited = lines.join("\n");
  const charLimited = lineLimited.length > OUTPUT_SUMMARY_MAX_CHARS
    ? `${lineLimited.slice(0, OUTPUT_SUMMARY_MAX_CHARS)}…[truncated]`
    : lineLimited;

  return charLimited.trimEnd();
}

function safeEnvironment(): NodeJS.ProcessEnv {
  return {
    ...(process.env.PATH ? { PATH: process.env.PATH } : {}),
    CI: "1",
    NO_COLOR: "1"
  };
}

function appendCapturedOutput(current: string, chunk: string) {
  if (current.length >= RAW_OUTPUT_CAPTURE_MAX_CHARS) {
    return current;
  }

  return current + chunk.slice(0, RAW_OUTPUT_CAPTURE_MAX_CHARS - current.length);
}

function runCommand(input: {
  readonly command: readonly string[];
  readonly executablePath: string;
  readonly cwd: string;
  readonly timeoutMs: number;
}): Promise<{
  readonly exitCode: number | null;
  readonly timedOut: boolean;
  readonly durationMs: number;
  readonly stdout: string;
  readonly stderr: string;
}> {
  const [, ...args] = input.command;
  const startedAt = Date.now();

  return new Promise((resolveCommand) => {
    if (!input.executablePath) {
      resolveCommand({
        exitCode: null,
        timedOut: false,
        durationMs: 0,
        stdout: "",
        stderr: "Missing executable."
      });
      return;
    }

    const child = spawn(input.executablePath, args, {
      cwd: input.cwd,
      detached: true,
      env: safeEnvironment(),
      shell: false,
      stdio: ["ignore", "pipe", "pipe"]
    });
    let stdout = "";
    let stderr = "";
    let settled = false;
    let timedOut = false;
    let killTimer: ReturnType<typeof setTimeout> | null = null;
    function killProcessGroup(signal: NodeJS.Signals) {
      if (child.pid) {
        try {
          process.kill(-child.pid, signal);
          return;
        } catch {
          // Fall through to killing the direct child. Some platforms do not expose
          // process-group signaling for detached children in test sandboxes.
        }
      }

      child.kill(signal);
    }
    const timer = setTimeout(() => {
      timedOut = true;
      killProcessGroup("SIGTERM");
      killTimer = setTimeout(() => {
        killProcessGroup("SIGKILL");
      }, 1_000);
    }, input.timeoutMs);

    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk: string) => {
      stdout = appendCapturedOutput(stdout, chunk);
    });
    child.stderr.on("data", (chunk: string) => {
      stderr = appendCapturedOutput(stderr, chunk);
    });
    child.on("error", (error) => {
      if (settled) {
        return;
      }

      settled = true;
      clearTimeout(timer);
      if (killTimer) {
        clearTimeout(killTimer);
      }
      resolveCommand({
        exitCode: null,
        timedOut: false,
        durationMs: Date.now() - startedAt,
        stdout,
        stderr: stderr ? `${stderr}\n${error.message}` : error.message
      });
    });
    child.on("close", (code) => {
      if (settled) {
        return;
      }

      settled = true;
      clearTimeout(timer);
      if (killTimer) {
        clearTimeout(killTimer);
      }
      resolveCommand({
        exitCode: code,
        timedOut,
        durationMs: Date.now() - startedAt,
        stdout,
        stderr
      });
    });
  });
}

function executableCandidateNames(executable: string): readonly string[] {
  if (process.platform !== "win32" || /\.[^\\/]+$/u.test(executable)) {
    return [executable];
  }

  const pathExt = process.env.PATHEXT?.trim() ? process.env.PATHEXT : DEFAULT_WINDOWS_PATHEXT;
  const extensions = pathExt
    .split(";")
    .map((extension) => extension.trim())
    .filter((extension) => extension.length > 0)
    .map((extension) => extension.startsWith(".") ? extension : `.${extension}`);
  const extensionCandidates = extensions.map((extension) => `${executable}${extension}`);

  return Array.from(new Set([...extensionCandidates, executable]));
}

async function resolveExecutablePath(input: {
  readonly executable: string;
  readonly realWorkspaceRoot: string;
}): Promise<string | ExecutionAuthorityBlockReasonDto> {
  const pathEntries = (process.env.PATH ?? "").split(delimiter).filter((entry) => entry.trim().length > 0);
  const executableNames = executableCandidateNames(input.executable);

  for (const pathEntry of pathEntries) {
    for (const executableName of executableNames) {
      const candidate = resolve(pathEntry, executableName);

      try {
        const candidateStats = await stat(candidate);

        if (!candidateStats.isFile()) {
          continue;
        }

        await access(candidate, fsConstants.X_OK);

        const realExecutablePath = await realpath(candidate);

        if (isInsideDirectory(input.realWorkspaceRoot, realExecutablePath)) {
          return blockReason(
            "sandbox_failure",
            "Shell command executable resolves inside the approved workspace; PATH-local executables are not allowed."
          );
        }

        return realExecutablePath;
      } catch {
        // Keep scanning PATH entries until a concrete executable is found.
      }
    }
  }

  return blockReason(
    "sandbox_failure",
    `Shell command executable is unavailable on the controlled PATH: ${input.executable}`
  );
}

export async function runShellCommand(input: ShellCommandApplyInput): Promise<ShellCommandApplyOutput> {
  if (input.record.actionClass !== "shell_command") {
    return shellCommandResult({
      status: "blocked",
      blockReasons: [blockReason("sandbox_failure", "Only shell_command authority records can run the shell adapter.")]
    });
  }

  const computedHash = hashShellCommandPreview({
    command: input.command,
    ...(input.workingDirectory ? { workingDirectory: input.workingDirectory } : {})
  });

  if (computedHash !== input.record.previewArtifactHash) {
    return shellCommandResult({
      status: "blocked",
      blockReasons: [
        blockReason(
          "preview_hash_mismatch",
          "Shell command preview hash does not match the approved preview artifact hash."
        )
      ]
    });
  }

  if (!input.record.rollbackReference) {
    return shellCommandResult({
      status: "blocked",
      blockReasons: [blockReason("missing_rollback", "shell_command execution requires a rollback reference.")]
    });
  }

  if (input.record.rollbackReference.kind !== "command_compensating_action") {
    return shellCommandResult({
      status: "blocked",
      blockReasons: [blockReason("missing_rollback", "shell_command rollback must be command_compensating_action.")]
    });
  }

  const workspace = await assertSafeWorkspace({
    record: input.record,
    workspaceRoot: input.workspaceRoot
  });

  if ("code" in workspace) {
    return shellCommandResult({
      status: "blocked",
      blockReasons: [workspace]
    });
  }

  const workingDirectory = await resolveSafeWorkingDirectory({
    realWorkspaceRoot: workspace.realWorkspaceRoot,
    ...(input.workingDirectory ? { workingDirectory: input.workingDirectory } : {})
  });

  if ("code" in workingDirectory) {
    return shellCommandResult({
      status: "blocked",
      blockReasons: [workingDirectory]
    });
  }

  const commandReview = await reviewAllowedCommand({
    command: input.command,
    record: input.record,
    realWorkspaceRoot: workspace.realWorkspaceRoot,
    realWorkingDirectory: workingDirectory.realPath
  });

  if (commandReview.kind === "blocked") {
    return shellCommandResult({
      status: "blocked",
      blockReasons: commandReview.blockReasons
    });
  }

  const timeoutCeilingMs = timeoutCeilingForClass(commandReview.commandClass);
  const timeoutMs = input.record.requestedScope.maxDurationMs ?? timeoutCeilingMs;

  if (timeoutMs > timeoutCeilingMs) {
    return shellCommandResult({
      status: "blocked",
      blockReasons: [
        blockReason(
          "sandbox_failure",
          `shell_command maxDurationMs exceeds the ${commandReview.commandClass} timeout ceiling.`
        )
      ]
    });
  }

  const [executable = "", ...args] = input.command;
  const commandSummary: ShellCommandRunSummaryDto = {
    executable,
    args,
    workingDirectory: workingDirectory.normalized,
    commandClass: commandReview.commandClass,
    timeoutMs,
    timedOut: false
  };
  const executablePath = await resolveExecutablePath({
    executable,
    realWorkspaceRoot: workspace.realWorkspaceRoot
  });

  if (typeof executablePath !== "string") {
    return shellCommandResult({
      status: "blocked",
      command: commandSummary,
      blockReasons: [executablePath]
    });
  }

  const output = await runCommand({
    command: input.command,
    executablePath,
    cwd: workingDirectory.realPath,
    timeoutMs
  });
  const stdoutSummary = redactedOutputSummary(output.stdout);
  const stderrSummary = redactedOutputSummary(output.stderr);
  const timedOutCommandSummary = {
    ...commandSummary,
    timedOut: output.timedOut
  };

  if (output.timedOut) {
    return shellCommandResult({
      status: "failed",
      command: timedOutCommandSummary,
      exitCode: output.exitCode,
      durationMs: output.durationMs,
      stdoutSummary,
      stderrSummary,
      blockReasons: [blockReason("sandbox_failure", "Shell command timed out before completion.")],
      evidenceRefs: [
        `shell_command:preview_hash:${computedHash}`,
        `shell_command:timeout:${timeoutMs}`,
        `shell_command:exit_code:${output.exitCode ?? "null"}`
      ],
      auditRefs: [`audit:shell_command:${input.idempotencyKey}`]
    });
  }

  const status = output.exitCode === 0 ? "completed" : "failed";

  return shellCommandResult({
    status,
    command: timedOutCommandSummary,
    exitCode: output.exitCode,
    durationMs: output.durationMs,
    stdoutSummary,
    stderrSummary,
    evidenceRefs: [
      `shell_command:preview_hash:${computedHash}`,
      `shell_command:exit_code:${output.exitCode ?? "null"}`,
      `shell_command:duration_ms:${output.durationMs}`,
      `shell_command:stdout_chars:${stdoutSummary.length}`,
      `shell_command:stderr_chars:${stderrSummary.length}`
    ],
    auditRefs: [`audit:shell_command:${input.idempotencyKey}`]
  });
}
