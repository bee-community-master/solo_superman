import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { relative } from "node:path";
import { fileURLToPath, pathToFileURL, URL } from "node:url";

const ROOT = new URL("../", import.meta.url);
const DOCS_DIR = new URL("docs/", ROOT);

export const CONTRIBUTOR_DOC_PATHS = [
  "docs/README.md",
  "docs/product.md",
  "docs/contributing.md",
  "docs/architecture.md",
  "docs/safety-and-permissions.md",
  "docs/roadmap.md",
  "docs/decisions.md",
  "docs/reference.md",
  "docs/troubleshooting.md"
];

export const WEB_REALIGNMENT_SCAN_PATHS = CONTRIBUTOR_DOC_PATHS;

function readText(path) {
  return readFileSync(new URL(path, ROOT), "utf8");
}

function relativeUrlPath(root, url) {
  return relative(fileURLToPath(root), fileURLToPath(url));
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

function parseReferenceCommandTypes(reference) {
  return markdownFirstColumnValues(
    sectionBetween(reference, "### CommandType enum", "### ProductEngineCommand envelope", "reference CommandType section")
  );
}

function parseReferenceCommandActors(reference) {
  return markdownFirstColumnValues(
    sectionBetween(reference, "`CommandActor` enum:", "Example command envelope:", "reference CommandActor section")
  );
}

function parseReferenceEventTypes(reference) {
  return parseBacktickedValuesFromTableColumn(
    sectionBetween(
      reference,
      "Closed ProductEngine event type groups:",
      "### ProductEngineEffectPlanItem",
      "reference ProductEngineEventType section"
    ),
    1
  );
}

function parseReferenceEffectTypes(reference) {
  return markdownFirstColumnValues(
    sectionBetween(reference, "### EffectType enum", "### EffectStatus enum", "reference EffectType section")
  );
}

function parseReferenceEffectStatuses(reference) {
  return markdownFirstColumnValues(
    sectionBetween(reference, "### EffectStatus enum", "### EffectTaskDto", "reference EffectStatus section")
  );
}

export function parseDocs25DeterministicOutputTypes(reference) {
  return markdownFirstColumnValues(
    sectionBetween(
      reference,
      "| OutputType | Used by | Rule |",
      "## Effect and runtime types",
      "reference ProductEngineDeterministicOutputType section"
    )
  );
}

function parseReferenceCodexTurnPurposes(reference) {
  return markdownFirstColumnValues(
    sectionBetween(
      reference,
      "Phase 1에서 허용되는 Codex turnPurpose는 다음 6개뿐이다.",
      "## Input contract overview",
      "reference CodexTurnPurpose section"
    )
  );
}

function parseReferenceArtifactKinds(reference) {
  return [
    ...sectionBetween(reference, "## Artifact field contracts", "## Blocked action taxonomy", "reference artifact kind section").matchAll(
      /^### ([A-Za-z]+Artifact)$/gm
    )
  ].map((match) => match[1]);
}

function parseReferenceBlockedActionTypes(reference) {
  return markdownFirstColumnValues(
    sectionBetween(reference, "## Blocked action taxonomy", "## Auto-apply and gate matrix", "reference blocked action section")
  );
}

function parseReferenceApplyPolicies(reference) {
  return markdownFirstColumnValues(
    sectionBetween(reference, "## applyPolicy enum", "Unknown applyPolicy", "reference applyPolicy section")
  );
}

function parseReferenceSseEvents(reference) {
  return markdownFirstColumnValues(
    sectionBetween(reference, "### SseEvent union", "### ProjectionRefetchHint", "reference SseEvent section")
  );
}

function parseReferenceProjectionKinds(reference) {
  return markdownFirstColumnValues(
    sectionBetween(reference, "| Projection | File | Primary UI |", "### Projection minimum fields", "reference ProjectionKind section")
  );
}

export function parseRouteCatalogFromSource(source) {
  const routeBlocks = [...source.matchAll(/\{([^{}]*routeId:\s*"[^"]+"[^{}]*)\}/gs)].map((match) => match[1]);
  const routes = new Map();

  for (const block of routeBlocks) {
    const routeId = block.match(/routeId: "([^"]+)"/)?.[1] ?? "(unknown routeId)";
    const rawMethod = block.match(/method: "([^"]+)"/)?.[1];
    const path = block.match(/path: "([^"]+)"/)?.[1];

    if (rawMethod !== "GET" && rawMethod !== "POST") {
      throw new Error(`Unsupported or missing API route method for ${routeId}: ${rawMethod ?? "missing"}`);
    }

    if (!path) {
      throw new Error(`Missing API route path for ${routeId}`);
    }

    const requiredQueryParams = block.match(/requiredQueryParams:\s*\[([^\]]*)\]/s)?.[1];
    const queryParams = requiredQueryParams ? quotedValues(requiredQueryParams).sort() : [];
    routes.set(`${rawMethod} ${path}`, queryParams);
  }

  return routes;
}

