import { BLOCKED_ACTION_TYPES } from "@solo-superman/contracts";

export const PHASE1_E2E_SAMPLE_IDEA =
  "A local-first product coaching app that turns a rough solo-founder idea into a traceable Founder Brief.";

export const PHASE1_E2E_INTAKE_ANSWER =
  "The first customer is a solo founder preparing paid customer interviews. They need a clear problem, target segment, value proposition, validation plan, MVP scope, and success criteria before committing build time.";

export const PHASE1_E2E_RESEARCH_RESULT =
  "Pro: founder interviews support urgent demand for a structured spec session before building. Risk: generic templates and existing accelerator worksheets may be good enough for some founders. Uncertain: willingness to pay still needs a tighter price test.";

export const PHASE1_E2E_SPEC_SECTIONS = [
  "Problem: solo founders start from vague ideas and lose time before validating the riskiest assumptions.",
  "Target customer: solo founders preparing paid customer interviews in the next two weeks.",
  "JTBD / Use Case: before building, the founder wants to turn scattered assumptions into a decision-ready session plan.",
  "Current alternatives: templates, accelerator worksheets, generic AI chats, and doing nothing can solve parts of the workflow.",
  "Value proposition: compress problem, target, value, and tradeoff decisions into a traceable Founder Brief.",
  "Differentiation: local-first traceability keeps decisions, evidence, and known risks connected without external custody.",
  "MVP scope: local-first web loop with sidecar API, evidence matrix, decision approval, and metadata-only export.",
  "Non-goals: no Phase 2.5 browser delegation, credential custody, external write, or broad team/mobile/billing expansion.",
  "Validation plan: run five paid-interview prep sessions and compare decision clarity before and after the session.",
  "Success criteria: users can name target customer, top risks, next validation action, and stop-now risk within one session.",
  "Evidence status: manual research contains both support and counter-evidence, with retained uncertainty notes.",
  "Known risks / open questions: willingness to pay and acquisition channel remain explicit follow-up risks."
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

export const PHASE15B_NO_EXECUTION_ACTION_TYPES = BLOCKED_ACTION_TYPES;

export const PHASE15B_ACCEPTANCE_EVIDENCE_MAP = [
  {
    scenario: "Scenario E. Phase 1.5B no-execution preservation",
    sourceDocs: ["docs/30-phase1.5-research-runtime-and-readiness-contract.md"],
    runtimeEvidence: [
      "BlockedActionArtifact",
      "Phase15bUpgradeHints",
      "metadata_only_no_execution",
      "delegationState:not_active",
      "productActionPerformed:false"
    ]
  },
  {
    scenario: "Scenario F. Hint export/readiness reuse",
    sourceDocs: [
      "docs/30-phase1.5-research-runtime-and-readiness-contract.md",
      "docs/31-phase2-planning-handoff-contract.md",
      "docs/32-phase2-implementation-preflight-contract.md"
    ],
    runtimeEvidence: [
      "Phase15bUpgradeHintExport",
      "readiness_preview_handoff_metadata",
      "research_run sourceRef",
      "evidence_matrix sourceRef",
      "research_allowlist sourceRef",
      "audit_log sourceRef"
    ]
  },
  {
    scenario: "Scenario G. Docs contract consistency",
    sourceDocs: [
      "docs/README.md",
      "docs/30-phase1.5-research-runtime-and-readiness-contract.md",
      "docs/31-phase2-planning-handoff-contract.md",
      "docs/32-phase2-implementation-preflight-contract.md"
    ],
    runtimeEvidence: [
      "verify-doc-contracts",
      "doc 30 reading order",
      "Phase 1.5B readiness metadata source",
      "not execution permission"
    ]
  }
] as const;

export const PHASE2_ACCEPTANCE_EVIDENCE_MAP = [
  {
    scenario: "Scenario H. Phase 2 final Planning Handoff dry-run",
    sourceDocs: [
      "docs/12-validation-and-dry-run.md",
      "docs/31-phase2-planning-handoff-contract.md",
      "docs/32-phase2-implementation-preflight-contract.md"
    ],
    runtimeEvidence: [
      "CreatePlanningHandoff",
      "PlanningHandoffArtifact",
      "planning_ready",
      "taskBreakdown",
      "prIssuePlan",
      "buildSlicePlan",
      "no_file_shell_browser_deploy_or_external_mutation"
    ]
  },
  {
    scenario: "Scenario I. Phase 2 blocker Planning Handoff dry-run",
    sourceDocs: [
      "docs/12-validation-and-dry-run.md",
      "docs/31-phase2-planning-handoff-contract.md",
      "docs/32-phase2-implementation-preflight-contract.md"
    ],
    runtimeEvidence: [
      "PlanningHandoffBlockerArtifact",
      "source_trace_incomplete",
      "must_not_use_planning_ready_label",
      "requiredNextAction",
      "PlanningHandoffProjection"
    ]
  }
] as const;

export const PHASE1_2_CLOSEOUT_EVIDENCE = [
  {
    issue: "#66",
    phase: "Phase 1",
    evidence: ["canonical 12-section Living Spec", "15 ambiguity issues", "priority question batch"]
  },
  {
    issue: "#67",
    phase: "Phase 1",
    evidence: ["Decision Queue refetch URL", "SSE projection.updated notification", "missed-SSE recovery"]
  },
  {
    issue: "#68",
    phase: "Phase 1.5A",
    evidence: ["allowlist lifecycle", "local fake read-only provider", "needs_review before quality acceptance"]
  },
  {
    issue: "#69",
    phase: "Phase 1.5A",
    evidence: ["Decision-linked Evidence Pack", "Research-updated Queue", "Planning Handoff quality gate"]
  },
  {
    issue: "#70",
    phase: "Phase 1.5B",
    evidence: ["Phase15bUpgradeHints", "metadata_only_no_execution", "Phase 2 sourceRef reuse"]
  },
  {
    issue: "#71",
    phase: "Phase 2",
    evidence: ["strict Planning Handoff validation", "idempotent artifact save", "source trace preservation"]
  },
  {
    issue: "#74",
    phase: "Phase 2",
    evidence: ["source-driven synthesis", "safe UI trigger", "final/blocker Planning Handoff projection"]
  },
  {
    issue: "#75",
    phase: "Hardening",
    evidence: ["pnpm smoke:e2e", "node scripts/verify-doc-contracts.mjs", "docs/35 closeout report"]
  }
] as const;

export const PHASE3_CLOSEOUT_EVIDENCE = [
  {
    issue: "#92",
    slice: "common ledger/authority",
    evidence: [
      "ExecutionAuthorityRecord",
      "BoundedAgentOutputRecord",
      "approvalDecision pending/approved",
      "executionResult running terminal family"
    ]
  },
  {
    issue: "#93",
    slice: "approval/API security boundary",
    evidence: [
      "POST /api/v1/sessions/:sessionId/execution-authority",
      "preflight exact preview hash",
      "local token + loopback + CSRF/replay"
    ]
  },
  {
    issue: "#94",
    slice: "file_diff controlled adapter",
    evidence: [
      "FileDiffExecutionResult.completed",
      "git_diff_reverse",
      "credential/secret/repo-outside/symlink escape blocked"
    ]
  },
  {
    issue: "#95",
    slice: "shell_command controlled adapter",
    evidence: [
      "ShellCommandExecutionResult.completed",
      "repo scripts + read-only diagnostics allowlist",
      "destructive shell command blocked"
    ]
  },
  {
    issue: "#96",
    slice: "browser_action controlled adapter",
    evidence: [
      "BrowserActionExecutionResult.completed",
      "loopback-only browser target policy",
      "external-production mutation and blanket approval blocked"
    ]
  },
  {
    issue: "#97",
    slice: "closeout hardening",
    evidence: [
      "docs/38 Phase 3 closeout evidence",
      "Phase 3 approved/blocked E2E dry-run",
      "docs/verifier Phase 3 guardrails"
    ]
  }
] as const;

export const PHASE3_CLOSEOUT_DRY_RUN_EVIDENCE_MAP = [
  {
    scenario: "Scenario J. Phase 3 approved controlled execution dry-run",
    sourceDocs: [
      "docs/12-validation-and-dry-run.md",
      "docs/36-phase3-controlled-execution-contract.md",
      "docs/38-phase3-closeout-evidence.md"
    ],
    runtimeEvidence: [
      "CreateExecutionAuthority",
      "ExecutionAuthorityLedgerProjection.ready_for_execution",
      "FileDiffExecutionResult.completed",
      "ShellCommandExecutionResult.completed",
      "BrowserActionExecutionResult.completed",
      "terminal evidence/audit refs"
    ]
  },
  {
    scenario: "Scenario K. Phase 3 blocked unsafe execution dry-run",
    sourceDocs: [
      "docs/12-validation-and-dry-run.md",
      "docs/36-phase3-controlled-execution-contract.md",
      "docs/38-phase3-closeout-evidence.md"
    ],
    runtimeEvidence: [
      "preview_hash_or_sandbox_failure blocked",
      "credential custody blocked",
      "destructive shell command blocked",
      "external-production mutation blocked",
      "hosted SaaS default blocked",
      "browser-only DB rewrite blocked",
      "blanket approval blocked"
    ]
  }
] as const;
