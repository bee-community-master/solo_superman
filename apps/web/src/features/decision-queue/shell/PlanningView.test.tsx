import { describe, expect, it, vi } from "vitest";
import type {
  ConfidenceCompletionProjection,
  DecisionQueueProjection,
  FounderBriefProjection,
  ProjectId,
  ProjectionVersion,
  SessionId,
  SessionShellProjection
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
    nextBestActions: [
      "Validate the top risks before creating a Planning-ready handoff.",
      "Prepare a Build Slice Plan after the unresolved gates are closed."
    ],
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

function founderBriefProjection(): FounderBriefProjection {
  return {
    kind: "FounderBriefProjection",
    sessionId: "sess_founder_brief" as SessionId,
    version: 4 as ProjectionVersion,
    projectPurposeMode: "business",
    projectPurposeModeLabel: "Business validation",
    projectPurposeModeNarrative: "Business validation keeps commercial risks explicit.",
    skippedCommercializationAxes: [],
    exportReady: false,
    problemCustomerValue: "Founder teams need traceable build readiness.",
    topDecisions: ["Target founder interview workflows first."],
    knownRisks: ["Founder Brief risk still needs an explicit owner."],
    nextValidationActions: ["Assign the Founder Brief risk to the next validation sprint."],
    briefSections: [
      {
        sectionId: "problem_customer_value",
        title: "Problem / Customer / Value",
        body: "Founder teams need traceable build readiness."
      }
    ],
    ifStopNowArtifact: {
      title: "If stop now",
      summary: "Ship only with explicit risk carry-forward.",
      knownRisks: ["Founder Brief risk still needs an explicit owner."],
      nextValidationActions: ["Assign the Founder Brief risk to the next validation sprint."]
    },
    exportMetadata: {
      format: "markdown",
      filename: "founder-brief.md",
      preparedAt: "2026-05-23T00:00:00.000Z",
      writePolicy: "metadata_only_no_file_write",
      blockedSideEffects: []
    }
  };
}

function sessionWithPhase(phase: SessionShellProjection["phase"]): SessionShellProjection {
  return {
    kind: "SessionShellProjection",
    projectId: "project_planning_status" as ProjectId,
    sessionId: "sess_planning_status" as SessionId,
    version: 5 as ProjectionVersion,
    phase,
    projectPurposeModeLabel: "not selected",
    projectPurposeModeEffect: ""
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
    expect(markup).toContain("Why building now is risky");
    expect(markup).toContain("Customer urgency still unproven");
    expect(markup).toContain("Severity: high");
    expect(markup).toContain("Next validation action: Interview five target users about current workaround urgency.");
    expect(markup).toContain("Source refs: no source refs");
    expect(markup).not.toContain("queue:customer_urgency");
    expect(markup).not.toContain("evidence:interview_gap");
    expect(markup).toContain("Acquisition channel lacks con evidence");
    expect(markup).toContain("Implementation scope may be too broad");
    expect(markup).not.toContain("Pricing signal is stale");
    expect(markup.indexOf("Why building now is risky")).toBeLessThan(markup.indexOf(">58<"));
  });

  it("renders the Confidence Map with score drivers and blocked completion gates", () => {
    const markup = renderPlanningView({
      confidence: confidenceWithRiskCards()
    });

    expect(markup).toContain("Confidence Map");
    expect(markup).toContain("Shows the score drivers and readiness gates");
    expect(markup).toContain("Spec sections");
    expect(markup).toContain("60%");
    expect(markup).toContain("Open questions");
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
    expect(markup).toContain("This week&#x27;s validation actions");
    expect(markup).toContain("Validate the top risks before creating a Planning-ready handoff.");
    expect(markup).toContain("Prepare a Build Slice Plan after the unresolved gates are closed.");
    expect(markup).toContain("If stop now");
    expect(markup).toContain("Carry top risks forward explicitly.");
    expect(markup).toContain("If-stop-now known risks");
    expect(markup).toContain("Customer urgency still unproven.");
    expect(markup).toContain("If-stop-now next validation actions");
    expect(markup).toContain("Interview target users.");
  });

  it("shows journey status labels instead of raw internal session phases", () => {
    const markup = renderPlanningView({
      projections: {
        ...emptyProjectionState(),
        session: sessionWithPhase("validation")
      }
    });

    expect(markup).toContain("Research in progress");
    expect(markup).not.toContain(">validation<");
    expect(markup).not.toContain("Next best actions");
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
        topRiskCards: [],
        nextBestActions: []
      }
    });

    expect(markup).toContain("No risk summary yet.");
    expect(markup).not.toContain("Top 3 Risk Cards");
    expect(markup).not.toContain("Next best actions");
  });

  it("renders Founder Brief risk and validation actions as first-class lists", () => {
    const markup = renderPlanningView({
      projections: {
        ...emptyProjectionState(),
        founderBrief: founderBriefProjection()
      }
    });

    expect(markup).toContain("Founder Brief risk actions");
    expect(markup).toContain("Founder Brief known risks");
    expect(markup).toContain("Founder Brief risk still needs an explicit owner.");
    expect(markup).toContain("Founder Brief next validation actions");
    expect(markup).toContain("Assign the Founder Brief risk to the next validation sprint.");
    expect(markup).toContain("Problem / Customer / Value");
  });

  it("keeps Founder Brief risk-action lists hidden when no direct risks or actions exist", () => {
    const founderBrief = founderBriefProjection();
    const markup = renderPlanningView({
      projections: {
        ...emptyProjectionState(),
        founderBrief: {
          ...founderBrief,
          knownRisks: [],
          nextValidationActions: []
        }
      }
    });

    expect(markup).toContain("Problem / Customer / Value");
    expect(markup).not.toContain("Founder Brief risk actions");
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
