import { API_ROUTE_CATALOG, CONTRACT_SCHEMA_VERSION } from "@solo-superman/contracts";
import { desktopRouteClientPlaceholders } from "../../shared/api/route-client";

const forbiddenScope = [
  "ProductEngine command behavior",
  "DB schema or migrations",
  "Codex runtime integration",
  "Full Decision Queue UI behavior",
  "Mounted /api/v1 product handlers"
] as const;

export function ScaffoldSummary() {
  return (
    <main className="shell">
      <section className="card hero-card">
        <p className="eyebrow">Phase 1 · PR-01 Workspace Scaffold</p>
        <h1>Solo Superman</h1>
        <p>
          Thin runnable desktop shell for validating package boundaries before product behavior is added.
        </p>
      </section>

      <section className="grid">
        <article className="card">
          <h2>Contracts</h2>
          <p>Schema version: {CONTRACT_SCHEMA_VERSION}</p>
          <p>{API_ROUTE_CATALOG.length} route names are available as compile-time placeholders.</p>
        </article>

        <article className="card">
          <h2>Desktop client stubs</h2>
          <p>{desktopRouteClientPlaceholders.length} client placeholders mirror docs/26 route names.</p>
          <p>No HTTP product client is constructed in this scaffold.</p>
        </article>

        <article className="card">
          <h2>Forbidden in PR-01</h2>
          <ul>
            {forbiddenScope.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </article>
      </section>
    </main>
  );
}
