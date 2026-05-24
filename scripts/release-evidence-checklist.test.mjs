import { access, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { describe, expect, it } from "vitest";
import {
  RELEASE_EVIDENCE_CHECKLIST_SCHEMA_VERSION,
  RELEASE_EVIDENCE_BUNDLE_SCHEMA_VERSION,
  RELEASE_EVIDENCE_TEMPLATE_SCHEMA_VERSION,
  RELEASE_EVIDENCE_TEMPLATE_VALIDATION_SCHEMA_VERSION,
  buildFilledReleaseEvidenceTemplateFixture,
  buildReleaseEvidenceChecklist,
  buildReleaseEvidenceTemplate,
  filterReleaseEvidenceChecklistByIssue,
  loadReleaseEvidenceContracts,
  parseReleaseEvidenceChecklistArgs,
  renderReleaseEvidenceChecklistMarkdown,
  renderReleaseEvidenceIssueCommentMarkdown,
  runReleaseEvidenceChecklistCli,
  validateReleaseEvidenceTemplate
} from "./release-evidence-checklist.mjs";
import { runReleaseEvidenceTemplateVerifierCli } from "./verify-release-evidence-template.mjs";

function cloneJson(value) {
  return JSON.parse(JSON.stringify(value));
}

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
      "pnpm verify:release-evidence-bundle -- --bundle-dir ./solo-superman-release-evidence-bundle --require-ready",
      "pnpm verify:release-readiness -- --require-ready",
      "pnpm verify:ready-release -- --evidence-bundle-dir ./solo-superman-release-evidence-bundle"
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

  it("renders issue-ready release evidence comments with validation instructions", async () => {
    const checklist = buildReleaseEvidenceChecklist(await loadReleaseEvidenceContracts(), {
      now: new Date("2026-05-24T00:00:00.000Z")
    });
    const issue267Checklist = filterReleaseEvidenceChecklistByIssue(checklist, 267);
    const comment = renderReleaseEvidenceIssueCommentMarkdown(issue267Checklist);

    expect(comment).toContain("# Release evidence update for #267");
    expect(comment).toContain("`issue-267-template.json`");
    expect(comment).toContain(
      "`pnpm verify:release-evidence-template -- --input <filled-template.json> --issue 267`"
    );
    expect(comment).toContain("### macos-packaged-update-rollback");
    expect(comment).toContain("### windows-packaged-update-rollback");
    expect(comment).not.toContain("macos-signed-package-release");
    expect(comment).not.toContain("ghp_");
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

  it("validates filled release evidence templates without accepting placeholders", async () => {
    const checklist = buildReleaseEvidenceChecklist(await loadReleaseEvidenceContracts(), {
      now: new Date("2026-05-24T00:00:00.000Z")
    });
    const issue266Checklist = filterReleaseEvidenceChecklistByIssue(checklist, 266);
    const template = buildReleaseEvidenceTemplate(issue266Checklist);
    const pendingValidation = validateReleaseEvidenceTemplate(template, { expectedChecklist: issue266Checklist });

    expect(pendingValidation).toMatchObject({
      schemaVersion: RELEASE_EVIDENCE_TEMPLATE_VALIDATION_SCHEMA_VERSION,
      status: "blocked",
      filterIssueNumber: "266",
      itemCount: 4
    });
    expect(pendingValidation.issues).toEqual(expect.arrayContaining([
      expect.stringContaining('$.templateStatus must be "ready"'),
      expect.stringContaining("$.summary.pendingItems must be 0"),
      expect.stringContaining("must replace template placeholder"),
      expect.stringContaining("redactionConfirmed must be true")
    ]));

    const filledTemplate = buildFilledReleaseEvidenceTemplateFixture(template, {
      now: new Date("2026-05-24T01:02:03.000Z")
    });
    const validation = validateReleaseEvidenceTemplate(filledTemplate, { expectedChecklist: issue266Checklist });

    expect(filledTemplate).toMatchObject({
      templateStatus: "ready",
      summary: { totalItems: 4, pendingItems: 0, filterIssueNumber: "266" }
    });
    expect(filledTemplate.items[0].verification.readyReleaseCommandsRun).toEqual(template.readyReleaseCommands);
    expect(validation).toMatchObject({
      schemaVersion: RELEASE_EVIDENCE_TEMPLATE_VALIDATION_SCHEMA_VERSION,
      status: "passed",
      filterIssueNumber: "266",
      itemCount: 4,
      issues: []
    });

    const missingCommandTemplate = cloneJson(filledTemplate);
    missingCommandTemplate.items[0].verification.readyReleaseCommandsRun = template.readyReleaseCommands.slice(0, -1);

    expect(validateReleaseEvidenceTemplate(missingCommandTemplate, { expectedChecklist: issue266Checklist })).toMatchObject({
      status: "blocked",
      issues: expect.arrayContaining([
        expect.stringContaining("verification.readyReleaseCommandsRun must include required ready-release command")
      ])
    });

    const driftedTopLevelTemplate = cloneJson(filledTemplate);
    driftedTopLevelTemplate.readyReleaseCommands = template.readyReleaseCommands.slice(0, -1);

    expect(validateReleaseEvidenceTemplate(driftedTopLevelTemplate, { expectedChecklist: issue266Checklist })).toMatchObject({
      status: "blocked",
      issues: expect.arrayContaining([
        expect.stringContaining("$.readyReleaseCommands must include required ready-release command from source checklist")
      ])
    });

    const extraItemTemplate = cloneJson(filledTemplate);
    extraItemTemplate.items.push({
      ...cloneJson(filledTemplate.items[0]),
      itemId: "unexpected-release-evidence-item"
    });
    extraItemTemplate.summary.totalItems = extraItemTemplate.items.length;

    expect(validateReleaseEvidenceTemplate(extraItemTemplate, { expectedChecklist: issue266Checklist })).toMatchObject({
      status: "blocked",
      issues: expect.arrayContaining([
        expect.stringContaining("$.items must not include unexpected source checklist item")
      ])
    });

    const duplicateItemTemplate = cloneJson(filledTemplate);
    duplicateItemTemplate.items.push(cloneJson(filledTemplate.items[0]));
    duplicateItemTemplate.summary.totalItems = duplicateItemTemplate.items.length;

    expect(validateReleaseEvidenceTemplate(duplicateItemTemplate, { expectedChecklist: issue266Checklist })).toMatchObject({
      status: "blocked",
      issues: expect.arrayContaining([
        expect.stringContaining("$.items must not repeat source checklist item")
      ])
    });
  });

  it("validates filled fixture templates for every release blocker issue by default", async () => {
    const validation = await runReleaseEvidenceTemplateVerifierCli([], {
      contracts: await loadReleaseEvidenceContracts(),
      now: new Date("2026-05-24T00:00:00.000Z")
    });

    expect(validation).toMatchObject({
      schemaVersion: RELEASE_EVIDENCE_TEMPLATE_VALIDATION_SCHEMA_VERSION,
      status: "passed",
      mode: "credential-free-fixture",
      filterIssueNumber: "all",
      issueNumbers: [259, 266, 267],
      itemCount: 9,
      issues: []
    });
    expect(validation.templateValidations).toEqual([
      expect.objectContaining({ issueNumber: 259, status: "passed", filterIssueNumber: "259", itemCount: 2 }),
      expect.objectContaining({ issueNumber: 266, status: "passed", filterIssueNumber: "266", itemCount: 4 }),
      expect.objectContaining({ issueNumber: 267, status: "passed", filterIssueNumber: "267", itemCount: 3 })
    ]);
  });

  it("validates full input templates against every source checklist item", async () => {
    const dir = await mkdtemp(join(tmpdir(), "solo-release-evidence-full-template-test-"));
    try {
      const contracts = await loadReleaseEvidenceContracts();
      const fullChecklist = buildReleaseEvidenceChecklist(contracts, {
        now: new Date("2026-05-24T00:00:00.000Z")
      });
      const fullTemplate = buildFilledReleaseEvidenceTemplateFixture(buildReleaseEvidenceTemplate(fullChecklist));
      const fullTemplatePath = join(dir, "filled-full-template.json");
      await writeFile(fullTemplatePath, `${JSON.stringify(fullTemplate, null, 2)}\n`, "utf8");

      const validation = await runReleaseEvidenceTemplateVerifierCli(["--input", fullTemplatePath], {
        contracts,
        now: new Date("2026-05-24T00:00:00.000Z")
      });

      expect(validation).toMatchObject({
        status: "passed",
        filterIssueNumber: undefined,
        itemCount: 9,
        issues: []
      });

      const missingItemTemplate = cloneJson(fullTemplate);
      missingItemTemplate.items = missingItemTemplate.items.slice(1);
      missingItemTemplate.summary.totalItems = missingItemTemplate.items.length;
      const missingItemPath = join(dir, "missing-item-template.json");
      await writeFile(missingItemPath, `${JSON.stringify(missingItemTemplate, null, 2)}\n`, "utf8");

      const missingItemValidation = await runReleaseEvidenceTemplateVerifierCli(["--input", missingItemPath], {
        contracts,
        now: new Date("2026-05-24T00:00:00.000Z")
      });

      expect(missingItemValidation).toMatchObject({
        status: "blocked",
        issues: expect.arrayContaining([
          expect.stringContaining("$.items is missing source checklist item")
        ])
      });
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("rejects filled release evidence templates that contain secret-shaped evidence", async () => {
    const checklist = buildReleaseEvidenceChecklist(await loadReleaseEvidenceContracts(), {
      now: new Date("2026-05-24T00:00:00.000Z")
    });
    const issue266Checklist = filterReleaseEvidenceChecklistByIssue(checklist, 266);
    const filledTemplate = buildFilledReleaseEvidenceTemplateFixture(buildReleaseEvidenceTemplate(issue266Checklist));

    filledTemplate.items[0].requiredEvidence[0].evidenceRefs = [
      "https://user:secret@example.com/release-log?token=ghp_abcdefghijklmnopqrstuvwxyz1234567890"
    ];

    const validation = validateReleaseEvidenceTemplate(filledTemplate, { expectedChecklist: issue266Checklist });

    expect(validation.status).toBe("blocked");
    expect(validation.issues).toEqual(expect.arrayContaining([
      expect.stringContaining("must not include URL userinfo credentials"),
      expect.stringContaining("must not include secret-like query parameter"),
      expect.stringContaining("must not contain token-shaped secret values")
    ]));
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
        issueNumber: undefined,
        bundleDir: undefined
      });
      expect(parseReleaseEvidenceChecklistArgs(["--", "--output", outputPath], {})).toEqual({
        outputPath,
        format: "json",
        issueNumber: undefined,
        bundleDir: undefined
      });
      expect(parseReleaseEvidenceChecklistArgs([`--output=${outputPath}`], {})).toEqual({
        outputPath,
        format: "json",
        issueNumber: undefined,
        bundleDir: undefined
      });
      expect(parseReleaseEvidenceChecklistArgs(["--format", "markdown", "--issue", "266"], {})).toEqual({
        outputPath: undefined,
        format: "markdown",
        issueNumber: 266,
        bundleDir: undefined
      });
      expect(parseReleaseEvidenceChecklistArgs(["--format", "comment", "--issue", "267"], {})).toEqual({
        outputPath: undefined,
        format: "comment",
        issueNumber: 267,
        bundleDir: undefined
      });
      expect(parseReleaseEvidenceChecklistArgs(["--bundle-dir", "--", dir], {})).toMatchObject({
        outputPath: undefined,
        format: "json",
        issueNumber: undefined,
        bundleDir: dir
      });
      expect(() => parseReleaseEvidenceChecklistArgs(["--output"], {})).toThrow("--output requires a path value");
      expect(() => parseReleaseEvidenceChecklistArgs(["--format", "yaml"], {})).toThrow("--format must be one of");
      expect(() => parseReleaseEvidenceChecklistArgs(["--format", "comment"], {})).toThrow(
        "--format comment requires --issue"
      );
      expect(() => parseReleaseEvidenceChecklistArgs(["--issue", "abc"], {})).toThrow("--issue requires a positive integer");
      expect(() => parseReleaseEvidenceChecklistArgs(["--bundle-dir", dir, "--issue", "266"], {})).toThrow("--bundle-dir cannot be combined with --issue");

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

      await runReleaseEvidenceChecklistCli(["--format", "comment", "--issue", "266", "--output", outputPath], {
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

      const comment = await readFile(outputPath, "utf8");
      expect(comment).toContain("# Release evidence update for #266");
      expect(comment).toContain("`issue-266-template.json`");
      expect(comment).toContain("pnpm verify:release-evidence-template -- --input <filled-template.json> --issue 266");
      expect(comment).toContain("### signed-packages");
      expect(comment).not.toContain("ghp_");

      const emptyCommentPath = join(dir, "empty-comment.md");
      await expect(runReleaseEvidenceChecklistCli(["--format", "comment", "--issue", "999", "--output", emptyCommentPath], {
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
      })).rejects.toThrow("--format comment matched no release evidence checklist items for issue #999");
      await expect(access(emptyCommentPath)).rejects.toThrow();

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

      const filledTemplatePath = join(dir, "filled-template.json");
      const filledTemplate = buildFilledReleaseEvidenceTemplateFixture(template);
      await writeFile(filledTemplatePath, `${JSON.stringify(filledTemplate, null, 2)}\n`, "utf8");

      const validation = await runReleaseEvidenceTemplateVerifierCli(["--input", filledTemplatePath, "--issue", "266"], {
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
        })
      });
      expect(validation.status).toBe("passed");
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("writes a release evidence lab bundle for every blocker issue", async () => {
    const dir = await mkdtemp(join(tmpdir(), "solo-release-evidence-bundle-test-"));
    try {
      const bundleDir = join(dir, "bundle");
      const bundle = await runReleaseEvidenceChecklistCli(["--bundle-dir", bundleDir], {
        contracts: await loadReleaseEvidenceContracts(),
        now: new Date("2026-05-24T00:00:00.000Z")
      });

      expect(bundle).toMatchObject({
        schemaVersion: RELEASE_EVIDENCE_BUNDLE_SCHEMA_VERSION,
        status: "passed",
        checklistStatus: "blocked",
        bundleDir,
        issueNumbers: [259, 266, 267],
        summary: { totalItems: 9, blockedItems: 9 },
        issues: []
      });
      expect(bundle.files.map((file) => file.path)).toEqual(expect.arrayContaining([
        "README.md",
        "manifest.json",
        "release-evidence-checklist.json",
        "release-evidence-checklist.md",
        "release-evidence-template.json",
        "issue-259-checklist.md",
        "issue-259-template.json",
        "issue-259-comment.md",
        "issue-266-checklist.md",
        "issue-266-template.json",
        "issue-266-comment.md",
        "issue-267-checklist.md",
        "issue-267-template.json",
        "issue-267-comment.md"
      ]));

      const manifest = JSON.parse(await readFile(join(bundleDir, "manifest.json"), "utf8"));
      expect(manifest).toMatchObject({
        schemaVersion: RELEASE_EVIDENCE_BUNDLE_SCHEMA_VERSION,
        issueNumbers: [259, 266, 267],
        checklistStatus: "blocked",
        summary: { totalItems: 9 }
      });
      const fullTemplate = JSON.parse(await readFile(join(bundleDir, "release-evidence-template.json"), "utf8"));
      expect(fullTemplate.filterIssueNumber).toBeUndefined();
      expect(fullTemplate).toMatchObject({
        schemaVersion: RELEASE_EVIDENCE_TEMPLATE_SCHEMA_VERSION,
        summary: { totalItems: 9, pendingItems: 9 }
      });
      const issue266Template = JSON.parse(await readFile(join(bundleDir, "issue-266-template.json"), "utf8"));
      expect(issue266Template).toMatchObject({
        schemaVersion: RELEASE_EVIDENCE_TEMPLATE_SCHEMA_VERSION,
        filterIssueNumber: "266",
        summary: { totalItems: 4, pendingItems: 4 }
      });
      const issue266Comment = await readFile(join(bundleDir, "issue-266-comment.md"), "utf8");
      expect(issue266Comment).toContain("# Release evidence update for #266");
      expect(issue266Comment).toContain("pnpm verify:release-evidence-template -- --input <filled-template.json> --issue 266");
      const readme = await readFile(join(bundleDir, "README.md"), "utf8");
      expect(readme).toContain("#259");
      expect(readme).toContain("issue-259-comment.md");
      expect(readme).toContain("pnpm verify:release-evidence-template -- --input <filled-template.json>");
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});
