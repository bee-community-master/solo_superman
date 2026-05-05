import { describe, expect, it } from "vitest";
import type {
  ProjectId,
  ResearchAllowlistId,
  ResearchConnectorId,
  ResearchDisclosureLogId
} from "../ids";
import {
  type ResearchDisclosureLogEntry,
  ResearchDisclosureLogValidationError,
  validateResearchDisclosureLogEntry
} from "./research-disclosure-log";

type DisclosureLogFixtureOverrides = Partial<Omit<ResearchDisclosureLogEntry, "allowlistId">> & {
  readonly allowlistId?: ResearchAllowlistId | undefined;
};

function disclosureLogFixture(overrides: DisclosureLogFixtureOverrides = {}): ResearchDisclosureLogEntry {
  const entry = {
    logId: "research_disclosure_contract" as ResearchDisclosureLogId,
    projectId: "proj_disclosure_contract" as ProjectId,
    allowlistId: "research_allowlist_contract" as ResearchAllowlistId,
    connectorId: "public_search" as ResearchConnectorId,
    sourceCategory: "public_web",
    researchObjective: "Find public competitor onboarding proof.",
    objectiveSummary: "Find public competitor onboarding proof.",
    publicSafeSummarySent:
      "Product category: founder workflow assistant. Customer/problem hypothesis: founders need safer validation research. Research objective: Find public competitor onboarding proof.",
    sourceRefs: ["queue_item_1"],
    automaticExternalTransferAllowed: true,
    status: "automatic_payload_ready",
    createdAt: "2026-05-05T00:00:00.000Z",
    ...overrides
  } as Record<string, unknown>;

  for (const key of ["allowlistId", "blockReason", "manualHandoffReason"]) {
    if (entry[key] === undefined) {
      delete entry[key];
    }
  }

  return entry as unknown as ResearchDisclosureLogEntry;
}

describe("ResearchDisclosureLog projection contract", () => {
  it("validates automatic disclosure logs with allowlist and public-safe payload trace", () => {
    expect(validateResearchDisclosureLogEntry(disclosureLogFixture())).toMatchObject({
      status: "automatic_payload_ready",
      allowlistId: "research_allowlist_contract",
      automaticExternalTransferAllowed: true,
      publicSafeSummarySent: expect.stringContaining("Research objective")
    });
  });

  it("validates blocked manual-handoff logs without allowing automatic transfer", () => {
    expect(
      validateResearchDisclosureLogEntry(
        disclosureLogFixture({
          allowlistId: undefined,
          sourceCategory: "credentialed_source",
          automaticExternalTransferAllowed: false,
          status: "blocked_manual_handoff",
          blockReason: "manual_source_category",
          manualHandoffReason: "credentialed_source requires task-level approval or manual handoff."
        })
      )
    ).toMatchObject({
      status: "blocked_manual_handoff",
      blockReason: "manual_source_category",
      automaticExternalTransferAllowed: false
    });
  });

  it("rejects status/transfer mismatches and unsupported fields", () => {
    expect(() =>
      validateResearchDisclosureLogEntry({
        ...disclosureLogFixture(),
        automaticExternalTransferAllowed: false
      })
    ).toThrow("automaticExternalTransferAllowed");

    expect(() =>
      validateResearchDisclosureLogEntry({
        ...disclosureLogFixture(),
        providerPayload: "raw provider request"
      } as unknown as ResearchDisclosureLogEntry)
    ).toThrow(ResearchDisclosureLogValidationError);
  });

  it("rejects automatic disclosure logs that carry blocker fields even when they are empty", () => {
    expect(() =>
      validateResearchDisclosureLogEntry({
        ...disclosureLogFixture(),
        blockReason: ""
      } as unknown as ResearchDisclosureLogEntry)
    ).toThrow("automatic disclosure logs");

    expect(() =>
      validateResearchDisclosureLogEntry({
        ...disclosureLogFixture(),
        manualHandoffReason: ""
      } as unknown as ResearchDisclosureLogEntry)
    ).toThrow("automatic disclosure logs");
  });

  it("rejects unsafe connector ids and unsupported source categories at the log boundary", () => {
    expect(() =>
      validateResearchDisclosureLogEntry(
        disclosureLogFixture({
          connectorId: "sk-secret-token" as ResearchConnectorId
        })
      )
    ).toThrow("connectorId");

    expect(() =>
      validateResearchDisclosureLogEntry(
        disclosureLogFixture({
          connectorId: "unapproved_connector" as ResearchConnectorId
        })
      )
    ).toThrow("connectorId");

    expect(() =>
      validateResearchDisclosureLogEntry(
        disclosureLogFixture({
          sourceCategory: "private_slack" as never
        })
      )
    ).toThrow("sourceCategory");
  });

  it("requires blocked disclosures to carry a canonical blocker and handoff reason", () => {
    expect(() =>
      validateResearchDisclosureLogEntry(
        disclosureLogFixture({
          allowlistId: undefined,
          automaticExternalTransferAllowed: false,
          status: "blocked_manual_handoff"
        })
      )
    ).toThrow("blockReason");

    expect(() =>
      validateResearchDisclosureLogEntry(
        disclosureLogFixture({
          allowlistId: undefined,
          automaticExternalTransferAllowed: false,
          status: "blocked_manual_handoff",
          blockReason: "private_payload" as never,
          manualHandoffReason: "Manual handoff required."
        })
      )
    ).toThrow("canonical");
  });

  it("requires automatic disclosure logs to retain an allowlist id", () => {
    expect(() =>
      validateResearchDisclosureLogEntry(
        disclosureLogFixture({
          allowlistId: undefined
        })
      )
    ).toThrow("allowlistId");
  });
});
