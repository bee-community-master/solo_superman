import { describe, expect, it, vi } from "vitest";
import type {
  ConfidenceCompletionProjection,
  DecisionQueueProjection,
  ProjectionVersion,
  SessionId
} from "@solo-superman/contracts";
import {
  phase15bReadinessViewModel,
  planningHandoffViewModel
} from "../decision-queue-view-model";
import { renderEnglishMarkup } from "../test-rendering";
import { emptyProjectionState } from "./decision-queue-shell-model";
import { PlanningView } from "./PlanningView";
import type { DecisionQueueShellController } from "./useDecisionQueueShellController";

function confidenceWithRiskCards(): ConfidenceCompletionProjection {
  return {
    kind: "ConfidenceCompletionProjection",
    sessionId: "sess_planning_risks" as SessionId,
    version: 7 as ProjectionVersion,
    compositeScore: 58,
    readinessLabel: "clarifying",
    axes: [],
    scoreBreakdown: {
      sectionCompleteness: 60,
      questionDebtResolution: 40,
      evidenceQuality: 50,
      decisionApproval: 70,
      consistencyAndConflict: 65
    },
    gates: [],
    topRisks: [
      "Customer urgency still unproven.",
      "Acquisition channel lacks con evidence.",
      "Implementation scope may be too broad.",
      "Pricing signal is stale."
    ],
    topRiskCards: [
      {
        riskId: "risk_customer_urgency",
        title: "Customer urgency still unproven",
        severity: "high",
        sourceRefs: ["queue:customer_urgency", "evidence:interview_gap"],
        nextValidationAction: "Interview five target users about current workaround urgency."
      },
      {
        riskId: "risk_acquisition_channel",
        title: "Acquisition channel lacks con evidence",
        severity: "medium",
        sourceRefs: ["research:channel"],
        nextValidationAction: "Run a skeptical search for failed channels in this segment."
      },
      {
        riskId: "risk_implementation_scope",
        title: "Implementation scope may be too broad",
        severity: "low",
        sourceRefs: [],
        nextValidationAction: "Cut the first build slice to one workflow and one success metric."
      },
      {
        riskId: "risk_pricing_stale",
        title: "Pricing signal is stale",
        severity: "medium",
        sourceRefs: ["research:pricing"],
        nextValidationAction: "Refresh willingness-to-pay evidence before Planning-ready."
      }
    ],
    nextBestActions: ["Validate the top risks before creating a Planning-ready handoff."],
    completionCandidate: {
      status: "not_ready",
      summary: "More risk validation is needed.",
      gateFailures: ["Top risks remain open."],
      ifStopNowArtifact: {
        title: "If stop now",
        summary: "Carry top risks forward explicitly.",
        knownRisks: ["Customer urgency still unproven."],
        nextValidationActions: ["Interview target users."]
      }
    }
  };
}

function queueWithSkippedAxes(skippedCommercializationAxes: readonly string[]): DecisionQueueProjection {
  return {
    kind: "DecisionQueueProjection",
    version: 3 as ProjectionVersion,
    projectPurposeMode: "personal",
    projectPurposeModeSelectionStatus: "confirmed",
    modeEffectSummary: "Personal workflow checks are prioritized.",
    skippedCommercializationAxes,
    active: [],
    next: [],
    blocked: [],
    deferred: []
  };
}

function renderPlanningView(controllerOverrides: Partial<DecisionQueueShellController> = {}) {
  const controller = {
    businessCriticIntensityChangeReason: "",
    changeBusinessCriticIntensity: vi.fn(),
    changeProjectPurposeMode: vi.fn(),
    confidence: null,
    isBusy: false,
    phase15bReadinessView: phase15bReadinessViewModel(null),
    planningHandoffView: planningHandoffViewModel(null),
    prepareFounderBrief: vi.fn(),
    projections: emptyProjectionState(),
    purposeModeChangeReason: "",
    refreshPhase15bReadiness: vi.fn(),
    refreshPlanningHandoff: vi.fn(),
    runPlanningHandoffGate: vi.fn(),
    scoreCompleteness: vi.fn(),
    setBusinessCriticIntensityChangeReason: vi.fn(),
    setPurposeModeChangeReason: vi.fn(),
    ...controllerOverrides
  } satisfies Partial<DecisionQueueShellController>;

  return renderEnglishMarkup(<PlanningView controller={controller as DecisionQueueShellController} />);
}

