import { describe, expect, it, vi } from "vitest";
import {
  AUTO_IMPLEMENTATION_RUN_READY_FIXTURE,
  type CodexRuntimeStatusDto,
  type StatusEndpointDto
} from "@solo-superman/contracts";
import {
  autoImplementationRunViewModel
} from "../AutoImplementationRunPanel";
import { implementationStepLedgerViewModel } from "../ImplementationStepLedgerPanel";
import {
  pendingEffectSummary,
  runtimeActivityProjectionFromStatuses
} from "../decision-queue-view-model";
import { renderEnglishMarkup } from "../test-rendering";
import { ImplementationView } from "./ImplementationView";
import { emptyProjectionState } from "./decision-queue-shell-model";
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

function renderImplementationView(controllerOverrides: Partial<DecisionQueueShellController> = {}) {
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
    runAutoImplementationWorkerJob: vi.fn(),
    runtimeActivity: runtimeActivityProjectionFromStatuses(statuses),
    runtimeStatus: null,
    statuses,
    workerLedgerImportDraft: "",
    setWorkerLedgerImportDraft: vi.fn(),
    ...controllerOverrides
  } satisfies Partial<DecisionQueueShellController>;

  return renderEnglishMarkup(<ImplementationView controller={controller as DecisionQueueShellController} />);
}

describe("ImplementationView", () => {
  it("provides a dedicated runtime status refresh action in the implementation runtime panel", () => {
    const markup = renderImplementationView({
      runtimeStatus: codexRuntimeStatus()
    });

    expect(markup).toContain("Execution records");
    expect(markup).toContain('<button type="button">Refresh runtime status</button>');
    expect(markup).toContain("Tool unavailable. No background tasks are pending.");
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

    expect(markup).toContain("Worker runtime readiness");
    expect(markup).toContain("Runtime status");
    expect(markup).toContain("available");
    expect(markup).toContain("Execution mode");
    expect(markup).toContain("live");
    expect(markup).toContain("Live turns");
    expect(markup).toContain("enabled");
    expect(markup).toContain("Tool available. No background tasks are pending.");
  });
});
