import { describe, expect, it } from "vitest";
import {
  BLOCKED_ACTION_TYPES,
  CODEX_APPLY_POLICIES,
  CODEX_ARTIFACT_KINDS,
  CODEX_TURN_PURPOSES,
  CONTRACT_SCHEMA_VERSION,
  PHASE15B_ISO_UTC_TIMESTAMP_PATTERN,
  PHASE15B_UPGRADE_HINTS_SCHEMA_VERSION
} from "@solo-superman/contracts";
import {
  assertCodexPreviewOutputMatchesInput,
  codexAccountStatusFromAccountReadResponse,
  createCodexRuntimeAdapter,
  fixtureCodexPreviewOutput,
  parseCodexPreviewOutput,
  repairCodexJsonOutput,
  validateCodexPreviewOutput,
  windowsCodexLoginShellCommand
} from "./index";

function phase15bHintsFixture() {
  return {
    executionIntent: {
      candidateActionType: "shell_command",
      targetSurface: "local workspace verification",
      nonExecutingSummary: "Readiness metadata only; no command was executed."
    },
    approvalRequirements: [
      {
        approvalType: "task_level_execution",
        reason: "A future phase must ask before running the command.",
        scope: "pnpm verify in an isolated worktree",
        requiredActor: "user",
        reconfirmRule: "Reconfirm if cwd, command, or base ref changes."
      }
    ],
    sandboxRequirements: {
      isolatedWorktreeRequired: true,
      browserSandboxRequired: false,
      networkMode: "offline",
      commandAllowlist: ["pnpm verify"],
      secretGrantBoundary: "No secret values are required.",
      environmentPolicy: "Use the project-local workspace and capture logs.",
      logCaptureRequired: true
    },
    rollbackReference: {
      baseRef: "origin/main",
      rollbackNote: "Discard preview metadata or revert the later implementation commit.",
      reversible: true,
      cleanupExpectation: "Remove temporary logs and worktree after inspection."
    },
    expectedEvidence: {
      tests: ["pnpm verify"],
      smokeChecks: ["pnpm smoke:e2e"],
      artifactPaths: ["apps/sidecar/src/e2e-dry-run.fixture.ts"],
      manualInspection: ["Confirm labels say readiness or preview."],
      expectedLogs: ["phase15b readiness metadata exported"]
    },
    riskNormalization: {
      riskLevel: "medium",
      blockedActionType: "shell_command",
      blockReason: "Phase 1.5B must not execute shell commands.",
      userVisibleAction: "Request explicit task-level execution approval later.",
      escalationTarget: "Phase 3 safe-execution policy"
    },
    sourceRefs: [
      {
        kind: "preview_artifact",
        refId: "runtime_artifact_storage"
      }
    ],
    createdAt: "2026-05-06T00:00:00.000Z",
    schemaVersion: PHASE15B_UPGRADE_HINTS_SCHEMA_VERSION
  };
}

