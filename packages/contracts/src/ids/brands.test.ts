import { describe, expectTypeOf, it } from "vitest";
import type { ProjectId, SessionId } from "./index";

describe("ID brands", () => {
  it("does not collapse public DTO identifiers back to plain strings", () => {
    expectTypeOf<string>().not.toEqualTypeOf<ProjectId>();
    expectTypeOf<ProjectId>().not.toEqualTypeOf<SessionId>();
  });
});
