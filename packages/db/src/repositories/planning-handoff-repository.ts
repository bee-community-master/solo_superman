import { createHash } from "node:crypto";
import { and, desc, eq } from "drizzle-orm";
import type {
  CommandId,
  EventId,
  PlanningHandoffArtifactDto,
  PlanningHandoffBlockerArtifactDto,
  PlanningHandoffBlockerDto,
  PlanningHandoffOwnerRole,
  PlanningHandoffProjection,
  PlanningHandoffRequiredUserAction,
  PlanningHandoffResidualRiskDto,
  PlanningHandoffSourceRefDto,
  ProjectionVersion,
  ProjectId,
  SchemaVersion,
  SessionId,
  StateVersion
} from "@solo-superman/contracts";
import type { SoloDatabaseExecutor } from "../client";
import { parseJsonRecord, stringifyJson } from "../json";
import {
  planningHandoffPrIssueItems,
  planningHandoffRisks,
  planningHandoffs,
  planningHandoffSources,
  planningHandoffTasks
} from "../schema";

type PlanningHandoffArtifact = PlanningHandoffArtifactDto | PlanningHandoffBlockerArtifactDto;
type PlanningHandoffRiskRow = typeof planningHandoffRisks.$inferInsert;
type ResidualRiskDetail = Readonly<{
  idSegment: string;
  riskKind: "assumption" | "prerequisite" | "validation_dependency";
  title: string;
}>;

export interface SavePlanningHandoffProjectionInput {
  readonly projectId: ProjectId;
  readonly sessionId: SessionId;
  readonly sourceCommandId: CommandId;
  readonly sourceEventId: EventId;
  readonly sourceStateVersion: StateVersion;
  readonly projection: PlanningHandoffProjection;
}

function shortHash(value: string) {
  return createHash("sha256").update(value).digest("hex").slice(0, 32);
}

function rowId(prefix: string, handoffId: string, value: string) {
  return `${prefix}_${shortHash(`${handoffId}:${value}`)}`;
}

function artifactFromProjection(projection: PlanningHandoffProjection): PlanningHandoffArtifact {
  return projection.currentStatus === "planning_ready" ? projection.finalArtifact : projection.blockerArtifact;
}

function assertPlanningHandoffId(artifactId: string) {
  if (!artifactId.startsWith("handoff_")) {
    throw new Error(`Planning Handoff artifact id must use the handoff_ prefix: ${artifactId}`);
  }
}

function projectionFromRow(row: typeof planningHandoffs.$inferSelect): PlanningHandoffProjection {
  const artifact = parseJsonRecord<PlanningHandoffArtifact>(
    row.artifactJson,
    "planning_handoffs.artifact_json"
  );
  const base = {
    kind: "PlanningHandoffProjection" as const,
    sessionId: row.sessionId as SessionId,
    version: (row.sourceStateVersion + 1) as ProjectionVersion,
    sourceRefs: artifact.sourceRefs,
    summary: row.summary,
    refetchUrl: `/api/v1/sessions/${row.sessionId}/planning-handoff`
  };

  if (artifact.kind === "PlanningHandoffArtifact") {
    return {
      ...base,
      currentStatus: "planning_ready",
      finalArtifact: artifact
    };
  }

  return {
    ...base,
    currentStatus: artifact.status,
    blockerArtifact: artifact
  };
}

function sourceRowsFor(handoffId: string, sourceRefs: readonly PlanningHandoffSourceRefDto[], createdAt: string) {
  return sourceRefs.map((sourceRef) => ({
    id: rowId("handoff_src", handoffId, `${sourceRef.sourceType}:${sourceRef.sourceId}`),
    handoffId,
    sourceType: sourceRef.sourceType,
    sourceId: sourceRef.sourceId,
    sourceLabel: sourceRef.sourceLabel ?? null,
    required: sourceRef.required,
    stale: sourceRef.stale,
    createdAt
  }));
}

function residualRiskRow(handoffId: string, risk: PlanningHandoffResidualRiskDto): PlanningHandoffRiskRow {
  return {
    id: rowId("handoff_risk", handoffId, `residual:${risk.riskId}`),
    handoffId,
    riskKind: "residual_risk",
    riskClass: risk.riskClass,
    severity: risk.severity,
    title: risk.title,
    sourceRefsJson: stringifyJson(risk.sourceRefs),
    ownerRole: risk.ownerRole,
    followUpTrigger: risk.followUpTrigger,
    requiredAction: null
  };
}

