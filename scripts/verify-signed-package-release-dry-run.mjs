#!/usr/bin/env node
import { Buffer } from "node:buffer";
import { createHash } from "node:crypto";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { pathToFileURL, URL } from "node:url";
import { tokenLikePattern } from "./secret-patterns.mjs";

export const SIGNED_PACKAGE_RELEASE_DRY_RUN_SCHEMA_VERSION = "solo-superman-signed-package-release-dry-run.v1";

const APP_ID = "solo-superman";
const RELEASE_VERSION = "0.1.0";
const DEFAULT_CONTRACT_PATH = "docs/signed-package-release.example.json";
const DRY_RUN_COMMAND = "pnpm verify:signed-package-release:dry-run";
const ISSUE_URL = "https://github.com/bee-community-master/solo_superman/issues/293";
const UPSTREAM_RELEASE_EVIDENCE_ISSUE_URL = "https://github.com/bee-community-master/solo_superman/issues/266";
const MANIFEST_PATH = "release/solo-superman-release-manifest.json";
const ARTIFACT_FIXTURES = [
  {
    id: "macos-signed-package-release",
    scope: "macos",
    packageKind: "macos-dmg",
    relativePath: "artifacts/solo-superman-0.1.0-macos.dmg"
  },
  {
    id: "windows-signed-package-release",
    scope: "windows",
    packageKind: "windows-msi",
    relativePath: "artifacts/solo-superman-0.1.0-windows.msi"
  }
];
const REQUIRED_CHECKS = [
  "macos_artifact_digest_size_signature_ref",
  "windows_artifact_digest_size_signature_ref",
  "release_manifest_artifact_refs_match",
  "release_manifest_signature_ref_recorded",
  "public_certificate_metadata_only",
  "contract_lists_dry_run_command",
  "dry_run_does_not_mark_release_ready",
  "no_secret_values_in_evidence"
];
const SECRET_QUERY_NAME_PATTERN = /(?:token|secret|password|pass|api[_-]?key|credential|auth|session|private)/iu;
const TOKEN_LIKE_PATTERN = tokenLikePattern("iu");
const URL_SCHEME_PATTERN = /^[A-Za-z][A-Za-z0-9+.-]*:\/\//u;
const SHA256_PATTERN = /^[a-f0-9]{64}$/u;

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function isRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function collectStrings(value, path = "$", strings = []) {
  if (typeof value === "string") {
    strings.push({ path, value });
    return strings;
  }

  if (Array.isArray(value)) {
    value.forEach((item, index) => collectStrings(item, `${path}[${index}]`, strings));
    return strings;
  }

  if (isRecord(value)) {
    for (const [key, item] of Object.entries(value)) {
      collectStrings(item, `${path}.${key}`, strings);
    }
  }

  return strings;
}

function validateHttpsUrlIfPresent(value, path, issues) {
  if (typeof value !== "string" || !URL_SCHEME_PATTERN.test(value)) {
    return;
  }

  let parsed;
  try {
    parsed = new URL(value);
  } catch {
    issues.push(`${path}: must be a valid URL when using URL refs`);
    return;
  }

  if (parsed.protocol !== "https:") {
    issues.push(`${path}: must use https when using URL refs`);
  }
  if (parsed.username || parsed.password) {
    issues.push(`${path}: must not contain URL userinfo credentials`);
  }
  for (const key of parsed.searchParams.keys()) {
    if (SECRET_QUERY_NAME_PATTERN.test(key)) {
      issues.push(`${path}: must not contain secret-like query parameter ${key}`);
    }
  }
}

function findSecretStringIssues(value) {
  const issues = [];
  for (const { path, value: text } of collectStrings(value)) {
    if (TOKEN_LIKE_PATTERN.test(text)) {
      issues.push(`${path}: must not contain token-shaped values`);
    }
    validateHttpsUrlIfPresent(text, path, issues);
  }
  return issues;
}

async function writeText(root, relativePath, value) {
  const target = resolve(root, relativePath);
  await mkdir(dirname(target), { recursive: true });
  await writeFile(target, value, "utf8");
}

async function writeJson(root, relativePath, value) {
  await writeText(root, relativePath, `${JSON.stringify(value, null, 2)}\n`);
}

