import { describe, expect, it, vi } from "vitest";
import {
  AUTO_IMPLEMENTATION_RUN_READY_FIXTURE,
  type ConfidenceCompletionProjection,
  type CodexRuntimeStatusDto,
  type ProjectionVersion,
  type SessionId,
  type StatusEndpointDto
} from "@solo-superman/contracts";
import { autoImplementationRunViewModel } from "../AutoImplementationRunPanel";
import { implementationStepLedgerViewModel } from "../ImplementationStepLedgerPanel";
import {
  pendingEffectSummary,
  planningHandoffViewModel,
  runtimeActivityProjectionFromStatuses
} from "../decision-queue-view-model";
import { renderMarkup } from "../test-rendering";
import { ImplementationView } from "./ImplementationView";
import { emptyProjectionState } from "./decision-queue-shell-model";
import type { AppLanguage } from "../../../shared/i18n/app-language";
import type { DecisionQueueShellController } from "./useDecisionQueueShellController";

function codexRuntimeStatus(overrides: Partial<CodexRuntimeStatusDto> = {}): CodexRuntimeStatusDto {
  return {
    status: "unavailable",
    adapterVersion: "codex-app-server-preview-v1",
    generatedSchemaVersion: "codex-cli-0.128.0",
    transport: "stdio",
    checkedAt: "2026-05-23T00:00:00.000Z",
    manualHandoffAvailable: true,
    liveTurnExecutionEnabled: false,
    executionMode: "manual_handoff",
    account: {
      status: "authenticated",
      loginCommand: "codex auth login",
      loginStatusCommand: "codex login status",
      accountType: "chatgpt",
      planType: "plus"
    },
    ...overrides
  };
}

function renderImplementationView(
  controllerOverrides: Partial<DecisionQueueShellController> = {},
  language: AppLanguage = "en"
) {
  const statuses: readonly StatusEndpointDto[] = [];
  const controller = {
    commandLog: [],
    autoImplementationRunView: autoImplementationRunViewModel(null),
    advanceAutoImplementationWorkerStage: vi.fn(),
    blockAutoImplementationStage: vi.fn(),
    canCreateAutoImplementationRun: false,
    completeAutoImplementationWorkerJobFromLedger: vi.fn(),
    createAutoImplementationRun: vi.fn(),
    implementationStepLedgerView: implementationStepLedgerViewModel(null),
    importAutoImplementationWorkerLedgerFromDraft: vi.fn(),
    isBusy: false,
    pendingSummary: pendingEffectSummary(statuses),
    pauseAutoImplementationStage: vi.fn(),
    planningHandoffView: planningHandoffViewModel(null),
    prepareFounderBrief: vi.fn(),
    planAutoImplementationWorkerJob: vi.fn(),
    recordAutoImplementationStageTick: vi.fn(),
    startAutoImplementationStage: vi.fn(),
    recordAutoImplementationGitHubIssueDryRun: vi.fn(),
    applyAutoImplementationGitHubIssueCreation: vi.fn(),
    applyAutoImplementationPullRequestOpen: vi.fn(),
    applyAutoImplementationPullRequestBodyUpdate: vi.fn(),
    applyAutoImplementationPullRequestMerge: vi.fn(),
    projections: emptyProjectionState(),
    recordAutoImplementationPullRequestOpenDryRun: vi.fn(),
    recordAutoImplementationPullRequestDryRun: vi.fn(),
    recordAutoImplementationPullRequestMergeDryRun: vi.fn(),
    refreshCommandStatus: vi.fn(),
    refreshRuntimeStatus: vi.fn(),
    refreshAutoImplementationRuns: vi.fn(),
    refreshImplementationStepLedger: vi.fn(),
    runPlanningHandoffGate: vi.fn(),
    runAutoImplementationWorkerJob: vi.fn(),
    runtimeActivity: runtimeActivityProjectionFromStatuses(statuses),
    runtimeStatus: null,
    scoreCompleteness: vi.fn(),
    statuses,
    workerLedgerImportDraft: "",
    setWorkerLedgerImportDraft: vi.fn(),
    ...controllerOverrides
  } satisfies Partial<DecisionQueueShellController>;

  return renderMarkup(<ImplementationView controller={controller as DecisionQueueShellController} />, language);
}

