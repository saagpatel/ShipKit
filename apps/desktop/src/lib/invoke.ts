import { invoke as tauriInvoke } from "@tauri-apps/api/core";
import type {
  AppOverview,
  CommandErrorShape,
  DesktopSettings,
  LogEntry,
  MigrationStatus,
  PluginStatus,
  SupportBundleArtifact,
  SupportBundleSummary,
  ThemeDefinition,
} from "./bindings";

export class AppCommandError extends Error {
  readonly code: string;
  readonly details?: string | null;

  constructor({ code, message, details }: CommandErrorShape) {
    super(message);
    this.name = "AppCommandError";
    this.code = code;
    this.details = details;
  }
}

function isCommandErrorShape(value: unknown): value is CommandErrorShape {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as Record<string, unknown>;
  return typeof candidate.code === "string" && typeof candidate.message === "string";
}

export function normalizeCommandError(error: unknown): AppCommandError {
  if (error instanceof AppCommandError) {
    return error;
  }

  if (isCommandErrorShape(error)) {
    return new AppCommandError(error);
  }

  if (typeof error === "string") {
    return new AppCommandError({
      code: "command.unknown",
      message: error,
      details: error,
    });
  }

  if (error instanceof Error) {
    return new AppCommandError({
      code: "command.unknown",
      message: error.message,
      details: error.stack,
    });
  }

  return new AppCommandError({
    code: "command.unknown",
    message: "An unexpected command failure occurred.",
    details: JSON.stringify(error),
  });
}

export function formatCommandError(error: unknown): string {
  const normalized = normalizeCommandError(error);
  return `${normalized.message} (${normalized.code})`;
}

async function invokeCommand<T>(
  command: string,
  args?: Record<string, unknown>,
): Promise<T> {
  try {
    return await tauriInvoke<T>(command, args);
  } catch (error) {
    throw normalizeCommandError(error);
  }
}

// Database
export const migrationStatus = () =>
  invokeCommand<MigrationStatus[]>("migration_status");

export const applyMigrations = () =>
  invokeCommand<MigrationStatus[]>("apply_migrations");

export const rollbackMigration = () =>
  invokeCommand<MigrationStatus | null>("rollback_migration");

// Settings
export const getSetting = (namespace: string, key: string) =>
  invokeCommand<unknown | null>("get_setting", { namespace, key });

export const setSetting = (namespace: string, key: string, value: unknown) =>
  invokeCommand<void>("set_setting", { namespace, key, value });

export const getAllSettings = (namespace: string) =>
  invokeCommand<Record<string, unknown>>("get_all_settings", { namespace });

export const loadSettings = (namespace: string) =>
  invokeCommand<Record<string, unknown>>("load_settings", { namespace });

export const saveSettings = (
  namespace: string,
  settings: Record<string, unknown>,
) => invokeCommand<void>("save_settings", { namespace, settings });

export const getDesktopSettings = () =>
  invokeCommand<DesktopSettings>("get_desktop_settings");

export const saveDesktopSettings = (settings: DesktopSettings) =>
  invokeCommand<DesktopSettings>("save_desktop_settings", { settings });

export const resetDesktopSettings = () =>
  invokeCommand<DesktopSettings>("reset_desktop_settings");

export const exportDesktopSettings = () =>
  invokeCommand<string>("export_desktop_settings");

export const importDesktopSettings = (payload: string) =>
  invokeCommand<DesktopSettings>("import_desktop_settings", { payload });

// Plugins
export const listPlugins = () => invokeCommand<PluginStatus[]>("list_plugins");

export const setPluginEnabledState = (pluginId: string, enabled: boolean) =>
  invokeCommand<PluginStatus[]>("set_plugin_enabled_state", { pluginId, enabled });

// Theme
export const getTheme = () => invokeCommand<ThemeDefinition>("get_theme");

export const setTheme = (name: string) =>
  invokeCommand<ThemeDefinition>("set_theme", { name });

export const listThemes = () =>
  invokeCommand<ThemeDefinition[]>("list_themes");

export const getCssVariables = () =>
  invokeCommand<string>("get_css_variables");

// Logger
export const getLogEntries = (count?: number, level?: string) =>
  invokeCommand<LogEntry[]>("get_log_entries", { count, level });

// Diagnostics
export const getAppOverview = () =>
  invokeCommand<AppOverview>("get_app_overview");

export const exportSupportBundle = () =>
  invokeCommand<SupportBundleSummary>("export_support_bundle");

export const listSupportBundles = () =>
  invokeCommand<SupportBundleArtifact[]>("list_support_bundles");

export const clearSupportBundles = () =>
  invokeCommand<number>("clear_support_bundles");

export const restoreDesktopSettingsFromBundle = (path: string) =>
  invokeCommand<DesktopSettings>("restore_desktop_settings_from_bundle", { path });
