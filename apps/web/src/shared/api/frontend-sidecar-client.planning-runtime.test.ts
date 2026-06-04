import { describe, expect, it } from "vitest";
import {
  AUTO_IMPLEMENTATION_RUN_READY_FIXTURE,
  IMPLEMENTATION_STEP_LEDGER_READY_FIXTURE,
  PHASE3_EXECUTION_AUTHORITY_READY_PROJECTION_FIXTURE,
  type ProjectId,
  type RuntimeArtifactId,
  type SessionId,
  type StateVersion
} from "@solo-superman/contracts";
import {
  createSidecarClient,
} from "./sidecar-client";
import { connection, jsonResponse } from "./sidecar-client.test-helpers";

describe("sidecar client planning-runtime", () => {
  it("calls Phase 1.5B hint query/export routes as authenticated metadata reads", async () => {
    const seenRequests: [string, RequestInit | undefined][] = [];
    const client = createSidecarClient({
      connection,
      fetchImpl: async (input, init) => {
        seenRequests.push([input, init]);

        return jsonResponse({
          ok: true,
          data: {
            kind: String(input).endsWith("/export")
              ? "Phase15bUpgradeHintExport"
              : "Phase15bUpgradeHintProjection",
            projectionKind: "Phase15bUpgradeHintProjection",
            projectId: "proj_hint",
            version: 0,
            generatedAt: "2026-05-06T00:00:00.000Z",
            stale: false,
            refetchUrl: "/api/v1/projects/proj_hint/phase15b-upgrade-hints",
            exportUrl: "/api/v1/projects/proj_hint/phase15b-upgrade-hints/export",
            pendingEffectSummary: {
              totalPending: 0,
              byType: {},
              visibleLabel: "No execution effects are pending."
            },
            metadataLabel: "readiness_preview_handoff_metadata",
            privatePayloadPolicy: "public_safe_metadata_only",
            noExecution: {
              semantic: "metadata_only_no_execution",
              productActionPerformed: false,
              delegationState: "not_active",
              credentialValueState: "omitted"
            },
            records: [],
            ...(String(input).endsWith("/export")
              ? {
                  exportedAt: "2026-05-06T00:00:00.000Z",
                  format: "json",
                  exportPolicy: {
                    privatePayloadsIncluded: false,
                    credentialValuesIncluded: false,
                    sourceRefLabelsIncluded: false,
                    reason: "phase15b_exports_are_public_safe_readiness_metadata_only"
                  }
                }
              : {})
          },
          meta: {
            requestId: "req_phase15b_hints",
            schemaVersion: "solo-superman.contracts.v1"
          }
        });
      }
    });

    await client.listPhase15bUpgradeHints("proj_hint" as ProjectId);
    await client.exportPhase15bUpgradeHints("proj_hint" as ProjectId);

    expect(seenRequests[0]).toMatchObject([
      "http://127.0.0.1:43110/api/v1/projects/proj_hint/phase15b-upgrade-hints",
      expect.objectContaining({
        method: "GET",
        headers: expect.objectContaining({
          Authorization: "Bearer test-token"
        })
      })
    ]);
    expect(seenRequests[1]).toMatchObject([
      "http://127.0.0.1:43110/api/v1/projects/proj_hint/phase15b-upgrade-hints/export",
      expect.objectContaining({ method: "GET" })
    ]);
  });

  it("calls Phase 2 Planning Handoff POST and GET routes with the session path contract", async () => {
    const seenRequests: [string, RequestInit | undefined][] = [];
    const client = createSidecarClient({
      connection,
      fetchImpl: async (input, init) => {
        seenRequests.push([input, init]);

        return jsonResponse({
          ok: true,
          data: String(init?.method ?? "GET") === "POST"
            ? {
                category: "accepted_with_projection",
                commandId: "cmd_handoff",
                correlationId: "corr_handoff",
                stateVersionBefore: 3,
                stateVersionAfter: 4,
                eventIds: ["evt_handoff"],
                effectTaskIds: [],
                immediateProjection: {
                  kind: "PlanningHandoffProjection",
                  sessionId: "sess_handoff",
                  version: 4,
                  currentStatus: "source_trace_incomplete",
                  blockerArtifact: {
                    kind: "PlanningHandoffBlockerArtifact",
                    status: "source_trace_incomplete",
                    noFinalLabelRule: "must_not_use_planning_ready_label"
                  },
                  sourceRefs: [],
                  summary: "Planning Handoff blocker artifact",
                  refetchUrl: "/api/v1/sessions/sess_handoff/planning-handoff"
                }
              }
            : null,
          meta: {
            requestId: "req_handoff",
            schemaVersion: "solo-superman.contracts.v1"
          }
        });
      }
    });

    await client.createPlanningHandoff({
      sessionId: "sess_handoff" as SessionId,
      expectedStateVersion: 3 as StateVersion,
      sourceRefs: [
        {
          sourceType: "spec_version",
          sourceId: "spec_version_handoff",
          required: true,
          stale: false
        }
      ]
    });
    await client.getPlanningHandoff("sess_handoff" as SessionId);

    expect(seenRequests[0]).toMatchObject([
      "http://127.0.0.1:43110/api/v1/sessions/sess_handoff/planning-handoff",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          Authorization: "Bearer test-token",
          "Content-Type": "application/json"
        })
      })
    ]);
    expect(JSON.parse(String(seenRequests[0]?.[1]?.body))).toMatchObject({
      sessionId: "sess_handoff",
      expectedStateVersion: 3,
      sourceRefs: [
        expect.objectContaining({
          sourceType: "spec_version",
          sourceId: "spec_version_handoff"
        })
      ]
    });
    expect(seenRequests[1]).toMatchObject([
      "http://127.0.0.1:43110/api/v1/sessions/sess_handoff/planning-handoff",
      expect.objectContaining({ method: "GET" })
    ]);
  });

  it("posts and reads execution authority records for generated workspace workers", async () => {
    const seenRequests: [string, RequestInit | undefined][] = [];
    const client = createSidecarClient({
      connection,
      fetchImpl: async (input, init) => {
        seenRequests.push([input, init]);

        const projection = {
          ...PHASE3_EXECUTION_AUTHORITY_READY_PROJECTION_FIXTURE,
          sessionId: "sess_authority",
          version: 8,
          refetchUrl: "/api/v1/sessions/sess_authority/execution-authority"
        };

        return jsonResponse({
          ok: true,
          data: String(init?.method ?? "GET") === "POST"
            ? {
                category: "accepted_with_projection",
                commandId: "cmd_authority",
                correlationId: "corr_authority",
                stateVersionBefore: 7,
                stateVersionAfter: 8,
                eventIds: ["evt_authority"],
                effectTaskIds: [],
                immediateProjection: projection
              }
            : projection,
          meta: {
            requestId: "req_authority",
            schemaVersion: "solo-superman.contracts.v1"
          }
        });
      }
    });

    const commandResponse = await client.createExecutionAuthority({
      sessionId: "sess_authority" as SessionId,
      expectedStateVersion: 7 as StateVersion,
      idempotencyKey: "auto-worker-authority:sess_authority:auto_run_demo:initial_pr:local-001",
      sourcePlanningHandoffRef: "planning_handoff_ready_demo",
      boundedAgentOutput: {
        outputId: "bounded_output_auto_worker_initial_pr",
        sourceRefs: ["auto-implementation-run:auto_run_demo"],
        intendedDecisionImpact: "Approve a bounded local worker file-diff action.",
        proposedActionPreviewRefs: ["auto-worker-authority-preview:auto_run_demo:initial_pr:local-001"],
        requiredApprovals: ["local-operator-click:auto-worker-authority"],
        evidenceRefs: ["auto-worker-authority:auto_run_demo:initial_pr"],
        failureMode: "ready_for_preview",
        noExecutionPolicy: "controlled_execution_required"
      },
      actionClass: "file_diff",
      previewArtifactRef: "auto-worker-authority-preview:auto_run_demo:initial_pr:local-001",
      previewArtifactHash: "auto_worker_authority_preview_auto_run_demo_initial_pr_local_001",
      reviewedPreviewArtifactHash: "auto_worker_authority_preview_auto_run_demo_initial_pr_local_001",
      requestedScope: {
        workspaceRef: "/repo/workspace/demo-project",
        filePathGlobs: ["**/*"]
      },
      approvalDecision: "approved",
      approver: {
        actorId: "local_operator",
        actorType: "local_operator",
        approvedAt: "2026-05-23T00:00:00.000Z",
        decidedAt: "2026-05-23T00:00:00.000Z"
      },
      sandboxBoundary: {
        mode: "workspace_patch",
        networkPolicy: "blocked",
        secretPolicy: "no_secret_values"
      },
      rollbackReference: {
        kind: "git_diff_reverse",
        ref: "rollback:auto-worker-authority:auto_run_demo:initial_pr"
      },
      evidenceRefs: ["auto-worker-authority:auto_run_demo:initial_pr"],
      auditRefs: ["audit:auto-worker-authority:auto_run_demo:initial_pr"],
      preconditionChecks: {
        planningSourceExists: true,
        previewArtifactExists: true,
        previewHashMatches: true,
        rollbackAvailable: true,
        credentialValueRequired: false,
        sandboxEnforced: true
      }
    });
    const projection = await client.getExecutionAuthority("sess_authority" as SessionId);

    expect(commandResponse.immediateProjection?.kind).toBe("ExecutionAuthorityLedgerProjection");
    expect(projection?.kind).toBe("ExecutionAuthorityLedgerProjection");
    expect(seenRequests[0]).toMatchObject([
      "http://127.0.0.1:43110/api/v1/sessions/sess_authority/execution-authority",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          Authorization: "Bearer test-token",
          "Content-Type": "application/json"
        })
      })
    ]);
    expect(JSON.parse(String(seenRequests[0]?.[1]?.body))).toMatchObject({
      sessionId: "sess_authority",
      expectedStateVersion: 7,
      actionClass: "file_diff",
      approvalDecision: "approved",
      requestedScope: {
        workspaceRef: "/repo/workspace/demo-project",
        filePathGlobs: ["**/*"]
      },
      sandboxBoundary: {
        mode: "workspace_patch",
        networkPolicy: "blocked",
        secretPolicy: "no_secret_values"
      }
    });
    expect(seenRequests[1]).toMatchObject([
      "http://127.0.0.1:43110/api/v1/sessions/sess_authority/execution-authority",
      expect.objectContaining({ method: "GET" })
    ]);
  });

  it("records and reads implementation step ledger routes with commit/review/test evidence in the JSON body", async () => {
    const seenRequests: [string, RequestInit | undefined][] = [];
    const client = createSidecarClient({
      connection,
      fetchImpl: async (input, init) => {
        seenRequests.push([input, init]);

        return jsonResponse({
          ok: true,
          data: String(init?.method ?? "GET") === "POST"
            ? {
                category: "accepted_with_projection",
                commandId: "cmd_step_ledger",
                correlationId: "corr_step_ledger",
                stateVersionBefore: 9,
                stateVersionAfter: 10,
                eventIds: ["evt_step_ledger"],
                effectTaskIds: [],
                immediateProjection: {
                  ...IMPLEMENTATION_STEP_LEDGER_READY_FIXTURE,
                  sessionId: "sess_ledger",
                  version: 10,
                  refetchUrl: "/api/v1/sessions/sess_ledger/implementation-step-ledger"
                }
              }
            : {
                ...IMPLEMENTATION_STEP_LEDGER_READY_FIXTURE,
                sessionId: "sess_ledger",
                version: 10,
                refetchUrl: "/api/v1/sessions/sess_ledger/implementation-step-ledger"
              },
          meta: {
            requestId: "req_step_ledger",
            schemaVersion: "solo-superman.contracts.v1"
          }
        });
      }
    });
    const step = IMPLEMENTATION_STEP_LEDGER_READY_FIXTURE.steps[0]!;

    const commandResponse = await client.recordImplementationStepLedger({
      sessionId: "sess_ledger" as SessionId,
      expectedStateVersion: 9 as StateVersion,
      idempotencyKey: "step-ledger-client-test",
      trackerDoc: IMPLEMENTATION_STEP_LEDGER_READY_FIXTURE.trackerDoc,
      stepDoc: step.stepDoc,
      targetStatus: "completed",
      startedEvidenceRefs: ["plan:step-demo"],
      stepCommitRecord: step.stepCommitRecord!,
      codeReviewRecord: step.codeReviewRecord!,
      cleanCodeReviewRecord: step.cleanCodeReviewRecord!,
      testEvidenceRecord: step.testEvidenceRecord!,
      evidenceRefs: ["commit:abcdef1", "review:code", "review:clean", "test:verify"]
    });
    const projection = await client.getImplementationStepLedger("sess_ledger" as SessionId);

    expect(commandResponse.category).toBe("accepted_with_projection");
    expect(projection?.kind).toBe("ImplementationStepLedgerProjection");
    expect(seenRequests[0]).toMatchObject([
      "http://127.0.0.1:43110/api/v1/sessions/sess_ledger/implementation-step-ledger",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          Authorization: "Bearer test-token",
          "Content-Type": "application/json"
        })
      })
    ]);
    expect(JSON.parse(String(seenRequests[0]?.[1]?.body))).toMatchObject({
      sessionId: "sess_ledger",
      expectedStateVersion: 9,
      idempotencyKey: "step-ledger-client-test",
      targetStatus: "completed",
      stepCommitRecord: {
        commitSha: "abcdef1",
        previousCommitSha: "1234567",
        diffRange: "1234567..abcdef1"
      },
      codeReviewRecord: {
        reviewId: step.codeReviewRecord!.reviewId,
        reviewScope: step.codeReviewRecord!.reviewScope,
        comparedFromCommitSha: "1234567",
        comparedToCommitSha: "abcdef1"
      },
      cleanCodeReviewRecord: {
        reviewId: step.cleanCodeReviewRecord!.reviewId,
        reviewScope: step.cleanCodeReviewRecord!.reviewScope,
        comparedFromCommitSha: "1234567",
        comparedToCommitSha: "abcdef1"
      },
      testEvidenceRecord: {
        verifiedCommitSha: "abcdef1",
        outcome: "passed"
      }
    });
    expect(seenRequests[1]).toMatchObject([
      "http://127.0.0.1:43110/api/v1/sessions/sess_ledger/implementation-step-ledger",
      expect.objectContaining({ method: "GET" })
    ]);
  });

  it("creates and reads auto implementation workspace runs with JSON request bodies", async () => {
    const seenRequests: [string, RequestInit | undefined][] = [];
    const client = createSidecarClient({
      connection,
      fetchImpl: async (input, init) => {
        seenRequests.push([input, init]);

        return jsonResponse({
          ok: true,
          data: {
            ...AUTO_IMPLEMENTATION_RUN_READY_FIXTURE,
            sessionId: "sess_auto_impl",
            refetchUrl: "/api/v1/sessions/sess_auto_impl/auto-implementation-runs"
          },
          meta: {
            requestId: "req_auto_impl",
            schemaVersion: "solo-superman.contracts.v1"
          }
        });
      }
    });

    const created = await client.createAutoImplementationRun({
      sessionId: "sess_auto_impl" as SessionId,
      idempotencyKey: "auto-impl-client-test",
      projectName: "Demo Workspace App",
      sourcePlanningRef: "planning_handoff_ready_demo"
    });
    const workerJob = await client.createAutoImplementationWorkerJob({
      sessionId: "sess_auto_impl" as SessionId,
      runId: "auto_run_demo",
      idempotencyKey: "auto-impl-worker-client-test",
      executionAuthorityRef: "exec_auth_auto_worker_initial_pr"
    });
    const completedWorkerJob = await client.completeAutoImplementationWorkerJob({
      sessionId: "sess_auto_impl" as SessionId,
      runId: "auto_run_demo",
      jobId: "auto-worker-job:auto_run_demo:initial_pr:auto-impl-worker-client-test",
      idempotencyKey: "auto-impl-worker-complete-client-test",
      implementationStepId: "step_demo",
      evidenceRefs: ["worker-job:complete"]
    });
    const importedWorkerLedger = await client.importAutoImplementationWorkerLedger({
      sessionId: "sess_auto_impl" as SessionId,
      runId: "auto_run_demo",
      jobId: "auto-worker-job:auto_run_demo:initial_pr:auto-impl-worker-client-test",
      idempotencyKey: "auto-impl-worker-ledger-import-client-test",
      ledgerTransitions: [
        {
          trackerDoc: IMPLEMENTATION_STEP_LEDGER_READY_FIXTURE.trackerDoc,
          stepDoc: IMPLEMENTATION_STEP_LEDGER_READY_FIXTURE.steps[0]!.stepDoc,
          targetStatus: "completed",
          stepCommitRecord: IMPLEMENTATION_STEP_LEDGER_READY_FIXTURE.stepCommitRecords[0]!,
          testEvidenceRecord: IMPLEMENTATION_STEP_LEDGER_READY_FIXTURE.testEvidenceRecords[0]!,
          evidenceRefs: ["worker-ledger-import:client"]
        }
      ],
      evidenceRefs: ["worker-ledger-import:client-stdout"]
    });
    const ranWorkerJob = await client.runAutoImplementationWorkerJob({
      sessionId: "sess_auto_impl" as SessionId,
      runId: "auto_run_demo",
      jobId: "auto-worker-job:auto_run_demo:initial_pr:auto-impl-worker-client-test",
      idempotencyKey: "auto-impl-worker-run-client-test",
      evidenceRefs: ["worker-run:client"]
    });
    const advancedFromWorker = await client.advanceAutoImplementationWorkerStage({
      sessionId: "sess_auto_impl" as SessionId,
      runId: "auto_run_demo",
      jobId: "auto-worker-job:auto_run_demo:initial_pr:auto-impl-worker-client-test",
      idempotencyKey: "auto-impl-worker-stage-advance-client-test",
      tickedAt: "2026-05-20T00:01:00.000Z",
      evidenceRefs: ["worker-stage-advance:client"]
    });
    const advanced = await client.recordAutoImplementationStage({
      sessionId: "sess_auto_impl" as SessionId,
      runId: "auto_run_demo",
      stage: "initial_pr",
      action: "start",
      idempotencyKey: "auto-impl-stage-client-test",
      tickedAt: "2026-05-20T00:00:00.000Z",
      evidenceRefs: ["stage:start"]
    });
    const pullRequestMutation = await client.recordAutoImplementationPullRequestMutation({
      sessionId: "sess_auto_impl" as SessionId,
      runId: "auto_run_demo",
      action: "update_pr_body",
      requestMode: "dry_run",
      idempotencyKey: "auto-impl-pr-mutation-client-test",
      pullRequestUrl: "https://github.com/bee-community-master/generated-demo/pull/123",
      issueLinks: ["https://github.com/bee-community-master/generated-demo/issues/101"],
      implementationScope: "Update the generated PR body with current review and verification evidence.",
      reviewStreakRefs: ["code-review:changed:clean-1", "code-review:changed:clean-2"],
      verificationCommands: ["pnpm verify"],
      knownGaps: ["Live gh mutation remains dry-run in this client fixture."],
      rollbackNotes: "Restore the previous PR body if the mutation is reverted.",
      bodyEvidenceRefs: ["pr-body:current-evidence"]
    });
    const projection = await client.getAutoImplementationRuns("sess_auto_impl" as SessionId);

    expect(created.kind).toBe("AutoImplementationRunProjection");
    expect(workerJob.kind).toBe("AutoImplementationRunProjection");
    expect(completedWorkerJob.kind).toBe("AutoImplementationRunProjection");
    expect(importedWorkerLedger.kind).toBe("AutoImplementationRunProjection");
    expect(ranWorkerJob.kind).toBe("AutoImplementationRunProjection");
    expect(advancedFromWorker.kind).toBe("AutoImplementationRunProjection");
    expect(advanced.kind).toBe("AutoImplementationRunProjection");
    expect(pullRequestMutation.kind).toBe("AutoImplementationRunProjection");
    expect(projection?.kind).toBe("AutoImplementationRunProjection");
    expect(seenRequests[0]).toMatchObject([
      "http://127.0.0.1:43110/api/v1/sessions/sess_auto_impl/auto-implementation-runs",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          Authorization: "Bearer test-token",
          "Content-Type": "application/json"
        })
      })
    ]);
    expect(JSON.parse(String(seenRequests[0]?.[1]?.body))).toMatchObject({
      sessionId: "sess_auto_impl",
      idempotencyKey: "auto-impl-client-test",
      projectName: "Demo Workspace App",
      sourcePlanningRef: "planning_handoff_ready_demo"
    });
    expect(seenRequests[1]).toMatchObject([
      "http://127.0.0.1:43110/api/v1/sessions/sess_auto_impl/auto-implementation-runs/auto_run_demo/worker-jobs",
      expect.objectContaining({ method: "POST" })
    ]);
    expect(JSON.parse(String(seenRequests[1]?.[1]?.body))).toMatchObject({
      sessionId: "sess_auto_impl",
      runId: "auto_run_demo",
      idempotencyKey: "auto-impl-worker-client-test",
      executionAuthorityRef: "exec_auth_auto_worker_initial_pr"
    });
    expect(seenRequests[2]).toMatchObject([
      "http://127.0.0.1:43110/api/v1/sessions/sess_auto_impl/auto-implementation-runs/auto_run_demo/worker-jobs/auto-worker-job%3Aauto_run_demo%3Ainitial_pr%3Aauto-impl-worker-client-test/complete",
      expect.objectContaining({ method: "POST" })
    ]);
    expect(JSON.parse(String(seenRequests[2]?.[1]?.body))).toMatchObject({
      sessionId: "sess_auto_impl",
      runId: "auto_run_demo",
      jobId: "auto-worker-job:auto_run_demo:initial_pr:auto-impl-worker-client-test",
      idempotencyKey: "auto-impl-worker-complete-client-test",
      implementationStepId: "step_demo",
      evidenceRefs: ["worker-job:complete"]
    });
    expect(seenRequests[3]).toMatchObject([
      "http://127.0.0.1:43110/api/v1/sessions/sess_auto_impl/auto-implementation-runs/auto_run_demo/worker-jobs/auto-worker-job%3Aauto_run_demo%3Ainitial_pr%3Aauto-impl-worker-client-test/ledger-import",
      expect.objectContaining({ method: "POST" })
    ]);
    expect(JSON.parse(String(seenRequests[3]?.[1]?.body))).toMatchObject({
      sessionId: "sess_auto_impl",
      runId: "auto_run_demo",
      jobId: "auto-worker-job:auto_run_demo:initial_pr:auto-impl-worker-client-test",
      idempotencyKey: "auto-impl-worker-ledger-import-client-test",
      ledgerTransitions: expect.arrayContaining([
        expect.objectContaining({
          targetStatus: "completed",
          evidenceRefs: ["worker-ledger-import:client"]
        })
      ]),
      evidenceRefs: ["worker-ledger-import:client-stdout"]
    });
    expect(seenRequests[4]).toMatchObject([
      "http://127.0.0.1:43110/api/v1/sessions/sess_auto_impl/auto-implementation-runs/auto_run_demo/worker-jobs/auto-worker-job%3Aauto_run_demo%3Ainitial_pr%3Aauto-impl-worker-client-test/run",
      expect.objectContaining({ method: "POST" })
    ]);
    expect(JSON.parse(String(seenRequests[4]?.[1]?.body))).toMatchObject({
      sessionId: "sess_auto_impl",
      runId: "auto_run_demo",
      jobId: "auto-worker-job:auto_run_demo:initial_pr:auto-impl-worker-client-test",
      idempotencyKey: "auto-impl-worker-run-client-test",
      evidenceRefs: ["worker-run:client"]
    });
    expect(seenRequests[5]).toMatchObject([
      "http://127.0.0.1:43110/api/v1/sessions/sess_auto_impl/auto-implementation-runs/auto_run_demo/worker-jobs/auto-worker-job%3Aauto_run_demo%3Ainitial_pr%3Aauto-impl-worker-client-test/advance-stage",
      expect.objectContaining({ method: "POST" })
    ]);
    expect(JSON.parse(String(seenRequests[5]?.[1]?.body))).toMatchObject({
      sessionId: "sess_auto_impl",
      runId: "auto_run_demo",
      jobId: "auto-worker-job:auto_run_demo:initial_pr:auto-impl-worker-client-test",
      idempotencyKey: "auto-impl-worker-stage-advance-client-test",
      tickedAt: "2026-05-20T00:01:00.000Z",
      evidenceRefs: ["worker-stage-advance:client"]
    });
    expect(seenRequests[6]).toMatchObject([
      "http://127.0.0.1:43110/api/v1/sessions/sess_auto_impl/auto-implementation-runs/auto_run_demo/stages/initial_pr",
      expect.objectContaining({ method: "POST" })
    ]);
    expect(JSON.parse(String(seenRequests[6]?.[1]?.body))).toMatchObject({
      sessionId: "sess_auto_impl",
      runId: "auto_run_demo",
      stage: "initial_pr",
      action: "start",
      idempotencyKey: "auto-impl-stage-client-test"
    });
    expect(seenRequests[7]).toMatchObject([
      "http://127.0.0.1:43110/api/v1/sessions/sess_auto_impl/auto-implementation-runs/auto_run_demo/pr-mutations",
      expect.objectContaining({ method: "POST" })
    ]);
    expect(JSON.parse(String(seenRequests[7]?.[1]?.body))).toMatchObject({
      sessionId: "sess_auto_impl",
      runId: "auto_run_demo",
      action: "update_pr_body",
      requestMode: "dry_run",
      idempotencyKey: "auto-impl-pr-mutation-client-test",
      pullRequestUrl: "https://github.com/bee-community-master/generated-demo/pull/123",
      issueLinks: ["https://github.com/bee-community-master/generated-demo/issues/101"],
      verificationCommands: ["pnpm verify"],
      bodyEvidenceRefs: ["pr-body:current-evidence"]
    });
    expect(seenRequests[8]).toMatchObject([
      "http://127.0.0.1:43110/api/v1/sessions/sess_auto_impl/auto-implementation-runs",
      expect.objectContaining({ method: "GET" })
    ]);
  });

  it("posts runtime artifact convert and block commands with session version context", async () => {
    const seenRequests: [string, RequestInit | undefined][] = [];
    const client = createSidecarClient({
      connection,
      fetchImpl: async (input, init) => {
        seenRequests.push([input, init]);

        return jsonResponse({
          ok: true,
          data: {
            category: "blocked",
            commandId: "cmd_runtime_block",
            correlationId: "corr_runtime_block",
            stateVersionBefore: 2,
            stateVersionAfter: 3,
            immediateProjection: {
              kind: "RuntimeActivityProjection",
              version: 3,
              effects: [],
              runtimeArtifacts: [],
              runtimeStatus: "blocked"
            }
          },
          meta: {
            requestId: "req_runtime_block",
            schemaVersion: "solo-superman.contracts.v1"
          }
        });
      }
    });
    const artifactId = "runtime_artifact_1" as RuntimeArtifactId;

    await client.convertRuntimeArtifact({
      sessionId: "sess_test" as SessionId,
      artifactId,
      expectedStateVersion: 2 as StateVersion,
      target: "planning_note"
    });
    await client.blockRuntimeArtifact({
      sessionId: "sess_test" as SessionId,
      artifactId,
      expectedStateVersion: 3 as StateVersion,
      blockedActionType: "destructive_operation",
      reason: "Manual safety review blocked this preview."
    });

    expect(seenRequests[0]?.[0]).toBe(
      "http://127.0.0.1:43110/api/v1/runtime/artifacts/runtime_artifact_1/convert"
    );
    expect(JSON.parse(String(seenRequests[0]?.[1]?.body))).toMatchObject({
      sessionId: "sess_test",
      artifactId: "runtime_artifact_1",
      expectedStateVersion: 2,
      target: "planning_note"
    });
    expect(seenRequests[1]?.[0]).toBe(
      "http://127.0.0.1:43110/api/v1/runtime/artifacts/runtime_artifact_1/block"
    );
    expect(JSON.parse(String(seenRequests[1]?.[1]?.body))).toMatchObject({
      sessionId: "sess_test",
      artifactId: "runtime_artifact_1",
      expectedStateVersion: 3,
      blockedActionType: "destructive_operation",
      reason: "Manual safety review blocked this preview."
    });
  });

  it("calls runtime preview, manual handoff, status, and activity routes with the sidecar auth boundary", async () => {
    const seenRequests: [string, RequestInit | undefined][] = [];
    const client = createSidecarClient({
      connection,
      fetchImpl: async (input, init) => {
        seenRequests.push([input, init]);

        if (String(input).endsWith("/api/v1/runtime/status")) {
          return jsonResponse({
            ok: true,
            data: {
              status: "unavailable",
              adapterVersion: "codex-sdk-runtime-v1",
              sdkPackageVersion: "0.137.0",
              codexCliVersion: "0.137.0",
              transport: "codex-sdk-jsonl",
              checkedAt: "2026-05-05T00:00:00.000Z",
              manualHandoffAvailable: true,
              liveTurnExecutionEnabled: false,
              executionMode: "manual_handoff"
            },
            meta: {
              requestId: "req_runtime_status",
              schemaVersion: "solo-superman.contracts.v1"
            }
          });
        }

        if (String(input).endsWith("/api/v1/sessions/sess_test/activity")) {
          return jsonResponse({
            ok: true,
            data: {
              kind: "RuntimeActivityProjection",
              version: 3,
              effects: [],
              runtimeArtifacts: [],
              runtimeStatus: "scaffold_placeholder"
            },
            meta: {
              requestId: "req_runtime_activity",
              schemaVersion: "solo-superman.contracts.v1"
            }
          });
        }

        return jsonResponse({
          ok: true,
          data: {
            category: "accepted",
            commandId: "cmd_runtime_preview",
            correlationId: "corr_runtime_preview",
            stateVersionBefore: 4,
            stateVersionAfter: 5
          },
          meta: {
            requestId: "req_runtime_preview",
            schemaVersion: "solo-superman.contracts.v1"
          }
        });
      }
    });

    await client.createRuntimePreview({
      sessionId: "sess_test" as SessionId,
      expectedStateVersion: 4 as StateVersion,
      turnPurpose: "spec_update_preview",
      contextHash: "ctx_preview",
      prompt: "Preview a spec update.",
      sourceRefs: ["spec_current"],
      targetObject: "SpecUpdate"
    });
    await client.createManualHandoff({
      sessionId: "sess_test" as SessionId,
      expectedStateVersion: 5 as StateVersion,
      turnPurpose: "research_prompt",
      contextHash: "ctx_handoff",
      prompt: "Draft a manual research prompt.",
      sourceRefs: ["research_task_1"],
      targetObject: "ResearchTask"
    });
    await client.getRuntimeStatus();
    await client.getActivity("sess_test" as SessionId);

    expect(seenRequests[0]?.[0]).toBe("http://127.0.0.1:43110/api/v1/runtime/codex/preview");
    expect(seenRequests[0]?.[1]?.method).toBe("POST");
    expect(seenRequests[0]?.[1]?.headers).toMatchObject({
      Authorization: "Bearer test-token",
      "Content-Type": "application/json"
    });
    expect(JSON.parse(String(seenRequests[0]?.[1]?.body))).toMatchObject({
      sessionId: "sess_test",
      expectedStateVersion: 4,
      turnPurpose: "spec_update_preview",
      contextHash: "ctx_preview",
      sourceRefs: ["spec_current"]
    });
    expect(seenRequests[1]?.[0]).toBe("http://127.0.0.1:43110/api/v1/runtime/manual-handoff");
    expect(JSON.parse(String(seenRequests[1]?.[1]?.body))).toMatchObject({
      sessionId: "sess_test",
      expectedStateVersion: 5,
      turnPurpose: "research_prompt",
      sourceRefs: ["research_task_1"]
    });
    expect(seenRequests[2]).toMatchObject([
      "http://127.0.0.1:43110/api/v1/runtime/status",
      expect.objectContaining({
        method: "GET",
        headers: expect.objectContaining({
          Authorization: "Bearer test-token"
        })
      })
    ]);
    expect(seenRequests[3]).toMatchObject([
      "http://127.0.0.1:43110/api/v1/sessions/sess_test/activity",
      expect.objectContaining({
        method: "GET",
        headers: expect.objectContaining({
          Authorization: "Bearer test-token"
        })
      })
    ]);
  });

});
