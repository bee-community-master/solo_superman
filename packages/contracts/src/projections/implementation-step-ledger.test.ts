import { describe, expect, it } from "vitest";
import type { ImplementationStepLedgerProjection } from "./implementation-step-ledger";
import {
  IMPLEMENTATION_STEP_LEDGER_READY_FIXTURE,
  ImplementationStepLedgerValidationError,
  validateImplementationStepLedgerProjection
} from "./implementation-step-ledger";

describe("ImplementationStepLedgerProjection contract", () => {
  it("accepts the ready fixture with step-local commit, reviews, rollback ref, and test evidence", () => {
    expect(validateImplementationStepLedgerProjection(IMPLEMENTATION_STEP_LEDGER_READY_FIXTURE)).toBe(
      IMPLEMENTATION_STEP_LEDGER_READY_FIXTURE
    );
    expect(IMPLEMENTATION_STEP_LEDGER_READY_FIXTURE.progressReport).toContain("Create deterministic ledger");
    expect(IMPLEMENTATION_STEP_LEDGER_READY_FIXTURE.stepCommitRecords[0]!.rollbackRef).toContain("git-revert");
  });

  it("rejects completed tracked-code steps without a step-local commit SHA", () => {
    const invalid = {
      ...IMPLEMENTATION_STEP_LEDGER_READY_FIXTURE,
      steps: [
        {
          ...IMPLEMENTATION_STEP_LEDGER_READY_FIXTURE.steps[0]!,
          stepCommitRecord: null
        }
      ],
      stepCommitRecords: []
    } as ImplementationStepLedgerProjection;

    expect(() => validateImplementationStepLedgerProjection(invalid)).toThrow(ImplementationStepLedgerValidationError);
  });

  it("rejects completed steps when code review and clean-code review collapse into one record", () => {
    const step = IMPLEMENTATION_STEP_LEDGER_READY_FIXTURE.steps[0]!;
    const invalid = {
      ...IMPLEMENTATION_STEP_LEDGER_READY_FIXTURE,
      steps: [
        {
          ...step,
          cleanCodeReviewRecord: {
            ...step.cleanCodeReviewRecord!,
            reviewId: step.codeReviewRecord!.reviewId
          }
        }
      ],
      cleanCodeReviewRecords: [
        {
          ...IMPLEMENTATION_STEP_LEDGER_READY_FIXTURE.cleanCodeReviewRecords[0]!,
          reviewId: IMPLEMENTATION_STEP_LEDGER_READY_FIXTURE.codeReviewRecords[0]!.reviewId
        }
      ]
    } as ImplementationStepLedgerProjection;

    expect(() => validateImplementationStepLedgerProjection(invalid)).toThrow(ImplementationStepLedgerValidationError);
  });

  it("rejects review records that compare a different range than the step commit", () => {
    const step = IMPLEMENTATION_STEP_LEDGER_READY_FIXTURE.steps[0]!;
    const invalid = {
      ...IMPLEMENTATION_STEP_LEDGER_READY_FIXTURE,
      steps: [
        {
          ...step,
          codeReviewRecord: {
            ...step.codeReviewRecord!,
            comparedToCommitSha: "7654321"
          }
        }
      ]
    } as ImplementationStepLedgerProjection;

    expect(() => validateImplementationStepLedgerProjection(invalid)).toThrow(ImplementationStepLedgerValidationError);
  });

  it("rejects repeated step ids with mutated step docs", () => {
    const step = IMPLEMENTATION_STEP_LEDGER_READY_FIXTURE.steps[0]!;
    const invalid = {
      ...IMPLEMENTATION_STEP_LEDGER_READY_FIXTURE,
      steps: [
        {
          ...step,
          status: "ready"
        },
        {
          ...step,
          stepDoc: {
            ...step.stepDoc,
            expectedChangeScope: "verification_only"
          }
        }
      ]
    } as ImplementationStepLedgerProjection;

    expect(() => validateImplementationStepLedgerProjection(invalid)).toThrow(ImplementationStepLedgerValidationError);
  });

  it("reports invalid step docs as validation errors without crashing cross-record checks", () => {
    const step = IMPLEMENTATION_STEP_LEDGER_READY_FIXTURE.steps[0]!;
    const invalid = {
      ...IMPLEMENTATION_STEP_LEDGER_READY_FIXTURE,
      steps: [
        {
          ...step,
          stepDoc: {
            stepId: "",
            title: "",
            description: "",
            sourceRefs: [],
            expectedChangeScope: "tracked_code_docs_config"
          }
        }
      ]
    } as unknown as ImplementationStepLedgerProjection;

    expect(() => validateImplementationStepLedgerProjection(invalid)).toThrow(ImplementationStepLedgerValidationError);
  });

  it("rejects step-level evidence records that point to a different step id", () => {
    const step = IMPLEMENTATION_STEP_LEDGER_READY_FIXTURE.steps[0]!;
    const invalid = {
      ...IMPLEMENTATION_STEP_LEDGER_READY_FIXTURE,
      steps: [
        {
          ...step,
          testEvidenceRecord: {
            ...step.testEvidenceRecord!,
            stepId: "step_other"
          }
        },
        {
          ...step,
          stepDoc: {
            ...step.stepDoc,
            stepId: "step_other"
          },
          stepCommitRecord: {
            ...step.stepCommitRecord!,
            stepId: "step_other"
          },
          codeReviewRecord: {
            ...step.codeReviewRecord!,
            stepId: "step_other"
          },
          cleanCodeReviewRecord: {
            ...step.cleanCodeReviewRecord!,
            stepId: "step_other"
          },
          testEvidenceRecord: {
            ...step.testEvidenceRecord!,
            stepId: "step_other"
          }
        }
      ]
    } as ImplementationStepLedgerProjection;

    expect(() => validateImplementationStepLedgerProjection(invalid)).toThrow(ImplementationStepLedgerValidationError);
  });

  it("rejects completed passing test evidence with zero passing tests", () => {
    const step = IMPLEMENTATION_STEP_LEDGER_READY_FIXTURE.steps[0]!;
    const invalid = {
      ...IMPLEMENTATION_STEP_LEDGER_READY_FIXTURE,
      steps: [
        {
          ...step,
          testEvidenceRecord: {
            ...step.testEvidenceRecord!,
            passedTestCount: 0
          }
        }
      ],
      testEvidenceRecords: [
        {
          ...IMPLEMENTATION_STEP_LEDGER_READY_FIXTURE.testEvidenceRecords[0]!,
          passedTestCount: 0
        }
      ]
    } as ImplementationStepLedgerProjection;

    expect(() => validateImplementationStepLedgerProjection(invalid)).toThrow(ImplementationStepLedgerValidationError);
  });

  it("keeps failed tests and Not-tested gaps visible as blocked rather than completed", () => {
    const step = IMPLEMENTATION_STEP_LEDGER_READY_FIXTURE.steps[0]!;
    const blocked = {
      ...IMPLEMENTATION_STEP_LEDGER_READY_FIXTURE,
      currentStatus: "blocked",
      summary: "Implementation step ledger is blocked by missing or failed evidence.",
      progressReport: "Tracker: Demo implementation tracker\n1. Create deterministic ledger — blocked. Missing: passing TestEvidenceRecord without Not-tested gaps.",
      steps: [
        {
          ...step,
          status: "blocked",
          missingEvidence: ["passing TestEvidenceRecord without Not-tested gaps"],
          blocker: {
            stepId: step.stepDoc.stepId,
            reason: "Tests failed.",
            missingEvidence: ["passing TestEvidenceRecord without Not-tested gaps"],
            nextRequiredAction: "Fix tests and record passing test evidence.",
            evidenceRefs: ["test:failed"]
          },
          testEvidenceRecord: {
            ...step.testEvidenceRecord!,
            outcome: "failed",
            failedTestCount: 1,
            notTestedGaps: ["pnpm verify not re-run"],
            evidenceRefs: ["test:failed"]
          }
        }
      ],
      testEvidenceRecords: [
        {
          ...IMPLEMENTATION_STEP_LEDGER_READY_FIXTURE.testEvidenceRecords[0]!,
          outcome: "failed",
          failedTestCount: 1,
          notTestedGaps: ["pnpm verify not re-run"],
          evidenceRefs: ["test:failed"]
        }
      ],
      blockedSteps: [
        {
          stepId: step.stepDoc.stepId,
          reason: "Tests failed.",
          missingEvidence: ["passing TestEvidenceRecord without Not-tested gaps"],
          nextRequiredAction: "Fix tests and record passing test evidence.",
          evidenceRefs: ["test:failed"]
        }
      ]
    } as ImplementationStepLedgerProjection;

    expect(validateImplementationStepLedgerProjection(blocked).blockedSteps[0]!.missingEvidence).toContain(
      "passing TestEvidenceRecord without Not-tested gaps"
    );
  });

  it("rejects top-level blocked steps that do not point to known implementation steps", () => {
    const invalid = {
      ...IMPLEMENTATION_STEP_LEDGER_READY_FIXTURE,
      blockedSteps: [
        {
          stepId: "step_missing",
          reason: "A stale blocker from another ledger leaked into this projection.",
          missingEvidence: ["known step blocker"],
          nextRequiredAction: "Record a blocker for an existing step only.",
          evidenceRefs: ["blocker:stale"]
        }
      ]
    } as ImplementationStepLedgerProjection;

    expect(() => validateImplementationStepLedgerProjection(invalid)).toThrow(ImplementationStepLedgerValidationError);
  });

  it("accepts no-code verification-only completion with baseline commit and clean tracked state", () => {
    const step = IMPLEMENTATION_STEP_LEDGER_READY_FIXTURE.steps[0]!;
    const noCode = {
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
            stepId: "step_demo",
            baselineCommitSha: "1234567",
            cleanTrackedState: true,
            intendedTrackedDiff: "none",
            noCodeReason: "Verification-only step confirmed no tracked diff was intended.",
            commandEvidenceRefs: ["test:verify"],
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
          stepId: "step_demo",
          baselineCommitSha: "1234567",
          cleanTrackedState: true,
          intendedTrackedDiff: "none",
          noCodeReason: "Verification-only step confirmed no tracked diff was intended.",
          commandEvidenceRefs: ["test:verify"],
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
    } as ImplementationStepLedgerProjection;

    expect(validateImplementationStepLedgerProjection(noCode).noCodeStepEvidenceRecords).toHaveLength(1);
  });

  it("rejects dirty no-code completion instead of treating it as completed", () => {
    const step = IMPLEMENTATION_STEP_LEDGER_READY_FIXTURE.steps[0]!;
    const invalid = {
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
            stepId: "step_demo",
            baselineCommitSha: "1234567",
            cleanTrackedState: false,
            intendedTrackedDiff: "none",
            noCodeReason: "Attempted no-code completion while the tree was dirty.",
            commandEvidenceRefs: ["git:status"],
            notTestedGaps: ["dirty tracked state"]
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
          stepId: "step_demo",
          baselineCommitSha: "1234567",
          cleanTrackedState: false,
          intendedTrackedDiff: "none",
          noCodeReason: "Attempted no-code completion while the tree was dirty.",
          commandEvidenceRefs: ["git:status"],
          notTestedGaps: ["dirty tracked state"]
        }
      ]
    } as ImplementationStepLedgerProjection;

    expect(() => validateImplementationStepLedgerProjection(invalid)).toThrow(ImplementationStepLedgerValidationError);
  });
});
