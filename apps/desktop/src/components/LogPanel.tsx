import { useEffect, useState } from "react";
import type { LogEntry } from "../lib/bindings";
import {
  formatCommandError,
  getDesktopSettings,
  getLogEntries,
} from "../lib/invoke";

export function LogPanel() {
  const [entries, setEntries] = useState<LogEntry[]>([]);
  const [level, setLevel] = useState<string>("all");
  const [error, setError] = useState<string | null>(null);

  const refresh = () => {
    const filter = level === "all" ? undefined : level;
    getLogEntries(50, filter)
      .then(setEntries)
      .catch((e: unknown) => setError(formatCommandError(e)));
  };

  useEffect(() => {
    const syncPreferences = () => {
      getDesktopSettings()
        .then((settings) => setLevel(settings.default_log_level || "all"))
        .catch(() => setLevel("all"));
    };

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

  useEffect(refresh, [level]);

  return (
    <section className="page-shell">
      <header className="page-header">
        <div>
          <p className="eyebrow">Runtime visibility</p>
          <h2>Logs</h2>
          <p className="page-copy">
            Review recent runtime events and filter by level.
          </p>
        </div>
      </header>

      {error ? <p className="callout callout-error">{error}</p> : null}

      <section className="panel-card">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">Recent activity</p>
            <h3>Runtime log stream</h3>
          </div>
          <div className="panel-actions">
            <select
              className="panel-select"
              value={level}
              onChange={(e) => setLevel(e.target.value)}
            >
              <option value="all">All Levels</option>
              <option value="INFO">Info</option>
              <option value="WARN">Warn</option>
              <option value="ERROR">Error</option>
              <option value="DEBUG">Debug</option>
              <option value="TRACE">Trace</option>
            </select>
            <button className="panel-button" onClick={refresh} type="button">
              Refresh
            </button>
          </div>
        </div>

        <div className="log-list">
          {entries.length === 0 ? (
            <p className="panel-muted">No log entries were returned.</p>
          ) : (
            entries.map((e, i) => (
              <div className="log-entry" data-level={e.level} key={i}>
                <span>{e.timestamp}</span>{" "}
                <strong>[{e.level}]</strong>{" "}
                <span>{e.message}</span>
              </div>
            ))
          )}
        </div>
      </section>
    </section>
  );
}
