import { describe, expect, it } from "vitest";
import {
  BLOCKED_ACTION_TYPES,
  CODEX_APPLY_POLICIES,
  CODEX_ARTIFACT_KINDS,
  type CodexRuntimeAccountDto,
  type CodexRuntimeLoginStartDto,
  CODEX_RUNTIME_ADAPTER_VERSION,
  CODEX_RUNTIME_TRANSPORT,
  CODEX_SDK_PACKAGE_VERSION,
  CODEX_TURN_PURPOSES
} from "./reexports";

describe("Codex SDK contract and internal taxonomy", () => {
  it("pins the installed Codex SDK runtime metadata", () => {
    expect(CODEX_RUNTIME_ADAPTER_VERSION).toBe("codex-sdk-runtime-v1");
    expect(CODEX_RUNTIME_TRANSPORT).toBe("codex-sdk-jsonl");
    expect(CODEX_SDK_PACKAGE_VERSION).toBe("0.137.0");
  });

  it("keeps the internal Codex prompt/output taxonomy closed", () => {
    expect(CODEX_TURN_PURPOSES).toEqual([
      "question_generation",
      "ambiguity_analysis",
      "research_prompt",
      "evidence_synthesis",
      "spec_update_preview",
      "implementation_plan_preview"
    ]);
    expect(CODEX_ARTIFACT_KINDS).toEqual([
      "QuestionBatchArtifact",
      "AmbiguityAnalysisArtifact",
      "ResearchPromptArtifact",
      "EvidenceSynthesisArtifact",
      "SpecUpdatePreviewArtifact",
      "ImplementationPlanPreviewArtifact",
      "BlockedActionArtifact"
    ]);
    expect(CODEX_APPLY_POLICIES).toEqual([
      "auto_apply",
      "conditional_auto_apply",
      "note_only",
      "approval_required",
      "blocked",
      "manual_handoff_required"
    ]);
    expect(BLOCKED_ACTION_TYPES).toEqual([
      "file_patch",
      "shell_command",
      "browser_action",
      "network_write",
      "credential_access",
      "destructive_operation",
      "chatgpt_web_automation"
    ]);
  });

  it("keeps Codex account login status explicit without storing credentials", () => {
    const accountStatus = {
      status: "authenticated",
      accountType: "chatgpt",
      email: "founder@example.com",
      planType: "pro",
      requiresOpenaiAuth: true,
      loginCommand: "codex auth login",
      loginStatusCommand: "codex login status"
    } satisfies CodexRuntimeAccountDto;

    expect(accountStatus).toMatchObject({
      status: "authenticated",
      accountType: "chatgpt",
      loginCommand: "codex auth login",
      loginStatusCommand: "codex login status"
    });
    expect(JSON.stringify(accountStatus)).not.toContain("token");
    expect(JSON.stringify(accountStatus)).not.toContain("secret");
  });

  it("keeps Codex login start output command-based and credential-free", () => {
    const loginStart = {
      status: "started",
      command: "codex auth login",
      statusCommand: "codex login status",
      startedAt: "2026-05-17T00:00:00.000Z",
      terminal: "Terminal.app",
      message: "Opened `codex auth login` in a background Terminal window."
    } satisfies CodexRuntimeLoginStartDto;

    expect(loginStart).toMatchObject({
      status: "started",
      command: "codex auth login",
      statusCommand: "codex login status"
    });
    expect(JSON.stringify(loginStart)).not.toContain("token");
    expect(JSON.stringify(loginStart)).not.toContain("secret");
  });
});
