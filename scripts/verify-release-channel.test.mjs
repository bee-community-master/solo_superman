import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  parseReleaseChannelArgs,
  validateReleaseUpdateManifest,
  verifyReleaseUpdateManifestFile
} from "./verify-release-channel.mjs";

const exampleManifest = JSON.parse(readFileSync("docs/release-update-channel.example.json", "utf8"));

function cloneManifest(overrides = {}) {
  return {
    ...JSON.parse(JSON.stringify(exampleManifest)),
    ...overrides
  };
}

function withTemporaryManifest(manifest) {
  const dir = mkdtempSync(join(tmpdir(), "solo-release-channel-"));
  const path = join(dir, "manifest.json");
  writeFileSync(path, `${JSON.stringify(manifest, null, 2)}\n`);
  return path;
}

describe("release update channel manifest verification", () => {
  it("accepts the documented example manifest", () => {
    expect(validateReleaseUpdateManifest(exampleManifest)).toEqual({ ok: true, issues: [] });
    expect(validateReleaseUpdateManifest(cloneManifest({ version: "0.1.0-beta.1+build.7" }))).toEqual({
      ok: true,
      issues: []
    });

    const evidence = verifyReleaseUpdateManifestFile("docs/release-update-channel.example.json");
    expect(evidence.status).toBe("passed");
    expect(evidence.checked).toContain("release URLs are HTTPS and credential-free");
  });

  it("parses the optional manifest path argument", () => {
    expect(parseReleaseChannelArgs([])).toEqual({ manifestPath: "docs/release-update-channel.example.json" });
    expect(parseReleaseChannelArgs(["--manifest", "custom.json"])).toEqual({ manifestPath: "custom.json" });
    expect(() => parseReleaseChannelArgs(["--manifest"])).toThrow("--manifest requires a path value");
    expect(() => parseReleaseChannelArgs(["--unknown"])).toThrow("Unknown argument: --unknown");
  });

  it("rejects update policies that skip integrity, consent, retry, rollback, or credential boundaries", () => {
    const manifest = cloneManifest({
      updatePolicy: {
        ...exampleManifest.updatePolicy,
        requiresUserConsent: false,
        verifiesArtifactChecksum: false,
        verifiesArtifactSignature: false,
        preservesCredentials: false,
        supportsRetry: false,
        supportsRollback: false,
        rollbackBoundary: ""
      }
    });

    expect(validateReleaseUpdateManifest(manifest).issues).toEqual(
      expect.arrayContaining([
        "$.updatePolicy.requiresUserConsent: must be true before packaged automatic updates are enabled",
        "$.updatePolicy.verifiesArtifactChecksum: must be true before packaged automatic updates are enabled",
        "$.updatePolicy.verifiesArtifactSignature: must be true before packaged automatic updates are enabled",
        "$.updatePolicy.preservesCredentials: must be true before packaged automatic updates are enabled",
        "$.updatePolicy.supportsRetry: must be true before packaged automatic updates are enabled",
        "$.updatePolicy.supportsRollback: must be true before packaged automatic updates are enabled",
        "$.updatePolicy.rollbackBoundary: must describe what rollback may and may not change"
      ])
    );
  });

  it("rejects unsigned manifests, unsigned artifacts, token-shaped strings, and secret-bearing URLs", () => {
    const manifest = cloneManifest({
      releaseNotesUrl: "https://example.com/releases?token=abc",
      manifestSignature: {
        kind: "apple-codesign-notarization",
        publicKeyId: "",
        signatureRef: "https://example.com/signatures?api_key=abc"
      },
      artifacts: [
        {
          ...exampleManifest.artifacts[0],
          url: "https://ghp_aaaaaaaaaaaaaaaaaaaa@example.com/artifact.dmg",
          signature: undefined
        }
      ]
    });

    expect(validateReleaseUpdateManifest(manifest).issues).toEqual(
      expect.arrayContaining([
        "$.releaseNotesUrl: must not contain secret-like query parameter token",
        "$.manifestSignature.kind: must use an approved signature kind",
        "$.manifestSignature.publicKeyId: must identify the verification key/certificate",
        "$.manifestSignature.signatureRef: must not contain secret-like query parameter api_key",
        "$.artifacts[0].url: must not contain URL userinfo credentials",
        "$.artifacts[0].signature: must be an object",
        "$.artifacts[0].url: must not contain token-shaped values"
      ])
    );
  });

  it("rejects package kinds and signature kinds that do not match the target platform", () => {
    const manifest = cloneManifest({
      artifacts: [
        {
          ...exampleManifest.artifacts[0],
          platform: "windows-x64",
          packageKind: "macos-dmg",
          signature: {
            ...exampleManifest.artifacts[0].signature,
            kind: "apple-codesign-notarization"
          }
        }
      ]
    });

    expect(validateReleaseUpdateManifest(manifest).issues).toEqual(
      expect.arrayContaining([
        "$.artifacts[0].packageKind: must match the target platform",
        "$.artifacts[0].signature.kind: must be windows-authenticode or sigstore-bundle for this platform"
      ])
    );
  });

  it("returns failed evidence for invalid manifest files", () => {
    const manifestPath = withTemporaryManifest(cloneManifest({ version: "v0.1.0" }));
    const evidence = verifyReleaseUpdateManifestFile(manifestPath);

    expect(evidence.status).toBe("failed");
    expect(evidence.issues).toContain("$.version: must be a semver string without a leading v");
    expect(evidence.checked).toEqual([]);
  });
});
