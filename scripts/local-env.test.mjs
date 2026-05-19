import { describe, expect, it } from "vitest";
import { envValue, positiveIntegerEnv } from "./local-env.mjs";

describe("local env helpers", () => {
  it("trims non-empty env values and falls back for empty values", () => {
    expect(envValue({ SOLO_VALUE: "  enabled  " }, "SOLO_VALUE", "fallback")).toBe("enabled");
    expect(envValue({ SOLO_VALUE: "   " }, "SOLO_VALUE", "fallback")).toBe("fallback");
    expect(envValue({}, "SOLO_VALUE", "fallback")).toBe("fallback");
  });

  it("parses positive integer values with contextual errors", () => {
    expect(positiveIntegerEnv({ SOLO_TIMEOUT_MS: "2500" }, "SOLO_TIMEOUT_MS", 1000, "positive integer number of milliseconds")).toBe(2500);
    expect(() => positiveIntegerEnv({ SOLO_TIMEOUT_MS: "0" }, "SOLO_TIMEOUT_MS", 1000)).toThrow("SOLO_TIMEOUT_MS must be a positive integer");
  });
});
