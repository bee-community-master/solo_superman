import { describe, expect, it } from "vitest";
import {
  AUTO_IMPLEMENTATION_RUN_READY_FIXTURE,
  IMPLEMENTATION_STEP_LEDGER_READY_FIXTURE,
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
    const projection = await client.getAutoImplementationRuns("sess_auto_impl" as SessionId);

    expect(created.kind).toBe("AutoImplementationRunProjection");
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
              adapterVersion: "codex-app-server-preview-v1",
              generatedSchemaVersion: "codex-cli-0.128.0",
              transport: "stdio",
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
