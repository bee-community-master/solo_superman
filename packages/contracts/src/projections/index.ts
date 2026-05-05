export * from "./confidence-completion";
export * from "./decision-queue";
export * from "./founder-brief";
export * from "./living-spec";
export * from "./research-allowlist";
export * from "./research-disclosure-log";
export * from "./research-evidence";
export * from "./runtime-activity";
export * from "./session-shell";

export type ProjectionKind =
  | "SessionShellProjection"
  | "DecisionQueueProjection"
  | "LivingSpecProjection"
  | "ResearchAllowlistProjection"
  | "ResearchDisclosureLogProjection"
  | "ResearchEvidenceProjection"
  | "ConfidenceCompletionProjection"
  | "RuntimeActivityProjection"
  | "FounderBriefProjection";
