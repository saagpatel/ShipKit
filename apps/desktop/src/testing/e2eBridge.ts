import type { Update as NativeUpdate } from "@tauri-apps/plugin-updater";
import type {
  AppOverview,
  CommandErrorShape,
  DatabaseOverview,
  DesktopSettings,
  LogEntry,
  MigrationStatus,
  PluginStatus,
  SupportBundleArtifact,
  SupportBundleSummary,
  ThemeDefinition,
} from "../lib/bindings";
import type { UpdateDownloadProgress } from "../lib/updater";

type ThemeName = "ocean" | "sunrise";

type E2EState = {
  desktopSettings: DesktopSettings;
  namespaces: Record<string, Record<string, unknown>>;
  migrations: MigrationStatus[];
  theme: ThemeName;
  logs: LogEntry[];
  plugins: PluginStatus[];
  supportBundles: SupportBundleArtifact[];
  supportBundlePayloads: Record<string, DesktopSettings>;
  manifestConfigured: boolean;
  updateAvailable: boolean;
  faults: Record<string, boolean>;
};

const storageKey = "shipkit:e2e-state";
const supportDir = "/tmp/shipkit-e2e/support";
const dataDir = "/tmp/shipkit-e2e";
const databasePath = "/tmp/shipkit-e2e/data.db";
const logDir = "/tmp/shipkit-e2e/logs";

const themes: Record<ThemeName, ThemeDefinition> = {
  ocean: {
    name: "ocean",
    mode: "dark",
    variables: {
      "--sk-surface": "#0d1422",
      "--sk-accent": "#4e84ff",
      "--sk-panel": "#121a2b",
    },
  },
  sunrise: {
    name: "sunrise",
    mode: "light",
    variables: {
      "--sk-surface": "#fff4e8",
      "--sk-accent": "#d66d2d",
      "--sk-panel": "#fff9f2",
    },
  },
};

const commandErrors = {
  exportSupportBundle: {
    code: "support.export_failed",
    message: "Support bundle could not be exported.",
    details: "Simulated by the E2E bridge.",
  },
  pluginToggle: {
    code: "plugins.save_failed",
    message: "Plugin state could not be saved.",
    details: "Simulated by the E2E bridge.",
  },
  feedNotConfigured: {
    code: "updater.feed_not_configured",
    message: "No embedded updater feed is configured for this build.",
    details:
      "Local-only Mac builds can skip updater credentials until signed release work begins.",
  },
  updaterNotConfigured: {
    code: "updater.not_configured",
    message: "Updater feed is not configured for this build.",
    details:
      "Local-only Mac builds can skip updater credentials until signed release work begins.",
  },
} satisfies Record<string, CommandErrorShape>;

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function timestamp() {
  return new Date().toISOString();
}

function defaultState(): E2EState {
  return {
    desktopSettings: {
      startup_route: "home",
      default_settings_namespace: "demo",
      default_log_level: "INFO",
      confirm_before_rollback: true,
    },
    namespaces: {
      demo: {
        workspace: "local",
      },
    },
    migrations: [
      {
        version: 1,
        name: "create_notes",
        applied: true,
        applied_at: "2026-03-10T00:00:00Z",
      },
      {
        version: 2,
        name: "add_operator_flags",
        applied: false,
        applied_at: null,
      },
    ],
    theme: "ocean",
    logs: [
      {
        timestamp: "2026-03-10T00:00:00Z",
        level: "INFO",
        message: "ShipKit Desktop ready",
        target: "shipkit.desktop",
        fields: { route: "home" },
      },
      {
        timestamp: "2026-03-10T00:00:05Z",
        level: "WARN",
        message: "Updater feed is intentionally not configured in local mode",
        target: "shipkit.updater",
        fields: null,
      },
    ],
    plugins: [
      {
        id: "shipkit.release-brief",
        name: "Release Brief",
        version: "1.0.0",
        description: "Builds a concise release summary from local metadata.",
        category: "release",
        distribution: "curated-signed",
        min_shipkit_version: "0.1.0",
        compatibility: "ready",
        capabilities: ["release", "notes"],
        enabled: true,
      },
      {
        id: "shipkit.runtime-snapshot",
        name: "Runtime Snapshot",
        version: "1.0.0",
        description: "Captures local runtime state for debugging.",
        category: "diagnostics",
        distribution: "curated-signed",
        min_shipkit_version: "0.1.0",
        compatibility: "ready",
        capabilities: ["diagnostics", "support"],
        enabled: false,
      },
      {
        id: "shipkit.migration-audit",
        name: "Migration Audit",
        version: "1.0.0",
        description: "Highlights pending migration work before risky local changes.",
        category: "database",
        distribution: "curated-signed",
        min_shipkit_version: "0.1.0",
        compatibility: "review",
        capabilities: ["migrations", "audit"],
        enabled: false,
      },
    ],
    supportBundles: [],
    supportBundlePayloads: {},
    manifestConfigured: false,
    updateAvailable: false,
    faults: {},
  };
}

