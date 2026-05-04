import { readdirSync, readFileSync, statSync } from "node:fs";
import { relative } from "node:path";
import { URL } from "node:url";

const ROOT = new URL("../", import.meta.url);

function readText(path) {
  return readFileSync(new URL(path, ROOT), "utf8");
}

const DOCS_24 = readText("docs/24-codex-prompt-output-contract.md");
const DOCS_25 = readText("docs/25-contracts-dto-catalog.md");
const DOCS_26 = readText("docs/26-api-route-behavior-catalog.md");

function fail(message, details = []) {
  console.error(`doc contract check failed: ${message}`);

  for (const detail of details) {
    console.error(`- ${detail}`);
  }

  process.exitCode = 1;
}

function quotedValues(text) {
  return [...text.matchAll(/"([^"]+)"/g)].map((match) => match[1]);
}

function parseConstArray(sourceText, name) {
  const match = sourceText.match(new RegExp(`${name} = \\[([\\s\\S]*?)\\] as const`));

  if (!match) {
    throw new Error(`Could not find ${name}`);
  }

  return quotedValues(match[1]);
}

function parseStringUnion(sourceText, name) {
  const match = sourceText.match(new RegExp(`export type ${name} =([\\s\\S]*?);`));

  if (!match) {
    throw new Error(`Could not find ${name}`);
  }

  return quotedValues(match[1]);
}

function sectionBetween(text, start, end, label) {
  const startIndex = text.indexOf(start);

  if (startIndex < 0) {
    throw new Error(`Could not find ${label} start`);
  }

  const contentStart = startIndex + start.length;
  const endIndex = text.indexOf(end, contentStart);

  if (endIndex < 0) {
    throw new Error(`Could not find ${label} end`);
  }

  return text.slice(contentStart, endIndex);
}

function markdownFirstColumnValues(section) {
  return [...section.matchAll(/^\| `([^`]+)` \|/gm)].map((match) => match[1]);
}

function parseBacktickedValuesFromTableColumn(section, columnIndex) {
  const values = [];

  for (const row of section.matchAll(/^\|(.+)\|$/gm)) {
    const cells = row[1].split("|").map((cell) => cell.trim());
    const cell = cells[columnIndex];

    if (cell) {
      values.push(...[...cell.matchAll(/`([^`]+)`/g)].map((match) => match[1]));
    }
  }

  return values;
}

function parseDocs25CommandTypes() {
  const section = sectionBetween(
    DOCS_25,
    "### CommandType enum",
    "### ProductEngineCommand envelope",
    "docs/25 CommandType section"
  );

  return markdownFirstColumnValues(section);
}

function parseDocs25CommandActors() {
  const section = sectionBetween(
    DOCS_25,
    "`CommandActor` enum:",
    "Example command envelope:",
    "docs/25 CommandActor section"
  );

  return markdownFirstColumnValues(section);
}

function parseDocs25EventTypes() {
  const section = sectionBetween(
    DOCS_25,
    "Closed Phase 1 event type groups:",
    "### ProductEngineEffectPlanItem",
    "docs/25 ProductEngineEventType section"
  );

  return parseBacktickedValuesFromTableColumn(section, 1);
}

function parseDocs25EffectTypes() {
  const section = sectionBetween(
    DOCS_25,
    "### EffectType enum",
    "### EffectStatus enum",
    "docs/25 EffectType section"
  );

  return markdownFirstColumnValues(section);
}

function parseDocs25EffectStatuses() {
  const section = sectionBetween(
    DOCS_25,
    "### EffectStatus enum",
    "### EffectTaskDto",
    "docs/25 EffectStatus section"
  );

  return markdownFirstColumnValues(section);
}

function parseDocs25SseEvents() {
  const section = sectionBetween(
    DOCS_25,
    "### SseEvent union",
    "### ProjectionRefetchHint",
    "docs/25 SseEvent section"
  );

  return markdownFirstColumnValues(section);
}

function parseDocs25ProjectionKinds() {
  const section = sectionBetween(
    DOCS_25,
    "| Projection | File | Primary UI |",
    "### Projection minimum fields",
    "docs/25 ProjectionKind section"
  );

  return markdownFirstColumnValues(section);
}

