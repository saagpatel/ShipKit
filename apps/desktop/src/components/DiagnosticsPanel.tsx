import { useEffect, useState } from "react";
import type {
  AppOverview,
  SupportBundleArtifact,
  SupportBundleSummary,
} from "../lib/bindings";
import {
  clearSupportBundles,
  exportSupportBundle,
  formatCommandError,
  getAppOverview,
  listSupportBundles,
  restoreDesktopSettingsFromBundle,
} from "../lib/invoke";

export function DiagnosticsPanel() {
  const [overview, setOverview] = useState<AppOverview | null>(null);
  const [bundle, setBundle] = useState<SupportBundleSummary | null>(null);
  const [bundleArtifacts, setBundleArtifacts] = useState<SupportBundleArtifact[]>([]);
  const [supportStatus, setSupportStatus] = useState<string | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [isClearing, setIsClearing] = useState(false);
  const [restoringBundlePath, setRestoringBundlePath] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = () => {
    setError(null);
    Promise.all([getAppOverview(), listSupportBundles()])
      .then(([nextOverview, nextBundles]) => {
        setOverview(nextOverview);
        setBundleArtifacts(nextBundles);
      })
      .catch((nextError: unknown) => setError(formatCommandError(nextError)));
  };

  useEffect(() => {
    refresh();
  }, []);

  const handleExport = () => {
    setIsExporting(true);
    setError(null);
    exportSupportBundle()
      .then((summary) => {
        setBundle(summary);
        setSupportStatus(
          `Support bundle exported with ${summary.log_entry_count} recent log entries.`,
        );
        return Promise.all([getAppOverview(), listSupportBundles()]);
      })
      .then(([nextOverview, nextBundles]) => {
        setOverview(nextOverview);
        setBundleArtifacts(nextBundles);
      })
      .catch((nextError: unknown) => setError(formatCommandError(nextError)))
      .finally(() => setIsExporting(false));
  };

  const handleClearBundles = () => {
    setIsClearing(true);
    setError(null);
    clearSupportBundles()
      .then((removedCount) => {
        setSupportStatus(`Cleared ${removedCount} support bundle(s).`);
        setBundle(null);
        return listSupportBundles();
      })
      .then(setBundleArtifacts)
      .catch((nextError: unknown) => setError(formatCommandError(nextError)))
      .finally(() => setIsClearing(false));
  };

  const handleRestorePreferences = (artifact: SupportBundleArtifact) => {
    setRestoringBundlePath(artifact.path);
    setError(null);
    restoreDesktopSettingsFromBundle(artifact.path)
      .then((settings) => {
        window.dispatchEvent(new Event("shipkit:desktop-settings-updated"));
        setSupportStatus(
          `Restored desktop preferences from ${artifact.path}. Startup route is now ${settings.startup_route}.`,
        );
      })
      .catch((nextError: unknown) => setError(formatCommandError(nextError)))
      .finally(() => setRestoringBundlePath(null));
  };

  return (
    <section className="page-shell">
      <header className="page-header">
        <div>
          <p className="eyebrow">Support and recovery</p>
          <h2>Diagnostics</h2>
          <p className="page-copy">
            Review runtime paths and manage support bundles for local debugging.
          </p>
        </div>
      </header>

      {error ? <p className="callout callout-error">{error}</p> : null}
      {bundle ? (
        <p className="callout callout-success">
          Support bundle exported to <strong>{bundle.path}</strong> with{" "}
          {bundle.log_entry_count} recent log entries.
        </p>
      ) : null}
      {supportStatus ? (
        <p className="callout callout-success">{supportStatus}</p>
      ) : null}

      <div className="status-grid">
        <article className="status-card">
          <span className="status-label">Platform</span>
          <strong>{overview?.platform ?? "Loading..."}</strong>
          <p>
            {overview
              ? `${overview.app_name} ${overview.version}`
              : "Reading runtime metadata."}
          </p>
        </article>
        <article className="status-card">
          <span className="status-label">Theme</span>
          <strong>{overview?.active_theme ?? "Loading..."}</strong>
          <p>Current theme selection used for the desktop shell.</p>
        </article>
        <article className="status-card">
          <span className="status-label">Migrations</span>
          <strong>
            {overview
              ? `${overview.applied_migrations}/${overview.applied_migrations + overview.pending_migrations}`
              : "Loading..."}
          </strong>
          <p>
            {overview
              ? `${overview.pending_migrations} pending migration(s) remain.`
              : "Checking migration status."}
          </p>
        </article>
        <article className="status-card">
          <span className="status-label">Plugins</span>
          <strong>
            {overview
              ? `${overview.enabled_plugins}/${overview.available_plugins}`
              : "Loading..."}
          </strong>
          <p>
            {overview
              ? `${overview.enabled_plugins} curated plugin(s) enabled in this workspace.`
              : "Checking curated plugin state."}
          </p>
        </article>
      </div>

      <section className="panel-card">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">Support bundle</p>
            <h3>Capture current local state</h3>
          </div>
          <div className="panel-actions">
            <button className="panel-button" onClick={refresh} type="button">
              Refresh
            </button>
            <button
              className="panel-button is-active"
              disabled={isExporting}
              onClick={handleExport}
              type="button"
            >
              {isExporting ? "Exporting..." : "Export Support Bundle"}
            </button>
          </div>
        </div>

        <div className="field-grid">
          <div className="detail-card">
            <span className="status-label">Data directory</span>
            <p>{overview?.data_dir ?? "Loading..."}</p>
          </div>
          <div className="detail-card">
            <span className="status-label">Database file</span>
            <p>{overview?.database_path ?? "Loading..."}</p>
          </div>
          <div className="detail-card">
            <span className="status-label">Log directory</span>
            <p>{overview?.log_dir ?? "Loading..."}</p>
          </div>
          <div className="detail-card">
            <span className="status-label">Support directory</span>
            <p>{overview?.support_dir ?? "Loading..."}</p>
          </div>
        </div>

        <div className="panel-note">
          <p>
            The bundle includes runtime metadata, paths, preferences, plugin state,
            and recent log entries.
          </p>
          <p>
            You can restore desktop preferences from any saved bundle below.
          </p>
        </div>
      </section>

      <section className="panel-card">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">Recovery</p>
            <h3>Existing support bundles</h3>
          </div>
          <div className="panel-actions">
            <button
              className="panel-button"
              disabled={isClearing || bundleArtifacts.length === 0}
              onClick={handleClearBundles}
              type="button"
            >
              {isClearing ? "Clearing..." : "Clear Support Bundles"}
            </button>
          </div>
        </div>

        {bundleArtifacts.length === 0 ? (
          <p className="panel-muted">No support bundles have been exported yet.</p>
        ) : (
          <div className="artifact-list">
            {bundleArtifacts.map((artifact) => (
              <article className="detail-card" key={artifact.path}>
                <span className="status-label">Bundle</span>
                <p>{artifact.path}</p>
                <p className="panel-muted">
                  Generated {artifact.generated_at} · {artifact.size_bytes} bytes
                </p>
                <div className="panel-actions">
                  <button
                    className="panel-button"
                    disabled={restoringBundlePath === artifact.path}
                    onClick={() => handleRestorePreferences(artifact)}
                    type="button"
                  >
                    {restoringBundlePath === artifact.path
                      ? "Restoring..."
                      : "Restore Preferences"}
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </section>
  );
}