async function readJson(path) {
  return JSON.parse(await readFile(resolve(path), "utf8"));
}

function artifactContent(definition) {
  return `${JSON.stringify({
    appId: APP_ID,
    version: RELEASE_VERSION,
    fixtureOnly: true,
    credentialFree: true,
    scope: definition.scope,
    packageKind: definition.packageKind,
    note: "fixture artifact bytes for dry-run evidence shape only; no signing credential material"
  }, null, 2)}\n`;
}

function signatureRefFor(definition, digest) {
  return `urn:solo-superman-fixture-signature:${definition.scope}:${definition.packageKind}:${digest.slice(0, 16)}`;
}

function publicCertificateMetadataFor(definition) {
  const provider = definition.scope === "macos" ? "developer-id" : "authenticode";
  return {
    kind: `${provider}-public-certificate-metadata`,
    subject: `Solo Superman ${definition.scope} fixture certificate`,
    issuer: "Solo Superman Fixture Public CA",
    fingerprintSha256: sha256(`${APP_ID}:${definition.scope}:${definition.packageKind}:public-certificate`),
    serialNumber: `FIXTURE-${definition.scope.toUpperCase()}-${RELEASE_VERSION.replaceAll(".", "")}`
  };
}

async function createArtifactSummary(root, definition) {
  const content = artifactContent(definition);
  await writeText(root, definition.relativePath, content);
  const digest = sha256(Buffer.from(content));

  return {
    id: definition.id,
    scope: definition.scope,
    packageKind: definition.packageKind,
    artifactPath: definition.relativePath,
    sha256: digest,
    sizeBytes: Buffer.byteLength(content),
    signatureRef: signatureRefFor(definition, digest),
    publicCertificate: publicCertificateMetadataFor(definition)
  };
}

function createManifest(artifacts) {
  const manifestBody = {
    schemaVersion: "solo-superman-release-manifest-dry-run.v1",
    appId: APP_ID,
    version: RELEASE_VERSION,
    fixtureOnly: true,
    artifactRefs: artifacts.map((artifact) => ({
      scope: artifact.scope,
      packageKind: artifact.packageKind,
      path: artifact.artifactPath,
      sha256: artifact.sha256,
      sizeBytes: artifact.sizeBytes,
      signatureRef: artifact.signatureRef,
      publicCertificate: artifact.publicCertificate
    }))
  };
  const manifestBodyDigest = sha256(JSON.stringify(manifestBody));

  return {
    ...manifestBody,
    signatureRef: `urn:solo-superman-fixture-signature:release-manifest:${manifestBodyDigest.slice(0, 16)}`,
    publicKeyId: "solo-superman-fixture-release-manifest-public-key"
  };
}

function contractIssues(contract) {
  const issues = [];
  const credentialFreeCommands = Array.isArray(contract?.requiredVerificationCommands?.credentialFree)
    ? contract.requiredVerificationCommands.credentialFree
    : [];

  if (!credentialFreeCommands.includes(DRY_RUN_COMMAND)) {
    issues.push(`$.requiredVerificationCommands.credentialFree: must include ${DRY_RUN_COMMAND}`);
  }
  if (contract?.releaseEvidenceStatus !== "blocked") {
    issues.push("$.releaseEvidenceStatus: dry-run fixture must not mark real release evidence ready");
  }
  if (contract?.blockerIssue !== UPSTREAM_RELEASE_EVIDENCE_ISSUE_URL) {
    issues.push("$.blockerIssue: must keep the tracked signed package release evidence issue #266");
  }
  const evidenceRuns = Array.isArray(contract?.evidenceRuns) ? contract.evidenceRuns : [];
  const blockedRunIds = evidenceRuns.filter((run) => run?.status === "blocked").map((run) => run.id);
  for (const required of ["macos-signed-package-release", "windows-signed-package-release", "release-manifest-signing"]) {
    if (!blockedRunIds.includes(required)) {
      issues.push(`$.evidenceRuns: dry-run fixture must keep ${required} blocked until real evidence exists`);
    }
  }

  return issues;
}

function summarizeManifest(manifest) {
  const serializedManifest = `${JSON.stringify(manifest, null, 2)}\n`;

  return {
    path: MANIFEST_PATH,
    sha256: sha256(serializedManifest),
    sizeBytes: Buffer.byteLength(serializedManifest),
    signatureRef: manifest.signatureRef,
    publicKeyId: manifest.publicKeyId,
    artifactCount: manifest.artifactRefs.length
  };
}