function parseDocs24TurnPurposes() {
  const section = sectionBetween(
    DOCS_24,
    "Phase 1에서 허용되는 Codex turnPurpose는 다음 6개뿐이다.",
    "## Input contract overview",
    "docs/24 turnPurpose section"
  );

  return markdownFirstColumnValues(section);
}

function parseDocs24ArtifactKinds() {
  const section = sectionBetween(
    DOCS_24,
    "## Artifact field contracts",
    "## Blocked action taxonomy",
    "docs/24 artifact kind section"
  );

  return [...section.matchAll(/^### ([A-Za-z]+Artifact)$/gm)].map((match) => match[1]);
}

function parseDocs24ApplyPolicies() {
  const section = sectionBetween(
    DOCS_24,
    "## applyPolicy enum",
    "Unknown applyPolicy",
    "docs/24 applyPolicy section"
  );

  return markdownFirstColumnValues(section);
}

function parseDocs24BlockedActionTypes() {
  const section = sectionBetween(
    DOCS_24,
    "## Blocked action taxonomy",
    "## Auto-apply and gate matrix",
    "docs/24 blocked action section"
  );

  return markdownFirstColumnValues(section);
}

function parseRouteCatalog() {
  const source = readText("packages/contracts/src/api/routes.ts");
  const routeBlocks = [...source.matchAll(/\{([^{}]*routeId:[^{}]*)\}/gs)].map((match) => match[1]);
  const routes = new Map();

  for (const block of routeBlocks) {
    const method = block.match(/method: "(GET|POST)"/)?.[1];
    const path = block.match(/path: "([^"]+)"/)?.[1];
    const queryBlock = block.match(/requiredQueryParams: \[([^\]]*)\]/)?.[1];
    const queryParams = queryBlock ? quotedValues(queryBlock) : [];

    if (method && path) {
      routes.set(`${method} ${path}`, queryParams);
    }
  }

  return routes;
}

