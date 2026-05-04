import { describe, expect, it } from "vitest";
import type { CodexAppServerInitializeParams } from "./app-server-protocol";
import {
  BLOCKED_ACTION_TYPES,
  CODEX_APP_SERVER_GENERATED_VERSION,
  CODEX_APPLY_POLICIES,
  CODEX_ARTIFACT_KINDS,
  CODEX_RUNTIME_ADAPTER_VERSION,
  CODEX_RUNTIME_TRANSPORT,
  CODEX_TURN_PURPOSES
} from "./reexports";

describe("PR-07 codex-contract generated schema and internal taxonomy", () => {
  it("pins the installed Codex app-server schema version and generated protocol files", () => {
    const generatedProtocolSample: CodexAppServerInitializeParams = {
      clientInfo: {
        name: "solo-superman",
        title: "Solo Superman",
        version: "0.1.0"
      },
      capabilities: {
        experimentalApi: false
      }
    };

    expect(CODEX_RUNTIME_ADAPTER_VERSION).toBe("codex-app-server-preview-v1");
    expect(CODEX_RUNTIME_TRANSPORT).toBe("stdio");
    expect(CODEX_APP_SERVER_GENERATED_VERSION).toBe("codex-cli-0.128.0");
    expect(generatedProtocolSample.clientInfo.name).toBe("solo-superman");
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
});
