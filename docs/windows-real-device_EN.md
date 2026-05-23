# Windows real-device install evidence contract

Language: [한국어](windows-real-device_KO.md) | English

This document defines the `solo-superman-windows-real-device.v1` evidence contract proving that the README one-line PowerShell installer reaches the local first screen on a clean Windows 11 device or VM. The current repo/local environment is macOS, so it does not run the real Windows install. Instead, `pnpm verify:windows-real-device` validates the expected #259 Windows device evidence structure and keeps the blocker explicit.

## Contract file

- Windows evidence contract: [`windows-real-device.example.json`](windows-real-device.example.json) plus `pnpm verify:windows-real-device` verify the device evidence gate from one-line installer to first-screen arrival.
- Release readiness: [`release-readiness_EN.md`](release-readiness_EN.md) plus `pnpm verify:release-readiness` keep Windows evidence grouped with the signed package and packaged update rollback broad-release blockers.

## Default verification

```sh
pnpm verify:windows-real-device
```

The default mode is a credential-free contract check. The current example uses `windowsVerificationStatus=blocked`; it passes only when the #259 blocker issue and required evidence remain explicit.

## Real device evidence mode

```sh
pnpm verify:windows-real-device -- --require-device-evidence
```

This mode should pass only immediately before a real general release, or in a PR that has Windows lab evidence attached. The current example contract must fail because the Windows device run is still `blocked`.

## Required Windows checks

`deviceRuns[].requiredChecks` must include all of these values:

- `run_administrator_powershell_one_line_installer`
- `handle_uac_elevation`
- `install_or_reuse_node_git_corepack_pnpm`
- `install_or_verify_wsl_ubuntu`
- `install_or_reuse_codex_cli_in_wsl`
- `verify_visual_cpp_runtime`
- `create_desktop_shortcut`
- `reach_first_screen`
- `rerun_installer_safe_update`
- `generate_support_bundle`
- `collect_bootstrap_and_prod_smoke_logs`

## Operating rules

- Closing #259 requires redacted Windows evidence strong enough for both `pnpm verify:windows-real-device -- --require-device-evidence` and `pnpm verify:release-readiness -- --require-ready` to pass.
- Any new blocker found during Windows verification should become a separate fix issue/PR instead of being buried inside #259.
- Evidence refs must be HTTPS URLs or repo-relative documentation anchors, and they must not include secret, token, cookie, or credential values.
- Support bundles may include summaries and allowlisted environment values only; do not attach file contents, browser sessions, OpenAI/GitHub tokens, or ChatGPT credentials.