export function parseDocs26RoutesFromText(text) {
  const routes = new Map();

  for (const row of text.matchAll(/^\| `([A-Z]+) ([^`]+)` \|([^\n]+)\|$/gm)) {
    const [, method, rawPath, rest] = row;
    const [path, queryString] = rawPath.split("?");
    const queryParamsFromPath = queryString
      ? queryString.split("&").map((part) => part.split("=")[0]?.replace(/^:/u, "")).filter(Boolean)
      : [];
    const cells = rest.split("|").map((cell) => cell.trim());
    const requiredQueryCell = cells[2] ?? "-";
    const queryParamsFromCell = requiredQueryCell === "-"
      ? []
      : requiredQueryCell.replace(/`/g, "").split(",").map((value) => value.trim()).filter(Boolean);
    const queryParams = [...new Set([...queryParamsFromPath, ...queryParamsFromCell])];
    routes.set(`${method} ${path}`, queryParams);
  }

  return routes;
}

function compareSets(label, docsValues, codeValues) {
  const docsSet = new Set(docsValues);
  const codeSet = new Set(codeValues);
  const missingInDocs = [...codeSet].filter((value) => !docsSet.has(value));
  const extraInDocs = [...docsSet].filter((value) => !codeSet.has(value));

  if (missingInDocs.length || extraInDocs.length) {
    fail(`${label} drift`, [
      `missing in docs=[${missingInDocs.join(", ")}]`,
      `extra in docs=[${extraInDocs.join(", ")}]`
    ]);
  }
}

export function findRouteQueryMismatches(docsRoutes, codeRoutes) {
  const mismatches = [];

  for (const [route, docsQueryParams] of docsRoutes.entries()) {
    const codeQueryParams = codeRoutes.get(route) ?? [];
    const docsSet = new Set(docsQueryParams);
    const codeSet = new Set(codeQueryParams);
    const missingInCode = [...docsSet].filter((value) => !codeSet.has(value));
    const extraInCode = [...codeSet].filter((value) => !docsSet.has(value));

    if (missingInCode.length || extraInCode.length) {
      mismatches.push(`${route}: missing in code=[${missingInCode.join(", ")}] extra in code=[${extraInCode.join(", ")}]`);
    }
  }

  return mismatches;
}

function collectFiles(rootUrl, extensions) {
  const pending = [rootUrl];
  const files = [];

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

      if (extensions.some((extension) => url.pathname.endsWith(extension))) {
        files.push(url);
      }
    }
  }

  return files.sort((a, b) => a.pathname.localeCompare(b.pathname));
}

const PACKAGE_BOUNDARY_CHECKS = [
  { root: "packages/core/src", forbiddenModules: ["hono", "@libsql/", "drizzle-orm/", "node:fs", "node:http", "node:https"] },
  { root: "apps/web/src", forbiddenModules: ["@solo-superman/db", "node:", "hono"] },
  { root: "packages/contracts/src", forbiddenModules: ["hono", "@libsql/", "drizzle-orm/", "node:fs", "node:http", "node:https"] }
];

export function collectPackageBoundaryViolations({ root = ROOT, checks = PACKAGE_BOUNDARY_CHECKS } = {}) {
  const violations = [];

  for (const check of checks) {
    const checkRoot = new URL(`${check.root}/`, root);

    if (!existsSync(checkRoot)) {
      continue;
    }

    const files = collectFiles(checkRoot, [".ts", ".tsx", ".js", ".mjs"]);

    for (const url of files) {
      const imports = moduleSpecifiers(readFileSync(url, "utf8"));

      for (const specifier of imports) {
        for (const forbidden of check.forbiddenModules) {
          if (moduleMatches(specifier, forbidden)) {
            violations.push(`${relativeUrlPath(root, url)} imports ${specifier}`);
          }
        }
      }
    }
  }

  return violations.sort();
}

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

export function findPhase25ExecutionPermissionClaims(documents) {
  return findExecutionPermissionClaims(documents, {
    denyPatterns: PHASE25_EXECUTION_PERMISSION_DENY_PATTERNS,
    negatedPatterns: PHASE25_NEGATED_EXECUTION_PATTERNS
  });
}