function evaluateScenario(artifacts, manifest, contract) {
  const artifactByScope = Object.fromEntries(artifacts.map((artifact) => [artifact.scope, artifact]));
  const contractValidationIssues = contractIssues(contract);
  const manifestSummary = summarizeManifest(manifest);
  const evidenceShape = {
    artifacts,
    manifestSummary,
    issue: ISSUE_URL,
    upstreamReleaseEvidenceIssue: UPSTREAM_RELEASE_EVIDENCE_ISSUE_URL
  };
  const secretIssues = findSecretStringIssues(evidenceShape);
  const manifestArtifactsMatch = artifacts.every((artifact) => {
    const manifestArtifact = manifest.artifactRefs.find((entry) => entry.scope === artifact.scope);
    return manifestArtifact
      && manifestArtifact.sha256 === artifact.sha256
      && manifestArtifact.sizeBytes === artifact.sizeBytes
      && manifestArtifact.signatureRef === artifact.signatureRef
      && manifestArtifact.path === artifact.artifactPath;
  });
  const certificateMetadataOnly = artifacts.every((artifact) => {
    const certificate = artifact.publicCertificate;
    return isRecord(certificate)
      && certificate.kind.endsWith("public-certificate-metadata")
      && SHA256_PATTERN.test(certificate.fingerprintSha256)
      && !Object.keys(certificate).some((key) => SECRET_QUERY_NAME_PATTERN.test(key));
  });

  const checks = {
    macos_artifact_digest_size_signature_ref: SHA256_PATTERN.test(artifactByScope.macos?.sha256 ?? "")
      && (artifactByScope.macos?.sizeBytes ?? 0) > 0
      && typeof artifactByScope.macos?.signatureRef === "string",
    windows_artifact_digest_size_signature_ref: SHA256_PATTERN.test(artifactByScope.windows?.sha256 ?? "")
      && (artifactByScope.windows?.sizeBytes ?? 0) > 0
      && typeof artifactByScope.windows?.signatureRef === "string",
    release_manifest_artifact_refs_match: manifestArtifactsMatch,
    release_manifest_signature_ref_recorded: SHA256_PATTERN.test(manifestSummary.sha256)
      && manifestSummary.sizeBytes > 0
      && typeof manifest.signatureRef === "string"
      && manifest.signatureRef.startsWith("urn:solo-superman-fixture-signature:release-manifest:")
      && typeof manifest.publicKeyId === "string",
    public_certificate_metadata_only: certificateMetadataOnly,
    contract_lists_dry_run_command: !contractValidationIssues.some((issue) => issue.includes(DRY_RUN_COMMAND)),
    dry_run_does_not_mark_release_ready: !contractValidationIssues.some((issue) => issue.includes("dry-run fixture")),
    no_secret_values_in_evidence: secretIssues.length === 0
  };
  const failedCheckIssues = REQUIRED_CHECKS
    .filter((check) => checks[check] !== true)
    .map((check) => `${check} dry-run check failed`);

  return { checks, issues: [...failedCheckIssues, ...contractValidationIssues, ...secretIssues] };
}

function evidenceForScenario(scenario, rootMode) {
  return {
    schemaVersion: SIGNED_PACKAGE_RELEASE_DRY_RUN_SCHEMA_VERSION,
    status: scenario.issues.length === 0 ? "passed" : "failed",
    mode: "credential-free-fixture",
    issue: ISSUE_URL,
    upstreamReleaseEvidenceIssue: UPSTREAM_RELEASE_EVIDENCE_ISSUE_URL,
    rootMode,
    releaseVersion: RELEASE_VERSION,
    artifactSummaries: scenario.artifacts,
    manifestSummary: summarizeManifest(scenario.manifest),
    checks: scenario.checks,
    issues: scenario.issues,
    checked: [
      "macOS fixture package digest, size, signature ref, and public certificate metadata are recorded",
      "Windows fixture package digest, size, signature ref, and public certificate metadata are recorded",
      "release manifest fixture references final artifact digests, sizes, and signature refs",
      "release manifest fixture records a signature ref and public key id",
      "dry-run evidence stays free of token-shaped, URL credential, and secret-query values",
      "signed package release contract lists this dry-run but keeps #266 real release evidence blocked",
      "dry-run remains credential-free and does not replace signing/notarization/Authenticode/manifest evidence for #266"
    ]
  };
}

