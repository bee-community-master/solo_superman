import { describe, expect, it } from "vitest";
import {
  BLOCKED_ACTION_TYPES,
  CODEX_APPLY_POLICIES,
  CODEX_ARTIFACT_KINDS,
  CODEX_TURN_PURPOSES,
  CONTRACT_SCHEMA_VERSION
} from "@solo-superman/contracts";
import {
  createCodexRuntimeAdapter,
  fixtureCodexPreviewOutput,
  parseCodexPreviewOutput,
  repairCodexJsonOutput,
  validateCodexPreviewOutput
} from "./index";

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

  it("converts forbidden action fixtures into BlockedActionArtifact taxonomy", () => {
    for (const actionType of BLOCKED_ACTION_TYPES) {
      const output = fixtureCodexPreviewOutput({
        turnPurpose: "implementation_plan_preview",
        contextHash: `ctx_block_${actionType}`,
        prompt: "Preview a forbidden action.",
        sourceRefs: ["spec_current"],
        targetObject: "blocked_action",
        requestedActionType: actionType
      });

      expect(output).toMatchObject({
        artifactKind: "BlockedActionArtifact",
        applyPolicy: "blocked",
        payload: {
          blockedAction: {
            actionType
          }
        }
      });
    }
  });

  it("reports deterministic fixture status without requiring a live Codex turn", async () => {
    const adapter = createCodexRuntimeAdapter({
      fixtureMode: true,
      now: () => "2026-05-05T00:00:00.000Z",
      env: {}
    });

    await expect(adapter.getStatus()).resolves.toMatchObject({
      status: "available",
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

  it("does not report live preview availability when turn execution is disabled", async () => {
    const adapter = createCodexRuntimeAdapter({
      now: () => "2026-05-05T00:00:00.000Z",
      env: {}
    });

    await expect(adapter.getStatus()).resolves.toMatchObject({
      status: "unavailable",
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
      required: expect.arrayContaining(["schemaVersion", "turnPurpose", "artifactKind", "applyPolicy"])
    });
  });
});