function residualRiskDetailRow(
  handoffId: string,
  risk: PlanningHandoffResidualRiskDto,
  detail: ResidualRiskDetail
): PlanningHandoffRiskRow {
  return {
    id: rowId("handoff_risk", handoffId, `${detail.idSegment}:${risk.riskId}`),
    handoffId,
    riskKind: detail.riskKind,
    riskClass: risk.riskClass,
    severity: risk.severity,
    title: detail.title,
    sourceRefsJson: stringifyJson(risk.sourceRefs),
    ownerRole: risk.ownerRole,
    followUpTrigger: risk.followUpTrigger,
    requiredAction: null
  };
}

function residualRiskDetails(risk: PlanningHandoffResidualRiskDto): readonly ResidualRiskDetail[] {
  return [
    { idSegment: "assumption", riskKind: "assumption", title: risk.assumption },
    { idSegment: "prerequisite", riskKind: "prerequisite", title: risk.prerequisite },
    {
      idSegment: "validation-dependency",
      riskKind: "validation_dependency",
      title: risk.validationDependency
    }
  ];
}

function residualRiskDetailRows(handoffId: string, risk: PlanningHandoffResidualRiskDto): PlanningHandoffRiskRow[] {
  return residualRiskDetails(risk).map((detail) => residualRiskDetailRow(handoffId, risk, detail));
}

function residualRiskRows(handoffId: string, risk: PlanningHandoffResidualRiskDto): PlanningHandoffRiskRow[] {
  return [residualRiskRow(handoffId, risk), ...residualRiskDetailRows(handoffId, risk)];
}

function blockerRiskRow(handoffId: string, blocker: PlanningHandoffBlockerDto): PlanningHandoffRiskRow {
  return {
    id: rowId("handoff_risk", handoffId, `blocker:${blocker.blockerId}`),
    handoffId,
    riskKind: "blocker_next_action",
    riskClass: blocker.blockerClass,
    severity: "high",
    title: blocker.whyFatal,
    sourceRefsJson: stringifyJson(blocker.sourceRefs),
    ownerRole: "product",
    followUpTrigger: "Before retrying the Planning Handoff gate.",
    requiredAction: blocker.requiredNextAction
  };
}

function requiredActionRiskRow(
  handoffId: string,
  requiredAction: PlanningHandoffRequiredUserAction,
  sourceRefs: readonly PlanningHandoffSourceRefDto[],
  index: number,
  ownerRole: PlanningHandoffOwnerRole = "product"
): PlanningHandoffRiskRow {
  return {
    id: rowId("handoff_risk", handoffId, `required-action:${index}:${requiredAction}`),
    handoffId,
    riskKind: "required_user_action",
    riskClass: "required_user_action",
    severity: "medium",
    title: `Required user action: ${requiredAction}`,
    sourceRefsJson: stringifyJson(sourceRefs),
    ownerRole,
    followUpTrigger: "Before retrying the Planning Handoff gate.",
    requiredAction
  };
}

function riskRowsFor(handoffId: string, artifact: PlanningHandoffArtifact): PlanningHandoffRiskRow[] {
  const residualRisks =
    artifact.kind === "PlanningHandoffArtifact" ? artifact.residualRiskRegister : artifact.residualRisks;
  const riskRows: PlanningHandoffRiskRow[] = residualRisks.flatMap((risk) => residualRiskRows(handoffId, risk));

  if (artifact.kind === "PlanningHandoffBlockerArtifact") {
    riskRows.push(...artifact.blockers.map((blocker) => blockerRiskRow(handoffId, blocker)));
    riskRows.push(
      ...artifact.requiredUserActions.map((requiredAction, index) =>
        requiredActionRiskRow(handoffId, requiredAction, artifact.sourceRefs, index)
      )
    );
  }

  return riskRows;
}