export async function runSignedPackageReleaseDryRun(options = {}) {
  const root = options.root ? resolve(options.root) : await mkdtemp(join(tmpdir(), "solo-signed-package-release-dry-run-"));
  const shouldCleanup = options.cleanup ?? !options.root;
  const contractPath = resolve(options.contractPath ?? DEFAULT_CONTRACT_PATH);

  try {
    const contract = await readJson(contractPath);
    const artifacts = [];
    for (const definition of ARTIFACT_FIXTURES) {
      artifacts.push(await createArtifactSummary(root, definition));
    }
    const manifest = createManifest(artifacts);
    await writeJson(root, MANIFEST_PATH, manifest);
    const evaluation = evaluateScenario(artifacts, manifest, contract);

    return evidenceForScenario({ artifacts, manifest, ...evaluation }, options.root ? "provided-root" : "temporary-root");
  } catch (error) {
    return {
      schemaVersion: SIGNED_PACKAGE_RELEASE_DRY_RUN_SCHEMA_VERSION,
      status: "failed",
      mode: "credential-free-fixture",
      issue: ISSUE_URL,
      upstreamReleaseEvidenceIssue: UPSTREAM_RELEASE_EVIDENCE_ISSUE_URL,
      rootMode: options.root ? "provided-root" : "temporary-root",
      releaseVersion: RELEASE_VERSION,
      issues: [error instanceof Error ? error.message : String(error)],
      checked: []
    };
  } finally {
    if (shouldCleanup) {
      await rm(root, { recursive: true, force: true });
    }
  }
}

export function parseSignedPackageReleaseDryRunArgs(argv = process.argv.slice(2), env = process.env) {
  let root = env.SOLO_SIGNED_PACKAGE_RELEASE_DRY_RUN_ROOT;
  let contractPath = env.SOLO_SIGNED_PACKAGE_RELEASE_DRY_RUN_CONTRACT;
  let cleanup;

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--") {
      continue;
    } else if (arg === "--root") {
      if (!argv[index + 1]) {
        throw new Error("--root requires a path value");
      }
      root = argv[index + 1];
      cleanup = false;
      index += 1;
    } else if (arg.startsWith("--root=")) {
      root = arg.slice("--root=".length);
      cleanup = false;
    } else if (arg === "--contract") {
      if (!argv[index + 1]) {
        throw new Error("--contract requires a path value");
      }
      contractPath = argv[index + 1];
      index += 1;
    } else if (arg.startsWith("--contract=")) {
      contractPath = arg.slice("--contract=".length);
    } else if (arg === "--cleanup-root") {
      cleanup = true;
    } else if (arg === "--help" || arg === "-h") {
      return { help: true };
    } else {
      throw new Error(`Unknown signed package release dry-run argument: ${arg}`);
    }
  }

  return {
    root: root ? resolve(root) : undefined,
    contractPath: contractPath ? resolve(contractPath) : undefined,
    cleanup
  };
}

export async function runSignedPackageReleaseDryRunCli(argv = process.argv.slice(2), options = {}) {
  const parsed = parseSignedPackageReleaseDryRunArgs(argv, options.env ?? process.env);
  if (parsed.help) {
    console.log("Usage: pnpm verify:signed-package-release:dry-run [--root <path>] [--contract <path>] [--cleanup-root]");
    return { status: "help" };
  }

  const evidence = await runSignedPackageReleaseDryRun({
    ...options,
    root: parsed.root ?? options.root,
    contractPath: parsed.contractPath ?? options.contractPath,
    cleanup: parsed.cleanup ?? options.cleanup
  });
  console.log(JSON.stringify(evidence, null, 2));
  return evidence;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  runSignedPackageReleaseDryRunCli().then((evidence) => {
    if (evidence.status !== "passed") {
      process.exitCode = 1;
    }
  }).catch((error) => {
    console.error(error instanceof Error ? error.stack ?? error.message : String(error));
    process.exitCode = 1;
  });
}
