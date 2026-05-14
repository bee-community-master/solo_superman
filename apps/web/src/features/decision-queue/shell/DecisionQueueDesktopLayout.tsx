import { type ReactNode } from "react";
import { CONTRACT_SCHEMA_VERSION } from "@solo-superman/contracts";
import { PAGE_META, type DecisionQueuePageId } from "./decision-queue-shell-model";
import type { DecisionQueueShellController } from "./useDecisionQueueShellController";

interface DecisionQueueDesktopLayoutProps {
  readonly controller: DecisionQueueShellController;
  readonly children: ReactNode;
  readonly rightRail: ReactNode;
}

export function DecisionQueueDesktopLayout({ controller, children, rightRail }: DecisionQueueDesktopLayoutProps) {
  const {
    activePage,
    activePageMeta,
    blockedQueueCount,
    confidence,
    connect,
    connectionLabel,
    connectionState,
    connectionTone,
    isBusy,
    navItems,
    projections,
    setActivePage,
    totalQueueCount,
    workflowError
  } = controller;

  return (
    <main className="desktop-shell">
      <header className="desktop-topbar">
        <div className="brand-block">
          <div className="brand-mark" aria-hidden="true">
            <span />
            <span />
            <span />
          </div>
          <div>
            <h1>Solo Superman</h1>
            <p>{projections.session?.projectId ?? "Local Decision Queue"}</p>
          </div>
        </div>
        <nav className="phase-trail" aria-label="Desktop workflow sections">
          {Object.entries(PAGE_META).map(([id, meta], index) => {
            const pageId = id as DecisionQueuePageId;
            const isActive = activePage === pageId;

            return (
              <button
                aria-current={isActive ? "page" : undefined}
                className={`phase-pill ${isActive ? "active" : ""}`}
                key={pageId}
                onClick={() => setActivePage(pageId)}
                type="button"
              >
                <span className="phase-dot" />
                {meta.shortLabel}
                {index < Object.keys(PAGE_META).length - 1 ? <span className="phase-chevron">›</span> : null}
              </button>
            );
          })}
        </nav>
        <div className={`connection-badge ${connectionTone}`}>{connectionLabel}</div>
      </header>

      <div className="desktop-body">
        <aside className="left-rail" aria-label="Workflow navigation">
          <nav className="left-nav">
            <p className="rail-label">작업 단계</p>
            {navItems.map((item) => {
              const isActive = activePage === item.id;

              return (
                <button
                  aria-current={isActive ? "page" : undefined}
                  className={`nav-card ${isActive ? "active" : ""}`}
                  key={item.id}
                  onClick={() => setActivePage(item.id)}
                  type="button"
                >
                  <span className={`status-orb ${item.health}`} />
                  <span className="nav-copy">
                    <strong>{item.label}</strong>
                    <small>{item.sublabel}</small>
                  </span>
                  {item.badge ? <span className="nav-badge">{item.badge}</span> : null}
                </button>
              );
            })}
          </nav>

          <section className="rail-progress" aria-label="Live queue progress">
            <p className="rail-label">진행 현황</p>
            <div className="progress-row">
              <span>완성도</span>
              <strong>{confidence?.compositeScore ?? 0}%</strong>
            </div>
            <div className="progress-track">
              <span style={{ width: `${Math.min(100, confidence?.compositeScore ?? 0)}%` }} />
            </div>
            <dl>
              <div>
                <dt>대기 중인 질문</dt>
                <dd>{totalQueueCount}</dd>
              </div>
              <div>
                <dt>차단 질문</dt>
                <dd>{blockedQueueCount}</dd>
              </div>
            </dl>
          </section>
        </aside>

        <section className="desktop-workspace" aria-labelledby="active-view-title">
          <div className="workspace-heading">
            <div>
              <p className="view-kicker">{CONTRACT_SCHEMA_VERSION}</p>
              <h2 id="active-view-title">{activePageMeta.title}</h2>
              <p>{activePageMeta.description}</p>
            </div>
            <div className="workspace-actions">
              <button type="button" className="ghost-button" onClick={connect} disabled={isBusy}>
                Reconnect sidecar
              </button>
            </div>
          </div>

          {connectionState.status === "unavailable" ? (
            <section className="notice-panel">
              <h2>Sidecar unavailable</h2>
              <p>{connectionState.message}</p>
              <button type="button" onClick={connect}>
                Retry connection
              </button>
            </section>
          ) : null}

          {workflowError ? (
            <section className="notice-panel error">
              <h2>Command failed</h2>
              <p>{workflowError}</p>
            </section>
          ) : null}

          {children}
        </section>

        {rightRail}
      </div>
    </main>
  );
}
