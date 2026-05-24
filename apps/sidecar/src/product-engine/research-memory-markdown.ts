import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type {
  DecisionEvidencePackProjection,
  EvidenceItemProjection,
  EvidenceMatrixProjection,
  ProjectId,
  ResearchResultProjection,
  ResearchTaskProjection,
  SessionId
} from "@solo-superman/contracts";

interface ResearchMemoryMarkdownInput {
  readonly task: ResearchTaskProjection;
  readonly result: ResearchResultProjection;
  readonly matrix: EvidenceMatrixProjection;
  readonly pack: DecisionEvidencePackProjection | undefined;
}

export interface WriteResearchMemoryMarkdownInput extends ResearchMemoryMarkdownInput {
  readonly root: string;
  readonly projectId: ProjectId;
  readonly sessionId: SessionId;
}

export interface WriteResearchMemoryMarkdownResult {
  readonly absolutePath: string;
  readonly relativePath: string;
}

function slugPart(value: string) {
  const normalized = value
    .trim()
    .replaceAll(/[^\p{Letter}\p{Number}_-]+/gu, "-")
    .replaceAll(/-+/g, "-")
    .replaceAll(/^-|-$/g, "")
    .slice(0, 96);

  return normalized || "untitled";
}

function markdownInline(value: string | undefined) {
  return value?.replaceAll("|", "\\|").replaceAll(/\s+/g, " ").trim() || "n/a";
}

function markdownBlock(value: string | undefined) {
  const normalized = value?.trim();

  return normalized ? normalized : "n/a";
}

function evidenceList(items: readonly EvidenceItemProjection[]) {
  if (!items.length) {
    return "- n/a";
  }

  return items.map((item) => `- ${item.summary}`).join("\n");
}

function gateChecks(pack: DecisionEvidencePackProjection | undefined) {
  if (!pack?.gateChecks.length) {
    return "- n/a";
  }

  return pack.gateChecks.map((check) => `- ${check.code}: ${check.status} — ${check.reason}`).join("\n");
}

function additionalQuestions(matrix: EvidenceMatrixProjection) {
  if (!matrix.additionalQuestions.length) {
    return "- n/a";
  }

  return matrix.additionalQuestions.map((question) => `- ${question}`).join("\n");
}

function sourceReference(result: ResearchResultProjection, pack: DecisionEvidencePackProjection | undefined) {
  return [
    result.sourceTitle ?? pack?.sourceTitle,
    result.sourceUrl ?? pack?.sourceUrl
  ].filter(Boolean).join(" — ") || result.researchResultId;
}

export function researchMemoryMarkdownFileName(input: ResearchMemoryMarkdownInput) {
  return [
    slugPart(input.task.researchTaskId),
    slugPart(input.result.researchResultId),
    `v${input.matrix.synthesisVersion}`
  ].join("-") + ".md";
}

export function buildResearchMemoryMarkdown(input: ResearchMemoryMarkdownInput) {
  const { task, result, matrix, pack } = input;
  const source = sourceReference(result, pack);
  const retrievedAt = result.sourceRetrievedAt ?? pack?.retrievedAt ?? result.importedAt;
  const reliability = result.sourceReliability ?? pack?.sourceReliability ?? "unknown";

  return [
    `# Research memory: ${task.objective}`,
    "",
    "## Metadata",
    "",
    `| Field | Value |`,
    `| --- | --- |`,
    `| Research task | ${markdownInline(task.researchTaskId)} |`,
    `| Research result | ${markdownInline(result.researchResultId)} |`,
    `| Evidence matrix | ${markdownInline(matrix.evidenceMatrixId)} |`,
    `| Evidence pack | ${markdownInline(pack?.evidencePackId)} |`,
    `| Session | ${markdownInline(task.sessionId)} |`,
    `| Objective | ${markdownInline(task.objective)} |`,
    `| Route / impact | ${markdownInline(`${task.routeOutcome} / ${task.impact}`)} |`,
    `| Balance status | ${markdownInline(matrix.balanceStatus)} |`,
    `| Gate status | ${markdownInline(pack?.gateStatus)} |`,
    `| Source | ${markdownInline(source)} |`,
    `| Source reliability | ${markdownInline(reliability)} |`,
    `| Retrieved/imported at | ${markdownInline(retrievedAt)} |`,
    "",
    "## Summary",
    "",
    markdownBlock(result.resultSummary),
    "",
    "## Evidence",
    "",
    "### Pro evidence",
    "",
    evidenceList(matrix.proEvidence),
    "",
    "### Con evidence",
    "",
    evidenceList(matrix.conEvidence),
    "",
    "### Uncertainties",
    "",
    evidenceList(matrix.uncertainties),
    "",
    "## Quality gates",
    "",
    gateChecks(pack),
    "",
    "## Additional questions",
    "",
    additionalQuestions(matrix),
    "",
    "## Limitations and implication scope",
    "",
    `- Limitations: ${markdownBlock(result.limitationNotes ?? pack?.limitationRefs.join(", "))}`,
    `- Implication scope: ${markdownBlock(result.implicationScope ?? pack?.implicationScope)}`,
    matrix.knownRisk ? `- Known risk: ${matrix.knownRisk}` : "- Known risk: n/a",
    pack?.nextValidationAction ? `- Next validation action: ${pack.nextValidationAction}` : "- Next validation action: n/a",
    "",
    "## Reuse guidance",
    "",
    "- Check this markdown memory before repeating the same research objective.",
    "- If this memo already resolves the question, cite it instead of starting duplicate research.",
    "- If the user explicitly asks for more, broader, wider, or deeper research, treat this memo as baseline context and collect wider sources, counter-evidence, and updated signals instead of blocking on existing notes.",
    ""
  ].join("\n");
}

export async function writeResearchMemoryMarkdown(input: WriteResearchMemoryMarkdownInput): Promise<WriteResearchMemoryMarkdownResult> {
  const projectSegment = slugPart(input.projectId);
  const sessionSegment = slugPart(input.sessionId);
  const fileName = researchMemoryMarkdownFileName(input);
  const relativePath = join(projectSegment, sessionSegment, fileName);
  const absolutePath = join(input.root, relativePath);

  await mkdir(join(input.root, projectSegment, sessionSegment), { recursive: true });
  await writeFile(absolutePath, buildResearchMemoryMarkdown(input), "utf8");

  return {
    absolutePath,
    relativePath
  };
}
