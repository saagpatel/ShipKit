import { useEffect, useMemo, useState } from "react";
import type { PluginStatus } from "../lib/bindings";
import { formatCommandError, listPlugins, setPluginEnabledState } from "../lib/invoke";

type EnabledFilter = "all" | "enabled" | "disabled";
type CompatibilityFilter = "all" | "ready" | "review";
type SortMode = "name" | "category" | "enabled";

function compatibilityState(plugin: PluginStatus): CompatibilityFilter {
  const normalized = plugin.compatibility.toLowerCase();
  return /ready|safe|current/.test(normalized) ? "ready" : "review";
}

export function PluginsPanel() {
  const [plugins, setPlugins] = useState<PluginStatus[]>([]);
  const [pendingPluginId, setPendingPluginId] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [enabledFilter, setEnabledFilter] = useState<EnabledFilter>("all");
  const [compatibilityFilter, setCompatibilityFilter] =
    useState<CompatibilityFilter>("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [sortMode, setSortMode] = useState<SortMode>("name");

  const refresh = () => {
    setIsLoading(true);
    setError(null);
    listPlugins()
      .then(setPlugins)
      .catch((nextError: unknown) => setError(formatCommandError(nextError)))
      .finally(() => setIsLoading(false));
  };

  useEffect(() => {
    refresh();
  }, []);

  const enabledCount = useMemo(
    () => plugins.filter((plugin) => plugin.enabled).length,
    [plugins],
  );

  const categories = useMemo(
    () => Array.from(new Set(plugins.map((plugin) => plugin.category))).sort(),
    [plugins],
  );

  const filteredPlugins = useMemo(() => {
    const nextPlugins = plugins.filter((plugin) => {
      if (enabledFilter === "enabled" && !plugin.enabled) {
        return false;
      }
      if (enabledFilter === "disabled" && plugin.enabled) {
        return false;
      }
      if (
        compatibilityFilter !== "all" &&
        compatibilityState(plugin) !== compatibilityFilter
      ) {
        return false;
      }
      if (categoryFilter !== "all" && plugin.category !== categoryFilter) {
        return false;
      }
      return true;
    });

    nextPlugins.sort((left, right) => {
      if (sortMode === "enabled") {
        return Number(right.enabled) - Number(left.enabled) || left.name.localeCompare(right.name);
      }
      if (sortMode === "category") {
        return left.category.localeCompare(right.category) || left.name.localeCompare(right.name);
      }
      return left.name.localeCompare(right.name);
    });

    return nextPlugins;
  }, [categoryFilter, compatibilityFilter, enabledFilter, plugins, sortMode]);

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
            Review the curated ShipKit extension catalog, highlight what is ready
            for local use, and keep only the modules this workspace needs active.
          </p>
        </div>
      </header>

      {error ? <p className="callout callout-error">{error}</p> : null}
      {status ? <p className="callout callout-success">{status}</p> : null}

      <div className="status-grid">
        <article className="status-card">
          <span className="status-label">Catalog size</span>
          <strong>{isLoading ? "Loading..." : plugins.length}</strong>
          <p>
            {isLoading
              ? "Loading curated plugin manifests."
              : "Curated plugin manifests bundled with ShipKit Desktop."}
          </p>
        </article>
        <article className="status-card">
          <span className="status-label">Enabled</span>
          <strong>{isLoading ? "Loading..." : enabledCount}</strong>
          <p>Modules currently active in this local desktop workspace.</p>
        </article>
        <article className="status-card">
          <span className="status-label">Categories</span>
          <strong>{isLoading ? "Loading..." : categories.length}</strong>
          <p>Catalog categories available in this workspace.</p>
        </article>
        <article className="status-card">
          <span className="status-label">Ready now</span>
          <strong>
            {isLoading
              ? "Loading..."
              : plugins.filter((plugin) => compatibilityState(plugin) === "ready").length}
          </strong>
          <p>Curated plugins that already fit the current local product slice.</p>
        </article>
      </div>

      <section className="panel-card">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">Policy</p>
            <h3>Curated and local-first</h3>
          </div>
          <div className="panel-actions">
            <button className="panel-button" onClick={refresh} type="button">
              Refresh Catalog
            </button>
          </div>
        </div>

        <div className="panel-note">
          <p>
            Plugins remain curated and signed-only by design. This keeps the
            local macOS product trustworthy without opening a third-party
            extension surface yet.
          </p>
        </div>
      </section>

      <section className="panel-card">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">Catalog tools</p>
            <h3>Filter and sort the workspace catalog</h3>
          </div>
        </div>

        <div className="field-grid">
          <label className="field-label">
            Enabled state
            <select
              className="panel-select"
              onChange={(event) => setEnabledFilter(event.target.value as EnabledFilter)}
              value={enabledFilter}
            >
              <option value="all">All plugins</option>
              <option value="enabled">Enabled only</option>
              <option value="disabled">Disabled only</option>
            </select>
          </label>
          <label className="field-label">
            Compatibility
            <select
              className="panel-select"
              onChange={(event) =>
                setCompatibilityFilter(event.target.value as CompatibilityFilter)
              }
              value={compatibilityFilter}
            >
              <option value="all">All compatibility states</option>
              <option value="ready">Ready now</option>
              <option value="review">Needs review</option>
            </select>
          </label>
          <label className="field-label">
            Category
            <select
              className="panel-select"
              onChange={(event) => setCategoryFilter(event.target.value)}
              value={categoryFilter}
            >
              <option value="all">All categories</option>
              {categories.map((category) => (
                <option key={category} value={category}>
                  {category}
                </option>
              ))}
            </select>
          </label>
          <label className="field-label">
            Sort by
            <select
              className="panel-select"
              onChange={(event) => setSortMode(event.target.value as SortMode)}
              value={sortMode}
            >
              <option value="name">Name</option>
              <option value="category">Category</option>
              <option value="enabled">Enabled first</option>
            </select>
          </label>
        </div>
      </section>

      <section className="panel-card">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">Catalog</p>
            <h3>Available plugins</h3>
          </div>
        </div>

        {isLoading ? (
          <p className="panel-muted">Loading curated plugin catalog…</p>
        ) : plugins.length === 0 ? (
          <p className="panel-muted">No plugins are currently available in the catalog.</p>
        ) : filteredPlugins.length === 0 ? (
          <p className="panel-muted">
            No plugins match the current filters. Adjust the catalog tools above to
            widen the view.
          </p>
        ) : (
          <div className="artifact-list">
            {filteredPlugins.map((plugin) => (
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
                  Compatibility: {plugin.compatibility} · Minimum ShipKit{" "}
                  {plugin.min_shipkit_version}
                </p>
                <div className="plugin-capabilities">
                  {plugin.capabilities.map((capability) => (
                    <span className="plugin-badge" key={`${plugin.id}-${capability}`}>
                      {capability}
                    </span>
                  ))}
                </div>
                <div className="field-grid plugin-metadata-grid">
                  <div className="detail-card">
                    <span className="status-label">State</span>
                    <p>{plugin.enabled ? "Enabled in this workspace" : "Disabled"}</p>
                  </div>
                  <div className="detail-card">
                    <span className="status-label">Readiness</span>
                    <p>
                      {compatibilityState(plugin) === "ready"
                        ? "Ready for local use"
                        : "Review before enabling"}
                    </p>
                  </div>
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