export function createPlanningHandoffRepository(db: SoloDatabaseExecutor) {
  async function saveRows(input: SavePlanningHandoffProjectionInput): Promise<PlanningHandoffProjection> {
    const artifact = artifactFromProjection(input.projection);
    const handoffId = artifact.artifactId;

    assertPlanningHandoffId(handoffId);

    await db.insert(planningHandoffs).values({
      id: handoffId,
      projectId: input.projectId,
      sessionId: input.sessionId,
      sourceCommandId: input.sourceCommandId,
      sourceEventId: input.sourceEventId,
      artifactKind: artifact.kind,
      status: artifact.status,
      gateVerdict: artifact.gateVerdict.verdict,
      sourceStateVersion: Number(input.sourceStateVersion),
      summary: input.projection.summary,
      artifactJson: stringifyJson(artifact),
      createdBy: artifact.createdBy,
      createdAt: artifact.createdAt,
      schemaVersion: artifact.schemaVersion as SchemaVersion
    });

    const sourceRows = sourceRowsFor(handoffId, artifact.sourceRefs, artifact.createdAt);

    if (sourceRows.length) {
      await db.insert(planningHandoffSources).values(sourceRows);
    }

    if (artifact.kind === "PlanningHandoffArtifact") {
      if (artifact.taskBreakdown.length) {
        await db.insert(planningHandoffTasks).values(
          artifact.taskBreakdown.map((task, index) => ({
            id: task.taskId,
            handoffId,
            sequenceOrder: index + 1,
            title: task.title,
            intent: task.intent,
            ownerRole: task.ownerRole,
            sourceRefsJson: stringifyJson(task.sourceRefs),
            dependsOnJson: stringifyJson(task.dependsOn),
            acceptanceEvidenceJson: stringifyJson(task.acceptanceEvidence),
            nonGoalsJson: stringifyJson(task.nonGoals),
            riskRefsJson: stringifyJson(task.riskRefs)
          }))
        );
      }

      if (artifact.prIssuePlan.length) {
        await db.insert(planningHandoffPrIssueItems).values(
          artifact.prIssuePlan.map((item, index) => ({
            id: item.sequenceId,
            handoffId,
            sequenceOrder: index + 1,
            summary: item.summary,
            includedTaskIdsJson: stringifyJson(item.includedTaskIds),
            entryPrerequisitesJson: stringifyJson(item.entryPrerequisites),
            exitEvidenceJson: stringifyJson(item.exitEvidence),
            blockedByJson: stringifyJson(item.blockedBy),
            phaseBoundary: item.phaseBoundary
          }))
        );
      }
    }

    const riskRows = riskRowsFor(handoffId, artifact);

    if (riskRows.length) {
      await db.insert(planningHandoffRisks).values(riskRows);
    }

    return input.projection;
  }

  return {
    async saveFromProjection(input: SavePlanningHandoffProjectionInput): Promise<PlanningHandoffProjection> {
      return saveRows(input);
    },

    async getById(handoffId: string): Promise<PlanningHandoffProjection | null> {
      const rows = await db.select().from(planningHandoffs).where(eq(planningHandoffs.id, handoffId)).limit(1);
      const row = rows[0];

      return row ? projectionFromRow(row) : null;
    },

    async getLatestForSession(sessionId: SessionId): Promise<PlanningHandoffProjection | null> {
      const rows = await db
        .select()
        .from(planningHandoffs)
        .where(eq(planningHandoffs.sessionId, sessionId))
        .orderBy(desc(planningHandoffs.createdAt), desc(planningHandoffs.id))
        .limit(1);
      const row = rows[0];

      return row ? projectionFromRow(row) : null;
    },

    async getForSourceCommand(commandId: CommandId): Promise<PlanningHandoffProjection | null> {
      const rows = await db
        .select()
        .from(planningHandoffs)
        .where(eq(planningHandoffs.sourceCommandId, commandId))
        .limit(1);
      const row = rows[0];

      return row ? projectionFromRow(row) : null;
    },

    async hasSourceRef(handoffId: string, sourceType: string, sourceId: string): Promise<boolean> {
      const rows = await db
        .select({ id: planningHandoffSources.id })
        .from(planningHandoffSources)
        .where(
          and(
            eq(planningHandoffSources.handoffId, handoffId),
            eq(planningHandoffSources.sourceType, sourceType),
            eq(planningHandoffSources.sourceId, sourceId)
          )
        )
        .limit(1);

      return Boolean(rows[0]);
    }
  };
}
