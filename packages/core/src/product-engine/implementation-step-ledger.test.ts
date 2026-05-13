import { describe, expect, it } from "vitest";
import {
  CONTRACT_SCHEMA_VERSION,
  type CommandId,
  type CorrelationId,
  type ImplementationStepLedgerProjection,
  type ImplementationStepStatus,
  type ProductEngineCommand,
  type ProductEngineStateSnapshot,
  type ProjectId,
  type SessionId,
  type StateVersion
} from "@solo-superman/contracts";
import { createInitialProductEngineState, reduceProductEngineCommand } from "./index";

const projectId = "proj_implementation_step_ledger_core" as ProjectId;
const sessionId = "sess_implementation_step_ledger_core" as SessionId;

function command(
  payload: ProductEngineCommand["payload"],
  expectedStateVersion: StateVersion = 0 as StateVersion
): ProductEngineCommand {
  return {
    commandId: `cmd_implementation_step_ledger_${expectedStateVersion}` as CommandId,
    commandType: "RecordImplementationStepLedger",
    projectId,
    sessionId,
    actor: "product_engine",
    issuedAt: "2026-05-13T00:00:00.000Z",
    idempotencyKey: `RecordImplementationStepLedger:${expectedStateVersion}`,
    expectedStateVersion,
    causationId: null,
    correlationId: "corr_implementation_step_ledger" as CorrelationId,
    schemaVersion: CONTRACT_SCHEMA_VERSION,
    payload
  };
}

function fullPayload(overrides: ProductEngineCommand["payload"] = {}): ProductEngineCommand["payload"] {
  return {
    trackerDoc: {
      trackerId: "tracker_issue_104",
      title: "Issue 104 implementation tracker",
      goal: "Record implementation step commit, review, clean-code review, and tests.",
      sourceRefs: ["issue:104"]
    },
    stepDoc: {
      stepId: "step_contracts",
      title: "Add ledger contracts",
      description: "Add the implementation step ledger projection and reducer command.",
      sourceRefs: ["issue:104", "docs:37"],
      expectedChangeScope: "tracked_code_docs_config"
    },
    targetStatus: "completed",
    startedEvidenceRefs: ["started:step_contracts"],
    stepCommitRecord: {
      stepId: "step_contracts",
      commitSha: "abcdef1",
      previousCommitSha: "1234567",
      diffRange: "1234567..abcdef1",
      changedFiles: ["packages/contracts/src/projections/implementation-step-ledger.ts"],
      rollbackRef: "rollback:git-revert:abcdef1",
      evidenceRefs: ["commit:abcdef1"]
    },
    codeReviewRecord: {
      stepId: "step_contracts",
      reviewId: "review_code_step_contracts",
      reviewer: "codex-code-reviewer",
      verdict: "passed",
      comparedFromCommitSha: "1234567",
      comparedToCommitSha: "abcdef1",
      findings: [],
      evidenceRefs: ["review:code:step_contracts"]
    },
    cleanCodeReviewRecord: {
      stepId: "step_contracts",
      reviewId: "review_clean_step_contracts",
      reviewer: "codex-clean-code-reviewer",
      verdict: "passed",
      comparedFromCommitSha: "1234567",
      comparedToCommitSha: "abcdef1",
      simplifications: ["kept the projection contract flat and explicit"],
      evidenceRefs: ["review:clean:step_contracts"]
    },
    testEvidenceRecord: {
      stepId: "step_contracts",
      testEvidenceId: "test_step_contracts",
      commands: ["pnpm test packages/core/src/product-engine/implementation-step-ledger.test.ts"],
      outcome: "passed",
      verifiedCommitSha: "abcdef1",
      passedTestCount: 5,
      failedTestCount: 0,
      notTestedGaps: [],
      evidenceRefs: ["test:step_contracts"]
    },
    evidenceRefs: ["issue:104", "ledger:step_contracts"],
    ...overrides
  };
}

function projectionFrom(payload: ProductEngineCommand["payload"]) {
  const reduction = reduceProductEngineCommand(
    command(payload),
    createInitialProductEngineState(projectId, sessionId)
  );

  expect(reduction.accepted).toBe(true);
  return reduction.immediateProjection as ImplementationStepLedgerProjection;
}

function projectionFromSequence(
  payload: ProductEngineCommand["payload"],
  statuses: readonly ImplementationStepStatus[] = [
    "ready",
    "implementing",
    "committed",
    "review_required",
    "clean_code_review_required",
    "tests_required",
    "completed"
  ]
) {
  let state: ProductEngineStateSnapshot = createInitialProductEngineState(projectId, sessionId);
  let projection: ImplementationStepLedgerProjection | undefined;

  for (const status of statuses) {
    const reduction = reduceProductEngineCommand(
      command({ ...payload, targetStatus: status }, state.stateVersion),
      state
    );

    expect(reduction.accepted).toBe(true);
    projection = reduction.immediateProjection as ImplementationStepLedgerProjection;
    state = {
      ...state,
      ...reduction.nextState
    } as ProductEngineStateSnapshot;
  }

  return projection!;
}

