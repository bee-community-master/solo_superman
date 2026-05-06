export const PHASE1_E2E_SAMPLE_IDEA =
  "A local-first product coaching app that turns a rough solo-founder idea into a traceable Founder Brief.";

export const PHASE1_E2E_INTAKE_ANSWER =
  "The first customer is a solo founder preparing paid customer interviews. They need a clear problem, target segment, value proposition, validation plan, MVP scope, and success criteria before committing build time.";

export const PHASE1_E2E_RESEARCH_RESULT =
  "Pro: founder interviews support urgent demand for a structured spec session before building. Risk: generic templates and existing accelerator worksheets may be good enough for some founders. Uncertain: willingness to pay still needs a tighter price test.";

export const PHASE1_E2E_SPEC_SECTIONS = [
  "Problem: solo founders start from vague ideas and lose time before validating the riskiest assumptions.",
  "Target customer: solo founders preparing paid customer interviews in the next two weeks.",
  "Value proposition: compress problem, target, value, and tradeoff decisions into a traceable Founder Brief.",
  "Alternative and competition: templates, accelerator worksheets, and generic AI chats can solve parts of the workflow.",
  "Evidence: manual research contains both support and counter-evidence, with retained uncertainty notes.",
  "Validation: run five paid-interview prep sessions and compare decision clarity before and after the session.",
  "MVP scope: local-first Tauri desktop loop with sidecar API, evidence matrix, decision approval, and metadata-only export.",
  "Success criteria: users can name target customer, top risks, next validation action, and stop-now risk within one session."
] as const;

export const PHASE1_E2E_ACCEPTANCE_CHECKLIST = [
  {
    criterion: "sample_idea_to_first_question_batch",
    sourceDocs: ["docs/12-validation-and-dry-run.md", "docs/22-phase1-implementation-sequence.md"],
    runtimeEvidence: ["StartProject", "CaptureIntake", "DraftInitialSpec", "AnalyzeAmbiguity", "ActivateQuestionBatch"]
  },
  {
    criterion: "answer_routes_to_research_needed",
    sourceDocs: ["docs/16-state-event-contract.md", "docs/22-phase1-implementation-sequence.md"],
    runtimeEvidence: ["SubmitAnswer", "AnswerSubmitted.answerRouteOutcome", "ResearchPlanned"]
  },
  {
    criterion: "manual_evidence_to_decision_and_spec_version",
    sourceDocs: ["docs/12-validation-and-dry-run.md", "docs/26-api-route-behavior-catalog.md"],
    runtimeEvidence: ["ImportResearchResult", "EvidenceSynthesized", "CreateSpecUpdatePreview", "ResolveDecision", "CreateSpecVersion"]
  },
  {
    criterion: "effect_queue_and_operations_recovery",
    sourceDocs: ["docs/23-product-engine-runtime-contract.md", "docs/27-operations-observability-contract.md"],
    runtimeEvidence: ["queue_projection_effect", "research_evidence_effect", "codex_runtime_preview_effect", "statusUrl", "projectionHints"]
  },
  {
    criterion: "forbidden_scope_not_executed",
    sourceDocs: ["docs/22-phase1-implementation-sequence.md", "docs/24-codex-prompt-output-contract.md"],
    runtimeEvidence: ["BlockedActionArtifact", "metadata_only_no_file_write", "RUNTIME_ACTION_BLOCKED"]
  }
] as const;

export const PHASE15A_ACCEPTANCE_EVIDENCE_MAP = [
  {
    scenario: "Scenario A. Allowlist happy path",
    sourceDocs: ["docs/30-phase1.5-research-runtime-and-readiness-contract.md"],
    runtimeEvidence: [
      "CreateResearchAllowlist",
      "StartResearchRun",
      "ResearchDisclosureLogProjection",
      "statusUrl",
      "projection.updated"
    ]
  },
  {
    scenario: "Scenario B. Private source approval gate",
    sourceDocs: ["docs/30-phase1.5-research-runtime-and-readiness-contract.md"],
    runtimeEvidence: [
      "PrepareResearchDisclosure",
      "blocked_manual_handoff",
      "private_context_material",
      "task_level_approval_or_manual_handoff"
    ]
  },
  {
    scenario: "Scenario C. Revoke, cancel, retry recovery",
    sourceDocs: ["docs/30-phase1.5-research-runtime-and-readiness-contract.md"],
    runtimeEvidence: [
      "PauseResearchAllowlist",
      "RevokeResearchAllowlist",
      "CancelResearchRun",
      "RetryResearchRun",
      "bounded retry/backoff/idempotency"
    ]
  },
  {
    scenario: "Scenario D. Evidence quality gate",
    sourceDocs: ["docs/30-phase1.5-research-runtime-and-readiness-contract.md"],
    runtimeEvidence: [
      "DecisionEvidencePackProjection",
      "ResearchRunProjection.qualityGateStatus",
      "ResearchReviewCardProjection",
      "needs_review"
    ]
  }
] as const;