const WEB_REALIGNMENT_FUTURE_DEFAULT_DENY_PATTERNS = [
  /macOS-first,\s*local-first Founder OS/iu,
  /Tauri\/React\/local embedded libSQL\/Spec Engine은 core/iu,
  /Tauri \+ React\/Vite desktop shell \+ Node\/Hono sidecar/iu,
  /Desktop shell\s*\|\s*Tauri v2\s*\|\s*core 확정/iu,
  /Phase 1은 macOS desktop \+ local-first를 우선한다/iu,
  /Tauri \+ Node\/Hono sidecar topology/iu,
  /Implementation Architecture\s*\|\s*Tauri \+ Node\/Hono sidecar/iu,
  /Core stack:\s*Tauri\/React\/local embedded libSQL\/Spec Engine/iu,
  /legacy\/current/iu,
  /compatibility residue/iu,
  /\bapps\/desktop\b/iu,
  /@solo-superman\/desktop/iu,
  /\bdev:desktop\b/iu,
  /\bsrc-tauri\b/iu,
  /\bdev:tauri\b/iu,
  /Phase 2\+/iu,
  /\bDesktop UI\b/iu,
  /\bdesktop UI\b/iu,
  /native shell replacement/iu,
  /Desktop review UI/iu,
  /desktop read-only/iu,
  /desktop readiness/iu,
  /desktop trigger/iu,
  /Desktop session/iu,
  /desktop\/local source of truth/iu,
  /through the Tauri native boundary/iu
];

export function findWebRealignmentFutureDefaultClaims(documents) {
  const claims = [];

  for (const document of documents) {
    document.text.split(/\r?\n/u).forEach((line, index) => {
      const trimmed = line.trim();

      if (!trimmed) {
        return;
      }

      if (WEB_REALIGNMENT_FUTURE_DEFAULT_DENY_PATTERNS.some((pattern) => pattern.test(trimmed))) {
        claims.push(`${document.path}:${index + 1}: ${trimmed}`);
      }
    });
  }

  return claims;
}

const WEB_LOCAL_REMOVAL_MANIFEST_PATHS = [
  "package.json",
  "pnpm-lock.yaml",
  "scripts/dev-with-local-token.mjs",
  "apps/web/package.json"
];

const WEB_LOCAL_REMOVAL_SCAN_ROOTS = ["apps/web/src", "apps/sidecar/src"];

const WEB_LOCAL_ACTIVE_DENY_PATTERNS = [
  /@tauri-apps\//u,
  /\bsrc-tauri\b/u,
  /\bdev:tauri\b/u,
  /@solo-superman\/desktop/u,
  /\bapps\/desktop\b/u,
  /\bdev:desktop\b/u,
  /tauri dev/u,
  /get_sidecar_base_url/u
];

function collectTextFiles(paths, roots) {
  const files = [...paths];

  for (const rootPath of roots) {
    const pending = [new URL(`${rootPath}/`, ROOT)];

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

        if (!/\.(ts|tsx|js|mjs|json|yaml|yml|html|css)$/.test(url.pathname)) {
          continue;
        }

        files.push(relativeUrlPath(ROOT, url));
      }
    }
  }

  return [...new Set(files)].sort();
}

export function findWebLocalActiveResidue(documents) {
  const claims = [];

  for (const document of documents) {
    document.text.split(/\r?\n/u).forEach((line, index) => {
      const trimmed = line.trim();

      if (!trimmed) {
        return;
      }

      if (WEB_LOCAL_ACTIVE_DENY_PATTERNS.some((pattern) => pattern.test(trimmed))) {
        claims.push(`${document.path}:${index + 1}: ${trimmed}`);
      }
    });
  }

  return claims;
}

function requireSnippets(message, text, snippets) {
  const missingSnippets = snippets.filter((snippet) => !text.includes(snippet));

  if (missingSnippets.length) {
    fail(message, missingSnippets);
  }
}

function checkContributorDocsShape() {
  const missingDocs = CONTRIBUTOR_DOC_PATHS.filter((path) => !existsSync(new URL(path, ROOT)));

  if (missingDocs.length) {
    fail("contributor docs missing", missingDocs);
  }

  const numberedDocs = readdirSync(DOCS_DIR).filter((entry) => /^\d{2}-.+\.md$/u.test(entry));

  if (numberedDocs.length) {
    fail("numbered implementation-planning docs should be consolidated", numberedDocs);
  }

  const hub = readText("docs/README.md");
  const missingHubLinks = CONTRIBUTOR_DOC_PATHS.filter((path) => path !== "docs/README.md").filter((path) => {
    const basename = path.replace("docs/", "");
    return !hub.includes(`(${basename})`);
  });

  if (missingHubLinks.length) {
    fail("docs hub missing contributor doc links", missingHubLinks);
  }
}

