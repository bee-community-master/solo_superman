import { eq } from "drizzle-orm";
import type { ProjectId, SessionId } from "@solo-superman/contracts";
import type { SoloDatabaseExecutor } from "../client";
import { projects, sessions } from "../schema";

export interface ProjectRecord {
  readonly projectId: ProjectId;
  readonly rawIdeaText: string;
  readonly privacyMode: string;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface SessionRecord {
  readonly sessionId: SessionId;
  readonly projectId: ProjectId;
  readonly status: string;
  readonly currentPhase: string;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface CreateProjectInput {
  readonly projectId: ProjectId;
  readonly rawIdeaText: string;
  readonly privacyMode?: string;
  readonly now?: string;
}

export interface CreateSessionInput {
  readonly sessionId: SessionId;
  readonly projectId: ProjectId;
  readonly status: string;
  readonly currentPhase: string;
  readonly now?: string;
}

export interface UpdateSessionPhaseInput {
  readonly sessionId: SessionId;
  readonly status: string;
  readonly currentPhase: string;
  readonly updatedAt?: string;
}

function mapProject(row: typeof projects.$inferSelect): ProjectRecord {
  return {
    projectId: row.id as ProjectId,
    rawIdeaText: row.rawIdeaText,
    privacyMode: row.privacyMode,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt
  };
}

function mapSession(row: typeof sessions.$inferSelect): SessionRecord {
  return {
    sessionId: row.id as SessionId,
    projectId: row.projectId as ProjectId,
    status: row.status,
    currentPhase: row.currentPhase,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt
  };
}

export function createProjectRepository(db: SoloDatabaseExecutor) {
  async function getProject(projectId: ProjectId): Promise<ProjectRecord | null> {
    const rows = await db.select().from(projects).where(eq(projects.id, projectId)).limit(1);
    const row = rows[0];

    return row ? mapProject(row) : null;
  }

  async function getSession(sessionId: SessionId): Promise<SessionRecord | null> {
    const rows = await db.select().from(sessions).where(eq(sessions.id, sessionId)).limit(1);
    const row = rows[0];

    return row ? mapSession(row) : null;
  }

  return {
    async createProject(input: CreateProjectInput): Promise<ProjectRecord> {
      const now = input.now ?? new Date().toISOString();

      await db.insert(projects).values({
        id: input.projectId,
        rawIdeaText: input.rawIdeaText,
        privacyMode: input.privacyMode ?? "local_only",
        createdAt: now,
        updatedAt: now
      });

      const project = await getProject(input.projectId);

      if (!project) {
        throw new Error(`Project was not persisted: ${input.projectId}`);
      }

      return project;
    },

    getProject,

    async createSession(input: CreateSessionInput): Promise<SessionRecord> {
      const now = input.now ?? new Date().toISOString();

      await db.insert(sessions).values({
        id: input.sessionId,
        projectId: input.projectId,
        status: input.status,
        currentPhase: input.currentPhase,
        createdAt: now,
        updatedAt: now
      });

      const session = await getSession(input.sessionId);

      if (!session) {
        throw new Error(`Session was not persisted: ${input.sessionId}`);
      }

      return session;
    },

    getSession,

    async updateSessionPhase(input: UpdateSessionPhaseInput): Promise<SessionRecord> {
      const updatedAt = input.updatedAt ?? new Date().toISOString();

      await db
        .update(sessions)
        .set({
          status: input.status,
          currentPhase: input.currentPhase,
          updatedAt
        })
        .where(eq(sessions.id, input.sessionId));

      const session = await getSession(input.sessionId);

      if (!session) {
        throw new Error(`Session was not found after update: ${input.sessionId}`);
      }

      return session;
    }
  };
}
