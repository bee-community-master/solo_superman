import { eq } from "drizzle-orm";
import type { SoloDatabaseExecutor } from "../client";
import { parseJsonRecord, stringifyJson } from "../json";
import { appConfig } from "../schema";

const REMOTE_CONFIG_KEY = "remote_db_config";
const SECRET_REF_ID_PATTERN = /^secret_ref_[a-z0-9_:-]{1,120}$/i;
const CONFIGURED_DISABLED_STATUSES = new Set<DisabledRemoteConfig["remoteSyncStatus"]>([
  "configured_disabled",
  "unsupported_in_phase1"
]);

export interface DisabledRemoteConfigInput {
  readonly remoteDbUrl?: string;
  readonly remoteDbTokenRef?: string;
  readonly updatedAt?: string;
}

export interface DisabledRemoteConfig {
  readonly remoteDbUrl: string | null;
  readonly remoteDbTokenRef: string | null;
  readonly remoteSyncEnabled: false;
  readonly lastRemoteSyncAt: null;
  readonly remoteSyncStatus: "not_configured" | "configured_disabled" | "unsupported_in_phase1";
  readonly updatedAt: string;
}

function normalizeRemoteConfig(input: DisabledRemoteConfigInput): DisabledRemoteConfig {
  const updatedAt = input.updatedAt ?? new Date().toISOString();
  const hasRemoteSlot = Boolean(input.remoteDbUrl || input.remoteDbTokenRef);

  if (input.remoteDbTokenRef !== undefined && !SECRET_REF_ID_PATTERN.test(input.remoteDbTokenRef)) {
    throw new Error("remoteDbTokenRef must be an OS secret reference id, not a secret value.");
  }

  return {
    remoteDbUrl: input.remoteDbUrl ?? null,
    remoteDbTokenRef: input.remoteDbTokenRef ?? null,
    remoteSyncEnabled: false,
    lastRemoteSyncAt: null,
    remoteSyncStatus: hasRemoteSlot ? "configured_disabled" : "not_configured",
    updatedAt
  };
}

function remoteSyncStatusForConfigSlot(
  hasRemoteSlot: boolean,
  persistedStatus: unknown
): DisabledRemoteConfig["remoteSyncStatus"] {
  if (CONFIGURED_DISABLED_STATUSES.has(persistedStatus as DisabledRemoteConfig["remoteSyncStatus"])) {
    return persistedStatus as DisabledRemoteConfig["remoteSyncStatus"];
  }

  return hasRemoteSlot ? "configured_disabled" : "not_configured";
}

function readRemoteDbTokenRef(value: unknown) {
  return typeof value === "string" && SECRET_REF_ID_PATTERN.test(value) ? value : null;
}

function mapRemoteConfig(valueJson: string, updatedAt: string): DisabledRemoteConfig {
  const value = parseJsonRecord(valueJson);
  const remoteDbUrl = typeof value.remoteDbUrl === "string" ? value.remoteDbUrl : null;
  const remoteDbTokenRef = readRemoteDbTokenRef(value.remoteDbTokenRef);
  const hasRemoteSlot = Boolean(remoteDbUrl || remoteDbTokenRef);

  return {
    remoteDbUrl,
    remoteDbTokenRef,
    remoteSyncEnabled: false,
    lastRemoteSyncAt: null,
    remoteSyncStatus: remoteSyncStatusForConfigSlot(hasRemoteSlot, value.remoteSyncStatus),
    updatedAt
  };
}

export function createConfigRepository(db: SoloDatabaseExecutor) {
  return {
    async saveDisabledRemoteConfig(input: DisabledRemoteConfigInput): Promise<DisabledRemoteConfig> {
      const config = normalizeRemoteConfig(input);
      const valueJson = stringifyJson(config);

      await db
        .insert(appConfig)
        .values({
          key: REMOTE_CONFIG_KEY,
          valueJson,
          updatedAt: config.updatedAt
        })
        .onConflictDoUpdate({
          target: appConfig.key,
          set: {
            valueJson,
            updatedAt: config.updatedAt
          }
        });

      return config;
    },

    async getRemoteConfig(): Promise<DisabledRemoteConfig> {
      const rows = await db.select().from(appConfig).where(eq(appConfig.key, REMOTE_CONFIG_KEY)).limit(1);
      const row = rows[0];

      if (!row) {
        return normalizeRemoteConfig({});
      }

      return mapRemoteConfig(row.valueJson, row.updatedAt);
    }
  };
}
