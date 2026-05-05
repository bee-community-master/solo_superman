import { describe, expect, it } from "vitest";
import type { ProjectionVersion, ProjectId, ResearchAllowlistId, ResearchConnectorId } from "../ids";
import {
  AUTOMATIC_RESEARCH_SOURCE_CATEGORIES,
  automaticRunStartPolicyForResearchAllowlist,
  DEFAULT_RESEARCH_DISCLOSURE_LOG_POLICY,
  DEFAULT_RESEARCH_RATE_BUDGET_POLICY,
  DEFAULT_RESEARCH_STALENESS_POLICY,
  MANUAL_RESEARCH_SOURCE_CATEGORIES,
  type ResearchAllowlistProjection,
  ResearchAllowlistValidationError,
  validateResearchAllowlistProjection
} from "./research-allowlist";

function allowlistFixture(overrides: Partial<ResearchAllowlistProjection> = {}): ResearchAllowlistProjection {
  return {
    kind: "ResearchAllowlistProjection",
    version: 1 as ProjectionVersion,
    allowlistId: "research_allowlist_contract" as ResearchAllowlistId,
    projectId: "proj_contract" as ProjectId,
    status: "active",
    connectorIds: ["public_search" as ResearchConnectorId],
    sourceCategories: ["public_web", "official_docs"],
    contextMode: "public_safe_summary",
    rateBudgetPolicy: DEFAULT_RESEARCH_RATE_BUDGET_POLICY,
    stalenessPolicy: DEFAULT_RESEARCH_STALENESS_POLICY,
    disclosureLogPolicy: DEFAULT_RESEARCH_DISCLOSURE_LOG_POLICY,
    approvedBy: "owner_contract",
    approvedAt: "2026-05-05T00:00:00.000Z",
    createdAt: "2026-05-05T00:00:00.000Z",
    updatedAt: "2026-05-05T00:00:00.000Z",
    ...overrides
  };
}

