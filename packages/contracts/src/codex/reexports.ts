import type { EffectTaskId, RuntimeArtifactId, SchemaVersion } from "../ids";
import type { Phase15bUpgradeHints } from "./phase15b-upgrade-hints";

export const CODEX_TURN_PURPOSES = [
  "question_generation",
  "ambiguity_analysis",
  "research_prompt",
  "evidence_synthesis",
  "spec_update_preview",
  "implementation_plan_preview"
] as const;

export const CODEX_ARTIFACT_KINDS = [
  "QuestionBatchArtifact",
  "AmbiguityAnalysisArtifact",
  "ResearchPromptArtifact",
  "EvidenceSynthesisArtifact",
  "SpecUpdatePreviewArtifact",
  "ImplementationPlanPreviewArtifact",
  "BlockedActionArtifact"
] as const;

export const CODEX_APPLY_POLICIES = [
  "auto_apply",
  "conditional_auto_apply",
  "note_only",
  "approval_required",
  "blocked",
  "manual_handoff_required"
] as const;

export const BLOCKED_ACTION_TYPES = [
  "file_patch",
  "shell_command",
  "browser_action",
  "network_write",
  "credential_access",
  "destructive_operation",
  "chatgpt_web_automation"
] as const;

export const CODEX_APP_SERVER_GENERATED_VERSION = "codex-cli-0.128.0" as const;
export const CODEX_RUNTIME_ADAPTER_VERSION = "codex-app-server-preview-v1" as const;
export const CODEX_RUNTIME_TRANSPORT = "stdio" as const;

export type CodexTurnPurpose = (typeof CODEX_TURN_PURPOSES)[number];
export type CodexArtifactKind = (typeof CODEX_ARTIFACT_KINDS)[number];
export type CodexApplyPolicy = (typeof CODEX_APPLY_POLICIES)[number];
export type BlockedActionType = (typeof BLOCKED_ACTION_TYPES)[number];
export type CodexRuntimeSource = "codex_app_server" | "manual_prompt_handoff" | "protocol_fixture";
export type CodexRuntimeStatus = "available" | "unavailable" | "blocked";
export type RuntimePreviewStatus = "preview_ready" | "manual_handoff" | "blocked";

export const CODEX_ARTIFACT_KIND_BY_TURN_PURPOSE = {
  question_generation: "QuestionBatchArtifact",
  ambiguity_analysis: "AmbiguityAnalysisArtifact",
  research_prompt: "ResearchPromptArtifact",
  evidence_synthesis: "EvidenceSynthesisArtifact",
  spec_update_preview: "SpecUpdatePreviewArtifact",
  implementation_plan_preview: "ImplementationPlanPreviewArtifact"
} as const satisfies Record<CodexTurnPurpose, Exclude<CodexArtifactKind, "BlockedActionArtifact">>;

export const CODEX_APPLY_POLICY_BY_TURN_PURPOSE = {
  question_generation: "auto_apply",
  ambiguity_analysis: "auto_apply",
  research_prompt: "manual_handoff_required",
  evidence_synthesis: "conditional_auto_apply",
  spec_update_preview: "approval_required",
  implementation_plan_preview: "note_only"
} as const satisfies Record<CodexTurnPurpose, Exclude<CodexApplyPolicy, "blocked">>;

export interface CodexRuntimeStatusDto {
  readonly status: CodexRuntimeStatus;
  readonly adapterVersion: typeof CODEX_RUNTIME_ADAPTER_VERSION;
  readonly generatedSchemaVersion: typeof CODEX_APP_SERVER_GENERATED_VERSION;
  readonly transport: typeof CODEX_RUNTIME_TRANSPORT;
  readonly checkedAt: string;
  readonly manualHandoffAvailable: boolean;
  readonly reason?: string;
}

export interface BlockedActionSummary {
  readonly actionType: BlockedActionType;
  readonly reason: string;
  readonly suggestedSafeAlternative?: string;
}

export interface CodexPreviewArtifactPayload {
  readonly title: string;
  readonly body: string;
  readonly targetObject: string;
  readonly sourceRefs: readonly string[];
  readonly blockedAction?: BlockedActionSummary;
  readonly phase15bUpgradeHints?: Phase15bUpgradeHints;
}

export interface CodexPreviewOutputEnvelope {
  readonly schemaVersion: SchemaVersion;
  readonly turnPurpose: CodexTurnPurpose;
  readonly artifactKind: CodexArtifactKind;
  readonly applyPolicy: CodexApplyPolicy;
  readonly summary: string;
  readonly payload: CodexPreviewArtifactPayload;
}

export interface RuntimePreviewArtifactPersistenceRef {
  readonly artifactId: RuntimeArtifactId;
  readonly sourceEffectTaskId?: EffectTaskId;
}

export interface CodexOutputEnvelopeRef {
  readonly artifactId: RuntimeArtifactId;
  readonly kind: CodexArtifactKind;
  readonly schemaVersion: SchemaVersion;
}
