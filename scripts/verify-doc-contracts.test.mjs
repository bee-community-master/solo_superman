import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { describe, expect, it } from "vitest";
import {
  collectPackageBoundaryViolations,
  findPhase15bExecutionPermissionClaims,
  findRouteQueryMismatches,
  moduleSpecifiers,
  parseConstArray,
  parseDocs26RoutesFromText,
  parseRouteCatalogFromSource,
  sectionBetween
} from "./verify-doc-contracts.mjs";

describe("doc contract verification helpers", () => {
  it("fails section parsing with a labelled missing boundary", () => {
    expect(() => sectionBetween("before only", "START", "END", "fixture section")).toThrow(
      "Could not find fixture section start"
    );
    expect(() => sectionBetween("START but no close", "START", "END", "fixture section")).toThrow(
      "Could not find fixture section end"
    );
  });

  it("parses docs/26 routes with required query params", () => {
    const routes = parseDocs26RoutesFromText("| `GET /api/v1/events/stream?sessionId=:sessionId&cursor=:cursor` | notes |\n");

    expect(routes.get("GET /api/v1/events/stream")).toEqual(["sessionId", "cursor"]);
  });

  it("parses exact const array names when one name is a suffix of another", () => {
    const values = parseConstArray(
      `
      export const PRODUCT_ENGINE_COMMAND_TYPES = ["StartProject"] as const;
      export const COMMAND_TYPES = [
        ...PRODUCT_ENGINE_COMMAND_TYPES,
        "CreateResearchAllowlist"
      ] as const;
      `,
      "COMMAND_TYPES"
    );

    expect(values).toEqual(["StartProject", "CreateResearchAllowlist"]);
  });

  it("parses route catalog entries and rejects incomplete route definitions", () => {
    const routes = parseRouteCatalogFromSource(`
      export const API_ROUTE_CATALOG = [
        { routeId: "stream", clientName: "stream", method: "GET", path: "/api/v1/events/stream", requiredQueryParams: ["sessionId"], commandType: "none", implementedInPr01: false }
      ] as const;
    `);

    expect(routes.get("GET /api/v1/events/stream")).toEqual(["sessionId"]);
    expect(() =>
      parseRouteCatalogFromSource(`[{ routeId: "broken", clientName: "broken", method: "PUT", path: "/x" }]`)
    ).toThrow("Unsupported or missing API route method for broken: PUT");
    expect(() => parseRouteCatalogFromSource(`[{ routeId: "missingPath", method: "GET" }]`)).toThrow(
      "Missing API route path for missingPath"
    );
  });

  it("compares route query params as a set with useful mismatch details", () => {
    const docsRoutes = new Map([["GET /stream", ["cursor", "sessionId"]]]);
    const matchingCodeRoutes = new Map([["GET /stream", ["sessionId", "cursor"]]]);
    const mismatchingCodeRoutes = new Map([["GET /stream", ["sessionId", "extra"]]]);

    expect(findRouteQueryMismatches(docsRoutes, matchingCodeRoutes)).toEqual([]);
    expect(findRouteQueryMismatches(docsRoutes, mismatchingCodeRoutes)).toEqual([
      "GET /stream: missing in code=[cursor] extra in code=[extra]"
    ]);
  });

  it("detects side-effect, type-only, and export module specifiers", () => {
    const imports = moduleSpecifiers(`
      import "hono";
      import type { Context } from "hono";
      export { x } from "node:fs";
    `);

    expect(imports).toEqual(["hono", "hono", "node:fs"]);
  });

  it("flags Phase 1.5B execution-permission doc claims while allowing negated guardrails", () => {
    expect(
      findPhase15bExecutionPermissionClaims([
        {
          path: "allowed.md",
          text: "Phase 1.5B must not execute shell commands; hints are not execution permission."
        },
        {
          path: "blocked.md",
          text: "Phase 1.5B may execute shell commands from readiness hints."
        },
        {
          path: "blocked-without-approval.md",
          text: "Phase 1.5B may execute shell commands without approval."
        }
      ])
    ).toEqual([
      "blocked.md:1: Phase 1.5B may execute shell commands from readiness hints.",
      "blocked-without-approval.md:1: Phase 1.5B may execute shell commands without approval."
    ]);
  });

  it("scans package boundary fixtures deterministically", () => {
    const tempRoot = mkdtempSync(join(tmpdir(), "solo-doc-contracts-"));
    const nestedDir = join(tempRoot, "packages/core/src/nested");
    mkdirSync(nestedDir, { recursive: true });
    writeFileSync(join(tempRoot, "packages/core/src/allowed.ts"), 'import { ok } from "@solo-superman/contracts";\n');
    writeFileSync(join(nestedDir, "bad.ts"), 'import "hono";\nimport type { Server } from "node:http";\n');

    const violations = collectPackageBoundaryViolations({
      root: pathToFileURL(`${tempRoot}/`),
      checks: [{ root: "packages/core/src", forbiddenModules: ["hono", "node:"] }]
    });

    expect(violations).toEqual([
      "packages/core/src/nested/bad.ts imports hono",
      "packages/core/src/nested/bad.ts imports node:http"
    ]);
  });
});
