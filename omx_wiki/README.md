# Solo Superman implementation wiki

This wiki is the compact, persistent map for future implementation work. It does not replace `docs/`; it points from the product goal to the exact contracts, smoke tests, and release blockers that prove the goal is still code-backed.

## Read order

1. [`product-capability-flow.md`](product-capability-flow.md) — end-to-end idea -> questions -> research -> readiness -> implementation flow.
2. [`verification-map.md`](verification-map.md) — command-to-capability verification matrix.
3. [`auto-implementation-gates.md`](auto-implementation-gates.md) — issue/markdown PR chunking, review-loop, clean-code, missing-test, and merge gates.
4. [`release-handoff.md`](release-handoff.md) — default #259/#267 release handoff path, with optional #266 signed-package hardening only when signed artifacts are claimed.

## Ground rules

- Treat current code, contract files, verifier output, and GitHub issue state as source of truth.
- Do not mark the product complete from docs alone; completion requires passing the relevant verifier gates and current external release evidence.
- Keep this wiki short. Detailed DTO/API contracts stay in `docs/reference_KO.md` and `docs/reference_EN.md`.
