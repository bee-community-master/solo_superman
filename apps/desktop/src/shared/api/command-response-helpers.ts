import type { CommandResponse, StateVersion } from "@solo-superman/contracts";

function commandProjection(response: CommandResponse<unknown>) {
  return response.immediateProjection ?? response.queueProjection ?? null;
}

function hasProjectionKind(projection: unknown, kind: string): projection is { readonly kind: string } {
  return Boolean(projection && typeof projection === "object" && "kind" in projection && projection.kind === kind);
}

export function commandResponseVersion(response: CommandResponse) {
  if (typeof response.stateVersionAfter !== "number") {
    const message = response.error?.message ?? "Command did not return a next state version.";

    throw new Error(message);
  }

  return response.stateVersionAfter as StateVersion;
}

export function requiredCommandProjection<TProjection>(response: CommandResponse<TProjection>, kind: string) {
  const projection = commandProjection(response);

  if (!hasProjectionKind(projection, kind)) {
    throw new Error(`${kind} was not returned by the sidecar command.`);
  }

  return projection as TProjection;
}

export function optionalCommandProjection<TProjection>(response: CommandResponse<TProjection>, kind: string) {
  const projection = commandProjection(response);

  if (!projection) {
    return null;
  }

  if (!hasProjectionKind(projection, kind)) {
    throw new Error(`${kind} was not returned by the sidecar command.`);
  }

  return projection as TProjection;
}
