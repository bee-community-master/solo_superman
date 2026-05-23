import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  evaluateCredentialGroups,
  parseSignedPackagePreflightArgs,
  validateSignedPackagePreflightContract,
  verifySignedPackagePreflight
} from "./verify-signed-package-preflight.mjs";

const exampleContract = JSON.parse(readFileSync("docs/signed-package-preflight.example.json", "utf8"));

function cloneContract(overrides = {}) {
  return {
    ...JSON.parse(JSON.stringify(exampleContract)),
    ...overrides
  };
}

function withTemporaryContract(contract) {
  const dir = mkdtempSync(join(tmpdir(), "solo-signed-preflight-"));
  const path = join(dir, "contract.json");
  writeFileSync(path, `${JSON.stringify(contract, null, 2)}\n`);
  return path;
}

function envWithAllCredentials() {
  return Object.fromEntries(
    exampleContract.credentialGroups.flatMap((group) => group.requiredEnv.map((name) => [name, "set"]))
  );
}

describe("signed package preflight verification", () => {
  it("accepts the documented preflight contract without requiring local signing credentials", () => {
    expect(validateSignedPackagePreflightContract(exampleContract)).toEqual({ ok: true, issues: [] });

    const evidence = verifySignedPackagePreflight({ env: {} });
    expect(evidence.status).toBe("passed");
    expect(evidence.credentialGateStatus).toBe("blocked");
    expect(evidence.missingCredentialGroups.map((group) => group.id)).toEqual([
      "macos-developer-id",
      "windows-authenticode",
      "release-manifest-signing"
    ]);
    expect(evidence.checked).toContain("credential-free dry-run commands are separated from actual signing gates");
  });

  it("fails the credential gate only when credentials are explicitly required", () => {
    const evidence = verifySignedPackagePreflight({ env: {}, requireCredentials: true });

    expect(evidence.status).toBe("failed");
    expect(evidence.credentialGateStatus).toBe("blocked");
    expect(evidence.issues).toEqual(
      expect.arrayContaining([
        expect.stringContaining("macos-developer-id: missing required env"),
        expect.stringContaining("windows-authenticode: missing required env"),
        expect.stringContaining("release-manifest-signing: missing required env")
      ])
    );
  });

  it("marks credential groups ready without exposing credential values", () => {
    const env = envWithAllCredentials();
    const groups = evaluateCredentialGroups(exampleContract, env);

    expect(groups.every((group) => group.status === "ready")).toBe(true);
    expect(JSON.stringify(groups)).not.toContain("set");
    expect(verifySignedPackagePreflight({ env, requireCredentials: true }).status).toBe("passed");
  });

  it("rejects contracts with missing candidates, missing dry-run commands, or missing gates", () => {
    const contract = cloneContract({
      packageCandidates: exampleContract.packageCandidates.filter((candidate) => candidate.platform !== "windows"),
      localDryRunCommands: ["pnpm build"],
      hardGates: [
        {
          id: "macos-developer-id-signing",
          requiresCredentialGroup: "missing-group",
          evidence: "bad gate"
        }
      ]
    });

    expect(validateSignedPackagePreflightContract(contract).issues).toEqual(
      expect.arrayContaining([
        "$.packageCandidates: must include a windows candidate",
        "$.localDryRunCommands: must include pnpm verify:prod-bundle",
        "$.localDryRunCommands: must include pnpm verify:release-channel",
        "$.localDryRunCommands: must include pnpm verify:signed-package-preflight",
        "$.localDryRunCommands: must include pnpm verify:signed-package-release:dry-run",
        "$.hardGates[0].requiresCredentialGroup: must reference a declared credential group or external-device-evidence",
        "$.hardGates: must include macos-notarization-stapling",
        "$.hardGates: must include windows-authenticode-signing"
      ])
    );
  });

  it("rejects secret-bearing URLs, token-shaped strings, and invalid credential env names", () => {
    const contract = cloneContract({
      releaseRepositoryUrl: "https://example.com/release?token=abc",
      credentialGroups: [
        {
          id: "bad",
          purpose: "contains ghp_aaaaaaaaaaaaaaaaaaaa in prose",
          requiredEnv: ["lowercase_secret"]
        }
      ]
    });

    expect(validateSignedPackagePreflightContract(contract).issues).toEqual(
      expect.arrayContaining([
        "$.releaseRepositoryUrl: must not contain secret-like query parameter token",
        "$.credentialGroups[0].requiredEnv[0]: must be an uppercase environment variable name",
        "$.credentialGroups[0].purpose: must not contain token-shaped values"
      ])
    );
  });

  it("parses contract path and credential requirement arguments", () => {
    expect(parseSignedPackagePreflightArgs([])).toEqual({
      contractPath: "docs/signed-package-preflight.example.json",
      requireCredentials: false
    });
    expect(parseSignedPackagePreflightArgs(["--contract", "custom.json", "--require-credentials"])).toEqual({
      contractPath: "custom.json",
      requireCredentials: true
    });
    expect(parseSignedPackagePreflightArgs(["--manifest", "custom.json"])).toEqual({
      contractPath: "custom.json",
      requireCredentials: false
    });
    expect(parseSignedPackagePreflightArgs(["--", "--require-credentials"])).toEqual({
      contractPath: "docs/signed-package-preflight.example.json",
      requireCredentials: true
    });
    expect(() => parseSignedPackagePreflightArgs(["--contract"])).toThrow("--contract requires a path value");
    expect(() => parseSignedPackagePreflightArgs(["--unknown"])).toThrow("Unknown argument: --unknown");
  });

  it("returns failed evidence for invalid contract files", () => {
    const contractPath = withTemporaryContract(cloneContract({ appId: "other" }));
    const evidence = verifySignedPackagePreflight({ contractPath, env: {} });

    expect(evidence.status).toBe("failed");
    expect(evidence.issues).toContain("$.appId: must be solo-superman");
    expect(evidence.checked).toEqual([]);
  });
});
