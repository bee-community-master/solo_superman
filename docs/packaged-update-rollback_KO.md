# 패키지 업데이트 rollback evidence 계약

언어: 한국어 | [English](packaged-update-rollback_EN.md)

이 문서는 signed macOS/Windows package 기반 자동 업데이트를 실제 general release로 열기 전에 필요한 `solo-superman-packaged-update-rollback.v1` device rollback evidence 계약입니다. 현재 repo/local 환경에는 signed package artifact와 device lab evidence가 없으므로 실제 release update는 수행하지 않습니다. 대신 repo에는 credential-free packaged updater runtime이 있으며, `pnpm verify:packaged-update-rollback`이 macOS/Windows device evidence 구조와 #267의 blocked 상태를 검증합니다. `pnpm verify:packaged-update-rollback:dry-run`은 그 runtime으로 fixture 기반 update plan, defer, pre-write failure retry, failed-launch rollback, preservation 경계를 검증하지만 실제 signed package나 device evidence를 대체하지 않습니다.

## 현재 상태

- Release channel contract: [`release-channel_KO.md`](release-channel_KO.md)와 `pnpm verify:release-channel`이 manifest/signature/checksum/retry/rollback/user-data/credential preservation 계약을 검증합니다.
- Rollback evidence contract: [`packaged-update-rollback.example.json`](packaged-update-rollback.example.json)와 `pnpm verify:packaged-update-rollback`이 macOS/Windows device run gate와 preservation evidence 요구사항을 검증합니다.
- Credential-free runtime dry-run: `scripts/packaged-update-runtime.mjs`와 `pnpm verify:packaged-update-rollback:dry-run`이 임시 fixture install에서 signed-manifest update plan, defer, pre-write failure retry, failed-launch rollback과 local DB/workspace/support/operator/credential ref 보존을 검증합니다. Credential ref snapshot은 content를 읽지 않는 metadata-only mode입니다.
- Actual device evidence: signed package artifact, macOS/Windows device/VM, updater rollback logs가 준비될 때까지 [#267](https://github.com/bee-community-master/solo_superman/issues/267)로 blocked입니다.

## 검증 명령

기본 contract 검증은 credential-free로 실행되며, 현재 blocked 상태를 명시적으로 허용합니다.

```sh
pnpm verify:packaged-update-rollback
pnpm verify:packaged-update-rollback:dry-run
```

실제 release/device evidence가 준비된 뒤에는 아래 모드를 실행합니다. 이 모드는 macOS와 Windows device run이 모두 `passed`가 아니면 실패해야 합니다.

```sh
pnpm verify:packaged-update-rollback -- --require-device-evidence
```

## Device run evidence

각 platform은 아래 check를 모두 evidence로 남겨야 합니다.

1. `install_signed_package`: signed package 설치 후 local first screen 도달.
2. `apply_update`: signed update manifest/artifact 적용.
3. `defer_update`: 사용자가 업데이트를 보류할 수 있음.
4. `retry_failed_update`: 실패 후 기존 설치본을 유지한 채 재시도 가능.
5. `rollback_after_failed_launch`: 업데이트 후 launch verification 실패 시 이전 app binary/release metadata로 복구.
6. `launch_after_rollback`: rollback 이후 기존 버전 launch 성공.
7. `preserve_user_data`: local DB, generated workspace, support bundle, operator file 보존.
8. `preserve_credentials`: Codex/OpenAI/GitHub credential, browser cookie, local capability token, environment secret을 읽거나 재작성하지 않음.

## 운영 규칙

- #267을 닫으려면 `pnpm verify:packaged-update-rollback -- --require-device-evidence`와 `pnpm verify:release-readiness -- --require-ready`를 통과할 수 있는 redacted evidence가 필요합니다.
- Rollback runtime은 packaged app binary, release metadata, update state만 바꿀 수 있으며 local user data와 credential은 rollback/cleanup 대상이 아닙니다.
- Support bundle, PR body, release manifest, device log에는 secret 값을 넣지 않고 redacted evidence ref만 남깁니다. Credential path 보존 확인은 content hash 대신 metadata-only no-read snapshot으로 수행합니다.
