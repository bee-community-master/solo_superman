import { type ReactNode } from "react";
import { CONTRACT_SCHEMA_VERSION } from "@solo-superman/contracts";
import { LanguageSwitcher } from "../../../shared/i18n/app-language";
import { DECISION_QUEUE_PAGE_ORDER, useDecisionQueueCopy } from "./decision-queue-copy";
import type { DecisionQueueShellController } from "./useDecisionQueueShellController";

export type DecisionQueueDesktopLayoutController = Pick<
  DecisionQueueShellController,
  | "activePage"
  | "activePageMeta"
  | "blockedQueueCount"
  | "confidence"
  | "connect"
  | "connectionLabel"
  | "connectionState"
  | "connectionTone"
  | "isBusy"
  | "navItems"
  | "pageMeta"
  | "projections"
  | "setActivePage"
  | "totalQueueCount"
  | "workflowError"
>;

interface DecisionQueueDesktopLayoutProps {
  readonly controller: DecisionQueueDesktopLayoutController;
  readonly children: ReactNode;
  readonly rightRail: ReactNode;
}

export function DecisionQueueDesktopLayout({ controller, children, rightRail }: DecisionQueueDesktopLayoutProps) {
  const copy = useDecisionQueueCopy();
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
    pageMeta,
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
            <p>{projections.session?.projectId ?? copy.layout.localQueueFallback}</p>
          </div>
        </div>
        <nav className="phase-trail" aria-label={copy.layout.workflowSectionsAria}>
          {DECISION_QUEUE_PAGE_ORDER.map((pageId, index) => {
            const meta = pageMeta[pageId];
            const isActive = activePage === pageId;

            return (
              <button
                aria-label={`${meta.label}${isActive ? `, ${copy.layout.currentWorkflowStep}` : ""}`}
                aria-current={isActive ? "page" : undefined}
                className={`phase-pill ${isActive ? "active" : ""}`}
                key={pageId}
                onClick={() => setActivePage(pageId)}
                type="button"
              >
                <span className="phase-dot" />
                <span className="phase-label">{meta.shortLabel}</span>
                {index < DECISION_QUEUE_PAGE_ORDER.length - 1 ? <span className="phase-chevron">›</span> : null}
              </button>
            );
          })}
        </nav>
        <div className="topbar-actions">
          <LanguageSwitcher />
          <div className={`connection-badge ${connectionTone}`}>{connectionLabel}</div>
        </div>
      </header>

      <div className="desktop-body">
        <aside className="left-rail" aria-label={copy.layout.leftRailAria}>
          <nav className="left-nav">
            <p className="rail-label">{copy.layout.workflowSteps}</p>
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

          <section className="rail-progress" aria-label={copy.layout.progressAria}>
            <p className="rail-label">{copy.layout.progress}</p>
            <div className="progress-row">
              <span>{copy.layout.completeness}</span>
              <strong>{confidence?.compositeScore ?? 0}%</strong>
            </div>
            <div className="progress-track">
              <span style={{ width: `${Math.min(100, confidence?.compositeScore ?? 0)}%` }} />
            </div>
            <dl>
              <div>
                <dt>{copy.layout.pendingQuestions}</dt>
                <dd>{totalQueueCount}</dd>
              </div>
              <div>
                <dt>{copy.layout.blockedQuestions}</dt>
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
                {copy.layout.reconnectSidecar}
              </button>
            </div>
          </div>

          {connectionState.status === "unavailable" ? (
            <section className="notice-panel">
              <h2>{copy.layout.sidecarUnavailable}</h2>
              <p>
                {connectionState.message === "Sidecar connection is unavailable."
                  ? copy.layout.sidecarUnavailableMessage
                  : connectionState.message}
              </p>
              <button type="button" onClick={connect}>
                {copy.layout.retryConnection}
              </button>
            </section>
          ) : null}

          {workflowError ? (
            <section className="notice-panel error">
              <h2>{copy.layout.commandFailed}</h2>
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
