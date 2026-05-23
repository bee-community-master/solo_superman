import { describe, expect, it } from "vitest";
import {
  WINDOWS_REAL_DEVICE_SCHEMA_VERSION,
  evaluateWindowsRealDevice,
  parseWindowsRealDeviceArgs,
  validateWindowsRealDeviceContract
} from "./verify-windows-real-device.mjs";

function blockedContract(overrides = {}) {
  return {
    schemaVersion: WINDOWS_REAL_DEVICE_SCHEMA_VERSION,
    appId: "solo-superman",
    windowsVerificationStatus: "blocked",
    summary: "Windows real-device verification remains blocked until clean device evidence exists.",
    releaseReadinessContract: "docs/release-readiness_KO.md",
    blockerIssue: "https://github.com/bee-community-master/solo_superman/issues/259",
    requiredVerificationCommands: {
      credentialFree: [
        "pnpm verify:prod-bundle",
        "pnpm verify:windows-real-device",
        "pnpm verify:release-readiness",
        "pnpm verify"
      ],
      deviceEvidence: [
        "pnpm verify:windows-real-device -- --require-device-evidence",
        "pnpm verify:release-readiness -- --require-ready"
      ]
    },
    privacyRequirements: [
      "Evidence references must be redacted before they are attached to a GitHub issue or release PR.",
      "Support bundles must not include tokens, cookies, credentials, or file contents."
    ],
    deviceRuns: [
      {
        id: "windows-one-line-install-first-screen",
        platform: "windows",
        status: "blocked",
        requiredFor: "general-release",
        blocker: "Clean Windows 11 device or VM evidence is missing.",
        blockerIssue: "https://github.com/bee-community-master/solo_superman/issues/259",
        evidenceRefs: ["README.md#설치방법", "docs/troubleshooting_KO.md#manual-windows-powershell-checklist"],
        requiredChecks: [
          "run_administrator_powershell_one_line_installer",
          "handle_uac_elevation",
          "install_or_reuse_node_git_corepack_pnpm",
          "install_or_verify_wsl_ubuntu",
          "install_or_reuse_codex_cli_in_wsl",
          "verify_visual_cpp_runtime",
          "create_desktop_shortcut",
          "reach_first_screen",
          "rerun_installer_safe_update",
          "generate_support_bundle",
          "collect_bootstrap_and_prod_smoke_logs"
        ],
        requiredEvidence: ["Clean Windows 11 one-line install reaches first screen."],
        unblockCriteria: ["Attach redacted Windows first-screen evidence to #259."]
      }
    ],
    ...overrides
  };
}

function passedRun(run) {
  const rest = { ...run };
  delete rest.blocker;
  delete rest.blockerIssue;
  return {
    ...rest,
    status: "passed",
    verifiedAt: "2026-05-23T00:00:00Z",
    verifiedBy: ["device-lab:windows-11-vm"]
  };
}

describe("Windows real-device verification", () => {
  it("passes default contract mode when Windows evidence is explicitly blocked", () => {
    const evaluation = evaluateWindowsRealDevice(blockedContract());

    expect(evaluation).toMatchObject({
      ok: true,
      windowsVerificationStatus: "blocked",
      windowsRealDeviceReady: false,
      blockedDeviceRuns: ["windows-one-line-install-first-screen"],
      blockers: []
    });
  });

  it("fails require-device-evidence mode until the Windows run has passed", () => {
    const evaluation = evaluateWindowsRealDevice(blockedContract(), { requireDeviceEvidence: true });

    expect(evaluation.ok).toBe(false);
    expect(evaluation.blockers).toEqual([
      "Windows real-device evidence is not ready",
      "windows-one-line-install-first-screen device run is still blocked"
    ]);
  });

  it("accepts ready Windows evidence only when a Windows run passed", () => {
    const base = blockedContract();
    const contract = blockedContract({
      windowsVerificationStatus: "ready",
      deviceRuns: base.deviceRuns.map((run) => passedRun(run))
    });
    const result = validateWindowsRealDeviceContract(contract);
    const evaluation = evaluateWindowsRealDevice(contract, { requireDeviceEvidence: true });

    expect(result.ok).toBe(true);
    expect(evaluation).toMatchObject({
      ok: true,
      windowsRealDeviceReady: true,
      blockedDeviceRuns: []
    });
  });

  it("requires #259 for blocked top-level and device-run blocker issues", () => {
    const contract = blockedContract({
      blockerIssue: "https://example.com/missing",
      deviceRuns: blockedContract().deviceRuns.map((run) => ({ ...run, blockerIssue: "https://example.com/missing" }))
    });
    const result = validateWindowsRealDeviceContract(contract);

    expect(result.ok).toBe(false);
    expect(result.issues).toEqual(expect.arrayContaining([
      "$.blockerIssue: must link the tracked Windows real-device issue #259",
      "$.deviceRuns[0].blockerIssue: must link the tracked Windows real-device issue #259"
    ]));
  });

  it("rejects secret-shaped evidence strings and non-HTTPS URL evidence refs", () => {
    const contract = blockedContract({
      deviceRuns: blockedContract().deviceRuns.map((run) => ({
        ...run,
        evidenceRefs: ["ftp://example.com/windows-evidence.json"],
        requiredEvidence: ["Bearer abcdefghijklmnop"]
      }))
    });
    const result = validateWindowsRealDeviceContract(contract);

    expect(result.ok).toBe(false);
    expect(result.issues).toEqual(expect.arrayContaining([
      "$.deviceRuns[0].evidenceRefs[0]: must use https when using URL evidence refs",
      "$.deviceRuns[0].requiredEvidence[0]: must not contain token-shaped values"
    ]));
  });

  it("requires all credential-free and device-evidence command lists", () => {
    const contract = blockedContract({
      requiredVerificationCommands: {
        credentialFree: ["pnpm verify"],
        deviceEvidence: []
      }
    });
    const result = validateWindowsRealDeviceContract(contract);

    expect(result.ok).toBe(false);
    expect(result.issues).toEqual(expect.arrayContaining([
      "$.requiredVerificationCommands.credentialFree: must include pnpm verify:windows-real-device",
      "$.requiredVerificationCommands.deviceEvidence: must be a string list with at least 1 item(s)",
      "$.requiredVerificationCommands.deviceEvidence: must include pnpm verify:windows-real-device -- --require-device-evidence"
    ]));
  });

  it("parses contract path and device-evidence mode flags", () => {
    expect(parseWindowsRealDeviceArgs(["--contract", "custom.json", "--require-device-evidence"])).toEqual({
      contractPath: "custom.json",
      requireDeviceEvidence: true
    });
    expect(() => parseWindowsRealDeviceArgs(["--contract"])).toThrow("--contract requires a path value");
  });
});
