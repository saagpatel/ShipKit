#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod api;
mod commands;
mod plugins;
mod preferences;
mod state;

use std::sync::{Mutex, RwLock};
use std::time::Duration;

use serde_json::json;
use shipkit_core::theme::default_themes;
use shipkit_core::{
    ConnectionPool, LoggerConfig, Migration, MigrationEngine, Settings, SettingsBackend,
    SqliteSettingsStore, ThemeEngine,
};

use crate::preferences::DesktopSettings;

fn smoke_arg_value(flag: &str) -> Option<String> {
    let mut args = std::env::args().skip(1);
    while let Some(current) = args.next() {
        if current == flag {
            return args.next();
        }
    }

    None
}

#[allow(clippy::expect_used)]
fn main() {
    let smoke_exit_delay_ms = smoke_arg_value("--shipkit-smoke-exit-after-ms")
        .or_else(|| std::env::var("SHIPKIT_SMOKE_EXIT_AFTER_MS").ok())
        .and_then(|value| value.parse::<u64>().ok())
        .unwrap_or(0);

    let data_dir = smoke_arg_value("--shipkit-data-dir")
        .map(std::path::PathBuf::from)
        .or_else(|| std::env::var_os("SHIPKIT_DATA_DIR").map(std::path::PathBuf::from))
        .unwrap_or_else(|| {
            dirs::data_local_dir()
                .unwrap_or_else(|| std::path::PathBuf::from("."))
                .join("shipkit-desktop")
        });
    let database_path = data_dir.join("data.db");
    let log_dir = data_dir.join("logs");
    let support_dir = data_dir.join("support");

    std::fs::create_dir_all(&data_dir).expect("failed to create data directory");

    // 1. Logger — initialized first to capture everything after
    let logger = shipkit_core::Logger::init(LoggerConfig {
        log_dir: log_dir.clone(),
        file_prefix: "shipkit".into(),
        console_output: true,
        ..LoggerConfig::default()
    })
    .expect("failed to initialize logger");

    tracing::info!("ShipKit Desktop starting up");

    // 2. Database pool
    let pool =
        ConnectionPool::new(database_path.clone()).expect("failed to create connection pool");

    // 3. Settings store
    let settings_store =
        SqliteSettingsStore::new(pool.clone()).expect("failed to create settings store");

    // 4. Migration engine with a demo migration
    let mut migration_engine = MigrationEngine::new(pool.clone());
    migration_engine.register(Migration {
        version: 1,
        name: "create_notes".into(),
        up_sql: "CREATE TABLE IF NOT EXISTS notes (id INTEGER PRIMARY KEY, title TEXT NOT NULL, content TEXT, created_at TEXT DEFAULT (datetime('now')));".into(),
        down_sql: Some("DROP TABLE IF EXISTS notes;".into()),
    });

    // 5. Theme engine — restore persisted theme preference
    let themes = default_themes();
    let active_theme = settings_store
        .get("shipkit_internal", "active_theme")
        .ok()
        .flatten()
        .and_then(|v| v.as_str().map(String::from))
        .unwrap_or_else(|| "dark".to_string());

    let theme_engine = ThemeEngine::new(themes.clone(), &active_theme).unwrap_or_else(|_| {
        // Stored theme name no longer valid — fall back to dark
        ThemeEngine::new(themes, "dark").expect("default themes must include 'dark'")
    });

    tracing::info!(theme = %active_theme, "theme engine initialized");

    let app_state = state::AppState {
        _pool: pool,
        migrations: Mutex::new(migration_engine),
        settings_store,
        theme_engine: RwLock::new(theme_engine),
        logger,
        paths: state::AppPaths {
            data_dir,
            database_path,
            log_dir,
            support_dir,
        },
    };

    if let Err(error) = run_smoke_scenario(&app_state) {
        eprintln!("smoke scenario failed: {error}");
        std::process::exit(1);
    }

    if smoke_exit_delay_ms > 0 {
        std::thread::spawn(move || {
            std::thread::sleep(Duration::from_millis(smoke_exit_delay_ms));
            std::process::exit(0);
        });
    }

    tauri::Builder::default()
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .manage(app_state)
        .invoke_handler(tauri::generate_handler![
            commands::database::migration_status,
            commands::database::apply_migrations,
            commands::database::rollback_migration,
            commands::settings::get_setting,
            commands::settings::set_setting,
            commands::settings::get_all_settings,
            commands::settings::load_settings,
            commands::settings::save_settings,
            commands::theme::get_theme,
            commands::theme::set_theme,
            commands::theme::list_themes,
            commands::theme::get_css_variables,
            commands::logger::get_log_entries,
            commands::diagnostics::get_app_overview,
            commands::diagnostics::export_support_bundle,
            commands::diagnostics::list_support_bundles,
            commands::diagnostics::clear_support_bundles,
            commands::diagnostics::restore_desktop_settings_from_bundle,
            commands::preferences::get_desktop_settings,
            commands::preferences::save_desktop_settings,
            commands::preferences::reset_desktop_settings,
            commands::preferences::export_desktop_settings,
            commands::preferences::import_desktop_settings,
            commands::plugins::list_plugins,
            commands::plugins::set_plugin_enabled_state,
        ])
        .run(tauri::generate_context!())
        .expect("error running tauri application");
}

fn run_smoke_scenario(app_state: &state::AppState) -> Result<(), String> {
    let Some(scenario) = smoke_arg_value("--shipkit-smoke-scenario")
        .or_else(|| std::env::var("SHIPKIT_SMOKE_SCENARIO").ok())
    else {
        return Ok(());
    };

    match scenario.as_str() {
        "restore-support-bundle" => run_restore_support_bundle_smoke(app_state),
        _ => Err(format!("unknown smoke scenario: {scenario}")),
    }
}

fn run_restore_support_bundle_smoke(app_state: &state::AppState) -> Result<(), String> {
    std::fs::create_dir_all(&app_state.paths.support_dir).map_err(|err| err.to_string())?;
    let bundle_path = app_state
        .paths
        .support_dir
        .join("smoke-restore-support-bundle.json");
    let expected = DesktopSettings {
        startup_route: "logs".into(),
        default_settings_namespace: "smoke".into(),
        default_log_level: "WARN".into(),
        confirm_before_rollback: false,
    };
    let payload = json!({
        "generated_at": "2026-03-10T00:00:00Z",
        "desktop_preferences": expected,
    });

    std::fs::write(
        &bundle_path,
        serde_json::to_string_pretty(&payload).map_err(|err| err.to_string())?,
    )
    .map_err(|err| err.to_string())?;

    let restored = commands::diagnostics::restore_desktop_settings_from_path(
        &app_state.paths.support_dir,
        &app_state.settings_store,
        bundle_path.to_string_lossy().as_ref(),
    )
    .map_err(|err| format!("{} ({})", err.message, err.code))?;
    let loaded = DesktopSettings::load(&app_state.settings_store)
        .map(DesktopSettings::normalize)
        .map_err(|err| err.to_string())?;

    if restored != loaded {
        return Err("restored settings did not match the persisted settings".into());
    }

    if loaded != expected {
        return Err("smoke restore scenario did not apply the expected settings".into());
    }

    tracing::info!("restore-support-bundle smoke scenario completed");
    Ok(())
}