describe("ResearchAllowlist projection contract", () => {
  it("represents provider-neutral allowlist defaults and limits", () => {
    const allowlist = validateResearchAllowlistProjection(allowlistFixture());

    expect(allowlist).toMatchObject({
      kind: "ResearchAllowlistProjection",
      status: "active",
      connectorIds: ["public_search"],
      sourceCategories: ["public_web", "official_docs"],
      contextMode: "public_safe_summary",
      rateBudgetPolicy: {
        maxConcurrentRunsPerProject: 2,
        maxRunsPerSession: 12,
        maxAutomaticRetriesPerRun: 2,
        runTimeoutSeconds: 600,
        retryBackoffSeconds: [30, 120]
      },
      stalenessPolicy: {
        staleWhenRunExceedsTaskFreshnessWindow: true,
        staleWhenSourcePredatesTaskRequirement: true
      },
      disclosureLogPolicy: {
        logEveryAutomaticRun: true,
        publicSafeSummaryRequired: true
      }
    });
  });

  it("allows provider-neutral rate budget policy changes without adding provider fields", () => {
    const allowlist = validateResearchAllowlistProjection(
      allowlistFixture({
        rateBudgetPolicy: {
          ...DEFAULT_RESEARCH_RATE_BUDGET_POLICY,
          maxConcurrentRunsPerProject: 1,
          maxRunsPerSession: 6,
          runTimeoutSeconds: 300
        }
      })
    );

    expect(allowlist.rateBudgetPolicy).toMatchObject({
      maxConcurrentRunsPerProject: 1,
      maxRunsPerSession: 6,
      runTimeoutSeconds: 300
    });
  });

  it("rejects top-level provider-specific fields instead of silently dropping them", () => {
    expect(() =>
      validateResearchAllowlistProjection({
        ...allowlistFixture(),
        providerApiKey: "sk-secret"
      } as unknown as ResearchAllowlistProjection)
    ).toThrow("allowlist contains unsupported fields: providerApiKey");
  });

  it("requires a non-negative integer projection version", () => {
    for (const version of [-1, 1.5, Number.NaN, "1"]) {
      expect(() =>
        validateResearchAllowlistProjection(
          allowlistFixture({
            version: version as ProjectionVersion
          })
        )
      ).toThrow("version must be a non-negative integer");
    }
  });

  it("requires a per-session run budget and rejects malformed policy objects", () => {
    expect(() =>
      validateResearchAllowlistProjection(
        allowlistFixture({
          rateBudgetPolicy: {
            ...DEFAULT_RESEARCH_RATE_BUDGET_POLICY,
            maxRunsPerSession: 0
          }
        })
      )
    ).toThrow("maxRunsPerSession");

    expect(() =>
      validateResearchAllowlistProjection(
        allowlistFixture({
          rateBudgetPolicy: null as unknown as ResearchAllowlistProjection["rateBudgetPolicy"]
        })
      )
    ).toThrow("rateBudgetPolicy must be a JSON object");

    expect(() =>
      validateResearchAllowlistProjection(
        allowlistFixture({
          rateBudgetPolicy: {
            ...DEFAULT_RESEARCH_RATE_BUDGET_POLICY,
            maxConcurrentRunsPerProject: 3,
            maxRunsPerSession: 2
          }
        })
      )
    ).toThrow("greater than or equal to maxConcurrentRunsPerProject");
  });

  it("rejects malformed string and array fields with contract validation errors", () => {
    expect(() =>
      validateResearchAllowlistProjection(
        allowlistFixture({
          approvedBy: null as unknown as string
        })
      )
    ).toThrow("approvedBy must be a non-empty string");

    expect(() =>
      validateResearchAllowlistProjection(
        allowlistFixture({
          connectorIds: null as unknown as ResearchAllowlistProjection["connectorIds"]
        })
      )
    ).toThrow("connectorIds must not be empty");
  });

  it("rejects date-only or calendar-invalid strings where lifecycle fields require ISO timestamps", () => {
    expect(() =>
      validateResearchAllowlistProjection(
        allowlistFixture({
          approvedAt: "2026-05-05"
        })
      )
    ).toThrow("approvedAt must be an ISO timestamp");

    expect(() =>
      validateResearchAllowlistProjection(
        allowlistFixture({
          approvedAt: "2026-02-31T00:00:00.000Z"
        })
      )
    ).toThrow("approvedAt must be an ISO timestamp");
  });

  it("keeps retry budget and backoff schedule in sync", () => {
    expect(() =>
      validateResearchAllowlistProjection(
        allowlistFixture({
          rateBudgetPolicy: {
            ...DEFAULT_RESEARCH_RATE_BUDGET_POLICY,
            maxAutomaticRetriesPerRun: 1
          }
        })
      )
    ).toThrow("retryBackoffSeconds length");
  });

  it("rejects source categories that require task-level approval or a later phase", () => {
    for (const blockedCategory of MANUAL_RESEARCH_SOURCE_CATEGORIES) {
      expect(() =>
        validateResearchAllowlistProjection(
          allowlistFixture({
            sourceCategories: [blockedCategory] as unknown as ResearchAllowlistProjection["sourceCategories"]
          })
        )
      ).toThrow(ResearchAllowlistValidationError);
    }
  });

  it("accepts every automatic source category declared by the contract", () => {
    const allowlist = validateResearchAllowlistProjection(
      allowlistFixture({
        sourceCategories: AUTOMATIC_RESEARCH_SOURCE_CATEGORIES
      })
    );

    expect(allowlist.sourceCategories).toEqual([
      "public_web",
      "official_docs",
      "public_dataset",
      "academic_source",
      "user_provided_public_url"
    ]);
  });

  it("rejects mixed automatic and manual source category lists", () => {
    expect(() =>
      validateResearchAllowlistProjection(
        allowlistFixture({
          sourceCategories: ["public_web", "credentialed_source"] as unknown as ResearchAllowlistProjection["sourceCategories"]
        })
      )
    ).toThrow(ResearchAllowlistValidationError);
  });

  it("rejects non-public-safe context modes at the contract boundary", () => {
    expect(() =>
      validateResearchAllowlistProjection(
        allowlistFixture({
          contextMode: "raw_context" as ResearchAllowlistProjection["contextMode"]
        })
      )
    ).toThrow("public_safe_summary");
  });

  it("requires paused/revoked allowlists to carry lifecycle timestamps", () => {
    expect(() => validateResearchAllowlistProjection(allowlistFixture({ status: "paused" }))).toThrow("pausedAt");
    expect(() => validateResearchAllowlistProjection(allowlistFixture({ status: "revoked" }))).toThrow("revokedAt");

    expect(
      validateResearchAllowlistProjection(
        allowlistFixture({
          status: "paused",
          pausedAt: "2026-05-05T00:01:00.000Z"
        })
      ).status
    ).toBe("paused");
  });

  it("makes paused and revoked allowlists explicit automatic-run blockers", () => {
    expect(automaticRunStartPolicyForResearchAllowlist(allowlistFixture())).toMatchObject({
      allowed: true,
      reason: "active_public_safe_allowlist"
    });

    expect(
      automaticRunStartPolicyForResearchAllowlist(
        allowlistFixture({
          status: "paused",
          pausedAt: "2026-05-05T00:01:00.000Z"
        })
      )
    ).toMatchObject({
      allowed: false,
      blockedByStatus: "paused",
      reason: "allowlist_paused"
    });

    expect(
      automaticRunStartPolicyForResearchAllowlist(
        allowlistFixture({
          status: "revoked",
          revokedAt: "2026-05-05T00:02:00.000Z"
        })
      )
    ).toMatchObject({
      allowed: false,
      blockedByStatus: "revoked",
      reason: "allowlist_revoked"
    });
  });

  it("rejects stale lifecycle timestamps that conflict with the current status", () => {
    expect(() =>
      validateResearchAllowlistProjection(
        allowlistFixture({
          status: "active",
          pausedAt: "2026-05-05T00:01:00.000Z"
        })
      )
    ).toThrow("active allowlists must not carry pausedAt or revokedAt");

    expect(() =>
      validateResearchAllowlistProjection(
        allowlistFixture({
          status: "paused",
          pausedAt: "2026-05-05T00:01:00.000Z",
          revokedAt: "2026-05-05T00:02:00.000Z"
        })
      )
    ).toThrow("paused allowlists must not carry revokedAt");

    expect(() =>
      validateResearchAllowlistProjection(
        allowlistFixture({
          status: "revoked",
          pausedAt: "2026-05-05T00:01:00.000Z",
          revokedAt: "2026-05-05T00:02:00.000Z"
        })
      )
    ).toThrow("revoked allowlists must not carry pausedAt");
  });

  it("rejects unsupported lifecycle status values at runtime", () => {
    expect(() =>
      validateResearchAllowlistProjection(
        allowlistFixture({
          status: "archived" as ResearchAllowlistProjection["status"]
        })
      )
    ).toThrow("active, paused, or revoked");
  });

  it("rejects connector ids that look like credentials or raw secret values", () => {
    expect(() =>
      validateResearchAllowlistProjection(
        allowlistFixture({
          connectorIds: ["sk-secret-api-key" as ResearchConnectorId]
        })
      )
    ).toThrow("secret");

    expect(() =>
      validateResearchAllowlistProjection(
        allowlistFixture({
          connectorIds: ["public_api_key" as ResearchConnectorId]
        })
      )
    ).toThrow("secret");
  });

  it("rejects connector ids outside the approved read-only registry", () => {
    expect(() =>
      validateResearchAllowlistProjection(
        allowlistFixture({
          connectorIds: ["unknown_connector" as ResearchConnectorId]
        })
      )
    ).toThrow("approved read-only connector");
  });
});