function readState(): E2EState {
  const stored = window.localStorage.getItem(storageKey);
  if (!stored) {
    const seeded = defaultState();
    writeState(seeded);
    return seeded;
  }

  try {
    return {
      ...defaultState(),
      ...JSON.parse(stored),
    } as E2EState;
  } catch {
    const seeded = defaultState();
    writeState(seeded);
    return seeded;
  }
}

function writeState(state: E2EState) {
  window.localStorage.setItem(storageKey, JSON.stringify(state));
}

function withState<T>(mutate: (state: E2EState) => T): T {
  const state = readState();
  const result = mutate(state);
  writeState(state);
  return result;
}

function currentTheme(state: E2EState): ThemeDefinition {
  return clone(themes[state.theme]);
}

function cssVariables(theme: ThemeDefinition): string {
  return `:root { ${Object.entries(theme.variables)
    .map(([key, value]) => `${key}: ${value};`)
    .join(" ")} }`;
}

function databaseOverview(state: E2EState): DatabaseOverview {
  const total_registered = state.migrations.length;
  const applied = state.migrations.filter((migration) => migration.applied);
  const pending_count = total_registered - applied.length;
  const lastApplied = [...applied].sort((left, right) => right.version - left.version)[0] ?? null;
  const rollback_available = Boolean(lastApplied);
  const rollback_reason = rollback_available
    ? null
    : "No applied migrations are available to roll back in this local workspace.";
  const operation_warning =
    pending_count > 0
      ? `${pending_count} migration(s) still need to be applied before the workspace is fully current.`
      : null;

  return {
    total_registered,
    applied_count: applied.length,
    pending_count,
    last_applied_version: lastApplied?.version ?? null,
    last_applied_name: lastApplied?.name ?? null,
    rollback_available,
    rollback_reason,
    operation_warning,
  };
}

function appOverview(state: E2EState): AppOverview {
  const overview = databaseOverview(state);
  const enabledPlugins = state.plugins.filter((plugin) => plugin.enabled).length;

  return {
    app_name: "ShipKit Desktop",
    version: "0.1.0",
    platform: "darwin",
    data_dir: dataDir,
    database_path: databasePath,
    log_dir: logDir,
    support_dir: supportDir,
    active_theme: state.theme,
    pending_migrations: overview.pending_count,
    applied_migrations: overview.applied_count,
    enabled_plugins: enabledPlugins,
    available_plugins: state.plugins.length,
  };
}

function reject(error: CommandErrorShape): Promise<never> {
  return Promise.reject(clone(error));
}

function ensureNamespace(
  state: E2EState,
  namespace: string,
): Record<string, unknown> {
  const normalized = namespace.trim() || "default";
  state.namespaces[normalized] ??= {};
  return state.namespaces[normalized];
}

function nextBundlePath(state: E2EState) {
  return `${supportDir}/support-bundle-${String(state.supportBundles.length + 1).padStart(2, "0")}.json`;
}

function supportSummary(summary: SupportBundleSummary) {
  if (summary.enabled_plugin_names.length === 0) {
    return "No curated plugins were enabled when this bundle was captured.";
  }

  return `Captured plugin state for ${summary.enabled_plugin_names.join(", ")}.`;
}

