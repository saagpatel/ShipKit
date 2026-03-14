// Matches shipkit_core::MigrationStatus
export interface MigrationStatus {
  version: number;
  name: string;
  applied: boolean;
  applied_at: string | null;
}

// Matches shipkit_core::MigrationOverview
export interface DatabaseOverview {
  total_registered: number;
  applied_count: number;
  pending_count: number;
  last_applied_version: number | null;
  last_applied_name: string | null;
  rollback_available: boolean;
  rollback_reason: string | null;
  operation_warning: string | null;
}

// Matches shipkit_core::ThemeMode
export type ThemeMode = "light" | "dark" | "system";

// Matches shipkit_core::ThemeDefinition
export interface ThemeDefinition {
  name: string;
  mode: ThemeMode;
  variables: Record<string, string>;
}

// Matches shipkit_core::logger::LogEntry
export interface LogEntry {
  timestamp: string;
  level: string;
  message: string;
  target: string;
  fields: unknown;
}

export interface CommandErrorShape {
  code: string;
  message: string;
  details?: string | null;
}

export interface AppOverview {
  app_name: string;
  version: string;
  platform: string;
  data_dir: string;
  database_path: string;
  log_dir: string;
  support_dir: string;
  active_theme: string;
  pending_migrations: number;
  applied_migrations: number;
  enabled_plugins: number;
  available_plugins: number;
}

export interface SupportBundleSummary {
  path: string;
  generated_at: string;
  log_entry_count: number;
  enabled_plugin_names: string[];
}

export interface SupportBundleArtifact {
  path: string;
  generated_at: string;
  size_bytes: number;
}

export interface DesktopSettings {
  startup_route: string;
  default_settings_namespace: string;
  default_log_level: string;
  confirm_before_rollback: boolean;
}

export interface PluginStatus {
  id: string;
  name: string;
  version: string;
  description: string;
  category: string;
  distribution: string;
  min_shipkit_version: string;
  compatibility: string;
  capabilities: string[];
  enabled: boolean;
}