describe("PlanningView", () => {
  it("renders the scored Top 3 Risk Cards with severity, sources, and next validation actions", () => {
    const markup = renderPlanningView({
      confidence: confidenceWithRiskCards()
    });

    expect(markup).toContain("Top 3 Risk Cards");
    expect(markup).toContain("Customer urgency still unproven");
    expect(markup).toContain("Severity: high");
    expect(markup).toContain("Next validation action: Interview five target users about current workaround urgency.");
    expect(markup).toContain("Source refs: queue:customer_urgency, evidence:interview_gap");
    expect(markup).toContain("Acquisition channel lacks con evidence");
    expect(markup).toContain("Implementation scope may be too broad");
    expect(markup).toContain("Source refs: no source refs");
    expect(markup).not.toContain("Pricing signal is stale");
  });

  it("renders the Confidence Map with score drivers and blocked completion gates", () => {
    const markup = renderPlanningView({
      confidence: confidenceWithRiskCards()
    });

    expect(markup).toContain("Confidence Map");
    expect(markup).toContain("Shows the score drivers and readiness gates");
    expect(markup).toContain("Spec sections");
    expect(markup).toContain("60%");
    expect(markup).toContain("Question debt");
    expect(markup).toContain("40%");
    expect(markup).toContain("Evidence quality");
    expect(markup).toContain("50%");
    expect(markup).toContain("Decision approval");
    expect(markup).toContain("70%");
    expect(markup).toContain("Consistency");
    expect(markup).toContain("65%");
    expect(markup).toContain("not ready");
    expect(markup).toContain("Completion candidate: More risk validation is needed.");
    expect(markup).toContain("Readiness gate blockers");
    expect(markup).toContain("Top risks remain open.");
  });

  it("shows a ready Confidence Map message when completion gates pass", () => {
    const confidence = confidenceWithRiskCards();
    const markup = renderPlanningView({
      confidence: {
        ...confidence,
        completionCandidate: {
          ...confidence.completionCandidate,
          status: "candidate",
          summary: "Planning handoff can be reviewed.",
          gateFailures: []
        }
      }
    });

    expect(markup).toContain("candidate");
    expect(markup).toContain("Completion candidate: Planning handoff can be reviewed.");
    expect(markup).toContain("All readiness gates are passing.");
    expect(markup).not.toContain("Top risks remain open.");
  });

  it("keeps the no-risk fallback when scored risk cards are absent", () => {
    const markup = renderPlanningView({
      confidence: {
        ...confidenceWithRiskCards(),
        topRisks: [],
        topRiskCards: []
      }
    });

    expect(markup).toContain("No risk summary yet.");
    expect(markup).not.toContain("Top 3 Risk Cards");
  });

  it("shows personal-mode skipped commercialization axes with user-facing labels", () => {
    const markup = renderPlanningView({
      projections: {
        ...emptyProjectionState(),
        queue: queueWithSkippedAxes([
          "market_size",
          "investor_narrative",
          "willingness_to_pay",
          "acquisition_channel"
        ])
      }
    });

    expect(markup).toContain("Skipped commercialization axes");
    expect(markup).toContain("Personal mode keeps these business/investor checks visible");
    expect(markup).toContain("Market size");
    expect(markup).toContain("Investor narrative");
    expect(markup).toContain("Willingness to pay");
    expect(markup).toContain("Acquisition channel");
    expect(markup).not.toContain("market_size");
  });

  it("does not show skipped commercialization axes when none are supplied", () => {
    const markup = renderPlanningView({
      projections: {
        ...emptyProjectionState(),
        queue: queueWithSkippedAxes([])
      }
    });

    expect(markup).not.toContain("Skipped commercialization axes");
  });

  it("falls back to confidence skipped-axis metadata when the queue has no skipped axes", () => {
    const markup = renderPlanningView({
      confidence: {
        ...confidenceWithRiskCards(),
        skippedCommercializationAxes: ["competition_pressure"]
      },
      projections: {
        ...emptyProjectionState(),
        queue: queueWithSkippedAxes([])
      }
    });

    expect(markup).toContain("Skipped commercialization axes");
    expect(markup).toContain("Competition pressure");
  });
});