function checkContributorDocsSnippets() {
  const docs = Object.fromEntries(CONTRIBUTOR_DOC_PATHS.map((path) => [path, readText(path)]));

  requireSnippets("docs/README onboarding posture missing", docs["docs/README.md"], [
    "Contributor Docs",
    "local-first web app + local Node/Hono service",
    "Local Web Frontend -> Local Node/Hono Service -> ProductEngine/contracts/db",
    "no hosted SaaS default",
    "ExecutionAuthorityRecord",
    "old numbered planning docs"
  ]);

  requireSnippets("product overview missing product decisions", docs["docs/product.md"], [
    "local-first Founder OS",
    "Decision Queue",
    "Living Product Spec",
    "businessCriticIntensity",
    "2~5 hour",
    "no default value"
  ]);

  requireSnippets("contributing guide missing contributor commands", docs["docs/contributing.md"], [
    "pnpm start:local",
    "pnpm verify:docs",
    "packages/contracts",
    "PR checklist"
  ]);

  requireSnippets("architecture doc missing runtime boundary", docs["docs/architecture.md"], [
    "Local Web Frontend",
    "Local Node/Hono Service",
    "ProductEngine/application command boundary",
    "Read-only diagnostics time out at 30 seconds",
    "per-run local capability token",
    "CSRF/replay",
    "hosted web origin",
    "Tauri/native shell source"
  ]);

  requireSnippets("safety doc missing permission guardrails", docs["docs/safety-and-permissions.md"], [
    "No credential/2FA/session custody",
    "account sharing/resale",
    "ExecutionAuthorityRecord",
    "approvalDecision` starts as `pending`",
    "executionResult` includes `running`",
    "rollbackReference",
    "git_diff_reverse",
    "external-production mutation",
    "blanket approval",
    "ServicePageUsePermission"
  ]);

  requireSnippets("roadmap doc missing phase history", docs["docs/roadmap.md"], [
    "Phase 1.5B",
    "not execution permission",
    "Phase 2.5",
    "no-execution",
    "common ledger/authority -> `file_diff` -> `shell_command` -> `browser_action`",
    "#91",
    "#98 was the temporary standalone Post-Phase3 tracker"
  ]);

  requireSnippets("decisions doc missing durable decisions", docs["docs/decisions.md"], [
    "Local-first Founder OS",
    "Tauri/native paths removed",
    "no hosted SaaS default",
    "Browser-only DB rewrite",
    "ExecutionAuthorityRecord gate",
    "README remains short"
  ]);

  requireSnippets("troubleshooting doc missing install/run contract", docs["docs/troubleshooting.md"], [
    "macOS shell | Windows PowerShell",
    "winget install --id OpenJS.NodeJS.LTS -e",
    "pnpm verify:prod-bundle",
    "pnpm verify",
    "VITE_SOLO_LOCAL_CAPABILITY_TOKEN",
    "VITE_SOLO_SIDECAR_BASE_URL",
    "token mismatch fails visibly with `401`",
    "does not require an OpenAI API key or ChatGPT web credential by default",
    "codex login status",
    "codex auth login",
    "Open Codex login",
    "Refresh Codex login status",
    "manual browser smoke",
    "Manual Windows PowerShell checklist",
    "managed child processes stopped",
    "temporary app data removed",
    "Port conflict",
    "Token mismatch",
    "CORS/origin",
    "Execution policy",
    "Path quoting",
    "Long path",
    "Antivirus/network prompt"
  ]);
}

