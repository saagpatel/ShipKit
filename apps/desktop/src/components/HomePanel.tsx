import { useEffect, useMemo, useState } from "react";
import type { MigrationStatus, ThemeDefinition, LogEntry } from "../lib/bindings";
import {
  formatCommandError,
  getLogEntries,
  getTheme,
  listPlugins,
  migrationStatus,
} from "../lib/invoke";

export function HomePanel() {
  const [migrations, setMigrations] = useState<MigrationStatus[]>([]);
  const [theme, setTheme] = useState<ThemeDefinition | null>(null);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [pluginCount, setPluginCount] = useState(0);
  const [enabledPluginCount, setEnabledPluginCount] = useState(0);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = () => {
      Promise.all([migrationStatus(), getTheme(), getLogEntries(8), listPlugins()])
        .then(([nextMigrations, nextTheme, nextLogs, nextPlugins]) => {
          setMigrations(nextMigrations);
          setTheme(nextTheme);
          setLogs(nextLogs);
          setPluginCount(nextPlugins.length);
          setEnabledPluginCount(
            nextPlugins.filter((plugin) => plugin.enabled).length,
          );
        })
        .catch((nextError: unknown) => setError(formatCommandError(nextError)));
    };

    load();
    window.addEventListener("shipkit:plugins-updated", load as EventListener);

    return () => {
      window.removeEventListener(
        "shipkit:plugins-updated",
        load as EventListener,
      );
    };
  }, []);

  const pendingCount = useMemo(
    () => migrations.filter((migration) => !migration.applied).length,
    [migrations],
  );

  return (
    <section className="page-shell">
      <header className="page-header">
        <div>
          <p className="eyebrow">ShipKit Desktop</p>
          <h2>Home</h2>
          <p className="page-copy">
            Monitor your local runtime, check migration readiness, and jump into
            the tools that keep a ShipKit-powered app healthy.
          </p>
        </div>
      </header>

      {error ? <p className="callout callout-error">{error}</p> : null}

      <div className="status-grid">
        <article className="status-card">
          <span className="status-label">Theme</span>
          <strong>{theme?.name ?? "Loading..."}</strong>
          <p>{theme ? `${theme.mode} mode is active.` : "Fetching theme state."}</p>
        </article>
        <article className="status-card">
          <span className="status-label">Migrations</span>
          <strong>{migrations.length}</strong>
          <p>
            {pendingCount === 0
              ? "Everything registered is already applied."
              : `${pendingCount} migration(s) still need attention.`}
          </p>
        </article>
        <article className="status-card">
          <span className="status-label">Recent logs</span>
          <strong>{logs.length}</strong>
          <p>
            {logs.length === 0
              ? "No recent entries were returned."
              : "Recent runtime activity is available in the log center."}
          </p>
        </article>
        <article className="status-card">
          <span className="status-label">Plugins</span>
          <strong>{enabledPluginCount}/{pluginCount}</strong>
          <p>
            {pluginCount === 0
              ? "The curated plugin catalog is still empty."
              : "Review active extensions in the Plugins workspace."}
          </p>
        </article>
      </div>

      <section className="panel-card">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">Quick orientation</p>
            <h3>What to check first</h3>
          </div>
        </div>
        <ul className="bullet-list">
          <li>Open Database to apply or review pending migrations.</li>
          <li>Use Settings to inspect persisted app configuration.</li>
          <li>Use Theme to preview the active CSS variables.</li>
          <li>Use Logs to confirm the last runtime events and errors.</li>
          <li>Use Diagnostics to export a support bundle before deeper debugging.</li>
          <li>Use Plugins to enable the curated extensions you want in this workspace.</li>
        </ul>
      </section>
    </section>
  );
}
