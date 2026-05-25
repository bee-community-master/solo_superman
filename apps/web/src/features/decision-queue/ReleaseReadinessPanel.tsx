import { useAppLanguage, type AppLanguage } from "../../shared/i18n/app-language";

type ReleaseBlocker = {
  readonly issueNumber: number;
  readonly title: string;
  readonly summary: string;
  readonly requiredEvidence: readonly string[];
};

const RELEASE_LAB_COMMANDS = [
  "pnpm release:evidence-bundle -- ./solo-superman-release-evidence-bundle",
  "pnpm verify:release-evidence-bundle -- --bundle-dir ./solo-superman-release-evidence-bundle --require-ready",
  "pnpm verify:ready-release -- --evidence-bundle-dir ./solo-superman-release-evidence-bundle"
] as const;

type ReleaseReadinessCopy = {
  readonly title: string;
  readonly status: string;
  readonly summary: string;
  readonly evidenceBundleTitle: string;
  readonly evidenceBundleSummary: string;
  readonly commandsLabel: string;
  readonly issueLabel: (issueNumber: number) => string;
  readonly requiredEvidenceLabel: string;
  readonly blockers: readonly ReleaseBlocker[];
  readonly finalGateTitle: string;
  readonly finalGateSummary: string;
  readonly finalGateChecks: readonly string[];
};

const RELEASE_READINESS_COPY = {
  en: {
    title: "General release evidence blockers",
    status: "blocked by external evidence",
    summary:
      "The local product flow is code-backed for the technical preview, but broad release must stay blocked until release-lab evidence closes all three external gates.",
    evidenceBundleTitle: "Release-lab bundle workflow",
    evidenceBundleSummary:
      "Use the generated bundle as the handoff source of truth. Fill only redacted evidence refs, then validate the filled bundle before running the final ready-release gate.",
    commandsLabel: "Commands",
    issueLabel: (issueNumber: number) => `GitHub issue #${issueNumber}`,
    requiredEvidenceLabel: "Required evidence",
    blockers: [
      {
        issueNumber: 259,
        title: "Windows real-device installer proof",
        summary: "Clean Windows 11 device or VM evidence must prove the one-line installer reaches the first local screen.",
        requiredEvidence: [
          "UAC, Node/Git/Corepack/pnpm, WSL/Ubuntu/Codex CLI, Visual C++ runtime, desktop shortcut, and rerun path",
          "First-screen screenshot/log refs plus support bundle and bootstrap/prod-smoke logs",
          "Passed Windows evidenceBundle fields and checkEvidenceRefs"
        ]
      },
      {
        issueNumber: 266,
        title: "Signed package release proof",
        summary: "macOS, Windows, and release-manifest evidence must be collected with real signing/notarization/AuthentiCode credentials.",
        requiredEvidence: [
          "Artifact checksum, size, signature refs, and public certificate/key metadata",
          "macOS notarization/stapling and Windows timestamp evidence",
          "Release manifest artifact refs and manifest signature proof"
        ]
      },
      {
        issueNumber: 267,
        title: "Packaged updater rollback proof",
        summary: "macOS and Windows devices must prove signed update, defer, retry, rollback, relaunch, and protected-data preservation.",
        requiredEvidence: [
          "Install/update/defer/retry/rollback/launch evidence refs for each platform",
          "User data, generated workspace, support bundle, operator files, and credential refs preserved",
          "Protected-path evidence refs without reading credential contents"
        ]
      }
    ],
    finalGateTitle: "Ready-release rule",
    finalGateSummary:
      "Do not mark broad/general release ready from local dry-runs alone. General release is ready only after every external blocker issue has filled, redacted, passing bundle evidence.",
    finalGateChecks: RELEASE_LAB_COMMANDS
  },
  ja: {
    title: "一般公開のエビデンスブロッカー",
    status: "外部エビデンス待ち",
    summary:
      "ローカル製品フローは技術プレビューとしてcode-backedですが、3つの外部ゲートのrelease-lab evidenceが揃うまで一般公開はブロックのままにします。",
    evidenceBundleTitle: "Release lab bundle workflow",
    evidenceBundleSummary:
      "生成されたbundleを引き継ぎの正本として使います。redacted evidence refsだけを埋め、filled bundleを検証してから最後のready-release gateを実行します。",
    commandsLabel: "コマンド",
    issueLabel: (issueNumber: number) => `GitHub issue #${issueNumber}`,
    requiredEvidenceLabel: "必要なエビデンス",
    blockers: [
      {
        issueNumber: 259,
        title: "Windows実機インストーラー証跡",
        summary: "Clean Windows 11 device/VMでone-line installerが最初のローカル画面に到達することを証明します。",
        requiredEvidence: [
          "UAC、Node/Git/Corepack/pnpm、WSL/Ubuntu/Codex CLI、Visual C++ runtime、desktop shortcut、rerun path",
          "first-screen screenshot/log refs、support bundle、bootstrap/prod-smoke logs",
          "passed Windows evidenceBundle fields and checkEvidenceRefs"
        ]
      },
      {
        issueNumber: 266,
        title: "署名済みパッケージ証跡",
        summary: "macOS、Windows、release manifestについて実credentialによるsigning/notarization/AuthentiCode evidenceを集めます。",
        requiredEvidence: [
          "artifact checksum、size、signature refs、public certificate/key metadata",
          "macOS notarization/stapling と Windows timestamp evidence",
          "release manifest artifact refs と manifest signature proof"
        ]
      },
      {
        issueNumber: 267,
        title: "パッケージ更新rollback証跡",
        summary: "macOS/Windowsデバイスでsigned update、defer、retry、rollback、relaunch、protected data preservationを証明します。",
        requiredEvidence: [
          "platformごとの install/update/defer/retry/rollback/launch evidence refs",
          "user data、generated workspace、support bundle、operator files、credential refs の保持",
          "credential内容を読まない protected-path evidence refs"
        ]
      }
    ],
    finalGateTitle: "Ready-release rule",
    finalGateSummary:
      "ローカルdry-runだけでbroad/general releaseをreadyにしません。すべての外部blocker issueにredactedかつpassingなbundle evidenceが入った場合だけreadyです。",
    finalGateChecks: RELEASE_LAB_COMMANDS
  },
  ko: {
    title: "일반 공개 증거 차단 항목",
    status: "외부 증거 대기",
    summary:
      "로컬 제품 흐름은 기술 프리뷰로 code-backed 상태지만, 3개 외부 release-lab evidence gate가 모두 닫히기 전까지 broad/general release는 차단 상태로 유지해야 합니다.",
    evidenceBundleTitle: "Release lab bundle workflow",
    evidenceBundleSummary:
      "생성된 bundle을 인계 정본으로 사용합니다. redacted evidence ref만 채운 뒤 filled bundle을 검증하고 마지막 ready-release gate를 실행하세요.",
    commandsLabel: "명령",
    issueLabel: (issueNumber: number) => `GitHub issue #${issueNumber}`,
    requiredEvidenceLabel: "필수 증거",
    blockers: [
      {
        issueNumber: 259,
        title: "Windows 실기기 설치 증거",
        summary: "깨끗한 Windows 11 기기 또는 VM에서 one-line installer가 첫 로컬 화면까지 도달함을 증명해야 합니다.",
        requiredEvidence: [
          "UAC, Node/Git/Corepack/pnpm, WSL/Ubuntu/Codex CLI, Visual C++ runtime, desktop shortcut, 재실행 경로",
          "첫 화면 screenshot/log ref와 support bundle, bootstrap/prod-smoke log",
          "passed Windows evidenceBundle field와 checkEvidenceRefs"
        ]
      },
      {
        issueNumber: 266,
        title: "서명된 패키지 릴리스 증거",
        summary: "macOS, Windows, release manifest evidence를 실제 signing/notarization/AuthentiCode credential로 수집해야 합니다.",
        requiredEvidence: [
          "artifact checksum, size, signature ref, public certificate/key metadata",
          "macOS notarization/stapling 및 Windows timestamp evidence",
          "release manifest artifact refs와 manifest signature proof"
        ]
      },
      {
        issueNumber: 267,
        title: "패키지 업데이트 rollback 증거",
        summary: "macOS/Windows 기기에서 signed update, defer, retry, rollback, relaunch, protected-data preservation을 증명해야 합니다.",
        requiredEvidence: [
          "platform별 install/update/defer/retry/rollback/launch evidence refs",
          "user data, generated workspace, support bundle, operator files, credential refs 보존",
          "credential 내용을 읽지 않는 protected-path evidence refs"
        ]
      }
    ],
    finalGateTitle: "Ready-release rule",
    finalGateSummary:
      "로컬 dry-run만으로 broad/general release를 ready로 표시하지 않습니다. 모든 외부 blocker issue에 redacted passing bundle evidence가 채워진 뒤에만 일반 공개 준비가 됩니다.",
    finalGateChecks: RELEASE_LAB_COMMANDS
  }
} as const satisfies Record<AppLanguage, ReleaseReadinessCopy>;