function compareContractTaxonomies(reference) {
  const commands = readText("packages/contracts/src/product-engine/commands.ts");
  const events = readText("packages/contracts/src/product-engine/events.ts");
  const effects = readText("packages/contracts/src/effects/tasks.ts");
  const codex = readText("packages/contracts/src/codex/reexports.ts");
  const sse = readText("packages/contracts/src/sse/events.ts");
  const projections = readText("packages/contracts/src/projections/index.ts");
  const reduction = readText("packages/contracts/src/product-engine/reduction.ts");

  compareSets("reference CommandType", parseReferenceCommandTypes(reference), parseConstArray(commands, "COMMAND_TYPES"));
  compareSets("reference CommandActor", parseReferenceCommandActors(reference), parseConstArray(commands, "COMMAND_ACTORS"));
  compareSets("reference ProductEngineEventType", parseReferenceEventTypes(reference), parseConstArray(events, "PRODUCT_ENGINE_EVENT_TYPES"));
  compareSets("reference EffectType", parseReferenceEffectTypes(reference), parseConstArray(effects, "EFFECT_TYPES"));
  compareSets("reference EffectStatus", parseReferenceEffectStatuses(reference), parseConstArray(effects, "EFFECT_STATUSES"));
  compareSets(
    "reference ProductEngineDeterministicOutputType",
    parseDocs25DeterministicOutputTypes(reference),
    parseStringUnion(reduction, "ProductEngineDeterministicOutputType")
  );
  compareSets("reference CodexTurnPurpose", parseReferenceCodexTurnPurposes(reference), parseConstArray(codex, "CODEX_TURN_PURPOSES"));
  compareSets("reference CodexArtifactKind", parseReferenceArtifactKinds(reference), parseConstArray(codex, "CODEX_ARTIFACT_KINDS"));
  compareSets("reference CodexApplyPolicy", parseReferenceApplyPolicies(reference), parseConstArray(codex, "CODEX_APPLY_POLICIES"));
  compareSets("reference BlockedActionType", parseReferenceBlockedActionTypes(reference), parseConstArray(codex, "BLOCKED_ACTION_TYPES"));
  compareSets("reference SseEventName", parseReferenceSseEvents(reference), parseStringUnion(sse, "SseEventName"));
  compareSets("reference ProjectionKind", parseReferenceProjectionKinds(reference), parseStringUnion(projections, "ProjectionKind"));
}

function compareRoutes(reference) {
  const docsRoutes = parseDocs26RoutesFromText(reference);
  const codeRoutes = parseRouteCatalogFromSource(readText("packages/contracts/src/api/routes.ts"));

  compareSets("reference route catalog", [...docsRoutes.keys()], [...codeRoutes.keys()]);

  const queryMismatches = findRouteQueryMismatches(docsRoutes, codeRoutes);

  if (queryMismatches.length) {
    fail("reference route query mismatch", queryMismatches);
  }
}

function scanPackageBoundaries() {
  const violations = collectPackageBoundaryViolations();

  if (violations.length) {
    fail("package boundary import scan", violations);
  }
}

function checkNoExecutionPermissionClaims() {
  const docs = CONTRIBUTOR_DOC_PATHS.map((path) => ({ path, text: readText(path) }));
  const phase15Claims = findPhase15bExecutionPermissionClaims(docs);
  const phase25Claims = findPhase25ExecutionPermissionClaims(docs);

  if (phase15Claims.length) {
    fail("Phase 1.5B docs claim forbidden execution permission", phase15Claims);
  }

  if (phase25Claims.length) {
    fail("Phase 2.5 docs claim forbidden execution permission", phase25Claims);
  }
}

function checkWebLocalRealignment() {
  const futureDefaultClaims = findWebRealignmentFutureDefaultClaims(
    WEB_REALIGNMENT_SCAN_PATHS.map((path) => ({ path, text: readText(path) }))
  );

  if (futureDefaultClaims.length) {
    fail("web/local docs contain stale Tauri/native future-default claims", futureDefaultClaims);
  }

  const activeResidue = findWebLocalActiveResidue(
    collectTextFiles(WEB_LOCAL_REMOVAL_MANIFEST_PATHS, WEB_LOCAL_REMOVAL_SCAN_ROOTS).map((path) => ({
      path,
      text: readText(path)
    }))
  );

  if (activeResidue.length) {
    fail("web/local migration active source contains removed desktop/native residue", activeResidue);
  }
}

function checkReferenceSnippets(reference) {
  requireSnippets("reference doc missing critical contract anchors", reference, [
    "CommandType enum",
    "ProductEngineDeterministicOutput",
    "Phase 3 execution authority",
    "Blocked action taxonomy",
    "API route behavior catalog",
    "subscribeEventStream",
    "sessionId"
  ]);
}

export function runDocContractChecks() {
  checkContributorDocsShape();
  checkContributorDocsSnippets();

  const reference = readText("docs/reference.md");
  checkReferenceSnippets(reference);
  compareContractTaxonomies(reference);
  compareRoutes(reference);
  scanPackageBoundaries();
  checkNoExecutionPermissionClaims();
  checkWebLocalRealignment();

  if (!process.exitCode) {
    console.log("doc contract checks passed");
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  runDocContractChecks();
}
