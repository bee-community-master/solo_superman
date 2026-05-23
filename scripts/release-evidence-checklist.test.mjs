import { mkdtemp, readFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { describe, expect, it } from "vitest";
import {
  RELEASE_EVIDENCE_CHECKLIST_SCHEMA_VERSION,
  RELEASE_EVIDENCE_TEMPLATE_SCHEMA_VERSION,
  buildReleaseEvidenceChecklist,
  buildReleaseEvidenceTemplate,
  filterReleaseEvidenceChecklistByIssue,
  loadReleaseEvidenceContracts,
  parseReleaseEvidenceChecklistArgs,
  renderReleaseEvidenceChecklistMarkdown,
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
    expect(checklist.credentialFreeCommands).toContain("pnpm verify:packaged-update-rollback:dry-run");
    expect(checklist.credentialFreeCommands).toContain("pnpm verify:windows-installer:dry-run");
    expect(checklist.credentialFreeCommands).toContain("pnpm verify:signed-package-release:dry-run");
    expect(checklist.checklistItems).toEqual(expect.arrayContaining([
      expect.objectContaining({ itemId: "windows-one-line-install-first-screen", gateId: "windows-real-device" }),
      expect.objectContaining({ itemId: "macos-signed-package-release", gateId: "signed-packages" }),
      expect.objectContaining({ itemId: "windows-packaged-update-rollback", gateId: "packaged-update-rollback" })
    ]));
    expect(checklist.issues).toEqual([]);
  });

  it("renders issue-filtered markdown checklists for release blocker issues", async () => {
    const checklist = buildReleaseEvidenceChecklist(await loadReleaseEvidenceContracts(), {
      now: new Date("2026-05-24T00:00:00.000Z")
    });
    const issue259Checklist = filterReleaseEvidenceChecklistByIssue(checklist, 259);
    const markdown = renderReleaseEvidenceChecklistMarkdown(issue259Checklist);

    expect(issue259Checklist.summary).toMatchObject({
      totalItems: 2,
      blockedItems: 2,
      filterIssueNumber: "259"
    });
    expect(markdown).toContain("# Solo Superman release evidence checklist");
    expect(markdown).toContain("- Filtered issue: #259");
    expect(markdown).toContain("### windows-real-device");
    expect(markdown).toContain("### windows-one-line-install-first-screen");
    expect(markdown).toContain("- [ ] `run_administrator_powershell_one_line_installer`");
    expect(markdown).toContain("- [ ] `pnpm verify:windows-real-device -- --require-device-evidence`");
    expect(markdown).not.toContain("macos-signed-package-release");
    expect(markdown).not.toContain("windows-packaged-update-rollback");

    const unknownIssueChecklist = filterReleaseEvidenceChecklistByIssue(checklist, 999);
    expect(unknownIssueChecklist).toMatchObject({
      status: "blocked",
      checklistItems: [],
      issues: ["No release evidence checklist items matched issue #999."]
    });
    expect(renderReleaseEvidenceChecklistMarkdown(unknownIssueChecklist)).toContain(
      "- No release evidence checklist items matched issue #999."
    );
  });

  it("builds redacted evidence templates for issue-filtered release blocker work", async () => {
    const checklist = buildReleaseEvidenceChecklist(await loadReleaseEvidenceContracts(), {
      now: new Date("2026-05-24T00:00:00.000Z")
    });
    const issue266Checklist = filterReleaseEvidenceChecklistByIssue(checklist, 266);
    const template = buildReleaseEvidenceTemplate(issue266Checklist);

    expect(template).toMatchObject({
      schemaVersion: RELEASE_EVIDENCE_TEMPLATE_SCHEMA_VERSION,
      generatedAt: "2026-05-24T00:00:00.000Z",
      sourceChecklistSchemaVersion: RELEASE_EVIDENCE_CHECKLIST_SCHEMA_VERSION,
      templateStatus: "pending",
      filterIssueNumber: "266",
      openBlockerIssues: ["https://github.com/bee-community-master/solo_superman/issues/266"],
      summary: { totalItems: 4, pendingItems: 4, filterIssueNumber: "266" },
      issues: []
    });
    expect(template.items).toEqual(expect.arrayContaining([
      expect.objectContaining({
        itemId: "macos-signed-package-release",
        expectedFinalStatus: "passed",
        currentStatus: "blocked",
        requiredChecks: expect.arrayContaining([
          expect.objectContaining({ id: "macos_codesign_verify", status: "pending" })
        ]),
        verification: expect.objectContaining({
          verifiedAt: "<UTC ISO timestamp>",
          redactionConfirmed: false,
          readyReleaseCommandsRun: []
        })
      }),
      expect.objectContaining({ itemId: "release-manifest-signing" })
    ]));
    expect(JSON.stringify(template)).toContain("<redacted evidence ref>");
    expect(JSON.stringify(template)).not.toContain("ghp_");
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

      expect(parseReleaseEvidenceChecklistArgs(["--output", outputPath], {})).toEqual({
        outputPath,
        format: "json",
        issueNumber: undefined
      });
      expect(parseReleaseEvidenceChecklistArgs(["--", "--output", outputPath], {})).toEqual({
        outputPath,
        format: "json",
        issueNumber: undefined
      });
      expect(parseReleaseEvidenceChecklistArgs([`--output=${outputPath}`], {})).toEqual({
        outputPath,
        format: "json",
        issueNumber: undefined
      });
      expect(parseReleaseEvidenceChecklistArgs(["--format", "markdown", "--issue", "266"], {})).toEqual({
        outputPath: undefined,
        format: "markdown",
        issueNumber: 266
      });
      expect(() => parseReleaseEvidenceChecklistArgs(["--output"], {})).toThrow("--output requires a path value");
      expect(() => parseReleaseEvidenceChecklistArgs(["--format", "yaml"], {})).toThrow("--format must be one of");
      expect(() => parseReleaseEvidenceChecklistArgs(["--issue", "abc"], {})).toThrow("--issue requires a positive integer");

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

      await runReleaseEvidenceChecklistCli(["--format", "markdown", "--issue", "266", "--output", outputPath], {
        contracts: minimalContracts({
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
                requiredChecks: ["release_manifest_signature_verify"],
                requiredEvidence: ["redacted signing evidence"],
                unblockCriteria: ["attach redacted evidence"]
              }
            ]
          }
        }),
        now: new Date("2026-05-24T00:00:00.000Z")
      });

      const markdown = await readFile(outputPath, "utf8");
      expect(markdown).toContain("- Filtered issue: #266");
      expect(markdown).toContain("- [ ] `release_manifest_signature_verify`");
      expect(markdown).toContain("- [ ] redacted signing evidence");

      await runReleaseEvidenceChecklistCli(["--format", "template", "--issue", "266", "--output", outputPath], {
        contracts: minimalContracts({
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
                requiredChecks: ["release_manifest_signature_verify"],
                requiredEvidence: ["redacted signing evidence"],
                unblockCriteria: ["attach redacted evidence"]
              }
            ]
          }
        }),
        now: new Date("2026-05-24T00:00:00.000Z")
      });

      const template = JSON.parse(await readFile(outputPath, "utf8"));
      expect(template).toMatchObject({
        schemaVersion: RELEASE_EVIDENCE_TEMPLATE_SCHEMA_VERSION,
        filterIssueNumber: "266",
        templateStatus: "pending",
        summary: { totalItems: 1, pendingItems: 1 }
      });
      expect(template.items[0].requiredChecks[0]).toMatchObject({
        id: "release_manifest_signature_verify",
        status: "pending"
      });
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});
