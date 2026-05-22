import { describe, expect, it, vi } from "vitest";
import type { ConfidenceCompletionProjection, ProjectionVersion, SessionId } from "@solo-superman/contracts";
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
});
