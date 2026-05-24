#!/usr/bin/env node
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import {
  buildFilledReleaseEvidenceTemplateFixture,
  buildReleaseEvidenceChecklist,
  buildReleaseEvidenceTemplate,
  filterReleaseEvidenceChecklistByIssue,
  loadReleaseEvidenceContracts,
  RELEASE_EVIDENCE_TEMPLATE_VALIDATION_SCHEMA_VERSION,
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

function releaseBlockerIssueNumbers(checklist) {
  return [...new Set(
    (checklist.summary?.blockerIssueNumbers ?? [])
      .map((issueNumber) => Number(issueNumber))
      .filter((issueNumber) => Number.isInteger(issueNumber) && issueNumber > 0)
      .sort((left, right) => left - right)
  )];
}

function validateFixtureForIssue(fullChecklist, issueNumber, options) {
  const expectedChecklist = filterReleaseEvidenceChecklistByIssue(fullChecklist, issueNumber);
  const template = buildFilledReleaseEvidenceTemplateFixture(buildReleaseEvidenceTemplate(expectedChecklist), options);
  const validation = validateReleaseEvidenceTemplate(template, { expectedChecklist });

  return {
    ...validation,
    issueNumber
  };
}

function aggregateFixtureValidations(validations) {
  const statusIssues = validations
    .filter((validation) => validation.status !== "passed")
    .map((validation) => `#${validation.issueNumber}: template validation status is ${validation.status}`);
  const issues = validations.flatMap((validation) =>
    validation.issues.map((issue) => `#${validation.issueNumber}: ${issue}`)
  );
  const finalIssues = [...statusIssues, ...issues];

  return {
    schemaVersion: RELEASE_EVIDENCE_TEMPLATE_VALIDATION_SCHEMA_VERSION,
    status: finalIssues.length === 0 ? "passed" : "blocked",
    mode: "credential-free-fixture",
    filterIssueNumber: "all",
    issueNumbers: validations.map((validation) => validation.issueNumber),
    itemCount: validations.reduce((total, validation) => total + validation.itemCount, 0),
    templateValidations: validations.map((validation) => ({
      issueNumber: validation.issueNumber,
      status: validation.status,
      filterIssueNumber: validation.filterIssueNumber,
      itemCount: validation.itemCount,
      issues: validation.issues
    })),
    issues: finalIssues,
    checked: [
      "filled release evidence templates for every blocked release issue",
      "all required checks, evidence, and unblock criteria are passed per issue",
      "placeholder fields are replaced with redacted evidence refs and notes per issue",
      "operator verification metadata, redaction confirmation, ready-release command coverage, and ready-release result blockers are present per issue",
      "filled templates are secret-free"
    ]
  };
}

function expectedChecklistForTemplate(fullChecklist, parsedIssueNumber, template) {
  const issueNumber = parsedIssueNumber ?? issueNumberFromTemplate(template);

  return {
    issueNumber,
    expectedChecklist: issueNumber
      ? filterReleaseEvidenceChecklistByIssue(fullChecklist, issueNumber)
      : fullChecklist
  };
}

export async function runReleaseEvidenceTemplateVerifierCli(argv = process.argv.slice(2), options = {}) {
  const parsed = parseReleaseEvidenceTemplateVerifierArgs(argv, options.env ?? process.env);
  if (parsed.help) {
    console.log("Usage: pnpm verify:release-evidence-template [--input <filled-template.json> | --issue <number>]");
    console.log("Default: validate credential-free fixture templates for every blocked release issue.");
    console.log("Input templates without filterIssueNumber are validated against every source checklist item.");
    return { status: "help" };
  }

  const contracts = options.contracts ?? await loadReleaseEvidenceContracts(options.contractPaths, options);
  const fullChecklist = buildReleaseEvidenceChecklist(contracts, options);
  if (!parsed.inputPath && !parsed.issueNumber) {
    const validations = releaseBlockerIssueNumbers(fullChecklist)
      .map((issueNumber) => validateFixtureForIssue(fullChecklist, issueNumber, options));
    const aggregateValidation = aggregateFixtureValidations(validations);

    console.log(JSON.stringify(aggregateValidation, null, 2));
    return aggregateValidation;
  }

  const template = parsed.inputPath
    ? await readTemplate(parsed.inputPath)
    : buildFilledReleaseEvidenceTemplateFixture(buildReleaseEvidenceTemplate(filterReleaseEvidenceChecklistByIssue(fullChecklist, parsed.issueNumber)), options);
  const { expectedChecklist, issueNumber } = expectedChecklistForTemplate(fullChecklist, parsed.issueNumber, template);
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
