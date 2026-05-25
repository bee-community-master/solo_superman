import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  buildFilledReleaseEvidenceTemplateFixture,
  buildReleaseEvidenceBundle,
  buildReleaseEvidenceChecklist,
  buildReleaseEvidenceTemplate,
  filterReleaseEvidenceChecklistByIssue,
  loadReleaseEvidenceContracts
} from "./release-evidence-checklist.mjs";
import {
  RELEASE_EVIDENCE_BUNDLE_VALIDATION_SCHEMA_VERSION,
  parseReleaseEvidenceBundleVerifierArgs,
  runReleaseEvidenceBundleVerification
} from "./verify-release-evidence-bundle.mjs";

async function writeBundle(bundleDir, bundle, overrides = {}) {
  await Promise.all(bundle.files.map(async (file) => {
    const content = overrides[file.path] ?? file.content;
    await writeFile(join(bundleDir, file.path), content, "utf8");
  }));
}

describe("release evidence bundle verification", () => {
  it("passes the generated credential-free bundle structure", async () => {
    const evidence = await runReleaseEvidenceBundleVerification([], {});

    expect(evidence).toMatchObject({
      status: "passed",
      schemaVersion: RELEASE_EVIDENCE_BUNDLE_VALIDATION_SCHEMA_VERSION,
      mode: "generated-bundle",
      requireReady: false,
      checklistStatus: "blocked",
      blockers: []
    });
    expect(evidence.issueNumbers).toEqual([259, 266, 267]);
    expect(evidence.releaseEvidenceBlockerSummary).toMatchObject({
      status: "blocked",
      issueNumbers: [259, 266, 267],
      blockedIssueNumbers: [259, 266, 267],
      issueCount: 3,
      blockedIssueCount: 3,
      totalItemCount: 9,
      blockedItemCount: 9
    });
    expect(evidence.releaseEvidenceIssueSummaries).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          issueNumber: 259,
          itemCount: 2,
          blockedItems: 2,
          checklistItems: expect.arrayContaining([
            expect.objectContaining({ itemId: "windows-real-device", requiredEvidenceCount: 4 }),
            expect.objectContaining({
              itemId: "windows-one-line-install-first-screen",
              evidenceBundleShapeKind: "windows-real-device",
              evidenceBundleRequiredFieldCount: 22,
              evidenceBundleRequiredPassedCheckCount: 11
            })
          ])
        })
      ])
    );
    expect(evidence.fileCount).toBeGreaterThan(0);
    expect(evidence.checked).toContain("release evidence blocker summary is carried through the bundle");
    expect(evidence.checked).toContain(
      "issue-specific evidence item summaries and compact evidenceBundle shape metadata are carried through the bundle"
    );
  });

  it("validates an on-disk generated bundle directory", async () => {
    const contracts = await loadReleaseEvidenceContracts();
    const bundle = buildReleaseEvidenceBundle(buildReleaseEvidenceChecklist(contracts, {
      now: new Date("2026-05-24T00:00:00.000Z")
    }));
    const bundleDir = await mkdtemp(join(tmpdir(), "solo-release-evidence-bundle-test-"));
    try {
      await writeBundle(bundleDir, bundle);
      const evidence = await runReleaseEvidenceBundleVerification(["--bundle-dir", bundleDir], {
        now: new Date("2026-05-24T00:00:00.000Z")
      });

      expect(evidence.status).toBe("passed");
      expect(evidence.mode).toBe("bundle-dir");
      expect(evidence.blockers).toEqual([]);
      expect(evidence.releaseEvidenceBlockerSummary).toMatchObject({
        status: "blocked",
        blockedIssueNumbers: [259, 266, 267],
        blockedItemCount: 9
      });
    } finally {
      await rm(bundleDir, { recursive: true, force: true });
    }
  });

  it("rejects generated bundle templates when structured evidenceBundle shapes drift", async () => {
    const contracts = await loadReleaseEvidenceContracts();
    const checklist = buildReleaseEvidenceChecklist(contracts, { now: new Date("2026-05-24T00:00:00.000Z") });
    const bundle = buildReleaseEvidenceBundle(checklist);
    const issue267TemplateFile = bundle.files.find((file) => file.path === "issue-267-template.json");
    const issue267Template = JSON.parse(issue267TemplateFile.content);
    const windowsRollbackItem = issue267Template.items.find((item) => item.itemId === "windows-packaged-update-rollback");
    windowsRollbackItem.evidenceBundleShape.requiredFields = windowsRollbackItem.evidenceBundleShape.requiredFields.filter(
      (field) => field !== "protectedPathEvidenceRefs.credentials"
    );
    const bundleDir = await mkdtemp(join(tmpdir(), "solo-release-evidence-bundle-test-"));
    try {
      await writeBundle(bundleDir, bundle, {
        "issue-267-template.json": `${JSON.stringify(issue267Template, null, 2)}\n`
      });

      const evidence = await runReleaseEvidenceBundleVerification(["--bundle-dir", bundleDir], {
        now: new Date("2026-05-24T00:00:00.000Z")
      });

      expect(evidence.status).toBe("blocked");
      expect(evidence.blockers.some((blocker) =>
        blocker.includes("issue-267-template.json.items") &&
        blocker.includes("evidenceBundleShape: must match the expected structured evidence bundle shape")
      )).toBe(true);
    } finally {
      await rm(bundleDir, { recursive: true, force: true });
    }
  });

  it("rejects bundle manifests that omit or drift the blocker summary", async () => {
    const contracts = await loadReleaseEvidenceContracts();
    const checklist = buildReleaseEvidenceChecklist(contracts, { now: new Date("2026-05-24T00:00:00.000Z") });
    const bundle = buildReleaseEvidenceBundle(checklist);
    const bundleDir = await mkdtemp(join(tmpdir(), "solo-release-evidence-bundle-test-"));
    try {
      await writeBundle(bundleDir, bundle, {
        "manifest.json": `${JSON.stringify({
          ...bundle.manifest,
          releaseEvidenceBlockerSummary: {
            ...bundle.manifest.releaseEvidenceBlockerSummary,
            blockedItemCount: 0
          }
        }, null, 2)}\n`
      });

      const evidence = await runReleaseEvidenceBundleVerification(["--bundle-dir", bundleDir], {
        now: new Date("2026-05-24T00:00:00.000Z")
      });

      expect(evidence.status).toBe("blocked");
      expect(evidence.blockers).toContain(
        "$.releaseEvidenceBlockerSummary.blockedItemCount: must match the generated release evidence blocker summary"
      );
    } finally {
      await rm(bundleDir, { recursive: true, force: true });
    }
  });

  it("rejects bundle manifests that drift from the issue-specific evidence item summaries", async () => {
    const contracts = await loadReleaseEvidenceContracts();
    const checklist = buildReleaseEvidenceChecklist(contracts, { now: new Date("2026-05-24T00:00:00.000Z") });
    const bundle = buildReleaseEvidenceBundle(checklist);
    const bundleDir = await mkdtemp(join(tmpdir(), "solo-release-evidence-bundle-test-"));
    try {
      await writeBundle(bundleDir, bundle, {
        "manifest.json": `${JSON.stringify({
          ...bundle.manifest,
          releaseEvidenceIssueSummaries: bundle.manifest.releaseEvidenceIssueSummaries.map((summary, index) =>
            index === 0
              ? {
                ...summary,
                checklistItems: summary.checklistItems.map((item, itemIndex) =>
                  itemIndex === 0 ? { ...item, requiredEvidenceCount: 999 } : item
                )
              }
              : summary
          )
        }, null, 2)}\n`
      });

      const evidence = await runReleaseEvidenceBundleVerification(["--bundle-dir", bundleDir], {
        now: new Date("2026-05-24T00:00:00.000Z")
      });

      expect(evidence.status).toBe("blocked");
      expect(evidence.blockers).toContain(
        "$.releaseEvidenceIssueSummaries: must match the generated issue-specific release evidence item summaries"
      );
    } finally {
      await rm(bundleDir, { recursive: true, force: true });
    }
  });

  it("reports missing bundle directories as structured blockers", async () => {
    const bundleDir = join(tmpdir(), `solo-release-evidence-bundle-missing-${process.pid}-${Date.now()}`);
    await rm(bundleDir, { recursive: true, force: true });

    const evidence = await runReleaseEvidenceBundleVerification(["--bundle-dir", bundleDir], {});

    expect(evidence).toMatchObject({
      status: "blocked",
      mode: "bundle-dir",
      bundleDir,
      blockers: ["$.bundleDir: must exist before verifying release evidence"]
    });
  });

  it("reports missing manifests without hiding secret-shaped bundle contents", async () => {
    const bundleDir = await mkdtemp(join(tmpdir(), "solo-release-evidence-bundle-test-"));
    try {
      await writeFile(join(bundleDir, "scratch-note.txt"), "token=ghp_abcdefghijklmnopqrstuvwxyz1234567890\n", "utf8");

      const evidence = await runReleaseEvidenceBundleVerification(["--bundle-dir", bundleDir], {});

      expect(evidence.status).toBe("blocked");
      expect(evidence.blockers).toEqual(expect.arrayContaining([
        "file:manifest.json: must exist in the bundle directory",
        "file:scratch-note.txt: must not contain token-shaped secret values"
      ]));
      expect(evidence.blockers.some((blocker) => blocker.includes("ENOENT"))).toBe(false);
    } finally {
      await rm(bundleDir, { recursive: true, force: true });
    }
  });

  it("rejects missing files, unexpected files, unlisted files, and secret-shaped content", async () => {
    const contracts = await loadReleaseEvidenceContracts();
    const checklist = buildReleaseEvidenceChecklist(contracts, { now: new Date("2026-05-24T00:00:00.000Z") });
    const bundle = buildReleaseEvidenceBundle(checklist);
    const manifest = {
      ...bundle.manifest,
      files: [
        ...bundle.manifest.files,
        { kind: "unexpected", path: "unexpected.json", format: "json" }
      ]
    };
    const bundleDir = await mkdtemp(join(tmpdir(), "solo-release-evidence-bundle-test-"));
    try {
      await writeBundle(bundleDir, { ...bundle, files: bundle.files.filter((file) => file.path !== "issue-259-comment.md") }, {
        "manifest.json": `${JSON.stringify(manifest, null, 2)}\n`,
        "README.md": "Evidence URL: https://example.com/release?token=ghp_abcdefghijklmnopqrstuvwxyz1234567890\n"
      });
      await writeFile(join(bundleDir, "unexpected.json"), "{}\n", "utf8");
      await writeFile(join(bundleDir, "unlisted-secret.txt"), "ghp_abcdefghijklmnopqrstuvwxyz1234567890\n", "utf8");
      const evidence = await runReleaseEvidenceBundleVerification(["--bundle-dir", bundleDir], {
        now: new Date("2026-05-24T00:00:00.000Z")
      });

      expect(evidence.status).toBe("blocked");
      expect(evidence.blockers).toEqual(expect.arrayContaining([
        "file:issue-259-comment.md: must exist in the bundle directory",
        "$.files: must not include unexpected bundle file unexpected.json",
        "file:unlisted-secret.txt: must be listed in the release evidence bundle manifest",
        "file:unlisted-secret.txt: must not contain token-shaped secret values",
        "file:README.md: must not contain token-shaped secret values",
        "file:README.md: must not include secret-like query parameter \"token\""
      ]));
    } finally {
      await rm(bundleDir, { recursive: true, force: true });
    }
  });

  it("requires filled templates when --require-ready is set", async () => {
    const contracts = await loadReleaseEvidenceContracts();
    const checklist = buildReleaseEvidenceChecklist(contracts, { now: new Date("2026-05-24T00:00:00.000Z") });
    const bundle = buildReleaseEvidenceBundle(checklist);
    const bundleDir = await mkdtemp(join(tmpdir(), "solo-release-evidence-bundle-test-"));
    try {
      const overrides = Object.fromEntries(bundle.files
        .filter((file) => file.kind === "issue-template-json")
        .map((file) => {
          const issueChecklist = filterReleaseEvidenceChecklistByIssue(checklist, file.issueNumber);
          const filled = buildFilledReleaseEvidenceTemplateFixture(buildReleaseEvidenceTemplate(issueChecklist), {
            now: new Date("2026-05-24T00:00:00.000Z")
          });
          return [file.path, `${JSON.stringify(filled, null, 2)}\n`];
        }));
      overrides["release-evidence-template.json"] = `${JSON.stringify(buildFilledReleaseEvidenceTemplateFixture(
        buildReleaseEvidenceTemplate(checklist),
        { now: new Date("2026-05-24T00:00:00.000Z") }
      ), null, 2)}\n`;
      await writeBundle(bundleDir, bundle, overrides);

      const evidence = await runReleaseEvidenceBundleVerification(["--bundle-dir", bundleDir, "--require-ready"], {
        now: new Date("2026-05-24T00:00:00.000Z")
      });

      expect(evidence.status).toBe("passed");
      expect(evidence.requireReady).toBe(true);
    } finally {
      await rm(bundleDir, { recursive: true, force: true });
    }
  });

  it("parses bundle verifier flags", () => {
    expect(parseReleaseEvidenceBundleVerifierArgs(["--bundle-dir", "bundle", "--require-ready", "--timeout-ms", "2000"], {})).toMatchObject({
      bundleDir: expect.stringContaining("bundle"),
      requireReady: true,
      timeoutMs: 2000
    });
    expect(parseReleaseEvidenceBundleVerifierArgs([], {
      SOLO_RELEASE_EVIDENCE_BUNDLE_REQUIRE_READY: "1",
      SOLO_RELEASE_EVIDENCE_BUNDLE_TIMEOUT_MS: "3000"
    })).toMatchObject({ requireReady: true, timeoutMs: 3000 });
    expect(() => parseReleaseEvidenceBundleVerifierArgs(["--bundle-dir"], {})).toThrow("--bundle-dir requires a path value");
    expect(() => parseReleaseEvidenceBundleVerifierArgs(["--timeout-ms", "0"], {})).toThrow("--timeout-ms requires a positive integer value");
  });
});
