import { describe, expect, it } from "vitest";
import { formatHttpOrigin } from "./local-url.mjs";

describe("local URL helpers", () => {
  it("formats IPv4 and IPv6 origins for browser-safe URLs", () => {
    expect(formatHttpOrigin("127.0.0.1", "43110")).toBe("http://127.0.0.1:43110");
    expect(formatHttpOrigin("::1", "43110")).toBe("http://[::1]:43110");
    expect(formatHttpOrigin("[::1]", "43110")).toBe("http://[::1]:43110");
  });
});