describe("RecordImplementationStepLedger reducer", () => {
  it("completes a tracked-code step only when commit, reviews, clean-code review, and tests are present", () => {
    const projection = projectionFromSequence(fullPayload());
    const latestStep = projection.steps.at(-1)!;

    expect(projection).toMatchObject({
      kind: "ImplementationStepLedgerProjection",
      currentStatus: "completed",
      summary: "Implementation step is completed with commit/review/test evidence."
    });
    expect(latestStep).toMatchObject({
      status: "completed",
      missingEvidence: [],
      stepCommitRecord: {
        commitSha: "abcdef1",
        previousCommitSha: "1234567",
        diffRange: "1234567..abcdef1",
        rollbackRef: "rollback:git-revert:abcdef1"
      },
      codeReviewRecord: {
        reviewId: "review_code_step_contracts",
        verdict: "passed"
      },
      cleanCodeReviewRecord: {
        reviewId: "review_clean_step_contracts",
        verdict: "passed"
      },
      testEvidenceRecord: {
        outcome: "passed",
        failedTestCount: 0
      }
    });
    expect(projection.progressReport).toContain("Add ledger contracts");
  });

  it("blocks direct completion even when evidence exists until the linear status sequence is recorded", () => {
    const projection = projectionFrom(fullPayload());

    expect(projection.currentStatus).toBe("blocked");
    expect(projection.steps[0]!.missingEvidence).toContain("linear status transition before completed");
  });

  it("keeps target-completed steps blocked when the step-local commit SHA is missing", () => {
    const projection = projectionFrom(fullPayload({
      stepCommitRecord: undefined
    }));

    expect(projection.currentStatus).toBe("blocked");
    expect(projection.steps[0]!.missingEvidence).toEqual(
      expect.arrayContaining(["StepCommitRecord", "tracked step-local commit SHA"])
    );
    expect(projection.blockedSteps[0]!.nextRequiredAction).toContain("Record the missing evidence");
  });

  it("blocks linear status skips before the clean-code review and test gates", () => {
    const projection = projectionFrom(fullPayload({
      targetStatus: "tests_required",
      cleanCodeReviewRecord: undefined,
      testEvidenceRecord: undefined
    }));

    expect(projection.currentStatus).toBe("blocked");
    expect(projection.steps[0]!.missingEvidence).toEqual(
      expect.arrayContaining([
        "passing CleanCodeReviewRecord",
        "passing TestEvidenceRecord without failed tests or Not-tested gaps"
      ])
    );
  });

  it("rejects a completed step when code review and clean-code review are not separate records", () => {
    const payload = fullPayload({
      cleanCodeReviewRecord: {
        stepId: "step_contracts",
        reviewId: "review_code_step_contracts",
        reviewer: "codex-clean-code-reviewer",
        verdict: "passed",
        comparedFromCommitSha: "1234567",
        comparedToCommitSha: "abcdef1",
        simplifications: ["reused the same review id"],
        evidenceRefs: ["review:clean:step_contracts"]
      }
    });
    const reduction = reduceProductEngineCommand(
      command(payload),
      createInitialProductEngineState(projectId, sessionId)
    );

    expect(reduction.accepted).toBe(false);
    expect(reduction.rejectionReason?.message).toContain("CodeReviewRecord and CleanCodeReviewRecord must be separate records");
  });

  it("rejects review or diff ranges that do not match the step commit bounds", () => {
    const mismatchedReview = reduceProductEngineCommand(
      command(fullPayload({
        codeReviewRecord: {
          stepId: "step_contracts",
          reviewId: "review_code_wrong_commit",
          reviewer: "codex-code-reviewer",
          verdict: "passed",
          comparedFromCommitSha: "1234567",
          comparedToCommitSha: "7654321",
          findings: [],
          evidenceRefs: ["review:code:wrong"]
        }
      })),
      createInitialProductEngineState(projectId, sessionId)
    );
    const mismatchedDiff = reduceProductEngineCommand(
      command(fullPayload({
        stepCommitRecord: {
          stepId: "step_contracts",
          commitSha: "abcdef1",
          previousCommitSha: "1234567",
          diffRange: "1234567..7654321",
          changedFiles: ["packages/contracts/src/projections/implementation-step-ledger.ts"],
          rollbackRef: "rollback:git-revert:abcdef1",
          evidenceRefs: ["commit:abcdef1"]
        }
      })),
      createInitialProductEngineState(projectId, sessionId)
    );

    expect(mismatchedReview.accepted).toBe(false);
    expect(mismatchedReview.rejectionReason?.message).toContain("review records must compare");
    expect(mismatchedDiff.accepted).toBe(false);
    expect(mismatchedDiff.rejectionReason?.message).toContain("diffRange must equal");
  });

  it("rejects tracker doc changes after the ledger starts", () => {
    const initialReduction = reduceProductEngineCommand(
      command({ ...fullPayload(), targetStatus: "ready" }),
      createInitialProductEngineState(projectId, sessionId)
    );

    expect(initialReduction.accepted).toBe(true);

    const changedTracker = reduceProductEngineCommand(
      command(
        fullPayload({
          targetStatus: "implementing",
          trackerDoc: {
            trackerId: "tracker_issue_104",
            title: "Mutated implementation tracker",
            goal: "Silently change the tracker after the first record.",
            sourceRefs: ["issue:104"]
          }
        }),
        initialReduction.nextState.stateVersion as StateVersion
      ),
      {
        ...createInitialProductEngineState(projectId, sessionId),
        ...initialReduction.nextState
      } as ProductEngineStateSnapshot
    );

    expect(changedTracker.accepted).toBe(false);
    expect(changedTracker.rejectionReason?.message).toContain("trackerDoc must match");
  });

  it("rejects step doc changes for an existing step id so no-code scope cannot bypass a tracked step", () => {
    const initialReduction = reduceProductEngineCommand(
      command({ ...fullPayload(), targetStatus: "ready" }),
      createInitialProductEngineState(projectId, sessionId)
    );

    expect(initialReduction.accepted).toBe(true);

    const changedStepDoc = reduceProductEngineCommand(
      command(
        fullPayload({
          targetStatus: "implementing",
          stepCommitRecord: undefined,
          stepDoc: {
            stepId: "step_contracts",
            title: "Add ledger contracts",
            description: "Add the implementation step ledger projection and reducer command.",
            sourceRefs: ["issue:104", "docs:37"],
            expectedChangeScope: "verification_only"
          },
          noCodeStepEvidence: {
            stepId: "step_contracts",
            baselineCommitSha: "1234567",
            cleanTrackedState: true,
            intendedTrackedDiff: "none",
            noCodeReason: "Attempt to change a tracked step into a no-code step.",
            commandEvidenceRefs: ["git:status"],
            notTestedGaps: []
          }
        }),
        initialReduction.nextState.stateVersion as StateVersion
      ),
      {
        ...createInitialProductEngineState(projectId, sessionId),
        ...initialReduction.nextState
      } as ProductEngineStateSnapshot
    );

    expect(changedStepDoc.accepted).toBe(false);
    expect(changedStepDoc.rejectionReason?.message).toContain("stepDoc must match");
  });

  it("keeps failed tests and Not-tested gaps visible as blockers", () => {
    const projection = projectionFrom(fullPayload({
      testEvidenceRecord: {
        stepId: "step_contracts",
        testEvidenceId: "test_step_contracts",
        commands: ["pnpm test"],
        outcome: "failed",
        verifiedCommitSha: "abcdef1",
        passedTestCount: 4,
        failedTestCount: 1,
        notTestedGaps: ["pnpm verify not re-run"],
        evidenceRefs: ["test:failed"]
      }
    }));

    expect(projection.currentStatus).toBe("blocked");
    expect(projection.steps[0]!.testEvidenceRecord).toMatchObject({
      outcome: "failed",
      failedTestCount: 1,
      notTestedGaps: ["pnpm verify not re-run"]
    });
    expect(projection.steps[0]!.missingEvidence).toContain("passing TestEvidenceRecord without failed tests or Not-tested gaps");
  });

  it("does not complete when passing test evidence reports zero passing tests", () => {
    const projection = projectionFrom(fullPayload({
      testEvidenceRecord: {
        stepId: "step_contracts",
        testEvidenceId: "test_step_contracts",
        commands: ["pnpm test"],
        outcome: "passed",
        verifiedCommitSha: "abcdef1",
        passedTestCount: 0,
        failedTestCount: 0,
        notTestedGaps: [],
        evidenceRefs: ["test:zero"]
      }
    }));

    expect(projection.currentStatus).toBe("blocked");
    expect(projection.steps[0]!.missingEvidence).toContain("passing TestEvidenceRecord without failed tests or Not-tested gaps");
  });

  it("rejects credential or token shaped ledger payload values without echoing them into a projection", () => {
    const reduction = reduceProductEngineCommand(
      command(fullPayload({
        evidenceRefs: ["test:ghp_123456789012345678901234567890123456"]
      })),
      createInitialProductEngineState(projectId, sessionId)
    );

    expect(reduction.accepted).toBe(false);
    expect(reduction.rejectionReason).toMatchObject({
      code: "VALIDATION_FAILED",
      message: "RecordImplementationStepLedger payload must not contain credential, session, token, or secret values."
    });
    expect(JSON.stringify(reduction)).not.toContain("ghp_123456789012345678901234567890123456");
  });

  it("allows verification-only no-code completion with clean tracked state evidence", () => {
    const payload = fullPayload({
      stepDoc: {
        stepId: "step_no_code",
        title: "Run closeout verification",
        description: "Verify the ledger without an intended tracked diff.",
        sourceRefs: ["issue:104"],
        expectedChangeScope: "verification_only"
      },
      stepCommitRecord: undefined,
      noCodeStepEvidence: {
        stepId: "step_no_code",
        baselineCommitSha: "1234567",
        cleanTrackedState: true,
        intendedTrackedDiff: "none",
        noCodeReason: "Verification-only step; no tracked diff was intended.",
        commandEvidenceRefs: ["test:verify"],
        notTestedGaps: []
      },
      codeReviewRecord: {
        stepId: "step_no_code",
        reviewId: "review_code_step_no_code",
        reviewer: "codex-code-reviewer",
        verdict: "passed",
        comparedFromCommitSha: "1234567",
        comparedToCommitSha: "1234567",
        findings: [],
        evidenceRefs: ["review:code:step_no_code"]
      },
      cleanCodeReviewRecord: {
        stepId: "step_no_code",
        reviewId: "review_clean_step_no_code",
        reviewer: "codex-clean-code-reviewer",
        verdict: "passed",
        comparedFromCommitSha: "1234567",
        comparedToCommitSha: "1234567",
        simplifications: [],
        evidenceRefs: ["review:clean:step_no_code"]
      },
      testEvidenceRecord: {
        stepId: "step_no_code",
        testEvidenceId: "test_step_no_code",
        commands: ["pnpm verify"],
        outcome: "passed",
        verifiedCommitSha: "1234567",
        passedTestCount: 1,
        failedTestCount: 0,
        notTestedGaps: [],
        evidenceRefs: ["test:verify"]
      }
    });
    const projection = projectionFromSequence(payload);

    expect(projection.currentStatus).toBe("completed");
    expect(projection.noCodeStepEvidenceRecords[0]).toMatchObject({
      stepId: "step_no_code",
      cleanTrackedState: true,
      intendedTrackedDiff: "none"
    });
    expect(projection.stepCommitRecords).toEqual([]);
  });

  it("keeps dirty no-code evidence blocked instead of completed", () => {
    const projection = projectionFrom(fullPayload({
      stepDoc: {
        stepId: "step_no_code_dirty",
        title: "Run dirty closeout verification",
        description: "Attempt a no-code step while tracked state is dirty.",
        sourceRefs: ["issue:104"],
        expectedChangeScope: "verification_only"
      },
      stepCommitRecord: undefined,
      noCodeStepEvidence: {
        stepId: "step_no_code_dirty",
        baselineCommitSha: "1234567",
        cleanTrackedState: false,
        intendedTrackedDiff: "none",
        noCodeReason: "Verification-only step found dirty tracked state.",
        commandEvidenceRefs: ["git:status"],
        notTestedGaps: ["dirty tracked state"]
      },
      codeReviewRecord: {
        stepId: "step_no_code_dirty",
        reviewId: "review_code_step_no_code_dirty",
        reviewer: "codex-code-reviewer",
        verdict: "passed",
        comparedFromCommitSha: "1234567",
        comparedToCommitSha: "1234567",
        findings: [],
        evidenceRefs: ["review:code:dirty"]
      },
      cleanCodeReviewRecord: {
        stepId: "step_no_code_dirty",
        reviewId: "review_clean_step_no_code_dirty",
        reviewer: "codex-clean-code-reviewer",
        verdict: "passed",
        comparedFromCommitSha: "1234567",
        comparedToCommitSha: "1234567",
        simplifications: [],
        evidenceRefs: ["review:clean:dirty"]
      },
      testEvidenceRecord: {
        stepId: "step_no_code_dirty",
        testEvidenceId: "test_step_no_code_dirty",
        commands: ["git status --short"],
        outcome: "passed",
        verifiedCommitSha: "1234567",
        passedTestCount: 1,
        failedTestCount: 0,
        notTestedGaps: [],
        evidenceRefs: ["test:dirty"]
      }
    }));

    expect(projection.currentStatus).toBe("blocked");
    expect(projection.steps[0]!.missingEvidence).toContain("clean NoCodeStepEvidence without Not-tested gaps");
  });
});
