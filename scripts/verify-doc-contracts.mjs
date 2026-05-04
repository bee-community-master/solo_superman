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

function parseDocs25CommandTypes() {
  const docs = readText("docs/25-contracts-dto-catalog.md");
  const section = docs.split("### CommandType enum")[1]?.split("### ProductEngineCommand envelope")[0];

  if (!section) {
    throw new Error("Could not find docs/25 CommandType section");
  }

  return [...section.matchAll(/\| `([^`]+)` \| [^|]+ \|/g)].map((match) => match[1]);
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
compareRoutes();
scanPackageBoundaries();

if (!process.exitCode) {
  console.log("doc contract checks passed");
}
