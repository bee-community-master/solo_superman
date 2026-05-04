import type { RuntimeArtifactId, SchemaVersion } from "../ids";

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

export type CodexTurnPurpose = (typeof CODEX_TURN_PURPOSES)[number];
export type CodexArtifactKind = (typeof CODEX_ARTIFACT_KINDS)[number];
export type CodexApplyPolicy = (typeof CODEX_APPLY_POLICIES)[number];
export type BlockedActionType = (typeof BLOCKED_ACTION_TYPES)[number];

export interface CodexOutputEnvelopeRef {
  readonly artifactId: RuntimeArtifactId;
  readonly kind: CodexArtifactKind;
  readonly schemaVersion: SchemaVersion;
}
