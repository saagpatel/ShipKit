use std::sync::{Mutex, RwLock};

use shipkit_core::{ConnectionPool, Logger, MigrationEngine, SqliteSettingsStore, ThemeEngine};

#[derive(Debug, Clone)]
pub struct AppPaths {
    pub data_dir: std::path::PathBuf,
    pub database_path: std::path::PathBuf,
    pub log_dir: std::path::PathBuf,
    pub support_dir: std::path::PathBuf,
}

/// All application state managed by Tauri.
pub struct AppState {
    /// Kept alive so the pool isn't dropped. Commands access it via settings_store/migrations.
    pub _pool: ConnectionPool,
    pub migrations: Mutex<MigrationEngine>,
    pub settings_store: SqliteSettingsStore,
    pub theme_engine: RwLock<ThemeEngine>,
    pub logger: Logger,
    pub paths: AppPaths,
}
