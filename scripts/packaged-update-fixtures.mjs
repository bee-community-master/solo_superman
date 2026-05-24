import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import {
  PACKAGED_UPDATE_RUNTIME_SCHEMA_VERSION,
  APP_PATHS,
  resolveInsideRoot,
  writeInstalledRelease
} from "./packaged-update-runtime.mjs";

const REQUIRED_UPDATE_POLICY_FLAGS = [
  "requiresUserConsent",
  "allowsUserDeferral",
  "verifiesManifestSignature",
  "verifiesArtifactChecksum",
  "verifiesArtifactSignature",
  "preservesUserData",
  "preservesCredentials",
  "supportsRetry",
  "supportsRollback"
];

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function fixtureReleaseDescriptor(version) {
  return {
    version,
    appId: "solo-superman",
    packageKind: "fixture-package",
    signedArtifactRef: `fixture://solo-superman/${version}`
  };
}

async function writeFixtureText(root, relativePath, value) {
  const target = resolveInsideRoot(root, relativePath);
  await mkdir(dirname(target), { recursive: true });
  await writeFile(target, value, "utf8");
}

async function writeFixtureJson(root, relativePath, value) {
  await writeFixtureText(root, relativePath, `${JSON.stringify(value, null, 2)}\n`);
}

export function createFixtureReleaseManifest(version = "0.1.1") {
  const artifactDigest = sha256(`solo-superman:${version}:macos-arm64:fixture-artifact`);
  return {
    schemaVersion: "solo-superman-release-update-manifest.v1",
    appId: "solo-superman",
    channel: "preview",
    version,
    releasedAt: "2026-05-23T00:00:00Z",
    releaseNotesUrl: `https://github.com/bee-community-master/solo_superman/releases/tag/v${version}`,
    updatePolicy: {
      ...Object.fromEntries(REQUIRED_UPDATE_POLICY_FLAGS.map((flag) => [flag, true])),
      failureMode: "If any fixture download, signature, checksum, install, or launch verification fails, keep the currently installed app version active and show a retry/rollback-safe error without changing local user data.",
      rollbackBoundary: "Rollback may replace only packaged app binaries and release metadata; it must not delete or rewrite local databases, generated workspaces, support bundles, or operator files.",
      credentialBoundary: "The updater must not read, copy, upload, rewrite, or delete Codex/OpenAI/GitHub credentials, browser cookies, local capability tokens, or environment secrets."
    },
    manifestSignature: {
      kind: "ed25519",
      publicKeyId: "solo-superman-fixture-release-manifest-public-key",
      signatureRef: `https://github.com/bee-community-master/solo_superman/releases/download/v${version}/fixture-manifest.sig`
    },
    artifacts: [
      {
        platform: "macos-arm64",
        packageKind: "macos-dmg",
        url: `https://github.com/bee-community-master/solo_superman/releases/download/v${version}/solo-superman-${version}-macos-arm64.dmg`,
        sha256: artifactDigest,
        sizeBytes: 256,
        signature: {
          kind: "apple-codesign-notarization",
          publicKeyId: "solo-superman-fixture-developer-id",
          signatureRef: `https://github.com/bee-community-master/solo_superman/releases/download/v${version}/solo-superman-${version}-macos-arm64.notarization.json`
        }
      }
    ]
  };
}

export async function createFixtureInstall(root) {
  await writeInstalledRelease(root, fixtureReleaseDescriptor("0.1.0"));
  await writeFixtureJson(root, APP_PATHS.updateState, {
    schemaVersion: PACKAGED_UPDATE_RUNTIME_SCHEMA_VERSION,
    status: "idle",
    activeVersion: "0.1.0"
  });
  await writeFixtureText(root, "data/local.db", "fixture local database\n");
  await writeFixtureText(root, "workspace/generated-project/README.md", "# Generated project fixture\n");
  await writeFixtureJson(root, "support/solo-support-bundle.json", { fixture: true, credentialFree: true });
  await writeFixtureText(root, "operator-files/release-notes.md", "operator-owned release notes\n");
  await writeFixtureText(root, "credentials/codex-cli-login-ref.txt", "fixture credential reference only; no real credential value\n");
}
