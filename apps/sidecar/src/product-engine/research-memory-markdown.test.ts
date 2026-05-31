import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import type {
  DecisionEvidencePackId,
  DecisionEvidencePackProjection,
  EvidenceMatrixProjection,
  ProjectId,
  QueueItemId,
  ResearchResultProjection,
  ResearchResultId,
  ResearchTaskProjection,
  ResearchTaskId,
  SessionId
} from "@solo-superman/contracts";
import {
  buildResearchMemoryMarkdown,
  isResearchMemoryMarkdownSourceRef,
  listResearchMemoryMarkdownSourceRefs,
  researchMemoryMarkdownSourceRef,
  summarizeResearchMemoryMarkdown,
  writeResearchMemoryMarkdown
} from "./research-memory-markdown";
import { removeTemporaryDirectory } from "../test-cleanup";

const tempDirs: string[] = [];

async function tempRoot() {
  const root = await mkdtemp(join(tmpdir(), "solo-superman-research-memory-test-"));

  tempDirs.push(root);

  return root;
}

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map(removeTemporaryDirectory));
});

const task = {
  researchTaskId: "research_task_more_sources" as ResearchTaskProjection["researchTaskId"],
  sessionId: "sess_research_memory" as SessionId,
  sourceQueueItemId: "queue_more_research" as QueueItemId,
  objective: "Broaden research beyond existing notes for founder urgency",
  routeOutcome: "research_needed",
  impact: "high",
  status: "evidence_ready",
  createdAt: "2026-05-24T00:00:00.000Z"
} satisfies ResearchTaskProjection;

const proEvidenceItemId = "evidence_item_pro" as EvidenceMatrixProjection["proEvidence"][number]["evidenceItemId"];
const conEvidenceItemId = "evidence_item_con" as EvidenceMatrixProjection["conEvidence"][number]["evidenceItemId"];
const uncertaintyEvidenceItemId =
  "evidence_item_uncertainty" as EvidenceMatrixProjection["uncertainties"][number]["evidenceItemId"];

const result = {
  researchResultId: "research_result_public_sources" as ResearchResultProjection["researchResultId"],
  researchTaskId: task.researchTaskId,
  sourceTitle: "Founder urgency survey",
  sourceUrl: "https://example.com/founder-urgency",
  sourceReliability: "medium",
  sourceRetrievedAt: "2026-05-24T00:01:00.000Z",
  resultSummary: "Pro: multiple founders report repeated planning pain. Con: some teams already use docs.",
  limitationNotes: "Needs wider counter-evidence from non-founder teams.",
  implicationScope: "Use as planning evidence, not implementation authority.",
  importedAt: "2026-05-24T00:02:00.000Z"
} satisfies ResearchResultProjection;

const matrix = {
  evidenceMatrixId: "evidence_matrix_public_sources",
  researchTaskId: task.researchTaskId,
  researchResultId: result.researchResultId,
  synthesisVersion: 1,
  proEvidence: [
    {
      evidenceItemId: proEvidenceItemId,
      kind: "pro",
      summary: "Founders report urgency."
    }
  ],
  conEvidence: [
    {
      evidenceItemId: conEvidenceItemId,
      kind: "con",
      summary: "Some teams already solve this with docs."
    }
  ],
  uncertainties: [
    {
      evidenceItemId: uncertaintyEvidenceItemId,
      kind: "uncertainty",
      summary: "Sample size is unclear."
    }
  ],
  additionalQuestions: ["Which customer segment still needs more research?"],
  balanceStatus: "balanced",
  decisionBlocked: false
} satisfies EvidenceMatrixProjection;

const pack = {
  evidencePackId: "evidence_pack_public_sources" as DecisionEvidencePackProjection["evidencePackId"],
  researchTaskId: task.researchTaskId,
  researchResultId: result.researchResultId,
  claim: "Founders need safer planning evidence.",
  decisionContext: task.objective,
  sourceTitle: result.sourceTitle,
  sourceUrl: result.sourceUrl,
  sourceReliability: "medium",
  retrievedAt: result.sourceRetrievedAt,
  gateStatus: "accepted",
  gateChecks: [
    {
      code: "pro_con_balance",
      status: "passed",
      reason: "Both pro and con evidence are present."
    }
  ],
  proEvidenceItemIds: [proEvidenceItemId],
  conEvidenceItemIds: [conEvidenceItemId],
  uncertaintyItemIds: [uncertaintyEvidenceItemId],
  limitationRefs: ["sample-size"],
  implicationScope: "Use as planning evidence.",
  nextValidationAction: "Collect wider counter-evidence.",
  createdAt: "2026-05-24T00:03:00.000Z"
} satisfies DecisionEvidencePackProjection;

