import { describe, expect, it } from "vitest";
import {
  BLOCKED_ACTION_TYPES,
  CODEX_APPLY_POLICIES,
  CODEX_ARTIFACT_KINDS,
  CODEX_TURN_PURPOSES,
  CONTRACT_SCHEMA_VERSION,
  PHASE15B_ISO_UTC_TIMESTAMP_PATTERN,
  PHASE15B_UPGRADE_HINTS_SCHEMA_VERSION,
  type CodexRuntimeAccountDto
} from "@solo-superman/contracts";
import {
  assertCodexPreviewOutputMatchesInput,
  assertCodexWorkerExecutionOutputMatchesInput,
  codexAppServerSpawnPlan,
  codexAccountStatusFromAccountReadResponse,
  codexWslShellCommand,
  createCodexRuntimeAdapter,
  codexWorkerProtocolSmokeOutputTemplate,
  fixtureCodexWorkerExecutionOutput,
  fixtureCodexPreviewOutput,
  parseCodexWorkerExecutionOutput,
  parseCodexPreviewOutput,
  repairCodexJsonOutput,
  validateCodexWorkerExecutionOutput,
  validateCodexPreviewOutput,
  windowsCodexLoginShellCommand,
  type CodexWorkerExecutionInput
} from "./index";

function codexRuntimeAccount(
  overrides: Partial<CodexRuntimeAccountDto> = {}
): CodexRuntimeAccountDto {
  return {
    status: "missing",
    loginCommand: "codex auth login",
    loginStatusCommand: "codex login status",
    ...overrides
  };
}

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

