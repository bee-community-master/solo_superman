import { createElement } from "react";
import { describe, expect, it } from "vitest";
import { IMPLEMENTATION_STEP_LEDGER_READY_FIXTURE } from "@solo-superman/contracts";
import {
  ImplementationStepLedgerPanel,
  implementationStepLedgerViewModel
} from "./ImplementationStepLedgerPanel";
import { renderEnglishMarkup } from "./test-rendering";

describe("ImplementationStepLedgerPanel view model", () => {
  it("shows commit, rollback, separate review records, tests, and progress report for a completed step", () => {
    const view = implementationStepLedgerViewModel(IMPLEMENTATION_STEP_LEDGER_READY_FIXTURE);

    expect(view.status).toBe("completed");
    expect(view.trackerLabel).toContain("Demo implementation tracker");
    expect(view.progressReport).toContain("Create deterministic ledger");
    expect(view.commitLabel).toContain("abcdef1");
    expect(view.previousCommitLabel).toContain("1234567");
    expect(view.diffRangeLabel).toContain("1234567..abcdef1");
    expect(view.rollbackLabel).toContain("rollback:git-revert:abcdef1");
    expect(view.codeReviewLabel).toContain("Code review: repository passed");
    expect(view.cleanCodeReviewLabel).toContain("Clean-code review: repository passed");
    expect(view.testEvidenceLabel).toContain("Tests: passed");
    expect(view.missingEvidenceItems).toEqual([]);
  });

  it("uses a visible not-started state before any ledger projection exists", () => {
    const view = implementationStepLedgerViewModel(null);

    expect(view.status).toBe("not_started");
    expect(view.commitLabel).toContain("not recorded");
    expect(view.codeReviewLabel).toContain("not recorded");
    expect(view.cleanCodeReviewLabel).toContain("not recorded");
    expect(view.testEvidenceLabel).toContain("not recorded");
    expect(view.missingEvidenceItems).toContain("StepCommitRecord");
    expect(view.blockerLabel).toContain("Cannot complete");
  });

  it("keeps failed or missing evidence visible when the step is blocked", () => {
    const step = IMPLEMENTATION_STEP_LEDGER_READY_FIXTURE.steps[0]!;
    const blockedProjection = {
      ...IMPLEMENTATION_STEP_LEDGER_READY_FIXTURE,
      currentStatus: "blocked",
      summary: "Implementation step ledger is blocked by missing or failed evidence.",
      progressReport: "Tracker: Demo implementation tracker\n1. Create deterministic ledger — blocked. Missing: passing TestEvidenceRecord without failed tests or Not-tested gaps. Tests: failed (pnpm test).",
      steps: [
        {
          ...step,
          status: "blocked",
          missingEvidence: ["passing TestEvidenceRecord without failed tests or Not-tested gaps"],
          blocker: {
            stepId: step.stepDoc.stepId,
            reason: "Tests failed.",
            missingEvidence: ["passing TestEvidenceRecord without failed tests or Not-tested gaps"],
            nextRequiredAction: "Fix tests and record passing evidence.",
            evidenceRefs: ["test:failed"]
          },
          testEvidenceRecord: {
            ...step.testEvidenceRecord!,
            outcome: "failed",
            verifiedCommitSha: "abcdef1",
            failedTestCount: 1,
            notTestedGaps: ["pnpm verify not re-run"],
            evidenceRefs: ["test:failed"]
          }
        }
      ],
      blockedSteps: [
        {
          stepId: step.stepDoc.stepId,
          reason: "Tests failed.",
          missingEvidence: ["passing TestEvidenceRecord without failed tests or Not-tested gaps"],
          nextRequiredAction: "Fix tests and record passing evidence.",
          evidenceRefs: ["test:failed"]
        }
      ]
    } as typeof IMPLEMENTATION_STEP_LEDGER_READY_FIXTURE;
    const view = implementationStepLedgerViewModel(blockedProjection);

    expect(view.status).toBe("blocked");
    expect(view.missingEvidenceItems).toContain("passing TestEvidenceRecord without failed tests or Not-tested gaps");
    expect(view.blockerLabel).toContain("Fix tests");
    expect(view.testEvidenceLabel).toContain("failed");
    expect(view.testEvidenceLabel).toContain("Not-tested: pnpm verify not re-run");
  });

  it("surfaces no-code verification evidence instead of pretending a commit exists", () => {
    const step = IMPLEMENTATION_STEP_LEDGER_READY_FIXTURE.steps[0]!;
    const noCodeProjection = {
      ...IMPLEMENTATION_STEP_LEDGER_READY_FIXTURE,
      steps: [
        {
          ...step,
          stepDoc: {
            ...step.stepDoc,
            expectedChangeScope: "verification_only"
          },
          stepCommitRecord: null,
          noCodeStepEvidence: {
            stepId: step.stepDoc.stepId,
            baselineCommitSha: "1234567",
            cleanTrackedState: true,
            intendedTrackedDiff: "none",
            noCodeReason: "Verification-only step confirmed no tracked diff was intended.",
            commandEvidenceRefs: ["git:status", "test:verify"],
            notTestedGaps: []
          },
          codeReviewRecord: {
            ...step.codeReviewRecord!,
            comparedFromCommitSha: "1234567",
            comparedToCommitSha: "1234567"
          },
          cleanCodeReviewRecord: {
            ...step.cleanCodeReviewRecord!,
            comparedFromCommitSha: "1234567",
            comparedToCommitSha: "1234567"
          },
          testEvidenceRecord: {
            ...step.testEvidenceRecord!,
            verifiedCommitSha: "1234567"
          }
        }
      ],
      stepCommitRecords: [],
      noCodeStepEvidenceRecords: [
        {
          stepId: step.stepDoc.stepId,
          baselineCommitSha: "1234567",
          cleanTrackedState: true,
          intendedTrackedDiff: "none",
          noCodeReason: "Verification-only step confirmed no tracked diff was intended.",
          commandEvidenceRefs: ["git:status", "test:verify"],
          notTestedGaps: []
        }
      ],
      codeReviewRecords: [
        {
          ...IMPLEMENTATION_STEP_LEDGER_READY_FIXTURE.codeReviewRecords[0]!,
          comparedFromCommitSha: "1234567",
          comparedToCommitSha: "1234567"
        }
      ],
      cleanCodeReviewRecords: [
        {
          ...IMPLEMENTATION_STEP_LEDGER_READY_FIXTURE.cleanCodeReviewRecords[0]!,
          comparedFromCommitSha: "1234567",
          comparedToCommitSha: "1234567"
        }
      ],
      testEvidenceRecords: [
        {
          ...IMPLEMENTATION_STEP_LEDGER_READY_FIXTURE.testEvidenceRecords[0]!,
          verifiedCommitSha: "1234567"
        }
      ]
    } as typeof IMPLEMENTATION_STEP_LEDGER_READY_FIXTURE;
    const view = implementationStepLedgerViewModel(noCodeProjection);

    expect(view.latestStepScope).toBe("verification_only");
    expect(view.commitLabel).toContain("not recorded");
    expect(view.noCodeEvidenceLabel).toContain("Verification-only step confirmed no tracked diff was intended.");
    expect(view.noCodeEvidenceLabel).toContain("baseline=1234567");
    expect(view.noCodeEvidenceLabel).toContain("Not-tested gaps=0");
  });

  it("renders the progress report and separate review labels", () => {
    const view = implementationStepLedgerViewModel(IMPLEMENTATION_STEP_LEDGER_READY_FIXTURE);
    const markup = renderEnglishMarkup(
      createElement(ImplementationStepLedgerPanel, {
        ledger: view,
        isBusy: false,
        onRefreshLedger: () => undefined
      })
    );

    expect(markup).toContain("Implementation log");
    expect(markup).toContain("Code review: repository passed");
    expect(markup).toContain("Clean-code review: repository passed");
    expect(markup).toContain("feature code review 2/2 satisfied");
    expect(markup).toContain("changed_code clean-code review 2/2 satisfied");
    expect(markup).toContain("Rollback/reference: rollback:git-revert:abcdef1");
    expect(markup).toContain("Tracker: Demo implementation tracker");
  });
});
