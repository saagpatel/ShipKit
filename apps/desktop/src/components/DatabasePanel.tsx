import { useEffect, useState } from "react";
import type { MigrationStatus } from "../lib/bindings";
import {
  applyMigrations,
  formatCommandError,
  getDesktopSettings,
  migrationStatus,
  rollbackMigration,
} from "../lib/invoke";

export function DatabasePanel() {
  const [migrations, setMigrations] = useState<MigrationStatus[]>([]);
  const [confirmBeforeRollback, setConfirmBeforeRollback] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = () => {
    migrationStatus()
      .then(setMigrations)
      .catch((e: unknown) => setError(formatCommandError(e)));
  };

  useEffect(() => {
    const syncPreferences = () => {
      getDesktopSettings()
        .then((settings) => setConfirmBeforeRollback(settings.confirm_before_rollback))
        .catch(() => setConfirmBeforeRollback(true));
    };

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
    applyMigrations()
      .then(setMigrations)
      .catch((e: unknown) => setError(formatCommandError(e)));
  };

  const handleRollback = () => {
    if (
      confirmBeforeRollback &&
      !window.confirm("Rollback the most recent migration?")
    ) {
      return;
    }

    rollbackMigration()
      .then(() => refresh())
      .catch((e: unknown) => setError(formatCommandError(e)));
  };

  return (
    <section className="page-shell">
      <header className="page-header">
        <div>
          <p className="eyebrow">Data safety</p>
          <h2>Database</h2>
          <p className="page-copy">
            Review registered migrations, apply pending changes, and rollback the
            most recent step when you need a safe local recovery.
          </p>
          <p className="panel-muted">
            Rollback confirmation is{" "}
            <strong>{confirmBeforeRollback ? "enabled" : "disabled"}</strong> in
            desktop preferences.
          </p>
        </div>
      </header>

      {error ? <p className="callout callout-error">{error}</p> : null}

      <section className="panel-card">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">Migrations</p>
            <h3>Registered migration status</h3>
          </div>
          <div className="panel-actions">
            <button className="panel-button" onClick={handleApply} type="button">
              Apply All
            </button>
            <button className="panel-button" onClick={handleRollback} type="button">
              Rollback Last
            </button>
            <button className="panel-button" onClick={refresh} type="button">
              Refresh
            </button>
          </div>
        </div>

        {migrations.length === 0 ? (
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
              {migrations.map((m) => (
                <tr key={m.version}>
                  <td>{m.version}</td>
                  <td>{m.name}</td>
                  <td>{m.applied ? "Applied" : "Pending"}</td>
                  <td>{m.applied_at ?? "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </section>
  );
}
