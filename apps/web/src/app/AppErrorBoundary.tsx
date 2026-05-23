import { Component, type ErrorInfo, type ReactNode } from "react";
import { useAppLanguage, type AppLanguage } from "../shared/i18n/app-language";

interface AppErrorBoundaryProps {
  readonly children: ReactNode;
}

interface AppErrorBoundaryCopy {
  readonly title: string;
  readonly status: string;
  readonly description: string;
  readonly retryScreen: string;
  readonly reloadPage: string;
}

export const APP_ERROR_BOUNDARY_COPY = {
  en: {
    title: "You can recover the workspace screen",
    status: "UI error fallback",
    description:
      "Instead of a blank screen, Solo Superman showed this recovery screen. Refresh state or fix the input, then try again.",
    retryScreen: "Try screen again",
    reloadPage: "Reload page"
  },
  ja: {
    title: "作業画面を復旧できます",
    status: "UIエラー復旧",
    description:
      "真っ白な画面の代わりに復旧画面を表示しました。状態を更新するか入力を修正してから、もう一度試してください。",
    retryScreen: "画面を再試行",
    reloadPage: "ページ全体を再読み込み"
  },
  ko: {
    title: "작업 화면을 복구할 수 있습니다",
    status: "UI 오류 복구",
    description:
      "흰 화면 대신 오류 복구 화면을 표시했습니다. 상태를 새로고침하거나 입력을 수정한 뒤 다시 시도하세요.",
    retryScreen: "화면 다시 시도",
    reloadPage: "전체 새로고침"
  }
} as const satisfies Record<AppLanguage, AppErrorBoundaryCopy>;

export function appErrorBoundaryCopyForLanguage(language: AppLanguage): AppErrorBoundaryCopy {
  return APP_ERROR_BOUNDARY_COPY[language];
}

interface AppErrorBoundaryInnerProps extends AppErrorBoundaryProps {
  readonly copy: AppErrorBoundaryCopy;
}

interface AppErrorBoundaryState {
  readonly errorMessage: string | null;
}

class AppErrorBoundaryInner extends Component<AppErrorBoundaryInnerProps, AppErrorBoundaryState> {
  override state: AppErrorBoundaryState = {
    errorMessage: null
  };

  static getDerivedStateFromError(error: unknown): AppErrorBoundaryState {
    return {
      errorMessage: error instanceof Error ? error.message : "Unexpected UI render failure."
    };
  }

  override componentDidCatch(error: unknown, errorInfo: ErrorInfo) {
    console.error("[solo-superman:ui-error-boundary]", error, errorInfo.componentStack);
  }

  private readonly reset = () => {
    this.setState({ errorMessage: null });
  };

  override render() {
    if (this.state.errorMessage) {
      const { copy } = this.props;

      return (
        <main className="app-shell app-error-boundary" role="alert" aria-live="assertive">
          <section className="panel">
            <div className="panel-heading">
              <h1>{copy.title}</h1>
              <span>{copy.status}</span>
            </div>
            <p>{copy.description}</p>
            <p className="workflow-error">{this.state.errorMessage}</p>
            <div className="card-actions panel-actions">
              <button type="button" onClick={this.reset}>{copy.retryScreen}</button>
              <button type="button" onClick={() => window.location.reload()}>{copy.reloadPage}</button>
            </div>
          </section>
        </main>
      );
    }

    return this.props.children;
  }
}

export function AppErrorBoundary({ children }: AppErrorBoundaryProps) {
  const { language } = useAppLanguage();

  return (
    <AppErrorBoundaryInner copy={appErrorBoundaryCopyForLanguage(language)}>
      {children}
    </AppErrorBoundaryInner>
  );
}
