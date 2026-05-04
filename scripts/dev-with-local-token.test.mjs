import { describe, expect, it } from "vitest";
import { createDevEnvironment, resolveLocalCapabilityToken } from "./dev-with-local-token.mjs";

describe("PR-02 dev local capability token launcher", () => {
  it("preserves an explicitly shared token for both desktop and sidecar dev processes", () => {
    const env = createDevEnvironment({
      PATH: "/usr/bin",
      SOLO_LOCAL_CAPABILITY_TOKEN: "shared-dev-token"
    });

    expect(env.SOLO_LOCAL_CAPABILITY_TOKEN).toBe("shared-dev-token");
  });

  it("generates one high-entropy token into the shared child environment when none is provided", () => {
    const token = resolveLocalCapabilityToken({});
    const env = createDevEnvironment({});

    expect(token).toMatch(/^[0-9a-f]{64}$/);
    expect(env.SOLO_LOCAL_CAPABILITY_TOKEN).toMatch(/^[0-9a-f]{64}$/);
  });

  it("rejects an explicitly empty shared token before spawning dev processes", () => {
    expect(() => resolveLocalCapabilityToken({ SOLO_LOCAL_CAPABILITY_TOKEN: "   " })).toThrow(
      "SOLO_LOCAL_CAPABILITY_TOKEN must not be empty"
    );
  });
});