function blockerIssueUrl(issueNumber: number) {
  return `https://github.com/bee-community-master/solo_superman/issues/${issueNumber}`;
}

export function ReleaseReadinessPanel() {
  const { language } = useAppLanguage();
  const copy = RELEASE_READINESS_COPY[language];

  return (
    <section className="panel release-readiness-panel" aria-label={copy.title}>
      <div className="panel-heading">
        <h2>{copy.title}</h2>
        <span>{copy.status}</span>
      </div>
      <p className="operations-summary">{copy.summary}</p>
      <div className="release-blocker-list">
        {copy.blockers.map((blocker) => (
          <article className="operations-card release-blocker-card" key={blocker.issueNumber}>
            <div className="panel-heading release-card-heading">
              <h3>{blocker.title}</h3>
              <a href={blockerIssueUrl(blocker.issueNumber)}>{copy.issueLabel(blocker.issueNumber)}</a>
            </div>
            <p>{blocker.summary}</p>
            <strong>{copy.requiredEvidenceLabel}</strong>
            <ul className="effect-list">
              {blocker.requiredEvidence.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </article>
        ))}
      </div>
      <section className="operations-card release-bundle-card">
        <h3>{copy.evidenceBundleTitle}</h3>
        <p>{copy.evidenceBundleSummary}</p>
        <strong>{copy.commandsLabel}</strong>
        <ul className="effect-list">
          {copy.finalGateChecks.map((command) => (
            <li key={command}>
              <code>{command}</code>
            </li>
          ))}
        </ul>
        <p className="research-recovery">
          <strong>{copy.finalGateTitle}: </strong>
          {copy.finalGateSummary}
        </p>
      </section>
    </section>
  );
}