function codexWorkerInputFixture(): CodexWorkerExecutionInput {
  return {
    jobId: "auto-worker-job:auto_run_demo:initial_pr:worker-job",
    runId: "auto_run_demo",
    stage: "initial_pr" as const,
    workingDirectory: "/tmp/solo-superman/worker-job-demo",
    issueDocumentPath: "implementation-issues/001-initial_pr.md",
    executionAuthorityRef: "exec_auth_auto_worker_initial_pr",
    allowedWriteScope: [
      ".",
      "implementation-issues/001-initial_pr.md",
      "generated-product/product-slice.json",
      "generated-product/src/product-slice.mjs",
      "generated-product/src/product-slice.test.mjs"
    ],
    requiredEvidence: ["ImplementationStepLedger completed step"],
    forbiddenActions: ["No network writes", "No credential reads"],
    sourceRefs: ["auto-implementation-run:auto_run_demo", "execution-authority:exec_auth_auto_worker_initial_pr"],
    ledgerTrackerDoc: {
      trackerId: "auto-implementation-tracker:auto_run_demo",
      title: "worker-job-demo implementation tracker",
      goal: "Complete the staged auto implementation protocol with review, clean-code, test, PR, and merge evidence.",
      sourceRefs: ["auto-implementation-run:auto_run_demo", "tracker-doc:implementation-tracker.md"]
    },
    ledgerStepDoc: {
      stepId: "auto-implementation-step:auto_run_demo:initial_pr:local-001",
      title: "Workspace repo bootstrap and initial implementation PR",
      description: "Execute Initial implementation and PR creation for implementation-issues/001-initial_pr.md.",
      sourceRefs: [
        "auto-implementation-run:auto_run_demo",
        "auto-implementation-stage:initial_pr",
        "auto-implementation-worker-job:auto-worker-job:auto_run_demo:initial_pr:worker-job",
        "auto-implementation-issue:local-001",
        "issue-doc:implementation-issues/001-initial_pr.md"
      ],
      expectedChangeScope: "tracked_code_docs_config"
    }
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
      env: {
        SOLO_CODEX_WINDOWS_MODE: "native"
      }
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
      manualHandoffAvailable: true,
      liveTurnExecutionEnabled: false,
      executionMode: "fixture"
    });
    expect(adapter.buildStdioSpawnPlan()).toMatchObject({
      command: "codex",
      args: ["app-server", "--listen", "stdio://"],
      transport: "stdio"
    });
  });

  it("builds a WSL-backed Codex app-server plan when Windows mode requests WSL", () => {
    const adapter = createCodexRuntimeAdapter({
      fixtureMode: true,
      env: {
        SOLO_CODEX_WINDOWS_MODE: "wsl"
      }
    });

    expect(adapter.buildStdioSpawnPlan()).toMatchObject({
      command: "wsl.exe",
      args: [
        "-d",
        "Ubuntu",
        "--",
        "bash",
        "-lc",
        expect.stringContaining("'codex' 'app-server' '--listen' 'stdio://'")
      ],
      transport: "stdio"
    });
    const shellCommand = codexAppServerSpawnPlan({ SOLO_CODEX_WINDOWS_MODE: "wsl" }).args[5];
    expect(codexAppServerSpawnPlan({ SOLO_CODEX_WINDOWS_MODE: "wsl" }).args[3]).toContain("bash");
    expect(shellCommand).toContain("nvm use --silent 22");
    expect(shellCommand).toContain("getent passwd \\$(id -u)");
    expect(shellCommand).toContain("then . \"\\$NVM_DIR/nvm.sh\"");
    expect(shellCommand).toContain("/mnt/?/*|/mnt/??/*");
    expect(shellCommand).toContain("could not find the Linux Codex CLI inside WSL");
    expect(shellCommand).not.toContain("then;");
    expect(shellCommand).toContain("\\$HOME");
  });

  it("pins Windows WSL Codex commands to the configured distro and Node major", () => {
    const env = {
      SOLO_CODEX_WINDOWS_MODE: "wsl",
      SOLO_SUPERMAN_CODEX_WSL_DISTRO: "Ubuntu-24.04",
      SOLO_SUPERMAN_CODEX_WSL_NODE_MAJOR: "24"
    };

    expect(codexAppServerSpawnPlan(env).args).toEqual([
      "-d",
      "Ubuntu-24.04",
      "--",
      "bash",
      "-lc",
      expect.stringContaining("nvm use --silent 24")
    ]);
    expect(codexWslShellCommand(["auth", "login"], env)).toContain(
      "if [ -z \"\\$NVM_DIR\" ]; then NVM_DIR=\"\\$HOME/.nvm\"; fi"
    );
    expect(windowsCodexLoginShellCommand("C:\\Users\\Founder Name\\solo_superman", env)).toContain(
      "wsl.exe -d Ubuntu-24.04 -- bash -lc"
    );
  });

  it("starts Codex auth login through the injected background-terminal launcher", async () => {
    const startedAt = "2026-05-17T00:00:00.000Z";
    const adapter = createCodexRuntimeAdapter({
      now: () => startedAt,
      env: {},
      accountReader: async () => codexRuntimeAccount({
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
      accountReader: async () => codexRuntimeAccount({
        status: "authenticated",
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
    expect(
      windowsCodexLoginShellCommand("C:\\Users\\Founder Name\\solo_superman", {
        SOLO_CODEX_WINDOWS_MODE: "native"
      })
    ).toBe(
      'cd /d "C:\\Users\\Founder Name\\solo_superman" && codex auth login'
    );
  });

  it("uses WSL for Windows Codex login by default", () => {
    const command = windowsCodexLoginShellCommand("C:\\Users\\Founder Name\\solo_superman", {});

    expect(command).toContain("wsl.exe -d Ubuntu -- bash -lc");
    expect(command).toContain("'codex' 'auth' 'login'");
    expect(command).toContain("if [ -z \\\"\\$NVM_DIR\\\" ]; then NVM_DIR=\\\"\\$HOME/.nvm\\\"; fi");
    expect(command).toContain("could not find the Linux Codex CLI inside WSL");
    expect(command).toContain("nvm use --silent 22");
    expect(command).not.toContain("cd /d");
    expect(codexWslShellCommand(["auth", "login"])).toContain("'codex' 'auth' 'login'");
  });

  it("does not report live preview availability when turn execution is disabled", async () => {
    const adapter = createCodexRuntimeAdapter({
      now: () => "2026-05-05T00:00:00.000Z",
      env: {},
      accountReader: async () => codexRuntimeAccount({
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
      liveTurnExecutionEnabled: false,
      executionMode: "manual_handoff",
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
    ).rejects.toThrow("Live Codex app-server turn execution is not enabled");
  });

  it("reports and runs preview-only live turns when the env gate and Codex login are available", async () => {
    const previewInput = {
      turnPurpose: "spec_update_preview" as const,
      contextHash: "ctx_live_enabled",
      prompt: "Preview a spec update.",
      sourceRefs: ["spec_current"],
      targetObject: "SpecVersion"
    };
    const liveCalls: unknown[] = [];
    const adapter = createCodexRuntimeAdapter({
      now: () => "2026-05-05T00:00:00.000Z",
      env: {
        SOLO_CODEX_APP_SERVER_LIVE_TURNS: "1"
      },
      accountReader: async () => codexRuntimeAccount({
        status: "authenticated",
        accountType: "chatgpt",
        email: "founder@example.com"
      }),
      livePreviewCreator: async (input) => {
        liveCalls.push(input);

        return fixtureCodexPreviewOutput(input);
      }
    });

    await expect(adapter.getStatus()).resolves.toMatchObject({
      status: "available",
      liveTurnExecutionEnabled: true,
      executionMode: "live",
      account: {
        status: "authenticated",
        email: "founder@example.com"
      },
      reason: expect.stringContaining("preview-only")
    });
    await expect(adapter.createPreview(previewInput)).resolves.toMatchObject({
      turnPurpose: "spec_update_preview",
      artifactKind: "SpecUpdatePreviewArtifact",
      applyPolicy: "approval_required"
    });
    expect(liveCalls).toEqual([previewInput]);
  });

  it("keeps manual handoff when live turns are requested without a Codex login", async () => {
    const adapter = createCodexRuntimeAdapter({
      now: () => "2026-05-05T00:00:00.000Z",
      env: {
        SOLO_CODEX_APP_SERVER_LIVE_TURNS: "1"
      },
      accountReader: async () => codexRuntimeAccount({
        requiresOpenaiAuth: true
      }),
      livePreviewCreator: async () => {
        throw new Error("Live preview must not run without login.");
      }
    });

    await expect(adapter.getStatus()).resolves.toMatchObject({
      status: "unavailable",
      liveTurnExecutionEnabled: true,
      executionMode: "manual_handoff",
      account: {
        status: "missing"
      },
      reason: expect.stringContaining("login is required")
    });
    await expect(
      adapter.createPreview({
        turnPurpose: "spec_update_preview",
        contextHash: "ctx_live_missing_login",
        prompt: "Preview a spec update.",
        sourceRefs: ["spec_current"],
        targetObject: "SpecVersion"
      })
    ).rejects.toThrow("Codex CLI login is required");
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
        },
        effort: "low"
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
          additionalProperties: false,
          required: ["title", "body", "targetObject", "sourceRefs"],
          properties: {
            sourceRefs: {
              items: {
                type: "string"
              }
            }
          }
        }
      }
    });

    const specPreviewTurnStartRequest = requests.buildTurnStartRequest("thread_1");
    const blockedRequests = adapter.buildPreviewTurnRequests(
      {
        turnPurpose: "implementation_plan_preview",
        contextHash: "ctx_blocked_stdio",
        prompt: "Preview a future shell command.",
        sourceRefs: ["runtime_artifact_1"],
        targetObject: "blocked_action",
        requestedActionType: "shell_command"
      },
      {
        requestIdPrefix: "preview-blocked",
        cwd: "/tmp/solo-superman"
      }
    ).buildTurnStartRequest("thread_1");

    expect(specPreviewTurnStartRequest.params.outputSchema).toBeDefined();
    expect(blockedRequests.params.outputSchema).toMatchObject({
      properties: {
        payload: {
          required: expect.arrayContaining(["blockedAction", "phase15bUpgradeHints"]),
          properties: {
            blockedAction: {
              properties: {
                suggestedSafeAlternative: {
                  type: "string"
                }
              }
            },
            phase15bUpgradeHints: {
              properties: {
                rollbackReference: {
                  properties: {
                    diffRef: {
                      type: "string"
                    }
                  }
                },
                sourceRefs: {
                  items: {
                    properties: {
                      label: {
                        type: "string"
                      }
                    }
                  }
                },
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

  it("builds bounded workspace-write stdio requests for local worker execution", () => {
    const adapter = createCodexRuntimeAdapter({
      fixtureMode: true,
      env: {}
    });
    const requests = adapter.buildWorkerTurnRequests(
      codexWorkerInputFixture(),
      {
        requestIdPrefix: "worker-1",
        cwd: "/tmp/solo-superman/worker-job-demo"
      }
    );
    const turnStartRequest = requests.buildTurnStartRequest("thread_worker_1");

    expect(requests.threadStartRequest).toMatchObject({
      method: "thread/start",
      params: {
        approvalPolicy: "never",
        sandbox: "workspace-write",
        serviceName: "solo-superman-auto-worker",
        ephemeral: true
      }
    });
    expect(turnStartRequest).toMatchObject({
      method: "turn/start",
      id: "worker-1:turn-start",
      params: {
        threadId: "thread_worker_1",
        approvalPolicy: "never",
        sandboxPolicy: {
          type: "workspaceWrite",
          writableRoots: ["/tmp/solo-superman/worker-job-demo"],
          networkAccess: false,
          excludeTmpdirEnvVar: true,
          excludeSlashTmp: true
        },
        effort: "medium"
      }
    });
    expect(turnStartRequest.params.input[0]).toMatchObject({
      type: "text",
      text: expect.stringContaining("executionAuthorityRef: exec_auth_auto_worker_initial_pr")
    });
    expect(turnStartRequest.params.input[0]).toMatchObject({
      type: "text",
      text: expect.stringContaining(`ledgerStepDoc: ${JSON.stringify(codexWorkerInputFixture().ledgerStepDoc)}`)
    });
    expect(turnStartRequest.params.input[0]).toMatchObject({
      type: "text",
      text: expect.stringContaining("Every ledgerTransitions item MUST copy ledgerTrackerDoc as trackerDoc")
    });
    expect(turnStartRequest.params.input[0]).toMatchObject({
      type: "text",
      text: expect.stringContaining(
        "Completion requires separate CodeReviewRecord transitions for two consecutive no-finding passes in both feature and repository reviewScope."
      )
    });
    expect(turnStartRequest.params.input[0]).toMatchObject({
      type: "text",
      text: expect.stringContaining(
        "Completion requires separate CleanCodeReviewRecord transitions for two consecutive no-finding passes in both changed_code and repository reviewScope"
      )
    });
    expect(turnStartRequest.params.input[0]).toMatchObject({
      type: "text",
      text: expect.stringContaining("restart that scope's two-pass no-finding streak after the fix")
    });
    expect(turnStartRequest.params.input[0]).toMatchObject({
      type: "text",
      text: expect.stringContaining("Completion requires MissingTestAuditRecord and TestEvidenceRecord evidence")
    });
    expect(turnStartRequest.params.input[0]).toMatchObject({
      type: "text",
      text: expect.stringContaining("passedTestCount of at least 1")
    });
    expect(turnStartRequest.params.input[0]).toMatchObject({
      type: "text",
      text: expect.stringContaining('"passedTestCount": 1')
    });
    expect(turnStartRequest.params.input[0]).toMatchObject({
      type: "text",
      text: expect.stringContaining("ledgerTransitionTemplate:")
    });
    expect(turnStartRequest.params.input[0]).toMatchObject({
      type: "text",
      text: expect.stringContaining("__REPLACE_WITH_COMMIT_SHA__")
    });
    expect(turnStartRequest.params.input[0]).toMatchObject({
      type: "text",
      text: expect.stringContaining("git -c user.name=solo-superman-worker")
    });
    expect(turnStartRequest.params.input[0]).toMatchObject({
      type: "text",
      text: expect.stringContaining("Bounded smoke/bootstrap fast path")
    });
    expect(turnStartRequest.params.input[0]).toMatchObject({
      type: "text",
      text: expect.stringContaining("generated-product/product-slice.json as the authoritative product data model")
    });
    expect(turnStartRequest.params.input[0]).toMatchObject({
      type: "text",
      text: expect.stringContaining("generated-product/src/product-slice.mjs")
    });
    expect(turnStartRequest.params.input[0]).toMatchObject({
      type: "text",
      text: expect.stringContaining("__COPY_LEDGER_TRACKER_DOC_EXACTLY__")
    });
    expect(turnStartRequest.params.outputSchema).toMatchObject({
      type: "object",
      required: expect.arrayContaining([
        "schemaVersion",
        "jobId",
        "status",
        "ledgerTransitions",
        "evidenceRefs",
        "blockedReason",
        "missingEvidence",
        "nextRequiredAction"
      ]),
      properties: {
        status: {
          enum: ["completed", "blocked"]
        },
        blockedReason: {
          anyOf: [{ type: "string", minLength: 1 }, { type: "null" }]
        },
        ledgerTransitions: {
          items: {
            type: "object",
            additionalProperties: false,
            required: expect.arrayContaining([
              "trackerDoc",
              "stepDoc",
              "targetStatus",
              "stepCommitRecord",
              "codeReviewRecord",
              "cleanCodeReviewRecord",
              "missingTestAuditRecord",
              "testEvidenceRecord",
              "blocker",
              "evidenceRefs"
            ])
          }
        }
      }
    });
  });

  it("keeps worker-job smoke prompts bounded to a live protocol ledger envelope", () => {
    const adapter = createCodexRuntimeAdapter({
      fixtureMode: true,
      env: {}
    });
    const smokeInput: CodexWorkerExecutionInput = {
      ...codexWorkerInputFixture(),
      jobId: "auto-worker-job:auto_run_demo:initial_pr:worker-job-smoke:plan-worker",
      workingDirectory: "/tmp/solo-superman/worker-job-smoke-demo",
      sourceRefs: ["worker-job-smoke-planning-handoff"]
    };
    const request = adapter.buildWorkerTurnRequests(smokeInput).buildTurnStartRequest("thread_worker_smoke");
    const inputItem = request.params.input[0];

    if (!inputItem || inputItem.type !== "text") {
      throw new Error("Expected worker smoke turn input to be text.");
    }

    const prompt = inputItem.text;

    expect(adapter.buildWorkerTurnRequests(smokeInput).threadStartRequest.params).toMatchObject({
      sandbox: "read-only",
      baseInstructions: expect.stringContaining("do not perform implementation work or create ledger evidence"),
      developerInstructions: expect.stringContaining("Return only the acknowledgement JSON object")
    });
    expect(request.params).toMatchObject({
      effort: "low",
      sandboxPolicy: {
        type: "readOnly",
        networkAccess: false
      }
    });
    expect(request.params.outputSchema).toMatchObject({
      required: ["schemaVersion", "jobId", "status", "summary"],
      properties: {
        status: { type: "string", const: "acknowledged" }
      }
    });
    expect(prompt).toContain("Acknowledge one Solo Superman live worker-job protocol smoke");
    expect(prompt).toContain("status: acknowledged");
    expect(prompt).toContain("Do not call tools, do not edit files, do not run shell commands");

    const protocolOutput = validateCodexWorkerExecutionOutput(codexWorkerProtocolSmokeOutputTemplate(smokeInput));

    expect(() => assertCodexWorkerExecutionOutputMatchesInput(smokeInput, protocolOutput)).not.toThrow();
    expect(protocolOutput.ledgerTransitions.at(-1)?.stepCommitRecord).toMatchObject({
      changedFiles: expect.arrayContaining([
        "generated-product/product-slice.json"
      ])
    });
  });

  it("validates worker execution fixture output with completed ledger evidence", async () => {
    const input = codexWorkerInputFixture();
    const adapter = createCodexRuntimeAdapter({
      fixtureMode: true,
      env: {}
    });
    const output = await adapter.executeWorker(input);

    expect(output).toEqual(fixtureCodexWorkerExecutionOutput(input));
    expect(validateCodexWorkerExecutionOutput(output)).toMatchObject({
      schemaVersion: CONTRACT_SCHEMA_VERSION,
      jobId: input.jobId,
      status: "completed",
      evidenceRefs: expect.arrayContaining([
        `codex-worker:${input.jobId}:fixture`,
        "codex-worker:fixture:completed"
      ])
    });
    expect(output.ledgerTransitions.at(-1)).toMatchObject({
      trackerDoc: input.ledgerTrackerDoc,
      stepDoc: input.ledgerStepDoc,
      targetStatus: "completed",
      evidenceRefs: ["codex-worker:fixture:completed"]
    });
    expect(output.ledgerTransitions.at(-1)?.stepCommitRecord).toMatchObject({
      stepId: input.ledgerStepDoc.stepId,
      changedFiles: expect.arrayContaining([
        "generated-product/product-slice.json",
        "generated-product/src/product-slice.mjs"
      ])
    });
    const codeReviewScopes = output.ledgerTransitions
      .flatMap((transition) => transition.codeReviewRecord ? [transition.codeReviewRecord.reviewScope] : []);
    const cleanCodeReviewScopes = output.ledgerTransitions
      .flatMap((transition) => transition.cleanCodeReviewRecord ? [transition.cleanCodeReviewRecord.reviewScope] : []);

    expect(codeReviewScopes.filter((scope) => scope === "feature")).toHaveLength(2);
    expect(codeReviewScopes.filter((scope) => scope === "repository")).toHaveLength(2);
    expect(cleanCodeReviewScopes.filter((scope) => scope === "changed_code")).toHaveLength(2);
    expect(cleanCodeReviewScopes.filter((scope) => scope === "repository")).toHaveLength(2);
    expect(output.ledgerTransitions.at(-1)?.missingTestAuditRecord).toMatchObject({
      stepId: input.ledgerStepDoc.stepId
    });
    expect(output.ledgerTransitions.at(-1)?.testEvidenceRecord).toMatchObject({
      stepId: input.ledgerStepDoc.stepId,
      failedTestCount: 0,
      notTestedGaps: []
    });
    expect(() => assertCodexWorkerExecutionOutputMatchesInput(input, output)).not.toThrow();
    expect(parseCodexWorkerExecutionOutput(`\`\`\`json\n${JSON.stringify(output)}\n\`\`\``)).toMatchObject({
      jobId: input.jobId,
      status: "completed"
    });
    expect(validateCodexWorkerExecutionOutput({
      ...output,
      blockedReason: null,
      missingEvidence: null,
      nextRequiredAction: null,
      ledgerTransitions: output.ledgerTransitions.map((transition) => {
        const schemaTransition = { ...transition } as Record<string, unknown>;

        for (const key of [
          "trackerDoc",
          "stepDoc",
          "targetStatus",
          "startedEvidenceRefs",
          "stepCommitRecord",
          "noCodeStepEvidence",
          "codeReviewRecord",
          "cleanCodeReviewRecord",
          "missingTestAuditRecord",
          "testEvidenceRecord",
          "blocker",
          "evidenceRefs"
        ]) {
          if (!(key in schemaTransition)) {
            schemaTransition[key] = null;
          }
        }

        return schemaTransition;
      })
    })).toMatchObject({
      jobId: input.jobId,
      status: "completed",
      ledgerTransitions: output.ledgerTransitions
    });
    expect(() =>
      validateCodexWorkerExecutionOutput({
        schemaVersion: CONTRACT_SCHEMA_VERSION,
        jobId: input.jobId,
        status: "completed",
        summary: "Missing ledger transitions",
        ledgerTransitions: [],
        evidenceRefs: ["codex-worker:bad"]
      })
    ).toThrow("Completed Codex worker execution output must include ledgerTransitions");
  });

  it("rejects worker output that uses a different ledger doc contract", () => {
    const input = codexWorkerInputFixture();
    const output = fixtureCodexWorkerExecutionOutput(input);
    const reorderedDocOutput = {
      ...output,
      ledgerTransitions: output.ledgerTransitions.map((transition) => ({
        ...transition,
        stepDoc: {
          sourceRefs: input.ledgerStepDoc.sourceRefs,
          expectedChangeScope: input.ledgerStepDoc.expectedChangeScope,
          description: input.ledgerStepDoc.description,
          title: input.ledgerStepDoc.title,
          stepId: input.ledgerStepDoc.stepId
        }
      }))
    };

    expect(() => assertCodexWorkerExecutionOutputMatchesInput(input, reorderedDocOutput)).not.toThrow();

    expect(() =>
      assertCodexWorkerExecutionOutputMatchesInput(input, {
        ...output,
        ledgerTransitions: output.ledgerTransitions.map((transition) => ({
          ...transition,
          stepDoc: {
            ...input.ledgerStepDoc,
            stepId: "unexpected-step"
          }
        }))
      })
    ).toThrow("must use the planned ImplementationStepLedger stepDoc");

    expect(() =>
      assertCodexWorkerExecutionOutputMatchesInput(input, {
        ...output,
        ledgerTransitions: output.ledgerTransitions.map((transition) => ({
          ...transition,
          ...(transition.stepCommitRecord
            ? {
                stepCommitRecord: {
                  ...transition.stepCommitRecord,
                  changedFiles: [input.issueDocumentPath]
                }
              }
            : {})
        }))
      })
    ).toThrow("must record a generated-product changed file");
  });

  it("rejects worker output that leaks secret-like text or claims external production mutation", () => {
    const input = codexWorkerInputFixture();
    const safeOutput = fixtureCodexWorkerExecutionOutput(input);

    expect(() =>
      validateCodexWorkerExecutionOutput({
        ...safeOutput,
        summary: "Worker copied NPM_TOKEN=plain-secret-value into the report."
      })
    ).toThrow("must not contain credential, token, session cookie, or secret-like values");
    expect(() =>
      validateCodexWorkerExecutionOutput({
        ...safeOutput,
        evidenceRefs: ["deploy:production"]
      })
    ).toThrow("must not claim external, production, final-submit, account, or destructive mutations");
    expect(() =>
      validateCodexWorkerExecutionOutput({
        ...safeOutput,
        evidenceRefs: ["codex-worker:completed"],
        ledgerTransitions: safeOutput.ledgerTransitions.map((transition, index) => index === safeOutput.ledgerTransitions.length - 1
          ? {
              ...transition,
              stepCommitRecord: {
                ...transition.stepCommitRecord!,
                commitSha: "__REPLACE_WITH_COMMIT_SHA__",
                previousCommitSha: "__REPLACE_WITH_PREVIOUS_COMMIT_SHA__",
                diffRange: "__REPLACE_WITH_PREVIOUS_COMMIT_SHA__..__REPLACE_WITH_COMMIT_SHA__"
              }
            }
          : transition)
      })
    ).toThrow("must replace all ledger template placeholders");
    expect(() =>
      validateCodexWorkerExecutionOutput({
        ...safeOutput,
        status: "blocked",
        summary: "Worker refused the request.",
        ledgerTransitions: [],
        evidenceRefs: ["worker-blocked:external-production-mutation"],
        blockedReason: "External production mutation remains blocked.",
        missingEvidence: ["External production mutation approval"],
        nextRequiredAction: "Keep the worker blocked until a future contract explicitly opens this action."
      })
    ).not.toThrow();
  });
});
