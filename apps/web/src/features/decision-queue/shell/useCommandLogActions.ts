import { type Dispatch, type SetStateAction, useCallback } from "react";
import type { CommandResponse, StatusEndpointDto } from "@solo-superman/contracts";
import type { SidecarClient } from "../../../shared/api/sidecar-client";
import { COMMAND_LOG_LIMIT, displayError, type CommandLogEntry } from "./decision-queue-shell-model";

interface CommandLogActionsProps {
  readonly client: SidecarClient | null;
  readonly setCommandLog: Dispatch<SetStateAction<readonly CommandLogEntry[]>>;
  readonly setStatuses: Dispatch<SetStateAction<readonly StatusEndpointDto[]>>;
}

function commandLogEntryWithStatus(entry: CommandLogEntry, status: StatusEndpointDto): CommandLogEntry {
  return {
    id: entry.id,
    label: entry.label,
    createdAt: entry.createdAt,
    ...(entry.response ? { response: entry.response } : {}),
    ...(entry.message ? { message: entry.message } : {}),
    status
  };
}

export function useCommandLogActions({ client, setCommandLog, setStatuses }: CommandLogActionsProps) {
  const recordCommandStatus = useCallback((status: StatusEndpointDto) => {
    setStatuses((previous) => [status, ...previous.filter((item) => item.commandId !== status.commandId)]);
    setCommandLog((previous) =>
      previous.map((item) =>
        item.response?.commandId === status.commandId ? commandLogEntryWithStatus(item, status) : item
      )
    );
  }, [setCommandLog, setStatuses]);

  const recordCommandStatusError = useCallback((commandId: CommandResponse["commandId"], error: unknown) => {
    setCommandLog((previous) =>
      previous.map((item) =>
        item.response?.commandId === commandId
          ? {
              ...item,
              error: displayError(error)
            }
          : item
      )
    );
  }, [setCommandLog]);

  const refreshCommandStatus = useCallback(
    async (entry: CommandLogEntry) => {
      if (!client || !entry.response?.statusUrl) {
        return;
      }

      try {
        recordCommandStatus(await client.getCommandStatus(entry.response.statusUrl));
      } catch (error) {
        recordCommandStatusError(entry.response.commandId, error);
      }
    },
    [client, recordCommandStatus, recordCommandStatusError]
  );

  const appendCommand = useCallback(
    async <TProjection,>(label: string, response: CommandResponse<TProjection>) => {
      const id = response.commandId;
      const entry: CommandLogEntry = {
        id,
        label,
        createdAt: new Date().toISOString(),
        response: response as CommandResponse
      };

      setCommandLog((previous) => [entry, ...previous].slice(0, COMMAND_LOG_LIMIT));

      if (!client || !response.statusUrl) {
        return response;
      }

      await refreshCommandStatus(entry);

      return response;
    },
    [client, refreshCommandStatus, setCommandLog]
  );

  return {
    refreshCommandStatus,
    appendCommand
  };
}