describe("PR-07 Codex runtime adapter contracts", () => {
  it("generates valid fixture output for every canonical turnPurpose", () => {
    for (const turnPurpose of CODEX_TURN_PURPOSES) {
      const output = fixtureCodexPreviewOutput({
        turnPurpose,
        contextHash: `ctx_${turnPurpose}`,
        prompt: `Preview ${turnPurpose}`,
        sourceRefs: ["spec_current"],
        targetObject: turnPurpose
      });

      expect(validateCodexPreviewOutput(output)).toMatchObject({
        schemaVersion: CONTRACT_SCHEMA_VERSION,
        turnPurpose,
        artifactKind: expect.any(String),
        applyPolicy: expect.any(String)
      });
      expect(CODEX_ARTIFACT_KINDS).toContain(output.artifactKind);
      expect(CODEX_APPLY_POLICIES).toContain(output.applyPolicy);
    }
  });

  it("repairs a single fenced JSON object without inventing required fields", () => {
    const raw = `before\n\`\`\`json\n${JSON.stringify({
      schemaVersion: CONTRACT_SCHEMA_VERSION,
      turnPurpose: "research_prompt",
      artifactKind: "ResearchPromptArtifact",
      applyPolicy: "manual_handoff_required",
      summary: "Research prompt ready",
      payload: {
        title: "Research prompt ready",
        body: "Find skeptical sources.",
        targetObject: "ResearchTask",
        sourceRefs: ["research_task_1"]
      }
    })}\n\`\`\``;

    expect(repairCodexJsonOutput(raw)).toContain("\"ResearchPromptArtifact\"");
    expect(parseCodexPreviewOutput(raw)).toMatchObject({
      turnPurpose: "research_prompt",
      artifactKind: "ResearchPromptArtifact"
    });
    expect(() => parseCodexPreviewOutput("{\"schemaVersion\":\"wrong\"}")).toThrow(
      "schemaVersion does not match"
    );
  });

  it("rejects runtime output without at least one source reference", () => {
    expect(() =>
      validateCodexPreviewOutput({
        schemaVersion: CONTRACT_SCHEMA_VERSION,
        turnPurpose: "research_prompt",
        artifactKind: "ResearchPromptArtifact",
        applyPolicy: "manual_handoff_required",
        summary: "Research prompt ready",
        payload: {
          title: "Research prompt ready",
          body: "Find skeptical sources.",
          targetObject: "ResearchTask",
          sourceRefs: []
        }
      })
    ).toThrow("payload.sourceRefs must be an array of non-empty strings");
  });

  it("rejects malformed Phase 1.5B upgrade hints instead of dropping them", () => {
    expect(() =>
      validateCodexPreviewOutput({
        schemaVersion: CONTRACT_SCHEMA_VERSION,
        turnPurpose: "implementation_plan_preview",
        artifactKind: "ImplementationPlanPreviewArtifact",
        applyPolicy: "note_only",
        summary: "Implementation plan preview ready",
        payload: {
          title: "Implementation plan preview ready",
          body: "Preview only.",
          targetObject: "PlanningNote",
          sourceRefs: ["spec_current"],
          phase15bUpgradeHints: null
        }
      })
    ).toThrow("phase15bUpgradeHints must be an object");
  });

  it("rejects Phase 1.5B upgrade hints on unsupported artifact kinds", () => {
    expect(() =>
      validateCodexPreviewOutput({
        schemaVersion: CONTRACT_SCHEMA_VERSION,
        turnPurpose: "question_generation",
        artifactKind: "QuestionBatchArtifact",
        applyPolicy: "conditional_auto_apply",
        summary: "Question batch ready",
        payload: {
          title: "Question batch ready",
          body: "Preview only.",
          targetObject: "QuestionBatch",
          sourceRefs: ["spec_current"],
          phase15bUpgradeHints: phase15bHintsFixture()
        }
      })
    ).toThrow("phase15bUpgradeHints may only be attached");
  });

  it("rejects Phase 1.5B upgrade hints that do not match a blocked artifact action type", () => {
    const browserActionHints = {
      ...phase15bHintsFixture(),
      executionIntent: {
        ...phase15bHintsFixture().executionIntent,
        candidateActionType: "browser_action"
      },
      riskNormalization: {
        ...phase15bHintsFixture().riskNormalization,
        blockedActionType: "browser_action"
      }
    };

    expect(() =>
      validateCodexPreviewOutput({
        schemaVersion: CONTRACT_SCHEMA_VERSION,
        turnPurpose: "implementation_plan_preview",
        artifactKind: "BlockedActionArtifact",
        applyPolicy: "blocked",
        summary: "Shell command blocked",
        payload: {
          title: "Shell command blocked",
          body: "Preview only.",
          targetObject: "blocked_action",
          sourceRefs: ["spec_current"],
          blockedAction: {
            actionType: "shell_command",
            reason: "Phase 1.5B records readiness only."
          },
          phase15bUpgradeHints: browserActionHints
        }
      })
    ).toThrow("phase15bUpgradeHints action type must match");
  });

  it("requires Phase 1.5B upgrade hints on blocked runtime outputs", () => {
    expect(() =>
      validateCodexPreviewOutput({
        schemaVersion: CONTRACT_SCHEMA_VERSION,
        turnPurpose: "implementation_plan_preview",
        artifactKind: "BlockedActionArtifact",
        applyPolicy: "blocked",
        summary: "Shell command blocked",
        payload: {
          title: "Shell command blocked",
          body: "Preview only.",
          targetObject: "blocked_action",
          sourceRefs: ["spec_current"],
          blockedAction: {
            actionType: "shell_command",
            reason: "Phase 1.5B records readiness only."
          }
        }
      })
    ).toThrow("BlockedActionArtifact requires payload.phase15bUpgradeHints readiness metadata");
  });

  it("converts forbidden action fixtures into BlockedActionArtifact taxonomy", () => {
    for (const actionType of BLOCKED_ACTION_TYPES) {
      const output = fixtureCodexPreviewOutput({
        turnPurpose: "implementation_plan_preview",
        contextHash: `ctx_block_${actionType}`,
        prompt: "Preview a forbidden action.",
        sourceRefs: ["research_run_fixture", "evidence_matrix_fixture", "research_allowlist_fixture", "audit_log_fixture"],
        targetObject: "blocked_action",
        requestedActionType: actionType
      });

      expect(output).toMatchObject({
        artifactKind: "BlockedActionArtifact",
        applyPolicy: "blocked",
        payload: {
          blockedAction: {
            actionType,
            reason: expect.stringContaining("Phase 1.5B")
          },
          phase15bUpgradeHints: {
            executionIntent: {
              candidateActionType: actionType
            },
            riskNormalization: {
              blockedActionType: actionType
            },
            sourceRefs: expect.arrayContaining([
              expect.objectContaining({ kind: "blocked_action", refId: expect.stringContaining(actionType) }),
              expect.objectContaining({ kind: "research_run", refId: "research_run_fixture" }),
              expect.objectContaining({ kind: "evidence_matrix", refId: "evidence_matrix_fixture" }),
              expect.objectContaining({ kind: "research_allowlist", refId: "research_allowlist_fixture" }),
              expect.objectContaining({ kind: "audit_log", refId: "audit_log_fixture" })
            ]),
            schemaVersion: PHASE15B_UPGRADE_HINTS_SCHEMA_VERSION
          }
        }
      });
      expect(validateCodexPreviewOutput(output).payload.phase15bUpgradeHints).toMatchObject({
        riskNormalization: {
          blockReason: expect.stringContaining("Phase 1.5B")
        }
      });
    }
  });

  it("requires blocked output action types to match the requested forbidden action", () => {
    const input = {
      turnPurpose: "implementation_plan_preview" as const,
      contextHash: "ctx_block_requested_shell",
      prompt: "Preview a shell command without executing it.",
      sourceRefs: ["research_run_fixture"],
      targetObject: "blocked_action",
      requestedActionType: "shell_command" as const
    };
    const nonBlockedOutput = fixtureCodexPreviewOutput({
      turnPurpose: input.turnPurpose,
      contextHash: input.contextHash,
      prompt: input.prompt,
      sourceRefs: input.sourceRefs,
      targetObject: "PlanningNote"
    });
    const mismatchedBlockedOutput = fixtureCodexPreviewOutput({
      ...input,
      requestedActionType: "browser_action"
    });

    expect(() => assertCodexPreviewOutputMatchesInput(input, nonBlockedOutput)).toThrow(
      "Requested forbidden Codex preview actions must return a blocked output"
    );
    expect(() => assertCodexPreviewOutputMatchesInput(input, mismatchedBlockedOutput)).toThrow(
      "Blocked Codex preview output actionType must match the requested actionType"
    );
  });

  it("stamps blocked fixture readiness hints with the adapter clock", async () => {
    const createdAt = "2026-05-07T12:34:56.000Z";
    const adapter = createCodexRuntimeAdapter({
      fixtureMode: true,
      now: () => createdAt,
      env: {}
    });

    const output = await adapter.createPreview({
      turnPurpose: "implementation_plan_preview",
      contextHash: "ctx_block_clock",
      prompt: "Preview a shell command without executing it.",
      sourceRefs: ["research_run_clock"],
      targetObject: "blocked_action",
      requestedActionType: "shell_command"
    });

    expect(output.payload.phase15bUpgradeHints?.createdAt).toBe(createdAt);
    expect(validateCodexPreviewOutput(output).payload.phase15bUpgradeHints?.createdAt).toBe(createdAt);
  });

  it("reports deterministic fixture status without requiring a live Codex turn", async () => {
    const adapter = createCodexRuntimeAdapter({
      fixtureMode: true,
      now: () => "2026-05-05T00:00:00.000Z",
      env: {}
    });

    await expect(adapter.getStatus()).resolves.toMatchObject({
      status: "available",
      account: {
        status: "authenticated",
        accountType: "chatgpt",
        loginCommand: "codex auth login",
        loginStatusCommand: "codex login status"
      },
      adapterVersion: "codex-app-server-preview-v1",
      generatedSchemaVersion: "codex-cli-0.128.0",
      manualHandoffAvailable: true
    });
    expect(adapter.buildStdioSpawnPlan()).toMatchObject({
      command: "codex",
      args: ["app-server", "--listen", "stdio://"],
      transport: "stdio"
    });
  });

  it("starts Codex auth login through the injected background-terminal launcher", async () => {
    const startedAt = "2026-05-17T00:00:00.000Z";
    const adapter = createCodexRuntimeAdapter({
      now: () => startedAt,
      env: {},
      accountReader: async () => ({
        status: "missing",
        loginCommand: "codex auth login",
        loginStatusCommand: "codex login status",
        requiresOpenaiAuth: true
      }),
      loginLauncher: async () => ({
        status: "started",
        command: "codex auth login",
        statusCommand: "codex login status",
        startedAt,
        terminal: "Terminal.app",
        message: "Opened `codex auth login` in a background Terminal window."
      })
    });

    await expect(adapter.startLogin()).resolves.toMatchObject({
      status: "started",
      command: "codex auth login",
      statusCommand: "codex login status",
      terminal: "Terminal.app"
    });
  });

  it("does not open a login terminal when Codex CLI is already authenticated", async () => {
    const adapter = createCodexRuntimeAdapter({
      now: () => "2026-05-17T00:00:00.000Z",
      env: {},
      accountReader: async () => ({
        status: "authenticated",
        loginCommand: "codex auth login",
        loginStatusCommand: "codex login status",
        accountType: "chatgpt"
      }),
      loginLauncher: async () => {
        throw new Error("Login launcher should not run for authenticated accounts.");
      }
    });

    await expect(adapter.startLogin()).resolves.toMatchObject({
      status: "already_authenticated",
      command: "codex auth login",
      terminal: "not_started"
    });
  });

  it("quotes Windows Codex auth login working directories with spaces", () => {
    expect(windowsCodexLoginShellCommand("C:\\Users\\Founder Name\\solo_superman")).toBe(
      'cd /d "C:\\Users\\Founder Name\\solo_superman" && codex auth login'
    );
  });

  it("does not report live preview availability when turn execution is disabled", async () => {
    const adapter = createCodexRuntimeAdapter({
      now: () => "2026-05-05T00:00:00.000Z",
      env: {},
      accountReader: async () => ({
        status: "missing",
        loginCommand: "codex auth login",
        loginStatusCommand: "codex login status",
        requiresOpenaiAuth: true
      })
    });

    await expect(adapter.getStatus()).resolves.toMatchObject({
      status: "unavailable",
      account: {
        status: "missing",
        loginCommand: "codex auth login"
      },
      manualHandoffAvailable: true,
      reason: expect.any(String)
    });
    await expect(
      adapter.createPreview({
        turnPurpose: "spec_update_preview",
        contextHash: "ctx_live_disabled",
        prompt: "Preview a spec update.",
        sourceRefs: ["spec_current"],
        targetObject: "SpecVersion"
      })
    ).rejects.toThrow("manual handoff fallback is required");
  });

  it("maps Codex app-server account/read into a credential-free auth status", () => {
    expect(
      codexAccountStatusFromAccountReadResponse({
        account: {
          type: "chatgpt",
          email: "founder@example.com",
          planType: "pro"
        },
        requiresOpenaiAuth: true
      })
    ).toMatchObject({
      status: "authenticated",
      accountType: "chatgpt",
      email: "founder@example.com",
      planType: "pro",
      loginCommand: "codex auth login",
      loginStatusCommand: "codex login status"
    });
    expect(codexAccountStatusFromAccountReadResponse({ account: null, requiresOpenaiAuth: true })).toMatchObject({
      status: "missing",
      requiresOpenaiAuth: true
    });
  });

  it("builds typed stdio requests for a preview-only Codex turn", () => {
    const adapter = createCodexRuntimeAdapter({
      fixtureMode: true,
      env: {}
    });
    const requests = adapter.buildPreviewTurnRequests(
      {
        turnPurpose: "spec_update_preview",
        contextHash: "ctx_stdio",
        prompt: "Preview a spec update.",
        sourceRefs: ["spec_current"],
        targetObject: "SpecVersion"
      },
      {
        requestIdPrefix: "preview-1",
        cwd: "/tmp/solo-superman"
      }
    );
    const turnStartRequest = requests.buildTurnStartRequest("thread_1");

    expect(requests.initializeRequest).toMatchObject({
      method: "initialize",
      id: "preview-1:initialize",
      params: {
        capabilities: {
          experimentalApi: true
        }
      }
    });
    expect(requests.threadStartRequest).toMatchObject({
      method: "thread/start",
      params: {
        approvalPolicy: "never",
        sandbox: "read-only",
        ephemeral: true
      }
    });
    expect(turnStartRequest).toMatchObject({
      method: "turn/start",
      id: "preview-1:turn-start",
      params: {
        threadId: "thread_1",
        approvalPolicy: "never",
        sandboxPolicy: {
          type: "readOnly",
          networkAccess: false
        }
      }
    });
    expect(turnStartRequest.params.input[0]).toMatchObject({
      type: "text",
      text: expect.stringContaining("turnPurpose: spec_update_preview")
    });
    expect(turnStartRequest.params.outputSchema).toMatchObject({
      type: "object",
      required: expect.arrayContaining(["schemaVersion", "turnPurpose", "artifactKind", "applyPolicy"]),
      properties: {
        payload: {
          properties: {
            phase15bUpgradeHints: {
              properties: {
                createdAt: {
                  pattern: PHASE15B_ISO_UTC_TIMESTAMP_PATTERN
                }
              }
            }
          }
        }
      }
    });
  });
});
