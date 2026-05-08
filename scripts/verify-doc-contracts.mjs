import { readdirSync, readFileSync, statSync } from "node:fs";
import { relative } from "node:path";
import { pathToFileURL, URL } from "node:url";

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

export function quotedValues(text) {
  return [...text.matchAll(/"([^"]+)"/g)].map((match) => match[1]);
}

export function parseConstArray(sourceText, name, seen = new Set()) {
  if (seen.has(name)) {
    throw new Error(`Circular const array spread for ${name}`);
  }

  seen.add(name);
  const match = sourceText.match(
    new RegExp(`(?:^|\\n)\\s*(?:export\\s+)?const\\s+${name}\\s*=\\s*\\[([\\s\\S]*?)\\]\\s+as const`)
  );

  if (!match) {
    throw new Error(`Could not find ${name}`);
  }

  const values = [];

  for (const token of match[1].matchAll(/\.\.\.([A-Z0-9_]+)|"([^"]+)"/g)) {
    const [, spreadName, quotedValue] = token;

    if (spreadName) {
      values.push(...parseConstArray(sourceText, spreadName, seen));
      continue;
    }

    values.push(quotedValue);
  }

  seen.delete(name);

  return values;
}

export function parseStringUnion(sourceText, name) {
  const match = sourceText.match(new RegExp(`export type ${name} =([\\s\\S]*?);`));

  if (!match) {
    throw new Error(`Could not find ${name}`);
  }

  return quotedValues(match[1]);
}

