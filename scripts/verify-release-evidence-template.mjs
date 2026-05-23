#!/usr/bin/env node
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import {
  buildFilledReleaseEvidenceTemplateFixture,
  buildReleaseEvidenceChecklist,
  buildReleaseEvidenceTemplate,
  filterReleaseEvidenceChecklistByIssue,
  loadReleaseEvidenceContracts,
  validateReleaseEvidenceTemplate
} from "./release-evidence-checklist.mjs";

function parseReleaseEvidenceTemplateVerifierArgs(argv = process.argv.slice(2), env = process.env) {
  let inputPath = env.SOLO_RELEASE_EVIDENCE_TEMPLATE_PATH;
  let issueNumber = env.SOLO_RELEASE_EVIDENCE_TEMPLATE_ISSUE
    ? Number(env.SOLO_RELEASE_EVIDENCE_TEMPLATE_ISSUE)
    : undefined;

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--") {
      continue;
    } else if (arg === "--input" || arg === "-i") {
      if (!argv[index + 1]) {
        throw new Error(`${arg} requires a path value.`);
      }
      inputPath = argv[index + 1];
      index += 1;
    } else if (arg.startsWith("--input=")) {
      inputPath = arg.slice("--input=".length);
    } else if (arg === "--issue") {
      if (!argv[index + 1]) {
        throw new Error(`${arg} requires an issue number.`);
      }
      issueNumber = Number(argv[index + 1]);
      index += 1;
    } else if (arg.startsWith("--issue=")) {
      issueNumber = Number(arg.slice("--issue=".length));
    } else if (arg === "--help" || arg === "-h") {
      return { help: true };
    } else {
      throw new Error(`Unknown release evidence template verifier argument: ${arg}`);
    }
  }

  if (issueNumber !== undefined && (!Number.isInteger(issueNumber) || issueNumber <= 0)) {
    throw new Error("--issue requires a positive integer issue number.");
  }

  return {
    inputPath: inputPath ? resolve(inputPath) : undefined,
    issueNumber
  };
}

async function readTemplate(inputPath) {
  return JSON.parse(await readFile(inputPath, "utf8"));
}

function issueNumberFromTemplate(template) {
  const issueNumber = Number(template?.filterIssueNumber);
  return Number.isInteger(issueNumber) && issueNumber > 0 ? issueNumber : undefined;
}

export async function runReleaseEvidenceTemplateVerifierCli(argv = process.argv.slice(2), options = {}) {
  const parsed = parseReleaseEvidenceTemplateVerifierArgs(argv, options.env ?? process.env);
  if (parsed.help) {
    console.log("Usage: pnpm verify:release-evidence-template [--input <filled-template.json>] [--issue <number>]");
    return { status: "help" };
  }

  const contracts = options.contracts ?? await loadReleaseEvidenceContracts(options.contractPaths, options);
  const fullChecklist = buildReleaseEvidenceChecklist(contracts, options);
  const template = parsed.inputPath
    ? await readTemplate(parsed.inputPath)
    : buildFilledReleaseEvidenceTemplateFixture(buildReleaseEvidenceTemplate(filterReleaseEvidenceChecklistByIssue(fullChecklist, parsed.issueNumber ?? 266)), options);
  const issueNumber = parsed.issueNumber ?? issueNumberFromTemplate(template);
  const expectedChecklist = issueNumber
    ? filterReleaseEvidenceChecklistByIssue(fullChecklist, issueNumber)
    : undefined;
  const validation = validateReleaseEvidenceTemplate(template, { expectedChecklist });

  console.log(JSON.stringify({
    ...validation,
    mode: parsed.inputPath ? "input" : "credential-free-fixture",
    inputPath: parsed.inputPath,
    issueNumber
  }, null, 2));

  return validation;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  runReleaseEvidenceTemplateVerifierCli().then((validation) => {
    if (Array.isArray(validation.issues) && validation.issues.length > 0) {
      process.exitCode = 1;
    }
  }).catch((error) => {
    console.error(`verify-release-evidence-template failed: ${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 1;
  });
}