describe("research memory markdown", () => {
  it("summarizes evidence and explains when wider research should bypass duplicate-memory blocking", () => {
    const markdown = buildResearchMemoryMarkdown({ task, result, matrix, pack });
    const summary = summarizeResearchMemoryMarkdown(markdown);

    expect(markdown).toContain("# Research memory: Broaden research beyond existing notes for founder urgency");
    expect(markdown).toContain("Founders report urgency.");
    expect(markdown).toContain("Some teams already solve this with docs.");
    expect(markdown).toContain("Which customer segment still needs more research?");
    expect(markdown).toContain("If the user explicitly asks for more, broader, wider, or deeper research");
    expect(markdown).toContain("collect wider sources, counter-evidence, and updated signals");
    expect(summary).toContain("multiple founders report repeated planning pain");
    expect(summary).toContain("Founders report urgency.");
    expect(summary.length).toBeLessThanOrEqual(420);
  });

  it("writes memory under project and session folders with a stable markdown filename", async () => {
    const root = await tempRoot();
    const written = await writeResearchMemoryMarkdown({
      root,
      projectId: "proj_research_memory" as ProjectId,
      sessionId: task.sessionId,
      task,
      result,
      matrix,
      pack
    });

    expect(written.relativePath).toMatch(
      /^proj_research_memory\/sess_research_memory\/research_task_more_sources-research_result_public_sources-v1\.md$/
    );
    await expect(readFile(written.absolutePath, "utf8")).resolves.toContain("## Reuse guidance");
    await expect(readFile(join(root, "index.md"), "utf8")).resolves.toContain(
      `[${written.relativePath}](${written.relativePath})`
    );
  });

  it("keeps a deduplicated root index so future research can cite prior memories", async () => {
    const root = await tempRoot();
    const first = await writeResearchMemoryMarkdown({
      root,
      projectId: "proj_research_memory" as ProjectId,
      sessionId: task.sessionId,
      task,
      result,
      matrix,
      pack
    });
    const second = await writeResearchMemoryMarkdown({
      root,
      projectId: "proj_research_memory" as ProjectId,
      sessionId: task.sessionId,
      task: {
        ...task,
        researchTaskId: "research_task_market_risk" as ResearchTaskId,
        objective: "Validate market-risk counter evidence"
      },
      result: {
        ...result,
        researchResultId: "research_result_market_risk" as ResearchResultId,
        resultSummary: "Counter-evidence shows teams may already solve this with docs."
      },
      matrix: {
        ...matrix,
        evidenceMatrixId: "evidence_matrix_market_risk",
        researchTaskId: "research_task_market_risk" as ResearchTaskId,
        researchResultId: "research_result_market_risk" as ResearchResultId
      },
      pack: {
        ...pack,
        evidencePackId: "evidence_pack_market_risk" as DecisionEvidencePackId,
        researchTaskId: "research_task_market_risk" as ResearchTaskId,
        researchResultId: "research_result_market_risk" as ResearchResultId
      }
    });

    await writeResearchMemoryMarkdown({
      root,
      projectId: "proj_research_memory" as ProjectId,
      sessionId: task.sessionId,
      task,
      result,
      matrix,
      pack
    });

    const index = await readFile(join(root, "index.md"), "utf8");

    expect(index).toContain("Research memory index");
    expect(index).toContain("collect wider sources/counter-evidence");
    expect(index).toContain(`[${first.relativePath}](${first.relativePath})`);
    expect(index).toContain(`[${second.relativePath}](${second.relativePath})`);
    expect(index.split(/\r?\n/u).filter((line) => line.includes(first.relativePath))).toHaveLength(1);
  });

  it("lists scoped research-memory source refs for future wider research runs", async () => {
    const root = await tempRoot();
    const first = await writeResearchMemoryMarkdown({
      root,
      projectId: "proj_research_memory" as ProjectId,
      sessionId: task.sessionId,
      task,
      result,
      matrix,
      pack
    });
    await writeResearchMemoryMarkdown({
      root,
      projectId: "proj_other_research_memory" as ProjectId,
      sessionId: task.sessionId,
      task,
      result,
      matrix,
      pack
    });

    await expect(
      listResearchMemoryMarkdownSourceRefs({
        root,
        projectId: "proj_research_memory" as ProjectId,
        sessionId: task.sessionId
      })
    ).resolves.toEqual([researchMemoryMarkdownSourceRef(first.relativePath)]);
    expect(isResearchMemoryMarkdownSourceRef(researchMemoryMarkdownSourceRef(first.relativePath))).toBe(true);
    expect(isResearchMemoryMarkdownSourceRef("research-memory:founder@example.com")).toBe(false);
  });
});