function confidenceFixture(): ConfidenceCompletionProjection {
  return {
    kind: "ConfidenceCompletionProjection",
    sessionId: "sess_implementation_readiness" as SessionId,
    version: 9 as ProjectionVersion,
    compositeScore: 82,
    readinessLabel: "spec_ready",
    axes: [],
    scoreBreakdown: {
      sectionCompleteness: 90,
      questionDebtResolution: 75,
      evidenceQuality: 80,
      decisionApproval: 85,
      consistencyAndConflict: 78
    },
    gates: [],
    topRisks: ["One gate still needs explicit owner."],
    topRiskCards: [],
    nextBestActions: ["Close the remaining gate before creating a workspace."],
    completionCandidate: {
      status: "not_ready",
      summary: "One gate remains before implementation.",
      gateFailures: ["Evidence owner missing."],
      ifStopNowArtifact: {
        title: "If stop now",
        summary: "Carry the remaining gate as an explicit risk.",
        knownRisks: ["Evidence owner missing."],
        nextValidationActions: ["Assign evidence owner."]
      }
    }
  };
}

describe("ImplementationView", () => {
  it("shows the implementation start path before workspace creation", () => {
    const markup = renderImplementationView();

    expect(markup).toContain("Implementation start path");
    expect(markup).toContain("Next implementation action");
    expect(markup).toContain("Start a session from the idea intake.");
    expect(markup).toContain("Active session");
    expect(markup).toContain("Completion source");
    expect(markup).toContain("Planning handoff");
    expect(markup).toContain("Workspace run");
    expect(markup).toContain('<button type="button" disabled="">Score completeness</button>');
    expect(markup).toContain('<button type="button" disabled="">Prepare Founder Brief</button>');
    expect(markup).toContain('<button type="button" disabled="">Run planning handoff check</button>');
  });

  it("localizes implementation handoff labels for Korean users", () => {
    const markup = renderImplementationView({}, "ko");

    expect(markup).toContain("구현 시작 경로");
    expect(markup).toContain("구현 계획 전달");
    expect(markup).toContain("자동 구현 작업공간 생성");
    expect(markup).not.toContain("Planning handoff");
    expect(markup).not.toContain("PR-sized");
    expect(markup).not.toContain("bounded worker job");
  });

  it("shows implementation readiness metrics beside the start gate", () => {
    const markup = renderImplementationView({
      confidence: confidenceFixture()
    });

    expect(markup).toContain("Implementation readiness metrics");
    expect(markup).toContain("Composite readiness");
    expect(markup).toContain("82% · spec_ready");
    expect(markup).toContain("Gate blockers");
    expect(markup).toContain("<dd>1</dd>");
    expect(markup).toContain("Concrete metrics");
    expect(markup).toContain("5/5 metric(s) at 75% or higher");
    expect(markup).toContain("Remaining implementation gate blockers");
    expect(markup).toContain("Evidence owner missing.");
    expect(markup).toContain("Spec sections");
    expect(markup).toContain("90%");
    expect(markup).toContain("Question debt");
    expect(markup).toContain("75%");
    expect(markup).toContain("Evidence quality");
    expect(markup).toContain("80%");
    expect(markup).toContain("Decision approval");
    expect(markup).toContain("85%");
    expect(markup).toContain("Consistency");
    expect(markup).toContain("78%");
  });


  it("shows general release blockers and release-lab bundle commands", () => {
    const markup = renderImplementationView();

    expect(markup).toContain("General release evidence blockers");
    expect(markup).toContain("blocked by external evidence");
    expect(markup).toContain("GitHub issue #259");
    expect(markup).toContain("Windows real-device installer proof");
    expect(markup).toContain("GitHub issue #266");
    expect(markup).toContain("Signed package release proof");
    expect(markup).toContain("GitHub issue #267");
    expect(markup).toContain("Packaged updater rollback proof");
    expect(markup).toContain("pnpm release:evidence-bundle -- ./solo-superman-release-evidence-bundle");
    expect(markup).toContain("pnpm verify:release-evidence-bundle -- --bundle-dir ./solo-superman-release-evidence-bundle --require-ready");
    expect(markup).toContain("pnpm verify:ready-release -- --evidence-bundle-dir ./solo-superman-release-evidence-bundle");
    expect(markup).toContain("Do not mark broad/general release ready from local dry-runs alone.");
  });

  it("localizes general release blockers for Korean users", () => {
    const markup = renderImplementationView({}, "ko");

    expect(markup).toContain("일반 공개 증거 차단 항목");
    expect(markup).toContain("외부 증거 대기");
    expect(markup).toContain("Windows 실기기 설치 증거");
    expect(markup).toContain("서명된 패키지 릴리스 증거");
    expect(markup).toContain("패키지 업데이트 rollback 증거");
    expect(markup).toContain("로컬 dry-run만으로 broad/general release를 ready로 표시하지 않습니다.");
    expect(markup).not.toContain("General release evidence blockers");
  });

  it("provides a dedicated runtime status refresh action in the implementation runtime panel", () => {
    const markup = renderImplementationView({
      runtimeStatus: codexRuntimeStatus()
    });

    expect(markup).toContain("Execution records");
    expect(markup).toContain('<button type="button">Refresh runtime status</button>');
    expect(markup).toContain("Tool unavailable. No background tasks are pending.");
    expect(markup).toContain('aria-label="Runtime evidence details"');
    expect(markup).toContain("Runtime checked at");
    expect(markup).toContain("2026-05-23T00:00:00.000Z");
    expect(markup).toContain("Runtime adapter");
    expect(markup).toContain("codex-app-server-preview-v1");
    expect(markup).toContain("Generated schema version");
    expect(markup).toContain("codex-cli-0.128.0");
    expect(markup).toContain("Transport");
    expect(markup).toContain("stdio");
    expect(markup).toContain("Execution mode");
    expect(markup).toContain("manual handoff");
    expect(markup).not.toContain("manual_handoff");
    expect(markup).toContain("Codex account");
    expect(markup).toContain("authenticated (ChatGPT / plus)");
    expect(markup).toContain("Live turns");
    expect(markup).toContain("disabled");
    expect(markup).toContain("Manual fallback path");
    expect(markup).toContain("available");
  });

  it("disables the runtime status refresh action while another local action is running", () => {
    const markup = renderImplementationView({
      isBusy: true,
      runtimeStatus: codexRuntimeStatus()
    });

    expect(markup).toContain('<button type="button" disabled="">Refresh runtime status</button>');
  });

  it("keeps worker runtime readiness visible beside the refreshed runtime status", () => {
    const runtimeStatus = codexRuntimeStatus({
      status: "available",
      liveTurnExecutionEnabled: true,
      executionMode: "live",
      reason: "Live Codex app-server turn execution is enabled for preview-only artifacts."
    });
    const markup = renderImplementationView({
      autoImplementationRunView: autoImplementationRunViewModel(
        AUTO_IMPLEMENTATION_RUN_READY_FIXTURE,
        null,
        runtimeStatus
      ),
      runtimeStatus
    });

    expect(markup).toContain("Local Codex runtime readiness");
    expect(markup).toContain("Codex runtime status");
    expect(markup).toContain("available");
    expect(markup).toContain("Checked at");
    expect(markup).toContain("2026-05-23T00:00:00.000Z");
    expect(markup).toContain("Codex runtime adapter");
    expect(markup).toContain("codex-app-server-preview-v1");
    expect(markup).toContain("Generated schema version");
    expect(markup).toContain("codex-cli-0.128.0");
    expect(markup).toContain("Connection transport");
    expect(markup).toContain("stdio");
    expect(markup).toContain("Execution mode");
    expect(markup).toContain("live Codex execution");
    expect(markup).toContain("Codex account");
    expect(markup).toContain("authenticated (ChatGPT / plus)");
    expect(markup).toContain("Automatic runs");
    expect(markup).toContain("enabled");
    expect(markup).toContain("Manual fallback path");
    expect(markup).toContain("available");
    expect(markup).toContain("Tool available. No background tasks are pending.");
  });
});