export function sectionBetween(text, start, end, label) {
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

export function markdownFirstColumnValues(section) {
  return [...section.matchAll(/^\| `([^`]+)` \|/gm)].map((match) => match[1]);
}

export function parseBacktickedValuesFromTableColumn(section, columnIndex) {
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

export function moduleSpecifiers(sourceText) {
  const importOrExportPattern = /(?:import|export)\s+(?:[^'"]*?\s+from\s+)?["']([^"']+)["']/g;

  return [...sourceText.matchAll(importOrExportPattern)].map((match) => match[1]);
}

export function moduleMatches(specifier, pattern) {
  if (pattern.endsWith("/") || pattern.endsWith(":")) {
    return specifier.startsWith(pattern);
  }

  return specifier === pattern || specifier.startsWith(`${pattern}/`);
}

function parseDocs25CommandTypes(docs25) {
  const section = sectionBetween(
    docs25,
    "### CommandType enum",
    "### ProductEngineCommand envelope",
    "docs/25 CommandType section"
  );

  return markdownFirstColumnValues(section);
}

function parseDocs25CommandActors(docs25) {
  const section = sectionBetween(
    docs25,
    "`CommandActor` enum:",
    "Example command envelope:",
    "docs/25 CommandActor section"
  );

  return markdownFirstColumnValues(section);
}

function parseDocs25EventTypes(docs25) {
  const section = sectionBetween(
    docs25,
    "Closed ProductEngine event type groups:",
    "### ProductEngineEffectPlanItem",
    "docs/25 ProductEngineEventType section"
  );

  return parseBacktickedValuesFromTableColumn(section, 1);
}

function parseDocs25EffectTypes(docs25) {
  const section = sectionBetween(
    docs25,
    "### EffectType enum",
    "### EffectStatus enum",
    "docs/25 EffectType section"
  );

  return markdownFirstColumnValues(section);
}

function parseDocs25EffectStatuses(docs25) {
  const section = sectionBetween(
    docs25,
    "### EffectStatus enum",
    "### EffectTaskDto",
    "docs/25 EffectStatus section"
  );

  return markdownFirstColumnValues(section);
}

export function parseDocs25DeterministicOutputTypes(docs25) {
  const section = sectionBetween(
    docs25,
    "| OutputType | Used by | Rule |",
    "## Effect and runtime types",
    "docs/25 ProductEngineDeterministicOutputType section"
  );

  return markdownFirstColumnValues(section);
}

function parseDocs25SseEvents(docs25) {
  const section = sectionBetween(
    docs25,
    "### SseEvent union",
    "### ProjectionRefetchHint",
    "docs/25 SseEvent section"
  );

  return markdownFirstColumnValues(section);
}

function parseDocs25ProjectionKinds(docs25) {
  const section = sectionBetween(
    docs25,
    "| Projection | File | Primary UI |",
    "### Projection minimum fields",
    "docs/25 ProjectionKind section"
  );

  return markdownFirstColumnValues(section);
}

function parseDocs24TurnPurposes(docs24) {
  const section = sectionBetween(
    docs24,
    "Phase 1에서 허용되는 Codex turnPurpose는 다음 6개뿐이다.",
    "## Input contract overview",
    "docs/24 turnPurpose section"
  );

  return markdownFirstColumnValues(section);
}

function parseDocs24ArtifactKinds(docs24) {
  const section = sectionBetween(
    docs24,
    "## Artifact field contracts",
    "## Blocked action taxonomy",
    "docs/24 artifact kind section"
  );

  return [...section.matchAll(/^### ([A-Za-z]+Artifact)$/gm)].map((match) => match[1]);
}

function parseDocs24ApplyPolicies(docs24) {
  const section = sectionBetween(
    docs24,
    "## applyPolicy enum",
    "Unknown applyPolicy",
    "docs/24 applyPolicy section"
  );

  return markdownFirstColumnValues(section);
}

function parseDocs24BlockedActionTypes(docs24) {
  const section = sectionBetween(
    docs24,
    "## Blocked action taxonomy",
    "## Auto-apply and gate matrix",
    "docs/24 blocked action section"
  );

  return markdownFirstColumnValues(section);
}

export function parseRouteCatalogFromSource(source) {
  const routeBlocks = [...source.matchAll(/\{([^{}]*routeId:\s*"[^"]+"[^{}]*)\}/gs)].map((match) => match[1]);
  const routes = new Map();

  for (const block of routeBlocks) {
    const routeId = block.match(/routeId: "([^"]+)"/)?.[1] ?? "(unknown routeId)";
    const rawMethod = block.match(/method: "([^"]+)"/)?.[1];
    const path = block.match(/path: "([^"]+)"/)?.[1];
    const queryBlock = block.match(/requiredQueryParams: \[([^\]]*)\]/)?.[1];
    const queryParams = queryBlock ? quotedValues(queryBlock) : [];

    if (rawMethod !== "GET" && rawMethod !== "POST") {
      throw new Error(`Unsupported or missing API route method for ${routeId}: ${rawMethod ?? "(missing)"}`);
    }

    if (!path) {
      throw new Error(`Missing API route path for ${routeId}`);
    }

    routes.set(`${rawMethod} ${path}`, queryParams);
  }

  return routes;
}

export function parseDocs26RoutesFromText(docs26) {
  const routes = new Map();

  for (const match of docs26.matchAll(/\| `((?:GET|POST) [^`]+)` \|/g)) {
    const [method, endpoint] = match[1].split(" ", 2);
    const [path, query = ""] = endpoint.split("?");
    const queryParams = query
      ? query.split("&").filter(Boolean).map((part) => part.split("=")[0])
      : [];

    routes.set(`${method} ${path}`, queryParams);
  }

  return routes;
}

export function compareSets(label, docsValues, codeValues) {
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

function createContractTaxonomyChecks({ docs24, docs25 }) {
  const commandSource = readText("packages/contracts/src/product-engine/commands.ts");
  const eventSource = readText("packages/contracts/src/product-engine/events.ts");
  const effectSource = readText("packages/contracts/src/effects/tasks.ts");
  const sseSource = readText("packages/contracts/src/sse/events.ts");
  const projectionSource = readText("packages/contracts/src/projections/index.ts");
  const codexSource = readText("packages/contracts/src/codex/reexports.ts");

  return [
    {
      label: "docs/25 CommandType",
      docsValues: parseDocs25CommandTypes(docs25),
      codeValues: parseConstArray(commandSource, "COMMAND_TYPES")
    },
    {
      label: "docs/25 CommandActor",
      docsValues: parseDocs25CommandActors(docs25),
      codeValues: parseConstArray(commandSource, "COMMAND_ACTORS")
    },
    {
      label: "docs/25 ProductEngineEventType",
      docsValues: parseDocs25EventTypes(docs25),
      codeValues: parseConstArray(eventSource, "PRODUCT_ENGINE_EVENT_TYPES")
    },
    {
      label: "docs/25 EffectType",
      docsValues: parseDocs25EffectTypes(docs25),
      codeValues: parseConstArray(effectSource, "EFFECT_TYPES")
    },
    {
      label: "docs/25 EffectStatus",
      docsValues: parseDocs25EffectStatuses(docs25),
      codeValues: parseConstArray(effectSource, "EFFECT_STATUSES")
    },
    {
      label: "docs/25 SseEventName",
      docsValues: parseDocs25SseEvents(docs25),
      codeValues: parseStringUnion(sseSource, "SseEventName")
    },
    {
      label: "docs/25 ProjectionKind",
      docsValues: parseDocs25ProjectionKinds(docs25),
      codeValues: parseStringUnion(projectionSource, "ProjectionKind")
    },
    {
      label: "docs/24 CodexTurnPurpose",
      docsValues: parseDocs24TurnPurposes(docs24),
      codeValues: parseConstArray(codexSource, "CODEX_TURN_PURPOSES")
    },
    {
      label: "docs/24 CodexArtifactKind",
      docsValues: parseDocs24ArtifactKinds(docs24),
      codeValues: parseConstArray(codexSource, "CODEX_ARTIFACT_KINDS")
    },
    {
      label: "docs/24 CodexApplyPolicy",
      docsValues: parseDocs24ApplyPolicies(docs24),
      codeValues: parseConstArray(codexSource, "CODEX_APPLY_POLICIES")
    },
    {
      label: "docs/24 BlockedActionType",
      docsValues: parseDocs24BlockedActionTypes(docs24),
      codeValues: parseConstArray(codexSource, "BLOCKED_ACTION_TYPES")
    }
  ];
}

function compareContractTaxonomies(docs) {
  for (const { label, docsValues, codeValues } of createContractTaxonomyChecks(docs)) {
    compareSets(label, docsValues, codeValues);
  }
}

function checkPlanningHandoffContractPromotion(docs25) {
  const deterministicOutputTypes = {
    docsValues: parseDocs25DeterministicOutputTypes(docs25),
    codeValues: parseStringUnion(
      readText("packages/contracts/src/product-engine/reduction.ts"),
      "ProductEngineDeterministicOutputType"
    )
  };
  const requiredDeterministicOutputType = "planning_handoff_artifact";
  const missing = [];

  if (!deterministicOutputTypes.docsValues.includes(requiredDeterministicOutputType)) {
    missing.push(`docs/25 OutputType table missing ${requiredDeterministicOutputType}`);
  }

  if (!deterministicOutputTypes.codeValues.includes(requiredDeterministicOutputType)) {
    missing.push(`ProductEngineDeterministicOutputType missing ${requiredDeterministicOutputType}`);
  }

  if (missing.length) {
    fail("Planning Handoff deterministic output promotion mismatch", missing);
  }
}

export function findRouteQueryMismatches(docsRoutes, codeRoutes) {
  const queryMismatches = [];

  for (const [route, docsQuery] of docsRoutes.entries()) {
    const codeQuery = codeRoutes.get(route);

    if (!codeQuery) {
      continue;
    }

    const docsSet = new Set(docsQuery);
    const codeSet = new Set(codeQuery);
    const missingInCode = [...docsSet].filter((value) => !codeSet.has(value)).sort();
    const extraInCode = [...codeSet].filter((value) => !docsSet.has(value)).sort();

    if (missingInCode.length || extraInCode.length) {
      queryMismatches.push(
        `${route}: missing in code=[${missingInCode.join(",") || "(none)"}] extra in code=[${extraInCode.join(",") || "(none)"}]`
      );
    }
  }

  return queryMismatches;
}

function compareRoutes(docs26) {
  const docsRoutes = parseDocs26RoutesFromText(docs26);
  const codeRoutes = parseRouteCatalogFromSource(readText("packages/contracts/src/api/routes.ts"));

  compareSets("docs/26 route catalog", [...docsRoutes.keys()], [...codeRoutes.keys()]);

  const queryMismatches = findRouteQueryMismatches(docsRoutes, codeRoutes);

  if (queryMismatches.length) {
    fail("docs/26 route query mismatch", queryMismatches);
  }
}

export const DEFAULT_PACKAGE_BOUNDARY_CHECKS = [
  {
    root: "packages/core/src",
    forbiddenModules: ["hono", "@hono/", "@tauri-apps/", "react", "react-dom", "node:", "http", "https"]
  },
  {
    root: "apps/desktop/src",
    forbiddenModules: ["@solo-superman/db", "@libsql/", "libsql", "sqlite", "sqlite3", "better-sqlite3"]
  },
  {
    root: "packages/contracts/src",
    forbiddenModules: ["hono", "@hono/", "@tauri-apps/", "react", "react-dom", "drizzle-orm", "drizzle-kit"]
  }
];

export function collectPackageBoundaryViolations({ root = ROOT, checks = DEFAULT_PACKAGE_BOUNDARY_CHECKS } = {}) {
  const violations = [];

  for (const check of checks) {
    const pending = [new URL(`${check.root}/`, root)];

    while (pending.length) {
      const dir = pending.pop();
      const entries = readdirSync(dir).sort();

      for (const entry of entries) {
        const url = new URL(entry, `${dir.href.replace(/\/?$/, "/")}`);
        const stat = statSync(url);

        if (stat.isDirectory()) {
          pending.push(url);
          continue;
        }

        if (!/\.(ts|tsx)$/.test(url.pathname)) {
          continue;
        }

        const imports = moduleSpecifiers(readFileSync(url, "utf8"));

        for (const specifier of imports) {
          for (const forbidden of check.forbiddenModules) {
            if (moduleMatches(specifier, forbidden)) {
              violations.push(`${relative(root.pathname, url.pathname)} imports ${specifier}`);
            }
          }
        }
      }
    }
  }

  return violations.sort();
}

function scanPackageBoundaries() {
  const violations = collectPackageBoundaryViolations();

  if (violations.length) {
    fail("package boundary import scan", violations);
  }
}

const PHASE15_DOC_PATH = "docs/30-phase1.5-research-runtime-and-readiness-contract.md";

const PHASE15_REQUIRED_REFERENCES = [
  "docs/README.md",
  "docs/06-research-engine.md",
  "docs/10-security-privacy-and-approval.md",
  "docs/11-roadmap-and-phase-boundaries.md",
  "docs/12-validation-and-dry-run.md",
  "docs/17-ai-runtime-access-strategy.md",
  "docs/20-data-storage-contract.md",
  "docs/21-sidecar-api-runtime-contract.md",
  "docs/23-product-engine-runtime-contract.md",
  "docs/24-codex-prompt-output-contract.md",
  "docs/25-contracts-dto-catalog.md",
  "docs/26-api-route-behavior-catalog.md",
  "docs/27-operations-observability-contract.md",
  "docs/28-founder-os-product-doctrine.md",
  "docs/29-phase-capability-implementation-matrix.md"
];

const PHASE15_REQUIRED_CONTRACT_SNIPPETS = [
  "doc 30",
  "ResearchAllowlist",
  "BackgroundResearchRun state machine",
  "Phase15bUpgradeHints",
  "No-execution preservation",
  "Allowlist happy path",
  "Private source approval gate",
  "Phase 1.5B no-execution preservation",
  "Hint export/readiness reuse",
  "Docs contract consistency",
  "phase15bUpgradeHints` remains readiness metadata, not an execution permission"
];

const PHASE15_PHASE2_HINT_REFERENCE_REQUIREMENTS = [
  {
    path: "docs/31-phase2-planning-handoff-contract.md",
    snippets: [
      "30-phase1.5-research-runtime-and-readiness-contract.md",
      "Phase 1.5B `phase15bUpgradeHints`는 실행 권한이 아니라 Phase 2 handoff의 readiness metadata source다.",
      "without treating hints as execution permission"
    ]
  },
  {
    path: "docs/32-phase2-implementation-preflight-contract.md",
    snippets: [
      "30-phase1.5-research-runtime-and-readiness-contract.md",
      "without reinterpreting them as execution permission",
      "They cannot create final `PlanningHandoffArtifact` without the gate algorithm above."
    ]
  }
];

const PHASE15_NO_EXECUTION_DOC_PATHS = [
  ...new Set([
    PHASE15_DOC_PATH,
    ...PHASE15_REQUIRED_REFERENCES,
    ...PHASE15_PHASE2_HINT_REFERENCE_REQUIREMENTS.map((requirement) => requirement.path)
  ])
];

const PHASE15B_EXECUTION_PERMISSION_DENY_PATTERNS = [
  /Phase 1\.5B[^.\n]*(?:may|can|allows?|enabled|grants?|permitted|permission to)\s+(?:execute|run|apply|perform)/iu,
  /Phase 1\.5B[^.\n]*(?:file patch|shell command|browser action|network write|credential access|destructive operation|ChatGPT web automation)[^.\n]*(?:enabled|allowed|permitted|executes|runs|applies|performs)/iu,
  /(?:file patch|shell command|browser action|network write|credential access|destructive operation|ChatGPT web automation)[^.\n]*(?:enabled|allowed|permitted|executes|runs|applies|performs)[^.\n]*Phase 1\.5B/iu
];

const PHASE15B_NEGATED_EXECUTION_PATTERNS = [
  /Phase 1\.5B[^.\n]*(?:must not|do not|does not|cannot|never)[^.\n]*(?:execute|run|apply|perform)/iu,
  /no document claims[^.\n]*Phase 1\.5B[^.\n]*(?:execute|run|apply|perform)/iu,
  /Phase 1\.5B[^.\n]*(?:no-execution|not execution permission|실행 권한이 아니라|실행하지|금지)/iu,
  /(?:file patch|shell command|browser action|network write|credential access|destructive operation|ChatGPT web automation)[^.\n]*(?:must not|cannot|never|not allowed|not permitted|not enabled)[^.\n]*Phase 1\.5B/iu
];

function findExecutionPermissionClaims(documents, { denyPatterns, negatedPatterns }) {
  const claims = [];

  for (const document of documents) {
    document.text.split(/\r?\n/u).forEach((line, index) => {
      const trimmed = line.trim();

      if (!trimmed || !denyPatterns.some((pattern) => pattern.test(trimmed))) {
        return;
      }

      if (negatedPatterns.some((pattern) => pattern.test(trimmed))) {
        return;
      }

      claims.push(`${document.path}:${index + 1}: ${trimmed}`);
    });
  }

  return claims;
}

export function findPhase15bExecutionPermissionClaims(documents) {
  return findExecutionPermissionClaims(documents, {
    denyPatterns: PHASE15B_EXECUTION_PERMISSION_DENY_PATTERNS,
    negatedPatterns: PHASE15B_NEGATED_EXECUTION_PATTERNS
  });
}

const PHASE25_DOC_PATH = "docs/34-phase2.5-browser-automation-preview-contract.md";

const PHASE25_REQUIRED_REFERENCES = [
  "docs/README.md",
  "docs/10-security-privacy-and-approval.md",
  "docs/11-roadmap-and-phase-boundaries.md",
  "docs/12-validation-and-dry-run.md",
  "docs/17-ai-runtime-access-strategy.md",
  "docs/29-phase-capability-implementation-matrix.md"
];

const PHASE25_REQUIRED_CONTRACT_SNIPPETS = [
  "DelegationRiskGate",
  "ResearchQualityComparisonReport",
  "comparative dry-run",
  "No-execution boundary",
  "Scenario A. Comparative dry-run shows quality lift",
  "Scenario B. Policy or account risk blocks ChatGPT Pro delegation"
];

const PHASE25_NO_EXECUTION_DOC_PATHS = [...new Set([PHASE25_DOC_PATH, ...PHASE25_REQUIRED_REFERENCES])];

const PHASE25_EXECUTION_PERMISSION_DENY_PATTERNS = [
  /Phase 2\.5[^.\n]*(?:may|can|allows?|enabled|grants?|permitted|permission to)\s+(?:execute|run|apply|perform|submit|write|deploy|mutate|store|share|implement)/iu,
  /Phase 2\.5[^.\n]*(?:file patch|shell command|browser action|POST|write action|submit|credential custody|session custody|account sharing|team|mobile|billing|DTO\/API\/storage preflight)[^.\n]*(?:enabled|allowed|permitted|executes|runs|applies|performs|stores|shares|implements)/iu,
  /(?:file patch|shell command|browser action|POST|write action|submit|credential custody|session custody|account sharing|team|mobile|billing|DTO\/API\/storage preflight)[^.\n]*(?:enabled|allowed|permitted|executes|runs|applies|performs|stores|shares|implements)[^.\n]*Phase 2\.5/iu,
  /Phase 2\.5[^.\n]*(?:file patch|shell command|browser action|POST|write action|submit\/write|submit|write|deploy|external mutation|credential(?:\/session)? custody|credential storage|session custody|account sharing(?:\/resale)?|team\/mobile\/billing|DTO\/API\/storage(?: preflight)?|브라우저 action|브라우저 액션|제출|쓰기|배포|외부 변경|인증정보|세션|계정 공유|팀|모바일|결제|과금)[^.\n]*(?:enabled|allowed|permitted|executes|runs|applies|performs|stores|shares|implements|허용|가능|실행|수행|제출|쓰기|배포|변경|저장|공유|구현|승격|확장|포함)/iu
];

const PHASE25_NEGATED_EXECUTION_PATTERNS = [
  /Phase 2\.5[^.\n]*(?:must not|do not|does not|cannot|never|not allowed|not permitted)[^.\n]*(?:execute|run|apply|perform|submit|write|deploy|mutate|store|share|implement)/iu,
  /Phase 2\.5[^.\n]*(?:no-execution|not execution|not an execution|not active permission|실행 단계가 아니다|실행하지|허용하지|하지 않는다|금지|아니다|차단)/iu,
  /no document claims[^.\n]*Phase 2\.5[^.\n]*(?:execute|run|apply|perform|submit|write|deploy|mutate|store|share|implement)/iu,
  /(?:file patch|shell command|browser action|POST|write action|submit|credential custody|session custody|account sharing|team|mobile|billing|DTO\/API\/storage preflight)[^.\n]*(?:must not|cannot|never|not allowed|not permitted|not enabled|금지|하지 않는다|허용하지)[^.\n]*Phase 2\.5/iu
];

export function findPhase25ExecutionPermissionClaims(documents) {
  return findExecutionPermissionClaims(documents, {
    denyPatterns: PHASE25_EXECUTION_PERMISSION_DENY_PATTERNS,
    negatedPatterns: PHASE25_NEGATED_EXECUTION_PATTERNS
  });
}

const PHASE12_CLOSEOUT_DOC_PATH = "docs/35-phase1-2-closeout-evidence.md";

const PHASE12_CLOSEOUT_REQUIRED_REFERENCES = [
  "docs/README.md",
  "docs/12-validation-and-dry-run.md"
];

const PHASE12_CLOSEOUT_REQUIRED_SNIPPETS = [
  "Child issue evidence ledger",
  "#66",
  "#67",
  "#68",
  "#69",
  "#70",
  "#71",
  "#74",
  "#75",
  "Phase 1 canonical output dry-run",
  "Phase 1.5A allowlist/research lifecycle dry-run",
  "apps/sidecar/src/server.test.ts",
  "Phase 1.5B hint/no-execution dry-run",
  "Phase 2 final/blocker Planning Handoff dry-run",
  "Completion Candidate or Founder Brief",
  "Route/DTO/projection/SSE contract drift",
  "No-execution boundary",
  "pnpm verify",
  "pnpm smoke:e2e",
  "node scripts/verify-doc-contracts.mjs",
  "Tracker #65 update rule"
];

const PHASE12_CLOSEOUT_FIXTURE_SNIPPETS = [
  "PHASE1_2_CLOSEOUT_EVIDENCE",
  "PHASE2_ACCEPTANCE_EVIDENCE_MAP",
  "Scenario H. Phase 2 final Planning Handoff dry-run",
  "Scenario I. Phase 2 blocker Planning Handoff dry-run",
  "no_file_shell_browser_deploy_or_external_mutation",
  "docs/35 closeout report"
];

function requireSnippets(message, text, snippets) {
  const missingSnippets = snippets.filter((snippet) => !text.includes(snippet));

  if (missingSnippets.length) {
    fail(message, missingSnippets);
  }
}

function requireDocReferences(message, docPaths, requiredSnippet) {
  const missingReferences = docPaths.filter((docPath) => !readText(docPath).includes(requiredSnippet));

  if (missingReferences.length) {
    fail(message, missingReferences);
  }
}

function requireNoExecutionPermissionClaims(message, docPaths, findClaims) {
  const executionPermissionClaims = findClaims(docPaths.map((path) => ({ path, text: readText(path) })));

  if (executionPermissionClaims.length) {
    fail(message, executionPermissionClaims);
  }
}

function checkPhase15DocConsistency() {
  const docs30 = readText(PHASE15_DOC_PATH);

  requireSnippets("docs/30 Phase 1.5 canonical contract missing required sections", docs30, PHASE15_REQUIRED_CONTRACT_SNIPPETS);

  if (docs30.includes("28-phase1.5-research-runtime-and-readiness-contract.md") || docs30.includes("doc 28")) {
    fail("docs/30 Phase 1.5 canonical contract contains stale doc 28 reference");
  }

  requireDocReferences(
    "Phase 1.5 canonical doc reference missing",
    PHASE15_REQUIRED_REFERENCES,
    "30-phase1.5-research-runtime-and-readiness-contract.md"
  );

  const missingPhase2HintReferences = [];

  for (const requirement of PHASE15_PHASE2_HINT_REFERENCE_REQUIREMENTS) {
    const text = readText(requirement.path);
    const missing = requirement.snippets.filter((snippet) => !text.includes(snippet));

    for (const snippet of missing) {
      missingPhase2HintReferences.push(`${requirement.path}: ${snippet}`);
    }
  }

  if (missingPhase2HintReferences.length) {
    fail("Phase 1.5B hint reuse/no-execution reference missing from Phase 2 docs", missingPhase2HintReferences);
  }

  requireNoExecutionPermissionClaims(
    "Phase 1.5B docs claim forbidden execution permission",
    PHASE15_NO_EXECUTION_DOC_PATHS,
    findPhase15bExecutionPermissionClaims
  );
}

function checkPhase25DocConsistency() {
  const docs34 = readText(PHASE25_DOC_PATH);

  requireSnippets("docs/34 Phase 2.5 canonical contract missing required sections", docs34, PHASE25_REQUIRED_CONTRACT_SNIPPETS);

  requireDocReferences(
    "Phase 2.5 canonical doc reference missing",
    PHASE25_REQUIRED_REFERENCES,
    "34-phase2.5-browser-automation-preview-contract.md"
  );

  requireNoExecutionPermissionClaims(
    "Phase 2.5 docs claim forbidden execution permission",
    PHASE25_NO_EXECUTION_DOC_PATHS,
    findPhase25ExecutionPermissionClaims
  );
}

function checkPhase12CloseoutConsistency() {
  const docs35 = readText(PHASE12_CLOSEOUT_DOC_PATH);
  const e2eFixture = readText("apps/sidecar/src/e2e-dry-run.fixture.ts");

  requireSnippets("docs/35 Phase 1~2 closeout report missing required evidence", docs35, PHASE12_CLOSEOUT_REQUIRED_SNIPPETS);
  requireSnippets(
    "e2e dry-run fixture missing Phase 1~2 closeout evidence labels",
    e2eFixture,
    PHASE12_CLOSEOUT_FIXTURE_SNIPPETS
  );
  requireDocReferences(
    "Phase 1~2 closeout report reference missing",
    PHASE12_CLOSEOUT_REQUIRED_REFERENCES,
    PHASE12_CLOSEOUT_DOC_PATH
  );
}

export function runDocContractChecks() {
  const docs = {
    docs24: readText("docs/24-codex-prompt-output-contract.md"),
    docs25: readText("docs/25-contracts-dto-catalog.md"),
    docs26: readText("docs/26-api-route-behavior-catalog.md")
  };

  compareContractTaxonomies(docs);
  checkPlanningHandoffContractPromotion(docs.docs25);
  compareRoutes(docs.docs26);
  scanPackageBoundaries();
  checkPhase15DocConsistency();
  checkPhase25DocConsistency();
  checkPhase12CloseoutConsistency();

  if (!process.exitCode) {
    console.log("doc contract checks passed");
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  runDocContractChecks();
}
