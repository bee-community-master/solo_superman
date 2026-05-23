import { describe, expect, it } from "vitest";
import { fetchWithTimeout } from "./local-http.mjs";

describe("local HTTP helpers", () => {
  it("bounds each fetch attempt with an abort signal", async () => {
    let capturedSignal;
    const response = await fetchWithTimeout("http://127.0.0.1:43110/healthz", {
      timeoutMs: 1_000,
      fetchImpl: async (_url, init) => {
        capturedSignal = init?.signal;

        return new globalThis.Response("ok", { status: 200 });
      }
    });

    expect(response.status).toBe(200);
    await expect(response.text()).resolves.toBe("ok");
    expect(capturedSignal).toBeInstanceOf(globalThis.AbortSignal);
    expect(capturedSignal.aborted).toBe(false);
  });
});
