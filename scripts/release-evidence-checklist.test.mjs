import { mkdtemp, readFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { describe, expect, it } from "vitest";
import {
  RELEASE_EVIDENCE_CHECKLIST_SCHEMA_VERSION,
  buildReleaseEvidenceChecklist,
  loadReleaseEvidenceContracts,
  parseReleaseEvidenceChecklistArgs,
  runReleaseEvidenceChecklistCli
} from "./release-evidence-checklist.mjs";

function minimalContracts(overrides = {}) {
  return {
    releaseReadiness: {
      schemaVersion: "solo-superman-release-readiness.v1",
      appId: "solo-superman",
      broadReleaseStatus: "blocked",
      requiredVerificationCommands: {
        credentialFree: ["pnpm verify:release-readiness"],
        readyRelease: ["pnpm verify:release-readiness -- --require-ready"]
      },
      releaseGates: []
    },
    windowsRealDevice: {
      schemaVersion: "solo-superman-windows-real-device.v1",
      appId: "solo-superman",
      windowsVerificationStatus: "blocked",
      requiredVerificationCommands: {
        credentialFree: ["pnpm verify:windows-real-device"],
        deviceEvidence: ["pnpm verify:windows-real-device -- --require-device-evidence"]
      },
      deviceRuns: []
    },
    signedPackagePreflight: {
      schemaVersion: "solo-superman-signed-package-preflight.v1",
      appId: "solo-superman",
      localDryRunCommands: ["pnpm verify:signed-package-preflight"],
      credentialGroups: [],
      hardGates: []
    },
    signedPackageRelease: {
      schemaVersion: "solo-superman-signed-package-release.v1",
      appId: "solo-superman",
      releaseEvidenceStatus: "blocked",
      requiredVerificationCommands: {
        credentialFree: ["pnpm verify:signed-package-release"],
        releaseEvidence: ["pnpm verify:signed-package-release -- --require-release-evidence"]
      },
      evidenceRuns: []
    },
    packagedUpdateRollback: {
      schemaVersion: "solo-superman-packaged-update-rollback.v1",
      appId: "solo-superman",
      rollbackStatus: "blocked",
      requiredVerificationCommands: {
        credentialFree: ["pnpm verify:packaged-update-rollback"],
        deviceEvidence: ["pnpm verify:packaged-update-rollback -- --require-device-evidence"]
      },
      deviceRuns: []
    },
    ...overrides
  };
}

describe("release evidence checklist", () => {
  it("consolidates blocked release evidence gates from the default contracts", async () => {
    const contracts = await loadReleaseEvidenceContracts();
    const checklist = buildReleaseEvidenceChecklist(contracts, { now: new Date("2026-05-24T00:00:00.000Z") });

    expect(checklist.schemaVersion).toBe(RELEASE_EVIDENCE_CHECKLIST_SCHEMA_VERSION);
    expect(checklist.generatedAt).toBe("2026-05-24T00:00:00.000Z");
    expect(checklist.status).toBe("blocked");
    expect(checklist.summary).toMatchObject({
      totalItems: 9,
      blockedItems: 9,
      readyItems: 0,
      blockerIssueNumbers: ["266", "267", "259"]
    });
    expect(checklist.openBlockerIssues).toEqual([
      "https://github.com/bee-community-master/solo_superman/issues/266",
      "https://github.com/bee-community-master/solo_superman/issues/267",
      "https://github.com/bee-community-master/solo_superman/issues/259"
    ]);
    expect(checklist.readyReleaseCommands).toEqual(expect.arrayContaining([
      "pnpm verify:signed-package-preflight -- --require-credentials",
      "pnpm verify:signed-package-release -- --require-release-evidence",
      "pnpm verify:windows-real-device -- --require-device-evidence",
      "pnpm verify:packaged-update-rollback -- --require-device-evidence",
      "pnpm verify:release-readiness -- --require-ready"
    ]));
    expect(checklist.credentialFreeCommands).toContain("pnpm verify");
    expect(checklist.credentialGroups.map((group) => group.id)).toEqual([
      "macos-developer-id",
      "windows-authenticode",
      "release-manifest-signing"
    ]);
    expect(checklist.checklistItems).toEqual(expect.arrayContaining([
      expect.objectContaining({ itemId: "windows-one-line-install-first-screen", gateId: "windows-real-device" }),
      expect.objectContaining({ itemId: "macos-signed-package-release", gateId: "signed-packages" }),
      expect.objectContaining({ itemId: "windows-packaged-update-rollback", gateId: "packaged-update-rollback" })
    ]));
    expect(checklist.issues).toEqual([]);
  });

  it("flags secret-like evidence refs instead of emitting a clean checklist", () => {
    const checklist = buildReleaseEvidenceChecklist(minimalContracts({
      releaseReadiness: {
        schemaVersion: "solo-superman-release-readiness.v1",
        appId: "solo-superman",
        broadReleaseStatus: "blocked",
        requiredVerificationCommands: {
          credentialFree: ["pnpm verify:release-readiness"],
          readyRelease: ["pnpm verify:release-readiness -- --require-ready"]
        },
        releaseGates: [
          {
            id: "signed-packages",
            status: "blocked",
            blockerIssue: "https://github.com/bee-community-master/solo_superman/issues/266",
            evidenceRefs: [
              "https://user:secret@example.com/release-log?token=secret-value",
              "ghp_abcdefghijklmnopqrstuvwxyz1234567890"
            ]
          }
        ]
      }
    }));

    expect(checklist.status).toBe("blocked");
    expect(checklist.issues).toEqual(expect.arrayContaining([
      expect.stringContaining("must not include URL userinfo credentials"),
      expect.stringContaining("must not contain token-shaped secret values")
    ]));
  });

  it("parses output arguments and writes checklist files", async () => {
    const dir = await mkdtemp(join(tmpdir(), "solo-release-evidence-checklist-test-"));
    try {
      const outputPath = join(dir, "checklist.json");

      expect(parseReleaseEvidenceChecklistArgs(["--output", outputPath], {})).toEqual({ outputPath });
      expect(parseReleaseEvidenceChecklistArgs(["--", "--output", outputPath], {})).toEqual({ outputPath });
      expect(parseReleaseEvidenceChecklistArgs([`--output=${outputPath}`], {})).toEqual({ outputPath });
      expect(() => parseReleaseEvidenceChecklistArgs(["--output"], {})).toThrow("--output requires a path value");

      await runReleaseEvidenceChecklistCli(["--output", outputPath], {
        contracts: minimalContracts(),
        now: new Date("2026-05-24T00:00:00.000Z")
      });

      const checklist = JSON.parse(await readFile(outputPath, "utf8"));
      expect(checklist).toMatchObject({
        schemaVersion: RELEASE_EVIDENCE_CHECKLIST_SCHEMA_VERSION,
        generatedAt: "2026-05-24T00:00:00.000Z",
        status: "ready"
      });
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});