function parseDocs26Routes() {
  const routes = new Map();

  for (const match of DOCS_26.matchAll(/\| `((?:GET|POST) [^`]+)` \|/g)) {
    const [method, endpoint] = match[1].split(" ", 2);
    const [path, query = ""] = endpoint.split("?");
    const queryParams = query
      ? query.split("&").filter(Boolean).map((part) => part.split("=")[0])
      : [];

    routes.set(`${method} ${path}`, queryParams);
  }

  return routes;
}

function compareSets(label, docsValues, codeValues) {
  const docsSet = new Set(docsValues);
  const codeSet = new Set(codeValues);
  const missing = [...docsSet].filter((value) => !codeSet.has(value)).sort();
  const extra = [...codeSet].filter((value) => !docsSet.has(value)).sort();

  if (missing.length || extra.length) {
    fail(`${label} mismatch`, [
      `missing in code: ${missing.join(", ") || "(none)"}`,
      `extra in code: ${extra.join(", ") || "(none)"}`
    ]);
  }
}

function createContractTaxonomyChecks() {
  const commandSource = readText("packages/contracts/src/product-engine/commands.ts");
  const eventSource = readText("packages/contracts/src/product-engine/events.ts");
  const effectSource = readText("packages/contracts/src/effects/tasks.ts");
  const sseSource = readText("packages/contracts/src/sse/events.ts");
  const projectionSource = readText("packages/contracts/src/projections/index.ts");
  const codexSource = readText("packages/contracts/src/codex/reexports.ts");

  return [
    {
      label: "docs/25 CommandType",
      docsValues: parseDocs25CommandTypes(),
      codeValues: parseConstArray(commandSource, "COMMAND_TYPES")
    },
    {
      label: "docs/25 CommandActor",
      docsValues: parseDocs25CommandActors(),
      codeValues: parseConstArray(commandSource, "COMMAND_ACTORS")
    },
    {
      label: "docs/25 ProductEngineEventType",
      docsValues: parseDocs25EventTypes(),
      codeValues: parseConstArray(eventSource, "PRODUCT_ENGINE_EVENT_TYPES")
    },
    {
      label: "docs/25 EffectType",
      docsValues: parseDocs25EffectTypes(),
      codeValues: parseConstArray(effectSource, "EFFECT_TYPES")
    },
    {
      label: "docs/25 EffectStatus",
      docsValues: parseDocs25EffectStatuses(),
      codeValues: parseConstArray(effectSource, "EFFECT_STATUSES")
    },
    {
      label: "docs/25 SseEventName",
      docsValues: parseDocs25SseEvents(),
      codeValues: parseStringUnion(sseSource, "SseEventName")
    },
    {
      label: "docs/25 ProjectionKind",
      docsValues: parseDocs25ProjectionKinds(),
      codeValues: parseStringUnion(projectionSource, "ProjectionKind")
    },
    {
      label: "docs/24 CodexTurnPurpose",
      docsValues: parseDocs24TurnPurposes(),
      codeValues: parseConstArray(codexSource, "CODEX_TURN_PURPOSES")
    },
    {
      label: "docs/24 CodexArtifactKind",
      docsValues: parseDocs24ArtifactKinds(),
      codeValues: parseConstArray(codexSource, "CODEX_ARTIFACT_KINDS")
    },
    {
      label: "docs/24 CodexApplyPolicy",
      docsValues: parseDocs24ApplyPolicies(),
      codeValues: parseConstArray(codexSource, "CODEX_APPLY_POLICIES")
    },
    {
      label: "docs/24 BlockedActionType",
      docsValues: parseDocs24BlockedActionTypes(),
      codeValues: parseConstArray(codexSource, "BLOCKED_ACTION_TYPES")
    }
  ];
}

function compareContractTaxonomies() {
  for (const { label, docsValues, codeValues } of createContractTaxonomyChecks()) {
    compareSets(label, docsValues, codeValues);
  }
}

function compareRoutes() {
  const docsRoutes = parseDocs26Routes();
  const codeRoutes = parseRouteCatalog();

  compareSets("docs/26 route catalog", [...docsRoutes.keys()], [...codeRoutes.keys()]);

  const queryMismatches = [];

  for (const [route, docsQuery] of docsRoutes.entries()) {
    const codeQuery = codeRoutes.get(route);

    if (codeQuery && docsQuery.join(",") !== codeQuery.join(",")) {
      queryMismatches.push(`${route}: docs=[${docsQuery.join(",")}] code=[${codeQuery.join(",")}]`);
    }
  }

  if (queryMismatches.length) {
    fail("docs/26 route query mismatch", queryMismatches);
  }
}

function scanPackageBoundaries() {
  const checks = [
    {
      root: "packages/core/src",
      forbidden: ["hono", "@tauri", "react", "node:", "http"]
    },
    {
      root: "apps/desktop/src",
      forbidden: ["@solo-superman/db", "libsql", "sqlite"]
    },
    {
      root: "packages/contracts/src",
      forbidden: ["hono", "@tauri", "react", "drizzle"]
    }
  ];
  const violations = [];

  for (const check of checks) {
    const pending = [new URL(`${check.root}/`, ROOT)];

    while (pending.length) {
      const dir = pending.pop();

      for (const entry of readdirSync(dir)) {
        const url = new URL(entry, `${dir.href.replace(/\/?$/, "/")}`);
        const stat = statSync(url);

        if (stat.isDirectory()) {
          pending.push(url);
          continue;
        }

        if (!/\.(ts|tsx)$/.test(url.pathname)) {
          continue;
        }

        const text = readFileSync(url, "utf8");

        for (const forbidden of check.forbidden) {
          if (text.includes(forbidden)) {
            violations.push(`${relative(ROOT.pathname, url.pathname)} contains ${forbidden}`);
          }
        }
      }
    }
  }

  if (violations.length) {
    fail("package boundary import scan", violations);
  }
}

compareContractTaxonomies();
compareRoutes();
scanPackageBoundaries();

if (!process.exitCode) {
  console.log("doc contract checks passed");
}
