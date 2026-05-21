import { Component, type ErrorInfo, type ReactNode } from "react";

interface AppErrorBoundaryProps {
  readonly children: ReactNode;
}

interface AppErrorBoundaryState {
  readonly errorMessage: string | null;
}

export class AppErrorBoundary extends Component<AppErrorBoundaryProps, AppErrorBoundaryState> {
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
      return (
        <main className="app-shell app-error-boundary" role="alert" aria-live="assertive">
          <section className="panel">
            <div className="panel-heading">
              <h1>Research 화면을 복구할 수 있습니다</h1>
              <span>UI error fallback</span>
            </div>
            <p>
              흰 화면 대신 오류 복구 화면을 표시했습니다. 상태를 새로고침하거나 입력을 수정한 뒤 다시 시도하세요.
            </p>
            <p className="workflow-error">{this.state.errorMessage}</p>
            <div className="card-actions panel-actions">
              <button type="button" onClick={this.reset}>화면 다시 시도</button>
              <button type="button" onClick={() => window.location.reload()}>전체 새로고침</button>
            </div>
          </section>
        </main>
      );
    }

    return this.props.children;
  }
}
