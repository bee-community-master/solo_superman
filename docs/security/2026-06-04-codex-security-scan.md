# Codex Security Scan - 2026-06-04

Scan id: `d23ce4c_20260604T000000Z`

Branch: `codex/security-audit-20260604`

Scope: repository-wide single-agent security review for `/Users/shbot/.codex/worktrees/ef4c/solo_superman`.

## Summary

The scan found one fixable security issue in the approved public-read browser action path.

`approved_public_read` browser actions accepted syntactically public HTTPS DNS hostnames before execution, but did not re-check resolved DNS addresses before calling `fetch`. A hostname that resolved to loopback, private, or otherwise non-public IP space could bypass the intended public-read boundary.

The fix adds DNS resolution validation for approved public-read browser action targets before fetch execution. Targets are blocked unless every resolved address is public. DNS lookup failure, empty results, loopback, private, link-local, multicast, documentation, carrier-grade NAT, and other non-public ranges now return a sandbox block reason.

## Changed Files

- `apps/sidecar/src/product-engine/browser-action-adapter.ts`
  - Adds DNS lookup validation for `approved_public_read` browser action targets.
  - Blocks DNS-private results before `fetchLocalTarget`.
  - Keeps loopback-only browser actions on the existing loopback policy.
- `apps/sidecar/src/product-engine/browser-action-adapter.test.ts`
  - Adds a regression test for a public DNS name resolving to `127.0.0.1`.
  - Keeps a successful public-read fixture using `https://example.com/path`.

## Review Loop

After the fix, a single-agent review loop continued until five consecutive passes found no further changes to make.

1. Sidecar auth, CORS, loopback header, route/body boundary review: no additional fix found.
2. Execution adapter review for shell, file-diff, and browser-action authority boundaries: no additional fix found.
3. Network and URL review for public web research, public-read browser fetch, redirects, and external URL rendering: no additional fix found.
4. Storage, filesystem, support bundle, and secret redaction review: no additional fix found.
5. Final changed-diff, dependency audit, unsafe rendering, and local verification review: no additional fix found.

Clean streak after the implemented fix: 5 consecutive no-fix passes.

## Validation

All local validation commands completed successfully.

- `pnpm vitest run apps/sidecar/src/product-engine/browser-action-adapter.test.ts --no-file-parallelism`
  - 1 file passed, 5 tests passed.
- `pnpm typecheck`
  - workspace typecheck passed.
- `pnpm lint`
  - ESLint passed with `--max-warnings=0`.
- `pnpm test`
  - 149 files passed, 1368 tests passed.
- `pnpm audit --audit-level high`
  - no known vulnerabilities found.
- `pnpm verify:docs`
  - doc contract checks passed.
- `git diff --check`
  - passed.
- `pnpm verify`
  - full local verification gate passed, including typecheck, lint, test, docs, product capability readiness, release/readiness contracts, support bundle, prod bundle smoke, clarification/research/browser/service page pipelines, auto implementation, and core product loop checks.

## Residual Risk

No additional high-confidence repository security issue was identified in this scan. The browser action DNS helper intentionally mirrors the public/private IP classification already used by the public web research adapter; future cleanup can consolidate the two helpers if the project wants a shared network-boundary utility.
