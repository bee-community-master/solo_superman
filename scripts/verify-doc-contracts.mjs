import { readdirSync, readFileSync, statSync } from "node:fs";
import { relative } from "node:path";
import { URL } from "node:url";

const ROOT = new URL("../", import.meta.url);

function readText(path) {
  return readFileSync(new URL(path, ROOT), "utf8");
}

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
  const docs = readText("docs/25-contracts-dto-catalog.md");
  const section = sectionBetween(
    docs,
    "### CommandType enum",
    "### ProductEngineCommand envelope",
    "docs/25 CommandType section"
  );

  return markdownFirstColumnValues(section);
}

function parseDocs25CommandActors() {
  const docs = readText("docs/25-contracts-dto-catalog.md");
  const section = sectionBetween(
    docs,
    "`CommandActor` enum:",
    "Example command envelope:",
    "docs/25 CommandActor section"
  );

  return markdownFirstColumnValues(section);
}

function parseDocs25EventTypes() {
  const docs = readText("docs/25-contracts-dto-catalog.md");
  const section = sectionBetween(
    docs,
    "Closed Phase 1 event type groups:",
    "### ProductEngineEffectPlanItem",
    "docs/25 ProductEngineEventType section"
  );

  return parseBacktickedValuesFromTableColumn(section, 1);
}

function parseDocs25EffectTypes() {
  const docs = readText("docs/25-contracts-dto-catalog.md");
  const section = sectionBetween(
    docs,
    "### EffectType enum",
    "### EffectStatus enum",
    "docs/25 EffectType section"
  );

  return markdownFirstColumnValues(section);
}

function parseDocs25EffectStatuses() {
  const docs = readText("docs/25-contracts-dto-catalog.md");
  const section = sectionBetween(
    docs,
    "### EffectStatus enum",
    "### EffectTaskDto",
    "docs/25 EffectStatus section"
  );

  return markdownFirstColumnValues(section);
}

function parseDocs25SseEvents() {
  const docs = readText("docs/25-contracts-dto-catalog.md");
  const section = sectionBetween(
    docs,
    "### SseEvent union",
    "### ProjectionRefetchHint",
    "docs/25 SseEvent section"
  );

  return markdownFirstColumnValues(section);
}

function parseDocs25ProjectionKinds() {
  const docs = readText("docs/25-contracts-dto-catalog.md");
  const section = sectionBetween(
    docs,
    "| Projection | File | Primary UI |",
    "### Projection minimum fields",
    "docs/25 ProjectionKind section"
  );

  return markdownFirstColumnValues(section);
}

function parseDocs24TurnPurposes() {
  const docs = readText("docs/24-codex-prompt-output-contract.md");
  const section = sectionBetween(
    docs,
    "Phase 1에서 허용되는 Codex turnPurpose는 다음 6개뿐이다.",
    "## Input contract overview",
    "docs/24 turnPurpose section"
  );

  return markdownFirstColumnValues(section);
}

function parseDocs24ArtifactKinds() {
  const docs = readText("docs/24-codex-prompt-output-contract.md");
  const section = sectionBetween(
    docs,
    "## Artifact field contracts",
    "## Blocked action taxonomy",
    "docs/24 artifact kind section"
  );

  return [...section.matchAll(/^### ([A-Za-z]+Artifact)$/gm)].map((match) => match[1]);
}

function parseDocs24ApplyPolicies() {
  const docs = readText("docs/24-codex-prompt-output-contract.md");
  const section = sectionBetween(
    docs,
    "## applyPolicy enum",
    "Unknown applyPolicy",
    "docs/24 applyPolicy section"
  );

  return markdownFirstColumnValues(section);
}

function parseDocs24BlockedActionTypes() {
  const docs = readText("docs/24-codex-prompt-output-contract.md");
  const section = sectionBetween(
    docs,
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
  const docs = readText("docs/26-api-route-behavior-catalog.md");
  const routes = new Map();

  for (const match of docs.matchAll(/\| `((?:GET|POST) [^`]+)` \|/g)) {
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

function compareCommandTypes() {
  const docsTypes = parseDocs25CommandTypes();
  const codeTypes = parseConstArray(readText("packages/contracts/src/product-engine/commands.ts"), "COMMAND_TYPES");

  compareSets("docs/25 CommandType", docsTypes, codeTypes);
}

function compareContractTaxonomies() {
  const commandSource = readText("packages/contracts/src/product-engine/commands.ts");
  const eventSource = readText("packages/contracts/src/product-engine/events.ts");
  const effectSource = readText("packages/contracts/src/effects/tasks.ts");
  const sseSource = readText("packages/contracts/src/sse/events.ts");
  const projectionSource = readText("packages/contracts/src/projections/index.ts");
  const codexSource = readText("packages/contracts/src/codex/reexports.ts");

  compareSets("docs/25 CommandActor", parseDocs25CommandActors(), parseConstArray(commandSource, "COMMAND_ACTORS"));
  compareSets("docs/25 ProductEngineEventType", parseDocs25EventTypes(), parseConstArray(eventSource, "PRODUCT_ENGINE_EVENT_TYPES"));
  compareSets("docs/25 EffectType", parseDocs25EffectTypes(), parseConstArray(effectSource, "EFFECT_TYPES"));
  compareSets("docs/25 EffectStatus", parseDocs25EffectStatuses(), parseConstArray(effectSource, "EFFECT_STATUSES"));
  compareSets("docs/25 SseEventName", parseDocs25SseEvents(), parseStringUnion(sseSource, "SseEventName"));
  compareSets("docs/25 ProjectionKind", parseDocs25ProjectionKinds(), parseStringUnion(projectionSource, "ProjectionKind"));
  compareSets("docs/24 CodexTurnPurpose", parseDocs24TurnPurposes(), parseConstArray(codexSource, "CODEX_TURN_PURPOSES"));
  compareSets("docs/24 CodexArtifactKind", parseDocs24ArtifactKinds(), parseConstArray(codexSource, "CODEX_ARTIFACT_KINDS"));
  compareSets("docs/24 CodexApplyPolicy", parseDocs24ApplyPolicies(), parseConstArray(codexSource, "CODEX_APPLY_POLICIES"));
  compareSets("docs/24 BlockedActionType", parseDocs24BlockedActionTypes(), parseConstArray(codexSource, "BLOCKED_ACTION_TYPES"));
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

compareCommandTypes();
compareContractTaxonomies();
compareRoutes();
scanPackageBoundaries();

if (!process.exitCode) {
  console.log("doc contract checks passed");
}
