import { useEffect, useMemo, useState } from "react";
import type { PluginStatus } from "../lib/bindings";
import { formatCommandError, listPlugins, setPluginEnabledState } from "../lib/invoke";

export function PluginsPanel() {
  const [plugins, setPlugins] = useState<PluginStatus[]>([]);
  const [pendingPluginId, setPendingPluginId] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = () => {
    listPlugins()
      .then(setPlugins)
      .catch((nextError: unknown) => setError(formatCommandError(nextError)));
  };

  useEffect(() => {
    refresh();
  }, []);

  const enabledCount = useMemo(
    () => plugins.filter((plugin) => plugin.enabled).length,
    [plugins],
  );

  const categories = useMemo(
    () => Array.from(new Set(plugins.map((plugin) => plugin.category))).length,
    [plugins],
  );

  const handleToggle = (plugin: PluginStatus) => {
    setPendingPluginId(plugin.id);
    setError(null);
    setStatus(null);

    setPluginEnabledState(plugin.id, !plugin.enabled)
      .then((nextPlugins) => {
        setPlugins(nextPlugins);
        setStatus(
          `${plugin.name} ${plugin.enabled ? "disabled" : "enabled"} for this desktop workspace.`,
        );
        window.dispatchEvent(new Event("shipkit:plugins-updated"));
      })
      .catch((nextError: unknown) => setError(formatCommandError(nextError)))
      .finally(() => setPendingPluginId(null));
  };

  return (
    <section className="page-shell">
      <header className="page-header">
        <div>
          <p className="eyebrow">Curated extensions</p>
          <h2>Plugins</h2>
          <p className="page-copy">
            Review the curated plugin catalog and choose which modules stay active.
          </p>
        </div>
      </header>

      {error ? <p className="callout callout-error">{error}</p> : null}
      {status ? <p className="callout callout-success">{status}</p> : null}

      <div className="status-grid">
        <article className="status-card">
          <span className="status-label">Catalog size</span>
          <strong>{plugins.length}</strong>
          <p>Curated plugin manifests bundled with ShipKit Desktop.</p>
        </article>
        <article className="status-card">
          <span className="status-label">Enabled</span>
          <strong>{enabledCount}</strong>
          <p>Modules currently active in this local desktop workspace.</p>
        </article>
        <article className="status-card">
          <span className="status-label">Categories</span>
          <strong>{categories}</strong>
          <p>Catalog categories available in this workspace.</p>
        </article>
      </div>

      <section className="panel-card">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">Policy</p>
            <h3>Curated by default</h3>
          </div>
          <div className="panel-actions">
            <button className="panel-button" onClick={refresh} type="button">
              Refresh Catalog
            </button>
          </div>
        </div>

        <div className="panel-note">
          <p>
            Plugins are curated and signed-only for now to keep the first release safe.
          </p>
        </div>
      </section>

      <section className="panel-card">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">Catalog</p>
            <h3>Available plugins</h3>
          </div>
        </div>

        {plugins.length === 0 ? (
          <p className="panel-muted">No plugins are currently available in the catalog.</p>
        ) : (
          <div className="artifact-list">
            {plugins.map((plugin) => (
              <article className="detail-card" key={plugin.id}>
                <span className="status-label">
                  {plugin.category} · {plugin.distribution}
                </span>
                <p>
                  <strong>
                    {plugin.name} {plugin.version}
                  </strong>
                </p>
                <p>{plugin.description}</p>
                <p className="panel-muted">
                  Requires ShipKit {plugin.min_shipkit_version} · {plugin.compatibility}
                </p>
                <div className="plugin-capabilities">
                  {plugin.capabilities.map((capability) => (
                    <span className="plugin-badge" key={`${plugin.id}-${capability}`}>
                      {capability}
                    </span>
                  ))}
                </div>
                <div className="panel-actions">
                  <button
                    className={`panel-button${plugin.enabled ? " is-active" : ""}`}
                    disabled={pendingPluginId === plugin.id}
                    onClick={() => handleToggle(plugin)}
                    type="button"
                  >
                    {pendingPluginId === plugin.id
                      ? "Saving..."
                      : plugin.enabled
                        ? "Disable Plugin"
                        : "Enable Plugin"}
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
