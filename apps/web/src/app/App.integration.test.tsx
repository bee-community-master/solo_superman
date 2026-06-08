/**
 * @vitest-environment happy-dom
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import {
  CODEX_RUNTIME_ADAPTER_VERSION,
  CODEX_RUNTIME_TRANSPORT,
  CODEX_SDK_PACKAGE_VERSION,
  type CodexRuntimeStatusDto
} from "@solo-superman/contracts";
import type * as SidecarClientModule from "../shared/api/sidecar-client";
import { APP_LANGUAGE_STORAGE_KEY } from "../shared/i18n/app-language";
import { App } from "./App";

const sidecarClientMocks = vi.hoisted(() => ({
  createSidecarClient: vi.fn(),
  discoverSidecarConnection: vi.fn(),
  getRuntimeStatus: vi.fn()
}));

vi.mock("../shared/api/sidecar-client", async (importOriginal) => {
  const actual = await importOriginal<typeof SidecarClientModule>();

  return {
    ...actual,
    createSidecarClient: sidecarClientMocks.createSidecarClient,
    discoverSidecarConnection: sidecarClientMocks.discoverSidecarConnection
  };
});

const TEST_CONNECTION = {
  baseUrl: "http://127.0.0.1:43110",
  localCapabilityToken: "test-token",
  mode: "vite_env",
  status: "discovered",
  tokenSource: "vite_env"
} as const;

function authenticatedRuntimeStatus(): CodexRuntimeStatusDto {
  return {
    status: "available",
    adapterVersion: CODEX_RUNTIME_ADAPTER_VERSION,
    sdkPackageVersion: CODEX_SDK_PACKAGE_VERSION,
    codexCliVersion: "0.137.0",
    transport: CODEX_RUNTIME_TRANSPORT,
    checkedAt: "2026-06-08T00:00:00.000Z",
    manualHandoffAvailable: true,
    liveTurnExecutionEnabled: false,
    executionMode: "manual_handoff",
    account: {
      status: "authenticated",
      loginCommand: "codex auth login",
      loginStatusCommand: "codex login status"
    }
  };
}

async function waitFor(expectation: () => void) {
  let lastError: unknown;

  for (let attempt = 0; attempt < 20; attempt += 1) {
    try {
      expectation();
      return;
    } catch (error) {
      lastError = error;
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 0));
      });
    }
  }

  throw lastError;
}

async function renderApp() {
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);

  await act(async () => {
    root.render(<App />);
  });

  return { container, root };
}

function bodyText() {
  return document.body.textContent ?? "";
}

let mountedRoot: Root | null = null;

beforeEach(() => {
  (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  document.body.innerHTML = "";
  window.localStorage.clear();
  window.localStorage.setItem(APP_LANGUAGE_STORAGE_KEY, "en");
  sidecarClientMocks.createSidecarClient.mockReset();
  sidecarClientMocks.discoverSidecarConnection.mockReset();
  sidecarClientMocks.getRuntimeStatus.mockReset();
});

afterEach(async () => {
  if (mountedRoot) {
    await act(async () => {
      mountedRoot?.unmount();
    });
    mountedRoot = null;
  }
  document.body.innerHTML = "";
});

describe("App integration", () => {
  it("discovers the sidecar and renders the first meaningful decision queue screen", async () => {
    sidecarClientMocks.discoverSidecarConnection.mockResolvedValue(TEST_CONNECTION);
    sidecarClientMocks.getRuntimeStatus.mockResolvedValue(authenticatedRuntimeStatus());
    sidecarClientMocks.createSidecarClient.mockReturnValue({
      getRuntimeStatus: sidecarClientMocks.getRuntimeStatus
    });

    const { root } = await renderApp();
    mountedRoot = root;

    await waitFor(() => {
      expect(sidecarClientMocks.discoverSidecarConnection).toHaveBeenCalledTimes(1);
      expect(sidecarClientMocks.createSidecarClient).toHaveBeenCalledWith({ connection: TEST_CONNECTION });
      expect(sidecarClientMocks.getRuntimeStatus).toHaveBeenCalledTimes(1);
      expect(bodyText()).toContain("Solo Superman");
      expect(bodyText()).toContain("Idea summary");
      expect(bodyText()).toContain("Create first questions");
      expect(bodyText()).toContain("vite_env");
    });
  });

  it("renders local service recovery when sidecar discovery is unavailable", async () => {
    sidecarClientMocks.discoverSidecarConnection.mockResolvedValue(null);

    const { root } = await renderApp();
    mountedRoot = root;

    await waitFor(() => {
      expect(sidecarClientMocks.discoverSidecarConnection).toHaveBeenCalledTimes(1);
      expect(sidecarClientMocks.createSidecarClient).not.toHaveBeenCalled();
      expect(sidecarClientMocks.getRuntimeStatus).not.toHaveBeenCalled();
      expect(bodyText()).toContain("Local service unavailable");
      expect(bodyText()).toContain("Start Solo Superman with `pnpm start:local`");
      expect(bodyText()).toContain("Retry connection");
    });
  });
});
