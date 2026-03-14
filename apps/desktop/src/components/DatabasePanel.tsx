import { useEffect, useState } from "react";
import type { DatabaseOverview, MigrationStatus } from "../lib/bindings";
import {
  applyMigrations,
  formatCommandError,
  getDatabaseOverview,
  getDesktopSettings,
  migrationStatus,
  rollbackMigration,
} from "../lib/invoke";

export function DatabasePanel() {
  const [overview, setOverview] = useState<DatabaseOverview | null>(null);
  const [migrations, setMigrations] = useState<MigrationStatus[]>([]);
  const [confirmBeforeRollback, setConfirmBeforeRollback] = useState(true);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isApplying, setIsApplying] = useState(false);
  const [isRollingBack, setIsRollingBack] = useState(false);

  const syncPreferences = () => {
    getDesktopSettings()
      .then((settings) => setConfirmBeforeRollback(settings.confirm_before_rollback))
      .catch(() => setConfirmBeforeRollback(true));
  };

  const refresh = () => {
    setIsLoading(true);
    setError(null);

    Promise.all([getDatabaseOverview(), migrationStatus()])
      .then(([nextOverview, nextMigrations]) => {
        setOverview(nextOverview);
        setMigrations(nextMigrations);
      })
      .catch((nextError: unknown) => setError(formatCommandError(nextError)))
      .finally(() => setIsLoading(false));
  };

  useEffect(() => {
    refresh();
    syncPreferences();
    window.addEventListener(
      "shipkit:desktop-settings-updated",
      syncPreferences as EventListener,
    );

    return () => {
      window.removeEventListener(
        "shipkit:desktop-settings-updated",
        syncPreferences as EventListener,
      );
    };
  }, []);

  const handleApply = () => {
    setIsApplying(true);
    setError(null);
    setStatus(null);

    const pendingBefore = overview?.pending_count ?? 0;
    applyMigrations()
      .then((nextMigrations) => {
        setMigrations(nextMigrations);
        return getDatabaseOverview();
      })
      .then((nextOverview) => {
        setOverview(nextOverview);
        setStatus(
          pendingBefore > 0
            ? `Applied ${pendingBefore} pending migration(s).`
            : "No pending migrations needed to be applied.",
        );
      })
      .catch((nextError: unknown) => setError(formatCommandError(nextError)))
      .finally(() => setIsApplying(false));
  };

  const handleRollback = () => {
    if (!overview?.rollback_available) {
      return;
    }

    if (
      confirmBeforeRollback &&
      !window.confirm("Rollback the most recent migration?")
    ) {
      return;
    }

    setIsRollingBack(true);
    setError(null);
    setStatus(null);

    rollbackMigration()
      .then((rolledBack) => {
        if (!rolledBack) {
          setStatus("No applied migration was available to roll back.");
          return Promise.all([getDatabaseOverview(), migrationStatus()]);
        }

        setStatus(`Rolled back migration ${rolledBack.name}.`);
        return Promise.all([getDatabaseOverview(), migrationStatus()]);
      })
      .then(([nextOverview, nextMigrations]) => {
        setOverview(nextOverview);
        setMigrations(nextMigrations);
      })
      .catch((nextError: unknown) => setError(formatCommandError(nextError)))
      .finally(() => setIsRollingBack(false));
  };

  const actionDisabled = isLoading || isApplying || isRollingBack;

  return (
    <section className="page-shell">
      <header className="page-header">
        <div>
          <p className="eyebrow">Data safety</p>
          <h2>Database</h2>
          <p className="page-copy">
            Track migration readiness, apply pending work, and recover the latest
            step when rollback is still safe.
          </p>
        </div>
      </header>

      {error ? <p className="callout callout-error">{error}</p> : null}
      {status ? <p className="callout callout-success">{status}</p> : null}
      {!error && overview?.operation_warning ? (
        <p className="callout callout-info">{overview.operation_warning}</p>
      ) : null}

      <div className="status-grid">
        <article className="status-card">
          <span className="status-label">Registered</span>
          <strong>{overview?.total_registered ?? "Loading..."}</strong>
          <p>
            {isLoading
              ? "Reading registered migration metadata."
              : "Total ShipKit migrations currently known to this workspace."}
          </p>
        </article>
        <article className="status-card">
          <span className="status-label">Applied</span>
          <strong>{overview?.applied_count ?? "Loading..."}</strong>
          <p>
            {isLoading
              ? "Checking applied migration history."
              : "Migrations already persisted in the local database."}
          </p>
        </article>
        <article className="status-card">
          <span className="status-label">Pending</span>
          <strong>{overview?.pending_count ?? "Loading..."}</strong>
          <p>
            {isLoading
              ? "Checking pending migration work."
              : overview?.pending_count
                ? "Apply these before treating the workspace as current."
                : "The local schema is already current."}
          </p>
        </article>
        <article className="status-card">
          <span className="status-label">Latest applied</span>
          <strong>{overview?.last_applied_name ?? "None yet"}</strong>
          <p>
            {overview?.last_applied_version
              ? `Version ${overview.last_applied_version}`
              : "No migration has been applied in this workspace yet."}
          </p>
        </article>
      </div>

      <section className="panel-card">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">Operator flow</p>
            <h3>Migration actions</h3>
          </div>
          <div className="panel-actions">
            <button
              className="panel-button is-active"
              disabled={actionDisabled}
              onClick={handleApply}
              type="button"
            >
              {isApplying ? "Applying..." : "Apply Pending"}
            </button>
            <button
              className="panel-button"
              disabled={actionDisabled || !overview?.rollback_available}
              onClick={handleRollback}
              type="button"
            >
              {isRollingBack ? "Rolling Back..." : "Rollback Last"}
            </button>
            <button
              className="panel-button"
              disabled={actionDisabled}
              onClick={refresh}
              type="button"
            >
              {isLoading ? "Refreshing..." : "Refresh"}
            </button>
          </div>
        </div>

        <div className="field-grid">
          <div className="detail-card">
            <span className="status-label">Rollback readiness</span>
            <p>
              {overview?.rollback_available
                ? "The latest applied migration has a rollback path."
                : overview?.rollback_reason ?? "Checking rollback readiness."}
            </p>
          </div>
          <div className="detail-card">
            <span className="status-label">Rollback confirmation</span>
            <p>
              Rollback confirmation is{" "}
              <strong>{confirmBeforeRollback ? "enabled" : "disabled"}</strong> in
              desktop preferences.
            </p>
          </div>
        </div>
      </section>

      <section className="panel-card">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">Migration history</p>
            <h3>Registered migration status</h3>
          </div>
        </div>

        {isLoading ? (
          <p className="panel-muted">Loading migration status…</p>
        ) : migrations.length === 0 ? (
          <p className="panel-muted">No migrations are currently registered.</p>
        ) : (
          <table className="panel-table">
            <thead>
              <tr>
                <th>Version</th>
                <th>Name</th>
                <th>Status</th>
                <th>Applied At</th>
              </tr>
            </thead>
            <tbody>
              {migrations.map((migration) => (
                <tr key={migration.version}>
                  <td>{migration.version}</td>
                  <td>{migration.name}</td>
                  <td>{migration.applied ? "Applied" : "Pending"}</td>
                  <td>{migration.applied_at ?? "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </section>
  );
}
