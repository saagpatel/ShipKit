import { useEffect, useState } from "react";
import type { DesktopSettings } from "../lib/bindings";
import {
  exportDesktopSettings,
  formatCommandError,
  getDesktopSettings,
  getSetting,
  importDesktopSettings,
  loadSettings,
  resetDesktopSettings,
  saveDesktopSettings,
  saveSettings,
  setSetting,
} from "../lib/invoke";

const defaultPreferences: DesktopSettings = {
  startup_route: "home",
  default_settings_namespace: "demo",
  default_log_level: "all",
  confirm_before_rollback: true,
};

export function SettingsPanel() {
  const [preferences, setPreferences] = useState<DesktopSettings>(defaultPreferences);
  const [namespace, setNamespace] = useState(
    defaultPreferences.default_settings_namespace,
  );
  const [transferJson, setTransferJson] = useState("");
  const [key, setKey] = useState("");
  const [value, setValue] = useState("");
  const [preferenceStatus, setPreferenceStatus] = useState<string | null>(null);
  const [toolResult, setToolResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([getDesktopSettings(), exportDesktopSettings()])
      .then(([settings, exportedJson]) => {
        setPreferences(settings);
        setNamespace(settings.default_settings_namespace);
        setTransferJson(exportedJson);
      })
      .catch((nextError: unknown) => setError(formatCommandError(nextError)));
  }, []);

  const announcePreferencesUpdated = (settings: DesktopSettings) => {
    setPreferences(settings);
    setNamespace(settings.default_settings_namespace);
    window.dispatchEvent(new Event("shipkit:desktop-settings-updated"));
  };

  const refreshTransferJson = () => {
    exportDesktopSettings()
      .then((exportedJson) => {
        setTransferJson(exportedJson);
        setPreferenceStatus("Desktop preferences JSON refreshed.");
      })
      .catch((nextError: unknown) => setError(formatCommandError(nextError)));
  };

  const handleSavePreferences = () => {
    setError(null);
    saveDesktopSettings(preferences)
      .then((nextSettings) => {
        announcePreferencesUpdated(nextSettings);
        setPreferenceStatus("Desktop preferences saved.");
        return exportDesktopSettings();
      })
      .then(setTransferJson)
      .catch((nextError: unknown) => setError(formatCommandError(nextError)));
  };

  const handleResetPreferences = () => {
    setError(null);
    resetDesktopSettings()
      .then((nextSettings) => {
        announcePreferencesUpdated(nextSettings);
        setPreferenceStatus("Desktop preferences reset to defaults.");
        return exportDesktopSettings();
      })
      .then(setTransferJson)
      .catch((nextError: unknown) => setError(formatCommandError(nextError)));
  };

  const handleImportPreferences = () => {
    setError(null);
    importDesktopSettings(transferJson)
      .then((nextSettings) => {
        announcePreferencesUpdated(nextSettings);
        setPreferenceStatus("Desktop preferences imported.");
        return exportDesktopSettings();
      })
      .then(setTransferJson)
      .catch((nextError: unknown) => setError(formatCommandError(nextError)));
  };

  const handleExportPreferences = () => {
    setError(null);
    exportDesktopSettings()
      .then((exportedJson) => {
        setTransferJson(exportedJson);
        setPreferenceStatus("Desktop preferences exported as JSON.");
      })
      .catch((nextError: unknown) => setError(formatCommandError(nextError)));
  };

  const handleSet = () => {
    let parsed: unknown;
    try {
      parsed = JSON.parse(value);
    } catch {
      parsed = value;
    }

    setSetting(namespace, key, parsed)
      .then(() => setToolResult("Saved."))
      .catch((nextError: unknown) => setError(formatCommandError(nextError)));
  };

  const handleGet = () => {
    getSetting(namespace, key)
      .then((nextValue) => setToolResult(JSON.stringify(nextValue, null, 2)))
      .catch((nextError: unknown) => setError(formatCommandError(nextError)));
  };

  const handleLoadAll = () => {
    loadSettings(namespace)
      .then((nextValue) => setToolResult(JSON.stringify(nextValue, null, 2)))
      .catch((nextError: unknown) => setError(formatCommandError(nextError)));
  };

  const handleSaveBulk = () => {
    try {
      const obj = JSON.parse(value) as Record<string, unknown>;
      saveSettings(namespace, obj)
        .then(() => setToolResult("Bulk save complete."))
        .catch((nextError: unknown) => setError(formatCommandError(nextError)));
    } catch {
      setError("Value must be a valid JSON object for bulk save.");
    }
  };

  return (
    <section className="page-shell">
      <header className="page-header">
        <div>
          <p className="eyebrow">Persistence</p>
          <h2>Settings</h2>
          <p className="page-copy">
            Manage desktop preferences, then use the namespace editor for lower-level work.
          </p>
        </div>
      </header>

      {error ? <p className="callout callout-error">{error}</p> : null}

      <section className="panel-card">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">Desktop preferences</p>
            <h3>Typed product settings</h3>
          </div>
          <div className="panel-actions">
            <button className="panel-button" onClick={handleResetPreferences} type="button">
              Reset to Defaults
            </button>
            <button
              className="panel-button is-active"
              onClick={handleSavePreferences}
              type="button"
            >
              Save Preferences
            </button>
          </div>
        </div>

        <div className="field-grid">
          <label className="field-label">
            Startup route
            <select
              className="panel-select"
              value={preferences.startup_route}
              onChange={(event) =>
                setPreferences((current) => ({
                  ...current,
                  startup_route: event.target.value,
                }))
              }
            >
              <option value="home">Home</option>
              <option value="database">Database</option>
              <option value="settings">Settings</option>
              <option value="theme">Theme</option>
              <option value="logs">Logs</option>
              <option value="diagnostics">Diagnostics</option>
              <option value="updates">Updates</option>
              <option value="plugins">Plugins</option>
            </select>
          </label>
          <label className="field-label">
            Default log level
            <select
              className="panel-select"
              value={preferences.default_log_level}
              onChange={(event) =>
                setPreferences((current) => ({
                  ...current,
                  default_log_level: event.target.value,
                }))
              }
            >
              <option value="all">All Levels</option>
              <option value="INFO">Info</option>
              <option value="WARN">Warn</option>
              <option value="ERROR">Error</option>
              <option value="DEBUG">Debug</option>
              <option value="TRACE">Trace</option>
            </select>
          </label>
        </div>

        <div className="field-grid">
          <label className="field-label">
            Default settings namespace
            <input
              className="panel-input"
              value={preferences.default_settings_namespace}
              onChange={(event) =>
                setPreferences((current) => ({
                  ...current,
                  default_settings_namespace: event.target.value,
                }))
              }
            />
          </label>
          <label className="checkbox-field">
            <input
              checked={preferences.confirm_before_rollback}
              onChange={(event) =>
                setPreferences((current) => ({
                  ...current,
                  confirm_before_rollback: event.target.checked,
                }))
              }
              type="checkbox"
            />
            Confirm before rollback
          </label>
        </div>

        {preferenceStatus ? (
          <p className="panel-muted">{preferenceStatus}</p>
        ) : null}
      </section>

      <section className="panel-card">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">Transfer</p>
            <h3>Import or export preferences JSON</h3>
          </div>
          <div className="panel-actions">
            <button className="panel-button" onClick={handleExportPreferences} type="button">
              Export JSON
            </button>
            <button className="panel-button" onClick={refreshTransferJson} type="button">
              Refresh JSON
            </button>
            <button
              className="panel-button is-active"
              onClick={handleImportPreferences}
              type="button"
            >
              Import JSON
            </button>
          </div>
        </div>

        <label className="field-label">
          Preferences JSON
          <textarea
            className="panel-textarea"
            onChange={(event) => setTransferJson(event.target.value)}
            rows={10}
            value={transferJson}
          />
        </label>
      </section>

      <section className="panel-card">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">Advanced tools</p>
            <h3>Namespace editor</h3>
          </div>
        </div>

        <div className="field-grid">
          <label className="field-label">
            Namespace
            <input
              className="panel-input"
              value={namespace}
              onChange={(event) => setNamespace(event.target.value)}
            />
          </label>
          <label className="field-label">
            Key
            <input
              className="panel-input"
              value={key}
              onChange={(event) => setKey(event.target.value)}
            />
          </label>
        </div>

        <div className="field-grid is-single">
          <label className="field-label">
            Value
            <input
              className="panel-input"
              value={value}
              onChange={(event) => setValue(event.target.value)}
            />
          </label>
        </div>

        <div className="button-row">
          <button className="panel-button" onClick={handleSet} type="button">
            Set
          </button>
          <button className="panel-button" onClick={handleGet} type="button">
            Get
          </button>
          <button className="panel-button" onClick={handleLoadAll} type="button">
            Load All
          </button>
          <button className="panel-button" onClick={handleSaveBulk} type="button">
            Save Bulk
          </button>
        </div>

        {toolResult ? <pre className="panel-pre">{toolResult}</pre> : null}
      </section>
    </section>
  );
}