if (import.meta.env.MODE === "e2e" && !window.__SHIPKIT_E2E_BRIDGE__) {
  window.__SHIPKIT_E2E_BRIDGE__ = {
    async invoke<T>(command: string, args?: Record<string, unknown>) {
      return withState((state) => {
        switch (command) {
          case "migration_status":
            return clone(state.migrations) as T;
          case "get_database_overview":
            return databaseOverview(state) as T;
          case "apply_migrations":
            state.migrations = state.migrations.map((migration) =>
              migration.applied
                ? migration
                : {
                    ...migration,
                    applied: true,
                    applied_at: timestamp(),
                  },
            );
            return clone(state.migrations) as T;
          case "rollback_migration": {
            const applied = [...state.migrations]
              .filter((migration) => migration.applied)
              .sort((left, right) => right.version - left.version);
            const lastApplied = applied[0];
            if (!lastApplied) {
              return null as T;
            }

            state.migrations = state.migrations.map((migration) =>
              migration.version === lastApplied.version
                ? {
                    ...migration,
                    applied: false,
                    applied_at: null,
                  }
                : migration,
            );
            return clone(
              state.migrations.find((migration) => migration.version === lastApplied.version) ??
                null,
            ) as T;
          }
          case "get_setting": {
            const namespace = String(args?.namespace ?? "");
            const key = String(args?.key ?? "");
            return clone(ensureNamespace(state, namespace)[key] ?? null) as T;
          }
          case "set_setting": {
            const namespace = String(args?.namespace ?? "");
            const key = String(args?.key ?? "");
            ensureNamespace(state, namespace)[key] = clone(args?.value ?? null);
            return undefined as T;
          }
          case "get_all_settings":
          case "load_settings": {
            const namespace = String(args?.namespace ?? "");
            return clone(ensureNamespace(state, namespace)) as T;
          }
          case "save_settings": {
            const namespace = String(args?.namespace ?? "");
            ensureNamespace(state, namespace);
            state.namespaces[namespace] = clone(
              (args?.settings as Record<string, unknown> | undefined) ?? {},
            );
            return undefined as T;
          }
          case "get_desktop_settings":
            return clone(state.desktopSettings) as T;
          case "save_desktop_settings":
            state.desktopSettings = clone(
              (args?.settings as DesktopSettings | undefined) ?? state.desktopSettings,
            );
            return clone(state.desktopSettings) as T;
          case "reset_desktop_settings":
            state.desktopSettings = defaultState().desktopSettings;
            return clone(state.desktopSettings) as T;
          case "export_desktop_settings":
            return JSON.stringify(state.desktopSettings, null, 2) as T;
          case "import_desktop_settings": {
            const payload = JSON.parse(String(args?.payload ?? "{}")) as DesktopSettings;
            state.desktopSettings = clone(payload);
            return clone(state.desktopSettings) as T;
          }
          case "list_plugins":
            return clone(state.plugins) as T;
          case "set_plugin_enabled_state": {
            if (state.faults.pluginToggle) {
              return reject(commandErrors.pluginToggle) as Promise<T>;
            }

            const pluginId = String(args?.pluginId ?? "");
            const enabled = Boolean(args?.enabled);
            state.plugins = state.plugins.map((plugin) =>
              plugin.id === pluginId ? { ...plugin, enabled } : plugin,
            );
            return clone(state.plugins) as T;
          }
          case "get_theme":
            return currentTheme(state) as T;
          case "set_theme": {
            const nextTheme = String(args?.name ?? "ocean");
            state.theme = nextTheme === "sunrise" ? "sunrise" : "ocean";
            return currentTheme(state) as T;
          }
          case "list_themes":
            return clone(Object.values(themes)) as T;
          case "get_css_variables":
            return cssVariables(currentTheme(state)) as T;
          case "get_log_entries": {
            const count = Number(args?.count ?? state.logs.length);
            const level = String(args?.level ?? "").toUpperCase();
            const logs = level
              ? state.logs.filter((entry) => entry.level === level)
              : state.logs;
            return clone(logs.slice(0, count)) as T;
          }
          case "get_app_overview":
            return appOverview(state) as T;
          case "export_support_bundle": {
            if (state.faults.exportSupportBundle) {
              return reject(commandErrors.exportSupportBundle) as Promise<T>;
            }

            const enabledPluginNames = state.plugins
              .filter((plugin) => plugin.enabled)
              .map((plugin) => plugin.name);
            const summary: SupportBundleSummary = {
              path: nextBundlePath(state),
              generated_at: timestamp(),
              log_entry_count: state.logs.length,
              enabled_plugin_names: enabledPluginNames,
            };
            state.supportBundles = [
              {
                path: summary.path,
                generated_at: summary.generated_at,
                size_bytes: JSON.stringify(summary).length + 256,
              },
              ...state.supportBundles,
            ];
            state.supportBundlePayloads[summary.path] = clone(state.desktopSettings);
            return clone(summary) as T;
          }
          case "list_support_bundles":
            return clone(state.supportBundles) as T;
          case "clear_support_bundles": {
            const removed = state.supportBundles.length;
            state.supportBundles = [];
            state.supportBundlePayloads = {};
            return removed as T;
          }
          case "restore_desktop_settings_from_bundle": {
            const path = String(args?.path ?? "");
            const payload = state.supportBundlePayloads[path];
            if (!payload) {
              return reject({
                code: "support.restore_missing_preferences",
                message: "Support bundle does not include desktop preferences.",
                details: path,
              }) as Promise<T>;
            }
            state.desktopSettings = clone(payload);
            return clone(state.desktopSettings) as T;
          }
          default:
            return reject({
              code: "command.not_implemented",
              message: `E2E bridge does not implement ${command}.`,
              details: command,
            }) as Promise<T>;
        }
      });
    },
    getUpdateBuildDefaults() {
      const state = readState();
      return {
        channel: "local",
        host: "local-dev",
        repository: null,
        manifestUrl: state.manifestConfigured
          ? "http://127.0.0.1:4173/local-feed/latest.json"
          : null,
      };
    },
    async checkForUpdates() {
      const state = readState();
      if (!state.manifestConfigured) {
        return reject(commandErrors.updaterNotConfigured);
      }

      if (!state.updateAvailable) {
        return { update: null, summary: null };
      }

      const update = {
        available: true,
        body: "Local signed release rehearsal",
        currentVersion: "0.1.0",
        date: "2026-03-10",
        rawJson: {},
        version: "0.2.0",
        async downloadAndInstall(
          callback?:
            | ((event:
                | { event: "Started"; data: { contentLength: number | null } }
                | { event: "Progress"; data: { chunkLength: number } }
                | { event: "Finished" }) => void)
            | undefined,
        ) {
          callback?.({
            event: "Started",
            data: { contentLength: 100 },
          });
          callback?.({
            event: "Progress",
            data: { chunkLength: 100 },
          });
          callback?.({
            event: "Finished",
          });
        },
        async close() {},
      } as NativeUpdate;

      return {
        update,
        summary: {
          currentVersion: "0.1.0",
          version: "0.2.0",
          date: "2026-03-10",
          body: "Local signed release rehearsal",
        },
      };
    },
    async inspectConfiguredFeed(manifestUrl: string | null) {
      if (!manifestUrl) {
        return reject(commandErrors.feedNotConfigured);
      }

      return {
        endpoint: manifestUrl,
        version: "0.2.0",
        pubDate: "2026-03-10T00:00:00Z",
        notes: "Local-only feed rehearsal",
        artifactUrl: `${manifestUrl.replace(/latest\.json$/, "ShipKit.zip")}`,
        signaturePresent: true,
      };
    },
    async downloadAndInstallUpdate(
      update: NativeUpdate,
      onProgress?: (progress: UpdateDownloadProgress) => void,
    ) {
      await update.downloadAndInstall?.((event) => {
        if (event.event === "Started") {
          onProgress?.({
            phase: "started",
            downloadedBytes: 0,
            totalBytes: event.data.contentLength ?? null,
            percent: 0,
          });
          return;
        }

        if (event.event === "Progress") {
          onProgress?.({
            phase: "downloading",
            downloadedBytes: event.data.chunkLength,
            totalBytes: 100,
            percent: 100,
          });
          return;
        }

        onProgress?.({
          phase: "finished",
          downloadedBytes: 100,
          totalBytes: 100,
          percent: 100,
        });
      });
    },
    async relaunchAfterUpdate() {
      return;
    },
    controls: {
      reset() {
        writeState(defaultState());
      },
      clearStorage() {
        window.localStorage.removeItem(storageKey);
      },
      setFault(name: string, enabled: boolean) {
        withState((state) => {
          state.faults[name] = enabled;
        });
      },
      setManifestConfigured(enabled: boolean) {
        withState((state) => {
          state.manifestConfigured = enabled;
        });
      },
      setUpdateAvailable(enabled: boolean) {
        withState((state) => {
          state.updateAvailable = enabled;
        });
      },
      seedEmptyPlugins() {
        withState((state) => {
          state.plugins = [];
        });
      },
      getState() {
        const state = readState();
        return {
          desktopSettings: clone(state.desktopSettings),
          migrations: clone(state.migrations),
          databaseOverview: databaseOverview(state),
          theme: currentTheme(state),
          logs: clone(state.logs),
          plugins: clone(state.plugins),
          supportBundles: clone(state.supportBundles),
          appOverview: appOverview(state),
        };
      },
    },
    commandErrors,
    supportSummary,
  };
}
