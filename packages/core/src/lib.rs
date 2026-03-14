//! ShipKit Core — Production-ready building blocks for Tauri 2 desktop applications.
//!
//! # Modules
//! - [`db`] — SQLite connection pool and migration engine
//! - [`settings`] — Type-safe settings with SQLite persistence
//! - [`theme`] — CSS variable theme engine with system detection
//! - [`logger`] — Structured JSON logging with file rotation
//!
//! # Feature Flags
//! - `tauri` — Enables Tauri 2 commands and plugin registration

pub mod db;
pub mod error;
pub mod logger;
pub mod settings;
pub mod theme;

// Re-exports for convenience
pub use db::{ConnectionPool, Migration, MigrationEngine, MigrationOverview, MigrationStatus};
pub use error::{Result, ShipKitError};
pub use logger::{Logger, LoggerConfig};
pub use settings::{Settings, SettingsBackend, SettingsManager, SqliteSettingsStore};
pub use theme::{ThemeDefinition, ThemeEngine, ThemeMode};

// Re-export the derive macro so users write `use shipkit_core::Settings;`
pub use shipkit_macros::Settings;

/// Configuration for the ShipKit Tauri plugin.
#[cfg(feature = "tauri")]
pub struct ShipKitConfig {
    /// Path to the SQLite database file.
    pub database_path: std::path::PathBuf,
    /// Directory containing migration .sql files (optional).
    pub migrations_dir: Option<std::path::PathBuf>,
    /// Logger configuration.
    pub logger: LoggerConfig,
    /// Theme definitions (uses defaults if empty).
    pub themes: Vec<ThemeDefinition>,
    /// Name of the default/initial theme.
    pub default_theme: String,
}

#[cfg(feature = "tauri")]
impl ShipKitConfig {
    /// Create config with sensible defaults for the given app name.
    pub fn for_app(app_name: &str) -> Self {
        let data_dir = dirs::data_local_dir()
            .unwrap_or_else(|| std::path::PathBuf::from("."))
            .join(app_name);

        Self {
            database_path: data_dir.join("data.db"),
            migrations_dir: None,
            logger: LoggerConfig {
                log_dir: data_dir.join("logs"),
                file_prefix: app_name.to_string(),
                ..LoggerConfig::default()
            },
            themes: theme::default_themes(),
            default_theme: "dark".to_string(),
        }
    }
}
