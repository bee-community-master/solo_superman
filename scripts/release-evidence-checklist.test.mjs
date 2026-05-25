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
  readyReleaseCommandsRequiredBeforeAggregate,
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
    expect(readyReleaseCommandsRequiredBeforeAggregate(checklist.readyReleaseCommands)).not.toContain(
      "pnpm verify:ready-release -- --evidence-bundle-dir ./solo-superman-release-evidence-bundle"
    );
    expect(readyReleaseCommandsRequiredBeforeAggregate(checklist.readyReleaseCommands)).not.toContain(
      "pnpm verify:release-evidence-bundle -- --bundle-dir ./solo-superman-release-evidence-bundle --require-ready"
    );
    expect(readyReleaseCommandsRequiredBeforeAggregate(checklist.readyReleaseCommands)).toEqual(expect.arrayContaining([
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
    expect(comment).toContain("`pnpm verify:ready-release -- --evidence-bundle-dir <bundle-dir>`");
    expect(comment).toContain("aggregate `commandBlockers`");
    expect(comment).toContain("nested verifier commands");
    expect(comment).toContain("do not list those self-referential verifier commands");
    expect(comment).toContain("Per-command blockers");
    expect(comment).toContain("`verification.readyReleaseResult.status`");
    expect(comment).toContain("`verification.readyReleaseResult.commandBlockers`");
    expect(comment).toContain("`verification.readyReleaseResult.perCommandBlockers`");
    expect(comment).toContain("Template readyReleaseResult");
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
    expect(template.readyReleaseCommands).toContain(
      "pnpm verify:ready-release -- --evidence-bundle-dir ./solo-superman-release-evidence-bundle"
    );
    expect(template.readyReleaseCommandsRequiredBeforeAggregate).not.toContain(
      "pnpm verify:ready-release -- --evidence-bundle-dir ./solo-superman-release-evidence-bundle"
    );
    expect(template.items).toEqual(expect.arrayContaining([
      expect.objectContaining({
        itemId: "macos-signed-package-release",
        expectedFinalStatus: "passed",
        currentStatus: "blocked",
        requiredChecks: expect.arrayContaining([
          expect.objectContaining({ id: "macos_codesign_verify", status: "pending" })
        ]),
        evidenceBundleShape: expect.objectContaining({
          kind: "macos-signed-package",
          requiredFields: expect.arrayContaining([
            "artifactRef",
            "publicCertificate.fingerprintSha256",
            "notarizationRef",
            "passedChecks[]"
          ]),
          allowedPackageKinds: ["macos-dmg", "macos-pkg"],
          requiredPassedChecks: expect.arrayContaining(["macos_codesign_verify"])
        }),
        verification: expect.objectContaining({
          verifiedAt: "<UTC ISO timestamp>",
          redactionConfirmed: false,
          readyReleaseCommandsRun: [],
          readyReleaseResult: {
            status: "pending",
            commandBlockers: ["<aggregate commandBlockers or none>"],
            perCommandBlockers: ["<matching command blockers or none>"]
          }
        })
      }),
      expect.objectContaining({ itemId: "release-manifest-signing" })
    ]));
    expect(JSON.stringify(template)).toContain("<redacted evidence ref>");
    expect(JSON.stringify(template)).not.toContain("ghp_");
  });

  it("adds structured evidenceBundle shape hints for device and release-lab runs", async () => {
    const checklist = buildReleaseEvidenceChecklist(await loadReleaseEvidenceContracts(), {
      now: new Date("2026-05-24T00:00:00.000Z")
    });

    const issue259Template = buildReleaseEvidenceTemplate(filterReleaseEvidenceChecklistByIssue(checklist, 259));
    const windowsRun = issue259Template.items.find((item) => item.itemId === "windows-one-line-install-first-screen");
    expect(windowsRun?.evidenceBundleShape).toMatchObject({
      kind: "windows-real-device",
      requiredFields: expect.arrayContaining([
        "deviceProfile.environmentKind",
        "installerCommandRef",
        "firstScreenEvidenceRef",
        "checkEvidenceRefs.run_administrator_powershell_one_line_installer"
      ]),
      allowedDeviceEnvironmentKinds: ["physical-device", "vm"],
      requiredPassedChecks: expect.arrayContaining(["reach_first_screen"])
    });

    const issue266Template = buildReleaseEvidenceTemplate(filterReleaseEvidenceChecklistByIssue(checklist, 266));
    const manifestRun = issue266Template.items.find((item) => item.itemId === "release-manifest-signing");
    expect(manifestRun?.evidenceBundleShape).toMatchObject({
      kind: "release-manifest-signing",
      requiredFields: expect.arrayContaining([
        "manifestRef",
        "manifestSignatureRef",
        "artifactRefs[].scope",
        "artifactRefs[].signatureRef"
      ]),
      requiredArtifactScopes: ["macos", "windows"],
      requiredPassedChecks: expect.arrayContaining(["release_manifest_signature_verify"])
    });

    const issue267Template = buildReleaseEvidenceTemplate(filterReleaseEvidenceChecklistByIssue(checklist, 267));
    const rollbackRun = issue267Template.items.find((item) => item.itemId === "windows-packaged-update-rollback");
    expect(rollbackRun?.evidenceBundleShape).toMatchObject({
      kind: "windows-packaged-update-rollback",
      requiredFields: expect.arrayContaining([
        "credentialSnapshotMode",
        "rollbackLogRef",
        "checkEvidenceRefs.rollback_after_failed_launch",
        "protectedPathEvidenceRefs.credentials"
      ]),
      allowedPackageKinds: ["windows-msi", "windows-exe"],
      requiredCredentialSnapshotMode: "metadata_only_no_read",
      requiredProtectedPathEvidenceRefs: expect.arrayContaining(["localDatabase", "credentials"])
    });
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
    expect(filledTemplate.items[0].verification.readyReleaseCommandsRun).toEqual(
      template.readyReleaseCommandsRequiredBeforeAggregate
    );
    expect(filledTemplate.items[0].verification.readyReleaseCommandsRun).not.toContain(
      "pnpm verify:ready-release -- --evidence-bundle-dir ./solo-superman-release-evidence-bundle"
    );
    expect(filledTemplate.items[0].verification.readyReleaseCommandsRun).not.toContain(
      "pnpm verify:release-evidence-bundle -- --bundle-dir ./solo-superman-release-evidence-bundle --require-ready"
    );
    expect(filledTemplate.items[0].verification.readyReleaseResult).toEqual({
      status: "passed",
      commandBlockers: ["none"],
      perCommandBlockers: ["none"]
    });
    expect(validation).toMatchObject({
      schemaVersion: RELEASE_EVIDENCE_TEMPLATE_VALIDATION_SCHEMA_VERSION,
      status: "passed",
      filterIssueNumber: "266",
      itemCount: 4,
      issues: []
    });

    expect(validation.checked).toContain("structured evidenceBundle shape hints match the source release contracts");

    const driftedEvidenceBundleShapeTemplate = cloneJson(filledTemplate);
    const macosShapeItem = driftedEvidenceBundleShapeTemplate.items.find(
      (item) => item.itemId === "macos-signed-package-release"
    );
    macosShapeItem.evidenceBundleShape.requiredFields = macosShapeItem.evidenceBundleShape.requiredFields.filter(
      (field) => field !== "notarizationRef"
    );

    expect(validateReleaseEvidenceTemplate(driftedEvidenceBundleShapeTemplate, { expectedChecklist: issue266Checklist })).toMatchObject({
      status: "blocked",
      issues: expect.arrayContaining([
        expect.stringContaining("evidenceBundleShape must match the expected structured evidence bundle shape")
      ])
    });

    const missingCommandTemplate = cloneJson(filledTemplate);
    missingCommandTemplate.items[0].verification.readyReleaseCommandsRun =
      template.readyReleaseCommandsRequiredBeforeAggregate.slice(0, -1);

    expect(validateReleaseEvidenceTemplate(missingCommandTemplate, { expectedChecklist: issue266Checklist })).toMatchObject({
      status: "blocked",
      issues: expect.arrayContaining([
        expect.stringContaining("verification.readyReleaseCommandsRun must include required ready-release command")
      ])
    });

    const missingReadyReleaseResultTemplate = cloneJson(filledTemplate);
    missingReadyReleaseResultTemplate.items[0].verification.readyReleaseResult = {
      status: "pending",
      commandBlockers: [],
      perCommandBlockers: []
    };

    expect(validateReleaseEvidenceTemplate(missingReadyReleaseResultTemplate, { expectedChecklist: issue266Checklist })).toMatchObject({
      status: "blocked",
      issues: expect.arrayContaining([
        expect.stringContaining('verification.readyReleaseResult.status must be "passed" or "blocked"'),
        expect.stringContaining("verification.readyReleaseResult.commandBlockers must be a non-empty array"),
        expect.stringContaining("verification.readyReleaseResult.perCommandBlockers must be a non-empty array")
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
        summary: { totalItems: 9 },
        releaseEvidenceBlockerSummary: {
          status: "blocked",
          issueNumbers: [259, 266, 267],
          blockedIssueNumbers: [259, 266, 267],
          issueCount: 3,
          blockedIssueCount: 3,
          totalItemCount: 9,
          blockedItemCount: 9,
          nextAction: expect.stringContaining("Fill each blocked issue template")
        },
        releaseEvidenceIssueSummaries: expect.arrayContaining([
          expect.objectContaining({
            issueNumber: 259,
            itemCount: 2,
            blockedItems: 2,
            checklistItems: expect.arrayContaining([
              expect.objectContaining({
                itemId: "windows-real-device",
                gateId: "release-readiness",
                requiredEvidenceCount: 4,
                unblockCriteriaCount: 3
              }),
              expect.objectContaining({
                itemId: "windows-one-line-install-first-screen",
                gateId: "windows-real-device",
                requiredCheckCount: 11,
                requiredEvidenceCount: 4
              })
            ])
          }),
          expect.objectContaining({
            issueNumber: 266,
            itemCount: 4,
            blockedItems: 4,
            checklistItems: expect.arrayContaining([
              expect.objectContaining({
                itemId: "release-manifest-signing",
                gateId: "signed-packages",
                requiredCheckCount: 4,
                requiredEvidenceCount: 4,
                unblockCriteriaCount: 3
              })
            ])
          }),
          expect.objectContaining({
            issueNumber: 267,
            itemCount: 3,
            blockedItems: 3,
            checklistItems: expect.arrayContaining([
              expect.objectContaining({
                itemId: "macos-packaged-update-rollback",
                gateId: "packaged-update-rollback",
                requiredCheckCount: 8,
                requiredEvidenceCount: 7
              })
            ])
          })
        ])
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
      expect(issue266Comment).toContain("pnpm verify:ready-release -- --evidence-bundle-dir <bundle-dir>");
      expect(issue266Comment).toContain("aggregate `commandBlockers`");
      expect(issue266Comment).toContain("`verification.readyReleaseResult.status`");
      expect(issue266Comment).toContain("Template readyReleaseResult");
      const readme = await readFile(join(bundleDir, "README.md"), "utf8");
      expect(readme).toContain("#259");
      expect(readme).toContain("## Release blocker summary");
      expect(readme).toContain("Blocked issues: `3 / 3` (#259, #266, #267)");
      expect(readme).toContain("Blocked evidence items: `9 / 9`");
      expect(readme).toContain("Fill each blocked issue template with redacted release-lab evidence");
      expect(readme).toContain("Use each item's `evidenceBundleShape`");
      expect(readme).toContain("structured `evidenceBundle` fields");
      expect(readme).toContain("## Issue evidence item summary");
      expect(readme).toContain("#259: `2 / 2` blocked evidence items");
      expect(readme).toContain("`windows-real-device` (release-readiness, blocked; checks 0, evidence 4, unblock 3)");
      expect(readme).toContain("`release-manifest-signing` (signed-packages, blocked; checks 4, evidence 4, unblock 3)");
      expect(readme).toContain("issue-259-comment.md");
      expect(readme).toContain("pnpm verify:release-evidence-template -- --input <filled-template.json>");
      expect(readme).toContain("pnpm verify:release-evidence-bundle -- --bundle-dir <bundle-dir>");
      expect(readme).toContain("pnpm verify:release-evidence-bundle -- --bundle-dir <bundle-dir> --require-ready");
      expect(readme).toContain("pnpm verify:ready-release -- --evidence-bundle-dir <bundle-dir>");
      expect(readme).toContain("aggregate `commandBlockers` list");
      expect(readme).toContain("matching command entry's `blockers` array");
      expect(readme).toContain("nested verifier commands only");
      expect(readme).toContain("filled-bundle verifier and aggregate ready-release self-commands");
      expect(readme).toContain("Do not add the `verify:release-evidence-bundle --require-ready` or aggregate `verify:ready-release` self-commands to `readyReleaseCommandsRun`");
      expect(readme).toContain("`verification.readyReleaseResult.status`");
      expect(readme).toContain("`verification.readyReleaseResult.commandBlockers`");
      expect(readme).toContain("`verification.readyReleaseResult.perCommandBlockers`");
      expect(readme).toContain("JSON evidence and issue comment agree");
      expect(readme).toContain("filled template and full bundle pass validation");
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});
