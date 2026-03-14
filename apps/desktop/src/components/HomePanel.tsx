import { useEffect, useMemo, useState } from "react";
import type {
  DatabaseOverview,
  LogEntry,
  PluginStatus,
  ThemeDefinition,
} from "../lib/bindings";
import {
  formatCommandError,
  getDatabaseOverview,
  getLogEntries,
  getTheme,
  listPlugins,
} from "../lib/invoke";

export function HomePanel() {
  const [overview, setOverview] = useState<DatabaseOverview | null>(null);
  const [theme, setTheme] = useState<ThemeDefinition | null>(null);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [plugins, setPlugins] = useState<PluginStatus[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const load = () => {
      setIsLoading(true);
      Promise.all([getDatabaseOverview(), getTheme(), getLogEntries(8), listPlugins()])
        .then(([nextOverview, nextTheme, nextLogs, nextPlugins]) => {
          setOverview(nextOverview);
          setTheme(nextTheme);
          setLogs(nextLogs);
          setPlugins(nextPlugins);
        })
        .catch((nextError: unknown) => setError(formatCommandError(nextError)))
        .finally(() => setIsLoading(false));
    };

    load();
    window.addEventListener("shipkit:plugins-updated", load as EventListener);
    window.addEventListener("shipkit:theme-updated", load as EventListener);

    return () => {
      window.removeEventListener(
        "shipkit:plugins-updated",
        load as EventListener,
      );
      window.removeEventListener(
        "shipkit:theme-updated",
        load as EventListener,
      );
    };
  }, []);

  const enabledPlugins = useMemo(
    () => plugins.filter((plugin) => plugin.enabled),
    [plugins],
  );

  return (
    <section className="page-shell">
      <header className="page-header">
        <div>
          <p className="eyebrow">ShipKit Desktop</p>
          <h2>Home</h2>
          <p className="page-copy">
            Monitor runtime health, spot the next local action, and keep the
            main control surfaces moving in sync.
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
          <span className="status-label">Pending migrations</span>
          <strong>{overview?.pending_count ?? "Loading..."}</strong>
          <p>
            {isLoading
              ? "Checking schema readiness."
              : overview?.pending_count
                ? "Database attention is still needed."
                : "The local schema is current."}
          </p>
        </article>
        <article className="status-card">
          <span className="status-label">Recent logs</span>
          <strong>{isLoading ? "Loading..." : logs.length}</strong>
          <p>
            {logs.length === 0
              ? "No recent entries were returned."
              : "Recent runtime activity is available in the log center."}
          </p>
        </article>
        <article className="status-card">
          <span className="status-label">Enabled plugins</span>
          <strong>{isLoading ? "Loading..." : enabledPlugins.length}</strong>
          <p>
            {plugins.length === 0
              ? "The curated plugin catalog is currently empty."
              : "Curated extensions active in this workspace."}
          </p>
        </article>
      </div>

      <div className="field-grid">
        <section className="panel-card">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">Quick start</p>
              <h3>Check these first</h3>
            </div>
          </div>
          <ul className="bullet-list">
            <li>Check Database for pending migrations and rollback readiness.</li>
            <li>Use Settings for startup and recovery preferences.</li>
            <li>Use Theme to confirm active CSS variables.</li>
            <li>Use Logs to review recent events.</li>
            <li>Use Diagnostics to export a support bundle.</li>
            <li>Use Plugins to enable curated modules.</li>
          </ul>
        </section>

        <section className="panel-card">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">Plugin summary</p>
              <h3>Current curated workspace state</h3>
            </div>
          </div>

          {isLoading ? (
            <p className="panel-muted">Loading curated plugin state…</p>
          ) : plugins.length === 0 ? (
            <p className="panel-muted">No curated plugins are available in this build.</p>
          ) : enabledPlugins.length === 0 ? (
            <p className="panel-muted">
              No curated plugins are enabled yet. Open Plugins to choose the
              local modules you want active.
            </p>
          ) : (
            <div className="artifact-list">
              {enabledPlugins.map((plugin) => (
                <article className="detail-card" key={plugin.id}>
                  <span className="status-label">{plugin.category}</span>
                  <p>
                    <strong>{plugin.name}</strong>
                  </p>
                  <p className="panel-muted">{plugin.description}</p>
                </article>
              ))}
            </div>
          )}
        </section>
      </div>
    </section>
  );
}
