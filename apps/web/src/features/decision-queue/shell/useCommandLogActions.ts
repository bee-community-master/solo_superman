import { type Dispatch, type SetStateAction, useCallback } from "react";
import type { CommandResponse, StatusEndpointDto } from "@solo-superman/contracts";
import type { SidecarClient } from "../../../shared/api/sidecar-client";
import { displayError, type CommandLogEntry } from "./decision-queue-shell-model";

interface CommandLogActionsProps {
  readonly client: SidecarClient | null;
  readonly setCommandLog: Dispatch<SetStateAction<readonly CommandLogEntry[]>>;
  readonly setStatuses: Dispatch<SetStateAction<readonly StatusEndpointDto[]>>;
}

export function useCommandLogActions({ client, setCommandLog, setStatuses }: CommandLogActionsProps) {
  const recordCommandStatus = useCallback((status: StatusEndpointDto) => {
    setStatuses((previous) => [status, ...previous.filter((item) => item.commandId !== status.commandId)]);
    setCommandLog((previous) =>
      previous.map((item) =>
        item.response?.commandId === status.commandId
          ? {
              id: item.id,
              label: item.label,
              createdAt: item.createdAt,
              ...(item.response ? { response: item.response } : {}),
              status
            }
          : item
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

  const appendCommand = useCallback(
    async <TProjection,>(label: string, response: CommandResponse<TProjection>) => {
      const id = response.commandId;
      const entry: CommandLogEntry = {
        id,
        label,
        createdAt: new Date().toISOString(),
        response: response as CommandResponse
      };

      setCommandLog((previous) => [entry, ...previous].slice(0, 8));

      if (!client || !response.statusUrl) {
        return response;
      }

      try {
        const status = await client.getCommandStatus(response.statusUrl);

        recordCommandStatus(status);
      } catch (error) {
        setCommandLog((previous) =>
          previous.map((item) =>
            item.id === id
              ? {
                  ...item,
                  error: displayError(error)
                }
              : item
          )
        );
      }

      return response;
    },
    [client, recordCommandStatus, setCommandLog]
  );

  return {
    recordCommandStatus,
    recordCommandStatusError,
    appendCommand
  };
}
