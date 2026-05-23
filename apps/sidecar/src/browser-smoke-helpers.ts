import { createServer } from "node:http";
import type { BrowserActionPreviewDto } from "@solo-superman/contracts";

export interface LocalBrowserTarget {
  readonly targetUrl: string;
  readonly close: () => Promise<void>;
}

export async function createLocalBrowserTargetServer(input: {
  readonly html: string;
  readonly path: string;
  readonly failureMessage: string;
}): Promise<LocalBrowserTarget> {
  const server = createServer((_request, response) => {
    response.writeHead(200, { "content-type": "text/html; charset=utf-8" });
    response.end(input.html);
  });

  await new Promise<void>((resolveListen, rejectListen) => {
    server.once("error", rejectListen);
    server.listen(0, "127.0.0.1", () => {
      server.off("error", rejectListen);
      resolveListen();
    });
  });

  const address = server.address();

  if (!address || typeof address === "string") {
    throw new Error(input.failureMessage);
  }

  return {
    targetUrl: `http://127.0.0.1:${address.port}${input.path}`,
    close: () =>
      new Promise<void>((resolveClose, rejectClose) => {
        server.close((error) => {
          if (error) {
            rejectClose(error);
            return;
          }

          resolveClose();
        });
      })
  };
}

export function safeBrowserActionPreview(): BrowserActionPreviewDto {
  return {
    kind: "navigate_and_capture",
    visibleAction: true,
    credentialMode: "none",
    externalMutation: "blocked"
  };
}

export function requestedMutationBrowserActionPreview(): BrowserActionPreviewDto {
  return {
    ...safeBrowserActionPreview(),
    externalMutation: "requested"
  };
}

export function stringArrayAt(value: unknown, label: string) {
  if (!Array.isArray(value) || value.some((item) => typeof item !== "string")) {
    throw new Error(`${label} must be an array of strings.`);
  }

  return value as readonly string[];
}
